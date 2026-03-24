# 节点表单扩展指南

本文约定流程设计器右侧 **节点配置表单**（`NodeForm`）如何随节点类型增长而可持续维护（目标 **30+ 节点类型**）。  
**Cursor 规则**：`.cursor/rules/node-form.mdc`（与本文同步，AI 编辑相关文件时自动提示）。

---

## 1. 背景与目标

### 1.1 问题

在单个 `NodeForm.jsx` 内用巨型 `switch (type)` 堆叠 JSX 会导致：

- 单文件过长、审查困难、Git 合并冲突多；
- 难以按节点分工、难以单测「配置规范化」逻辑；
- 不利于按需懒加载表单项。

### 1.2 目标架构

**常量与初始值规范化独立 + 按类型拆表单项组件 + 注册表**，使 `NodeForm.jsx` 仅保留「壳、自动保存、公共副作用」。

---

## 2. 目录与文件职责

```
web-app/src/pages/
  NodeForm.jsx                    # Form 壳、自动保存、设备/数据源加载、渲染 NODE_FIELD_COMPONENTS[type]
  node-form/
    constants.js                  # 脚本/条件等下拉选项
    normalizeNodeConfig.js        # buildNodeFormInitialValues：config → 表单 initialValues
    fieldRegistry.js              # NODE_FIELD_COMPONENTS: { [NODE_TYPE]: ReactComponent }
    fields/                       # 各节点表单项（已实现：SCRIPT、BASE_CONVERT、TCP_*、PLC_*、CONDITION 等）
      ScriptNodeFields.jsx
      ConditionNodeFields.jsx
      DefaultNodeFields.jsx
      ...
```

| 模块 | 职责 | 禁止 |
|------|------|------|
| `constants.js` | 枚举、选项 label/value | 塞业务副作用 |
| `normalizeNodeConfig.js` | 从持久化 JSON 恢复时的清洗、默认值、兼容旧 key；保证 `Form.List` 数据源为对象数组 | 写 UI |
| `fieldRegistry.js` | 类型 → 组件映射 | 写大块业务逻辑 |
| `fields/*.jsx` | 各节点 `Form.Item` 与说明文案 | `App.useApp()`（见 §5） |

---

## 3. 新增节点表单：完整检查清单

按顺序完成并勾选（**类型字符串三处一致**）：

| 步骤 | 位置 | 说明 |
|------|------|------|
| 1 | 后端 `NodeHandler` | `getType()` 返回常量，如 `MY_NODE`。 |
| 2 | `FlowJsonSupport` / 引擎 | 节点类型通常已随 JSON 大写化；勿与 Handler 不一致。 |
| 3 | `Designer.jsx` | `nodeTypeMap.MY_NODE`（label、颜色）；侧栏 `handleDragStart('MY_NODE')`。 |
| 4 | `node-form/fields/MyNodeFields.jsx` | 表单项组件；接收 `form`、`variableOptions` 等（与 `NodeForm` 约定一致）。 |
| 5 | `fieldRegistry.js` | `MY_NODE: MyNodeFields`。 |
| 6 | `normalizeNodeConfig.js` | 若需：为 `MY_NODE` 增加 `normalizeMyNode(initialValues)` 或在 `buildNodeFormInitialValues` 内分支。 |
| 7 | `NodeForm.jsx` | 已统一为 `<SpecificFields />`，`SpecificFields = NODE_FIELD_COMPONENTS[type] ?? DefaultNodeFields`；**新增类型只需** `fields/XxxFields.jsx` + `fieldRegistry.js` 注册。 |
| 8 | `ExecutionLogPanel.jsx`（可选） | `NODE_TYPE_LABEL_MAP` 等展示名。 |
| 9 | `Designer.jsx` `extractNodeOutputVariables`（可选） | 若节点产出新变量名，便于条件分支下拉。 |
| 10 | 文档 | 更新 `development-guide.md` 节点列表或本节变更记录；**结构/约定变更**须记入开发文档（项目规范）。 |

---

