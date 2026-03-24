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
| branches[] | 分支数组，每项含 {condition, nextNodeId} |
| condition.left | 变量路径 |
| condition.operator | 运算符 |
| condition.right | 比较值（支持${var}） |
| defaultNextNodeId | 默认分支 |

**支持的运算符：**  
`==` `!=` `>` `<` `>=` `<=`  
`contains`（包含） `starts_with`（前缀匹配） `ends_with`（后缀匹配）  
`is_empty`（为空） `not_empty`（不为空） `is_null` `not_null`  
`array_length_eq` `array_length_gt` `array_length_gte` `array_length_lt` `array_length_lte`（数组长度判断）

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
适用于多步骤加工、模板组装、JSON处理等复杂逻辑。

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

**设计器说明（2026-03）**

- `SCRIPT` 节点“操作类型”下拉统一改为固定完整选项（覆盖全部已支持操作），避免出现空白选项。
- 如果流程里已存在旧操作值，编辑器会保留并可继续修改。
- `SCRIPT` 节点加载时会过滤空操作项并做空值保护，避免旧脏数据导致配置面板白屏。
- `CONDITION` 节点在分支编辑（分支名/判断变量）时增加了 `branches` 空项过滤与 condition 判空保护，避免输入过程中白屏。
- 修复 `CONDITION` 分支编辑副作用：新增分支的占位项不再被自动过滤，点击/输入“分支名称”不会被隐藏。
- `CONDITION` 节点移除“分支名称”输入项，新增操作符：包含、前缀匹配、后缀匹配、为空/不为空、数组长度比较（=/>/>=/</<=）。
- `CONDITION` 节点操作符展示统一为中文标签；当选择数组长度比较时，判断变量字段会显示“应填写数组变量路径”的提示。
- `CONDITION` 节点“判断变量”改为可输入下拉建议：自动提供“全局变量 + 上游节点输出变量”候选，且保留手动输入能力。

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

#### BASE_CONVERT（进制转换）

用于单一职责的进制转换，和 `SCRIPT` 节点区分：  
`SCRIPT` 负责复杂处理链，`BASE_CONVERT` 只做输入/输出进制变换。

| 配置项 | 说明 |
|---|---|
| mode | 转换模式：HEX_TO_DEC / DEC_TO_HEX / BIN_TO_DEC / DEC_TO_BIN / HEX_TO_BIN / BIN_TO_HEX / CUSTOM |
| source | 源变量路径 |
| target | 目标变量路径 |
| fromBase | 自定义源进制（CUSTOM 时） |
| toBase | 自定义目标进制（CUSTOM 时） |
| uppercase | 输出字母是否大写 |
| withPrefix | 输出是否附加 0x/0b 前缀 |

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

#### DB_OPERATION（设计器数据库操作节点）

用于流程设计器中的通用数据库读写节点，支持本地库和外部数据源选择。

| 配置项 | 默认值 | 说明 |
|---|---|---|
| operation | SELECT | SELECT / INSERT / UPDATE / DELETE |
| dbMode | LOCAL | LOCAL（本地库）/ REMOTE（外部数据源） |
| dataSourceId | - | REMOTE 模式必填，选择数据源管理中的数据源 |
| sql | - | 自定义 SQL（支持 `${var}` 占位符），优先级最高 |
| tableName | - | 当 `sql` 为空时可见；用于 SELECT/DELETE 简化语句 |
| outputVariable | dbResult | 执行结果输出变量 |

说明：节点执行会输出结构化过程日志（执行参数、查询行数/影响行数），便于在调试台排查问题。

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
| readMode | LINE | LINE/LENGTH/DELIMITER/RAW |
| readLength | 1024 | LENGTH/RAW 模式读取字节数 |
| outputVariable | tcpClientData | 响应存入变量 |

说明：当 `waitResponse=true` 时，`TCP_CLIENT` 在连接成功后采用阻塞等待模式（发送后持续等待服务端返回，不使用读取超时）。

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
| outputVariable | RECEIVE 写入变量 |
| cleanupOnStop | STOP 时是否清理本任务 eventId 队列 |

说明：当 `operation=RECEIVE` 或 `BROADCAST` 且该端口尚未监听时，系统会自动拉起 TCP 服务端（无需必须先放一个 `START` 节点）。
说明：`RECEIVE` 采用阻塞等待模式（无限等待数据），不引入超时语义，适用于常驻 TCP 服务端场景。
说明：`RECEIVE` 执行时会额外输出结构化 key-value 过程日志：  
- 接收参数（`operation/port/waitMode/timeoutMs/eventId/outputVariable`）  
- 输出变量（`variable/value/length/preview`）  
并同步写入上下文变量 `${outputVariable}_kv`，便于后续节点直接按 key-value 取值。
说明：调试台“变量状态”对对象值（含 `${outputVariable}_kv`）采用 key-value 分行渲染；字符串化 JSON/Map 也会自动识别并格式化显示，避免单行挤压。

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

