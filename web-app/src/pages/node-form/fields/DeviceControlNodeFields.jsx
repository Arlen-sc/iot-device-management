import React from 'react';
import { Form, Input, InputNumber, Select, Button, Space } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import DeviceSummaryCard from './DeviceSummaryCard';

const { Option } = Select;

/**
 * 中文注释：DEVICE_CONTROL 设备控制节点
 */
export default function DeviceControlNodeFields({
  deviceOptions = [],
  operationTypes = [],
  selectedDevice,
  selectedOpDesc,
  handleDeviceChange,
  handleOperationChange,
}) {
  return (
    <>
      <Form.Item name="deviceId" label="目标设备" rules={[{ required: true }]}>
        <Select
          placeholder="必须指定要控制的具体设备"
          showSearch
          allowClear
          options={deviceOptions}
          optionFilterProp="label"
          onChange={handleDeviceChange}
        />
      </Form.Item>

      <DeviceSummaryCard device={selectedDevice} />

      <Form.Item name="operationType" label="操作类型" rules={[{ required: true }]}>
        <Select placeholder="请选择要执行的控制指令" onChange={handleOperationChange}>
          {operationTypes.map((op) => (
            <Option key={op.code} value={op.code}>
              {op.name} ({op.code})
            </Option>
          ))}
        </Select>
      </Form.Item>

      {selectedOpDesc && (
        <div
          style={{
            color: '#fa8c16',
            fontSize: '12px',
            marginBottom: '24px',
            marginTop: '-12px',
            lineHeight: '1.5',
          }}
        >
          💡 <strong>指令说明:</strong> {selectedOpDesc}
        </div>
      )}

      <div style={{ marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>指令参数设置</div>
      <div style={{ color: '#888', fontSize: '12px', marginBottom: '16px', lineHeight: '1.4' }}>
        根据上方选择的【操作类型】，在此处配置需要下发给设备的具体参数键值对。
        <br />
        例如控制空调时：参数名(键)填 <code>temperature</code>，参数值填 <code>26</code>。
      </div>

      <Form.List name="paramsList">
        {(fields, { add, remove }) => (
          <>
            {fields.map(({ key, name, ...restField }) => (
              <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                <Form.Item {...restField} name={[name, 'key']} rules={[{ required: true, message: '请输入参数名' }]}>
                  <Input placeholder="参数名 (如: color)" />
                </Form.Item>
                <Form.Item {...restField} name={[name, 'value']} rules={[{ required: true, message: '请输入参数值' }]}>
                  <Input placeholder={'参数值 (支持 \u0024{var})'} />
                </Form.Item>
                <MinusCircleOutlined onClick={() => remove(name)} style={{ color: '#ff4d4f' }} />
              </Space>
            ))}
            <Form.Item>
              <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                添加参数
              </Button>
            </Form.Item>
          </>
        )}
      </Form.List>

      <Form.Item name="timeout" label="超时时间 (ms)" initialValue={5000}>
        <InputNumber min={100} style={{ width: '100%' }} />
      </Form.Item>
    </>
  );
}
