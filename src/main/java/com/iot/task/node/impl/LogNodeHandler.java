package com.iot.task.node.impl;

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

    public LogNodeHandler() {}

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

            // 中文注释：LOG 节点统一写入执行上下文，由 FlowExecutor 聚合后统一入库，避免重复写库。
            context.addLog(logLevel.toUpperCase(Locale.ROOT), message, getType(), node.getName(), data, null);

            // Log to console
            switch (logLevel.toUpperCase()) {
                case "ERROR" -> log.error("LOG node '{}': {}", node.getName(), message);
                case "WARN" -> log.warn("LOG node '{}': {}", node.getName(), message);
                default -> log.info("LOG node '{}': {}", node.getName(), message);
            }

            // saveToDb 参数保留兼容，但不再直接写库（统一由 FlowExecutor 聚合入库）。
            if (saveToDb) {
                context.addLog("INFO", "LOG 节点已加入统一日志聚合入库队列", getType(), node.getName(), null, null);
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

}
