package com.iot.task.engine;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iot.entity.FlowExecutionLog;
import com.iot.mapper.FlowExecutionLogMapper;
import com.iot.task.model.FlowDefinition;
import com.iot.task.model.FlowNode;
import com.iot.task.node.NodeHandler;
import com.iot.task.node.NodeHandlerRegistry;
import com.iot.task.node.NodeResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.ArrayList;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Slf4j
@Component
public class FlowExecutor {

    private static final int MAX_FLOW_STEPS = 100_000;

    private final NodeHandlerRegistry nodeHandlerRegistry;
    private final FlowExecutionLogMapper flowExecutionLogMapper;
    private final boolean flowVerbose;
    private final ObjectMapper objectMapper;

    public FlowExecutor(NodeHandlerRegistry nodeHandlerRegistry,
                        FlowExecutionLogMapper flowExecutionLogMapper,
                        @Value("${logging.flow.verbose:false}") boolean flowVerbose,
                        ObjectMapper objectMapper) {
        this.nodeHandlerRegistry = nodeHandlerRegistry;
        this.flowExecutionLogMapper = flowExecutionLogMapper;
        this.flowVerbose = flowVerbose;
        this.objectMapper = objectMapper;
    }

    public void execute(FlowDefinition flow, FlowExecutionContext context) {
        // 生成唯一的eventId
        String eventId = java.util.UUID.randomUUID().toString();
        context.setEventId(eventId);
        
        FlowNode startNode = flow.findStartNode();
        if (startNode == null) {
            context.addLog("ERROR: No START node found in flow definition");
            log.error("No START node found in flow definition");
            return;
        }

        log.info("Starting flow execution from node: {}", startNode.getName());
        if (flowVerbose) {
            // 中文注释：详细模式输出执行会话头尾与上下文信息，便于深度排查。
            context.addLog("SYSTEM", "================ 流程执行开始 ================", "START", startNode.getName(), null, null);
            context.addLog("SYSTEM", "流程ID: " + context.getFlowConfigId() + ", 流程名称: " + context.getFlowName(), null, null, null, null);
            context.addLog("SYSTEM", "事件ID: " + eventId, null, null, null, null);
            context.addLog("SYSTEM", "【初始上下文数据】", null, null, abbreviateLogData(context.getVariables().toString()), null);
        }

        executeNode(startNode, flow, context);

        if (flowVerbose) {
            context.addLog("SYSTEM", "================ 流程执行结束 ================", "END", null, null, null);
            context.addLog("SYSTEM", "最终状态: " + (context.isCompleted() ? "成功(Completed)" : "未完成(Incomplete)"), null, null, null, null);
            context.addLog("SYSTEM", "【最终上下文数据】", null, null, abbreviateLogData(context.getVariables().toString()), null);
        }
        // 中文注释：执行结束后统一将本次上下文日志落库，支持“任务执行日志”界面直接复用调试视图。
        saveExecutionLogsToDb(context);
        log.info("Flow execution finished, completed: {}", context.isCompleted());
    }

