必须中文注释

每次修改代码都要考虑是否影响其他场景。

修改完后需要检查下代码的可行性，完整性，不能出现明显的错误。

- 设备连接：`device.connection.total`
- 数据读写：`device.datapoint.read/write.total`
- 流程执行：`flow.execution.total` + `flow.execution.duration`
- 在线设备：`device.online.count`
- 标签：`device_id`, `point_code`, `status`, `flow_id`, `flow_name`
- 注释：公共 API 必须有中文 JavaDoc
- 命名：类名大驼峰、方法/变量小驼峰、常量全大写下划线

* **定时任务执行逻辑**：
  - 必须按步骤从流程中一步一步执行
  - 如果第一步、第二步没有数据流转下去，就跳过并完成任务
  - 如果不满足条件，就跳过并完成任务
  - 只有有数据且能流转才继续执行下去
* **监听事务类任务执行逻辑**：
  - 等待第一步的数据传入，然后进行流转
  - 如果一直没有数据传入，就一直等待
  - 数据传入后，按照流程步骤依次执行

