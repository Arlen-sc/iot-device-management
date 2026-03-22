# IoT 设备管理系统 - 协议支持清单与功能增强说明

## 目录

1. [概述](#1-概述)
2. [协议支持清单](#2-协议支持清单)
3. [驱动层架构](#3-驱动层架构)
4. [数据清洗功能](#4-数据清洗功能)
5. [监控指标体系](#5-监控指标体系)
6. [链路追踪](#6-链路追踪)
7. [功能优点总结](#7-功能优点总结)

---

## 1. 概述

本文档详细说明了 IoT 设备管理系统的协议支持能力、驱动架构设计以及新增的核心功能模块。本系统参考了 IoT DC3 的优秀架构理念，提供了完整的驱动生命周期管理、数据清洗、监控和链路追踪能力。

---

## 2. 协议支持清单

### 2.1 标准协议支持

| 序号 | 协议名称 | 版本 | 适用场景 | 驱动实现类 | 状态 |
|-----|---------|------|---------|-----------|------|
| 1 | **Modbus TCP** | - | 工业设备、PLC 通信 | ModbusTcpDriver | 计划中 |
| 2 | **Modbus RTU** | - | 串口设备、传感器 | ModbusRtuDriver | 计划中 |
| 3 | **MQTT** | 3.1/3.1.1/5.0 | IoT 设备消息推送 | MqttDriver | 计划中 |
| 4 | **OPC UA** | - | 工业自动化 | OpcUaDriver | 计划中 |
| 5 | **Siemens S7** | - | 西门子 PLC | S7Driver | 计划中 |
| 6 | **HTTP/HTTPS** | 1.1/2 | RESTful 设备 | HttpDriver | 已实现 |
| 7 | **WebSocket** | - | 实时双向通信 | WebSocketDriver | 计划中 |
| 8 | **BACnet** | - | 楼宇自控系统 | BacnetDriver | 计划中 |
| 9 | **DL/T645** | - | 电表规约 | Dlt645Driver | 计划中 |

### 2.2 私有协议扩展

系统提供完整的驱动 SDK，支持快速开发自定义协议驱动：

- 继承 `AbstractIoTDriver` 抽象基类
- 实现核心抽象方法
- 通过 Java SPI 机制自动注册
- 自动获得心跳、重连、线程池等公共能力

---

## 3. 驱动层架构

### 3.1 核心接口定义

#### IoTProtocol 接口

完整的驱动生命周期管理接口，提供以下核心能力：

```java
public interface IoTProtocol {
    // 驱动元信息
    String getDriverName();
    String getDriverVersion();
    String getProtocolType();
    
    // 生命周期管理
    void initialize(DriverConfig config) throws DriverException;
    boolean connect(Device device) throws DriverException;
    void disconnect(Device device) throws DriverException;
    boolean isConnected(Device device);
    DriverStatus getStatus();
    void destroy() throws DriverException;
    
    // 数据读写
    ReadResult read(Device device, PointInfo pointInfo) throws DriverException;
    List<ReadResult> batchRead(Device device, List<PointInfo> pointInfos) throws DriverException;
    WriteResult write(Device device, PointInfo pointInfo, Object value) throws DriverException;
    List<WriteResult> batchWrite(Device device, Map<PointInfo, Object> dataMap) throws DriverException;
    
    // 数据订阅
    void subscribe(Device device, List<PointInfo> pointInfos, DataChangeListener listener) throws DriverException;
    void unsubscribe(Device device, List<PointInfo> pointInfos) throws DriverException;
    
    // 设备操作
    ProtocolResponse executeOperation(Device device, OperationType operationType, Map<String, Object> params) throws DriverException;
}
```

### 3.2 抽象基类功能

`AbstractIoTDriver` 提供以下公共功能实现：

| 功能模块 | 说明 | 优点 |
|---------|------|------|
| **生命周期管理** | INITIALIZED → CONNECTING → CONNECTED → RUNNING → DISCONNECTING → DESTROYED | 状态流转清晰，便于监控 |
| **自动重连机制** | 断线自动检测，按配置间隔重试，可配置最大重试次数 | 提高系统可靠性 |
| **心跳检测** | 定期发送心跳包，检测连接状态 | 及时发现连接异常 |
| **连接池管理** | 多设备连接统一管理，线程安全 | 支持大规模设备接入 |
| **监听器模式** | 支持数据变化监听，实时推送 | 降低轮询开销 |
| **线程池管理** | 专用线程池，支持优雅关闭 | 资源可控 |
| **批量操作** | 默认批量实现，逐个执行 | 简化驱动开发 |

### 3.3 驱动配置

`DriverConfig` 提供丰富的配置选项：

```java
public class DriverConfig {
    private String driverInstanceId;
    private String protocolType;
    private int connectTimeout = 30000;        // 连接超时
    private int readTimeout = 30000;           // 读取超时
    private int writeTimeout = 30000;          // 写入超时
    private int reconnectInterval = 5000;       // 重连间隔
    private int maxReconnectAttempts = 3;       // 最大重连次数
    private boolean autoReconnect = true;       // 自动重连
    private int heartbeatInterval = 30000;      // 心跳间隔
    private Map<String, Object> customConfig;   // 自定义配置
}
```

### 3.4 数据质量标识

`ReadResult` 包含完整的数据质量信息：

| 质量等级 | 说明 |
|---------|------|
| GOOD | 数据正常 |
| UNCERTAIN | 数据不确定 |
| BAD | 数据错误 |
| CONFIG_ERROR | 配置错误 |
| NOT_CONNECTED | 设备未连接 |
| TIMEOUT | 读取超时 |

---

## 4. 数据清洗功能

### 4.1 核心能力

`DataCleaningService` 提供全面的数据清洗能力：

| 清洗功能 | 说明 | 配置项 |
|---------|------|--------|
| **空值检查** | 检测 null 或空字符串 | `checkNull`, `useDefaultValue`, `defaultValue` |
| **范围检查** | 检查数值是否在有效范围内 | `checkRange`, `minValue`, `maxValue`, `clipValue` |
| **异常值检测** | 基于 Z-Score 检测异常值 | `checkOutlier`, `outlierThreshold`, `smoothOutlier` |
| **数值平滑** | 使用历史平均值替换异常值 | 自动计算 |
| **数值四舍五入** | 按精度四舍五入 | `roundValue`, `roundScale` |
| **数据裁剪** | 超出范围的值裁剪到边界 | `clipValue` |

### 4.2 使用示例

```java
@Autowired
private DataCleaningService cleaningService;

public void processDeviceData(String deviceId, String pointCode, Object value) {
    DataCleaningConfig config = DataCleaningConfig.builder()
            .checkNull(true)
            .useDefaultValue(true)
            .defaultValue(0)
            .checkRange(true)
            .minValue(-100.0)
            .maxValue(100.0)
            .clipValue(true)
            .checkOutlier(true)
            .outlierThreshold(3.0)
            .smoothOutlier(true)
            .roundValue(true)
            .roundScale(2)
            .build();
    
    DataCleaningService.CleanedData cleaned = 
        cleaningService.cleanData(deviceId, pointCode, value, config);
    
    if (cleaned.isValid()) {
        Object cleanedValue = cleaned.getCleanedValue();
        List<String> issues = cleaned.getIssues();
    }
}
```

### 4.3 异常值检测算法

使用 Z-Score 算法检测异常值：

- 维护最近 1000 个历史数据点
- 计算平均值和标准差
- Z-Score = |当前值 - 平均值| / 标准差
- 超过阈值（默认 3.0）判定为异常值

### 4.4 优点

1. **数据质量保障**：多层检查，确保数据可靠性
2. **可配置性强**：各清洗步骤可独立开关配置
3. **智能化处理**：异常值自动平滑，不中断业务
4. **问题可追溯**：记录所有清洗问题，便于分析
5. **性能优化**：内存缓存历史数据，计算高效

---

## 5. 监控指标体系

### 5.1 Prometheus 指标集成

`MetricsService` 提供完整的监控指标收集：

#### 5.1.1 设备相关指标

| 指标名称 | 类型 | 标签 | 说明 |
|---------|------|------|------|
| `device.connection.total` | Counter | `device_id`, `status` | 设备连接次数统计 |
| `device.datapoint.read.total` | Counter | `device_id`, `point_code`, `status` | 数据点读取次数 |
| `device.datapoint.write.total` | Counter | `device_id`, `point_code`, `status` | 数据点写入次数 |
| `device.online.count` | Gauge | - | 当前在线设备数 |

#### 5.1.2 流程相关指标

| 指标名称 | 类型 | 标签 | 说明 |
|---------|------|------|------|
| `flow.execution.total` | Counter | `flow_id`, `flow_name`, `status` | 流程执行次数 |
| `flow.execution.duration` | Timer | `flow_id`, `flow_name` | 流程执行耗时分布 |
| `flow.active.count` | Gauge | - | 当前活跃流程数 |

#### 5.1.3 通用指标类型

- **Counter**：计数器，单调递增
- **Gauge**：仪表盘，可上下浮动
- **Timer**：计时器，记录耗时分布

### 5.2 使用示例

```java
@Autowired
private MetricsService metricsService;

public void executeFlow(String flowId, String flowName) {
    Timer.Sample sample = metricsService.startTimer();
    long startTime = System.currentTimeMillis();
    
    try {
        doExecuteFlow();
        metricsService.recordFlowExecution(flowId, flowName, true, 
            System.currentTimeMillis() - startTime);
    } catch (Exception e) {
        metricsService.recordFlowExecution(flowId, flowName, false, 
            System.currentTimeMillis() - startTime);
        throw e;
    } finally {
        metricsService.recordTimer(sample, "flow.execution.duration", 
            "flow_id", flowId, "flow_name", flowName);
    }
}
```

### 5.3 优点

1. **标准化**：基于 Micrometer，对接 Prometheus 等主流监控系统
2. **多维度**：支持丰富的标签，便于细粒度分析
3. **低开销**：指标收集对性能影响极小
4. **易扩展**：可轻松添加自定义指标
5. **可视化**：配合 Grafana 实现丰富的监控仪表盘

---

## 6. 链路追踪

### 6.1 分布式追踪能力

`TracingService` 提供完整的链路追踪功能：

| 功能 | 说明 |
|-----|------|
| Trace ID 获取 | 获取当前链路的 Trace ID |
| Span 创建 | 创建新的 Span 或子 Span |
| Span 执行 | 在 Span 上下文中执行代码 |
| 标签添加 | 向当前 Span 添加自定义标签 |
| 事件记录 | 记录关键事件 |
| 异常记录 | 记录异常信息 |

### 6.2 预定义追踪点

| 追踪点 | 说明 |
|-------|------|
| `device.connect` | 设备连接 |
| `device.read` | 数据读取 |
| `device.write` | 数据写入 |
| `flow.execute` | 流程执行 |

### 6.3 使用示例

```java
@Autowired
private TracingService tracingService;

public void readDeviceData(String deviceId, String pointCode) {
    tracingService.runWithSpan("device.read", () -> {
        tracingService.addTag("device.id", deviceId);
        tracingService.addTag("point.code", pointCode);
        
        try {
            Object value = doReadData(deviceId, pointCode);
            tracingService.traceDataRead(deviceId, pointCode, value);
            return value;
        } catch (Exception e) {
            tracingService.traceError(e);
            throw e;
        }
    });
}
```

### 6.4 优点

1. **端到端追踪**：完整追踪请求链路
2. **问题定位快**：通过 Trace ID 快速定位问题
3. **性能分析**：分析各环节耗时，识别瓶颈
4. **集成友好**：基于 Micrometer Tracing，对接 Zipkin、Jaeger
5. **低侵入性**：API 简洁，易于集成

---

## 7. 功能优点总结

### 7.1 驱动层优点

| 优点 | 说明 |
|-----|------|
| **标准化接口** | 统一的驱动接口，便于开发和维护 |
| **完整生命周期** | 从初始化到销毁的完整状态管理 |
| **自动重连** | 断线自动重连，提高系统可靠性 |
| **心跳检测** | 及时发现连接异常 |
| **批量操作** | 支持批量读写，提高效率 |
| **订阅模式** | 支持数据变化订阅，降低轮询开销 |
| **数据质量** | 内置数据质量标识 |

### 7.2 数据清洗优点

| 优点 | 说明 |
|-----|------|
| **多层检查** | 空值、范围、异常值多层检查 |
| **智能修复** | 异常值自动平滑，不中断业务 |
| **可配置** | 各清洗步骤独立配置 |
| **问题追溯** | 记录所有清洗问题 |
| **高性能** | 内存缓存，计算高效 |

### 7.3 监控优点

| 优点 | 说明 |
|-----|------|
| **Prometheus 集成** | 标准指标格式 |
| **多维度标签** | 细粒度分析 |
| **低开销** | 对业务影响小 |
| **可视化** | Grafana 仪表盘 |
| **易扩展** | 自定义指标轻松添加 |

### 7.4 链路追踪优点

| 优点 | 说明 |
|-----|------|
| **端到端** | 完整链路追踪 |
| **快速定位** | Trace ID 问题定位 |
| **性能分析** | 耗时分布分析 |
| **标准集成** | Zipkin/Jaeger 支持 |
| **低侵入** | API 简洁易用 |

---

## 8. 下一步计划

1. 实现 Modbus TCP 驱动
2. 实现 MQTT 驱动
3. 集成时序数据库（InfluxDB）
4. 完善 Grafana 监控仪表盘
5. 实现驱动热加载

---

**文档版本：** v1.0  
**最后更新：** 2026-03-22  
**维护团队：** IoT 平台开发团队
