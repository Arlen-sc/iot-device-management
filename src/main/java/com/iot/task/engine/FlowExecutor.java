package com.iot.task.engine;

import com.iot.entity.FlowExecutionLog;
import com.iot.mapper.FlowExecutionLogMapper;
import com.iot.task.model.FlowDefinition;
import com.iot.task.model.FlowNode;
import com.iot.task.node.NodeHandler;
import com.iot.task.node.NodeHandlerRegistry;
import com.iot.task.node.NodeResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;

@Slf4j
@Component
public class FlowExecutor {

    private static final int MAX_FLOW_STEPS = 100_000;

    private final NodeHandlerRegistry nodeHandlerRegistry;
    private final FlowExecutionLogMapper flowExecutionLogMapper;

    public FlowExecutor(NodeHandlerRegistry nodeHandlerRegistry, FlowExecutionLogMapper flowExecutionLogMapper) {
        this.nodeHandlerRegistry = nodeHandlerRegistry;
        this.flowExecutionLogMapper = flowExecutionLogMapper;
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
        context.addLog("SYSTEM", "================ 流程执行开始 ================", "START", startNode.getName(), null, null);
        context.addLog("SYSTEM", "流程ID: " + context.getFlowConfigId() + ", 流程名称: " + context.getFlowName(), null, null, null, null);
        context.addLog("SYSTEM", "事件ID: " + eventId, null, null, null, null);
        context.addLog("SYSTEM", "【初始上下文数据】", null, null, abbreviateLogData(context.getVariables().toString()), null);

        executeNode(startNode, flow, context);

        context.addLog("SYSTEM", "================ 流程执行结束 ================", "END", null, null, null);
        context.addLog("SYSTEM", "最终状态: " + (context.isCompleted() ? "成功(Completed)" : "未完成(Incomplete)"), null, null, null, null);
        context.addLog("SYSTEM", "【最终上下文数据】", null, null, abbreviateLogData(context.getVariables().toString()), null);
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
        context.addLog("INFO", "【节点执行开始】", nodeType, node.getName(), null, null);
        context.addLog("INFO", "【节点输入数据】", nodeType, node.getName(), abbreviateLogData(context.getVariables().toString()), null);

        NodeResult result;
        long startTime = System.currentTimeMillis();
        try {
            result = handler.execute(node, context);
            long duration = System.currentTimeMillis() - startTime;
            context.addLog("SUCCESS", "【节点执行成功】", nodeType, node.getName(), null, duration);
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            log.error("Unexpected error executing node: {}", node.getName(), e);
            context.addLog("ERROR", "【节点执行异常】" + e.getMessage(), nodeType, node.getName(), null, duration);
            return;
        }

        if (result == null) {
            context.addLog("WARN", "【节点执行警告】返回了空结果", nodeType, node.getName(), null, null);
            // 对于定时任务，如果节点返回空结果，跳过并完成任务
            context.setCompleted(true);
            return;
        }

        if (!result.isSuccess()) {
            log.warn("Node {} failed: {}", node.getName(), result.getErrorMessage());
            context.addLog("ERROR", "【节点执行失败】" + result.getErrorMessage(), nodeType, node.getName(), null, null);
            saveErrorToDb(node, nodeType, context, result.getErrorMessage());
            // 对于定时任务，如果节点执行失败，跳过并完成任务
            context.setCompleted(true);
            return;
        } else {
             if (result.getResultData() != null) {
                 context.setVariable("node_" + node.getId() + "_result", result.getResultData());
                 context.addLog("INFO", "【节点执行结果数据】", nodeType, node.getName(), abbreviateLogData(result.getResultData().toString()), null);
             } else if (result.getNextNodeIds() == null || result.getNextNodeIds().isEmpty()) {
                 // 允许无返回数据，但如果明确是取数据节点（如 DB_OPERATION, DEVICE_DATA）没有数据，这里可以由 handler 直接返回 error 或特定的 skip
                 context.addLog("INFO", "【节点执行无结果数据】", nodeType, node.getName(), null, null);
             }
             context.addLog("INFO", "【节点输出后上下文】", nodeType, node.getName(), abbreviateLogData(context.getVariables().toString()), null);
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
            context.addLog("WARN", "没有后续节点可以执行: " + node.getName(), nodeType, node.getName(), null, null);
            return;
        }

        if (nextNodeIds.size() == 1) {
            // Serial execution for single next node
            FlowNode nextNode = flow.findNodeById(nextNodeIds.get(0));
            context.addLog("SYSTEM", String.format("【流程流转】节点 %s -> 节点 %s", node.getName(), nextNode != null ? nextNode.getName() : "null"), nodeType, node.getName(), null, null);
            executeNode(nextNode, flow, context);
        } else {
            // Parallel execution for multiple next nodes
            log.info("Parallel execution of {} branches from node: {}", nextNodeIds.size(), node.getName());
            context.addLog("SYSTEM", String.format("【流程流转】节点 %s 分支执行, 目标节点数: %d", node.getName(), nextNodeIds.size()), nodeType, node.getName(), null, null);

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

    private void saveErrorToDb(FlowNode node, String nodeType, FlowExecutionContext context, String errorMessage) {
        if (flowExecutionLogMapper == null || context.getFlowConfigId() == null) {
            return;
        }
        CompletableFuture.runAsync(() -> {
            try {
                FlowExecutionLog logRecord = new FlowExecutionLog();
                logRecord.setFlowConfigId(Long.valueOf(context.getFlowConfigId()));
                logRecord.setFlowName(context.getFlowName());
                // logRecord.setEventId(context.getEventId());
                logRecord.setNodeId(node.getId());
                logRecord.setNodeName(node.getName());
                logRecord.setActionType(nodeType);
                logRecord.setLevel("ERROR");
                logRecord.setMessage(errorMessage);
                logRecord.setCreatedAt(LocalDateTime.now());
                flowExecutionLogMapper.insert(logRecord);
            } catch (Exception e) {
                log.error("Failed to save error log to DB: {}", e.getMessage());
            }
        });
    }

    private String abbreviateLogData(String data) {
        if (data == null) return "null";
        if (data.length() > 500) {
            return data.substring(0, 500) + "... (truncated)";
        }
        return data;
    }
}
