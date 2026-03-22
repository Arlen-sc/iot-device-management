# IoT 设备管理系统 - 开发规则

## 驱动开发
- 实现 `IoTProtocol` 接口，推荐继承 `AbstractIoTDriver`
- 添加 `@Component` 注解，公共方法必须有中文 JavaDoc
- 异常抛出 `DriverException`，读取返回 `ReadResult`（带质量标识）
- 命名：`<协议名>Driver`，如 `ModbusTcpDriver`

## 数据处理
- 设备数据必须经过 `DataCleaningService` 清洗
- 开启：空值检查、范围检查、Z-Score 异常值检测（阈值 3.0）

## 监控指标
- 设备连接：`device.connection.total`
- 数据读写：`device.datapoint.read/write.total`
- 流程执行：`flow.execution.total` + `flow.execution.duration`
- 在线设备：`device.online.count`
- 标签：`device_id`, `point_code`, `status`, `flow_id`, `flow_name`

## 代码风格
- 注释：公共 API 必须有中文 JavaDoc
- 命名：类名大驼峰、方法/变量小驼峰、常量全大写下划线
- 包结构：
  ```
  com.iot/
  ├── protocol/core/    # 核心接口（勿改）
  ├── protocol/impl/    # 协议实现
  ├── data/cleaning/    # 数据清洗
  └── monitoring/       # 监控
  ```

## Git 提交
- 格式：`<类型>(<范围>): <描述>`
- 类型：feat/fix/docs/style/refactor/test/chore

## 协议支持
| 协议 | 状态 |
|-----|------|
| HTTP/HTTPS | ✅ |
| Modbus TCP/MQTT/OPC UA/S7/WebSocket/BACnet/DLT645 | ⏳ |

## 任务执行规则
- **定时任务执行逻辑**：
  - 必须按步骤从流程中一步一步执行
  - 如果第一步、第二步没有数据流转下去，就跳过并完成任务
  - 如果不满足条件，就跳过并完成任务
  - 只有有数据且能流转才继续执行下去

- **监听事务类任务执行逻辑**：
  - 等待第一步的数据传入，然后进行流转
  - 如果一直没有数据传入，就一直等待
  - 数据传入后，按照流程步骤依次执行
