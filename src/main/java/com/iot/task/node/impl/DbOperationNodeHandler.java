package com.iot.task.node.impl;

import com.iot.entity.DataSource;
import com.iot.mapper.DataSourceMapper;
import com.iot.task.engine.FlowExecutionContext;
import com.iot.task.model.FlowNode;
import com.iot.task.node.NodeHandler;
import com.iot.task.node.NodeResult;
import com.iot.util.EncryptionUtil;
import com.iot.util.JdbcUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * DB_OPERATION node handler.
 * Supports LOCAL (project DB) and REMOTE (selected datasource) execution.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DbOperationNodeHandler implements NodeHandler {

    private final javax.sql.DataSource localDataSource;
    private final DataSourceMapper dataSourceMapper;
    private final EncryptionUtil encryptionUtil;

    @Override
    public String getType() {
        return "DB_OPERATION";
    }

    @Override
    public NodeResult execute(FlowNode node, FlowExecutionContext context) {
        try {
            Map<String, Object> config = node.getConfig();
            if (config == null) {
                return NodeResult.error("DB_OPERATION node has no config");
            }

            String operation = String.valueOf(config.getOrDefault("operation", "SELECT")).toUpperCase();
            String tableName = asString(config.get("tableName"));
            String sql = asString(config.get("sql"));
            String outputVar = asString(config.getOrDefault("outputVariable", "dbResult"));
            String dbMode = asString(config.getOrDefault("dbMode", "LOCAL")).toUpperCase();
            Long dataSourceId = toLong(config.get("dataSourceId"));

            if (sql == null || sql.isBlank()) {
                sql = buildSqlFromOperation(operation, tableName);
            }
            if (sql == null || sql.isBlank()) {
                return NodeResult.error("DB_OPERATION: SQL is empty");
            }

            String resolvedSql = JdbcUtils.resolveVariables(sql, context);

            Map<String, Object> startKv = new LinkedHashMap<>();
            startKv.put("operation", operation);
            startKv.put("dbMode", dbMode);
            startKv.put("dataSourceId", dataSourceId);
            startKv.put("tableName", tableName);
            startKv.put("outputVariable", outputVar);
            startKv.put("sql", abbreviate(resolvedSql, 300));
            context.addLog("INFO", "DB_OPERATION 执行参数", "DB_OPERATION", node.getName(), startKv, null);

            Object result;
            try (Connection conn = getConnection(dbMode, dataSourceId);
                 Statement stmt = conn.createStatement()) {
                if (isQuerySql(resolvedSql)) {
                    try (ResultSet rs = stmt.executeQuery(resolvedSql)) {
                        result = resultSetToList(rs);
                    }
                    @SuppressWarnings("unchecked")
                    int rowCount = ((List<Map<String, Object>>) result).size();
                    Map<String, Object> doneKv = new LinkedHashMap<>();
                    doneKv.put("mode", "QUERY");
                    doneKv.put("rows", rowCount);
                    doneKv.put("outputVariable", outputVar);
                    context.addLog("INFO", "DB_OPERATION 查询完成", "DB_OPERATION", node.getName(), doneKv, null);
                } else {
                    int affected = stmt.executeUpdate(resolvedSql);
                    result = Map.of("affectedRows", affected);
                    Map<String, Object> doneKv = new LinkedHashMap<>();
                    doneKv.put("mode", "UPDATE");
                    doneKv.put("affectedRows", affected);
                    doneKv.put("outputVariable", outputVar);
                    context.addLog("INFO", "DB_OPERATION 更新完成", "DB_OPERATION", node.getName(), doneKv, null);
                }
            }

            context.setVariable(outputVar, result);
            return NodeResult.ok(result);
        } catch (Exception e) {
            log.error("DB_OPERATION node '{}' failed: {}", node.getName(), e.getMessage(), e);
            context.addLog("ERROR", "DB_OPERATION error: " + e.getMessage(), "DB_OPERATION", node.getName(), null, null);
            return NodeResult.error("DB_OPERATION failed: " + e.getMessage());
        }
    }

    private Connection getConnection(String dbMode, Long dataSourceId) throws Exception {
        if ("REMOTE".equalsIgnoreCase(dbMode)) {
            if (dataSourceId == null) {
                throw new IllegalArgumentException("REMOTE mode requires dataSourceId");
            }
            DataSource ds = dataSourceMapper.selectById(dataSourceId);
            if (ds == null) {
                throw new IllegalArgumentException("Datasource not found: " + dataSourceId);
            }
            if (ds.getDriverClass() != null && !ds.getDriverClass().isBlank()) {
                Class.forName(ds.getDriverClass());
            }
            String encryptedPwd = ds.getPassword();
            String rawPwd = encryptedPwd != null ? encryptionUtil.decrypt(encryptedPwd) : null;
            return java.sql.DriverManager.getConnection(ds.getUrl(), ds.getUsername(), rawPwd);
        }
        return localDataSource.getConnection();
    }

    private static String buildSqlFromOperation(String operation, String tableName) {
        if (tableName == null || tableName.isBlank()) {
            return null;
        }
        return switch (operation) {
            case "SELECT" -> "SELECT * FROM " + tableName;
            case "DELETE" -> "DELETE FROM " + tableName;
            case "INSERT", "UPDATE" -> null; // Require explicit SQL for safety.
            default -> null;
        };
    }

    private static boolean isQuerySql(String sql) {
        String trimmed = sql == null ? "" : sql.trim().toUpperCase();
        return trimmed.startsWith("SELECT") || trimmed.startsWith("SHOW") || trimmed.startsWith("DESCRIBE")
                || trimmed.startsWith("PRAGMA") || trimmed.startsWith("WITH");
    }

    private static List<Map<String, Object>> resultSetToList(ResultSet rs) throws Exception {
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

    private static Long toLong(Object value) {
        if (value instanceof Number n) {
            return n.longValue();
        }
        if (value instanceof String s && !s.isBlank()) {
            try {
                return Long.parseLong(s.trim());
            } catch (Exception ignored) {
            }
        }
        return null;
    }

    private static String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static String abbreviate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "...";
    }
}
