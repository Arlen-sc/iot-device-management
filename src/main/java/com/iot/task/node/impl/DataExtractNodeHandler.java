package com.iot.task.node.impl;

import com.iot.task.engine.FlowExecutionContext;
import com.iot.task.model.FlowNode;
import com.iot.task.node.NodeHandler;
import com.iot.task.node.NodeResult;
import com.iot.util.VariablePathUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;

@Slf4j
@Component
public class DataExtractNodeHandler implements NodeHandler {

    @Override
    public String getType() {
        return "DATA_EXTRACT";
    }

    @Override
    public NodeResult execute(FlowNode node, FlowExecutionContext context) {
        try {
            Map<String, Object> config = node.getConfig();
            if (config == null) {
                return NodeResult.error("DATA_EXTRACT node has no config");
            }

            String sourcePath = (String) config.get("sourcePath");
            String targetPath = (String) config.get("targetPath");

            log.info("Executing DATA_EXTRACT node: {}, source: {} -> target: {}",
                    node.getName(), sourcePath, targetPath);

            Object value = VariablePathUtils.getValue(context.getVariables(), sourcePath);

            if (value == null) {
                log.warn("DATA_EXTRACT: no value found at source path: {}", sourcePath);
                context.addLog("Data extract: no value at " + sourcePath);
            } else {
                VariablePathUtils.setValue(context.getVariables(), targetPath, value);
                context.addLog("Data extracted: " + sourcePath + " -> " + targetPath);
            }

            return NodeResult.ok(value);
        } catch (Exception e) {
            log.error("Error in DATA_EXTRACT node: {}", node.getName(), e);
            return NodeResult.error("DATA_EXTRACT node failed: " + e.getMessage());
        }
    }
}
