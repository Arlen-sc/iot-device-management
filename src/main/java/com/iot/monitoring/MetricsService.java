package com.iot.monitoring;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 监控指标服务
 * 提供 Prometheus 指标收集功能
 */
@Slf4j
@Service
public class MetricsService {
    
    private final MeterRegistry meterRegistry;
    
    private final Map<String, Counter> counters = new ConcurrentHashMap<>();
    private final Map<String, Timer> timers = new ConcurrentHashMap<>();
    private final Map<String, AtomicInteger> gaugeValues = new ConcurrentHashMap<>();
    private final Map<String, AtomicLong> longGaugeValues = new ConcurrentHashMap<>();
    
    public MetricsService(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }
    
    @PostConstruct
    public void init() {
        log.info("MetricsService initialized");
    }
    
    /**
     * 记录计数器
     */
    public void incrementCounter(String name, String... tags) {
        Counter counter = getOrCreateCounter(name, tags);
        counter.increment();
    }
    
    /**
     * 增加指定数值
     */
    public void incrementCounter(String name, double amount, String... tags) {
        Counter counter = getOrCreateCounter(name, tags);
        counter.increment(amount);
    }
    
    private Counter getOrCreateCounter(String name, String... tags) {
        String key = buildKey(name, tags);
        return counters.computeIfAbsent(key, k -> {
            Counter.Builder builder = Counter.builder(name);
            for (int i = 0; i < tags.length; i += 2) {
                if (i + 1 < tags.length) {
                    builder.tag(tags[i], tags[i + 1]);
                }
            }
            return builder.register(meterRegistry);
        });
    }
    
    /**
     * 记录计时器
     */
    public Timer.Sample startTimer() {
        return Timer.start(meterRegistry);
    }
    
    public void recordTimer(Timer.Sample sample, String name, String... tags) {
        Timer timer = getOrCreateTimer(name, tags);
        sample.stop(timer);
    }
    
    public void recordTimer(String name, Runnable runnable, String... tags) {
        Timer timer = getOrCreateTimer(name, tags);
        timer.record(runnable);
    }
    
    private Timer getOrCreateTimer(String name, String... tags) {
        String key = buildKey(name, tags);
        return timers.computeIfAbsent(key, k -> {
            Timer.Builder builder = Timer.builder(name);
            for (int i = 0; i < tags.length; i += 2) {
                if (i + 1 < tags.length) {
                    builder.tag(tags[i], tags[i + 1]);
                }
            }
            return builder.register(meterRegistry);
        });
    }
    
    /**
     * 设置仪表盘
     */
    public void setGauge(String name, int value, String... tags) {
        String key = buildKey(name, tags);
        AtomicInteger gaugeValue = gaugeValues.computeIfAbsent(key, k -> {
            AtomicInteger atomic = new AtomicInteger(0);
            Gauge.Builder<AtomicInteger> builder = Gauge.builder(name, atomic, AtomicInteger::get);
            for (int i = 0; i < tags.length; i += 2) {
                if (i + 1 < tags.length) {
                    builder.tag(tags[i], tags[i + 1]);
                }
            }
            builder.register(meterRegistry);
            return atomic;
        });
        gaugeValue.set(value);
    }
    
    public void setGauge(String name, long value, String... tags) {
        String key = buildKey(name, tags);
        AtomicLong gaugeValue = longGaugeValues.computeIfAbsent(key, k -> {
            AtomicLong atomic = new AtomicLong(0);
            Gauge.Builder<AtomicLong> builder = Gauge.builder(name, atomic, AtomicLong::get);
            for (int i = 0; i < tags.length; i += 2) {
                if (i + 1 < tags.length) {
                    builder.tag(tags[i], tags[i + 1]);
                }
            }
            builder.register(meterRegistry);
            return atomic;
        });
        gaugeValue.set(value);
    }
    
    /**
     * 记录设备连接
     */
    public void recordDeviceConnection(String deviceId, boolean success) {
        incrementCounter("device.connection.total", 
            "device_id", deviceId, 
            "status", success ? "success" : "failed");
    }
    
    /**
     * 记录数据点读取
     */
    public void recordDataPointRead(String deviceId, String pointCode, boolean success) {
        incrementCounter("device.datapoint.read.total",
            "device_id", deviceId,
            "point_code", pointCode,
            "status", success ? "success" : "failed");
    }
    
    /**
     * 记录数据点写入
     */
    public void recordDataPointWrite(String deviceId, String pointCode, boolean success) {
        incrementCounter("device.datapoint.write.total",
            "device_id", deviceId,
            "point_code", pointCode,
            "status", success ? "success" : "failed");
    }
    
    /**
     * 记录流程执行
     */
    public void recordFlowExecution(String flowId, String flowName, boolean success, long durationMs) {
        incrementCounter("flow.execution.total",
            "flow_id", flowId,
            "flow_name", flowName,
            "status", success ? "success" : "failed");
        
        Timer timer = getOrCreateTimer("flow.execution.duration",
            "flow_id", flowId,
            "flow_name", flowName);
        timer.record(java.time.Duration.ofMillis(durationMs));
    }
    
    /**
     * 更新在线设备数
     */
    public void updateOnlineDevices(int count) {
        setGauge("device.online.count", count);
    }
    
    /**
     * 更新活跃流程数
     */
    public void updateActiveFlows(int count) {
        setGauge("flow.active.count", count);
    }
    
    private String buildKey(String name, String... tags) {
        StringBuilder sb = new StringBuilder(name);
        for (int i = 0; i < tags.length; i += 2) {
            if (i + 1 < tags.length) {
                sb.append(".").append(tags[i]).append("=").append(tags[i + 1]);
            }
        }
        return sb.toString();
    }
}
