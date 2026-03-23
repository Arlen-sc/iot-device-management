package com.iot.controller;

import com.iot.entity.TaskFlowConfig;
import com.iot.service.TaskFlowConfigService;
import com.iot.task.engine.FlowEngine;
import com.iot.util.R;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/task-flow-configs")
@RequiredArgsConstructor
public class TaskFlowConfigController {

    private final TaskFlowConfigService taskFlowConfigService;
    private final FlowEngine flowEngine;

    @GetMapping
    public R<List<TaskFlowConfig>> list() {
        try {
            return R.ok(taskFlowConfigService.list());
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @GetMapping("/{id}")
    public R<TaskFlowConfig> getById(@PathVariable Long id) {
        try {
            return R.ok(taskFlowConfigService.getById(id));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @PostMapping
    public R<Boolean> create(@RequestBody TaskFlowConfig taskFlowConfig) {
        try {
            return R.ok(taskFlowConfigService.save(taskFlowConfig));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @PutMapping("/{id}")
    public R<Boolean> update(@PathVariable Long id, @RequestBody TaskFlowConfig taskFlowConfig) {
        try {
            TaskFlowConfig existing = taskFlowConfigService.getById(id);
            if (existing == null) {
                return R.error("Task flow config not found");
            }
            // Merge: only update non-null fields from the request
            if (taskFlowConfig.getName() != null) existing.setName(taskFlowConfig.getName());
            if (taskFlowConfig.getDescription() != null) existing.setDescription(taskFlowConfig.getDescription());
            if (taskFlowConfig.getFlowType() != null) existing.setFlowType(taskFlowConfig.getFlowType());
            if (taskFlowConfig.getTriggerType() != null) existing.setTriggerType(taskFlowConfig.getTriggerType());
            if (taskFlowConfig.getExecutionMode() != null) existing.setExecutionMode(taskFlowConfig.getExecutionMode());
            if (taskFlowConfig.getCronExpression() != null) existing.setCronExpression(taskFlowConfig.getCronExpression());
            if (taskFlowConfig.getStartNodeConfig() != null) existing.setStartNodeConfig(taskFlowConfig.getStartNodeConfig());
            if (taskFlowConfig.getFlowJson() != null) existing.setFlowJson(taskFlowConfig.getFlowJson());
            if (taskFlowConfig.getStatus() != null) existing.setStatus(taskFlowConfig.getStatus());
            return R.ok(taskFlowConfigService.updateById(existing));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    public R<Boolean> delete(@PathVariable Long id) {
        try {
            return R.ok(taskFlowConfigService.removeById(id));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @PostMapping("/{id}/execute")
    public R<?> execute(@PathVariable Long id) {
        try {
            TaskFlowConfig config = taskFlowConfigService.getById(id);
            if (config == null) {
                return R.error("Task flow config not found");
            }
            if (config.getFlowJson() == null || config.getFlowJson().isEmpty()) {
                return R.error("Flow not configured yet");
            }
            var context = flowEngine.executeFlow(id);
            Map<String, Object> result = new java.util.HashMap<>();
            result.put("status", context.isCompleted() ? "SUCCESS" : "FAILED");
            result.put("logs", context.getExecutionLog());
            result.put("variables", context.getVariables());
            return R.ok(result);
        } catch (Exception e) {
            return R.error("Execution failed: " + e.getMessage());
        }
    }

    @PostMapping("/{id}/debug/start")
    public R<?> startDebug(@PathVariable Long id) {
        try {
            String sessionId = flowEngine.startDebugSession(id);
            return R.ok(Map.of("sessionId", sessionId));
        } catch (Exception e) {
            return R.error("Start debug failed: " + e.getMessage());
        }
    }

    @GetMapping("/{id}/debug/{sessionId}/logs")
    public R<?> getDebugLogs(@PathVariable Long id,
                             @PathVariable String sessionId,
                             @RequestParam(defaultValue = "0") int offset) {
        try {
            return R.ok(flowEngine.getDebugSessionLogs(id, sessionId, offset));
        } catch (Exception e) {
            return R.error("Get debug logs failed: " + e.getMessage());
        }
    }

    @PostMapping("/{id}/start")
    public R<?> startContinuous(@PathVariable Long id,
                                @RequestParam(defaultValue = "1000") int interval) {
        try {
            var result = flowEngine.startContinuousFlow(id, interval);
            return R.ok(result);
        } catch (Exception e) {
            return R.error("Start failed: " + e.getMessage());
        }
    }

    @PostMapping("/{id}/stop")
    public R<?> stopContinuous(@PathVariable Long id) {
        try {
            var result = flowEngine.stopContinuousFlow(id);
            return R.ok(result);
        } catch (Exception e) {
            return R.error("Stop failed: " + e.getMessage());
        }
    }

    @GetMapping("/running")
    public R<?> getRunningFlows() {
        try {
            return R.ok(flowEngine.getRunningFlows());
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }

    @GetMapping("/{id}/running")
    public R<?> isRunning(@PathVariable Long id) {
        try {
            boolean running = flowEngine.isRunning(id);
            return R.ok(Map.of("running", running));
        } catch (Exception e) {
            return R.error(e.getMessage());
        }
    }
}
