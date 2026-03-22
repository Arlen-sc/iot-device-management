package com.iot.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.iot.entity.AlertConfig;
import com.iot.entity.AlertRecord;
import com.iot.mapper.AlertRecordMapper;
import com.iot.service.AlertService;
import com.iot.util.R;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/alerts")
@RequiredArgsConstructor
public class AlertController {

    private final AlertService alertService;
    private final AlertRecordMapper alertRecordMapper;

    @GetMapping("/configs")
    public R<List<AlertConfig>> listConfigs() {
        try {
            return R.ok(alertService.list());
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @GetMapping("/configs/{id}")
    public R<AlertConfig> getConfigById(@PathVariable Long id) {
        try {
            return R.ok(alertService.getById(id));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @PostMapping("/configs")
    public R<Boolean> createConfig(@RequestBody AlertConfig alertConfig) {
        try {
            return R.ok(alertService.save(alertConfig));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @PutMapping("/configs/{id}")
    public R<Boolean> updateConfig(@PathVariable Long id, @RequestBody AlertConfig alertConfig) {
        try {
            alertConfig.setId(id);
            return R.ok(alertService.updateById(alertConfig));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @DeleteMapping("/configs/{id}")
    public R<Boolean> deleteConfig(@PathVariable Long id) {
        try {
            return R.ok(alertService.removeById(id));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @GetMapping("/records")
    public R<List<AlertRecord>> listRecords() {
        try {
            return R.ok(alertRecordMapper.selectList(null));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @GetMapping("/records/by-device/{deviceId}")
    public R<List<AlertRecord>> listRecordsByDevice(@PathVariable Long deviceId) {
        try {
            LambdaQueryWrapper<AlertRecord> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(AlertRecord::getDeviceId, deviceId);
            return R.ok(alertRecordMapper.selectList(wrapper));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }
}
