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
 * DATA_LOAD node - saves data to database tables.
 *
 * Supports two execution modes:
 *   1. Field-mapping mode (original) - builds SQL from field definitions
 *   2. Direct SQL mode (new) - executes a raw SQL statement directly
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
 *                     When provided, field-mapping config is ignored.
 *   --- Field-mapping mode ---
 *   tableName       - target table name
 *   operation       - INSERT | UPDATE | UPSERT (default INSERT)
 *   idField         - primary key column name (default "id")
 *   idStrategy      - AUTO_INCREMENT | ASSIGN_ID | VARIABLE | NONE (default AUTO_INCREMENT)
 *   idVariable      - variable path for ID value when idStrategy=VARIABLE
 *   fields          - array of { column, value, type }
 *                     value supports ${variable} placeholders
 *                     type: STRING | INTEGER | DOUBLE | BOOLEAN | JSON | AUTO (default AUTO)
 *   updateCondition - for UPDATE: WHERE condition with ${variable} support
 *   --- Common ---
 *   outputVariable  - variable to store result (inserted id / affected rows)
 */
@Slf4j
@Component
public class DataLoadNodeHandler implements NodeHandler {

    private final DataSource dataSource;
    private final ObjectMapper objectMapper;

    public DataLoadNodeHandler(DataSource dataSource, ObjectMapper objectMapper) {
        this.dataSource = dataSource;
        this.objectMapper = objectMapper;
    }

    @Override
    public String getType() {
        return "DATA_LOAD";
    }

