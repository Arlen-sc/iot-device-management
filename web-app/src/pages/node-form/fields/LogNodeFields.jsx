import React from 'react';
import { Form, Input, Select } from 'antd';

const { Option } = Select;

/** 中文注释：LOG 日志节点 */
export default function LogNodeFields() {
  return (
    <>
      <Form.Item name="level" label="日志级别" initialValue="INFO">
        <Select>
          <Option value="INFO">INFO</Option>
          <Option value="WARN">WARN</Option>
          <Option value="ERROR">ERROR</Option>
        </Select>
      </Form.Item>
      <Form.Item name="message" label="日志消息">
        <Input placeholder={'支持 \u0024{变量名} 占位符'} />
      </Form.Item>
      <Form.Item name="dataExpression" label="附加数据表达式">
        <Input placeholder="例如: payload.temperature" />
      </Form.Item>
    </>
  );
}