#### PLC_READ（PLC 读取）

通过 Modbus TCP **读保持寄存器（FC 0x03）**。设计器左侧「设备与通信」可拖拽 **PLC 读取**。

| 配置项 | 默认值 | 说明 |
|---|---|---|
| host | - | PLC IP（兼容旧字段 `ip`） |
| port | 502 | Modbus 端口 |
| unitId | 1 | 从站号（高级参数，可不配；前端表单默认不暴露，后端默认取 1） |
| timeout | 5000 | 连接/读超时（ms） |
| reads[] | - | 每段：`address` 起始地址，`quantity` 连续寄存器个数（1~125）；例如客户给 `D5502` 时填写 `5502` |
| outputVariable | plcReadResult | 结果列表写入上下文变量 |

结果：数组，元素为 `{ startAddress, quantity, values }`，`values` 为 16 位无符号整数列表（每字 2 字节）。

#### PLC_WRITE（PLC 写入）

通过 Modbus TCP 写寄存器（单字 **FC 0x06**，字符串多字按实现连续写）。设计器可拖拽 **PLC 写入**，支持 **registers 多路**。

| 配置项 | 默认值 | 说明 |
|---|---|---|
| host | - | PLC IP（兼容 `ip`） |
| port | 502 | Modbus 端口 |
| unitId | 1 | 从站号（高级参数，可不配；前端表单默认不暴露，后端默认取 1） |
| timeout | 5000 | 超时（ms） |
| registers[] | - | 每项：`address`，`valueSource`（固定值或 `${var}`），可选 `writeAs`：`AUTO` / `INT` / `STRING_ASCII`；例如客户给 `D5502` 时填写 `5502` |
| （兼容） | - | 旧配置可用单组 `address` + `writeValue` 代替一条 `registers` |

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

> 前端任务列表页在页面加载或点击“刷新”时请求 `running` 与 `task-flow-configs`；编辑任务并保存后会自动刷新列表，不再定时轮询，也不会在启动/停止/调试后自动刷新列表。

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

### 8.0 节点表单架构与规范（NodeForm）

流程画布右侧节点配置对应 `web-app/src/pages/NodeForm.jsx` 与 `web-app/src/pages/node-form/`。节点类型增多时，**禁止**长期在单文件内无限堆叠 `switch`；应使用 **常量拆分、`normalizeNodeConfig` 规范化、`fieldRegistry` 注册表、`fields/` 按类型拆组件**。

| 资源 | 说明 |
|------|------|
| **[node-form-extensibility.md](./node-form-extensibility.md)** | 目录约定、新增节点**完整检查清单**、props 约定、antd 约束、从 switch 迁移步骤、变更记录。 |
| **`.cursor/rules/node-form.mdc`** | Cursor 规则：编辑 `NodeForm.jsx` / `node-form/**` 时提示 AI 遵守上述约定。 |

**硬性约束（摘要）：** 设计器全屏路由未包裹 antd `<App>`，`NodeForm` 及相关 fields **不得**使用 `App.useApp()`，应使用静态 `message` 等 API；`node.config` 须安全展开；`Form.List` 数据源须为对象数组（详见独立文档 §5）。

### 8.1 节点分类

| 分类 | 包含节点 |
|---|---|
| 流程控制 | START, END, DELAY |
| 逻辑判断 | CONDITION, VARIABLE, DEDUP_FILTER |
| 数据处理 | DATA_EXTRACT, DATA_FILTER, DATA_TRANSFORM, DATA_LOAD, SCRIPT, LOG |
| 设备控制 | DEVICE_OPERATION |
| 通信集成 | TCP_LISTEN, TCP_CLIENT, TCP_SERVER, SQL_QUERY, HTTP_REQUEST, PLC_READ, PLC_WRITE |

### 8.2 设计器操作

