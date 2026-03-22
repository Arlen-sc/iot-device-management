package com.iot.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 数据源管理器 - 管理外部数据库连接池
 */
@Slf4j
@Component
public class DataSourceManager {

    private final Map<String, HikariDataSource> dataSourceCache = new ConcurrentHashMap<>();

    /**
     * 获取或创建数据源
     * @param dbType 数据库类型
     * @param host 主机
     * @param port 端口
     * @param dbName 数据库名
     * @param username 用户名
     * @param password 密码
     * @return DataSource
     */
    public DataSource getOrCreateDataSource(String dbType, String host, int port, 
                                            String dbName, String username, String password) {
        String key = generateKey(dbType, host, port, dbName, username);
        
        return dataSourceCache.computeIfAbsent(key, k -> {
            log.info("创建新的数据源连接池: {}:{}", host, port);
            return createDataSource(dbType, host, port, dbName, username, password);
        });
    }

    /**
     * 创建HikariCP数据源
     */
    private HikariDataSource createDataSource(String dbType, String host, int port,
                                              String dbName, String username, String password) {
        HikariConfig config = new HikariConfig();
        
        String jdbcUrl = buildJdbcUrl(dbType, host, port, dbName);
        config.setJdbcUrl(jdbcUrl);
        config.setUsername(username);
        config.setPassword(password);
        
        config.setMaximumPoolSize(5);
        config.setMinimumIdle(1);
        config.setConnectionTimeout(30000);
        config.setIdleTimeout(600000);
        config.setMaxLifetime(1800000);
        config.setPoolName("HikariPool-" + dbType);
        
        return new HikariDataSource(config);
    }

    /**
     * 构建JDBC URL
     */
    private String buildJdbcUrl(String dbType, String host, int port, String dbName) {
        String safeName = dbName != null ? dbName : "";
        return switch (dbType.toUpperCase()) {
            case "POSTGRESQL" -> "jdbc:postgresql://" + host + ":" + port + "/" + safeName;
            case "SQLSERVER" -> "jdbc:sqlserver://" + host + ":" + port + ";databaseName=" + safeName + ";encrypt=false";
            default -> "jdbc:mysql://" + host + ":" + port + "/" + safeName + "?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Shanghai";
        };
    }

    /**
     * 生成缓存键
     */
    private String generateKey(String dbType, String host, int port, String dbName, String username) {
        return String.join("|", dbType, host, String.valueOf(port), dbName, username);
    }

    /**
     * 关闭所有数据源
     */
    public void closeAll() {
        dataSourceCache.forEach((key, ds) -> {
            try {
                ds.close();
                log.info("关闭数据源连接池: {}", key);
            } catch (Exception e) {
                log.error("关闭数据源失败: {}", key, e);
            }
        });
        dataSourceCache.clear();
    }
}
