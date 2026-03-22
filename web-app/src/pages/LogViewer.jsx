import React, { useState, useEffect } from 'react';
import { Modal, Table, Tag, Button, Popconfirm, message, Space, Spin, Empty } from 'antd';
import api from '../utils/api';
import dayjs from 'dayjs';

const LogViewer = ({ visible, taskId, onCancel }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.get(`/flow-logs/${taskId}?limit=500`);
      // Group by eventId
      const eventMap = {};
      data.forEach(log => {
        const eId = log.eventId || 'unknown';
        if (!eventMap[eId]) {
          eventMap[eId] = {
            id: eId,
            time: log.createdAt,
            logs: []
          };
        }
        eventMap[eId].logs.push(log);
      });
      
      const eventList = Object.values(eventMap).sort((a, b) => new Date(b.time) - new Date(a.time));
      setEvents(eventList);
      if (eventList.length > 0 && !selectedEventId) {
        setSelectedEventId(eventList[0].id);
      }
    } catch (err) {
      message.error('获取日志失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && taskId) {
      fetchLogs();
    }
  }, [visible, taskId]);

  const handleClear = async () => {
    try {
      await api.delete(`/flow-logs/${taskId}`);
      message.success('日志已清空');
      setEvents([]);
      setSelectedEventId(null);
    } catch (err) {
      message.error('清空失败: ' + err.message);
    }
  };

  const getLevelTag = (level) => {
    const colors = { ERROR: 'error', WARN: 'warning', INFO: 'processing' };
    return <Tag color={colors[level] || 'default'}>{level}</Tag>;
  };

  const renderDataJson = (jsonStr) => {
    if (!jsonStr || jsonStr === 'null') return null;
    try {
      const parsed = JSON.parse(jsonStr);
      return (
        <pre style={{ 
          marginTop: 6, padding: 8, background: '#f5f5f5', 
          borderRadius: 4, fontSize: 12, overflowX: 'auto',
          marginBottom: 0, color: '#666'
        }}>
          {JSON.stringify(parsed, null, 2)}
        </pre>
      );
    } catch (e) {
      return <div style={{ marginTop: 6, padding: 8, background: '#f5f5f5', borderRadius: 4, fontSize: 12 }}>{jsonStr}</div>;
    }
  };

  const columns = [
    { 
      title: '时间', 
      dataIndex: 'createdAt', 
      width: 160,
      render: (t) => dayjs(t).format('YYYY-MM-DD HH:mm:ss')
    },
    { title: '级别', dataIndex: 'level', width: 80, render: getLevelTag },
    { title: '事务类型', dataIndex: 'actionType', width: 100 },
    { title: '节点', dataIndex: 'nodeName', width: 120, render: (n, r) => n || r.nodeId || '-' },
    { 
      title: '消息与数据', 
      dataIndex: 'message',
      render: (msg, record) => (
        <div>
          <div style={{ color: record.level === 'ERROR' ? '#ff4d4f' : 'inherit' }}>{msg}</div>
          {renderDataJson(record.dataJson)}
        </div>
      )
    },
  ];

  const currentEventLogs = events.find(e => e.id === selectedEventId)?.logs || [];

  return (
    <Modal
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 32 }}>
          <span>任务执行日志</span>
          <Space>
            <Button size="small" onClick={fetchLogs}>刷新</Button>
            <Popconfirm title="确定清空所有日志？" onConfirm={handleClear}>
              <Button size="small" danger>清空</Button>
            </Popconfirm>
          </Space>
        </div>
      }
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={1100}
      bodyStyle={{ padding: 0, height: '70vh', display: 'flex' }}
      destroyOnClose
    >
      <div style={{ width: 250, borderRight: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 16px', fontWeight: 'bold', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
          执行事件
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <Spin spinning={loading}>
            {events.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> : 
              events.map(ev => (
                <div 
                  key={ev.id}
                  onClick={() => setSelectedEventId(ev.id)}
                  style={{ 
                    padding: '12px 16px', 
                    borderBottom: '1px solid #f0f0f0',
                    cursor: 'pointer',
                    background: selectedEventId === ev.id ? '#e6f7ff' : '#fff',
                    transition: 'background 0.3s'
                  }}
                >
                  <div style={{ fontSize: 13, color: '#333' }}>{dayjs(ev.time).format('YYYY-MM-DD HH:mm:ss')}</div>
                  <div style={{ fontSize: 12, color: '#999', marginTop: 4, fontFamily: 'monospace' }}>ID: {ev.id.substring(0,8)}...</div>
                </div>
              ))
            }
          </Spin>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {selectedEventId ? (
          <Table 
            columns={columns} 
            dataSource={currentEventLogs} 
            rowKey="id" 
            pagination={false}
            size="small"
          />
        ) : (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
            请在左侧选择一个执行事件
          </div>
        )}
      </div>
    </Modal>
  );
};

export default LogViewer;