package com.iot.task.node.impl;

import com.iot.task.engine.FlowExecutionContext;
import com.iot.task.model.FlowNode;
import com.iot.task.node.NodeHandler;
import com.iot.task.node.NodeResult;
import com.iot.util.VariablePathUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * DATA_TRANSFORM node - applies a series of transformation steps to a source value.
 *
 * This handler now delegates to {@link ScriptNodeHandler} for all transformation operations.
 * It converts the DATA_TRANSFORM config format (sourcePath, targetPath, steps with type/params)
 * into the SCRIPT operations format (operations with op/source/target/params).
 *
 * All DATA_TRANSFORM step types are supported in SCRIPT:
 *   HEX_TO_DEC, DEC_TO_HEX, SUBSTRING, REPLACE, ROUND, TO_NUMBER, TO_STRING,
 *   SPLIT, JOIN, HEX_ARRAY_TO_DEC, DEC_ARRAY_TO_HEX, ARRAY_LENGTH, STRIP_PREFIX,
 *   JSON_STRINGIFY, JSON_PARSE
 *
 * Config fields (unchanged for backward compatibility):
 *   sourcePath  - variable path to read source value from
 *   targetPath  - variable path to store result (defaults to sourcePath)
 *   steps       - array of { type, params } transformation steps applied sequentially
 */
@Slf4j
@Component
public class DataTransformNodeHandler implements NodeHandler {

    private final ScriptNodeHandler scriptNodeHandler;

    public DataTransformNodeHandler(ScriptNodeHandler scriptNodeHandler) {
        this.scriptNodeHandler = scriptNodeHandler;
    }

    @Override
    public String getType() {
        return "DATA_TRANSFORM";
    }

    @Override
    @SuppressWarnings("unchecked")
    public NodeResult execute(FlowNode node, FlowExecutionContext context) {
        try {
            Map<String, Object> config = node.getConfig();
            if (config == null) {
                return NodeResult.error("DATA_TRANSFORM node has no config");
            }

            String sourcePath = (String) config.get("sourcePath");
            String targetPath = (String) config.get("targetPath");
            List<Map<String, Object>> steps = (List<Map<String, Object>>) config.get("steps");

            log.info("DATA_TRANSFORM node '{}' delegating to SCRIPT logic with {} steps",
                    node.getName(), steps != null ? steps.size() : 0);

            // Read the source value
            Object value = VariablePathUtils.getValue(context.getVariables(), sourcePath);

            // Execute each step through ScriptNodeHandler's operation executor
            if (steps != null) {
                for (Map<String, Object> step : steps) {
                    String type = (String) step.get("type");
                    Map<String, Object> params = (Map<String, Object>) step.get("params");
                    if (params == null) {
                        params = Map.of();
                    }
                    value = scriptNodeHandler.executeOperation(type, value, params, context);
                }
            }

            // Store result
            String target = targetPath != null ? targetPath : sourcePath;
            VariablePathUtils.setValue(context.getVariables(), target, value);
            context.addLog("Data transformed and stored at: " + target);

            return NodeResult.ok(value);
        } catch (Exception e) {
            log.error("Error in DATA_TRANSFORM node: {}", node.getName(), e);
            return NodeResult.error("DATA_TRANSFORM node failed: " + e.getMessage());
        }
    }
}
