import React from 'react';
import { Form, Input, InputNumber, Button } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';

/** 中文注释：PLC_READ Modbus 读保持寄存器 */
export default function PlcReadFields() {
  return (
    <>
      <div style={{ marginBottom: 8, fontSize: 13, color: '#666' }}>
        Modbus TCP 读保持寄存器（FC 0x03）。可配置多段起始地址与连续寄存器个数。
        <br />从站号(unitId)为高级参数，当前界面不填，后端默认使用 1。
      </div>
      <Form.Item name="host" label="PLC IP (host)" rules={[{ required: true }]}>
        <Input placeholder="192.168.1.100" />
      </Form.Item>
      <Form.Item name="port" label="端口" initialValue={502}>
        <InputNumber min={1} max={65535} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="timeout" label="超时 (ms)" initialValue={5000}>
        <InputNumber min={100} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="outputVariable" label="输出变量名" initialValue="plcReadResult">
        <Input placeholder={'默认 plcReadResult，流程内 \u0024{变量} 引用'} />
      </Form.Item>
      <div style={{ marginBottom: 8, fontWeight: 500 }}>读取项（多段）</div>
      <Form.List name="reads">
        {(fields, { add, remove }) => (
          <>
            {fields.map(({ key, name, ...restField }) => (
              <div key={key} style={{ border: '1px dashed #d9d9d9', padding: 12, marginBottom: 12, borderRadius: 4 }}>
                <Form.Item {...restField} name={[name, 'address']} label="起始寄存器地址" rules={[{ required: true }]}>
                  <InputNumber min={0} style={{ width: '100%' }} placeholder="如 5502（D5502 填 5502）" />
                </Form.Item>
                <Form.Item {...restField} name={[name, 'quantity']} label="寄存器个数">
                  <InputNumber min={1} max={125} style={{ width: '100%' }} placeholder="默认 1" />
                </Form.Item>
                <MinusCircleOutlined onClick={() => remove(name)} style={{ color: 'red' }} />
              </div>
            ))}
            <Form.Item>
              <Button type="dashed" onClick={() => add({ address: undefined, quantity: 1 })} block icon={<PlusOutlined />}>
                添加读取段
              </Button>
            </Form.Item>
          </>
        )}
      </Form.List>
    </>
  );
}
