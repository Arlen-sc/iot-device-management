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
    let initialValues = { ...nodeData.config } || { name: type };
    
    // 反向解析特殊格式以适应表单
    if (initialValues.operations) {
      initialValues.operations = initialValues.operations.map(op => ({
        ...op,
        paramsStr: op.params ? JSON.stringify(op.params) : undefined
      }));
    }

    if (initialValues.branches) {
      initialValues.branches = initialValues.branches.map(branch => {
        if (branch.condition && branch.condition.left) {
          return {
            ...branch,
            condition: {
              ...branch.condition,
              variable: branch.condition.left,
              value: branch.condition.right
            }
          };
        }
        return branch;
      });
    }

    form.setFieldsValue(initialValues);
  }, [nodeData, form, type]);

  const handleFinish = (values) => {
    // 预处理一些特殊的嵌套数据格式
    if (values.operations) {
      values.operations = values.operations.map(op => {
        if (op.paramsStr) {
          try {
            op.params = JSON.parse(op.paramsStr);
          } catch (e) {
            console.error("Invalid JSON in paramsStr:", op.paramsStr);
          }
          delete op.paramsStr;
        }
        return op;
      });
    }

    if (values.branches) {
      values.branches = values.branches.map(branch => {
        if (branch.condition && branch.condition.variable) {
           branch.condition.left = branch.condition.variable;
           branch.condition.right = branch.condition.value;
           delete branch.condition.variable;
           delete branch.condition.value;
        }
        return branch;
      });
    }

    onSave({
      ...nodeData,
      config: values
    });
  };

  const renderSpecificFields = () => {
    switch (type) {
      case 'SCRIPT':
        return (
          <Form.Item name="operations" label="脚本处理操作 (Operations)">
            <Form.List name="operations">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <div key={key} style={{ border: '1px dashed #d9d9d9', padding: 12, marginBottom: 12, borderRadius: 4 }}>
                      <Form.Item {...restField} name={[name, 'op']} label="操作类型" initialValue="HEX_STRING_TO_DEC_ARRAY">
                        <Select>
                          <Option value="HEX_STRING_TO_DEC_ARRAY">HEX_STRING_TO_DEC_ARRAY</Option>
                          <Option value="ARRAY_LENGTH">ARRAY_LENGTH</Option>
                          <Option value="ARRAY_SLICE">ARRAY_SLICE</Option>
                          <Option value="JSON_BUILD">JSON_BUILD</Option>
                          <Option value="STRING_TO_HEX">STRING_TO_HEX</Option>
                          <Option value="FORMAT_VALUES">FORMAT_VALUES</Option>
                          <Option value="STRIP_PREFIX">STRIP_PREFIX</Option>
                          <Option value="HEX_TO_STRING">HEX_TO_STRING</Option>
                          <Option value="JSON_PARSE">JSON_PARSE</Option>
                        </Select>
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
          </Form.Item>
        );

      case 'TCP_CLIENT':
        return (
          <>
            <Form.Item name="host" label="主机地址" rules={[{ required: true }]}>
              <Input placeholder="127.0.0.1" />
            </Form.Item>
            <Form.Item name="port" label="端口" rules={[{ required: true }]}>
              <InputNumber min={1} max={65535} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="readMode" label="读取模式" initialValue="RAW">
              <Select>
                <Option value="RAW">RAW (十六进制流)</Option>
                <Option value="LINE">LINE (按行)</Option>
              </Select>
            </Form.Item>
            <Form.Item name="sendData" label="发送数据">
              <Input placeholder="输入发送内容，支持 ${var}" />
            </Form.Item>
            <Form.Item name="sendHex" label="作为十六进制发送" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="outputVariable" label="输出变量名">
              <Input placeholder="接收到的数据存入此变量" />
            </Form.Item>
            <Form.Item name="timeout" label="超时时间 (ms)" initialValue={5000}>
              <InputNumber min={100} style={{ width: '100%' }} />
            </Form.Item>
          </>
        );

      case 'TCP_SERVER':
        return (
          <>
            <Form.Item name="port" label="监听端口" rules={[{ required: true }]}>
              <InputNumber min={1} max={65535} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="operation" label="服务器操作" initialValue="START">
              <Select>
                <Option value="START">启动 (START)</Option>
                <Option value="STOP">停止 (STOP)</Option>
                <Option value="BROADCAST">广播 (BROADCAST)</Option>
                <Option value="RECEIVE">接收数据 (RECEIVE)</Option>
              </Select>
            </Form.Item>
            <Form.Item name="sendData" label="广播数据 (仅BROADCAST)">
              <Input placeholder="输入广播内容，支持 ${var}" />
            </Form.Item>
            <Form.Item name="sendHex" label="作为十六进制广播" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="outputVariable" label="输出变量名 (仅RECEIVE)">
              <Input placeholder="接收到的数据存入此变量" />
            </Form.Item>
            <Form.Item name="timeout" label="接收超时 (ms)" initialValue={10000}>
              <InputNumber min={100} style={{ width: '100%' }} />
            </Form.Item>
          </>
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