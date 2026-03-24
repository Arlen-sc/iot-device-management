import React from 'react';
import { Form, InputNumber } from 'antd';

/** 中文注释：DELAY 延迟节点 */
export default function DelayNodeFields() {
  return (
    <Form.Item name="delayMs" label="延迟时间 (毫秒)" rules={[{ required: true }]}>
      <InputNumber min={0} style={{ width: '100%' }} />
    </Form.Item>
  );
}
