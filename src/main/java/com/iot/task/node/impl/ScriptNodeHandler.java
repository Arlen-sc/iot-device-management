package com.iot.task.node.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iot.task.engine.FlowExecutionContext;
import com.iot.task.model.FlowNode;
import com.iot.task.node.NodeHandler;
import com.iot.task.node.NodeResult;
import com.iot.util.VariablePathUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

/**
 * SCRIPT node - the unified data transformation and manipulation engine.
 *
 * Supports all operations from both the original SCRIPT and DATA_TRANSFORM nodes:
 *
 *   --- String operations ---
 *   SPLIT             - Split string by delimiter into array
 *   JOIN              - Join array elements with delimiter
 *   SUBSTRING         - Extract substring (start, end params)
 *   REPLACE           - Replace pattern in string (pattern, replacement params)
 *   CONCAT            - Concatenate multiple values
 *   TEMPLATE          - Build string from template with ${var} placeholders
 *   STRIP_PREFIX      - Remove prefix from string
 *   TO_STRING         - Convert any value to its string representation
 *   JSON_STRINGIFY    - Serialize value to JSON string (alias for JSON representation)
 *
 *   --- Numeric operations ---
 *   TO_NUMBER         - Parse string to number (Long or Double)
 *   ROUND             - Round number to scale (scale param, default 2)
 *   HEX_TO_DEC        - Convert hex string to decimal number
 *   DEC_TO_HEX        - Convert decimal number to hex string (0x prefixed)
 *
 *   --- Array operations ---
 *   ARRAY_LENGTH      - Get length of array/list or string
 *   ARRAY_SLICE       - Get subset of array (start, end params)
 *   HEX_ARRAY_TO_DEC  - Convert array of hex strings to decimal numbers
 *   DEC_ARRAY_TO_HEX  - Convert array of numbers to hex string (concatenated bytes)
 *
 *   --- JSON operations ---
 *   JSON_BUILD        - Build JSON string from template or fields map
 *   JSON_PARSE        - Parse JSON string to object
 *
 *   --- Format operations ---
 *   PARSE_CSV_VALUES  - Parse "v1=a,v2=b" format into named map
 *   FORMAT_VALUES     - Format array as "v1=a,v2=b,..." string
 *
 *   --- Encoding operations ---
 *   STRING_TO_HEX     - Convert string to hex representation
 *   HEX_TO_STRING     - Convert hex representation to string
 *
 * Config:
 *   operations: [
 *     { "op": "SPLIT", "source": "rawData", "target": "dataArray", "params": { "delimiter": "," } },
 *     { "op": "HEX_ARRAY_TO_DEC", "source": "dataArray", "target": "decArray" },
 *     { "op": "ROUND", "source": "value", "target": "rounded", "params": { "scale": 2 } },
 *     ...
 *   ]
 */
@Slf4j
@Component
public class ScriptNodeHandler implements NodeHandler {

    private final ObjectMapper objectMapper;

    public ScriptNodeHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public String getType() {
        return "SCRIPT";
    }

