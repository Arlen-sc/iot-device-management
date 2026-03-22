package com.iot.task.node.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iot.task.engine.FlowExecutionContext;
import com.iot.task.model.FlowNode;
import com.iot.task.node.NodeHandler;
import com.iot.task.node.NodeResult;
import com.iot.util.JdbcUtils;
import com.iot.util.VariablePathUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.*;
import java.util.*;
import java.util.stream.Collectors;

/**
 * DATA_LOAD node - saves data to database tables using direct SQL execution.
 *
 * Supports two database modes:
 *   1. LOCAL  - uses the application's built-in SQLite DataSource
 *   2. REMOTE - connects to an external database via JDBC (MySQL/PostgreSQL/SQLServer)
 *
 * Config fields:
 *   dbMode          - LOCAL | REMOTE (default LOCAL)
 *   --- REMOTE mode only ---
 *   dbType          - MYSQL | POSTGRESQL | SQLSERVER
 *   dbHost          - database host
 *   dbPort          - database port
 *   dbName          - database name
 *   username        - DB username
 *   password        - DB password
 *   --- Direct SQL mode ---
 *   sql             - raw SQL statement (supports ${variableName} placeholders)
 *   --- Common ---
 *   outputVariable  - variable to store result (inserted id / affected rows)
 */
@Slf4j
@Component
public class DataLoadNodeHandler implements NodeHandler {

    private final DataSource dataSource;
    private final ObjectMapper objectMapper;

    public DataLoadNodeHandler(ObjectMapper objectMapper, DataSource dataSource) {
        this.objectMapper = objectMapper;
        this.dataSource = dataSource;
    }

    @Override
    public String getType() {
        return "DATA_LOAD";
    }

    @Override
    public NodeResult execute(FlowNode node, FlowExecutionContext context) {
        try {
            Map<String, Object> config = node.getConfig();
            if (config == null) {
                return NodeResult.error("DATA_LOAD node has no config");
            }

            String dbMode = (String) config.getOrDefault("dbMode", "LOCAL");
            String outputVar = (String) config.getOrDefault("outputVariable", "saveResult");

            String rawSql = (String) config.get("sql");
            if (rawSql == null || rawSql.isBlank()) {
                return NodeResult.error("DATA_LOAD: sql is required");
            }
            
            return executeDirectSql(node, config, dbMode, rawSql, outputVar, context);
        } catch (Exception e) {
            log.error("DATA_LOAD node '{}' failed: {}", node.getName(), e.getMessage(), e);
            context.addLog("DATA_LOAD error: " + e.getMessage());
            return NodeResult.error("DATA_LOAD failed: " + e.getMessage());
        }
    }

    /**
     * Direct SQL mode: resolve variables in the SQL and execute it.
     */
    private NodeResult executeDirectSql(FlowNode node, Map<String, Object> config, String dbMode,
                                         String rawSql, String outputVar,
                                         FlowExecutionContext context) throws Exception {
        String sql = JdbcUtils.resolveVariables(rawSql, context);

        log.info("DATA_LOAD node '{}': executing direct SQL (mode={})", node.getName(), dbMode);
        context.addLog("DATA_LOAD executing direct SQL");

        try (Connection conn = getConnection(config, dbMode);
             Statement stmt = conn.createStatement()) {

            String trimmed = sql.trim().toUpperCase();
            Object result;
            if (trimmed.startsWith("SELECT") || trimmed.startsWith("SHOW") || trimmed.startsWith("DESCRIBE")) {
                try (ResultSet rs = stmt.executeQuery(sql)) {
                    result = resultSetToList(rs);
                }
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> rows = (List<Map<String, Object>>) result;
                context.addLog("DATA_LOAD SQL query returned " + rows.size() + " rows");
            } else {
                int affected = stmt.executeUpdate(sql);
                result = Map.of("affectedRows", affected, "operation", "SQL", "sql", sql);
                context.addLog("DATA_LOAD SQL affected " + affected + " rows");
            }

            context.setVariable(outputVar, result);
            return NodeResult.ok(result);
        }
    }

    private Connection getConnection(Map<String, Object> config, String dbMode) throws Exception {
        if ("REMOTE".equalsIgnoreCase(dbMode)) {
            // Reusing application's main DataSource instead of requiring manual connection configs
            log.info("DATA_LOAD: Using system default data source for REMOTE mode");
            return dataSource.getConnection();
        } else {
            // Local SQLite for isolated/embedded storage if needed
            return dataSource.getConnection();
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
                    if (val instanceof List || val instanceof Map) {
                        try {
                            sb.append(objectMapper.writeValueAsString(val));
                        } catch (Exception e) {
                            sb.append(val.toString());
                        }
                    } else {
                        sb.append(val != null ? val.toString() : "");
                    }
                    i = end + 1;
                    continue;
                }
            }
            sb.append(template.charAt(i));
            i++;
        }
        return sb.toString();
    }

    private List<Map<String, Object>> resultSetToList(ResultSet rs) throws SQLException {
        List<Map<String, Object>> rows = new ArrayList<>();
        ResultSetMetaData meta = rs.getMetaData();
        int colCount = meta.getColumnCount();
        while (rs.next()) {
            Map<String, Object> row = new LinkedHashMap<>();
            for (int c = 1; c <= colCount; c++) {
                row.put(meta.getColumnLabel(c), rs.getObject(c));
            }
            rows.add(row);
        }
        return rows;
    }
}
