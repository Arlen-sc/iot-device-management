# IoT 设备管理平台 - 开发文档

## 目录

1. [项目概述](#1-项目概述)
2. [技术架构](#2-技术架构)
3. [数据库设计](#3-数据库设计)
4. [流程引擎](#4-流程引擎)
   - [4.4 TCP 任务与启动校验](#44-tcp-任务与启动校验)
5. [节点类型参考](#5-节点类型参考)
6. [节点合理性分析与重构记录](#6-节点合理性分析与重构记录)
7. [API 接口文档](#7-api-接口文档)
8. [前端设计器](#8-前端设计器)
9. [测试指南](#9-测试指南)

---

## 1. 项目概述

本项目是一个基于可视化流程编排的 IoT 设备管理平台，核心能力是通过拖拽式流程设计器定义设备数据采集、处理、转发的完整链路。

**核心场景示例：**
摄像头(TCP) → 采集hex数据 → 转十进制 → 判断长度 → 广播给下游 → 等待确认指令 → 格式化发送给设备 → 解析响应 → 日志入库 → HTTP推送

**关键特性：**
- 可视化流程设计器（AntV X6 拖拽编排）
- 20种节点类型覆盖流程控制、数据处理、通信集成
- 支持TCP Client/Server、HTTP、SQL、PLC Modbus等协议
- 内置SQLite，支持远程MySQL/PostgreSQL/SQL Server
- 流程支持单次执行和持续循环执行

---

## 2. 技术架构

### 技术栈

| 层 | 技术 | 版本 |
|---|---|---|
| 后端框架 | Spring Boot | 3.2.5 |
| 语言 | Java | 17 |
| ORM | MyBatis Plus | 3.5.5 |
| 数据库 | SQLite (内嵌) | 3.44.1 |
| 前端图形库 | AntV X6 | 2.x (CDN) |
| 构建工具 | Maven | - |

### 项目结构

```
src/main/java/com/iot/
├── controller/              # REST 控制器
│   ├── DeviceController
│   ├── TaskFlowConfigController
│   ├── FlowExecutionLogController
│   ├── TestTcpController        # 测试用TCP模拟
│   └── TestHttpReceiverController
├── entity/                  # 数据实体
│   ├── Device, DeviceModel, DeviceCategory
│   ├── TaskFlowConfig
│   ├── FlowExecutionLog
│   ├── AlertConfig, AlertRecord
│   └── DataBridge, OperationType
├── mapper/                  # MyBatis Mapper
├── service/                 # 业务服务层
├── task/
│   ├── engine/
│   │   ├── FlowEngine.java          # 流程调度引擎
│   │   ├── FlowExecutor.java        # 流程执行器（图遍历）
│   │   └── FlowExecutionContext.java # 执行上下文
│   ├── model/
│   │   ├── FlowDefinition.java      # 流程定义（nodes+edges+variables）
│   │   ├── FlowJsonSupport.java     # X6 cells JSON → FlowDefinition 转换
│   │   └── FlowNode.java            # 节点模型
│   ├── node/
│   │   ├── NodeHandler.java          # 节点处理器接口
│   │   ├── NodeResult.java           # 节点执行结果
│   │   ├── NodeHandlerRegistry.java  # 处理器注册中心
│   │   └── impl/                     # 20个节点实现
│   └── tcp/
│       ├── TcpServerManager.java      # TCP 服务端生命周期（端口级复用）
│       ├── TcpFlowAnalysis.java       # 从流程图解析 TCP 端口/对端
│       └── TcpTaskStartupValidator.java  # 启动前监听端口与对端连通性检查
└── util/
    ├── R.java                  # 统一响应封装
    ├── VariablePathUtils.java  # 变量路径工具（a.b.c 嵌套访问）
    └── JdbcUtils.java          # JDBC公共工具
```

### 配置说明 (application.yml)

```yaml
server:
  port: 8080
spring:
  datasource:
    url: jdbc:sqlite:data/iot.db     # SQLite数据库文件
    driver-class-name: org.sqlite.JDBC
    hikari:
      maximum-pool-size: 1           # SQLite单连接限制
  sql:
    init:
      mode: always                   # 每次启动执行schema.sql
      schema-locations: classpath:schema.sql
mybatis-plus:
  configuration:
    map-underscore-to-camel-case: true
  global-config:
    db-config:
      db-type: sqlite
```

> **注意：** SQLite 单连接池限制，所有节点的数据库操作必须使用 try-with-resources 及时归还连接。

---

## 3. 数据库设计

### 表结构一览

| 表名 | 用途 | 主要字段 |
|---|---|---|
| `device_category` | 设备分类 | id, parent_id, name, code |
| `device_model` | 设备型号 | id, category_id, name, protocol_type, specs_json |
| `device` | 设备实例 | id, model_id, name, code, status, ip_address, port |
| `operation_type` | 操作类型 | id, name, code, protocol_type, param_schema |
| `task_flow_config` | 流程配置 | id, name, flow_json, flow_type, trigger_type, execution_mode, cron_expression |
| `alert_config` | 告警规则 | id, name, device_id, condition_json, action_json |
| `alert_record` | 告警记录 | id, alert_config_id, level, message, data_json |
| `data_bridge` | 数据桥接 | id, name, source_type/config, target_type/config |
| `flow_execution_log` | 流程执行日志 | id, flow_config_id, flow_name, node_id, level, message, data_json |

### ID 策略

所有表主键使用 MyBatis Plus 的 `IdType.ASSIGN_ID`（雪花算法），生成19位Long型ID。

---

## 4. 流程引擎

### 4.1 执行模型

```
TaskFlowConfigController
    ├── POST /{id}/execute   → FlowEngine.executeFlow(id)    → 单次执行
    ├── POST /{id}/start     → FlowEngine.startContinuousFlow(id, interval) → 循环执行
    └── POST /{id}/stop      → FlowEngine.stopContinuousFlow(id)
```

**FlowEngine** 负责调度，**FlowExecutor** 负责图遍历执行：
1. 从 `START` 节点开始
2. 按 edges 找到下一个节点
3. 调用 `NodeHandlerRegistry.getHandler(type)` 获取处理器
4. 执行节点，根据 `NodeResult` 决定下一步
5. 支持条件分支（`NodeResult.branch(nodeIds)`）
6. 到达 `END` 节点时设置 `context.setCompleted(true)`

### 4.2 变量系统

- **FlowExecutionContext.variables** — `Map<String, Object>` 存储所有运行时变量
- **VariablePathUtils** — 支持点号路径访问：`a.b.c`、数组索引：`rs[0]`
- **${variable} 占位符** — 多数节点支持在配置中引用变量

```
${cameraRawData}      → 获取变量值
${rs[0]}              → 获取数组第一个元素
${parsedResult}       → 获取对象（自动JSON序列化）
```

### 4.3 流程定义格式 (flow_json)

设计器（AntV X6）保存的是 **`cells` 画布 JSON**；后端在 **`FlowJsonSupport.parseFlowDefinition`** 中将其转换为引擎使用的 **`nodes` + `edges`**。若 `flow_json` 已是标准 `nodes` 格式（如测试用例、手工导入），则直接解析。

```json
{
  "nodes": [
    {
      "id": "n_start",
      "type": "START",
      "name": "流程开始",
      "x": 80, "y": 300,
      "config": { "name": "流程开始", "triggerType": "ONCE" }
    }
  ],
  "edges": [
    {
      "id": "e_1",
      "source": "n_start", "sourcePort": "out_0",
      "target": "n_next",  "targetPort": "in_0"
    }
  ],
  "variables": [
    { "name": "myVar", "defaultValue": "" }
  ]
}
```

### 4.4 TCP 任务与启动校验

任务表 `task_flow_config` 中与执行方式相关的字段包括 **`flow_type`**（流程类型）、**`trigger_type`**（触发方式）、**`execution_mode`**（执行模式）、**`cron_expression`**（定时表达式）。本节说明 **TCP 客户端 / 服务端类任务** 在引擎中的行为约定。

#### 流程类型（flow_type）

| 取值 | 含义 |
|---|---|
| `DEVICE_CONTROL` / `DATA_PROCESS` / `MIXED` | 通用分类；TCP 行为以画布节点为准 |
| `TCP_CLIENT` | 语义上为「主动连接对端」的 TCP 客户端任务 |
| `TCP_SERVER` | 语义上为「本机监听」的 TCP 服务端任务 |

前端任务表单已提供 **TCP 客户端**、**TCP 服务端** 选项；引擎侧**不单独依赖**该字段做 TCP 校验，而是以流程图中实际出现的节点为准（见下节），避免配置与画布不一致时漏检。

#### 触发方式（trigger_type）

| 取值 | 典型用法 |
|---|---|
| `ONCE` | 手动调用 `POST /task-flow-configs/{id}/execute`，单次跑完整流程 |
| `SCHEDULED` | 定时触发（需外部调度或后续接入调度器调用 execute/start） |
| `EVENT` | 设备事件触发；若流程中无「等待外部先推数据」类节点，引擎日志会说明将**立即执行**，避免误提示「一直等待数据」 |

#### 单次执行 vs 持续轮询（多线程/循环）

| API | 行为 |
|---|---|
| `POST .../execute` | `FlowEngine.executeFlow`：单次执行；`FlowExecutionContext.continuousExecution = false` |
| `POST .../start?interval=...` | `FlowEngine.startContinuousFlow`：独立线程循环执行；`continuousExecution = true` |

**持续任务下的 TCP 服务端：** 为避免每一轮流程都「关掉再建」监听，当 `continuousExecution == true` 时，`TCP_SERVER` 节点的 **`STOP` 操作不会调用 `stopServer`**，仅按需清理当前 `eventId` 对应队列；**`START` 若端口已由本进程 `TcpServerManager` 托管，则复用监听**（不重复绑定）。客户端向对端发送/广播仍按流程节点顺序执行。

#### 启动前 TCP 资源检查（优先判断服务是否可用）

类 **`TcpTaskStartupValidator`** 在 **`executeFlow` 与 `startContinuousFlow` 真正执行流程之前** 调用，依据 **`TcpFlowAnalysis`** 从流程图收集：

- **TCP_SERVER** 节点中的监听端口：若该端口已由 **`TcpServerManager`** 管理则视为可用；否则尝试临时 `ServerSocket` 绑定，若失败则说明端口被占用，**阻止本次执行**。
- **TCP_CLIENT / TCP_SEND / TCP_LISTEN** 节点中的 `host:port`：短连接探测对端是否可达；不可达则 **阻止本次执行**。

检查失败抛出 `IllegalStateException`，接口层返回错误信息，任务不会进入节点执行。

#### 相关类

| 类 | 职责 |
|---|---|
| `com.iot.task.tcp.TcpFlowAnalysis` | 从 `FlowDefinition` 收集监听端口、客户端对端列表；可解析 TCP 角色（工具/扩展用） |
| `com.iot.task.tcp.TcpTaskStartupValidator` | 启动前校验监听端口与对端连通性 |
| `com.iot.task.tcp.TcpServerManager` | 本进程内 TCP 监听生命周期；`startServer` 返回是否本次新建监听（`false` 表示复用） |
| `FlowExecutionContext` | 承载 `flowType`、`executionMode`、`continuousExecution` 等，供节点处理器区分单次/持续行为 |

---

## 5. 节点类型参考

### 5.1 流程控制

#### START（开始）
流程入口点，初始化设备和变量。

| 配置项 | 类型 | 说明 |
|---|---|---|
| triggerType | ONCE/SCHEDULED/EVENT | 触发方式 |
| cronExpression | String | SCHEDULED时的cron表达式 |
| deviceId | Long | 关联的设备 |

#### END（结束）
流程终止，标记 `context.completed = true`。

#### DELAY（延时）

| 配置项 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| delayMs | int | 1000 | 延迟毫秒数 |

---

### 5.2 逻辑判断

#### CONDITION（条件判断）
根据变量值进行多分支路由。

| 配置项 | 说明 |
|---|---|
| branches[] | 分支数组，每项含 {name, condition, nextNodeId} |
| condition.left | 变量路径 |
| condition.operator | 运算符 |
| condition.right | 比较值（支持${var}） |
| defaultNextNodeId | 默认分支 |

**支持的运算符：** `==` `!=` `>` `<` `>=` `<=` `contains` `starts_with` `ends_with` `array_length_gte` `array_length_gt` `not_null` `is_null`

#### VARIABLE（变量设置）

| 配置项 | 说明 |
|---|---|
| operations[] | 操作数组 |
| action | `set` / `copy` / `delete` |
| path | 目标变量路径 |
| value | set时的值 |
| sourcePath | copy时的来源路径 |

#### DEDUP_FILTER（防重过滤）
基于时间窗口的去重，使用内存缓存判断数据是否重复。

| 配置项 | 默认值 | 说明 |
|---|---|---|
| inputVariable | tcpData | 检测的变量名 |
| ttlSeconds | 60 | 去重时间窗口(秒) |
| cacheKey | default | 缓存命名空间 |

---

### 5.3 数据处理

#### SCRIPT（脚本处理）⭐ 统一数据处理节点

这是最核心的数据处理节点，支持23种操作，通过操作链串联实现复杂数据变换。

| 配置项 | 说明 |
|---|---|
| operations[] | 操作链数组 |
| op | 操作类型（见下表） |
| source | 输入变量路径 |
| target | 输出变量路径 |
| params | 操作参数（Map） |

**全部操作类型：**

| 操作 | 说明 | params |
|---|---|---|
| SPLIT | 字符串拆分为数组 | delimiter |
| JOIN | 数组合并为字符串 | delimiter |
| HEX_ARRAY_TO_DEC | hex字符串数组→十进制 | - |
| DEC_ARRAY_TO_HEX | 十进制数组→hex | - |
| HEX_TO_DEC | 单个hex→十进制 | - |
| DEC_TO_HEX | 单个十进制→hex | - |
| ARRAY_LENGTH | 获取数组长度 | - |
| ARRAY_SLICE | 数组切片 | start, end |
| STRING_TO_HEX | 字符串→hex编码 | - |
| HEX_TO_STRING | hex编码→字符串 | - |
| STRIP_PREFIX | 去除固定前缀 | prefix |
| CONCAT | 字符串拼接 | values[] |
| TEMPLATE | 模板替换 | template |
| FORMAT_VALUES | 数组→"v1=a,v2=b"格式 | prefix, delimiter |
| PARSE_CSV_VALUES | "k=v,k=v"→Map | - |
| JSON_BUILD | 构建JSON对象 | fields{} |
| JSON_PARSE | JSON字符串→对象 | - |
| JSON_STRINGIFY | 对象→JSON字符串 | - |
| ROUND | 四舍五入 | scale |
| TO_NUMBER | 转为数字 | - |
| TO_STRING | 转为字符串 | - |
| SUBSTRING | 截取子串 | start, end |
| REPLACE | 字符串替换 | search, replacement |

**示例 — hex数据采集与转换：**
```json
{
  "operations": [
    {"op": "SPLIT", "source": "rawData", "target": "hexArray", "params": {"delimiter": ","}},
    {"op": "HEX_ARRAY_TO_DEC", "source": "hexArray", "target": "decArray"},
    {"op": "ARRAY_LENGTH", "source": "decArray", "target": "count"},
    {"op": "JSON_BUILD", "target": "result", "params": {"fields": {"d1": "${decArray[0]}", "d2": "${decArray[1]}"}}}
  ]
}
```

#### DATA_TRANSFORM（数据转换）⚠️ 建议使用SCRIPT替代

功能已整合入SCRIPT节点。保留此节点用于向后兼容，内部已委托给SCRIPT引擎执行。

#### DATA_EXTRACT（数据抽取）
从一个变量路径复制到另一个路径，等价于 `VARIABLE(copy)` 操作。

#### DATA_FILTER（数据过滤）
对数组数据按条件筛选。

| 配置项 | 说明 |
|---|---|
| sourcePath | 输入数据路径 |
| targetPath | 输出数据路径 |
| conditions[] | 过滤条件（field, operator, value） |

#### LOG（日志记录）
将执行数据写入 `flow_execution_log` 数据库表。

| 配置项 | 默认值 | 说明 |
|---|---|---|
| message | - | 日志消息模板（支持${var}） |
| dataPath | - | 要记录的数据变量路径 |
| logLevel | INFO | INFO / WARN / ERROR |
| saveToDb | true | 是否写入数据库 |
| outputVariable | - | 将日志条目存入变量 |

**写入表结构：** `flow_execution_log(id, flow_config_id, flow_name, node_id, node_name, level, message, data_json, created_at)`

---

### 5.4 数据存储

#### DATA_LOAD（数据保存）

支持两种写入方式：字段映射 和 直接SQL。

**方式一：直接SQL（推荐）**

| 配置项 | 说明 |
|---|---|
| dbMode | LOCAL（本地SQLite）/ REMOTE（远程数据库） |
| sql | SQL语句，支持 ${variable} 占位符 |
| outputVariable | 存储执行结果 |

```json
{
  "dbMode": "LOCAL",
  "sql": "INSERT INTO device (name, code, status) VALUES ('${deviceName}', '${deviceCode}', 1)",
  "outputVariable": "saveResult"
}
```

**方式二：字段映射**

| 配置项 | 说明 |
|---|---|
| tableName | 目标表名 |
| operation | INSERT / UPDATE / UPSERT |
| idField | 主键列名（默认id） |
| idStrategy | AUTO_INCREMENT / ASSIGN_ID / VARIABLE / NONE |
| fields[] | 字段映射 {column, value, type} |
| updateCondition | UPDATE时的WHERE条件 |

字段类型：`AUTO` `STRING` `INTEGER` `DOUBLE` `BOOLEAN` `JSON`

**REMOTE模式额外配置：** dbType, dbHost, dbPort, dbName, username, password

#### SQL_QUERY（SQL查询）

连接远程数据库执行任意SQL，适用于读取外部数据。

| 配置项 | 说明 |
|---|---|
| dbType | MYSQL / POSTGRESQL / SQLSERVER |
| dbHost, dbPort, dbName | 连接信息 |
| username, password | 认证 |
| sql | SQL语句（支持${var}） |
| outputVariable | 结果存入变量 |

> **DATA_LOAD vs SQL_QUERY 使用场景：**
> - 写入本地SQLite → DATA_LOAD (LOCAL)
> - 写入远程数据库 → DATA_LOAD (REMOTE) 或 SQL_QUERY
> - 读取远程数据库 → SQL_QUERY
> - 简单写入用SQL模式，复杂映射用字段映射模式

---

### 5.5 通信集成

#### TCP_CLIENT（TCP 客户端）⭐ 设计器主入口

连接对端 TCP 服务，可选发送数据并可选接收响应。旧画布中的 **`TCP_SEND`** 节点与 `TCP_CLIENT` 等价（后端 `TcpSendNodeHandler` 委托同一套逻辑）。

| 配置项 | 默认值 | 说明 |
|---|---|---|
| host | - | 对端地址 |
| port | - | 对端端口 |
| sendData | "" | 发送内容（支持${var}，可空） |
| sendHex | false | 是否按 hex 字节发送 |
| waitResponse | false | 是否等待对端响应（未配置时默认 false） |
| timeout | 5000 | 超时毫秒数 |
| readMode | LINE | LINE/LENGTH/DELIMITER/RAW |
| readLength | 1024 | LENGTH/RAW 模式读取字节数 |
| outputVariable | tcpClientData | 响应存入变量 |

#### TCP_LISTEN（TCP监听）⚠️ 建议使用TCP_CLIENT替代

功能是TCP_CLIENT的子集（只读不写），内部已委托给TCP_CLIENT执行。

#### TCP_SERVER（TCP 服务端）

本机监听端口，与 `TcpServerManager` 配合；设计器中单独提供「TCP 服务端」节点。

| 配置项 | 说明 |
|---|---|
| port | 监听端口 |
| operation | START（启动/复用监听）/ BROADCAST / RECEIVE / STOP |
| sendData | BROADCAST 时下发内容（支持 hex 开关） |
| sendHex | BROADCAST 时是否按 hex 解析 |
| timeout | RECEIVE 等待超时 |
| outputVariable | RECEIVE 写入变量 |
| cleanupOnStop | STOP 时是否清理本任务 eventId 队列 |

#### HTTP_REQUEST（HTTP请求）

| 配置项 | 默认值 | 说明 |
|---|---|---|
| url | - | 请求地址（支持${var}，自动URL编码） |
| method | POST | GET/POST/PUT/DELETE |
| contentType | application/json | Content-Type |
| headers | {} | 自定义请求头 |
| body | - | 请求体（支持${var}） |
| timeout | 10000 | 超时毫秒数 |
| outputVariable | httpResponse | 响应存入变量 |

#### PLC_WRITE（PLC写入）

通过Modbus TCP协议写入PLC寄存器。

| 配置项 | 默认值 | 说明 |
|---|---|---|
| host | - | PLC地址 |
| port | 502 | Modbus端口 |
| unitId | 1 | 从站ID |
| registers[] | - | {address, valueSource} |

---

### 5.6 设备控制

#### DEVICE_OPERATION（设备操作）

通过协议管理器执行设备操作。

| 配置项 | 说明 |
|---|---|
| deviceOverride | 是否指定设备（否则用上下文设备） |
| opDeviceId | 指定的设备ID |
| operationTypeCode | 操作类型代码 |
| params | 操作参数（支持${var}） |

#### OPERATION ⚠️ 已废弃，使用DEVICE_OPERATION替代

内部已委托给DEVICE_OPERATION执行。

---

## 6. 节点合理性分析与重构记录

### 6.1 已完成的合并

| 合并项 | 原状态 | 重构方案 | 原因 |
|---|---|---|---|
| OPERATION → DEVICE_OPERATION | 95%代码重复 | OPERATION委托给DEVICE_OPERATION | 两者仅设备解析逻辑不同 |
| TCP_LISTEN → TCP_CLIENT | 60%代码重复 | TCP_LISTEN委托给TCP_CLIENT | TCP_CLIENT是TCP_LISTEN的超集 |
| DATA_TRANSFORM → SCRIPT | 40%操作重复 | 所有操作合入SCRIPT(23种)，DATA_TRANSFORM委托SCRIPT | 消除重复实现 |
| DATA_LOAD + SQL模式 | 字段映射过于复杂 | 新增直接SQL写入方式 | 用户需要简单直接的SQL写入 |

### 6.2 公共工具提取

| 工具类 | 提取来源 | 功能 |
|---|---|---|
| JdbcUtils | DATA_LOAD + SQL_QUERY | JDBC URL构建、默认端口、变量解析 |

### 6.3 日志记录合理性

**原方案：** 写入JSON文件（`data/flow_logs.json`）
**问题：** 文件不支持查询、并发写入不安全、无法与其他数据关联
**新方案：** 写入SQLite `flow_execution_log` 表
**优点：**
- 支持按流程ID、日志级别、时间范围查询
- REST API查询：`GET /api/flow-logs?flowConfigId=xxx&level=INFO`
- 与流程配置表可关联
- 原子写入，并发安全

### 6.4 数据保存合理性

**原方案：** DATA_LOAD仅做变量映射，不实际写入数据库
**问题：** 名为"数据保存"却不存储数据，配置复杂
**新方案：** 双模式
- **SQL模式（推荐）：** 直接写SQL，和SQL_QUERY保持一致的体验，简单明了
- **字段映射模式：** 适合不会写SQL的可视化用户，指定表名/字段/类型
- 支持LOCAL(SQLite)和REMOTE(MySQL等)数据源切换

### 6.5 节点使用建议

| 场景 | 推荐节点 | 不推荐 |
|---|---|---|
| 数据格式转换 | SCRIPT | DATA_TRANSFORM |
| TCP读取 | TCP_CLIENT | TCP_LISTEN |
| 设备操作 | DEVICE_OPERATION | OPERATION |
| 本地数据写入 | DATA_LOAD(SQL模式) | - |
| 远程数据读取 | SQL_QUERY | - |
| 简单变量复制 | VARIABLE(copy) | DATA_EXTRACT |
| 条件路由 | CONDITION | - |
| 数据数组过滤 | DATA_FILTER | CONDITION |

---

## 7. API 接口文档

### 7.1 流程配置

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /api/task-flow-configs | 查询所有流程 |
| GET | /api/task-flow-configs/{id} | 查询单个流程 |
| POST | /api/task-flow-configs | 创建流程 |
| PUT | /api/task-flow-configs/{id} | 更新流程 |
| DELETE | /api/task-flow-configs/{id} | 删除流程 |
| POST | /api/task-flow-configs/{id}/execute | 单次执行 |
| POST | /api/task-flow-configs/{id}/start?interval=1000 | 启动循环执行 |
| POST | /api/task-flow-configs/{id}/stop | 停止循环执行 |
| GET | /api/task-flow-configs/running | 查看运行中的流程 |

### 7.2 流程日志

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /api/flow-logs?flowConfigId=&level=&limit=100 | 查询日志 |
| GET | /api/flow-logs/{flowConfigId} | 按流程查询 |
| DELETE | /api/flow-logs | 清空所有日志 |
| DELETE | /api/flow-logs/{flowConfigId} | 清空指定流程日志 |

### 7.3 设备管理

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /api/devices | 设备列表 |
| GET | /api/devices/{id} | 设备详情 |
| POST | /api/devices | 创建设备 |
| PUT | /api/devices/{id} | 更新设备 |
| DELETE | /api/devices/{id} | 删除设备 |

### 7.4 测试辅助

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | /api/test/camera-server/start?port=&hexData= | 启动摄像头模拟 |
| POST | /api/test/device-server/start?port=&responsePrefix=&responseHexData= | 启动设备模拟 |
| POST | /api/test/tcp-client/connect?host=&port= | TCP客户端连接 |
| POST | /api/test/send-command?host=&port=&command= | 发送TCP命令 |
| POST | /api/test/stop?port= | 停止测试服务 |
| GET | /api/test/list | 列出测试服务 |
| GET | /api/test/http-receiver/history | 查看HTTP接收数据 |

---

## 8. 前端设计器

### 8.1 节点分类

| 分类 | 包含节点 |
|---|---|
| 流程控制 | START, END, DELAY |
| 逻辑判断 | CONDITION, VARIABLE, DEDUP_FILTER |
| 数据处理 | DATA_EXTRACT, DATA_FILTER, DATA_TRANSFORM, DATA_LOAD, SCRIPT, LOG |
| 设备控制 | DEVICE_OPERATION |
| 通信集成 | TCP_LISTEN, TCP_CLIENT, TCP_SERVER, SQL_QUERY, HTTP_REQUEST, PLC_WRITE |

### 8.2 设计器操作

- **添加节点：** 点击左侧面板中的节点类型
- **连接节点：** 从源节点输出端口拖拽到目标节点输入端口
- **配置节点：** 点击节点，右侧面板显示配置表单
- **删除：** 选中节点/边后按Delete键，或在画布中右键节点/连线选择“删除”
- **保存：** 点击工具栏保存按钮
- **调试日志：** 调试控制台使用内存实时日志会话（打开后创建会话并增量拉取），不从数据库读取；“清空”仅清空当前界面显示，不影响数据库日志
- **登录保持：** 系统启用 remember-me（30天），后端重启后在 cookie 未过期且未主动退出的情况下可自动恢复登录

### 8.3 变量引用规则

在节点配置中使用 `${变量名}` 引用上下文变量：
- 简单变量：`${myVar}`
- 数组元素：`${rs[0]}`
- 在URL中自动进行URL编码
- 在SQL中直接替换（注意SQL注入风险，仅限可信数据）

---

## 9. 测试指南

### 9.1 8步主流程测试

使用 `test_full_integration.sh` 进行全链路测试：

```
[摄像头模拟TCP:9001] → 主流程8步 → [设备模拟TCP:9002]
                          ↕
                  [客户端模拟→TCP:9100]
```

**数据流：**
1. 摄像头返回hex: `1A,2B,3C,4D,5E,6F,7A,8B`
2. 转十进制: `[26,43,60,77,94,111,122,139]`
3. 构建JSON广播
4. 等待客户端发送 `ACK_READY`
5. 格式化 `v1=26,v2=43,...` 发给设备
6. 设备返回 `OK:0A,14,1E,28,32,3C`
7. 去前缀→转十进制→解析为JSON
8. HTTP推送结果

### 9.2 DATA_LOAD数据库写入测试

创建包含 DATA_LOAD 节点的流程，配置SQL模式：
```json
{"dbMode": "LOCAL", "sql": "INSERT INTO device (name, code) VALUES ('${name}', '${code}')"}
```

### 9.3 验证方法

- 日志查询：`GET /api/flow-logs`
- 设备数据：`GET /api/devices`
- HTTP接收：`GET /api/test/http-receiver/history`
