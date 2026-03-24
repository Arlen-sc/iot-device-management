import React from 'react';
import { Form, Input, InputNumber, Select, Button } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';

const { Option } = Select;

/** 中文注释：PLC_WRITE Modbus 写寄存器 */
export default function PlcWriteFields() {
  return (
    <>
      <div style={{ marginBottom: 8, fontSize: 13, color: '#666' }}>
        {/* 中文注释：用 \\u0024 代替 $，避免打包器把 "${...}" 误当成模板字符串导致「变量 is not defined」 */}
        {'Modbus TCP 写寄存器；支持多条写入项（多地址）。值支持固定数/字符串或 \u0024{变量}。'}
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
      <div style={{ marginBottom: 8, fontWeight: 500 }}>写入寄存器列表</div>
      <Form.List name="registers">
        {(fields, { add, remove }) => (
          <>
            {fields.map(({ key, name, ...restField }) => (
              <div key={key} style={{ border: '1px dashed #d9d9d9', padding: 12, marginBottom: 12, borderRadius: 4 }}>
                <Form.Item {...restField} name={[name, 'address']} label="寄存器地址" rules={[{ required: true }]}>
                  <InputNumber min={0} style={{ width: '100%' }} placeholder="如 5502（D5502 填 5502）" />
                </Form.Item>
                <Form.Item {...restField} name={[name, 'valueSource']} label="写入值 / 变量" rules={[{ required: true }]}>
                  <Input placeholder={'数字、文本或 \u0024{upstream.var}'} />
                </Form.Item>
                <Form.Item {...restField} name={[name, 'writeAs']} label="写入模式">
                  <Select placeholder="AUTO">
                    <Option value="AUTO">AUTO（数字→单字；字符串→ASCII 多字）</Option>
                    <Option value="INT">INT（单寄存器整数）</Option>
                    <Option value="STRING_ASCII">STRING_ASCII（ASCII 多寄存器）</Option>
                  </Select>
                </Form.Item>
                <MinusCircleOutlined onClick={() => remove(name)} style={{ color: 'red' }} />
              </div>
            ))}
            <Form.Item>
              <Button type="dashed" onClick={() => add({ writeAs: 'AUTO' })} block icon={<PlusOutlined />}>
                添加写入项
              </Button>
            </Form.Item>
          </>
        )}
      </Form.List>
    </>
  );
}
