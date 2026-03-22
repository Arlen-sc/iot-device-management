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
        context.addLog("================ 流程执行开始 ================");
        context.addLog("流程ID: " + context.getFlowConfigId() + ", 流程名称: " + context.getFlowName());
        context.addLog("事件ID: " + eventId);
        context.addLog("【初始上下文数据】" + abbreviateLogData(context.getVariables().toString()));

        executeNode(startNode, flow, context);

        context.addLog("================ 流程执行结束 ================");
        context.addLog("最终状态: " + (context.isCompleted() ? "成功(Completed)" : "未完成(Incomplete)"));
        context.addLog("【最终上下文数据】" + abbreviateLogData(context.getVariables().toString()));
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
        context.addLog(String.format("【节点执行开始】节点: %s (%s)", node.getName(), nodeType), nodeType, node.getName());
        context.addLog("【节点输入数据】" + abbreviateLogData(context.getVariables().toString()), nodeType, node.getName());

        NodeResult result;
        try {
            result = handler.execute(node, context);
            context.addLog(String.format("【节点执行成功】节点: %s", node.getName()), nodeType, node.getName());
        } catch (Exception e) {
            log.error("Unexpected error executing node: {}", node.getName(), e);
            context.addLog(String.format("【节点执行异常】节点: %s, 错误: %s", node.getName(), e.getMessage()), nodeType, node.getName());
            return;
        }

        if (result == null) {
            context.addLog(String.format("【节点执行警告】节点 %s 返回了空结果", node.getName()), nodeType, node.getName());
            return;
        }

        if (!result.isSuccess()) {
            log.warn("Node {} failed: {}", node.getName(), result.getErrorMessage());
            context.addLog(String.format("【节点执行失败】节点: %s, 错误信息: %s", node.getName(), result.getErrorMessage()), nodeType, node.getName());
            saveErrorToDb(node, nodeType, context, result.getErrorMessage());
            return;
        } else {
             if (result.getResultData() != null) {
                 context.setVariable("node_" + node.getId() + "_result", result.getResultData());
                 context.addLog("【节点执行结果数据】" + abbreviateLogData(result.getResultData().toString()), nodeType, node.getName());
             }
             context.addLog("【节点输出后上下文】" + abbreviateLogData(context.getVariables().toString()), nodeType, node.getName());
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
            context.addLog("No more nodes to execute after: " + node.getName());
            return;
        }

        if (nextNodeIds.size() == 1) {
            // Serial execution for single next node
            FlowNode nextNode = flow.findNodeById(nextNodeIds.get(0));
            context.addLog(String.format("【流程流转】节点 %s -> 节点 %s", node.getName(), nextNode != null ? nextNode.getName() : "null"));
            executeNode(nextNode, flow, context);
        } else {
            // Parallel execution for multiple next nodes
            log.info("Parallel execution of {} branches from node: {}", nextNodeIds.size(), node.getName());
            context.addLog(String.format("【流程流转】节点 %s 分支执行, 目标节点数: %d", node.getName(), nextNodeIds.size()));

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
                context.addLog("Error in parallel execution: " + e.getMessage());
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
                logRecord.setEventId(context.getEventId());
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
