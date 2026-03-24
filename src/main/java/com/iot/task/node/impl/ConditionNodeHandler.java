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
            String logic = (String) config.getOrDefault("logic", "AND"); // AND or OR

            log.info("Executing CONDITION node: {} with {} branches, logic: {}", node.getName(),
                    branches != null ? branches.size() : 0, logic);

            if (branches != null && !branches.isEmpty()) {
                Map<String, Object> evalSummary = new java.util.LinkedHashMap<>();
                java.util.List<Map<String, Object>> branchDetails = new java.util.ArrayList<>();
                evalSummary.put("logic", logic);
                // Check if we are combining conditions into a single branch evaluation
                // In a proper OR/AND we need to evaluate all branches to see if the overall logic is met.
                // Wait, the previous logic was: each branch has a condition and a nextNodeId.
                // The prompt says: "而且分支条件你因该要支持and和or逻辑。"
                // If it's branch logic, AND means all branch conditions must be met to proceed?
                // Or does it mean a single branch can have multiple conditions?
                // The frontend config structure we just updated:
                // logic: 'AND'/'OR'
                // branches: [{name, condition: {left, op, right}, nextNodeId}, ...]
                // This means the logic applies to the branches array.
                // So if logic is AND, ALL branch conditions must be true to proceed. If so, which nextNodeId to take? The first one?
                // If logic is OR, ANY branch condition being true allows proceeding to its nextNodeId.
                // Actually, if logic is AND, we evaluate all conditions. If all true, we go to... what? The first branch's nextNodeId?
                
                if ("OR".equalsIgnoreCase(logic)) {
                    for (Map<String, Object> branch : branches) {
                        String branchName = (String) branch.get("name");
                        Map<String, Object> condition = (Map<String, Object>) branch.get("condition");
                        String nextNodeId = (String) branch.get("nextNodeId");

                        boolean matched = condition != null && evaluateBranchCondition(condition, context);
                        Map<String, Object> detail = buildConditionDetail(branchName, condition, matched, nextNodeId, context);
                        branchDetails.add(detail);
                        // 中文注释：输出可读条件表达式，便于在“过程”中直接看到 ${变量} > 1981723 这类判断。
                        context.addLog("INFO", buildConditionProcessLine(detail), "CONDITION", node.getName(), null, null);
                        if (matched) {
                            evalSummary.put("matched", true);
                            evalSummary.put("selectedBranch", branchName);
                            evalSummary.put("selectedNextNodeId", nextNodeId);
                            evalSummary.put("branches", branchDetails);
                            context.addLog("INFO", "CONDITION 条件评估结果", "CONDITION", node.getName(), evalSummary, null);
                            log.info("CONDITION branch matched (OR logic): {}", branchName);
                            return NodeResult.branch(Collections.singletonList(nextNodeId));
                        }
                    }
                    evalSummary.put("matched", false);
                    evalSummary.put("branches", branchDetails);
                } else { // AND logic
                    boolean allMatched = true;
                    String firstNextNodeId = null;
                    String firstBranchName = null;
                    
                    for (Map<String, Object> branch : branches) {
                        String branchName = (String) branch.get("name");
                        Map<String, Object> condition = (Map<String, Object>) branch.get("condition");
                        if (firstNextNodeId == null) {
                            firstNextNodeId = (String) branch.get("nextNodeId");
                            firstBranchName = branchName;
                        }

                        boolean matched = condition != null && evaluateBranchCondition(condition, context);
                        Map<String, Object> detail = buildConditionDetail(branchName, condition, matched, (String) branch.get("nextNodeId"), context);
                        branchDetails.add(detail);
                        // 中文注释：AND 模式下也逐条输出表达式，便于确认每个分支为何命中/未命中。
                        context.addLog("INFO", buildConditionProcessLine(detail), "CONDITION", node.getName(), null, null);

                        if (!matched) {
                            allMatched = false;
                        }
                    }
                    
                    if (allMatched && firstNextNodeId != null) {
                        evalSummary.put("matched", true);
                        evalSummary.put("selectedBranch", firstBranchName);
                        evalSummary.put("selectedNextNodeId", firstNextNodeId);
                        evalSummary.put("branches", branchDetails);
                        context.addLog("INFO", "CONDITION 条件评估结果", "CONDITION", node.getName(), evalSummary, null);
                        log.info("CONDITION all branches matched (AND logic)");
                        return NodeResult.branch(Collections.singletonList(firstNextNodeId));
                    }
                    evalSummary.put("matched", false);
                    evalSummary.put("branches", branchDetails);
                }
                context.addLog("INFO", "CONDITION 条件评估结果", "CONDITION", node.getName(), evalSummary, null);
            }

            if (defaultNextNodeId != null) {
                log.info("CONDITION using default branch");
                Map<String, Object> fallback = new java.util.LinkedHashMap<>();
                fallback.put("matched", false);
                fallback.put("defaultNextNodeId", defaultNextNodeId);
                context.addLog("INFO", "CONDITION 使用默认分支", "CONDITION", node.getName(), fallback, null);
                return NodeResult.branch(Collections.singletonList(defaultNextNodeId));
            }

            context.addLog("INFO", "CONDITION 无命中且无默认分支", "CONDITION", node.getName(), null, null);
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
            case "ends_with":
                return left != null && left.toString().endsWith(right != null ? right.toString() : "");
            case "equals_trim":
                if (left == null || right == null) {
                    return false;
                }
                return left.toString().trim().equals(right.toString().trim());
            case "substring_equals":
                return substringEquals(left, right, condition);
            case "starts_with":
                return left != null && left.toString().startsWith(right != null ? right.toString() : "");
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
            case "array_length_eq":
                if (left instanceof java.util.List<?> list) {
                    try { return list.size() == toDouble(right); } catch (Exception e) { return false; }
                }
                return false;
            case "array_length_lt":
                if (left instanceof java.util.List<?> list) {
                    try { return list.size() < toDouble(right); } catch (Exception e) { return false; }
                }
                return false;
            case "array_length_lte":
                if (left instanceof java.util.List<?> list) {
                    try { return list.size() <= toDouble(right); } catch (Exception e) { return false; }
                }
                return false;
            case "not_null":
                return left != null;
            case "is_null":
                return left == null;
            case "is_empty":
                return isEmptyValue(left);
            case "not_empty":
                return !isEmptyValue(left);
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

    private boolean isEmptyValue(Object value) {
        if (value == null) {
            return true;
        }
        if (value instanceof String s) {
            return s.trim().isEmpty();
        }
        if (value instanceof java.util.Collection<?> c) {
            return c.isEmpty();
        }
        if (value instanceof java.util.Map<?, ?> m) {
            return m.isEmpty();
        }
        if (value.getClass().isArray()) {
            return java.lang.reflect.Array.getLength(value) == 0;
        }
        return false;
    }

    private Map<String, Object> buildConditionDetail(String branchName,
                                                     Map<String, Object> condition,
                                                     boolean matched,
                                                     String nextNodeId,
                                                     FlowExecutionContext context) {
        Map<String, Object> detail = new java.util.LinkedHashMap<>();
        detail.put("branch", branchName);
        detail.put("nextNodeId", nextNodeId);
        detail.put("matched", matched);
        if (condition != null) {
            String leftPath = (String) condition.get("left");
            String operator = (String) condition.get("operator");
            Object rightValue = condition.get("right");
            Object rightResolved = rightValue;
            Object leftValue = VariablePathUtils.getValue(context.getVariables(), leftPath);
            if (rightValue instanceof String rightStr && rightStr.startsWith("${") && rightStr.endsWith("}")) {
                String rightPath = rightStr.substring(2, rightStr.length() - 1);
                rightResolved = VariablePathUtils.getValue(context.getVariables(), rightPath);
            }
            detail.put("leftPath", leftPath);
            detail.put("leftValue", leftValue);
            detail.put("operator", operator);
            detail.put("rightValue", rightValue);
            detail.put("rightValueResolved", rightResolved);
        }
        return detail;
    }

    private String buildConditionProcessLine(Map<String, Object> detail) {
        if (detail == null || !detail.containsKey("leftPath")) {
            return "条件判断: 条件配置为空";
        }
        String leftPath = String.valueOf(detail.getOrDefault("leftPath", "-"));
        String operator = String.valueOf(detail.getOrDefault("operator", "-"));
        Object leftValue = detail.get("leftValue");
        Object rightValue = detail.containsKey("rightValueResolved")
                ? detail.get("rightValueResolved")
                : detail.get("rightValue");
        boolean matched = Boolean.TRUE.equals(detail.get("matched"));
        String branchName = String.valueOf(detail.getOrDefault("branch", "-"));
        return String.format("条件判断[%s]: ${%s} %s %s (当前=%s) => %s",
                branchName,
                leftPath,
                operator,
                stringify(rightValue),
                stringify(leftValue),
                matched ? "命中" : "未命中");
    }

    private String stringify(Object value) {
        if (value == null) {
            return "null";
        }
        return String.valueOf(value);
    }
}
