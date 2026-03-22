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
 * TCP_SERVER node - manages TCP server lifecycle and data exchange.
 *
 * Config fields:
 *   port             - server port (required)
 *   operation        - START | BROADCAST | RECEIVE | STOP (required)
 *   sendData         - data to broadcast (for BROADCAST operation, supports ${variable} placeholders)
 *   sendHex          - if true, sendData is treated as hex string
 *   timeout          - receive timeout in ms (default 10000, for RECEIVE operation)
 *   outputVariable   - variable to store received data (default "tcpServerData")
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

            if (port <= 0) {
                return NodeResult.error("TCP_SERVER: valid port is required");
            }

            switch (operation.toUpperCase()) {
                case "START" -> {
                    return handleStart(node, context, port);
                }
                case "BROADCAST" -> {
                    return handleBroadcast(node, context, config, port);
                }
                case "RECEIVE" -> {
                    return handleReceive(node, context, config, port, outputVar);
                }
                case "STOP" -> {
                    return handleStop(node, context, port);
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

    private NodeResult handleStart(FlowNode node, FlowExecutionContext context, int port) throws Exception {
        tcpServerManager.startServer(port);
        context.addLog("TCP server started on port " + port);
        log.info("TCP_SERVER node '{}': server started on port {}", node.getName(), port);
        return NodeResult.ok("Server started on port " + port);
    }

    private NodeResult handleBroadcast(FlowNode node, FlowExecutionContext context,
                                        Map<String, Object> config, int port) throws Exception {
        String sendDataRaw = (String) config.get("sendData");
        boolean sendHex = toBool(config.get("sendHex"), false);
        String sendData = sendDataRaw != null ? resolveVariables(sendDataRaw, context) : "";

        if (sendHex) {
            // Convert hex to string for broadcast
            byte[] bytes = TcpClientNodeHandler.hexStringToBytes(sendData);
            sendData = new String(bytes, java.nio.charset.StandardCharsets.UTF_8);
        }

        int clientCount = tcpServerManager.broadcast(port, sendData);
        context.addLog("TCP server broadcast to " + clientCount + " clients on port " + port);
        log.info("TCP_SERVER node '{}': broadcast to {} clients on port {}", node.getName(), clientCount, port);
        return NodeResult.ok(clientCount);
    }

    private NodeResult handleReceive(FlowNode node, FlowExecutionContext context,
                                      Map<String, Object> config, int port, String outputVar) throws Exception {
        int timeout = toInt(config.get("timeout"), 10000);

        context.addLog("TCP server waiting for data on port " + port + " (timeout: " + timeout + "ms)");
        log.info("TCP_SERVER node '{}': waiting for data on port {} (timeout: {}ms)", node.getName(), port, timeout);

        String received = tcpServerManager.waitForData(port, timeout);

        if (received == null) {
            context.addLog("TCP server receive timeout on port " + port);
            return NodeResult.error("TCP_SERVER receive timeout on port " + port);
        }

        context.setVariable(outputVar, received);
        context.addLog("TCP server received: " + abbreviate(received, 120));
        log.info("TCP_SERVER node '{}': received {} chars on port {}", node.getName(), received.length(), port);
        return NodeResult.ok(received);
    }

    private NodeResult handleStop(FlowNode node, FlowExecutionContext context, int port) {
        tcpServerManager.stopServer(port);
        context.addLog("TCP server stopped on port " + port);
        log.info("TCP_SERVER node '{}': server stopped on port {}", node.getName(), port);
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
