package com.iot.task.engine;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iot.entity.TaskFlowConfig;
import com.iot.service.TaskFlowConfigService;
import com.iot.task.model.FlowDefinition;
import com.iot.task.model.FlowJsonSupport;
import com.iot.task.model.FlowNode;
import com.iot.task.tcp.TcpTaskStartupValidator;
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
    private final TcpTaskStartupValidator tcpTaskStartupValidator;

    /** Running continuous flows: configId → runner info. */
    private final ConcurrentHashMap<Long, ContinuousRunner> runningFlows = new ConcurrentHashMap<>();
    /** Debug sessions: sessionId -> session state (in-memory, non-persistent). */
    private final ConcurrentHashMap<String, DebugSession> debugSessions = new ConcurrentHashMap<>();

    public FlowEngine(TaskFlowConfigService taskFlowConfigService,
                      FlowExecutor flowExecutor,
                      ObjectMapper objectMapper,
                      TcpTaskStartupValidator tcpTaskStartupValidator) {
        this.taskFlowConfigService = taskFlowConfigService;
        this.flowExecutor = flowExecutor;
        this.objectMapper = objectMapper;
        this.tcpTaskStartupValidator = tcpTaskStartupValidator;
    }

    // =================================================================
    //  Single execution (original)
    // =================================================================
    public FlowExecutionContext executeFlow(Long configId) {
        log.info("Starting flow execution for config id: {}", configId);
        return executeFlowInternal(configId, null);
    }

    public CompletableFuture<FlowExecutionContext> executeFlowAsync(Long configId) {
        return CompletableFuture.supplyAsync(() -> executeFlow(configId));
    }

    // =================================================================
    //  Debug execution (realtime logs in memory, no DB querying)
    // =================================================================
    public String startDebugSession(Long configId) {
        TaskFlowConfig config = taskFlowConfigService.getById(configId);
        if (config == null) {
            throw new RuntimeException("TaskFlowConfig not found with id: " + configId);
        }
        if (config.getFlowJson() == null || config.getFlowJson().isEmpty()) {
            throw new RuntimeException("Flow not configured yet");
        }

        String sessionId = UUID.randomUUID().toString();
        DebugSession session = new DebugSession(sessionId, configId);
        debugSessions.put(sessionId, session);

        CompletableFuture.runAsync(() -> runDebugSession(configId, sessionId));
        return sessionId;
    }

    public Map<String, Object> getDebugSessionLogs(Long configId, String sessionId, int offset) {
        DebugSession session = debugSessions.get(sessionId);
        if (session == null || !session.configId.equals(configId)) {
            throw new RuntimeException("Debug session not found");
        }

        int safeOffset = Math.max(offset, 0);
        List<ExecutionLogEntry> allLogs = session.context.getExecutionLog();
        int size = allLogs.size();
        int from = Math.min(safeOffset, size);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("sessionId", sessionId);
        resp.put("status", session.status);
        resp.put("logs", new ArrayList<>(allLogs.subList(from, size)));
        resp.put("nextOffset", size);
        resp.put("startedAt", session.startedAt.toString());
        resp.put("finishedAt", session.finishedAt != null ? session.finishedAt.toString() : null);
        // 调试界面需要在运行中也实时展示变量状态
        resp.put("variables", session.context.getVariables());
        return resp;
    }

    private void runDebugSession(Long configId, String sessionId) {
        DebugSession session = debugSessions.get(sessionId);
        if (session == null) {
            return;
        }
        try {
            FlowExecutionContext context = session.context;
            executeFlowInternal(configId, context);
            session.status = context.isCompleted() ? "SUCCESS" : "FAILED";
        } catch (Exception e) {
            session.context.addLog("ERROR", "执行异常: " + e.getMessage(), "SYSTEM", "Engine", null, null);
            session.status = "ERROR";
        } finally {
            session.finishedAt = LocalDateTime.now();
        }
    }

    private FlowExecutionContext executeFlowInternal(Long configId, FlowExecutionContext existingContext) {
        TaskFlowConfig config = taskFlowConfigService.getById(configId);
        if (config == null) {
            throw new RuntimeException("TaskFlowConfig not found with id: " + configId);
        }
        if (config.getFlowJson() == null || config.getFlowJson().isEmpty()) {
            throw new RuntimeException("Flow not configured yet");
        }

        try {
            FlowDefinition flowDefinition = FlowJsonSupport.parseFlowDefinition(config.getFlowJson(), objectMapper);

            FlowExecutionContext context = existingContext != null ? existingContext : new FlowExecutionContext();
            context.setFlowConfigId(String.valueOf(configId));
            context.setFlowName(config.getName());
            context.setFlowType(config.getFlowType());
            context.setExecutionMode(config.getExecutionMode());
            context.setContinuousExecution(false);

            if (flowDefinition.getVariables() != null) {
                for (Map<String, Object> variable : flowDefinition.getVariables()) {
                    String name = (String) variable.get("name");
                    Object defaultValue = variable.get("defaultValue");
                    if (name != null && defaultValue != null) {
                        context.setVariable(name, defaultValue);
                    }
                }
            }

            if ("EVENT".equals(config.getTriggerType())) {
                if (flowContainsInboundWaitNodes(flowDefinition)) {
                    context.addLog("INFO", "监听事务类任务启动，等待数据传入...", "SYSTEM", "Engine", null, null);
                } else {
                    context.addLog("INFO", "事件触发任务启动，立即执行流程（当前流程无「等待外部数据」类节点）", "SYSTEM", "Engine", null, null);
                }
            }

            tcpTaskStartupValidator.validateBeforeRun(config, flowDefinition);
            context.addLog("INFO", "Flow config loaded: " + config.getName(), "SYSTEM", "Engine", null, null);
            flowExecutor.execute(flowDefinition, context);

            config.setLastExecutionStatus(context.isCompleted() ? "SUCCESS" : "FAILED");
            config.setLastExecutionTime(LocalDateTime.now());
            taskFlowConfigService.updateById(config);
            log.info("Flow execution completed for config id: {}, status: {}", configId, config.getLastExecutionStatus());
            return context;
        } catch (Exception e) {
            log.error("Flow execution failed for config id: {}", configId, e);
            config.setLastExecutionStatus("ERROR");
            config.setLastExecutionTime(LocalDateTime.now());
            taskFlowConfigService.updateById(config);
            throw new RuntimeException("Flow execution failed: " + e.getMessage(), e);
        }
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

        try {
            FlowDefinition fd = FlowJsonSupport.parseFlowDefinition(config.getFlowJson(), objectMapper);
            tcpTaskStartupValidator.validateBeforeRun(config, fd);
        } catch (IllegalStateException e) {
            throw new RuntimeException(e.getMessage(), e);
        } catch (Exception e) {
            throw new RuntimeException("Failed to validate flow: " + e.getMessage(), e);
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

                FlowDefinition flowDefinition = FlowJsonSupport.parseFlowDefinition(config.getFlowJson(), objectMapper);

                FlowExecutionContext context = new FlowExecutionContext();
                context.setFlowConfigId(String.valueOf(runner.configId));
                context.setFlowName(config.getName());
                context.setFlowType(config.getFlowType());
                context.setExecutionMode(config.getExecutionMode());
                context.setContinuousExecution(true);

                if (flowDefinition.getVariables() != null) {
                    for (Map<String, Object> variable : flowDefinition.getVariables()) {
                        String name = (String) variable.get("name");
                        Object defaultValue = variable.get("defaultValue");
                        if (name != null && defaultValue != null) {
                            context.setVariable(name, defaultValue);
                        }
                    }
                }

                context.addLog("INFO", "[迭代 #" + runner.iterationCount + "] Flow config loaded: " + config.getName(), "SYSTEM", "Engine", null, null);
                flowExecutor.execute(flowDefinition, context);

                // Check if dedup filtered (not a real failure)
                Boolean dedupFiltered = (Boolean) context.getVariable("_dedupFiltered");
                if (Boolean.TRUE.equals(dedupFiltered)) {
                    runner.lastStatus = "FILTERED (dup)";
                } else {
                    runner.lastStatus = context.isCompleted() ? "SUCCESS" : "FAILED";
                }

                // Keep recent logs (last iteration only, capped)
                List<ExecutionLogEntry> logs = context.getExecutionLog();
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
                ExecutionLogEntry errLog = new ExecutionLogEntry();
                errLog.setTimestamp(java.time.LocalDateTime.now().toString());
                errLog.setLevel("ERROR");
                errLog.setMessage("[ERROR] " + e.getMessage());
                errLog.setActionType("SYSTEM");
                errLog.setNodeName("Engine");
                runner.recentLogs = List.of(errLog);
            }

            // Sleep between iterations
            if (!runner.stop) {
                try {
                    if (runner.intervalMs > 0) {
                        Thread.sleep(runner.intervalMs);
                    } else {
                        // 如果未设置间隔或间隔为 0，这实际上应该是一个单次执行，或者至少需要一个默认间隔以防止 CPU 100% 占用。
                        // 并且如果我们只希望按步骤单次执行（作为事务），那么不应该在这里一直循环。
                        Thread.sleep(1000); // 暂时加一个保护，但根本原因在业务逻辑触发
                    }
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
        volatile List<ExecutionLogEntry> recentLogs = List.of();
        Thread thread;

        ContinuousRunner(Long configId, String name, int intervalMs) {
            this.configId = configId;
            this.name = name;
            this.intervalMs = Math.max(intervalMs, 100); // minimum 100ms
        }
    }

    private static class DebugSession {
        final Long configId;
        final LocalDateTime startedAt = LocalDateTime.now();
        volatile LocalDateTime finishedAt;
        volatile String status = "RUNNING";
        volatile FlowExecutionContext context = new FlowExecutionContext();

        DebugSession(String sessionId, Long configId) {
            this.configId = configId;
        }
    }

    /**
     * 是否与「引擎先阻塞等待外部设备/客户端推数据」的语义相关（用于 EVENT 提示文案）。
     */
    static boolean flowContainsInboundWaitNodes(FlowDefinition flow) {
        if (flow == null || flow.getNodes() == null) {
            return false;
        }
        for (FlowNode n : flow.getNodes()) {
            if (n == null || n.getType() == null) {
                continue;
            }
            String type = n.getType();
            Map<String, Object> c = n.getConfig();
            switch (type) {
                case "TCP_SERVER" -> {
                    String op = c == null ? "START" : String.valueOf(c.getOrDefault("operation", "START"));
                    if ("RECEIVE".equalsIgnoreCase(op.trim())) {
                        return true;
                    }
                }
                case "TCP_LISTEN" -> {
                    return true;
                }
                case "TCP_CLIENT" -> {
                    if (c != null && truthyWaitResponse(c.get("waitResponse"))) {
                        return true;
                    }
                }
                case "TCP_SEND" -> {
                    // 设计器「TCP 发送」为主动下发，不视为「等待外部数据传入」类任务
                }
                default -> {
                }
            }
        }
        return false;
    }

    private static boolean truthyWaitResponse(Object v) {
        if (v == null) {
            return false;
        }
        if (v instanceof Boolean b) {
            return b;
        }
        return "true".equalsIgnoreCase(String.valueOf(v).trim());
    }
}
