package com.iot.task.node.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iot.entity.FlowExecutionLog;
import com.iot.mapper.FlowExecutionLogMapper;
import com.iot.task.engine.FlowExecutionContext;
import com.iot.task.model.FlowNode;
import com.iot.task.node.NodeHandler;
import com.iot.task.node.NodeResult;
import com.iot.util.VariablePathUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * LOG node - records data to execution log and saves to SQLite database.
 *
 * Config fields:
 *   message         - log message template (supports ${variable} placeholders)
 *   dataPath        - path to data variable to log
 *   logLevel        - INFO | WARN | ERROR (default INFO)
 *   saveToDb        - if true (default), save to flow_execution_log table
 *   outputVariable  - store log entry in this variable
 */
@Slf4j
@Component
public class LogNodeHandler implements NodeHandler {

    private final ObjectMapper objectMapper;
    private final FlowExecutionLogMapper flowExecutionLogMapper;

    public LogNodeHandler(ObjectMapper objectMapper, FlowExecutionLogMapper flowExecutionLogMapper) {
        this.objectMapper = objectMapper;
        this.flowExecutionLogMapper = flowExecutionLogMapper;
    }

    @Override
    public String getType() {
        return "LOG";
    }

    @Override
    public NodeResult execute(FlowNode node, FlowExecutionContext context) {
        try {
            Map<String, Object> config = node.getConfig();
            if (config == null) {
                return NodeResult.error("LOG node has no config");
            }

            String messageTemplate = (String) config.get("message");
            String dataPath = (String) config.get("dataPath");
            String logLevel = (String) config.getOrDefault("logLevel", "INFO");
            boolean saveToDb = toBool(config.get("saveToDb"), true);
            // Also support legacy saveToFile - treat as saveToDb
            if (!saveToDb) {
                saveToDb = toBool(config.get("saveToFile"), false);
            }
            String outputVar = (String) config.get("outputVariable");

            // Resolve message template
            String message = messageTemplate != null ? resolveVariables(messageTemplate, context) : "";

            // Get data to log
            Object data = dataPath != null ? VariablePathUtils.getValue(context.getVariables(), dataPath) : null;

            // Build log entry map (for variable storage and return)
            Map<String, Object> logEntry = new LinkedHashMap<>();
            logEntry.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
            logEntry.put("flowConfigId", context.getFlowConfigId());
            logEntry.put("level", logLevel);
            logEntry.put("message", message);
            if (data != null) {
                logEntry.put("data", data);
            }

            // Log to execution context
            context.addLog("[" + logLevel + "] " + message + (data != null ? " | data=" + abbreviate(String.valueOf(data), 200) : ""));

            // Log to console
            switch (logLevel.toUpperCase()) {
                case "ERROR" -> log.error("LOG node '{}': {}", node.getName(), message);
                case "WARN" -> log.warn("LOG node '{}': {}", node.getName(), message);
                default -> log.info("LOG node '{}': {}", node.getName(), message);
            }

            // Save to SQLite database
            if (saveToDb) {
                saveToDatabase(node, context, logLevel, message, data);
                context.addLog("Log entry saved to database (flow_execution_log)");
            }

            // Store in variable
            if (outputVar != null) {
                VariablePathUtils.setValue(context.getVariables(), outputVar, logEntry);
            }

            return NodeResult.ok(logEntry);
        } catch (Exception e) {
            log.error("LOG node '{}' failed: {}", node.getName(), e.getMessage(), e);
            context.addLog("LOG error: " + e.getMessage());
            return NodeResult.error("LOG failed: " + e.getMessage());
        }
    }

    private void saveToDatabase(FlowNode node, FlowExecutionContext context,
                                 String level, String message, Object data) {
        try {
            FlowExecutionLog logRecord = new FlowExecutionLog();
            logRecord.setFlowConfigId(context.getFlowConfigId() != null ? Long.valueOf(context.getFlowConfigId()) : null);
            logRecord.setFlowName(context.getFlowName());
            logRecord.setNodeId(node.getId());
            logRecord.setNodeName(node.getName());
            logRecord.setLevel(level);
            logRecord.setMessage(message);
            if (data != null) {
                logRecord.setDataJson(objectMapper.writeValueAsString(data));
            }
            logRecord.setCreatedAt(LocalDateTime.now());

            flowExecutionLogMapper.insert(logRecord);
        } catch (Exception e) {
            log.error("Failed to save log to database: {}", e.getMessage());
        }
    }

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

    private static boolean toBool(Object obj, boolean def) {
        if (obj instanceof Boolean b) return b;
        if (obj instanceof String s) return "true".equalsIgnoreCase(s);
        return def;
    }

    private static String abbreviate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "...";
    }
}
