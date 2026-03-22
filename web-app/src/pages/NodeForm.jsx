import React, { useEffect } from 'react';
import { Form, Input, InputNumber, Select, Button, Space, Switch } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';

const { TextArea } = Input;
const { Option } = Select;

// A simplified generic Node Form to replace the huge vanilla JS one
const NodeForm = ({ nodeData, onSave }) => {
  const [form] = Form.useForm();
  const type = nodeData.type;

  useEffect(() => {
    form.setFieldsValue(nodeData.config || { name: type });
  }, [nodeData, form]);

  const handleFinish = (values) => {
    onSave({
      ...nodeData,
      config: values
    });
  };

  const renderSpecificFields = () => {
    switch (type) {
      case 'SCRIPT':
        return (
          <Form.Item name="script" label="JavaScript 代码 (Rhino)" rules={[{ required: true }]}>
            <TextArea rows={15} style={{ fontFamily: 'monospace' }} />
          </Form.Item>
        );
      
      case 'DELAY':
        return (
          <Form.Item name="delayMs" label="延迟时间 (毫秒)" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        );

      case 'LOG':
        return (
          <>
            <Form.Item name="level" label="日志级别" initialValue="INFO">
              <Select>
                <Option value="INFO">INFO</Option>
                <Option value="WARN">WARN</Option>
                <Option value="ERROR">ERROR</Option>
              </Select>
            </Form.Item>
            <Form.Item name="message" label="日志消息">
              <Input placeholder="支持 ${变量名} 占位符" />
            </Form.Item>
            <Form.Item name="dataExpression" label="附加数据表达式">
              <Input placeholder="例如: payload.temperature" />
            </Form.Item>
          </>
        );

      case 'HTTP_REQUEST':
        return (
          <>
            <Form.Item name="method" label="请求方法" initialValue="GET">
              <Select>
                <Option value="GET">GET</Option>
                <Option value="POST">POST</Option>
                <Option value="PUT">PUT</Option>
                <Option value="DELETE">DELETE</Option>
              </Select>
            </Form.Item>
            <Form.Item name="url" label="请求地址 (URL)" rules={[{ required: true }]}>
              <Input placeholder="http://api.example.com/data" />
            </Form.Item>
            <Form.Item name="timeout" label="超时时间 (ms)" initialValue={5000}>
              <InputNumber min={100} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="body" label="请求体 (JSON)">
              <TextArea rows={4} placeholder='{"key": "value"}' />
            </Form.Item>
          </>
        );

      case 'CONDITION':
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
                      <Form.Item {...restField} name={[name, 'name']} label="分支名称">
                        <Input placeholder="分支名称" />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'condition', 'variable']} label="判断变量">
                        <Input placeholder="如: payload.temperature" />
                      </Form.Item>
                      <Space align="baseline">
                        <Form.Item {...restField} name={[name, 'condition', 'operator']} initialValue=">">
                          <Select style={{ width: 120 }}>
                            <Option value=">">&gt;</Option>
                            <Option value=">=">&gt;=</Option>
                            <Option value="<">&lt;</Option>
                            <Option value="<=">&lt;=</Option>
                            <Option value="==">==</Option>
                            <Option value="!=">!=</Option>
                          </Select>
                        </Form.Item>
                        <Form.Item {...restField} name={[name, 'condition', 'value']}>
                          <Input placeholder="对比值" />
                        </Form.Item>
                        <MinusCircleOutlined onClick={() => remove(name)} style={{ color: 'red' }} />
                      </Space>
                    </div>
                  ))}
                  <Form.Item>
                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                      添加分支
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form.List>
          </>
        );

      default:
        return (
          <div style={{ color: '#999', padding: '20px 0' }}>
            暂未实现此节点 React 版本的复杂配置项表单，目前仅支持修改名称。
          </div>
        );
    }
  };

  return (
    <Form form={form} layout="vertical" onFinish={handleFinish}>
      <Form.Item name="name" label="节点名称" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      
      {renderSpecificFields()}

      <Form.Item style={{ marginTop: 24, textAlign: 'right' }}>
        <Button type="primary" htmlType="submit">保存配置</Button>
      </Form.Item>
    </Form>
  );
};

export default NodeForm;