package com.iot.task.node.impl;

import com.iot.task.engine.FlowExecutionContext;
import com.iot.task.model.FlowNode;
import com.iot.task.node.NodeHandler;
import com.iot.task.node.NodeResult;
import com.iot.task.tcp.TcpServerManager;
import com.iot.util.VariablePathUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * TCP_SERVER 节点 - 管理 TCP 服务器生命周期和数据交换。
 * 重要：使用 eventId 严格隔离数据，防止串台。
 *
 * 配置字段：
 *   port             - 服务器端口（必填）
 *   operation        - START | BROADCAST | RECEIVE | STOP（必填）
 *   sendData         - 要广播的数据（BROADCAST 操作使用，支持 ${variable} 占位符）
 *   sendHex          - 如果为 true，sendData 被视为十六进制字符串
 *   timeout          - 接收超时（毫秒，默认 10000，RECEIVE 操作使用）
 *   outputVariable   - 存储接收数据的变量（默认 "tcpServerData"）
 *   cleanupOnStop    - STOP 操作时是否清理任务队列（默认 true）
 */
@Slf4j
@Component
public class TcpServerNodeHandler implements NodeHandler {

    private final TcpServerManager tcpServerManager;

    public TcpServerNodeHandler(TcpServerManager tcpServerManager) {
        this.tcpServerManager = tcpServerManager;
    }

    @Override
    public String getType() {
        return "TCP_SERVER";
    }

    @Override
    public NodeResult execute(FlowNode node, FlowExecutionContext context) {
        try {
            Map<String, Object> config = node.getConfig();
            if (config == null) {
                return NodeResult.error("TCP_SERVER node has no config");
            }

            int port = toInt(config.get("port"), 0);
            String operation = (String) config.getOrDefault("operation", "START");
            String outputVar = (String) config.getOrDefault("outputVariable", "tcpServerData");
            String eventId = context.getEventId();

            if (port <= 0) {
                return NodeResult.error("TCP_SERVER: valid port is required");
            }

            if (eventId == null) {
                log.warn("TCP_SERVER node '{}': eventId is null, data isolation may not work!", node.getName());
            }

            switch (operation.toUpperCase()) {
                case "START" -> {
                    return handleStart(node, context, port, eventId);
                }
                case "BROADCAST" -> {
                    return handleBroadcast(node, context, config, port, eventId);
                }
                case "RECEIVE" -> {
                    return handleReceive(node, context, config, port, outputVar, eventId);
                }
                case "STOP" -> {
                    return handleStop(node, context, config, port, eventId);
                }
                default -> {
                    return NodeResult.error("TCP_SERVER: unknown operation: " + operation);
                }
            }

        } catch (Exception e) {
            log.error("TCP_SERVER node '{}' failed: {}", node.getName(), e.getMessage(), e);
            context.addLog("TCP_SERVER error: " + e.getMessage());
            return NodeResult.error("TCP_SERVER failed: " + e.getMessage());
        }
    }

    private NodeResult handleStart(FlowNode node, FlowExecutionContext context, 
                                    int port, String eventId) throws Exception {
        boolean created = tcpServerManager.startServer(port);
        context.addLog((created ? "TCP server started on port " : "TCP server reused (already listening) on port ")
                + port + (eventId != null ? " (eventId: " + eventId + ")" : ""));
        log.info("TCP_SERVER node '{}': server {} on port {} (eventId: {})", 
                node.getName(), created ? "started" : "reused", port, eventId);
        return NodeResult.ok("Server " + (created ? "started" : "reused") + " on port " + port);
    }

