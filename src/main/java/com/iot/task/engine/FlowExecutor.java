package com.iot.task.engine;

import com.iot.task.model.FlowDefinition;
import com.iot.task.model.FlowNode;
import com.iot.task.node.NodeHandler;
import com.iot.task.node.NodeHandlerRegistry;
import com.iot.task.node.NodeResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;

@Slf4j
@Component
public class FlowExecutor {

    private final NodeHandlerRegistry nodeHandlerRegistry;

    public FlowExecutor(NodeHandlerRegistry nodeHandlerRegistry) {
        this.nodeHandlerRegistry = nodeHandlerRegistry;
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

        Set<String> visited = new HashSet<>();
        executeNode(startNode, flow, context, visited);

        context.addLog("Flow execution finished, completed: " + context.isCompleted());
        log.info("Flow execution finished, completed: {}", context.isCompleted());
    }

    private void executeNode(FlowNode node, FlowDefinition flow, FlowExecutionContext context, Set<String> visited) {
        if (node == null || context.isCompleted()) {
            return;
        }

        if (visited.contains(node.getId())) {
            log.warn("Cycle detected at node: {}, skipping", node.getId());
            context.addLog("Cycle detected at node: " + node.getName() + ", skipping");
            return;
        }
        visited.add(node.getId());

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
            executeNode(nextNode, flow, context, visited);
        } else {
            // Parallel execution for multiple next nodes
            log.info("Parallel execution of {} branches from node: {}", nextNodeIds.size(), node.getName());
            context.addLog("Branching into " + nextNodeIds.size() + " parallel paths");

            CompletableFuture<?>[] futures = nextNodeIds.stream()
                    .map(nodeId -> {
                        FlowNode nextNode = flow.findNodeById(nodeId);
                        return CompletableFuture.runAsync(() -> {
                            Set<String> branchVisited = new HashSet<>(visited);
                            executeNode(nextNode, flow, context, branchVisited);
                        });
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
}
