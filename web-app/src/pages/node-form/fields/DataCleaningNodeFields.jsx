import React from 'react';
import { Form, InputNumber, Switch } from 'antd';

/** 中文注释：DATA_CLEANING 节点 */
export default function DataCleaningNodeFields() {
  return (
    <>
      <Form.Item name="enableNullCheck" label="启用空值检查" valuePropName="checked" initialValue={true}>
        <Switch />
      </Form.Item>
      <Form.Item name="enableRangeCheck" label="启用范围检查" valuePropName="checked" initialValue={true}>
        <Switch />
      </Form.Item>
      <Form.Item name="enableZScore" label="启用 Z-Score 异常检测" valuePropName="checked" initialValue={false}>
        <Switch />
      </Form.Item>
      <Form.Item name="zScoreThreshold" label="Z-Score 阈值" initialValue={3.0}>
        <InputNumber min={0.1} step={0.1} style={{ width: '100%' }} />
      </Form.Item>
    </>
  );
}
