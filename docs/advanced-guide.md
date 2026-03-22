# IoT 设备管理系统 - 进阶开发指南

## 业务与开发规范特别说明

### 流程引擎执行规范
- **事务型任务约束**：如果是事务型任务（例如：发送命令后等待设备返回的请求-响应模式，或带有强状态依赖的设备交互如 TCP 收发），**必须**按步骤从流程中单次（Single Execution）一步一步走。
- **严禁滥用持续循环**：绝不允许使用带有短间隔的持续循环执行机制来“一直跑数据”。这种方式会导致不可控的副作用、产生大量重复的数据库日志并迅速耗尽系统资源（CPU/内存）。
- **定时调度替代方案**：对于真正需要周期性采集的数据，应规划使用标准的定时任务调度（例如 Cron 表达式），而不是依赖流程引擎底层的 `while(!stop)` 死循环机制。

## 目录

1. [架构演进与微服务化](#1-架构演进与微服务化)
2. [驱动层设计与协议扩展](#2-驱动层设计与协议扩展)
3. [数据层优化与存储方案](#3-数据层优化与存储方案)
4. [高可用与容灾设计](#4-高可用与容灾设计)
5. [性能优化与大规模部署](#5-性能优化与大规模部署)
6. [安全性加固](#6-安全性加固)
7. [云原生与容器化部署](#7-云原生与容器化部署)
8. [多租户与命名空间设计](#8-多租户与命名空间设计)
9. [监控与运维体系](#9-监控与运维体系)

---

## 1. 架构演进与微服务化

### 1.1 当前架构分析

当前项目采用单体架构，具有以下特点：
- **优点**：开发简单、部署便捷、事务一致性容易保证
- **缺点**：扩展性有限、耦合度高、技术栈统一、难以独立部署

### 1.2 目标架构：四层微服务架构

参考 IoT DC3 的四层架构，建议演进为：

```
┌─────────────────────────────────────────────────────────┐
│                    应用层 (Application Layer)             │
│  数据开放 API | 任务调度 | 告警通知 | 日志管理 | 第三方集成 │
└─────────────────────────────────────────────────────────┘
                            ↑
┌─────────────────────────────────────────────────────────┐
│                    管理层 (Management Layer)              │
│  微服务注册 | 设备命令接口 | 设备注册配对 | 集中式数据管理 │
└─────────────────────────────────────────────────────────┘
                            ↑
┌─────────────────────────────────────────────────────────┐
│                    数据层 (Data Layer)                    │
│        数据采集 | 数据存储 | 数据查询 | 数据转发            │
└─────────────────────────────────────────────────────────┘
                            ↑
┌─────────────────────────────────────────────────────────┐
│                    驱动层 (Driver Layer)                  │
│  驱动 SDK | 标准协议 | 私有协议 | 数据采集 | 命令执行       │
└─────────────────────────────────────────────────────────┘
```

### 1.3 微服务拆分建议

#### 1.3.1 服务拆分方案

| 服务名称 | 职责 | 技术栈建议 |
|---------|------|-----------|
| **iot-gateway** | API 网关、路由转发、鉴权、限流 | Spring Cloud Gateway |
| **iot-center-auth** | 用户认证、权限管理、OAuth2 | Spring Security + OAuth2 |
| **iot-center-manager** | 设备管理、设备注册、设备配对 | Spring Boot + MyBatis Plus |
| **iot-center-data** | 数据存储、数据查询、时序数据管理 | Spring Boot + InfluxDB |
| **iot-driver-manager** | 驱动管理、驱动注册、驱动生命周期 | Spring Boot |
| **iot-driver-virtual** | 虚拟设备驱动 | Spring Boot |
| **iot-driver-modbus** | Modbus TCP/RTU 驱动 | Spring Boot |
| **iot-driver-mqtt** | MQTT 协议驱动 | Spring Boot + Eclipse Paho |
| **iot-driver-opcua** | OPC UA 驱动 | Spring Boot + Eclipse Milo |
| **iot-driver-s7** | Siemens S7 驱动 | Spring Boot |
| **iot-task-engine** | 工作流引擎、任务调度 | Spring Boot + Quartz |
| **iot-alert** | 告警规则、告警通知、告警记录 | Spring Boot |

#### 1.3.2 服务通信机制

- **同步通信**：使用 OpenFeign 或 RestTemplate
- **异步通信**：使用 RabbitMQ 或 Kafka 进行消息传递
- **服务发现**：使用 Nacos 或 Eureka
- **配置中心**：使用 Nacos Config 或 Spring Cloud Config

#### 1.3.3 数据库拆分

| 服务 | 数据库 | 说明 |
|-----|--------|------|
| iot-center-auth | MySQL | 用户、权限数据 |
| iot-center-manager | MySQL | 设备、配置数据 |
| iot-center-data | InfluxDB + MySQL | 时序数据 + 元数据 |
| iot-task-engine | MySQL | 流程定义、执行日志 |
| iot-alert | MySQL | 告警配置、告警记录 |

### 1.4 演进路线图

#### 阶段一：模块化拆分（保持单体部署）
1. 按功能模块拆分包结构
2. 定义清晰的模块边界和接口
3. 引入模块化依赖管理

#### 阶段二：服务化改造
1. 拆分独立服务
2. 引入服务注册发现
3. 实现服务间通信

#### 阶段三：微服务完善
1. 引入 API 网关
2. 实现分布式事务
3. 完善监控和链路追踪

---

## 2. 驱动层设计与协议扩展

### 2.1 驱动 SDK 设计

#### 2.1.1 核心接口定义

```java
/**
 * IoT 驱动核心接口
 * 所有自定义驱动必须实现此接口
 */
public interface IoTDriver {
    
    /**
     * 获取驱动名称
     */
    String getDriverName();
    
    /**
     * 获取驱动版本
     */
    String getDriverVersion();
    
    /**
     * 获取支持的协议类型
     */
    ProtocolType getProtocolType();
    
    /**
     * 驱动初始化
     * @param config 驱动配置
     */
    void initialize(DriverConfig config) throws DriverException;
    
    /**
     * 连接设备
     * @param deviceInfo 设备信息
     */
    void connect(DeviceInfo deviceInfo) throws DriverException;
    
    /**
     * 断开设备连接
     */
    void disconnect() throws DriverException;
    
    /**
     * 读取数据
     * @param pointInfo 点位信息
     * @return 读取结果
     */
    ReadResult read(PointInfo pointInfo) throws DriverException;
    
    /**
     * 写入数据
     * @param pointInfo 点位信息
     * @param value 写入值
     */
    WriteResult write(PointInfo pointInfo, Object value) throws DriverException;
    
    /**
     * 批量读取
     */
    List<ReadResult> batchRead(List<PointInfo> pointInfos) throws DriverException;
    
    /**
     * 批量写入
     */
    List<WriteResult> batchWrite(Map<PointInfo, Object> data) throws DriverException;
    
    /**
     * 订阅数据变化
     * @param pointInfos 点位列表
     * @param listener 数据变化监听器
     */
    void subscribe(List<PointInfo> pointInfos, DataChangeListener listener) throws DriverException;
    
    /**
     * 取消订阅
     */
    void unsubscribe(List<PointInfo> pointInfos) throws DriverException;
    
    /**
     * 检查驱动状态
     */
    DriverStatus getStatus();
    
    /**
     * 销毁驱动，释放资源
     */
    void destroy() throws DriverException;
}
```

#### 2.1.2 抽象驱动基类

```java
/**
 * 抽象驱动基类
 * 提供公共功能实现
 */
public abstract class AbstractIoTDriver implements IoTDriver {
    
    protected DriverConfig config;
    protected DriverStatus status = DriverStatus.INITIALIZED;
    protected final Map<String, DataChangeListener> subscribers = new ConcurrentHashMap<>();
    protected final ExecutorService executorService;
    
    protected AbstractIoTDriver() {
        this.executorService = Executors.newCachedThreadPool(
            new ThreadFactoryBuilder()
                .setNameFormat("driver-" + getDriverName() + "-%d")
                .build()
        );
    }
    
    @Override
    public void initialize(DriverConfig config) throws DriverException {
        this.config = config;
        this.status = DriverStatus.INITIALIZED;
        doInitialize(config);
    }
    
    /**
     * 子类实现具体的初始化逻辑
     */
    protected abstract void doInitialize(DriverConfig config) throws DriverException;
    
    @Override
    public DriverStatus getStatus() {
        return status;
    }
    
    @Override
    public void destroy() throws DriverException {
        try {
            doDestroy();
        } finally {
            executorService.shutdown();
            try {
                if (!executorService.awaitTermination(30, TimeUnit.SECONDS)) {
                    executorService.shutdownNow();
                }
            } catch (InterruptedException e) {
                executorService.shutdownNow();
                Thread.currentThread().interrupt();
            }
        }
        status = DriverStatus.DESTROYED;
    }
    
    protected abstract void doDestroy() throws DriverException;
}
```

### 2.2 驱动管理器设计

```java
/**
 * 驱动管理器
 * 负责驱动的注册、发现、生命周期管理
 */
@Service
public class DriverManager {
    
    private final Map<String, DriverInfo> registeredDrivers = new ConcurrentHashMap<>();
    private final Map<String, DriverInstance> activeDrivers = new ConcurrentHashMap<>();
    private final ApplicationEventPublisher eventPublisher;
    
    /**
     * 注册驱动
     */
    public void registerDriver(DriverInfo driverInfo) {
        registeredDrivers.put(driverInfo.getDriverId(), driverInfo);
        eventPublisher.publishEvent(new DriverRegisteredEvent(driverInfo));
    }
    
    /**
     * 创建驱动实例
     */
    public DriverInstance createDriver(String driverId, DriverConfig config) throws DriverException {
        DriverInfo driverInfo = registeredDrivers.get(driverId);
        if (driverInfo == null) {
            throw new DriverException("Driver not found: " + driverId);
        }
        
        String instanceId = UUID.randomUUID().toString();
        IoTDriver driver = instantiateDriver(driverInfo);
        driver.initialize(config);
        
        DriverInstance instance = new DriverInstance(instanceId, driverInfo, driver, config);
        activeDrivers.put(instanceId, instance);
        
        eventPublisher.publishEvent(new DriverCreatedEvent(instance));
        return instance;
    }
    
    /**
     * 通过 SPI 机制实例化驱动
     */
    private IoTDriver instantiateDriver(DriverInfo driverInfo) throws DriverException {
        ServiceLoader<IoTDriver> loader = ServiceLoader.load(IoTDriver.class);
        for (IoTDriver driver : loader) {
            if (driver.getDriverName().equals(driverInfo.getDriverName())) {
                return driver;
            }
        }
        throw new DriverException("Cannot instantiate driver: " + driverInfo.getDriverName());
    }
}
```

### 2.3 协议支持清单

#### 2.3.1 标准协议

| 协议名称 | 适用场景 | 驱动实现 |
|---------|---------|---------|
| **Modbus TCP** | 工业设备、PLC | ModbusTcpDriver |
| **Modbus RTU** | 串口设备 | ModbusRtuDriver |
| **MQTT 3.1/3.1.1/5** | IoT 设备消息 | MqttDriver |
| **OPC UA** | 工业自动化 | OpcUaDriver |
| **Siemens S7** | 西门子 PLC | S7Driver |
| **HTTP/HTTPS** | RESTful 设备 | HttpDriver |
| **WebSocket** | 实时双向通信 | WebSocketDriver |
| **BACnet** | 楼宇自控 | BacnetDriver |
| **DL/T645** | 电表规约 | Dlt645Driver |

#### 2.3.2 私有协议扩展

通过继承 `AbstractIoTDriver` 可快速实现私有协议驱动：

```java
/**
 * 私有协议驱动示例
 */
@Slf4j
public class CustomProtocolDriver extends AbstractIoTDriver {
    
    private Socket socket;
    private DataInputStream input;
    private DataOutputStream output;
    
    @Override
    public String getDriverName() {
        return "CustomProtocol";
    }
    
    @Override
    public String getDriverVersion() {
        return "1.0.0";
    }
    
    @Override
    public ProtocolType getProtocolType() {
        return ProtocolType.CUSTOM;
    }
    
    @Override
    protected void doInitialize(DriverConfig config) throws DriverException {
        log.info("Initializing CustomProtocol driver");
    }
    
    @Override
    public void connect(DeviceInfo deviceInfo) throws DriverException {
        try {
            socket = new Socket(deviceInfo.getHost(), deviceInfo.getPort());
            input = new DataInputStream(socket.getInputStream());
            output = new DataOutputStream(socket.getOutputStream());
            status = DriverStatus.CONNECTED;
            log.info("Connected to device: {}:{}", deviceInfo.getHost(), deviceInfo.getPort());
        } catch (IOException e) {
            throw new DriverException("Connection failed", e);
        }
    }
    
    @Override
    public ReadResult read(PointInfo pointInfo) throws DriverException {
        try {
            byte[] request = buildReadRequest(pointInfo);
            output.write(request);
            byte[] response = new byte[256];
            int len = input.read(response);
            return parseResponse(response, len);
        } catch (IOException e) {
            throw new DriverException("Read failed", e);
        }
    }
}
```

### 2.4 驱动注册机制

使用 Java SPI (Service Provider Interface) 进行驱动自动注册：

1. 在 `META-INF/services/` 目录下创建 `com.iot.driver.IoTDriver` 文件
2. 在文件中添加驱动实现类的全限定名：

```
com.iot.driver.impl.ModbusTcpDriver
com.iot.driver.impl.MqttDriver
com.iot.driver.impl.OpcUaDriver
```

---

## 3. 数据层优化与存储方案

### 3.1 数据分类与存储策略

#### 3.1.1 数据分类

| 数据类型 | 特点 | 存储方案 |
|---------|------|---------|
| **配置数据** | 低频修改、结构化 | MySQL |
| **设备元数据** | 设备信息、点位信息 | MySQL |
| **时序数据** | 高频写入、时间序列 | InfluxDB / TDengine |
| **日志数据** | 大量、查询为主 | Elasticsearch |
| **告警数据** | 实时性要求高 | MySQL + Redis |
| **流程数据** | 流程定义、执行记录 | MySQL |

### 3.2 时序数据库选型与集成

#### 3.2.1 InfluxDB 集成

**依赖配置：**

```xml
<dependency>
    <groupId>com.influxdb</groupId>
    <artifactId>influxdb-client-java</artifactId>
    <version>6.10.0</version>
</dependency>
```

**配置类：**

```java
/**
 * InfluxDB 配置
 */
@Configuration
@EnableConfigurationProperties(InfluxDBProperties.class)
public class InfluxDBConfig {
    
    @Bean
    public InfluxDBClient influxDBClient(InfluxDBProperties properties) {
        return InfluxDBClientFactory.create(
            properties.getUrl(),
            properties.getToken().toCharArray(),
            properties.getOrg(),
            properties.getBucket()
        );
    }
    
    @Bean
    public WriteApi writeApi(InfluxDBClient client) {
        return client.makeWriteApi(WriteOptions.builder()
            .batchSize(1000)
            .flushInterval(1000)
            .bufferLimit(10000)
            .build());
    }
}
```

**数据写入服务：**

```java
/**
 * 时序数据服务
 */
@Service
public class TimeSeriesDataService {
    
    private final WriteApi writeApi;
    private final QueryApi queryApi;
    private final InfluxDBProperties properties;
    
    /**
     * 写入单条数据
     */
    public void writeDataPoint(DeviceDataPoint dataPoint) {
        Point point = Point.measurement("device_data")
            .addTag("device_id", dataPoint.getDeviceId())
            .addTag("point_code", dataPoint.getPointCode())
            .addField("value", dataPoint.getValue())
            .addField("quality", dataPoint.getQuality())
            .time(dataPoint.getTimestamp(), WritePrecision.MS);
        
        writeApi.writePoint(point);
    }
    
    /**
     * 批量写入数据
     */
    public void writeDataPoints(List<DeviceDataPoint> dataPoints) {
        List<Point> points = dataPoints.stream()
            .map(dp -> Point.measurement("device_data")
                .addTag("device_id", dp.getDeviceId())
                .addTag("point_code", dp.getPointCode())
                .addField("value", dp.getValue())
                .addField("quality", dp.getQuality())
                .time(dp.getTimestamp(), WritePrecision.MS))
            .collect(Collectors.toList());
        
        writeApi.writePoints(points);
    }
    
    /**
     * 查询设备数据
     */
    public List<DeviceDataPoint> queryDeviceData(
        String deviceId,
        String pointCode,
        Instant startTime,
        Instant endTime,
        int limit
    ) {
        String flux = String.format("""
            from(bucket: "%s")
                |> range(start: %s, stop: %s)
                |> filter(fn: (r) => r._measurement == "device_data")
                |> filter(fn: (r) => r.device_id == "%s")
                |> filter(fn: (r) => r.point_code == "%s")
                |> limit(n: %d)
            """, properties.getBucket(), startTime, endTime, deviceId, pointCode, limit);
        
        List<FluxTable> tables = queryApi.query(flux);
        return fluxTablesToDataPoints(tables);
    }
}
```

### 3.3 数据缓存策略

#### 3.3.1 Redis 缓存配置

```java
/**
 * Redis 缓存配置
 */
@Configuration
@EnableCaching
public class RedisConfig {
    
    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory factory) {
        RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofHours(1))
            .serializeKeysWith(RedisSerializationContext.SerializationPair
                .fromSerializer(new StringRedisSerializer()))
            .serializeValuesWith(RedisSerializationContext.SerializationPair
                .fromSerializer(new GenericJackson2JsonRedisSerializer()));
        
        return RedisCacheManager.builder(factory)
            .cacheDefaults(config)
            .withCacheConfiguration("deviceInfo", 
                config.entryTtl(Duration.ofMinutes(30)))
            .withCacheConfiguration("driverConfig",
                config.entryTtl(Duration.ofMinutes(10)))
            .build();
    }
}
```

#### 3.3.2 多级缓存实现

```java
/**
 * 多级缓存服务
 * L1: 本地 Caffeine 缓存
 * L2: Redis 分布式缓存
 */
@Service
public class MultiLevelCacheService {
    
    private final Cache<String, Object> localCache;
    private final RedisTemplate<String, Object> redisTemplate;
    
    public MultiLevelCacheService(RedisTemplate<String, Object> redisTemplate) {
        this.localCache = Caffeine.newBuilder()
            .maximumSize(10000)
            .expireAfterWrite(5, TimeUnit.MINUTES)
            .build();
        this.redisTemplate = redisTemplate;
    }
    
    /**
     * 获取数据（先查本地，再查 Redis）
     */
    public <T> T get(String key, Class<T> clazz) {
        Object localValue = localCache.getIfPresent(key);
        if (localValue != null) {
            return clazz.cast(localValue);
        }
        
        Object redisValue = redisTemplate.opsForValue().get(key);
        if (redisValue != null) {
            localCache.put(key, redisValue);
            return clazz.cast(redisValue);
        }
        
        return null;
    }
    
    /**
     * 设置数据（同时更新本地和 Redis）
     */
    public void set(String key, Object value, Duration ttl) {
        localCache.put(key, value);
        redisTemplate.opsForValue().set(key, value, ttl);
    }
}
```

### 3.4 数据归档与冷热分离

#### 3.4.1 数据归档策略

```java
/**
 * 数据归档服务
 */
@Service
@Slf4j
public class DataArchivingService {
    
    /**
     * 归档历史数据
     */
    @Scheduled(cron = "0 0 2 * * ?")
    public void archiveOldData() {
        log.info("Starting data archiving job");
        
        LocalDate archiveDate = LocalDate.now().minusMonths(3);
        archiveDeviceData(archiveDate);
        archiveFlowLogs(archiveDate);
        archiveAlertRecords(archiveDate);
        
        log.info("Data archiving job completed");
    }
    
    /**
     * 归档设备数据到历史表
     */
    private void archiveDeviceData(LocalDate beforeDate) {
        // 1. 复制数据到历史表
        // 2. 删除原表数据
        // 3. 可选：将超过1年的数据导出到文件存储
    }
}
```

---

## 4. 高可用与容灾设计

### 4.1 服务高可用

#### 4.1.1 集群部署方案

```yaml
# docker-compose.yml
version: '3.8'
services:
  # 网关集群
  iot-gateway-1:
    image: iot-gateway:latest
    ports:
      - "8080:8080"
    environment:
      - SPRING_PROFILES_ACTIVE=prod
      
  iot-gateway-2:
    image: iot-gateway:latest
    ports:
      - "8081:8080"
    environment:
      - SPRING_PROFILES_ACTIVE=prod
  
  # Nginx 负载均衡
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
```

**Nginx 配置：**

```nginx
upstream iot-gateway {
    server iot-gateway-1:8080;
    server iot-gateway-2:8080;
    keepalive 32;
}

server {
    listen 80;
    
    location /api/ {
        proxy_pass http://iot-gateway;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 4.2 数据库高可用

#### 4.2.1 MySQL 主从复制

```yaml
# docker-compose-mysql.yml
version: '3.8'
services:
  mysql-master:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=root123
      - MYSQL_REPLICATION_USER=repl
      - MYSQL_REPLICATION_PASSWORD=repl123
    volumes:
      - ./master/my.cnf:/etc/mysql/my.cnf
      - master-data:/var/lib/mysql
      
  mysql-slave-1:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=root123
    volumes:
      - ./slave1/my.cnf:/etc/mysql/my.cnf
      - slave1-data:/var/lib/mysql
    depends_on:
      - mysql-master
```

**ShardingSphere 读写分离配置：**

```yaml
spring:
  shardingsphere:
    datasource:
      names: master,slave1,slave2
      master:
        type: com.zaxxer.hikari.HikariDataSource
        jdbc-url: jdbc:mysql://mysql-master:3306/iot_db
        username: root
        password: root123
      slave1:
        type: com.zaxxer.hikari.HikariDataSource
        jdbc-url: jdbc:mysql://mysql-slave-1:3306/iot_db
        username: root
        password: root123
    rules:
      readwrite-splitting:
        data-sources:
          iot_ds:
            static-strategy:
              write-data-source-name: master
              read-data-source-names: slave1,slave2
            load-balancer-name: round_robin
```

### 4.3 分布式事务

#### 4.3.1 Seata 集成

```xml
<dependency>
    <groupId>io.seata</groupId>
    <artifactId>seata-spring-boot-starter</artifactId>
    <version>1.7.1</version>
</dependency>
```

**使用示例：**

```java
@Service
public class DeviceService {
    
    @GlobalTransactional(name = "create-device-tx", rollbackFor = Exception.class)
    public void createDevice(Device device, List<DevicePoint> points) {
        deviceMapper.insert(device);
        
        for (DevicePoint point : points) {
            point.setDeviceId(device.getId());
            devicePointMapper.insert(point);
        }
        
        deviceRegisterService.registerToGateway(device);
    }
}
```

---

## 5. 性能优化与大规模部署

### 5.1 连接池优化

```yaml
spring:
  datasource:
    hikari:
      minimum-idle: 10
      maximum-pool-size: 50
      idle-timeout: 30000
      connection-timeout: 10000
      max-lifetime: 1800000
      leak-detection-threshold: 60000
```

### 5.2 异步处理与消息队列

#### 5.2.1 Kafka 数据采集

```java
/**
 * 数据采集消息生产者
 */
@Service
public class DataCollectionProducer {
    
    private final KafkaTemplate<String, DeviceDataPoint> kafkaTemplate;
    
    public void sendDataPoint(DeviceDataPoint dataPoint) {
        String key = dataPoint.getDeviceId() + "_" + dataPoint.getPointCode();
        kafkaTemplate.send("device-data-collection", key, dataPoint);
    }
    
    public void sendDataPoints(List<DeviceDataPoint> dataPoints) {
        List<CompletableFuture<SendResult<String, DeviceDataPoint>>> futures = 
            dataPoints.stream()
                .map(dp -> {
                    String key = dp.getDeviceId() + "_" + dp.getPointCode();
                    return kafkaTemplate.send("device-data-collection", key, dp);
                })
                .collect(Collectors.toList());
        
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
    }
}
```

```java
/**
 * 数据采集消息消费者
 */
@Service
@KafkaListener(topics = "device-data-collection", groupId = "iot-data-processor")
public class DataCollectionConsumer {
    
    private final TimeSeriesDataService timeSeriesDataService;
    private final AlertService alertService;
    
    @KafkaHandler
    public void handleDeviceDataPoint(DeviceDataPoint dataPoint) {
        timeSeriesDataService.writeDataPoint(dataPoint);
        alertService.checkAlertRules(dataPoint);
    }
}
```

### 5.3 批量处理优化

```java
/**
 * 批量数据处理器
 */
@Service
public class BatchDataProcessor {
    
    private final int BATCH_SIZE = 1000;
    private final BlockingQueue<DeviceDataPoint> dataQueue = new LinkedBlockingQueue<>(10000);
    
    @PostConstruct
    public void startBatchProcessor() {
        Thread batchThread = new Thread(this::processBatchLoop);
        batchThread.setName("batch-processor");
        batchThread.setDaemon(true);
        batchThread.start();
    }
    
    public void addDataPoint(DeviceDataPoint dataPoint) {
        dataQueue.offer(dataPoint);
    }
    
    private void processBatchLoop() {
        List<DeviceDataPoint> batch = new ArrayList<>(BATCH_SIZE);
        
        while (true) {
            try {
                DeviceDataPoint dp = dataQueue.poll(1, TimeUnit.SECONDS);
                if (dp != null) {
                    batch.add(dp);
                }
                
                if (batch.size() >= BATCH_SIZE || 
                    (batch.size() > 0 && dp == null)) {
                    processBatch(batch);
                    batch.clear();
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
    }
    
    private void processBatch(List<DeviceDataPoint> batch) {
        timeSeriesDataService.writeDataPoints(batch);
    }
}
```

### 5.4 性能基准

| 指标 | 单机部署 | 集群部署 (3节点) |
|-----|---------|-----------------|
| 设备接入数 | 10,000 | 100,000+ |
| 数据点写入/秒 | 10,000 | 100,000+ |
| API 响应时间 (P95) | < 100ms | < 50ms |
| 并发用户数 | 500 | 5,000+ |

---

## 6. 安全性加固

### 6.1 认证与授权

#### 6.1.1 JWT Token 认证

```java
/**
 * JWT 工具类
 */
@Component
public class JwtTokenProvider {
    
    private final String secretKey = "your-256-bit-secret-key-here";
    private final long validityInMilliseconds = 3600000;
    
    public String createToken(String username, List<String> roles) {
        Claims claims = Jwts.claims().setSubject(username);
        claims.put("roles", roles);
        
        Date now = new Date();
        Date validity = new Date(now.getTime() + validityInMilliseconds);
        
        return Jwts.builder()
            .setClaims(claims)
            .setIssuedAt(now)
            .setExpiration(validity)
            .signWith(SignatureAlgorithm.HS256, secretKey)
            .compact();
    }
    
    public boolean validateToken(String token) {
        try {
            Jws<Claims> claims = Jwts.parser()
                .setSigningKey(secretKey)
                .parseClaimsJws(token);
            
            return !claims.getBody().getExpiration().before(new Date());
        } catch (JwtException | IllegalArgumentException e) {
            throw new InvalidJwtAuthenticationException("Expired or invalid JWT token");
        }
    }
}
```

### 6.2 数据传输加密

#### 6.2.1 TLS/SSL 配置

```yaml
server:
  ssl:
    enabled: true
    key-store: classpath:keystore.p12
    key-store-password: changeit
    key-store-type: PKCS12
    key-alias: iot-server
```

### 6.3 数据加密存储

```java
/**
 * 敏感数据加密工具
 */
@Component
public class DataEncryptionUtil {
    
    private final String encryptKey;
    
    public DataEncryptionUtil(@Value("${app.encrypt.key}") String encryptKey) {
        this.encryptKey = encryptKey;
    }
    
    public String encrypt(String plainText) {
        try {
            Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
            SecretKeySpec keySpec = new SecretKeySpec(encryptKey.getBytes(), "AES");
            IvParameterSpec ivSpec = new IvParameterSpec(new byte[16]);
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, ivSpec);
            byte[] encrypted = cipher.doFinal(plainText.getBytes());
            return Base64.getEncoder().encodeToString(encrypted);
        } catch (Exception e) {
            throw new RuntimeException("Encryption failed", e);
        }
    }
    
    public String decrypt(String encryptedText) {
        try {
            Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
            SecretKeySpec keySpec = new SecretKeySpec(encryptKey.getBytes(), "AES");
            IvParameterSpec ivSpec = new IvParameterSpec(new byte[16]);
            cipher.init(Cipher.DECRYPT_MODE, keySpec, ivSpec);
            byte[] decrypted = cipher.doFinal(Base64.getDecoder().decode(encryptedText));
            return new String(decrypted);
        } catch (Exception e) {
            throw new RuntimeException("Decryption failed", e);
        }
    }
}
```

### 6.4 安全审计

```java
/**
 * 安全审计切面
 */
@Aspect
@Component
@Slf4j
public class SecurityAuditAspect {
    
    @Autowired
    private AuditLogService auditLogService;
    
    @Pointcut("@annotation(com.iot.annotation.AuditLog)")
    public void auditLogPointcut() {}
    
    @Around("auditLogPointcut()")
    public Object audit(ProceedingJoinPoint joinPoint) throws Throwable {
        long startTime = System.currentTimeMillis();
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth != null ? auth.getName() : "anonymous";
        
        AuditLog auditLog = new AuditLog();
        auditLog.setUsername(username);
        auditLog.setOperation(joinPoint.getSignature().getName());
        auditLog.setRequestParams(Arrays.toString(joinPoint.getArgs()));
        auditLog.setRequestTime(new Date());
        
        try {
            Object result = joinPoint.proceed();
            auditLog.setStatus("SUCCESS");
            auditLog.setExecuteTime(System.currentTimeMillis() - startTime);
            return result;
        } catch (Exception e) {
            auditLog.setStatus("FAILED");
            auditLog.setErrorMessage(e.getMessage());
            throw e;
        } finally {
            auditLogService.save(auditLog);
        }
    }
}
```

---

## 7. 云原生与容器化部署

### 7.1 Docker 镜像构建

#### 7.1.1 Dockerfile 示例

```dockerfile
# 多阶段构建
FROM maven:3.8-eclipse-temurin-17 AS builder
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=builder /app/target/iot-gateway.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

### 7.2 Kubernetes 部署

#### 7.2.1 Deployment 示例

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: iot-gateway
  namespace: iot-system
spec:
  replicas: 3
  selector:
    matchLabels:
      app: iot-gateway
  template:
    metadata:
      labels:
        app: iot-gateway
    spec:
      containers:
      - name: iot-gateway
        image: iot-gateway:1.0.0
        ports:
        - containerPort: 8080
        resources:
          requests:
            cpu: "500m"
            memory: "512Mi"
          limits:
            cpu: "2000m"
            memory: "2Gi"
        livenessProbe:
          httpGet:
            path: /actuator/health
            port: 8080
          initialDelaySeconds: 60
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /actuator/health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
        env:
        - name: SPRING_PROFILES_ACTIVE
          value: "prod"
        - name: JAVA_OPTS
          value: "-Xmx1536m -Xms512m"
```

#### 7.2.2 Service 示例

```yaml
apiVersion: v1
kind: Service
metadata:
  name: iot-gateway
  namespace: iot-system
spec:
  selector:
    app: iot-gateway
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8080
  type: LoadBalancer
```

#### 7.2.3 HPA 自动扩缩容

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: iot-gateway-hpa
  namespace: iot-system
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: iot-gateway
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### 7.3 Helm Chart 组织

```
iot-platform/
├── charts/
│   ├── iot-gateway/
│   ├── iot-center-auth/
│   ├── iot-center-manager/
│   ├── iot-center-data/
│   └── iot-drivers/
├── templates/
├── values.yaml
├── Chart.yaml
└── README.md
```

---

## 8. 多租户与命名空间设计

### 8.1 多租户架构方案

#### 8.1.1 数据库级隔离（Schema 模式）

```java
/**
 * 多租户上下文
 */
public class TenantContext {
    
    private static final ThreadLocal<String> TENANT_ID = new ThreadLocal<>();
    
    public static void setTenantId(String tenantId) {
        TENANT_ID.set(tenantId);
    }
    
    public static String getTenantId() {
        return TENANT_ID.get();
    }
    
    public static void clear() {
        TENANT_ID.remove();
    }
}
```

```java
/**
 * MyBatis Plus 多租户插件
 */
@Component
public class MyTenantLineHandler implements TenantLineHandler {
    
    @Override
    public Expression getTenantId() {
        return new StringValue(TenantContext.getTenantId());
    }
    
    @Override
    public String getTenantIdColumn() {
        return "tenant_id";
    }
    
    @Override
    public boolean ignoreTable(String tableName) {
        return "sys_dict".equals(tableName);
    }
}
```

### 8.2 命名空间设计

```java
/**
 * 命名空间服务
 */
@Service
public class NamespaceService {
    
    /**
     * 创建命名空间
     */
    @Transactional
    public Namespace createNamespace(NamespaceCreateDTO dto) {
        Namespace namespace = new Namespace();
        namespace.setCode(dto.getCode());
        namespace.setName(dto.getName());
        namespace.setTenantId(TenantContext.getTenantId());
        namespace.setStatus(NamespaceStatus.ACTIVE);
        
        namespaceMapper.insert(namespace);
        initializeNamespaceResources(namespace);
        
        return namespace;
    }
    
    /**
     * 初始化命名空间资源
     */
    private void initializeNamespaceResources(Namespace namespace) {
        createNamespaceDatabaseSchema(namespace);
        createNamespaceUser(namespace);
        createNamespaceDefaultRoles(namespace);
    }
}
```

---

## 9. 监控与运维体系

### 9.1 应用监控

#### 9.1.1 Prometheus + Grafana

```java
/**
 * 自定义指标
 */
@Component
public class CustomMetrics {
    
    private final MeterRegistry meterRegistry;
    
    public CustomMetrics(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }
    
    public void recordDeviceConnection(String deviceId, boolean success) {
        Counter.builder("device.connection.total")
            .tag("device_id", deviceId)
            .tag("status", success ? "success" : "failed")
            .register(meterRegistry)
            .increment();
    }
    
    public void recordDataPointWrite(long durationMs) {
        Timer.builder("data.point.write")
            .register(meterRegistry)
            .record(durationMs, TimeUnit.MILLISECONDS);
    }
}
```

### 9.2 日志收集

```yaml
# application.yml
logging:
  pattern:
    console: "%d{yyyy-MM-dd HH:mm:ss.SSS} [%X{traceId}] [%thread] %-5level %logger{36} - %msg%n"
```

### 9.3 链路追踪

```java
/**
 * Sleuth 链路追踪配置
 */
@Configuration
public class TracingConfig {
    
    @Bean
    public CurrentTraceContext currentTraceContext() {
        return CurrentTraceContext.Default.create();
    }
    
    @Bean
    public Tracing tracing(CurrentTraceContext currentTraceContext) {
        return Tracing.newBuilder()
            .localServiceName("iot-gateway")
            .currentTraceContext(currentTraceContext)
            .addSpanHandler(
                ZipkinSpanHandler.create(
                    OkHttpSender.create("http://zipkin:9411/api/v2/spans")
                )
            )
            .build();
    }
}
```

### 9.4 健康检查

```java
/**
 * 自定义健康检查
 */
@Component
public class DatabaseHealthIndicator implements HealthIndicator {
    
    @Autowired
    private DataSource dataSource;
    
    @Override
    public Health health() {
        try (Connection conn = dataSource.getConnection()) {
            if (conn.isValid(1)) {
                return Health.up()
                    .withDetail("database", "available")
                    .build();
            }
            return Health.down()
                .withDetail("database", "connection test failed")
                .build();
        } catch (SQLException e) {
            return Health.down(e)
                .withDetail("database", "error")
                .build();
        }
    }
}
```

---

## 10. 总结与建议

### 10.1 实施优先级建议

**高优先级（立即实施）：**
1. 驱动层 SDK 设计与实现
2. 时序数据库集成（InfluxDB）
3. Redis 缓存引入
4. 安全审计日志

**中优先级（3-6个月）：**
1. 微服务架构拆分
2. Kafka 消息队列
3. 容器化部署
4. Prometheus + Grafana 监控

**低优先级（6-12个月）：**
1. 多租户支持
2. Kubernetes 集群管理
3. 链路追踪
4. 容灾备份方案

### 10.2 参考资料

- IoT DC3 项目：https://gitee.com/pnoker/iot-dc3
- Spring Cloud 官方文档
- Kubernetes 官方文档
- InfluxDB 文档

---

**文档版本：** v1.0  
**最后更新：** 2026-03-22  
**维护团队：** IoT 平台开发团队
