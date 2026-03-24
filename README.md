# IoT设备管理系统

## 项目简介

IoT设备管理系统是一个基于Java开发的物联网设备管理平台，提供设备管理、数据采集、告警监控、工作流引擎等核心功能。系统支持多种协议接入，包括HTTP和MQTT，可实现对各类IoT设备的统一管理和监控。

## 系统架构

- **后端**：Java + Spring Boot + MyBatis Plus + SQLite
- **前端**：HTML + CSS + JavaScript + X6 (流程图设计库)
- **协议支持**：HTTP、MQTT
- **工作流引擎**：自定义流程引擎，支持多种节点类型

## 核心功能

### 1. 设备管理
- 设备分类管理
- 设备型号管理
- 设备基本信息管理
- 设备状态监控

### 2. 数据采集与处理
- 多协议数据接入（HTTP、MQTT）
- 数据桥接配置
- 数据源管理（支持SQL Server、MySQL、SQLite、Oracle、PostgreSQL等多种数据库）
- 数据转换与过滤
- 数据存储与查询

### 3. 告警系统
- 告警配置管理
- 实时告警监控
- 告警记录查询

### 4. 工作流引擎
- 可视化流程设计
- 多种节点类型支持：
  - 数据提取节点
  - 数据过滤节点
  - 数据转换节点
  - 设备操作节点
  - HTTP请求节点
  - TCP客户端/服务端节点
  - 脚本执行节点
  - SQL查询节点
  - 条件判断节点
  - 延迟节点
  - 去重过滤节点
- 流程执行日志

### 5. 协议管理
- 协议扩展机制
- 多协议支持

## 目录结构

```
iot-device-management/
├── docs/                    # 文档目录
│   ├── development-guide.md # 开发指南（含前端设计器、节点表单规范索引）
│   └── node-form-extensibility.md # 节点表单扩展（NodeForm 目录、检查清单、antd 约束）
├── .cursor/
│   └── rules/
│       └── node-form.mdc    # Cursor：编辑 NodeForm/node-form 时的约定
├── src/                     # 源代码
│   ├── main/java/com/iot/   # Java代码
│   │   ├── config/          # 配置类
│   │   ├── controller/      # 控制器
│   │   ├── entity/          # 实体类
│   │   ├── mapper/          # 数据访问层
│   │   ├── protocol/        # 协议实现
│   │   ├── service/         # 服务层
│   │   ├── task/            # 任务与工作流
│   │   ├── util/            # 工具类
│   │   └── IotApplication.java # 应用入口
│   └── main/resources/      # 资源文件
│       ├── META-INF/        # 元数据
│       ├── static/          # 静态资源
│       ├── application.yml  # 应用配置
│       └── schema.sql       # 数据库脚本
├── .gitignore               # Git忽略文件
├── flow_definition.json     # 流程定义示例
├── mock_servers.py          # 模拟服务器
├── pom.xml                  # Maven配置
├── scenario_flow.json       # 场景流程示例
└── test_flow.sh             # 测试脚本
```

## 环境要求

- JDK 1.8+ 
- Maven 3.6+ 
- MySQL 5.7+ 
- 浏览器（推荐Chrome、Firefox）

## 快速开始

### 1. 数据库准备

1. 创建数据库：
   ```sql
   CREATE DATABASE iot_device_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

2. 执行数据库脚本：
   ```bash
   mysql -u username -p iot_device_management < src/main/resources/schema.sql
   ```

### 2. 配置修改

默认配置已使用SQLite数据库，无需修改。如果需要更改数据库文件路径，可修改 `src/main/resources/application.yml` 文件中的数据库连接信息：

```yaml
spring:
  datasource:
    url: jdbc:sqlite:data/iot.db  # 数据库文件路径
    driver-class-name: org.sqlite.JDBC
    hikari:
      maximum-pool-size: 1
```

### 3. 构建与运行

1. 构建项目：
   ```bash
   mvn clean package
   ```

2. 运行应用：
   ```bash
   java -jar target/iot-device-management-1.0.0.jar
   ```

3. 访问系统：
   打开浏览器，访问 `http://localhost:18080`

## 开发指南

请参考 [开发指南](docs/development-guide.md) 获取详细的开发信息。

**前端流程设计器 · 节点配置表单（NodeForm）扩展**（目录约定、检查清单、antd 约束）：见 [节点表单扩展指南](docs/node-form-extensibility.md)；IDE 规则见 `.cursor/rules/node-form.mdc`。

## 协议扩展

系统支持通过实现 `IoTProtocol` 接口来扩展新的协议。具体步骤：

1. 创建新的协议实现类，实现 `IoTProtocol` 接口
2. 在 `META-INF/services/com.iot.protocol.core.IoTProtocol` 文件中注册新协议

## 工作流节点扩展

系统支持通过实现 `NodeHandler` 接口来扩展新的工作流节点类型。具体步骤：

1. 创建新的节点处理器类，实现 `NodeHandler` 接口
2. 在 `NodeHandlerRegistry` 中注册新的节点处理器（Spring 自动扫描 `@Component`）

**前端设计器表单**：若节点需在画布上配置参数，还须同步设计器（`Designer.jsx`、`nodeTypeMap`、侧栏）与 **`NodeForm` / `node-form/`**，详见 [节点表单扩展指南](docs/node-form-extensibility.md) 中的检查清单。

## 任务执行规则

### 定时任务执行逻辑
- 必须按步骤从流程中一步一步执行
- 如果第一步、第二步没有数据流转下去，就跳过并完成任务
- 如果不满足条件，就跳过并完成任务
- 只有有数据且能流转才继续执行下去

### 监听事务类任务执行逻辑
- 等待第一步的数据传入，然后进行流转
- 如果一直没有数据传入，就一直等待
- 数据传入后，按照流程步骤依次执行

## 许可证

本项目采用 MIT 许可证。

## 联系方式

- 作者：IoT Team
- 邮箱：contact@iot-example.com
- 项目地址：https://github.com/example/iot-device-management