    @Override
    @SuppressWarnings("unchecked")
    public NodeResult execute(FlowNode node, FlowExecutionContext context) {
        try {
            Map<String, Object> config = node.getConfig();
            if (config == null) {
                return NodeResult.error("SCRIPT node has no config");
            }

            List<Map<String, Object>> operations = (List<Map<String, Object>>) config.get("operations");
            if (operations == null || operations.isEmpty()) {
                return NodeResult.ok();
            }

            log.info("Executing SCRIPT node: {} with {} operations", node.getName(), operations.size());

            for (Map<String, Object> operation : operations) {
                String op = (String) operation.get("op");
                String source = (String) operation.get("source");
                String target = (String) operation.get("target");
                Map<String, Object> params = (Map<String, Object>) operation.getOrDefault("params", Map.of());

                Object sourceValue = source != null ? VariablePathUtils.getValue(context.getVariables(), source) : null;
                Object result = executeOperation(op, sourceValue, params, context);

                if (target != null) {
                    VariablePathUtils.setValue(context.getVariables(), target, result);
                    context.addLog("SCRIPT [" + op + "]: " + source + " -> " + target);
                }
            }

            return NodeResult.ok();
        } catch (Exception e) {
            log.error("SCRIPT node '{}' failed: {}", node.getName(), e.getMessage(), e);
            context.addLog("SCRIPT error: " + e.getMessage());
            return NodeResult.error("SCRIPT failed: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    Object executeOperation(String op, Object sourceValue, Map<String, Object> params,
                                     FlowExecutionContext context) throws Exception {
        if (op == null) return sourceValue;

        switch (op.toUpperCase()) {
            case "SPLIT" -> {
                String delimiter = (String) params.getOrDefault("delimiter", ",");
                String str = String.valueOf(sourceValue);
                return Arrays.asList(str.split(delimiter.equals(".") ? "\\." : java.util.regex.Pattern.quote(delimiter)));
            }

            case "JOIN" -> {
                String delimiter = (String) params.getOrDefault("delimiter", ",");
                if (sourceValue instanceof List<?> list) {
                    return list.stream().map(String::valueOf).collect(Collectors.joining(delimiter));
                }
                return String.valueOf(sourceValue);
            }

            case "HEX_ARRAY_TO_DEC" -> {
                if (sourceValue instanceof List<?> list) {
                    List<Long> result = new ArrayList<>();
                    for (Object item : list) {
                        String hex = String.valueOf(item).trim();
                        if (hex.startsWith("0x") || hex.startsWith("0X")) {
                            hex = hex.substring(2);
                        }
                        try {
                            result.add(Long.parseLong(hex, 16));
                        } catch (Exception e) {
                            result.add(0L);
                        }
                    }
                    return result;
                }
                // Single value fallback (from DATA_TRANSFORM behavior)
                return hexToDec(sourceValue);
            }

            case "DEC_ARRAY_TO_HEX" -> {
                if (sourceValue instanceof List<?> list) {
                    StringBuilder sb = new StringBuilder();
                    for (Object item : list) {
                        long val;
                        if (item instanceof Number n) {
                            val = n.longValue();
                        } else {
                            val = Long.parseLong(String.valueOf(item));
                        }
                        sb.append(String.format("%02X", val & 0xFF));
                    }
                    return sb.toString();
                }
                // Single value fallback (from DATA_TRANSFORM behavior)
                return decToHex(sourceValue);
            }

            case "ARRAY_LENGTH" -> {
                if (sourceValue instanceof List<?> list) {
                    return list.size();
                }
                if (sourceValue instanceof String str) {
                    return str.length();
                }
                return String.valueOf(sourceValue).length();
            }

            case "ARRAY_SLICE" -> {
                if (sourceValue instanceof List<?> list) {
                    int start = toInt(params.get("start"), 0);
                    int end = toInt(params.get("end"), list.size());
                    return new ArrayList<>(list.subList(
                            Math.max(0, start),
                            Math.min(list.size(), end)));
                }
                return sourceValue;
            }

            case "JSON_BUILD" -> {
                String template = (String) params.get("template");
                if (template != null) {
                    return resolveVariables(template, context);
                }
                // Build from map
                Map<String, Object> fields = (Map<String, Object>) params.get("fields");
                if (fields != null) {
                    Map<String, Object> result = new LinkedHashMap<>();
                    for (Map.Entry<String, Object> entry : fields.entrySet()) {
                        String fieldValue = String.valueOf(entry.getValue());
                        if (fieldValue.startsWith("${") && fieldValue.endsWith("}")) {
                            String path = fieldValue.substring(2, fieldValue.length() - 1);
                            result.put(entry.getKey(), VariablePathUtils.getValue(context.getVariables(), path));
                        } else {
                            result.put(entry.getKey(), entry.getValue());
                        }
                    }
                    return objectMapper.writeValueAsString(result);
                }
                return "{}";
            }

            case "JSON_PARSE" -> {
                String json = String.valueOf(sourceValue);
                return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
            }

            case "FORMAT_VALUES" -> {
                if (sourceValue instanceof List<?> list) {
                    String prefix = (String) params.getOrDefault("prefix", "v");
                    String delimiter = (String) params.getOrDefault("delimiter", ",");
                    StringBuilder sb = new StringBuilder();
                    for (int i = 0; i < list.size(); i++) {
                        if (i > 0) sb.append(delimiter);
                        sb.append(prefix).append(i + 1).append("=").append(list.get(i));
                    }
                    return sb.toString();
                }
                return String.valueOf(sourceValue);
            }

            case "PARSE_CSV_VALUES" -> {
                String str = String.valueOf(sourceValue);
                String delimiter = (String) params.getOrDefault("delimiter", ",");
                Map<String, Object> result = new LinkedHashMap<>();
                for (String part : str.split(java.util.regex.Pattern.quote(delimiter))) {
                    String[] kv = part.split("=", 2);
                    if (kv.length == 2) {
                        try {
                            result.put(kv[0].trim(), Long.parseLong(kv[1].trim()));
                        } catch (Exception e) {
                            result.put(kv[0].trim(), kv[1].trim());
                        }
                    }
                }
                return result;
            }

            case "STRING_TO_HEX" -> {
                String str = String.valueOf(sourceValue);
                byte[] bytes = str.getBytes(java.nio.charset.StandardCharsets.UTF_8);
                StringBuilder sb = new StringBuilder();
                for (byte b : bytes) {
                    sb.append(String.format("%02X", b & 0xFF));
                }
                return sb.toString();
            }

            case "HEX_TO_STRING" -> {
                String hex = String.valueOf(sourceValue).replaceAll("\\s+", "");
                byte[] bytes = new byte[hex.length() / 2];
                for (int i = 0; i < hex.length(); i += 2) {
                    bytes[i / 2] = (byte) ((Character.digit(hex.charAt(i), 16) << 4)
                            + Character.digit(hex.charAt(i + 1), 16));
                }
                return new String(bytes, java.nio.charset.StandardCharsets.UTF_8);
            }

            case "STRIP_PREFIX" -> {
                String str = String.valueOf(sourceValue);
                String prefix = (String) params.get("prefix");
                if (prefix != null && str.startsWith(prefix)) {
                    return str.substring(prefix.length());
                }
                return str;
            }

            case "CONCAT" -> {
                List<String> parts = (List<String>) params.get("parts");
                if (parts != null) {
                    StringBuilder sb = new StringBuilder();
                    for (String part : parts) {
                        sb.append(resolveVariables(part, context));
                    }
                    return sb.toString();
                }
                return String.valueOf(sourceValue);
            }

            case "TEMPLATE" -> {
                String template = (String) params.get("template");
                return template != null ? resolveVariables(template, context) : "";
            }

            // --- Operations merged from DATA_TRANSFORM ---

            case "HEX_TO_DEC" -> {
                return hexToDec(sourceValue);
            }

            case "DEC_TO_HEX" -> {
                return decToHex(sourceValue);
            }

            case "ROUND" -> {
                return round(sourceValue, params);
            }

            case "TO_NUMBER" -> {
                return toNumber(sourceValue);
            }

            case "SUBSTRING" -> {
                return substring(sourceValue, params);
            }

            case "REPLACE" -> {
                return replace(sourceValue, params);
            }

            case "TO_STRING" -> {
                return String.valueOf(sourceValue);
            }

            case "JSON_STRINGIFY" -> {
                try {
                    return objectMapper.writeValueAsString(sourceValue);
                } catch (Exception e) {
                    return String.valueOf(sourceValue);
                }
            }

            default -> {
                log.warn("Unknown SCRIPT operation: {}", op);
                return sourceValue;
            }
        }
    }

    // --- Helper methods for merged DATA_TRANSFORM operations ---

    private Object hexToDec(Object value) {
        try {
            String hex = String.valueOf(value).trim();
            if (hex.startsWith("0x") || hex.startsWith("0X")) {
                hex = hex.substring(2);
            }
            return Long.parseLong(hex, 16);
        } catch (Exception e) {
            log.warn("HEX_TO_DEC failed for value: {}", value);
            return value;
        }
    }

    private Object decToHex(Object value) {
        try {
            long num;
            if (value instanceof Number) {
                num = ((Number) value).longValue();
            } else {
                num = Long.parseLong(String.valueOf(value));
            }
            return "0x" + Long.toHexString(num).toUpperCase();
        } catch (Exception e) {
            log.warn("DEC_TO_HEX failed for value: {}", value);
            return value;
        }
    }

    private Object round(Object value, Map<String, Object> params) {
        try {
            int scale = params != null && params.containsKey("scale") ? ((Number) params.get("scale")).intValue() : 2;
            BigDecimal bd;
            if (value instanceof Number) {
                bd = BigDecimal.valueOf(((Number) value).doubleValue());
            } else {
                bd = new BigDecimal(String.valueOf(value));
            }
            return bd.setScale(scale, RoundingMode.HALF_UP).doubleValue();
        } catch (Exception e) {
            log.warn("ROUND failed for value: {}", value);
            return value;
        }
    }

    private Object toNumber(Object value) {
        try {
            String str = String.valueOf(value).trim();
            if (str.contains(".")) {
                return Double.parseDouble(str);
            }
            return Long.parseLong(str);
        } catch (Exception e) {
            log.warn("TO_NUMBER failed for value: {}", value);
            return value;
        }
    }

    private Object substring(Object value, Map<String, Object> params) {
        try {
            String str = String.valueOf(value);
            int start = params != null && params.containsKey("start") ? ((Number) params.get("start")).intValue() : 0;
            int end = params != null && params.containsKey("end") ? ((Number) params.get("end")).intValue() : str.length();
            return str.substring(start, Math.min(end, str.length()));
        } catch (Exception e) {
            log.warn("SUBSTRING failed for value: {}", value);
            return value;
        }
    }

    private Object replace(Object value, Map<String, Object> params) {
        try {
            String str = String.valueOf(value);
            String pattern = params != null ? (String) params.get("pattern") : null;
            String replacement = params != null ? (String) params.getOrDefault("replacement", "") : "";
            if (pattern != null) {
                return str.replace(pattern, replacement);
            }
            return value;
        } catch (Exception e) {
            log.warn("REPLACE failed for value: {}", value);
            return value;
        }
    }

    // --- Utility methods ---

    private String resolveVariables(String template, FlowExecutionContext context) {
        if (template == null) return null;
        StringBuilder sb = new StringBuilder();
        int i = 0;
        while (i < template.length()) {
            if (i + 1 < template.length() && template.charAt(i) == '$' && template.charAt(i + 1) == '{') {
                int end = template.indexOf('}', i + 2);
                if (end > 0) {
                    String varPath = template.substring(i + 2, end);
                    Object val = VariablePathUtils.getValue(context.getVariables(), varPath);
                    sb.append(val != null ? val.toString() : "");
                    i = end + 1;
                    continue;
                }
            }
            sb.append(template.charAt(i));
            i++;
        }
        return sb.toString();
    }

    private static int toInt(Object obj, int def) {
        if (obj instanceof Number n) return n.intValue();
        if (obj instanceof String s) {
            try { return Integer.parseInt(s); } catch (Exception ignored) {}
        }
        return def;
    }
}
