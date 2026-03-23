package com.iot.task.node.impl;

import com.iot.task.engine.FlowExecutionContext;
import com.iot.task.model.FlowNode;
import com.iot.task.node.NodeHandler;
import com.iot.task.node.NodeResult;
import com.iot.util.VariablePathUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigInteger;
import java.util.Map;

/**
 * BASE_CONVERT node - focused radix conversion handler.
 *
 * Unlike SCRIPT (general-purpose data processing), this node only handles base conversion
 * to keep conversion flows simple and explicit in the designer.
 */
@Slf4j
@Component
public class BaseConvertNodeHandler implements NodeHandler {

    @Override
    public String getType() {
        return "BASE_CONVERT";
    }

    @Override
    public NodeResult execute(FlowNode node, FlowExecutionContext context) {
        try {
            Map<String, Object> config = node.getConfig();
            if (config == null) {
                return NodeResult.error("BASE_CONVERT node has no config");
            }

            String source = asString(config.get("source"));
            String target = asString(config.get("target"));
            String mode = asString(config.getOrDefault("mode", "HEX_TO_DEC"));
            boolean uppercase = truthy(config.get("uppercase"), true);
            boolean withPrefix = truthy(config.get("withPrefix"), false);

            if (source == null || source.isBlank()) {
                return NodeResult.error("BASE_CONVERT requires source variable");
            }
            if (target == null || target.isBlank()) {
                return NodeResult.error("BASE_CONVERT requires target variable");
            }

            Object sourceValue = VariablePathUtils.getValue(context.getVariables(), source);
            if (sourceValue == null) {
                return NodeResult.error("BASE_CONVERT source value is null: " + source);
            }

            int fromBase;
            int toBase;
            if ("CUSTOM".equalsIgnoreCase(mode)) {
                fromBase = asBase(config.get("fromBase"), 16);
                toBase = asBase(config.get("toBase"), 10);
            } else {
                int[] mapping = modeToBases(mode);
                fromBase = mapping[0];
                toBase = mapping[1];
            }

            String normalized = normalizeInput(String.valueOf(sourceValue), fromBase);
            BigInteger converted = new BigInteger(normalized, fromBase);
            Object output = formatOutput(converted, toBase, uppercase, withPrefix);

            VariablePathUtils.setValue(context.getVariables(), target, output);
            context.addLog("BASE_CONVERT [" + mode + "]: " + source + " -> " + target);
            return NodeResult.ok(output);
        } catch (Exception e) {
            log.error("BASE_CONVERT node '{}' failed: {}", node.getName(), e.getMessage(), e);
            return NodeResult.error("BASE_CONVERT failed: " + e.getMessage());
        }
    }

    private static int[] modeToBases(String mode) {
        if (mode == null) {
            return new int[]{16, 10};
        }
        return switch (mode.toUpperCase()) {
            case "HEX_TO_DEC" -> new int[]{16, 10};
            case "DEC_TO_HEX" -> new int[]{10, 16};
            case "BIN_TO_DEC" -> new int[]{2, 10};
            case "DEC_TO_BIN" -> new int[]{10, 2};
            case "HEX_TO_BIN" -> new int[]{16, 2};
            case "BIN_TO_HEX" -> new int[]{2, 16};
            default -> new int[]{16, 10};
        };
    }

    private static String normalizeInput(String raw, int fromBase) {
        String value = raw == null ? "" : raw.trim();
        if (value.isEmpty()) {
            throw new IllegalArgumentException("source value is empty");
        }
        if (fromBase == 16 && (value.startsWith("0x") || value.startsWith("0X"))) {
            return value.substring(2);
        }
        if (fromBase == 2 && (value.startsWith("0b") || value.startsWith("0B"))) {
            return value.substring(2);
        }
        return value;
    }

    private static Object formatOutput(BigInteger value, int toBase, boolean uppercase, boolean withPrefix) {
        if (toBase == 10) {
            try {
                return value.longValueExact();
            } catch (ArithmeticException ignored) {
                return value.toString(10);
            }
        }

        String result = value.toString(toBase);
        if (uppercase) {
            result = result.toUpperCase();
        }
        if (!withPrefix) {
            return result;
        }
        if (toBase == 16) {
            return "0x" + result;
        }
        if (toBase == 2) {
            return "0b" + result;
        }
        return result;
    }

    private static int asBase(Object value, int def) {
        int base;
        if (value instanceof Number number) {
            base = number.intValue();
        } else if (value != null) {
            base = Integer.parseInt(String.valueOf(value));
        } else {
            base = def;
        }
        if (base < 2 || base > 36) {
            throw new IllegalArgumentException("base must be between 2 and 36");
        }
        return base;
    }

    private static String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static boolean truthy(Object value, boolean def) {
        if (value == null) {
            return def;
        }
        if (value instanceof Boolean bool) {
            return bool;
        }
        return "true".equalsIgnoreCase(String.valueOf(value).trim());
    }
}
