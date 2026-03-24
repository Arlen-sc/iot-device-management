import React from 'react';
import { Form, Input, Select, Button } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { SCRIPT_OPERATION_OPTIONS } from '../constants';

/**
 * 中文注释：SCRIPT 节点表单项
 */
export default function ScriptNodeFields() {
  return (
    <>
      <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 500 }}>脚本处理操作 (Operations)</div>
      <Form.List name="operations">
        {(fields, { add, remove }) => (
          <>
            {fields.map(({ key, name, ...restField }) => (
              <div key={key} style={{ border: '1px dashed #d9d9d9', padding: 12, marginBottom: 12, borderRadius: 4 }}>
                <Form.Item {...restField} name={[name, 'op']} label="操作类型" initialValue="HEX_STRING_TO_DEC_ARRAY">
                  <Select
                    showSearch
                    optionFilterProp="label"
                    options={SCRIPT_OPERATION_OPTIONS}
                    placeholder="请选择操作类型"
                  />
                </Form.Item>
                <Form.Item {...restField} name={[name, 'source']} label="源变量">
                  <Input placeholder="输入源变量名称" />
                </Form.Item>
                <Form.Item {...restField} name={[name, 'target']} label="目标变量">
                  <Input placeholder="输入目标变量名称" />
                </Form.Item>
                <Form.Item {...restField} name={[name, 'paramsStr']} label="附加参数 (JSON)">
                  <Input placeholder='如: {"prefix": "v", "delimiter": ","}' />
                </Form.Item>
                <MinusCircleOutlined onClick={() => remove(name)} style={{ color: 'red' }} />
              </div>
            ))}
            <Form.Item>
              <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                添加操作
              </Button>
            </Form.Item>
          </>
        )}
      </Form.List>
    </>
  );
}
