package com.iot.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.iot.entity.DataSource;
import com.iot.mapper.DataSourceMapper;
import com.iot.service.DataSourceService;
import com.iot.util.EncryptionUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.sql.Connection;
import java.sql.DriverManager;
import java.util.HashMap;
import java.util.Map;

/**
 * 数据源服务实现类
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DataSourceServiceImpl extends ServiceImpl<DataSourceMapper, DataSource>
        implements DataSourceService {

    private final EncryptionUtil encryptionUtil;

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

    /**
     * 保存数据源信息，对密码进行加密处理
     * @param entity 数据源实体
     * @return 保存是否成功
     */
    @Override
    public boolean save(DataSource entity) {
        if (entity.getPassword() != null && !entity.getPassword().isEmpty()) {
            entity.setPassword(encryptionUtil.encrypt(entity.getPassword()));
        }
        return super.save(entity);
    }

    /**
     * 更新数据源信息，对密码进行加密处理
     * @param entity 数据源实体
     * @return 更新是否成功
     */
    @Override
    public boolean updateById(DataSource entity) {
        if (entity.getPassword() != null && !entity.getPassword().isEmpty() 
            && !encryptionUtil.isEncrypted(entity.getPassword())) {
            entity.setPassword(encryptionUtil.encrypt(entity.getPassword()));
        }
        return super.updateById(entity);
    }

    /**
     * 根据ID获取数据源信息，密码显示为星号
     * @param id 数据源ID
     * @return 数据源实体
     */
    public DataSource getById(Long id) {
        DataSource dataSource = super.getById(id);
        if (dataSource != null && dataSource.getPassword() != null) {
            dataSource.setPassword("******");
        }
        return dataSource;
    }

    /**
     * 测试数据源连接
     * @param dataSource 数据源配置
     * @return 连接是否成功
     */
    @Override
    public boolean testConnection(DataSource dataSource) {
        Connection connection = null;
        try {
            String password = dataSource.getPassword();
            if (password != null && encryptionUtil.isEncrypted(password)) {
                password = encryptionUtil.decrypt(password);
            }
            
            Class.forName(dataSource.getDriverClass());
            connection = DriverManager.getConnection(
                    dataSource.getUrl(),
                    dataSource.getUsername(),
                    password
            );
            return true;
        } catch (Exception e) {
            log.error("测试数据源连接失败: {}", e.getMessage());
            return false;
        } finally {
            if (connection != null) {
                try {
                    connection.close();
                } catch (Exception e) {
                    log.error("关闭连接失败", e);
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
