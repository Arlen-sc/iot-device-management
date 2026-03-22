package com.iot.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.iot.entity.Device;
import com.iot.service.DeviceService;
import com.iot.util.R;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/devices")
@RequiredArgsConstructor
public class DeviceController {

    private final DeviceService deviceService;

    @GetMapping
    public R<List<Device>> list() {
        try {
            return R.ok(deviceService.list());
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @GetMapping("/{id}")
    public R<Device> getById(@PathVariable Long id) {
        try {
            return R.ok(deviceService.getById(id));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @GetMapping("/by-status/{status}")
    public R<List<Device>> listByStatus(@PathVariable Integer status) {
        try {
            LambdaQueryWrapper<Device> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(Device::getStatus, status);
            return R.ok(deviceService.list(wrapper));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @PostMapping
    public R<Boolean> create(@RequestBody Device device) {
        try {
            return R.ok(deviceService.save(device));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @PutMapping("/{id}")
    public R<Boolean> update(@PathVariable Long id, @RequestBody Device device) {
        try {
            device.setId(id);
            return R.ok(deviceService.updateById(device));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    public R<Boolean> delete(@PathVariable Long id) {
        try {
            return R.ok(deviceService.removeById(id));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }
}
