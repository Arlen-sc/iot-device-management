import React, { useState } from 'react';
import { Modal, Button, Tag, Table, Space, message, Spin } from 'antd';
import api from '../utils/api';

const DebugConsole = ({ visible, taskId, onCancel, onSuccess }) => {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await api.post(`/task-flow-configs/${taskId}/execute`);
      setResult(res);
      if (onSuccess) onSuccess();
    } catch (err) {
      setResult({
        status: 'FAILED',
        logs: [{
          timestamp: new Date().toISOString(),
          level: 'ERROR',
          message: '执行异常: ' + err.message
        }]
      });
    } finally {
      setRunning(false);
    }
  };

  const renderLogEntry = (log, idx) => {
    if (typeof log === 'string') {
      return <div key={idx} style={{ color: '#a0e8af', marginBottom: 8 }}>{log}</div>;
    }

    let color = '#a0e8af';
    if (log.level === 'ERROR') color = '#ff6b6b';
    else if (log.level === 'WARN') color = '#ffd93d';
    else if (log.level === 'SYSTEM') color = '#1890ff';
    else if (log.message?.includes('【流程流转】')) color = '#b37feb';
    else if (log.message?.includes('【节点执行成功】')) color = '#52c41a';

    return (
      <div key={idx} style={{ color, marginBottom: 8, paddingBottom: 8, borderBottom: '1px dashed #333' }}>
        <div style={{ color: '#666', fontSize: 11, marginBottom: 4 }}>
          [{log.timestamp}] 
          {log.actionType && log.actionType !== '-' && <Tag color="blue" style={{marginLeft: 8}}>{log.actionType}</Tag>}
          {log.nodeName && log.nodeName !== '-' && <Tag color="default">{log.nodeName}</Tag>}
          {log.durationMs != null && <Tag color="green">耗时: {log.durationMs}ms</Tag>}
        </div>
        <div style={{ paddingLeft: 8, borderLeft: `2px solid ${color}` }}>
          {log.message}
          {log.data && (
            <pre style={{ 
              marginTop: 4, padding: 6, background: 'rgba(0,0,0,0.2)', 
              borderRadius: 4, fontSize: 11, color: '#888', whiteSpace: 'pre-wrap', margin: 0 
            }}>
              {typeof log.data === 'string' ? log.data : JSON.stringify(log.data, null, 2)}
            </pre>
          )}
        </div>
      </div>
    );
  };

  const varsColumns = [
    { title: '变量名', dataIndex: 'key', width: '40%', render: t => <span style={{color: '#1890ff', fontFamily: 'monospace'}}>{t}</span> },
    { title: '值', dataIndex: 'value', render: t => <span style={{fontFamily: 'monospace'}}>{t}</span> }
  ];

  const varsData = result?.variables ? Object.keys(result.variables).map(k => ({
    key: k, 
    value: typeof result.variables[k] === 'object' ? JSON.stringify(result.variables[k]) : String(result.variables[k])
  })) : [];

  return (
    <Modal
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 32 }}>
          <span>流程调试控制台</span>
          <Button type="primary" onClick={handleRun} loading={running} style={{ background: '#52c41a' }}>
            {running ? '运行中...' : '开始运行'}
          </Button>
        </div>
      }
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={1000}
      bodyStyle={{ height: '70vh', padding: 0 }}
      destroyOnClose
    >
      <div style={{ display: 'flex', height: '100%', padding: 16, gap: 16 }}>
        {/* Logs */}
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', border: '1px solid #e8e8e8', borderRadius: 4 }}>
          <div style={{ padding: '8px 12px', background: '#fafafa', borderBottom: '1px solid #e8e8e8', fontWeight: 'bold' }}>运行过程 (日志)</div>
          <div style={{ flex: 1, overflowY: 'auto', background: '#1e1e1e', padding: 16, fontFamily: 'monospace', fontSize: 13 }}>
            {running ? (
              <div style={{color: '#1890ff'}}>[SYSTEM] 开始执行流程...</div>
            ) : !result ? (
              <div style={{color: '#666'}}>等待运行...</div>
            ) : (
              <>
                {result.logs?.length ? result.logs.map(renderLogEntry) : <div style={{color: '#999'}}>[SYSTEM] 无日志输出</div>}
                <div style={{ color: result.status === 'SUCCESS' ? '#52c41a' : '#ff4d4f', marginTop: 16, fontWeight: 'bold' }}>
                  [SYSTEM] 执行结束，状态: {result.status}
                </div>
              </>
            )}
          </div>
        </div>
        
        {/* Variables */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid #e8e8e8', borderRadius: 4 }}>
          <div style={{ padding: '8px 12px', background: '#fafafa', borderBottom: '1px solid #e8e8e8', fontWeight: 'bold' }}>变量状态</div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {running ? (
              <div style={{padding: 16, color: '#999'}}>运行中...</div>
            ) : varsData.length > 0 ? (
              <Table 
                columns={varsColumns} 
                dataSource={varsData} 
                pagination={false} 
                size="small" 
                showHeader={false}
              />
            ) : (
              <div style={{padding: 16, color: '#999'}}>暂无数据</div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default DebugConsole;