    private NodeResult handleBroadcast(FlowNode node, FlowExecutionContext context,
                                        Map<String, Object> config, int port, String eventId) throws Exception {
        String sendDataRaw = (String) config.get("sendData");
        boolean sendHex = toBool(config.get("sendHex"), false);
        String sendData = sendDataRaw != null ? resolveVariables(sendDataRaw, context) : "";

        if (sendHex) {
            byte[] bytes = TcpClientNodeHandler.hexStringToBytes(sendData);
            sendData = new String(bytes, java.nio.charset.StandardCharsets.UTF_8);
        }

        int clientCount = tcpServerManager.broadcast(port, eventId, sendData);
        context.addLog("TCP server broadcast to " + clientCount + " clients on port " + port +
                (eventId != null ? " (eventId: " + eventId + ")" : ""));
        log.info("TCP_SERVER node '{}': broadcast to {} clients on port {} (eventId: {})", 
                node.getName(), clientCount, port, eventId);
        return NodeResult.ok(clientCount);
    }

    private NodeResult handleReceive(FlowNode node, FlowExecutionContext context,
                                      Map<String, Object> config, int port, String outputVar, 
                                      String eventId) throws Exception {
        int timeout = toInt(config.get("timeout"), 10000);

        context.addLog("TCP server waiting for data on port " + port + 
                " (timeout: " + timeout + "ms" + 
                (eventId != null ? ", eventId: " + eventId : "") + ")");
        log.info("TCP_SERVER node '{}': waiting for data on port {} (timeout: {}ms, eventId: {})", 
                node.getName(), port, timeout, eventId);

        String received = tcpServerManager.waitForData(port, eventId, timeout);

        if (received == null) {
            context.addLog("TCP server receive timeout on port " + port +
                    (eventId != null ? " (eventId: " + eventId + ")" : ""));
            return NodeResult.error("TCP_SERVER receive timeout on port " + port);
        }

        context.setVariable(outputVar, received);
        context.addLog("TCP server received: " + abbreviate(received, 120));
        log.info("TCP_SERVER node '{}': received {} chars on port {} (eventId: {})", 
                node.getName(), received.length(), port, eventId);
        return NodeResult.ok(received);
    }

    private NodeResult handleStop(FlowNode node, FlowExecutionContext context,
                                   Map<String, Object> config, int port, String eventId) {
        boolean cleanup = toBool(config.get("cleanupOnStop"), true);

        if (cleanup && eventId != null) {
            tcpServerManager.cleanupTaskQueue(port, eventId);
            context.addLog("Cleaned up task queue for eventId: " + eventId);
        }

        if (context.isContinuousExecution()) {
            context.addLog("TCP server STOP 已跳过（连续/轮询任务保持监听端口，避免重复创建 TCP 服务）");
            log.info("TCP_SERVER node '{}': STOP skipped (continuous execution), port {} kept open", 
                    node.getName(), port);
            return NodeResult.ok("Server kept running (continuous mode)");
        }

        tcpServerManager.stopServer(port);
        context.addLog("TCP server stopped on port " + port);
        log.info("TCP_SERVER node '{}': server stopped on port {} (eventId: {})", 
                node.getName(), port, eventId);
        return NodeResult.ok("Server stopped on port " + port);
    }

    private String resolveVariables(String template, FlowExecutionContext context) {
        if (template == null) return null;
        StringBuilder sb = new StringBuilder();
        int i = 0;
        while (i < template.length()) {
            if (i + 1 < template.length() && template.charAt(i) == '$' && template.charAt(i + 1) == '{') {
                int end = template.indexOf('}', i + 2);
                if (end > 0) {
                    String varPath = template.substring(i + 2, end);
                    Object val = VariablePathUtils.getValue(context.getVariables(), varPath);
                    sb.append(val != null ? val.toString() : "");
                    i = end + 1;
                    continue;
                }
            }
            sb.append(template.charAt(i));
            i++;
        }
        return sb.toString();
    }

    private static boolean toBool(Object obj, boolean def) {
        if (obj instanceof Boolean b) return b;
        if (obj instanceof String s) return "true".equalsIgnoreCase(s);
        return def;
    }

    private static int toInt(Object obj, int def) {
        if (obj instanceof Number n) return n.intValue();
        if (obj instanceof String s) {
            try { return Integer.parseInt(s); } catch (Exception ignored) {}
        }
        return def;
    }

    private static String abbreviate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "...";
    }
}
