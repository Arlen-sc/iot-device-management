import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, Popconfirm, message } from 'antd';
import api from '../utils/api';
import dayjs from 'dayjs';

const { TextArea } = Input;

const CategoryList = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/categories');
      setData(res || []);
    } catch (err) {
      message.error('加载分类列表失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleEdit = (record) => {
    setEditingCategory(record);
    form.setFieldsValue(record);
    setFormVisible(true);
  };

  const handleAdd = () => {
    setEditingCategory(null);
    form.resetFields();
    setFormVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/categories/${id}`);
      message.success('删除成功');
      loadData();
    } catch (err) {
      message.error('删除失败: ' + err.message);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingCategory) {
        await api.put(`/categories/${editingCategory.id}`, values);
        message.success('修改成功');
      } else {
        await api.post('/categories', values);
        message.success('添加成功');
      }
      setFormVisible(false);
      loadData();
    } catch (err) {
      if (err.errorFields) return;
      message.error('操作失败: ' + err.message);
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 100 },
    { title: '分类名称', dataIndex: 'name', key: 'name' },
    { title: '描述', dataIndex: 'description', key: 'description' },
    { 
      title: '创建时间', 
      dataIndex: 'createdAt', 
      key: 'createdAt',
      render: t => t ? dayjs(t).format('YYYY-MM-DD HH:mm:ss') : '-'
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定要删除该分类吗？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>设备分类</h2>
        <Button type="primary" onClick={handleAdd}>添加分类</Button>
      </div>

      <Table 
        columns={columns} 
        dataSource={data} 
        rowKey="id" 
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingCategory ? '编辑分类' : '添加分类'}
        open={formVisible}
        onOk={handleSubmit}
        onCancel={() => setFormVisible(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="分类名称" rules={[{ required: true, message: '请输入分类名称' }]}>
            <Input placeholder="如：温湿度传感器" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CategoryList;