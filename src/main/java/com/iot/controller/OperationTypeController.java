package com.iot.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.iot.entity.OperationType;
import com.iot.service.OperationTypeService;
import com.iot.util.R;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/operation-types")
@RequiredArgsConstructor
public class OperationTypeController {

    private final OperationTypeService operationTypeService;

    @GetMapping
    public R<List<OperationType>> list() {
        try {
            return R.ok(operationTypeService.list());
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @GetMapping("/{id}")
    public R<OperationType> getById(@PathVariable Long id) {
        try {
            return R.ok(operationTypeService.getById(id));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @GetMapping("/by-protocol/{protocolType}")
    public R<List<OperationType>> listByProtocol(@PathVariable String protocolType) {
        try {
            LambdaQueryWrapper<OperationType> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(OperationType::getProtocolType, protocolType);
            return R.ok(operationTypeService.list(wrapper));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @PostMapping
    public R<Boolean> create(@RequestBody OperationType operationType) {
        try {
            return R.ok(operationTypeService.save(operationType));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @PutMapping("/{id}")
    public R<Boolean> update(@PathVariable Long id, @RequestBody OperationType operationType) {
        try {
            operationType.setId(id);
            return R.ok(operationTypeService.updateById(operationType));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    public R<Boolean> delete(@PathVariable Long id) {
        try {
            return R.ok(operationTypeService.removeById(id));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }
}
