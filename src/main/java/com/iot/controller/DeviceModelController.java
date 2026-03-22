package com.iot.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.iot.entity.DeviceModel;
import com.iot.service.DeviceModelService;
import com.iot.util.R;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/device-models")
@RequiredArgsConstructor
public class DeviceModelController {

    private final DeviceModelService deviceModelService;

    @GetMapping
    public R<List<DeviceModel>> list() {
        try {
            return R.ok(deviceModelService.list());
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @GetMapping("/{id}")
    public R<DeviceModel> getById(@PathVariable Long id) {
        try {
            return R.ok(deviceModelService.getById(id));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @GetMapping("/by-category/{categoryId}")
    public R<List<DeviceModel>> listByCategory(@PathVariable Long categoryId) {
        try {
            LambdaQueryWrapper<DeviceModel> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(DeviceModel::getCategoryId, categoryId);
            return R.ok(deviceModelService.list(wrapper));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @PostMapping
    public R<Boolean> create(@RequestBody DeviceModel deviceModel) {
        try {
            return R.ok(deviceModelService.save(deviceModel));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @PutMapping("/{id}")
    public R<Boolean> update(@PathVariable Long id, @RequestBody DeviceModel deviceModel) {
        try {
            deviceModel.setId(id);
            return R.ok(deviceModelService.updateById(deviceModel));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    public R<Boolean> delete(@PathVariable Long id) {
        try {
            return R.ok(deviceModelService.removeById(id));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }
}
