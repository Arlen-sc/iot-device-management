package com.iot.task.node.impl;

import com.iot.task.engine.FlowExecutionContext;
import com.iot.task.model.FlowNode;
import com.iot.task.node.NodeHandler;
import com.iot.task.node.NodeResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class EndNodeHandler implements NodeHandler {

    @Override
    public String getType() {
        return "END";
    }

    @Override
    public NodeResult execute(FlowNode node, FlowExecutionContext context) {
        try {
            log.info("Executing END node: {}", node.getName());
            context.setCompleted(true);
            context.addLog("Flow completed at node: " + node.getName());
            return NodeResult.ok(context.getVariables());
        } catch (Exception e) {
            log.error("Error in END node: {}", node.getName(), e);
            return NodeResult.error("END node failed: " + e.getMessage());
        }
    }
}
