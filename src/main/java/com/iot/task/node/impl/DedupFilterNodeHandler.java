package com.iot.task.node.impl;

import com.iot.task.engine.FlowExecutionContext;
import com.iot.task.model.FlowNode;
import com.iot.task.node.NodeHandler;
import com.iot.task.node.NodeResult;
import com.iot.util.VariablePathUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * DEDUP_FILTER node - filters duplicate values within a configurable time window.
 *
 * Maintains a static in-memory cache (survives across flow executions).
 * If the same value is seen within the TTL window, the flow stops (returns
 * an empty branch so no downstream nodes execute).
 *
 * Config fields:
 *   inputVariable  - variable to check for duplicates (default "tcpData")
 *   ttlSeconds     - how long to remember a value   (default 60)
 *   cacheKey       - optional namespace to isolate different dedup caches
 */
@Slf4j
@Component
public class DedupFilterNodeHandler implements NodeHandler {

    /**
     * Global dedup cache:  key = "namespace:value"  →  timestamp (millis).
     */
    private static final ConcurrentHashMap<String, Long> CACHE = new ConcurrentHashMap<>();

    /** Periodic cleanup counter – lightweight housekeeping. */
    private static long lastCleanup = System.currentTimeMillis();
    private static final long CLEANUP_INTERVAL_MS = 60_000;

    @Override
    public String getType() {
        return "DEDUP_FILTER";
    }

    @Override
    public NodeResult execute(FlowNode node, FlowExecutionContext context) {
        try {
            Map<String, Object> config = node.getConfig();
            if (config == null) config = Map.of();

            String inputVar = (String) config.getOrDefault("inputVariable", "tcpData");
            int ttlSeconds = toInt(config.get("ttlSeconds"), 60);
            String cacheKey = (String) config.getOrDefault("cacheKey", "default");

            Object rawValue = VariablePathUtils.getValue(context.getVariables(), inputVar);
            String value = rawValue != null ? rawValue.toString() : "";

            if (value.isBlank()) {
                context.addLog("DEDUP_FILTER: input variable '" + inputVar + "' is empty, passing through");
                return NodeResult.ok();
            }

            String key = cacheKey + ":" + value;
            long now = System.currentTimeMillis();
            long ttlMs = ttlSeconds * 1000L;

            // Periodic cleanup of expired entries
            cleanupIfNeeded(now);

            Long lastSeen = CACHE.get(key);
            if (lastSeen != null && (now - lastSeen) < ttlMs) {
                // Duplicate detected within TTL
                long ageSec = (now - lastSeen) / 1000;
                log.info("DEDUP_FILTER node '{}': duplicate detected for '{}' (seen {}s ago), skipping",
                        node.getName(), abbreviate(value, 40), ageSec);
                context.addLog("DEDUP_FILTER: 重复数据已过滤 '" + abbreviate(value, 60) +
                        "' (" + ageSec + "秒前已处理)");
                context.setVariable("_dedupFiltered", true);
                context.setCompleted(true);   // gracefully end this iteration
                return NodeResult.ok("duplicate");
            }

            // New value – record it and pass through
            CACHE.put(key, now);
            log.info("DEDUP_FILTER node '{}': new value '{}', passing through",
                    node.getName(), abbreviate(value, 40));
            context.addLog("DEDUP_FILTER: 新数据通过 '" + abbreviate(value, 60) + "'");
            context.setVariable("_dedupFiltered", false);

            return NodeResult.ok(value);
        } catch (Exception e) {
            log.error("DEDUP_FILTER node '{}' failed: {}", node.getName(), e.getMessage(), e);
            context.addLog("DEDUP_FILTER error: " + e.getMessage());
            return NodeResult.error("DEDUP_FILTER failed: " + e.getMessage());
        }
    }

    private void cleanupIfNeeded(long now) {
        if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
        lastCleanup = now;
        // Remove entries older than 10 minutes (absolute max)
        long maxAge = 600_000L;
        CACHE.entrySet().removeIf(e -> (now - e.getValue()) > maxAge);
    }

    private static int toInt(Object obj, int def) {
        if (obj instanceof Number n) return n.intValue();
        if (obj instanceof String s) {
            try { return Integer.parseInt(s); } catch (Exception ignored) {}
        }
        return def;
    }

    private static String abbreviate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "...";
    }
}
