package com.iot.task.node.impl;

import com.iot.config.DataSourceManager;
import com.iot.task.engine.FlowExecutionContext;
import com.iot.task.model.FlowNode;
import com.iot.task.node.NodeHandler;
import com.iot.task.node.NodeResult;
import com.iot.util.EncryptionUtil;
import com.iot.util.JdbcUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.*;
import java.util.*;

/**
 * SQL_QUERY node - connects to an external database and executes SQL.
 *
 * Config fields:
 *   dbType         - MYSQL | POSTGRESQL | SQLSERVER  (default MYSQL)
 *   dbHost         - database server host
 *   dbPort         - database port (default 3306)
 *   dbName         - database / schema name
 *   username       - DB username
 *   password       - DB password (encrypted)
 *   sql            - SQL statement (supports ${variableName} placeholders)
 *   outputVariable - variable to store result (default "sqlResult")
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SqlQueryNodeHandler implements NodeHandler {

    private final DataSourceManager dataSourceManager;
    private final EncryptionUtil encryptionUtil;

    @Override
    public String getType() {
        return "SQL_QUERY";
    }

    @Override
    public NodeResult execute(FlowNode node, FlowExecutionContext context) {
        try {
            Map<String, Object> config = node.getConfig();
            if (config == null) {
                return NodeResult.error("SQL_QUERY node has no config");
            }

            String dbType = (String) config.getOrDefault("dbType", "MYSQL");
            String dbHost = (String) config.get("dbHost");
            int dbPort = JdbcUtils.toInt(config.get("dbPort"), JdbcUtils.getDefaultPort(dbType));
            String dbName = (String) config.get("dbName");
            String username = (String) config.get("username");
            String password = (String) config.get("password");
            String sql = (String) config.get("sql");
            String outputVar = (String) config.getOrDefault("outputVariable", "sqlResult");

            if (dbHost == null || dbHost.isBlank()) {
                return NodeResult.error("SQL_QUERY: dbHost is required");
            }
            if (sql == null || sql.isBlank()) {
                return NodeResult.error("SQL_QUERY: sql is required");
            }

            // 解密密码
            String decryptedPassword = encryptionUtil.decrypt(password);

            // Resolve ${variable} placeholders in SQL
            sql = JdbcUtils.resolveVariables(sql, context);

            log.info("SQL_QUERY node '{}': connecting to {}:{} and executing SQL", node.getName(), dbHost, dbPort);
            context.addLog("SQL connecting to " + dbHost + ":" + dbPort + "/" + dbName);

            // 使用连接池获取数据源
            DataSource dataSource = dataSourceManager.getOrCreateDataSource(
                dbType, dbHost, dbPort, dbName, username, decryptedPassword
            );

            Object result;
            try (Connection conn = dataSource.getConnection();
                 Statement stmt = conn.createStatement()) {

                // Determine if this is a query (SELECT) or update
                String trimmed = sql.trim().toUpperCase();
                if (trimmed.startsWith("SELECT") || trimmed.startsWith("SHOW") || trimmed.startsWith("DESCRIBE")) {
                    try (ResultSet rs = stmt.executeQuery(sql)) {
                        result = resultSetToList(rs);
                    }
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> rows = (List<Map<String, Object>>) result;
                    context.addLog("SQL query returned " + rows.size() + " rows");
                } else {
                    int affected = stmt.executeUpdate(sql);
                    result = Map.of("affectedRows", affected);
                    context.addLog("SQL update affected " + affected + " rows");
                }
            }

            context.setVariable(outputVar, result);
            return NodeResult.ok(result);
        } catch (Exception e) {
            log.error("SQL_QUERY node '{}' failed: {}", node.getName(), e.getMessage(), e);
            context.addLog("SQL_QUERY error: " + e.getMessage());
            return NodeResult.error("SQL_QUERY failed: " + e.getMessage());
        }
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
