# 软件注册与授权说明

## 1. 功能目标

本系统新增了软件注册机制，用于实现以下限制能力：

- 功能限制：按授权功能码启用/禁用对应能力
- 使用时间限制：按授权到期时间自动失效
- 任务数量限制：限制可创建的任务总数

## 2. 后端授权接口

- `GET /api/license/status`：查询当前授权状态（机器码、到期时间、功能列表、任务上限等）
- `POST /api/license/activate`：激活授权码

### 状态字段说明

- `mode`：`TRIAL`（试用）或 `LICENSED`（正式授权）
- `valid`：授权是否有效（受过期、机器码匹配影响）
- `machineCode`：当前设备机器码
- `expireAt`：授权到期时间
- `remainingDays`：剩余天数
- `maxTasks` / `currentTasks`：任务上限与当前任务数
- `features`：功能码列表

## 3. 默认试用策略

当系统首次启动且无授权记录时，会自动生成试用授权：

- 试用期：7 天
- 任务上限：3
- 默认功能：`TASK_MANAGEMENT`、`FLOW_DESIGN`

## 4. 功能码定义

- `TASK_MANAGEMENT`：任务管理（新建/编辑/删除）
- `TASK_MANAGEMENT*`：任务管理通配模式（匹配以 TASK_MANAGEMENT 开头的功能）
- `FLOW_DESIGN`：流程设计与保存
- `TASK_EXECUTION`：任务启动与执行
- `DEBUG`：调试功能

## 5. 注册机（授权码生成器）

项目提供独立注册机目录：`license-generator/`

### 使用示例

```bash
node license-generator/license-generator.cjs --machine=你的机器码 --days=365 --maxTasks=100 --features=TASK_MANAGEMENT,FLOW_DESIGN,TASK_EXECUTION,DEBUG --customer=客户A
```

### 可选参数

- `--machine`：机器码，传 `*` 表示不绑定机器
- `--days`：授权天数
- `--maxTasks`：最大任务数量
- `--codeValidHours`：授权码可激活小时数（默认 24 小时）
- `--features`：功能码列表（逗号分隔）
- `--features` 支持 `*` 通配规则（如 `*`、`TASK_MANAGEMENT*`）
- `--customer`：客户标识
- `--secret`：签名密钥（不传则读取环境变量 `LICENSE_SECRET`，再回退默认值）

## 6. 密钥配置建议

后端通过 `application.yml` 中的以下配置读取签名密钥与试用天数：

- `license.secret`
- `license.trial-days`

建议在生产环境通过环境变量覆盖 `license.secret`，避免使用默认密钥。
