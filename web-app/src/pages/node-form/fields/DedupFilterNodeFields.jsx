import React from 'react';
import { Form, Input, InputNumber, Select } from 'antd';

const { Option } = Select;

/** 中文注释：DEDUP_FILTER 去重过滤节点 */
export default function DedupFilterNodeFields() {
  return (
    <>
      <Form.Item name="filterType" label="过滤类型" initialValue="VALUE_CHANGED">
        <Select>
          <Option value="VALUE_CHANGED">数值变化 (VALUE_CHANGED)</Option>
          <Option value="TIME_WINDOW">时间窗口 (TIME_WINDOW)</Option>
        </Select>
      </Form.Item>
      <Form.Item name="cacheKey" label="缓存键 (唯一标识)" rules={[{ required: true }]}>
        <Input placeholder={'如: device_\u0024{deviceId}_status'} />
      </Form.Item>
      <Form.Item name="compareValue" label="对比值变量名 (仅数值变化)">
        <Input placeholder="如: payload.status" />
      </Form.Item>
      <Form.Item
        name="timeWindowMs"
        label="时间窗口 (ms)"
        initialValue={60000}
        extra="在该时间窗口内相同数据将被过滤"
      >
        <InputNumber min={1000} style={{ width: '100%' }} />
      </Form.Item>
    </>
  );
}
