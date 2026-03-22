package com.iot.controller;

import com.iot.entity.DataBridge;
import com.iot.service.DataBridgeService;
import com.iot.util.R;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/data-bridges")
@RequiredArgsConstructor
public class DataBridgeController {

    private final DataBridgeService dataBridgeService;

    @GetMapping
    public R<List<DataBridge>> list() {
        try {
            return R.ok(dataBridgeService.list());
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @GetMapping("/{id}")
    public R<DataBridge> getById(@PathVariable Long id) {
        try {
            return R.ok(dataBridgeService.getById(id));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @PostMapping
    public R<Boolean> create(@RequestBody DataBridge dataBridge) {
        try {
            return R.ok(dataBridgeService.save(dataBridge));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @PutMapping("/{id}")
    public R<Boolean> update(@PathVariable Long id, @RequestBody DataBridge dataBridge) {
        try {
            dataBridge.setId(id);
            return R.ok(dataBridgeService.updateById(dataBridge));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    public R<Boolean> delete(@PathVariable Long id) {
        try {
            return R.ok(dataBridgeService.removeById(id));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }
}
