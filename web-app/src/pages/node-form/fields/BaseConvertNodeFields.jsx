import React from 'react';
import { Form, Input, InputNumber, Select, Switch } from 'antd';

const { Option } = Select;

/**
 * 中文注释：BASE_CONVERT 进制转换节点
 */
export default function BaseConvertNodeFields({ form }) {
  return (
    <>
      <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 500 }}>进制转换配置</div>
      <Form.Item
        name="mode"
        label="转换模式"
        initialValue="HEX_TO_DEC"
        rules={[{ required: true, message: '请选择转换模式' }]}
      >
        <Select>
          <Option value="HEX_TO_DEC">16进制 → 10进制</Option>
          <Option value="DEC_TO_HEX">10进制 → 16进制</Option>
          <Option value="BIN_TO_DEC">2进制 → 10进制</Option>
          <Option value="DEC_TO_BIN">10进制 → 2进制</Option>
          <Option value="HEX_TO_BIN">16进制 → 2进制</Option>
          <Option value="BIN_TO_HEX">2进制 → 16进制</Option>
          <Option value="CUSTOM">自定义进制 (from/to)</Option>
        </Select>
      </Form.Item>
      <Form.Item name="source" label="源变量" rules={[{ required: true, message: '请输入源变量' }]}>
        <Input placeholder="如: payload.hexValue" />
      </Form.Item>
      <Form.Item name="target" label="目标变量" rules={[{ required: true, message: '请输入目标变量' }]}>
        <Input placeholder="如: payload.decValue" />
      </Form.Item>
      <Form.Item noStyle shouldUpdate={(prev, cur) => prev.mode !== cur.mode}>
        {() => {
          const mode = form.getFieldValue('mode') || 'HEX_TO_DEC';
          if (mode !== 'CUSTOM') {
            return null;
          }
          return (
            <>
              <Form.Item
                name="fromBase"
                label="源进制"
                initialValue={16}
                rules={[{ required: true, message: '请输入源进制' }]}
              >
                <InputNumber min={2} max={36} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                name="toBase"
                label="目标进制"
                initialValue={10}
                rules={[{ required: true, message: '请输入目标进制' }]}
              >
                <InputNumber min={2} max={36} style={{ width: '100%' }} />
              </Form.Item>
            </>
          );
        }}
      </Form.Item>
      <Form.Item name="uppercase" label="输出字母大写" valuePropName="checked" initialValue={true}>
        <Switch />
      </Form.Item>
      <Form.Item name="withPrefix" label="附加进制前缀(0x/0b)" valuePropName="checked" initialValue={false}>
        <Switch />
      </Form.Item>
    </>
  );
}
