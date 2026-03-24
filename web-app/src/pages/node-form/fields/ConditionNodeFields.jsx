import React from 'react';
import { Form, Input, InputNumber, Select, Button, Space, AutoComplete } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';

const { Option } = Select;
import {
  CONDITION_OPERATOR_OPTIONS,
  CONDITION_ARRAY_LENGTH_OPS,
  CONDITION_UNARY_OPS,
} from '../constants';

/**
 * 中文注释：CONDITION 条件分支节点
 */
export default function ConditionNodeFields({ form, variableOptions = [] }) {
  return (
    <>
      <Form.Item name="logic" label="条件组合逻辑" initialValue="AND">
        <Select>
          <Option value="AND">满足所有条件 (AND)</Option>
          <Option value="OR">满足任一条件 (OR)</Option>
        </Select>
      </Form.Item>

      <Form.List name="branches">
        {(fields, { add, remove }) => (
          <>
            {fields.map(({ key, name, ...restField }) => (
              <div key={key} style={{ border: '1px dashed #d9d9d9', padding: 12, marginBottom: 12, borderRadius: 4 }}>
                <Form.Item
                  noStyle
                  shouldUpdate={(prev, cur) => {
                    const prevOp = prev?.branches?.[name]?.condition?.operator;
                    const curOp = cur?.branches?.[name]?.condition?.operator;
                    return prevOp !== curOp;
                  }}
                >
                  {() => {
                    const op = form.getFieldValue(['branches', name, 'condition', 'operator']);
                    const isArrayLengthMode = CONDITION_ARRAY_LENGTH_OPS.includes(op);
                    return (
                      <Form.Item
                        {...restField}
                        name={[name, 'condition', 'variable']}
                        label="判断变量"
                        help={isArrayLengthMode ? '当前为数组长度判断：请填写数组变量路径（如 payload.items）' : undefined}
                      >
                        <AutoComplete
                          options={variableOptions}
                          filterOption={(inputValue, option) =>
                            (option?.label ?? '').toLowerCase().includes(inputValue.toLowerCase())
                          }
                        >
                          <Input placeholder={isArrayLengthMode ? '如: payload.items' : '如: payload.temperature'} />
                        </AutoComplete>
                      </Form.Item>
                    );
                  }}
                </Form.Item>
                <Space align="baseline">
                  <Form.Item {...restField} name={[name, 'condition', 'operator']} initialValue=">">
                    <Select style={{ width: 180 }} options={CONDITION_OPERATOR_OPTIONS} />
                  </Form.Item>
                  <Form.Item
                    noStyle
                    shouldUpdate={(prev, cur) => {
                      const prevOp = prev?.branches?.[name]?.condition?.operator;
                      const curOp = cur?.branches?.[name]?.condition?.operator;
                      return prevOp !== curOp;
                    }}
                  >
                    {() => {
                      const op = form.getFieldValue(['branches', name, 'condition', 'operator']);
                      if (CONDITION_UNARY_OPS.includes(op)) {
                        return null;
                      }
                      if (CONDITION_ARRAY_LENGTH_OPS.includes(op)) {
                        return (
                          <Form.Item {...restField} name={[name, 'condition', 'value']}>
                            <InputNumber min={0} placeholder="数组长度值" style={{ width: 140 }} />
                          </Form.Item>
                        );
                      }
                      return (
                        <Form.Item {...restField} name={[name, 'condition', 'value']}>
                          <Input placeholder="对比值" />
                        </Form.Item>
                      );
                    }}
                  </Form.Item>
                  <MinusCircleOutlined onClick={() => remove(name)} style={{ color: 'red' }} />
                </Space>
              </div>
            ))}
            <Form.Item>
              <Button
                type="dashed"
                onClick={() => add({ condition: { operator: '>' } })}
                block
                icon={<PlusOutlined />}
              >
                添加分支
              </Button>
            </Form.Item>
          </>
        )}
      </Form.List>
    </>
  );
}
