import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Modal, message, Popconfirm } from 'antd';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import TaskForm from './TaskForm';
import LogViewer from './LogViewer';
import DebugConsole from './DebugConsole';
import dayjs from 'dayjs';

const TaskList = () => {
  const [data, setData] = useState([]);
  const [runningMap, setRunningMap] = useState({});
  const [loading, setLoading] = useState(false);
  
  // Modals state
  const [formVisible, setFormVisible] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  
  const [logsVisible, setLogsVisible] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState(null);
  
  const [debugVisible, setDebugVisible] = useState(false);

  const navigate = useNavigate();

  const loadData = async () => {
    setLoading(true);
    try {
      const [tasks, running] = await Promise.all([
        api.get('/task-flow-configs'),
        api.get('/task-flow-configs/running').catch(() => [])
      ]);
      setData(tasks || []);
      
      const rMap = {};
      (running || []).forEach(r => { rMap[r.configId] = r; });
      setRunningMap(rMap);
    } catch (err) {
      message.error('加载任务列表失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 5000); // Poll for running status
    return () => clearInterval(timer);
  }, []);

  const handleStart = async (id) => {
    try {
      await api.post(`/task-flow-configs/${id}/start?interval=1000`);
      message.success('任务已启动持续监听');
      loadData();
    } catch (err) {
      message.error('启动失败: ' + err.message);
    }
  };

  const handleStop = async (id) => {
    try {
      const result = await api.post(`/task-flow-configs/${id}/stop`);
      message.success(`任务已停止 (${result.iterations || 0} 次迭代)`);
      loadData();
    } catch (err) {
      message.error('停止失败: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/task-flow-configs/${id}`);
      message.success('删除成功');
      loadData();
    } catch (err) {
      message.error('删除失败: ' + err.message);
    }
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { 
      title: '类型', 
      dataIndex: 'flowType', 
      key: 'flowType',
      render: (type) => ({ DEVICE_CONTROL: '设备控制', DATA_PROCESS: '数据处理', MIXED: '混合' }[type] || type)
    },
    { 
      title: '触发方式', 
      dataIndex: 'triggerType', 
      key: 'triggerType',
      render: (type) => ({ ONCE: '手动', SCHEDULED: '定时', EVENT: '事件' }[type] || type)
    },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status',
      render: (status) => {
        const map = {
          0: <Tag color="default">禁用</Tag>,
          1: <Tag color="processing">草稿</Tag>,
          2: <Tag color="success">已发布</Tag>
        };
        return map[status] || status;
      }
    },
    { 
      title: '最近执行', 
      key: 'lastExec',
      render: (_, record) => {
        const isRunning = runningMap[record.id];
        if (isRunning) {
          return (
            <div>
              <Tag color="processing" className="animate-pulse">运行中</Tag>
              <div style={{fontSize: 12, color: '#888', marginTop: 4}}>已迭代: {isRunning.iterationCount}次</div>
            </div>
          );
        }
        if (!record.lastExecutionTime) return '-';
        
        const execStatusMap = {
          SUCCESS: <Tag color="success">成功</Tag>,
          FAILED: <Tag color="error">失败</Tag>,
          ERROR: <Tag color="error">异常</Tag>
        };
        
        return (
          <div>
            <div style={{fontSize: 12, marginBottom: 4}}>
              {dayjs(record.lastExecutionTime).format('YYYY-MM-DD HH:mm:ss')}
            </div>
            {execStatusMap[record.lastExecutionStatus] || <Tag>{record.lastExecutionStatus}</Tag>}
          </div>
        );
      }
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => {
        const isRunning = runningMap[record.id];
        return (
          <Space size="small">
            <Button size="small" type="primary" onClick={() => navigate(`/designer/${record.id}`)}>设计</Button>
            <Button size="small" onClick={() => { setEditingTask(record); setFormVisible(true); }}>编辑</Button>
            
            {isRunning ? (
              <Button size="small" danger onClick={() => handleStop(record.id)}>停止</Button>
            ) : (
              <Button size="small" style={{background: '#722ed1', color: '#fff'}} onClick={() => handleStart(record.id)}>启动</Button>
            )}
            
            {record.triggerType === 'ONCE' && (
              <Button size="small" style={{background: '#fa8c16', color: '#fff', borderColor: '#fa8c16'}} onClick={() => { setCurrentTaskId(record.id); setDebugVisible(true); }}>调试</Button>
            )}
            
            <Button size="small" style={{background: '#13c2c2', color: '#fff', borderColor: '#13c2c2'}} onClick={() => { setCurrentTaskId(record.id); setLogsVisible(true); }}>日志</Button>
            
            <Popconfirm title="确定删除吗？" onConfirm={() => handleDelete(record.id)}>
              <Button size="small" danger>删除</Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>任务管理</h2>
        <Button type="primary" onClick={() => { setEditingTask(null); setFormVisible(true); }}>新建任务</Button>
      </div>
      
      <Table 
        columns={columns} 
        dataSource={data} 
        rowKey="id" 
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      {/* 弹窗组件 */}
      <TaskForm 
        visible={formVisible} 
        initialValues={editingTask} 
        onCancel={() => setFormVisible(false)}
        onSuccess={() => { setFormVisible(false); loadData(); }}
      />
      
      {logsVisible && (
        <LogViewer 
          visible={logsVisible} 
          taskId={currentTaskId} 
          onCancel={() => setLogsVisible(false)} 
        />
      )}
      
      {debugVisible && (
        <DebugConsole 
          visible={debugVisible} 
          taskId={currentTaskId} 
          onCancel={() => setDebugVisible(false)} 
          onSuccess={loadData}
        />
      )}
    </div>
  );
};

export default TaskList;