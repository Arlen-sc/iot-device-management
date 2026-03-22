import React, { useEffect } from 'react';
import { Modal, Form, Input, Select, message } from 'antd';
import api from '../utils/api';

const { Option } = Select;
const { TextArea } = Input;

const TaskForm = ({ visible, initialValues, onCancel, onSuccess }) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible) {
      if (initialValues) {
        form.setFieldsValue(initialValues);
      } else {
        form.resetFields();
        form.setFieldsValue({
          flowType: 'MIXED',
          triggerType: 'ONCE',
          executionMode: 'SINGLE'
        });
      }
    }
  }, [visible, initialValues, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (initialValues) {
        await api.put(`/task-flow-configs/${initialValues.id}`, values);
        message.success('修改成功');
      } else {
        await api.post('/task-flow-configs', values);
        message.success('创建成功');
      }
      onSuccess();
    } catch (error) {
      if (error.errorFields) return; // Validation error
      message.error(`${initialValues ? '修改' : '创建'}失败: ${error.message}`);
    }
  };

  return (
    <Modal
      title={initialValues ? '编辑任务' : '新建任务'}
      open={visible}
      onOk={handleSubmit}
      onCancel={onCancel}
      width={600}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="任务名称" rules={[{ required: true, message: '请输入任务名称' }]}>
          <Input placeholder="例如：车间温湿度超标报警" />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <TextArea rows={3} placeholder="简要描述该任务的用途" />
        </Form.Item>
        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item name="flowType" label="流程类型" style={{ flex: 1 }}>
            <Select>
              <Option value="DEVICE_CONTROL">设备控制</Option>
              <Option value="DATA_PROCESS">数据处理</Option>
              <Option value="MIXED">混合流程</Option>
            </Select>
          </Form.Item>
          <Form.Item name="triggerType" label="触发方式" style={{ flex: 1 }}>
            <Select>
              <Option value="ONCE">手动执行单次</Option>
              <Option value="SCHEDULED">定时触发</Option>
              <Option value="EVENT">设备事件触发</Option>
            </Select>
          </Form.Item>
        </div>
        <Form.Item 
          noStyle 
          shouldUpdate={(prev, curr) => prev.triggerType !== curr.triggerType}
        >
          {({ getFieldValue }) => {
            return getFieldValue('triggerType') === 'SCHEDULED' ? (
              <Form.Item name="cronExpression" label="Cron 表达式" rules={[{ required: true, message: '请输入 Cron 表达式' }]}>
                <Input placeholder="例如: 0 0/5 * * * ?" />
              </Form.Item>
            ) : null;
          }}
        </Form.Item>
        <Form.Item name="executionMode" label="执行模式">
          <Select>
            <Option value="SINGLE">单例执行 (推荐)</Option>
            <Option value="BY_DEVICE">按设备并发</Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default TaskForm;