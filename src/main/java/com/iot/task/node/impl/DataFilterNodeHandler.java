package com.iot.task.node.impl;

import com.iot.task.engine.FlowExecutionContext;
import com.iot.task.model.FlowNode;
import com.iot.task.node.NodeHandler;
import com.iot.task.node.NodeResult;
import com.iot.util.VariablePathUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class DataFilterNodeHandler implements NodeHandler {

    @Override
    public String getType() {
        return "DATA_FILTER";
    }

    @Override
    @SuppressWarnings("unchecked")
    public NodeResult execute(FlowNode node, FlowExecutionContext context) {
        try {
            Map<String, Object> config = node.getConfig();
            if (config == null) {
                return NodeResult.error("DATA_FILTER node has no config");
            }

            String sourcePath = (String) config.get("sourcePath");
            String targetPath = (String) config.get("targetPath");
            List<Map<String, Object>> conditions = (List<Map<String, Object>>) config.get("conditions");

            log.info("Executing DATA_FILTER node: {} with {} conditions",
                    node.getName(), conditions != null ? conditions.size() : 0);

            Object sourceData = VariablePathUtils.getValue(context.getVariables(), sourcePath);

            if (sourceData instanceof List) {
                List<Object> sourceList = (List<Object>) sourceData;
                List<Object> filtered = new ArrayList<>();

                for (Object item : sourceList) {
                    if (matchesConditions(item, conditions)) {
                        filtered.add(item);
                    }
                }

                String target = targetPath != null ? targetPath : sourcePath;
                VariablePathUtils.setValue(context.getVariables(), target, filtered);
                context.addLog("Data filtered: " + sourceList.size() + " -> " + filtered.size() + " items");
                return NodeResult.ok(filtered);
            } else {
                boolean matches = matchesConditions(sourceData, conditions);
                if (matches) {
                    if (targetPath != null) {
                        VariablePathUtils.setValue(context.getVariables(), targetPath, sourceData);
                    }
                    context.addLog("Data filter: single object passed");
                    return NodeResult.ok(sourceData);
                } else {
                    if (targetPath != null) {
                        VariablePathUtils.setValue(context.getVariables(), targetPath, null);
                    }
                    context.addLog("Data filter: single object blocked");
                    return NodeResult.ok(null);
                }
            }
        } catch (Exception e) {
            log.error("Error in DATA_FILTER node: {}", node.getName(), e);
            return NodeResult.error("DATA_FILTER node failed: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private boolean matchesConditions(Object item, List<Map<String, Object>> conditions) {
        if (conditions == null || conditions.isEmpty()) {
            return true;
        }

        for (Map<String, Object> condition : conditions) {
            String field = (String) condition.get("field");
            String operator = (String) condition.get("operator");
            Object expected = condition.get("value");

            Object actual = null;
            if (item instanceof Map) {
                Map<String, Object> mapItem = (Map<String, Object>) item;
                actual = VariablePathUtils.getValue(mapItem, field);
            }

            if (!compare(actual, operator, expected)) {
                return false;
            }
        }
        return true;
    }

    private boolean compare(Object actual, String operator, Object expected) {
        if (operator == null) {
            return true;
        }

        switch (operator) {
            case "==":
                return actual != null ? actual.equals(expected) : expected == null;
            case "!=":
                return actual != null ? !actual.equals(expected) : expected != null;
            case ">":
                return toDouble(actual) > toDouble(expected);
            case "<":
                return toDouble(actual) < toDouble(expected);
            case ">=":
                return toDouble(actual) >= toDouble(expected);
            case "<=":
                return toDouble(actual) <= toDouble(expected);
            case "contains":
                return actual != null && actual.toString().contains(expected != null ? expected.toString() : "");
            default:
                return true;
        }
    }

    private double toDouble(Object value) {
        if (value instanceof Number num) {
            return num.doubleValue();
        }
        try {
            return Double.parseDouble(String.valueOf(value));
        } catch (Exception e) {
            return 0.0;
        }
    }
}
