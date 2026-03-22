package com.iot.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.iot.entity.FlowExecutionLog;
import com.iot.service.FlowExecutionLogService;
import com.iot.util.R;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Controller for querying flow execution logs stored in SQLite.
 */
@RestController
@RequestMapping("/api/flow-logs")
public class FlowExecutionLogController {

    private final FlowExecutionLogService flowExecutionLogService;

    public FlowExecutionLogController(FlowExecutionLogService flowExecutionLogService) {
        this.flowExecutionLogService = flowExecutionLogService;
    }

    /**
     * Get all logs, ordered by creation time desc.
     */
    @GetMapping
    public R<?> list(@RequestParam(required = false) String flowConfigId,
                     @RequestParam(required = false) String level,
                     @RequestParam(defaultValue = "100") int limit) {
        LambdaQueryWrapper<FlowExecutionLog> wrapper = new LambdaQueryWrapper<>();
        if (flowConfigId != null && !flowConfigId.isEmpty()) {
            wrapper.eq(FlowExecutionLog::getFlowConfigId, Long.valueOf(flowConfigId));
        }
        if (level != null && !level.isEmpty()) {
            wrapper.eq(FlowExecutionLog::getLevel, level.toUpperCase());
        }
        wrapper.orderByDesc(FlowExecutionLog::getCreatedAt);
        wrapper.last("LIMIT " + limit);
        List<FlowExecutionLog> logs = flowExecutionLogService.list(wrapper);
        return R.ok(logs);
    }

    /**
     * Get logs for a specific flow config.
     */
    @GetMapping("/{flowConfigId}")
    public R<?> getByFlowConfig(@PathVariable Long flowConfigId,
                                 @RequestParam(defaultValue = "100") int limit) {
        LambdaQueryWrapper<FlowExecutionLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(FlowExecutionLog::getFlowConfigId, flowConfigId);
        wrapper.orderByDesc(FlowExecutionLog::getCreatedAt);
        wrapper.last("LIMIT " + limit);
        return R.ok(flowExecutionLogService.list(wrapper));
    }

    /**
     * Clear all logs.
     */
    @DeleteMapping
    public R<?> clearAll() {
        flowExecutionLogService.remove(new LambdaQueryWrapper<>());
        return R.ok("All flow execution logs cleared");
    }

    /**
     * Clear logs for a specific flow config.
     */
    @DeleteMapping("/{flowConfigId}")
    public R<?> clearByFlowConfig(@PathVariable Long flowConfigId) {
        LambdaQueryWrapper<FlowExecutionLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(FlowExecutionLog::getFlowConfigId, flowConfigId);
        flowExecutionLogService.remove(wrapper);
        return R.ok("Logs cleared for flow config " + flowConfigId);
    }
}
