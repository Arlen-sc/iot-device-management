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
        FlowNode startNode = flow.findStartNode();
        if (startNode == null) {
            context.addLog("ERROR: No START node found in flow definition");
            log.error("No START node found in flow definition");
            return;
        }

        log.info("Starting flow execution from node: {}", startNode.getName());
        context.addLog("Flow execution started");

        executeNode(startNode, flow, context);

        context.addLog("Flow execution finished, completed: " + context.isCompleted());
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
        context.addLog("Executing node: " + node.getName() + " (" + nodeType + ")");

        NodeResult result;
        try {
            result = handler.execute(node, context);
        } catch (Exception e) {
            log.error("Unexpected error executing node: {}", node.getName(), e);
            context.addLog("ERROR at node " + node.getName() + ": " + e.getMessage());
            return;
        }

        if (result == null) {
            context.addLog("Node " + node.getName() + " returned null result");
            return;
        }

        if (!result.isSuccess()) {
            log.warn("Node {} failed: {}", node.getName(), result.getErrorMessage());
            context.addLog("Node " + node.getName() + " failed: " + result.getErrorMessage());
            saveErrorToDb(node, context, result.getErrorMessage());
            return;
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
            executeNode(nextNode, flow, context);
        } else {
            // Parallel execution for multiple next nodes
            log.info("Parallel execution of {} branches from node: {}", nextNodeIds.size(), node.getName());
            context.addLog("Branching into " + nextNodeIds.size() + " parallel paths");

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

    private void saveErrorToDb(FlowNode node, FlowExecutionContext context, String errorMessage) {
        if (flowExecutionLogMapper == null || context.getFlowConfigId() == null) {
            return;
        }
        CompletableFuture.runAsync(() -> {
            try {
                FlowExecutionLog logRecord = new FlowExecutionLog();
                logRecord.setFlowConfigId(Long.valueOf(context.getFlowConfigId()));
                logRecord.setFlowName(context.getFlowName());
                logRecord.setNodeId(node.getId());
                logRecord.setNodeName(node.getName());
                logRecord.setLevel("ERROR");
                logRecord.setMessage(errorMessage);
                logRecord.setCreatedAt(LocalDateTime.now());
                flowExecutionLogMapper.insert(logRecord);
            } catch (Exception e) {
                log.error("Failed to save error log to DB: {}", e.getMessage());
            }
        });
    }
}
