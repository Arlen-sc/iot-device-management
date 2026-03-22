package com.iot.task.engine;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iot.entity.TaskFlowConfig;
import com.iot.service.TaskFlowConfigService;
import com.iot.task.model.FlowDefinition;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.*;

@Slf4j
@Service
public class FlowEngine {

    private final TaskFlowConfigService taskFlowConfigService;
    private final FlowExecutor flowExecutor;
    private final ObjectMapper objectMapper;

    /** Running continuous flows: configId → runner info. */
    private final ConcurrentHashMap<Long, ContinuousRunner> runningFlows = new ConcurrentHashMap<>();

    public FlowEngine(TaskFlowConfigService taskFlowConfigService,
                      FlowExecutor flowExecutor,
                      ObjectMapper objectMapper) {
        this.taskFlowConfigService = taskFlowConfigService;
        this.flowExecutor = flowExecutor;
        this.objectMapper = objectMapper;
    }

    // =================================================================
    //  Single execution (original)
    // =================================================================
    public FlowExecutionContext executeFlow(Long configId) {
        log.info("Starting flow execution for config id: {}", configId);

        TaskFlowConfig config = taskFlowConfigService.getById(configId);
        if (config == null) {
            throw new RuntimeException("TaskFlowConfig not found with id: " + configId);
        }

        try {
            FlowDefinition flowDefinition = objectMapper.readValue(config.getFlowJson(), FlowDefinition.class);

            FlowExecutionContext context = new FlowExecutionContext();
            context.setFlowConfigId(String.valueOf(configId));
            context.setFlowName(config.getName());

            if (flowDefinition.getVariables() != null) {
                for (Map<String, Object> variable : flowDefinition.getVariables()) {
                    String name = (String) variable.get("name");
                    Object defaultValue = variable.get("defaultValue");
                    if (name != null && defaultValue != null) {
                        context.setVariable(name, defaultValue);
                    }
                }
            }

            context.addLog("Flow config loaded: " + config.getName());
            flowExecutor.execute(flowDefinition, context);

            config.setLastExecutionStatus(context.isCompleted() ? "SUCCESS" : "FAILED");
            config.setLastExecutionTime(LocalDateTime.now());
            taskFlowConfigService.updateById(config);

            log.info("Flow execution completed for config id: {}, status: {}",
                    configId, config.getLastExecutionStatus());

            return context;
        } catch (Exception e) {
            log.error("Flow execution failed for config id: {}", configId, e);
            config.setLastExecutionStatus("ERROR");
            config.setLastExecutionTime(LocalDateTime.now());
            taskFlowConfigService.updateById(config);
            throw new RuntimeException("Flow execution failed: " + e.getMessage(), e);
        }
    }

    public CompletableFuture<FlowExecutionContext> executeFlowAsync(Long configId) {
        return CompletableFuture.supplyAsync(() -> executeFlow(configId));
    }

    // =================================================================
    //  Continuous execution (start / stop)
    // =================================================================

    /**
     * Start a continuous flow that loops until stopped.
     * Each iteration: execute full flow, sleep intervalMs, repeat.
     * @return summary info
     */
    public Map<String, Object> startContinuousFlow(Long configId, int intervalMs) {
        if (runningFlows.containsKey(configId)) {
            return Map.of("status", "ALREADY_RUNNING",
                    "message", "Flow " + configId + " is already running");
        }

        TaskFlowConfig config = taskFlowConfigService.getById(configId);
        if (config == null) {
            throw new RuntimeException("TaskFlowConfig not found with id: " + configId);
        }
        if (config.getFlowJson() == null || config.getFlowJson().isEmpty()) {
            throw new RuntimeException("Flow not configured yet");
        }

        ContinuousRunner runner = new ContinuousRunner(configId, config.getName(), intervalMs);
        runningFlows.put(configId, runner);

        Thread thread = new Thread(() -> runContinuousLoop(runner), "flow-" + configId);
        thread.setDaemon(true);
        runner.thread = thread;
        thread.start();

        config.setLastExecutionStatus("RUNNING");
        config.setLastExecutionTime(LocalDateTime.now());
        taskFlowConfigService.updateById(config);

        log.info("Continuous flow started: {} (interval={}ms)", config.getName(), intervalMs);
        return Map.of("status", "STARTED",
                "message", "Flow '" + config.getName() + "' started (interval=" + intervalMs + "ms)");
    }

