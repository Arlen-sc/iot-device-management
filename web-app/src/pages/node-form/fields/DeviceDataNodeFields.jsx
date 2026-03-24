import React from 'react';
import { Form, Input, Select } from 'antd';
import DeviceSummaryCard from './DeviceSummaryCard';

const { Option } = Select;

/**
 * 中文注释：DEVICE_DATA 设备数据节点
 */
export default function DeviceDataNodeFields({
  form,
  deviceOptions = [],
  selectedDevice,
  handleDeviceChange,
}) {
  const dataOperation = Form.useWatch('operation', form);
  return (
    <>
      <Form.Item name="deviceId" label="目标设备" rules={[{ required: true }]}>
        <Select
          placeholder="请选择要操作的设备"
          showSearch
          allowClear
          options={deviceOptions}
          optionFilterProp="label"
          onChange={handleDeviceChange}
        />
      </Form.Item>

      <DeviceSummaryCard device={selectedDevice} />

      <Form.Item name="operation" label="数据操作" initialValue="READ">
        <Select>
          <Option value="READ">读取属性 (READ)</Option>
          <Option value="WRITE">设置属性 (WRITE)</Option>
        </Select>
      </Form.Item>

      <Form.Item name="pointCode" label="属性编码 (Property Key)" rules={[{ required: true }]}>
        <Input placeholder="例如: temperature, humidity, switch_status" />
      </Form.Item>

      {dataOperation === 'WRITE' && (
        <Form.Item name="writeValue" label="要写入的值">
            <Input placeholder={'支持固定值或 \u0024{变量名}'} />
        </Form.Item>
      )}

      {dataOperation !== 'WRITE' && (
        <Form.Item name="outputVariable" label="输出变量名">
          <Input placeholder="读取结果将存入此变量，如: deviceTemp" />
        </Form.Item>
      )}
    </>
  );
}
