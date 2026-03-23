package com.iot.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Aligns legacy SQLite {@code flow_execution_log} tables with the current schema.
 * {@code CREATE TABLE IF NOT EXISTS} does not add columns to existing tables, so older
 * databases can miss columns such as {@code action_type} and break log queries.
 */
@Slf4j
@Component
@Order(1)
public class SqliteFlowExecutionLogMigration implements ApplicationRunner {

    private static final String TABLE = "flow_execution_log";

    private final DataSource dataSource;

    public SqliteFlowExecutionLogMigration(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public void run(ApplicationArguments args) {
        try (Connection conn = dataSource.getConnection()) {
            if (!tableExists(conn, TABLE)) {
                return;
            }
            Set<String> cols = listColumns(conn, TABLE);
            addColumnIfMissing(conn, cols, "event_id", "VARCHAR(100)");
            addColumnIfMissing(conn, cols, "action_type", "VARCHAR(50)");
        } catch (Exception e) {
            log.warn("flow_execution_log migration skipped or failed: {}", e.getMessage());
        }
    }

    private static boolean tableExists(Connection conn, String table) throws Exception {
        String sql = "SELECT 1 FROM sqlite_master WHERE type='table' AND name='" + table + "'";
        try (Statement st = conn.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            return rs.next();
        }
    }

    private static Set<String> listColumns(Connection conn, String table) throws Exception {
        Set<String> names = new HashSet<>();
        try (Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery("PRAGMA table_info(" + table + ")")) {
            while (rs.next()) {
                names.add(rs.getString("name").toLowerCase(Locale.ROOT));
            }
        }
        return names;
    }

    private static void addColumnIfMissing(Connection conn, Set<String> cols, String column, String ddlType)
            throws Exception {
        String key = column.toLowerCase(Locale.ROOT);
        if (cols.contains(key)) {
            return;
        }
        String sql = "ALTER TABLE " + TABLE + " ADD COLUMN " + column + " " + ddlType;
        try (Statement st = conn.createStatement()) {
            st.executeUpdate(sql);
            log.info("SQLite migration: added column {} to {}", column, TABLE);
            cols.add(key);
        }
    }
}