    private void executeNode(FlowNode node, FlowDefinition flow, FlowExecutionContext context) {
        if (node == null || context.isCompleted()) {
            return;
        }

        if (!context.recordExecutionStep(MAX_FLOW_STEPS)) {
            log.warn("Flow step limit exceeded (max {})", MAX_FLOW_STEPS);
            context.addLog("ERROR: Flow execution step limit exceeded (" + MAX_FLOW_STEPS + "), aborting");
            return;
        }

        String nodeType = node.getType();
        NodeHandler handler = nodeHandlerRegistry.getHandler(nodeType);

        if (handler == null) {
            log.error("No handler found for node type: {}", nodeType);
            context.addLog("ERROR: No handler for node type: " + nodeType);
            return;
        }

        log.info("Executing node: {} (type: {})", node.getName(), nodeType);
        if (flowVerbose) {
            context.addLog("INFO", "【节点执行开始】", nodeType, node.getName(), null, null);
            context.addLog("INFO", "【节点输入数据】", nodeType, node.getName(), abbreviateLogData(context.getVariables().toString()), null);
        }

        NodeResult result;
        long startTime = System.currentTimeMillis();
        try {
            context.enterNodeLogScope(nodeType, node.getName());
            // 中文注释：统一记录节点执行参数，所有节点都按同一结构产出过程详情。
            context.addLog("INFO", "节点执行参数", nodeType, node.getName(), buildNodeStartDetail(node, context), null);
            result = handler.execute(node, context);
            long duration = System.currentTimeMillis() - startTime;
            // 中文注释：节点执行默认只记录一次结果日志，避免“开始/结束/上下文”多条冗余记录。
            context.addLog("SUCCESS", "【节点执行成功】", nodeType, node.getName(), buildNodeSuccessDetail(result), duration);
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            log.error("Unexpected error executing node: {}", node.getName(), e);
            Map<String, Object> err = new LinkedHashMap<>();
            err.put("exception", e.getClass().getSimpleName());
            err.put("message", e.getMessage());
            context.addLog("ERROR", "【节点执行异常】" + e.getMessage(), nodeType, node.getName(), err, duration);
            return;
        } finally {
            context.exitNodeLogScope();
        }

        if (result == null) {
            Map<String, Object> warn = new LinkedHashMap<>();
            warn.put("reason", "handler_returned_null");
            context.addLog("WARN", "【节点执行警告】返回了空结果", nodeType, node.getName(), warn, null);
            // 对于定时任务，如果节点返回空结果，跳过并完成任务
            context.setCompleted(true);
            return;
        }

        if (!result.isSuccess()) {
            log.warn("Node {} failed: {}", node.getName(), result.getErrorMessage());
            Map<String, Object> fail = new LinkedHashMap<>();
            fail.put("errorMessage", result.getErrorMessage());
            fail.put("nextNodeIds", result.getNextNodeIds());
            fail.put("resultData", result.getResultData());
            context.addLog("ERROR", "【节点执行失败】" + result.getErrorMessage(), nodeType, node.getName(), fail, null);
            // 对于定时任务，如果节点执行失败，跳过并完成任务
            context.setCompleted(true);
            return;
        } else {
             if (result.getResultData() != null) {
                 context.setVariable("node_" + node.getId() + "_result", result.getResultData());
                 if (flowVerbose) {
                     context.addLog("INFO", "【节点执行结果数据】", nodeType, node.getName(), abbreviateLogData(result.getResultData().toString()), null);
                 }
             } else if (flowVerbose && (result.getNextNodeIds() == null || result.getNextNodeIds().isEmpty())) {
                 context.addLog("INFO", "【节点执行无结果数据】", nodeType, node.getName(), null, null);
             }
             if (flowVerbose) {
                 context.addLog("INFO", "【节点输出后上下文】", nodeType, node.getName(), abbreviateLogData(context.getVariables().toString()), null);
             }
        }

        if (context.isCompleted()) {
            return;
        }

        // Determine next nodes
        List<String> nextNodeIds;
        if (result.getNextNodeIds() != null && !result.getNextNodeIds().isEmpty()) {
            nextNodeIds = result.getNextNodeIds();
        } else {
            nextNodeIds = flow.getTargetNodeIds(node.getId());
        }

        if (nextNodeIds == null || nextNodeIds.isEmpty()) {
            if (flowVerbose) {
                context.addLog("WARN", "没有后续节点可以执行: " + node.getName(), nodeType, node.getName(), null, null);
            }
            return;
        }
        // 中文注释：统一记录节点流转去向，便于在单条节点日志中回放流程走向。
        Map<String, Object> route = new LinkedHashMap<>();
        route.put("nextNodeIds", nextNodeIds);
        context.addLog("INFO", "节点流转目标", nodeType, node.getName(), route, null);

        if (nextNodeIds.size() == 1) {
            // Serial execution for single next node
            FlowNode nextNode = flow.findNodeById(nextNodeIds.get(0));
            if (flowVerbose) {
                context.addLog("SYSTEM", String.format("【流程流转】节点 %s -> 节点 %s", node.getName(), nextNode != null ? nextNode.getName() : "null"), nodeType, node.getName(), null, null);
            }
            executeNode(nextNode, flow, context);
        } else {
            // Parallel execution for multiple next nodes
            log.info("Parallel execution of {} branches from node: {}", nextNodeIds.size(), node.getName());
            if (flowVerbose) {
                context.addLog("SYSTEM", String.format("【流程流转】节点 %s 分支执行, 目标节点数: %d", node.getName(), nextNodeIds.size()), nodeType, node.getName(), null, null);
            }

            CompletableFuture<?>[] futures = nextNodeIds.stream()
                    .map(nodeId -> {
                        FlowNode nextNode = flow.findNodeById(nodeId);
                        return CompletableFuture.runAsync(() -> executeNode(nextNode, flow, context));
                    })
                    .toArray(CompletableFuture[]::new);

            try {
                CompletableFuture.allOf(futures).join();
            } catch (Exception e) {
                log.error("Error in parallel execution from node: {}", node.getName(), e);
                context.addLog("ERROR", "分支并行执行异常: " + e.getMessage(), nodeType, node.getName(), null, null);
            }
        }
    }

