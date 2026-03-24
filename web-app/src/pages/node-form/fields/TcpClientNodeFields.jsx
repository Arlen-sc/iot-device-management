import React from 'react';
import { Form, Input, InputNumber, Select, Switch } from 'antd';

const { Option } = Select;

/**
 * 中文注释：TCP_CLIENT / TCP_SEND 节点表单项
 */
export default function TcpClientNodeFields({ form }) {
  return (
    <>
      <Form.Item name="host" label="对端地址" rules={[{ required: true }]}>
        <Input placeholder="127.0.0.1" />
      </Form.Item>
      <Form.Item name="port" label="对端端口" rules={[{ required: true }]}>
        <InputNumber min={1} max={65535} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="readMode" label="读取模式" initialValue="RAW">
        <Select>
          <Option value="RAW">RAW (十六进制流)</Option>
          <Option value="LINE">LINE (按行)</Option>
        </Select>
      </Form.Item>
      <Form.Item name="sendData" label="发送数据">
        <Input placeholder={'输入发送内容，支持 \u0024{var}，可留空仅连接'} />
      </Form.Item>
      <Form.Item name="sendHex" label="作为十六进制发送" valuePropName="checked">
        <Switch />
      </Form.Item>
      <Form.Item name="waitResponse" label="等待响应" valuePropName="checked" initialValue={false}>
        <Switch />
      </Form.Item>
      <Form.Item name="outputVariable" label="输出变量名">
        <Input placeholder="接收数据写入的变量名" />
      </Form.Item>
      <Form.Item noStyle shouldUpdate={(prev, cur) => prev.waitResponse !== cur.waitResponse}>
        {() => {
          const waitResponse = !!form.getFieldValue('waitResponse');
          if (!waitResponse) {
            return null;
          }
          return (
            <div style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>
              当前为阻塞等待模式：发送后会持续等待服务端返回，不使用超时。
            </div>
          );
        }}
      </Form.Item>
    </>
  );
}
