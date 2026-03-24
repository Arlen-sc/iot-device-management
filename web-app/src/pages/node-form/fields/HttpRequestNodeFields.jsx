import React from 'react';
import { Form, Input, InputNumber, Select } from 'antd';

const { TextArea } = Input;
const { Option } = Select;

/** 中文注释：HTTP_REQUEST 节点 */
export default function HttpRequestNodeFields() {
  return (
    <>
      <Form.Item name="method" label="请求方法" initialValue="GET">
        <Select>
          <Option value="GET">GET</Option>
          <Option value="POST">POST</Option>
          <Option value="PUT">PUT</Option>
          <Option value="DELETE">DELETE</Option>
        </Select>
      </Form.Item>
      <Form.Item name="url" label="请求地址 (URL)" rules={[{ required: true }]}>
        <Input placeholder="http://api.example.com/data" />
      </Form.Item>
      <Form.Item name="timeout" label="超时时间 (ms)" initialValue={5000}>
        <InputNumber min={100} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="body" label="请求体 (JSON)">
        <TextArea rows={4} placeholder='{"key": "value"}' />
      </Form.Item>
    </>
  );
}