    private void saveExecutionLogsToDb(FlowExecutionContext context) {
        if (flowExecutionLogMapper == null || context.getFlowConfigId() == null) {
            return;
        }
        try {
            Long flowConfigId = Long.valueOf(context.getFlowConfigId());
            List<ExecutionLogEntry> entries = context.getExecutionLog();
            if (entries == null || entries.isEmpty()) {
                return;
            }
            // 中文注释：按“每个节点一条结果记录”聚合，过程日志写入 dataJson.processLines。
            Map<String, List<String>> processMap = new LinkedHashMap<>();
            List<FlowExecutionLog> records = new ArrayList<>();
            for (ExecutionLogEntry entry : entries) {
                String actionType = safe(entry.getActionType());
                String nodeName = safe(entry.getNodeName());
                // 中文注释：与 Handler 内硬编码的 actionType（如 CONDITION）对齐，避免因流程 JSON 中 type 大小写不一致导致 processLines 聚合键分裂、条件过程丢失。
                String key = buildLogAggregateKey(actionType, nodeName);
                boolean nodeScoped = isNodeScoped(actionType, nodeName);
                boolean terminal = isTerminalNodeRecord(entry);

                if (nodeScoped && !terminal) {
                    String line = entry.getMessage();
                    if (entry.getData() != null) {
                        line = line + " | data=" + normalizeData(entry.getData());
                    }
                    processMap.computeIfAbsent(key, k -> new ArrayList<>()).add(line);
                    continue;
                }

                FlowExecutionLog logRecord = new FlowExecutionLog();
                logRecord.setFlowConfigId(flowConfigId);
                logRecord.setFlowName(context.getFlowName());
                logRecord.setEventId(context.getEventId());
                logRecord.setNodeName(nodeName);
                logRecord.setActionType(actionType);
                logRecord.setLevel(entry.getLevel());
                logRecord.setMessage(entry.getMessage());

                if (nodeScoped && terminal) {
                    Map<String, Object> payload = new LinkedHashMap<>();
                    List<String> processLines = processMap.getOrDefault(key, List.of());
                    if (!processLines.isEmpty()) {
                        payload.put("processLines", processLines);
                    }
                    if (entry.getData() != null) {
                        payload.put("resultData", entry.getData());
                    }
                    if (entry.getDurationMs() != null) {
                        payload.put("durationMs", entry.getDurationMs());
                    }
                    String dataJson = writeJson(payload);
                    if (dataJson != null) {
                        logRecord.setDataJson(dataJson);
                    }
                    processMap.remove(key);
                } else if (entry.getData() != null) {
                    String dataJson = writeJson(entry.getData());
                    if (dataJson == null) {
                        dataJson = String.valueOf(entry.getData());
                    }
                    logRecord.setDataJson(dataJson);
                }
                // 中文注释：若日志时间解析失败，兜底使用当前时间，保证日志可落库。
                logRecord.setCreatedAt(parseEntryTimeOrNow(entry.getTimestamp()));
                records.add(logRecord);
            }
            for (FlowExecutionLog logRecord : records) {
                flowExecutionLogMapper.insert(logRecord);
            }
        } catch (Exception e) {
            log.error("Failed to save execution logs to DB: {}", e.getMessage(), e);
        }
    }

    /**
     * 中文注释：落库聚合键统一大写 actionType + trim 节点名，保证「节点执行参数 / Handler 过程日志 / 节点执行成功」落在同一桶。
     */
    private String buildLogAggregateKey(String actionType, String nodeName) {
        String at = (actionType == null || "-".equals(actionType)) ? "-" : actionType.trim().toUpperCase(Locale.ROOT);
        String nn = (nodeName == null || "-".equals(nodeName)) ? "-" : nodeName.trim();
        return at + "|" + nn;
    }

    private boolean isNodeScoped(String actionType, String nodeName) {
        if (actionType == null || nodeName == null) {
            return false;
        }
        if ("SYSTEM".equalsIgnoreCase(actionType) || "-".equals(actionType)) {
            return false;
        }
        return !("System".equalsIgnoreCase(nodeName) || "Engine".equalsIgnoreCase(nodeName) || "-".equals(nodeName));
    }

    private boolean isTerminalNodeRecord(ExecutionLogEntry entry) {
        String msg = safe(entry.getMessage());
        return msg.contains("【节点执行成功】")
                || msg.contains("【节点执行失败】")
                || msg.contains("【节点执行异常】")
                || msg.contains("【节点执行警告】");
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    private String normalizeData(Object data) {
        String json = writeJson(data);
        return json != null ? json : String.valueOf(data);
    }

    private String safe(String text) {
        return text == null ? "-" : text;
    }

    private Map<String, Object> buildNodeStartDetail(FlowNode node, FlowExecutionContext context) {
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("nodeId", node.getId());
        detail.put("nodeType", node.getType());
        detail.put("nodeName", node.getName());
        detail.put("eventId", context.getEventId());
        detail.put("config", node.getConfig());
        return detail;
    }

    private Map<String, Object> buildNodeSuccessDetail(NodeResult result) {
        Map<String, Object> detail = new LinkedHashMap<>();
        if (result == null) {
            detail.put("result", "null");
            return detail;
        }
        detail.put("nextNodeIds", result.getNextNodeIds());
        detail.put("resultData", result.getResultData());
        return detail;
    }

    private LocalDateTime parseEntryTimeOrNow(String timestamp) {
        if (timestamp == null || timestamp.isBlank()) {
            return LocalDateTime.now();
        }
        try {
            LocalDateTime parsed = LocalDateTime.parse(
                    "2000-01-01T" + timestamp,
                    DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS")
            );
            return LocalDateTime.now()
                    .withHour(parsed.getHour())
                    .withMinute(parsed.getMinute())
                    .withSecond(parsed.getSecond())
                    .withNano(parsed.getNano());
        } catch (Exception ignored) {
            return LocalDateTime.now();
        }
    }

    private String abbreviateLogData(String data) {
        if (data == null) return "null";
        if (data.length() > 500) {
            return data.substring(0, 500) + "... (truncated)";
        }
        return data;
    }
}
