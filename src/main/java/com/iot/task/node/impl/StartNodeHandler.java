package com.iot.task.node.impl;

import com.iot.task.engine.FlowExecutionContext;
import com.iot.task.model.FlowNode;
import com.iot.task.node.NodeHandler;
import com.iot.task.node.NodeResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Map;

@Slf4j
@Component
public class StartNodeHandler implements NodeHandler {

    @Override
    public String getType() {
        return "START";
    }

    @Override
    public NodeResult execute(FlowNode node, FlowExecutionContext context) {
        try {
            log.info("Executing START node: {}", node.getName());
            context.addLog("Flow started at node: " + node.getName());

            Map<String, Object> config = node.getConfig();
            if (config != null) {
                if (config.containsKey("deviceId")) {
                    context.setVariable("deviceId", config.get("deviceId"));
                }
                if (config.containsKey("protocolType")) {
                    context.setVariable("protocolType", config.get("protocolType"));
                }
                if (config.containsKey("triggerType")) {
                    context.setVariable("triggerType", config.get("triggerType"));
                }
            }

            context.setVariable("currentTime", LocalDateTime.now().toString());
            return NodeResult.ok();
        } catch (Exception e) {
            log.error("Error in START node: {}", node.getName(), e);
            return NodeResult.error("START node failed: " + e.getMessage());
        }
    }
}
