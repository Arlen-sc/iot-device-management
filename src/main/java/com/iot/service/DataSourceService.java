package com.iot.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.iot.entity.DataSource;

/**
 * 数据源服务接口
 */
public interface DataSourceService extends IService<DataSource> {

    /**
     * 测试数据源连接
     * @param dataSource 数据源配置
     * @return 连接是否成功
     */
    boolean testConnection(DataSource dataSource);

    /**
     * 根据类型获取默认驱动类名
     * @param type 数据库类型
     * @return 驱动类名
     */
    String getDefaultDriverClass(String type);

    /**
     * 根据类型获取默认连接URL模板
     * @param type 数据库类型
     * @return URL模板
     */
    String getDefaultUrlTemplate(String type);
}
