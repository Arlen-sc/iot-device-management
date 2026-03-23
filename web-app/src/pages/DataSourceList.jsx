import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Modal, Form, Input, Select, Popconfirm, message, Card, Typography, Spin } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ApiOutlined } from '@ant-design/icons';
import api from '../utils/api';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const DataSourceList = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [editingSource, setEditingSource] = useState(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [form] = Form.useForm();
  
  // 监听数据库类型变化以动态设置默认驱动和URL
  const dbType = Form.useWatch('type', form);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/data-sources');
      setData(res || []);
    } catch (err) {
      message.error('加载数据源列表失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 当选择不同数据库类型时，自动填充默认驱动和URL模板
  useEffect(() => {
    if (formVisible && !editingSource && dbType) {
        const fetchDefaults = async () => {
            try {
                const driverRes = await api.get(`/data-sources/default-driver/${dbType}`);
                const urlRes = await api.get(`/data-sources/default-url/${dbType}`);
                // 只有在用户没有手动修改过的情况下才覆盖
                const currentDriver = form.getFieldValue('driverClassName');
                if (!currentDriver || currentDriver.includes('jdbc')) {
                    form.setFieldsValue({ 
                        driverClassName: driverRes,
                        url: urlRes
                    });
                }
            } catch (e) {
                console.error("Failed to load defaults", e);
            }
        };
        fetchDefaults();
    }
  }, [dbType, formVisible, editingSource, form]);

  const handleEdit = (record) => {
    setEditingSource(record);
    form.setFieldsValue(record);
    setFormVisible(true);
  };

  const handleAdd = () => {
    setEditingSource(null);
    form.resetFields();
    form.setFieldsValue({ type: 'mysql', status: 1 });
    setFormVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/data-sources/${id}`);
      message.success('删除成功');
      loadData();
    } catch (err) {
      message.error('删除失败: ' + err.message);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingSource) {
        await api.put(`/data-sources/${editingSource.id}`, values);
        message.success('修改成功');
      } else {
        await api.post('/data-sources', values);
        message.success('添加成功');
      }
      setFormVisible(false);
      loadData();
    } catch (err) {
      if (err.errorFields) return;
      message.error('操作失败: ' + err.message);
    }
  };

  const handleTestConnection = async () => {
    try {
      const values = await form.validateFields();
      setTestingConnection(true);
      const success = await api.post('/data-sources/test-connection', values);
      if (success) {
          message.success('连接测试成功！');
      } else {
          message.error('连接测试失败，请检查配置或网络。');
      }
    } catch (err) {
      if (err.errorFields) return; // validation error
      message.error('测试异常: ' + err.message);
    } finally {
      setTestingConnection(false);
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '数据源名称', dataIndex: 'name', key: 'name' },
    { 
      title: '类型', 
      dataIndex: 'type', 
      key: 'type',
      render: t => <Tag color="blue">{t?.toUpperCase()}</Tag>
    },
    { title: '连接地址', dataIndex: 'url', key: 'url', ellipsis: true },
    { title: '用户名', dataIndex: 'username', key: 'username' },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status',
      render: s => <Tag color={s === 1 ? 'success' : 'error'}>{s === 1 ? '启用' : '禁用'}</Tag>
    },
    { 
      title: '更新时间', 
      dataIndex: 'updateTime', 
      key: 'updateTime',
      render: t => t ? dayjs(t).format('YYYY-MM-DD HH:mm:ss') : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm title="确定删除此数据源吗？相关任务节点可能受影响" onConfirm={() => handleDelete(record.id)}>
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-container">
      <Card bordered={false} style={{ borderRadius: 8, boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}>
        <div className="page-header">
          <Title level={4} style={{ margin: 0, color: '#0f172a' }}>数据源管理</Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>添加数据源</Button>
        </div>
        
        <Table 
          columns={columns} 
          dataSource={data} 
          rowKey="id" 
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingSource ? '编辑数据源' : '添加数据源'}
        open={formVisible}
        onCancel={() => setFormVisible(false)}
        destroyOnClose
        width={600}
        footer={[
          <Button key="test" icon={<ApiOutlined />} onClick={handleTestConnection} loading={testingConnection}>
            测试连接
          </Button>,
          <Button key="cancel" onClick={() => setFormVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={handleSubmit} loading={loading}>
            保存
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="数据源名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：生产环境MySQL" />
          </Form.Item>
          
          <Form.Item name="type" label="数据库类型" rules={[{ required: true }]}>
            <Select>
              <Option value="mysql">MySQL</Option>
              <Option value="oracle">Oracle</Option>
              <Option value="postgresql">PostgreSQL</Option>
              <Option value="sqlserver">SQL Server</Option>
              <Option value="sqlite">SQLite</Option>
            </Select>
          </Form.Item>
          
          <Form.Item name="url" label="JDBC URL" rules={[{ required: true }]}>
            <TextArea rows={2} placeholder="jdbc:mysql://localhost:3306/db_name?useSSL=false" />
          </Form.Item>
          
          <Form.Item name="driverClassName" label="驱动类名" rules={[{ required: true }]}>
            <Input placeholder="com.mysql.cj.jdbc.Driver" />
          </Form.Item>
          
          <div style={{ display: 'flex', gap: '16px' }}>
            <Form.Item name="username" label="用户名" style={{ flex: 1 }}>
                <Input placeholder="数据库账号" />
            </Form.Item>
            <Form.Item name="password" label="密码" style={{ flex: 1 }}>
                <Input.Password placeholder="数据库密码" />
            </Form.Item>
          </div>
          
          <Form.Item name="status" label="状态" initialValue={1}>
            <Select>
              <Option value={1}>启用</Option>
              <Option value={0}>禁用</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DataSourceList;