## 4. 字段子组件约定（props）

推荐统一由 `NodeForm` 传入（按需裁剪）：

| Prop | 说明 |
|------|------|
| `form` | `Form.useForm()` 实例（若子组件需要 `Form.useWatch`） |
| `variableOptions` | 条件/变量类下拉的选项（上游节点输出变量） |
| `deviceOptions` / `deviceDataList` | 设备类节点 |
| `operationTypes` / `onOperationChange` | 设备控制类 |
| `dataSourceOptions` | 数据库操作类 |

新建 `XxxFields` 时应在文件头用 **中文注释** 说明该节点配置与后端 `config` 字段对应关系。

---

## 5. Ant Design 与设计器环境约束

- **设计器路由未使用 antd `<App>` 包裹**，`NodeForm` 及 `node-form/fields/*` 内 **禁止使用 `App.useApp()`**。请使用 **`import { message, Modal, ... } from 'antd'`** 静态 API，否则运行期可能抛错导致 **整页白屏**。
- `nodeData.config` 可能为 `null` 或非对象；**必须**经 `buildNodeFormInitialValues`（或等价安全逻辑）再 `setFieldsValue`。
- **`Form.List`**：`name` 对应的数据必须是 **对象数组**；异常 JSON 须在 `normalizeNodeConfig` 中纠正。
- **占位提示中的 `${...}`**：部分打包链路可能将属性里的字面量 `"支持 ${变量}"` 误处理为模板字符串，导致运行时 **`ReferenceError: 变量 is not defined`**。表单项中若需展示「美元括号变量」示意，请使用 **`{'...\\u0024{变量}...'}`**（`\u0024` 为 `$`）或纯中文描述，**勿**在 JSX 属性字符串中直接写 `${中文标识符}`。

---

## 6. 大规模节点（约 30+）策略

| 策略 | 适用 |
|------|------|
| 一节点一文件 `fields/XxxFields.jsx` | 默认推荐，冲突面最小 |
| 按领域合并文件（如 `communicationFields.jsx` 内多个命名导出） | 想减少文件数量时 |
| `React.lazy(() => import('./fields/XxxFields'))` + `Suspense` | 设计器首屏体积优化（可选） |

---

## 7. 从 `switch` 迁移到注册表的步骤（已完成）

当前 `NodeForm.jsx` 已不再包含巨型 `switch`，全部类型由 `fieldRegistry.js` 注册。若仍要迁移**遗留** case：

1. 将 `case 'FOO':` 整块 JSX 剪切到 `fields/FooFields.jsx`，默认导出组件。
2. 在 `fieldRegistry.js` 增加 `FOO: FooFields`。
3. 运行 `npm run build` 与设计器冒烟验证。

---

## 8. 与执行引擎配置的对应关系

- 画布保存的 JSON 位于 `cell.data.config`，经 `FlowJsonSupport` 转为 `FlowNode.config` 传入 `NodeHandler`。
- 表单字段名应与 **Handler 内 `config.get("...")`** 一致；若重命名需同时改 Handler、历史数据兼容层（`normalizeNodeConfig`）与文档。

---

## 9. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-03 | 引入 `node-form/constants.js`、`normalizeNodeConfig.js`、`fieldRegistry.js`；补充本文与 `.cursor/rules/node-form.mdc`。 |
| 2026-03 | 与 `development-guide.md` 第 8 节、`README.md` 文档索引互链。 |
| 2026-03 | 全部已有节点类型表单项拆至 `node-form/fields/*.jsx`，`NodeForm.jsx` 仅保留壳与数据加载；`DEDUP_FILTER` 时间窗说明改为 `Form.Item extra`。 |
| 2026-03 | 修复打包后 `ReferenceError: 变量 is not defined`：字段占位文案中的 `${...}` 统一改为 `\u0024{...}` 表示法，避免被误解析为模板字符串。 |

---

## 10. 相关文档

- [development-guide.md](./development-guide.md) — 第 8 节「前端设计器」
- [README.md](../README.md) — 文档索引
