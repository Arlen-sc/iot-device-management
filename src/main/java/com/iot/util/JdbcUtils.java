package com.iot.util;

import com.iot.task.engine.FlowExecutionContext;

/**
 * Shared JDBC utility methods for node handlers that interact with databases.
 * Used by {@code DataLoadNodeHandler} and {@code SqlQueryNodeHandler}.
 */
public final class JdbcUtils {

    private JdbcUtils() {
    }

    /**
     * Build a JDBC URL for the given database type.
     *
     * @param dbType MYSQL | POSTGRESQL | SQLSERVER
     * @param host   database server host
     * @param port   database server port
     * @param dbName database / schema name (may be null)
     * @return a complete JDBC URL string
     */
    public static String buildJdbcUrl(String dbType, String host, int port, String dbName) {
        String safeName = dbName != null ? dbName : "";
        return switch (dbType.toUpperCase()) {
            case "POSTGRESQL" -> "jdbc:postgresql://" + host + ":" + port + "/" + safeName;
            case "SQLSERVER" -> "jdbc:sqlserver://" + host + ":" + port + ";databaseName=" + safeName + ";encrypt=false";
            default -> "jdbc:mysql://" + host + ":" + port + "/" + safeName + "?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Shanghai";
        };
    }

    /**
     * Return the default port for a given database type.
     *
     * @param dbType MYSQL | POSTGRESQL | SQLSERVER
     * @return default port number
     */
    public static int getDefaultPort(String dbType) {
        return switch (dbType.toUpperCase()) {
            case "POSTGRESQL" -> 5432;
            case "SQLSERVER" -> 1433;
            default -> 3306;
        };
    }

    /**
     * Replace {@code ${variableName}} placeholders in a template string with values
     * from the execution context.
     *
     * @param template the string containing ${...} placeholders
     * @param context  the flow execution context holding variables
     * @return the resolved string
     */
    public static String resolveVariables(String template, FlowExecutionContext context) {
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

    /**
     * Safely parse an Object to int with a default fallback.
     */
    public static int toInt(Object obj, int def) {
        if (obj instanceof Number n) return n.intValue();
        if (obj instanceof String s) {
            try { return Integer.parseInt(s); } catch (Exception ignored) {}
        }
        return def;
    }
}
