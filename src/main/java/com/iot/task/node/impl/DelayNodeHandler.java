package com.iot.task.node.impl;

import com.iot.task.engine.FlowExecutionContext;
import com.iot.task.model.FlowNode;
import com.iot.task.node.NodeHandler;
import com.iot.task.node.NodeResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;

@Slf4j
@Component
public class DelayNodeHandler implements NodeHandler {

    @Override
    public String getType() {
        return "DELAY";
    }

    @Override
    public NodeResult execute(FlowNode node, FlowExecutionContext context) {
        try {
            Map<String, Object> config = node.getConfig();
            long delayMs = 1000L;

            if (config != null && config.containsKey("delayMs")) {
                delayMs = ((Number) config.get("delayMs")).longValue();
            }

            log.info("Executing DELAY node: {}, delaying for {} ms", node.getName(), delayMs);
            context.addLog("Delaying for " + delayMs + " ms");

            Thread.sleep(delayMs);

            return NodeResult.ok();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("DELAY node interrupted: {}", node.getName(), e);
            return NodeResult.error("Delay interrupted: " + e.getMessage());
        } catch (Exception e) {
            log.error("Error in DELAY node: {}", node.getName(), e);
            return NodeResult.error("DELAY node failed: " + e.getMessage());
        }
    }
}