- **添加节点：** 点击左侧面板中的节点类型
- **连接节点：** 从源节点输出端口拖拽到目标节点输入端口
- **配置节点：** 点击节点，右侧面板显示配置表单
- **删除：** 选中节点/边后按Delete键，或在画布中右键节点/连线选择“删除”
- **保存：** 点击工具栏保存按钮
- **调试日志：** 调试控制台使用内存实时日志会话（打开后创建会话并增量拉取），不从数据库读取；默认按节点摘要展示（每个节点一条，优先成功/失败/异常），并合并显示关键发送/接收信息；节点聚合优先按 `nodeId`，并兼容 `TCP_SEND/TCP_CLIENT` 别名去重，避免同一 TCP 发送节点出现多条摘要；日志主信息采用单行简约展示（执行时间、名称、类型、是否成功），其中“名称”为节点名称，“类型”为节点类型中文名（如设备数据、设备控制、TCP 客户端）；过程/输出/异常作为次级信息，且过程支持多行展示（每条过程单独一行），会自动去除“节点执行成功/失败/异常/警告”等状态词，避免与“状态”重复；TCP 类节点会额外显示发送变量与接收变量内容；`SYSTEM` 类型日志使用独立系统样式展示（不显示节点成功/失败状态），系统分隔日志（流程执行开始/结束分隔线）不再单独展示，避免与底部最终状态重复；异常信息默认折叠单行，支持“展开/收起”查看完整内容；支持“完整报文”开关切换截断/完整显示（并记住上次选择）；日志按时间正序展示（最新在最下方），并在运行期间自动滚动到最新；右侧变量状态在运行中也实时同步；"清空"仅清空当前界面显示，不影响数据库日志
- **调试日志轮询频率：** 调试控制台对 `GET /api/task-flow-configs/{id}/debug/{sid}/logs` 的轮询间隔调整为 **5 秒**（`DEBUG_LOG_POLL_INTERVAL_MS=5000`），用于降低高频请求和后端安全过滤链日志刷屏。
- **登录保持：** 系统启用 remember-me（30天），后端重启后在 cookie 未过期且未主动退出的情况下可自动恢复登录。`SecurityConfig` 中管理员账号改为固定盐值生成稳定 bcrypt 哈希，避免因每次重启重新 `encode` 导致 remember-me 签名校验失效。

### 8.3 节点表单（NodeForm）注意事项

- 完整架构、检查清单与迁移步骤见 **[node-form-extensibility.md](./node-form-extensibility.md)**；Cursor 侧见 **`.cursor/rules/node-form.mdc`**。
- 设计器全屏路由 **未** 使用 antd 的 `<App>` 包裹，因此 `NodeForm` **不得**使用 `App.useApp()`，应使用静态 API（如 `import { message } from 'antd'`），否则运行时会抛错导致 **整页白屏**。
- `node.config` 可能为 `null` 或非对象，表单初始化时需安全展开；`PLC_READ` / `PLC_WRITE` 的 `reads` / `registers` 需保证为对象数组，避免异常 JSON 导致 `Form.List` 崩溃。
- **新增节点类型**：后端 `NodeHandler#getType()`、设计器 `nodeTypeMap`、侧栏拖拽类型须一致；表单字段名与 Handler 读取的 `config` 键一致；结构或约定变更须更新本文档或 `node-form-extensibility.md` 变更记录。

### 8.4 变量引用规则

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

---

## 10. 变更记录（2026-03-23）

### 10.1 调试日志统一入库

- `FlowExecutor.execute(...)` 在流程执行结束后，新增统一落库逻辑：将 `FlowExecutionContext.executionLog` 全量写入 `flow_execution_log`。
- 该改动后，调试会话里看到的关键过程日志可沉淀为历史记录，任务执行日志页面可直接读取与复用。

### 10.2 任务执行日志按事件左右分栏展示

- `LogViewer` 改为左右分栏：左侧为事件列表（每次执行一个事件），右侧展示所选事件的一次完整流程日志。
- 数据来源为数据库 `flow_execution_log`，并以 `event_id` 聚合事件。
- 历史无 `event_id` 的日志归入 `unknown` 分组，保证兼容旧数据。

### 10.3 任务执行日志筛选能力

- `LogViewer` 新增筛选项：日志级别、时间范围、关键词。
- 筛选在前端内存数据上执行，不改变后端接口行为，可与“完整报文/简略报文”共存。
- 级别支持：`ALL / ERROR / WARN / INFO / SUCCESS / SYSTEM`。

### 10.4 节点执行日志降噪策略

- 在 `FlowExecutor.executeNode(...)` 中将通用节点生命周期日志改为“结果型记录”：默认仅记录一次 `SUCCESS`，失败/异常记录 `ERROR`，空结果记录 `WARN`。
- 移除通用的“节点执行开始 / 节点输入数据 / 节点输出后上下文 / 流程流转”日志，减少无效噪声。
- 节点处理器内部的业务日志（如 TCP/DB 节点关键过程）仍可按需记录，便于定位具体问题。

### 10.5 节点日志详细模式开关

- 新增配置项：`logging.flow.verbose`（默认 `false`）。
- `false`（默认）：精简模式，仅保留节点结果型日志（成功/失败/异常/警告）与必要业务日志。
- `true`：详细模式，恢复通用过程日志（开始、输入、输出后上下文、流程流转、执行头尾元信息）。
- 适用场景：日常运行建议精简模式；问题排查阶段可临时开启详细模式。

