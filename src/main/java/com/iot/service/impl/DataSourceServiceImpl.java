package com.iot.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.iot.entity.DataSource;
import com.iot.mapper.DataSourceMapper;
import com.iot.service.DataSourceService;
import org.springframework.stereotype.Service;

import java.sql.Connection;
import java.sql.DriverManager;
import java.util.HashMap;
import java.util.Map;

/**
 * 数据源服务实现类
 */
@Service
public class DataSourceServiceImpl extends ServiceImpl<DataSourceMapper, DataSource>
        implements DataSourceService {

    // 数据库类型到驱动类名的映射
    private static final Map<String, String> DRIVER_MAP = new HashMap<>();
    // 数据库类型到URL模板的映射
    private static final Map<String, String> URL_TEMPLATE_MAP = new HashMap<>();

    static {
        // SQL Server 2008
        DRIVER_MAP.put("sqlserver2008", "com.microsoft.sqlserver.jdbc.SQLServerDriver");
        URL_TEMPLATE_MAP.put("sqlserver2008", "jdbc:sqlserver://localhost:1433;databaseName=test;");
        
        // SQL Server 2008+
        DRIVER_MAP.put("sqlserver2008plus", "com.microsoft.sqlserver.jdbc.SQLServerDriver");
        URL_TEMPLATE_MAP.put("sqlserver2008plus", "jdbc:sqlserver://localhost:1433;databaseName=test;");
        
        // MySQL
        DRIVER_MAP.put("mysql", "com.mysql.cj.jdbc.Driver");
        URL_TEMPLATE_MAP.put("mysql", "jdbc:mysql://localhost:3306/test?useSSL=false&serverTimezone=UTC");
        
        // SQLite
        DRIVER_MAP.put("sqlite", "org.sqlite.JDBC");
        URL_TEMPLATE_MAP.put("sqlite", "jdbc:sqlite:data/test.db");
        
        // Oracle
        DRIVER_MAP.put("oracle", "oracle.jdbc.OracleDriver");
        URL_TEMPLATE_MAP.put("oracle", "jdbc:oracle:thin:@localhost:1521:ORCL");
        
        // PostgreSQL
        DRIVER_MAP.put("pg", "org.postgresql.Driver");
        URL_TEMPLATE_MAP.put("pg", "jdbc:postgresql://localhost:5432/test");
    }

    @Override
    public boolean testConnection(DataSource dataSource) {
        Connection connection = null;
        try {
            // 加载驱动
            Class.forName(dataSource.getDriverClass());
            // 建立连接
            connection = DriverManager.getConnection(
                    dataSource.getUrl(),
                    dataSource.getUsername(),
                    dataSource.getPassword()
            );
            return true;
        } catch (Exception e) {
            e.printStackTrace();
            return false;
        } finally {
            if (connection != null) {
                try {
                    connection.close();
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        }
    }

    @Override
    public String getDefaultDriverClass(String type) {
        return DRIVER_MAP.get(type);
    }

    @Override
    public String getDefaultUrlTemplate(String type) {
        return URL_TEMPLATE_MAP.get(type);
    }
}
