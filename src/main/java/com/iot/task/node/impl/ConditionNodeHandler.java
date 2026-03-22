package com.iot.task.node.impl;

import com.iot.task.engine.FlowExecutionContext;
import com.iot.task.model.FlowNode;
import com.iot.task.node.NodeHandler;
import com.iot.task.node.NodeResult;
import com.iot.util.VariablePathUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class ConditionNodeHandler implements NodeHandler {

    @Override
    public String getType() {
        return "CONDITION";
    }

    @Override
    @SuppressWarnings("unchecked")
    public NodeResult execute(FlowNode node, FlowExecutionContext context) {
        try {
            Map<String, Object> config = node.getConfig();
            if (config == null) {
                return NodeResult.error("CONDITION node has no config");
            }

            List<Map<String, Object>> branches = (List<Map<String, Object>>) config.get("branches");
            String defaultNextNodeId = (String) config.get("defaultNextNodeId");

            log.info("Executing CONDITION node: {} with {} branches", node.getName(),
                    branches != null ? branches.size() : 0);

            if (branches != null) {
                for (Map<String, Object> branch : branches) {
                    String branchName = (String) branch.get("name");
                    Map<String, Object> condition = (Map<String, Object>) branch.get("condition");
                    String nextNodeId = (String) branch.get("nextNodeId");

                    if (condition != null && evaluateBranchCondition(condition, context)) {
                        log.info("CONDITION branch matched: {}", branchName);
                        context.addLog("Condition matched branch: " + branchName);
                        return NodeResult.branch(Collections.singletonList(nextNodeId));
                    }
                }
            }

            if (defaultNextNodeId != null) {
                log.info("CONDITION using default branch");
                context.addLog("Condition using default branch");
                return NodeResult.branch(Collections.singletonList(defaultNextNodeId));
            }

            context.addLog("No condition matched and no default branch");
            return NodeResult.ok();
        } catch (Exception e) {
            log.error("Error in CONDITION node: {}", node.getName(), e);
            return NodeResult.error("CONDITION node failed: " + e.getMessage());
        }
    }

    private boolean evaluateBranchCondition(Map<String, Object> condition, FlowExecutionContext context) {
        String leftPath = (String) condition.get("left");
        String operator = (String) condition.get("operator");
        Object rightValue = condition.get("right");

        Object leftValue = VariablePathUtils.getValue(context.getVariables(), leftPath);

        if (rightValue instanceof String rightStr && rightStr.startsWith("${") && rightStr.endsWith("}")) {
            String rightPath = rightStr.substring(2, rightStr.length() - 1);
            rightValue = VariablePathUtils.getValue(context.getVariables(), rightPath);
        }

        return compare(leftValue, operator, rightValue, condition);
    }

    private boolean compare(Object left, String operator, Object right, Map<String, Object> condition) {
        if (operator == null) {
            return false;
        }

        switch (operator) {
            case "==":
                if (left != null && right != null) {
                    try { return toDouble(left) == toDouble(right); } catch (Exception ignored) {}
                }
                return left != null ? left.toString().equals(right != null ? right.toString() : null) : right == null;
            case "!=":
                if (left != null && right != null) {
                    try { return toDouble(left) != toDouble(right); } catch (Exception ignored) {}
                }
                return left != null ? !left.toString().equals(right != null ? right.toString() : null) : right != null;
            case "contains":
                return left != null && left.toString().contains(right != null ? right.toString() : "");
            case "equals_trim":
                if (left == null || right == null) {
                    return false;
                }
                return left.toString().trim().equals(right.toString().trim());
            case "substring_equals":
                return substringEquals(left, right, condition);
            case "starts_with":
                return left != null && left.toString().startsWith(right != null ? right.toString() : "");
            case "ends_with":
                return left != null && left.toString().endsWith(right != null ? right.toString() : "");
            case "array_length_gte":
                if (left instanceof java.util.List<?> list) {
                    try { return list.size() >= toDouble(right); } catch (Exception e) { return false; }
                }
                return false;
            case "array_length_gt":
                if (left instanceof java.util.List<?> list) {
                    try { return list.size() > toDouble(right); } catch (Exception e) { return false; }
                }
                return false;
            case "not_null":
                return left != null;
            case "is_null":
                return left == null;
            case ">":
            case "<":
            case ">=":
            case "<=":
                return compareNumeric(left, operator, right);
            default:
                log.warn("Unknown operator: {}", operator);
                return false;
        }
    }

    private boolean compareNumeric(Object left, String operator, Object right) {
        try {
            double leftNum = toDouble(left);
            double rightNum = toDouble(right);

            return switch (operator) {
                case ">" -> leftNum > rightNum;
                case "<" -> leftNum < rightNum;
                case ">=" -> leftNum >= rightNum;
                case "<=" -> leftNum <= rightNum;
                default -> false;
            };
        } catch (Exception e) {
            log.warn("Cannot compare non-numeric values: {} {} {}", left, operator, right);
            return false;
        }
    }

    private double toDouble(Object value) {
        if (value instanceof Number num) {
            return num.doubleValue();
        }
        return Double.parseDouble(String.valueOf(value));
    }

    /**
     * Compare {@code left.substring(substringStart, substringEnd)} to {@code right} (both as strings).
     * Bounds default to the full string; indices are clamped to {@code left}'s length.
     */
    private boolean substringEquals(Object left, Object right, Map<String, Object> condition) {
        if (left == null || right == null) {
            return false;
        }
        String ls = left.toString();
        int start = 0;
        int end = ls.length();
        if (condition != null) {
            if (condition.get("substringStart") instanceof Number n) {
                start = n.intValue();
            }
            if (condition.get("substringEnd") instanceof Number n) {
                end = n.intValue();
            }
        }
        if (start < 0) {
            start = 0;
        }
        if (end > ls.length()) {
            end = ls.length();
        }
        if (start > end) {
            return false;
        }
        return ls.substring(start, end).equals(right.toString());
    }
}