### 10.6 PLC 字符串写寄存器支持

- `PLC_WRITE` 节点新增每个寄存器项可选参数：`writeAs`，支持 `AUTO | INT | STRING_ASCII`。
- `AUTO`（默认）规则：数值按单寄存器整数写入；非数字字符串按 ASCII 自动拆分为多个连续寄存器写入。
- `STRING_ASCII`：强制字符串模式；`INT`：强制整数模式（兼容旧配置）。
- 适用场景：箱码等字符串可直接写入 PLC 寄存器区；仅支持十进制/二进制数值的客户端可继续使用 `INT` 模式。

### 10.7 节点日志统一优化（单节点单记录）

- 流程日志入库改为“按节点聚合”：每个节点最终仅保留一条结果记录（成功/失败/异常/警告）。
- 节点执行过程中的关键信息不再拆成多条记录，而是聚合到该节点记录的 `dataJson.processLines`。
- `Condition` 节点补充条件评估明细：记录逻辑类型、各分支条件、左右值、命中结果与所选分支，便于复盘。
- `Condition` 节点过程日志新增可读表达式行（如 `条件判断[分支A]: ${boxNo} > 1981723 (当前=1981800) => 命中`），便于快速定位条件命中原因。
- 调试控制台摘要模式（`ExecutionLogPanel` 默认视图）会优先展示条件表达式行；当节点来自数据库聚合记录时，从 `dataJson.processLines` 中提取 `条件判断[...]` 行，避免“条件分支卡片仅显示摘要无过程”。
- 调试控制台摘要模式对其它节点也统一保留非终态过程行（并过滤“节点执行开始/节点输入数据”等噪声），减少“节点卡片只有摘要、无过程”的情况。
- **聚合键修正（重要）：** 落库聚合使用 `actionType（大写）| nodeName（trim）`。若流程 JSON 中节点 `type` 与 Handler 内硬编码类型大小写不一致（例如 `condition` vs `CONDITION`），原先会导致过程日志与「节点执行成功」落在不同键，`processLines` 为空，界面只显示摘要行；现已统一规范化避免该问题。

### 10.8 全节点详情日志模板

- 所有节点统一产出过程模板：`节点执行参数`、`节点流转目标`、`节点执行结果`（最终落在单条节点记录中）。
- `FlowExecutionContext` 增加节点日志作用域，节点处理器中普通 `addLog(...)` 会自动归属到当前节点，统一并入该节点过程。
- `LOG` 节点取消直接写库，改为统一走执行上下文聚合入库，避免一节点多条入库记录。

### 10.9 前端节点表单（NodeForm）可扩展结构

- 为支持大量节点类型，引入 `web-app/src/pages/node-form/`：`constants.js`、`normalizeNodeConfig.js`（`buildNodeFormInitialValues`）、`fieldRegistry.js`（`NODE_FIELD_COMPONENTS`）、**`fields/`** 下按类型拆分的表单项组件（如 `ScriptNodeFields.jsx`、`ConditionNodeFields.jsx`）；`NodeForm.jsx` 仅负责 Form 壳、自动保存与设备/数据源等副作用。
- 约定与新增节点检查清单见 **[node-form-extensibility.md](./node-form-extensibility.md)**；AI/IDE 辅助规则见 **`.cursor/rules/node-form.mdc`**。
- 设计器路由未包裹 antd `<App>`，表单内禁止使用 `App.useApp()`，须用静态 `message` 等 API（见第 8 节）。
- **运行时坑位记录：** 某些打包链路会把属性中的字面量 `${...}` 误当模板字符串，出现 `ReferenceError: 变量 is not defined`。NodeForm/fields 中展示变量占位符时统一使用 `\u0024{var}`（例如 `{'支持 \u0024{var}'}`）或纯中文描述，避免在 JSX 属性字符串里直接写 `${中文标识符}`。

### 10.10 调试控制台日志面板等价重构优化

- 重构 `web-app/src/components/ExecutionLogPanel.jsx`：在不改变原有展示逻辑和数据处理规则的前提下，提取公共工具函数（动作类型规范化、过程行清洗、摘要过滤、颜色计算、日志键生成等），减少组件内重复代码与渲染期临时函数分配。
- 节点日志聚合与展示行为保持不变：仍兼容 `TCP_SEND -> TCP_CLIENT` 别名、按 `nodeId/name` 聚合、保留条件节点表达式优先展示、系统日志分隔过滤、异常展开/收起等现有规则。
- 新增并补齐关键中文注释，明确“摘要降噪、过程保留、TCP 细节行组装、自动滚动到底部”等核心设计意图，便于后续维护与扩展。
