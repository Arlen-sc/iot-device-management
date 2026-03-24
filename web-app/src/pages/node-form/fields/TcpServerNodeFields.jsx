import React from 'react';
import { Form, Input, InputNumber, Select, Switch } from 'antd';

const { Option } = Select;

/**
 * 中文注释：TCP_SERVER 节点表单项
 */
export default function TcpServerNodeFields({ form }) {
  return (
    <>
      <Form.Item name="operation" label="服务端操作" initialValue="START" rules={[{ required: true }]}>
        <Select>
          <Option value="START">启动监听</Option>
          <Option value="BROADCAST">广播数据</Option>
          <Option value="RECEIVE">接收数据</Option>
          <Option value="STOP">停止监听</Option>
        </Select>
      </Form.Item>
      <Form.Item name="port" label="监听端口" rules={[{ required: true }]}>
        <InputNumber min={1} max={65535} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item noStyle shouldUpdate={(prev, cur) => prev.operation !== cur.operation}>
        {() => {
          const op = form.getFieldValue('operation') || 'START';
          if (op === 'BROADCAST') {
            return (
              <>
                <Form.Item name="sendData" label="广播内容">
                        <Input placeholder={'支持 \u0024{变量}'} />
                </Form.Item>
                <Form.Item name="sendHex" label="按十六进制解析" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </>
            );
          }
          if (op === 'RECEIVE') {
            return (
              <>
                <Form.Item name="outputVariable" label="输出变量名" initialValue="tcpServerData" rules={[{ required: true }]}>
                  <Input placeholder="接收数据写入变量" />
                </Form.Item>
                <div style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>
                  服务端接收为阻塞等待模式：会持续等待客户端数据，不使用超时。
                </div>
              </>
            );
          }
          if (op === 'STOP') {
            return (
              <Form.Item name="cleanupOnStop" label="停止时清理本任务队列" valuePropName="checked" initialValue={true}>
                <Switch />
              </Form.Item>
            );
          }
          return (
            <div style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>
              同一端口在进程内只会监听一次；连续执行任务不会在 STOP 时关闭端口（见引擎逻辑）。
            </div>
          );
        }}
      </Form.Item>
    </>
  );
}
