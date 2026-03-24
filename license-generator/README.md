# 独立注册机（License Generator）

该目录是独立注册机，不依赖 `src` 或 `web-app` 目录。

## 1. 直接命令行使用

```bash
node license-generator/license-generator.cjs --machine=你的机器码 --days=365 --maxTasks=100 --features=TASK_MANAGEMENT,FLOW_DESIGN,TASK_EXECUTION,DEBUG --customer=客户A
```

## 2. 使用 npm 脚本

```bash
cd license-generator
npm run generate -- --machine=你的机器码 --days=365 --maxTasks=100 --features=TASK_MANAGEMENT,FLOW_DESIGN,TASK_EXECUTION,DEBUG --customer=客户A
```

## 3. 使用 bat 脚本（Windows）

```bash
cd license-generator
generate-license.bat --machine=你的机器码 --days=365 --maxTasks=100 --features=TASK_MANAGEMENT,FLOW_DESIGN,TASK_EXECUTION,DEBUG --customer=客户A
```

不传参数时会进入交互输入模式：

```bash
cd license-generator
generate-license.bat
```

说明：为保证中文提示稳定显示，交互模式由 `generate-license.ps1` 承载，`generate-license.bat` 会自动调用它。

## 4. 参数说明

- `--machine`：机器码，传 `*` 表示不绑定机器
- `--days`：授权天数
- `--maxTasks`：最大任务数量
- `--codeValidHours`：授权码可激活小时数（默认 24 小时）
- `--features`：功能码列表（逗号分隔）
- `--features` 支持 `*` 通配规则：
  - `*`：代表全部功能
  - `TASK_MANAGEMENT*`：代表以 `TASK_MANAGEMENT` 开头的功能
- `--customer`：客户标识
- `--secret`：签名密钥（不传则读取环境变量 `LICENSE_SECRET`，再回退默认值）