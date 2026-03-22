package com.iot.controller;

import com.iot.entity.DataSource;
import com.iot.service.DataSourceService;
import com.iot.util.R;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 数据源控制器
 */
@RestController
@RequestMapping("/api/data-sources")
@RequiredArgsConstructor
public class DataSourceController {

    private final DataSourceService dataSourceService;

    /**
     * 获取所有数据源列表
     */
    @GetMapping
    public R<List<DataSource>> list() {
        try {
            return R.ok(dataSourceService.list());
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    /**
     * 根据ID获取数据源详情
     */
    @GetMapping("/{id}")
    public R<DataSource> getById(@PathVariable Long id) {
        try {
            return R.ok(dataSourceService.getById(id));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    /**
     * 创建新数据源
     */
    @PostMapping
    public R<Boolean> create(@RequestBody DataSource dataSource) {
        try {
            return R.ok(dataSourceService.save(dataSource));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    /**
     * 更新数据源
     */
    @PutMapping("/{id}")
    public R<Boolean> update(@PathVariable Long id, @RequestBody DataSource dataSource) {
        try {
            dataSource.setId(id);
            return R.ok(dataSourceService.updateById(dataSource));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    /**
     * 删除数据源
     */
    @DeleteMapping("/{id}")
    public R<Boolean> delete(@PathVariable Long id) {
        try {
            return R.ok(dataSourceService.removeById(id));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    /**
     * 测试数据源连接
     */
    @PostMapping("/test-connection")
    public R<Boolean> testConnection(@RequestBody DataSource dataSource) {
        try {
            boolean result = dataSourceService.testConnection(dataSource);
            return R.ok(result);
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    /**
     * 获取默认驱动类名
     */
    @GetMapping("/default-driver/{type}")
    public R<String> getDefaultDriverClass(@PathVariable String type) {
        try {
            String driverClass = dataSourceService.getDefaultDriverClass(type);
            return R.ok(driverClass);
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    /**
     * 获取默认URL模板
     */
    @GetMapping("/default-url/{type}")
    public R<String> getDefaultUrlTemplate(@PathVariable String type) {
        try {
            String urlTemplate = dataSourceService.getDefaultUrlTemplate(type);
            return R.ok(urlTemplate);
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }
}
