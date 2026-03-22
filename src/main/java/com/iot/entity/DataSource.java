package com.iot.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 数据源实体类
 * 支持多种数据库类型：SQL Server 2008、SQL Server 2008+、MySQL、SQLite、Oracle、PostgreSQL等
 */
@Data
@TableName("data_source")
public class DataSource {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    /**
     * 数据源名称
     */
    private String name;

    /**
     * 数据库类型
     * 可选值：sqlserver2008, sqlserver2008plus, mysql, sqlite, oracle, pg
     */
    private String type;

    /**
     * 连接URL
     */
    private String url;

    /**
     * 用户名
     */
    private String username;

    /**
     * 密码
     */
    private String password;

    /**
     * 驱动类名
     */
    private String driverClass;

    /**
     * 状态：0-禁用，1-启用
     */
    private Integer status;

    /**
     * 创建时间
     */
    private LocalDateTime createdAt;

    /**
     * 更新时间
     */
    private LocalDateTime updatedAt;
}
