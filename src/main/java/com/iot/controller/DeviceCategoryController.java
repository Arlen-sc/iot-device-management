package com.iot.controller;

import com.iot.entity.DeviceCategory;
import com.iot.service.DeviceCategoryService;
import com.iot.util.R;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/device-categories")
@RequiredArgsConstructor
public class DeviceCategoryController {

    private final DeviceCategoryService deviceCategoryService;

    @GetMapping
    public R<List<DeviceCategory>> list() {
        try {
            return R.ok(deviceCategoryService.list());
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @GetMapping("/tree")
    public R<List<DeviceCategory>> tree() {
        try {
            return R.ok(deviceCategoryService.getTree());
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @GetMapping("/{id}")
    public R<DeviceCategory> getById(@PathVariable Long id) {
        try {
            return R.ok(deviceCategoryService.getById(id));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @PostMapping
    public R<Boolean> create(@RequestBody DeviceCategory deviceCategory) {
        try {
            return R.ok(deviceCategoryService.save(deviceCategory));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @PutMapping("/{id}")
    public R<Boolean> update(@PathVariable Long id, @RequestBody DeviceCategory deviceCategory) {
        try {
            deviceCategory.setId(id);
            return R.ok(deviceCategoryService.updateById(deviceCategory));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    public R<Boolean> delete(@PathVariable Long id) {
        try {
            return R.ok(deviceCategoryService.removeById(id));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }
}
