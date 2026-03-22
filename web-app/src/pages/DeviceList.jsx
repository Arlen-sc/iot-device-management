import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Modal, Form, Input, Select, Popconfirm, message, Card, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../utils/api';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const DeviceList = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/devices');
      setData(res || []);
    } catch (err) {
      message.error('加载设备列表失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleEdit = (record) => {
    setEditingDevice(record);
    form.setFieldsValue(record);
    setFormVisible(true);
  };

  const handleAdd = () => {
    setEditingDevice(null);
    form.resetFields();
    form.setFieldsValue({ protocolType: 'HTTP', status: 'OFFLINE' });
    setFormVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/devices/${id}`);
      message.success('删除成功');
      loadData();
    } catch (err) {
      message.error('删除失败: ' + err.message);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingDevice) {
        await api.put(`/devices/${editingDevice.id}`, values);
        message.success('修改成功');
      } else {
        await api.post('/devices', values);
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
    { title: '设备名称', dataIndex: 'name', key: 'name' },
    { 
      title: '协议类型', 
      dataIndex: 'protocolType', 
      key: 'protocolType',
      render: t => <Tag color="blue">{t}</Tag>
    },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status',
      render: s => <Tag color={s === 'ONLINE' ? 'success' : 'default'}>{s}</Tag>
    },
    { 
      title: '最后在线时间', 
      dataIndex: 'lastOnlineTime', 
      key: 'lastOnlineTime',
      render: t => t ? dayjs(t).format('YYYY-MM-DD HH:mm:ss') : '-'
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm title="确定删除吗？" onConfirm={() => handleDelete(record.id)}>
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
          <Title level={4} style={{ margin: 0, color: '#0f172a' }}>设备管理</Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>添加设备</Button>
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
        title={editingDevice ? '编辑设备' : '添加设备'}
        open={formVisible}
        onOk={handleSubmit}
        onCancel={() => setFormVisible(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="设备名称" rules={[{ required: true, message: '请输入设备名称' }]}>
            <Input placeholder="如：1号温湿度传感器" />
          </Form.Item>
          <Form.Item name="protocolType" label="协议类型" rules={[{ required: true }]}>
            <Select>
              <Option value="HTTP">HTTP/HTTPS</Option>
              <Option value="MQTT">MQTT</Option>
              <Option value="TCP">TCP Socket</Option>
              <Option value="MODBUS_TCP">Modbus TCP</Option>
              <Option value="PLC_S7">Siemens S7</Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DeviceList;