    /**
     * Stop a continuously running flow.
     */
    public Map<String, Object> stopContinuousFlow(Long configId) {
        ContinuousRunner runner = runningFlows.remove(configId);
        if (runner == null) {
            return Map.of("status", "NOT_RUNNING",
                    "message", "Flow " + configId + " is not running");
        }

        runner.stop = true;
        if (runner.thread != null) {
            runner.thread.interrupt();
        }

        TaskFlowConfig config = taskFlowConfigService.getById(configId);
        if (config != null) {
            config.setLastExecutionStatus("STOPPED");
            config.setLastExecutionTime(LocalDateTime.now());
            taskFlowConfigService.updateById(config);
        }

        log.info("Continuous flow stopped: {} (iterations={})", runner.name, runner.iterationCount);
        return Map.of("status", "STOPPED",
                "iterations", runner.iterationCount,
                "message", "Flow '" + runner.name + "' stopped after " + runner.iterationCount + " iterations");
    }

    /**
     * Get status of all running flows.
     */
    public List<Map<String, Object>> getRunningFlows() {
        List<Map<String, Object>> list = new ArrayList<>();
        runningFlows.forEach((id, runner) -> {
            Map<String, Object> info = new LinkedHashMap<>();
            info.put("configId", String.valueOf(id));
            info.put("name", runner.name);
            info.put("intervalMs", runner.intervalMs);
            info.put("iterations", runner.iterationCount);
            info.put("startTime", runner.startTime.toString());
            info.put("lastIterationTime", runner.lastIterationTime != null ? runner.lastIterationTime.toString() : null);
            info.put("lastStatus", runner.lastStatus);
            info.put("recentLogs", runner.recentLogs);
            list.add(info);
        });
        return list;
    }

    public boolean isRunning(Long configId) {
        return runningFlows.containsKey(configId);
    }

    // =================================================================
    //  Continuous loop implementation
    // =================================================================
    private void runContinuousLoop(ContinuousRunner runner) {
        log.info("Continuous loop starting for flow: {}", runner.name);

        while (!runner.stop) {
            runner.iterationCount++;
            runner.lastIterationTime = LocalDateTime.now();

            try {
                // Re-read config each iteration (in case flow was edited)
                TaskFlowConfig config = taskFlowConfigService.getById(runner.configId);
                if (config == null || config.getFlowJson() == null) {
                    runner.lastStatus = "ERROR: config not found";
                    break;
                }

                FlowDefinition flowDefinition = objectMapper.readValue(config.getFlowJson(), FlowDefinition.class);

                FlowExecutionContext context = new FlowExecutionContext();
                context.setFlowConfigId(String.valueOf(runner.configId));

                if (flowDefinition.getVariables() != null) {
                    for (Map<String, Object> variable : flowDefinition.getVariables()) {
                        String name = (String) variable.get("name");
                        Object defaultValue = variable.get("defaultValue");
                        if (name != null && defaultValue != null) {
                            context.setVariable(name, defaultValue);
                        }
                    }
                }

                context.addLog("[迭代 #" + runner.iterationCount + "] Flow config loaded: " + config.getName());
                flowExecutor.execute(flowDefinition, context);

                // Check if dedup filtered (not a real failure)
                Boolean dedupFiltered = (Boolean) context.getVariable("_dedupFiltered");
                if (Boolean.TRUE.equals(dedupFiltered)) {
                    runner.lastStatus = "FILTERED (dup)";
                } else {
                    runner.lastStatus = context.isCompleted() ? "SUCCESS" : "FAILED";
                }

                // Keep recent logs (last iteration only, capped)
                List<String> logs = context.getExecutionLog();
                runner.recentLogs = logs.size() > 20 ? logs.subList(logs.size() - 20, logs.size()) : logs;

                // Update DB status periodically (every 10 iterations)
                if (runner.iterationCount % 10 == 0) {
                    config.setLastExecutionStatus("RUNNING (#" + runner.iterationCount + ")");
                    config.setLastExecutionTime(LocalDateTime.now());
                    taskFlowConfigService.updateById(config);
                }

            } catch (Exception e) {
                log.error("Continuous flow iteration #{} failed for {}: {}",
                        runner.iterationCount, runner.name, e.getMessage());
                runner.lastStatus = "ERROR: " + e.getMessage();
                runner.recentLogs = List.of("[ERROR] " + e.getMessage());
            }

            // Sleep between iterations
            if (!runner.stop) {
                try {
                    Thread.sleep(runner.intervalMs);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }

        // Cleanup
        runningFlows.remove(runner.configId);
        log.info("Continuous loop ended for flow: {} (iterations={})", runner.name, runner.iterationCount);
    }

    // =================================================================
    //  Runner state holder
    // =================================================================
    private static class ContinuousRunner {
        final Long configId;
        final String name;
        final int intervalMs;
        final LocalDateTime startTime = LocalDateTime.now();
        volatile boolean stop = false;
        volatile int iterationCount = 0;
        volatile LocalDateTime lastIterationTime;
        volatile String lastStatus = "STARTING";
        volatile List<String> recentLogs = List.of();
        Thread thread;

        ContinuousRunner(Long configId, String name, int intervalMs) {
            this.configId = configId;
            this.name = name;
            this.intervalMs = Math.max(intervalMs, 100); // minimum 100ms
        }
    }
}
