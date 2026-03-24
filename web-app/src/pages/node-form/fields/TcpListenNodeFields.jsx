import React from 'react';
import { Form, Input, InputNumber } from 'antd';

/**
 * 中文注释：TCP_LISTEN 节点表单项
 */
export default function TcpListenNodeFields() {
  return (
    <>
      <Form.Item name="host" label="对端地址" rules={[{ required: true }]}>
        <Input placeholder="127.0.0.1" />
      </Form.Item>
      <Form.Item name="port" label="对端端口" rules={[{ required: true }]}>
        <InputNumber min={1} max={65535} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="timeout" label="读取超时 (ms)" initialValue={5000}>
        <InputNumber min={100} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="outputVariable" label="输出变量名" rules={[{ required: true }]} initialValue="tcpData">
        <Input placeholder="接收到的数据存入此变量" />
      </Form.Item>
    </>
  );
}