    @Override
    @SuppressWarnings("unchecked")
    public NodeResult execute(FlowNode node, FlowExecutionContext context) {
        try {
            Map<String, Object> config = node.getConfig();
            if (config == null) {
                return NodeResult.error("DATA_LOAD node has no config");
            }

            String dbMode = (String) config.getOrDefault("dbMode", "LOCAL");
            String outputVar = (String) config.getOrDefault("outputVariable", "saveResult");

            // Check for direct SQL mode
            String rawSql = (String) config.get("sql");
            if (rawSql != null && !rawSql.isBlank()) {
                return executeDirectSql(node, config, dbMode, rawSql, outputVar, context);
            }

            // Fall back to field-mapping mode
            return executeFieldMapping(node, config, dbMode, outputVar, context);
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

    /**
     * Field-mapping mode: the original DATA_LOAD behavior.
     */
    @SuppressWarnings("unchecked")
    private NodeResult executeFieldMapping(FlowNode node, Map<String, Object> config, String dbMode,
                                            String outputVar, FlowExecutionContext context) throws Exception {
        String tableName = (String) config.get("tableName");
        String operation = (String) config.getOrDefault("operation", "INSERT");
        String idField = (String) config.getOrDefault("idField", "id");
        String idStrategy = (String) config.getOrDefault("idStrategy", "AUTO_INCREMENT");
        String idVariable = (String) config.get("idVariable");
        List<Map<String, Object>> fields = (List<Map<String, Object>>) config.get("fields");
        String updateCondition = (String) config.get("updateCondition");

        if (tableName == null || tableName.isBlank()) {
            return NodeResult.error("DATA_LOAD: tableName is required");
        }
        if (fields == null || fields.isEmpty()) {
            return NodeResult.error("DATA_LOAD: fields list is required");
        }

        log.info("DATA_LOAD node '{}': {} into table '{}' (mode={})",
                node.getName(), operation, tableName, dbMode);

        try (Connection conn = getConnection(config, dbMode)) {
            Object result;
            switch (operation.toUpperCase()) {
                case "UPDATE":
                    result = executeUpdate(conn, tableName, fields, updateCondition, context);
                    break;
                case "UPSERT":
                    result = executeUpsert(conn, tableName, fields, idField, idStrategy, idVariable, context);
                    break;
                default: // INSERT
                    result = executeInsert(conn, tableName, fields, idField, idStrategy, idVariable, context);
                    break;
            }

            context.setVariable(outputVar, result);
            context.addLog("DATA_LOAD: " + operation + " into " + tableName + " -> " + result);
            return NodeResult.ok(result);
        }
    }

    /**
     * Execute INSERT and return the generated/assigned ID.
     */
    private Object executeInsert(Connection conn, String tableName,
                                  List<Map<String, Object>> fields,
                                  String idField, String idStrategy, String idVariable,
                                  FlowExecutionContext context) throws Exception {
        List<String> columns = new ArrayList<>();
        List<Object> values = new ArrayList<>();

        // Handle ID field
        Long assignedId = null;
        if ("ASSIGN_ID".equalsIgnoreCase(idStrategy)) {
            assignedId = generateId();
            columns.add(idField);
            values.add(assignedId);
        } else if ("VARIABLE".equalsIgnoreCase(idStrategy) && idVariable != null) {
            Object idVal = resolveValue(idVariable, "AUTO", context);
            columns.add(idField);
            values.add(idVal);
        }
        // AUTO_INCREMENT and NONE: don't include id column

        // Add configured fields
        for (Map<String, Object> field : fields) {
            String column = (String) field.get("column");
            String valueExpr = String.valueOf(field.getOrDefault("value", ""));
            String type = (String) field.getOrDefault("type", "AUTO");
            if (column == null || column.isBlank()) continue;

            columns.add(column);
            values.add(resolveValue(valueExpr, type, context));
        }

        String placeholders = columns.stream().map(c -> "?").collect(Collectors.joining(", "));
        String sql = "INSERT INTO " + tableName + " (" + String.join(", ", columns) + ") VALUES (" + placeholders + ")";

        log.info("DATA_LOAD SQL: {} | values: {}", sql, values);

        try (PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            for (int i = 0; i < values.size(); i++) {
                ps.setObject(i + 1, values.get(i));
            }
            int affected = ps.executeUpdate();

            // Get the generated key
            Object resultId = assignedId;
            if (resultId == null && !"NONE".equalsIgnoreCase(idStrategy)) {
                try (ResultSet keys = ps.getGeneratedKeys()) {
                    if (keys.next()) {
                        resultId = keys.getObject(1);
                    }
                }
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("operation", "INSERT");
            result.put("table", tableName);
            result.put("affectedRows", affected);
            if (resultId != null) {
                result.put("id", resultId);
            }
            return result;
        }
    }

    /**
     * Execute UPDATE with a WHERE condition.
     */
    private Object executeUpdate(Connection conn, String tableName,
                                  List<Map<String, Object>> fields,
                                  String updateCondition,
                                  FlowExecutionContext context) throws Exception {
        List<String> setClauses = new ArrayList<>();
        List<Object> values = new ArrayList<>();

        for (Map<String, Object> field : fields) {
            String column = (String) field.get("column");
            String valueExpr = String.valueOf(field.getOrDefault("value", ""));
            String type = (String) field.getOrDefault("type", "AUTO");
            if (column == null || column.isBlank()) continue;

            setClauses.add(column + " = ?");
            values.add(resolveValue(valueExpr, type, context));
        }

        String sql = "UPDATE " + tableName + " SET " + String.join(", ", setClauses);
        if (updateCondition != null && !updateCondition.isBlank()) {
            sql += " WHERE " + resolveVariables(updateCondition, context);
        }

        log.info("DATA_LOAD SQL: {}", sql);

        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            for (int i = 0; i < values.size(); i++) {
                ps.setObject(i + 1, values.get(i));
            }
            int affected = ps.executeUpdate();

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("operation", "UPDATE");
            result.put("table", tableName);
            result.put("affectedRows", affected);
            return result;
        }
    }

    /**
     * Execute UPSERT (INSERT OR REPLACE for SQLite, INSERT ON DUPLICATE KEY UPDATE for MySQL).
     */
    private Object executeUpsert(Connection conn, String tableName,
                                  List<Map<String, Object>> fields,
                                  String idField, String idStrategy, String idVariable,
                                  FlowExecutionContext context) throws Exception {
        List<String> columns = new ArrayList<>();
        List<Object> values = new ArrayList<>();

        // Handle ID
        if ("VARIABLE".equalsIgnoreCase(idStrategy) && idVariable != null) {
            Object idVal = resolveValue(idVariable, "AUTO", context);
            columns.add(idField);
            values.add(idVal);
        } else if ("ASSIGN_ID".equalsIgnoreCase(idStrategy)) {
            columns.add(idField);
            values.add(generateId());
        }

        for (Map<String, Object> field : fields) {
            String column = (String) field.get("column");
            String valueExpr = String.valueOf(field.getOrDefault("value", ""));
            String type = (String) field.getOrDefault("type", "AUTO");
            if (column == null || column.isBlank()) continue;
            columns.add(column);
            values.add(resolveValue(valueExpr, type, context));
        }

        String placeholders = columns.stream().map(c -> "?").collect(Collectors.joining(", "));
        // SQLite uses INSERT OR REPLACE
        String sql = "INSERT OR REPLACE INTO " + tableName + " (" + String.join(", ", columns) + ") VALUES (" + placeholders + ")";

        log.info("DATA_LOAD SQL: {}", sql);

        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            for (int i = 0; i < values.size(); i++) {
                ps.setObject(i + 1, values.get(i));
            }
            int affected = ps.executeUpdate();

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("operation", "UPSERT");
            result.put("table", tableName);
            result.put("affectedRows", affected);
            return result;
        }
    }

    // ---- Helpers ----

    private Connection getConnection(Map<String, Object> config, String dbMode) throws Exception {
        if ("REMOTE".equalsIgnoreCase(dbMode)) {
            String dbType = (String) config.getOrDefault("dbType", "MYSQL");
            String dbHost = (String) config.get("dbHost");
            int dbPort = JdbcUtils.toInt(config.get("dbPort"), JdbcUtils.getDefaultPort(dbType));
            String dbName = (String) config.get("dbName");
            String username = (String) config.get("username");
            String password = (String) config.get("password");
            String jdbcUrl = JdbcUtils.buildJdbcUrl(dbType, dbHost, dbPort, dbName);
            return DriverManager.getConnection(jdbcUrl, username, password);
        }
        // LOCAL: use application DataSource (SQLite)
        return dataSource.getConnection();
    }

    /**
     * Resolve a value expression: supports ${variable} placeholders and type conversion.
     */
    private Object resolveValue(String valueExpr, String type, FlowExecutionContext context) {
        if (valueExpr == null) return null;

        // Resolve ${variable} placeholders
        String resolved = resolveVariables(valueExpr, context);

        // If the entire expression was a single ${var}, get the raw object
        if (valueExpr.startsWith("${") && valueExpr.endsWith("}") && valueExpr.indexOf('}') == valueExpr.length() - 1) {
            String varPath = valueExpr.substring(2, valueExpr.length() - 1);
            Object rawVal = VariablePathUtils.getValue(context.getVariables(), varPath);
            if (rawVal != null) {
                return convertType(rawVal, type);
            }
        }

        return convertType(resolved, type);
    }

    private Object convertType(Object value, String type) {
        if (value == null) return null;
        if (type == null || "AUTO".equalsIgnoreCase(type)) {
            // For collections/maps, serialize to JSON string
            if (value instanceof List || value instanceof Map) {
                try {
                    return objectMapper.writeValueAsString(value);
                } catch (Exception e) {
                    return value.toString();
                }
            }
            return value;
        }
        String strVal = value.toString();
        try {
            return switch (type.toUpperCase()) {
                case "INTEGER", "INT" -> {
                    try {
                        yield Long.parseLong(strVal);
                    } catch (NumberFormatException e) {
                        yield (long) Double.parseDouble(strVal);
                    }
                }
                case "DOUBLE", "FLOAT", "NUMBER" -> Double.parseDouble(strVal);
                case "BOOLEAN", "BOOL" -> Boolean.parseBoolean(strVal);
                case "JSON" -> {
                    if (value instanceof List || value instanceof Map) {
                        yield objectMapper.writeValueAsString(value);
                    }
                    yield strVal;
                }
                default -> strVal; // STRING
            };
        } catch (Exception e) {
            log.warn("Type conversion failed for value '{}' to type '{}': {}", strVal, type, e.getMessage());
            return strVal;
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

    private static long generateId() {
        // Simple snowflake-like ID: timestamp-based
        return com.baomidou.mybatisplus.core.toolkit.IdWorker.getId();
    }
}
