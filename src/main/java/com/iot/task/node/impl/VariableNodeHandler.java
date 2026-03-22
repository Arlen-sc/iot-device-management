package com.iot.task.node.impl;

import com.iot.task.engine.FlowExecutionContext;
import com.iot.task.model.FlowNode;
import com.iot.task.node.NodeHandler;
import com.iot.task.node.NodeResult;
import com.iot.util.VariablePathUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class VariableNodeHandler implements NodeHandler {

    @Override
    public String getType() {
        return "VARIABLE";
    }

    @Override
    @SuppressWarnings("unchecked")
    public NodeResult execute(FlowNode node, FlowExecutionContext context) {
        try {
            Map<String, Object> config = node.getConfig();
            if (config == null) {
                return NodeResult.ok();
            }

            List<Map<String, Object>> operations = (List<Map<String, Object>>) config.get("operations");
            if (operations == null) {
                return NodeResult.ok();
            }

            log.info("Executing VARIABLE node: {} with {} operations", node.getName(), operations.size());

            for (Map<String, Object> operation : operations) {
                String action = (String) operation.get("action");
                String path = (String) operation.get("path");

                switch (action) {
                    case "set":
                        Object value = operation.get("value");
                        VariablePathUtils.setValue(context.getVariables(), path, value);
                        context.addLog("Variable set: " + path + " = " + value);
                        break;

                    case "copy":
                        String sourcePath = (String) operation.get("sourcePath");
                        Object sourceValue = VariablePathUtils.getValue(context.getVariables(), sourcePath);
                        VariablePathUtils.setValue(context.getVariables(), path, sourceValue);
                        context.addLog("Variable copied: " + sourcePath + " -> " + path);
                        break;

                    case "delete":
                        VariablePathUtils.setValue(context.getVariables(), path, null);
                        context.addLog("Variable deleted: " + path);
                        break;

                    default:
                        log.warn("Unknown variable action: {}", action);
                }
            }

            return NodeResult.ok();
        } catch (Exception e) {
            log.error("Error in VARIABLE node: {}", node.getName(), e);
            return NodeResult.error("VARIABLE node failed: " + e.getMessage());
        }
    }
}
