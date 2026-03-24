import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, Button, Table, Switch } from 'antd';
import api from '../utils/api';
import ExecutionLogPanel from '../components/ExecutionLogPanel';

const FULL_PAYLOAD_STORAGE_KEY = 'debugConsole.showFullPayload';
const DEBUG_LOG_POLL_INTERVAL_MS = 5000;

const parseStructuredValue = (value) => {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
    return null;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    const mapStyle = trimmed.match(/^\{(.+)\}$/);
    if (!mapStyle) return null;
    const body = mapStyle[1];
    const out = {};
    body.split(',').forEach(pair => {
      const idx = pair.indexOf('=');
      if (idx <= 0) return;
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      out[key] = val;
    });
    return Object.keys(out).length ? out : null;
  }
};

const formatPrimitive = (v) => {
  if (v == null) return 'null';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
};

const DebugConsole = ({ visible, taskId, onCancel, onSuccess }) => {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [liveVariables, setLiveVariables] = useState({});
  const [showFullPayload, setShowFullPayload] = useState(() => {
    try {
      return localStorage.getItem(FULL_PAYLOAD_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const pollOffsetRef = useRef(0);
  const pollTimerRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const fetchLogs = useCallback(async (sid) => {
    if (!sid) return;
    try {
      const data = await api.get(`/task-flow-configs/${taskId}/debug/${sid}/logs`, {
        params: { offset: pollOffsetRef.current }
      });
      const newLogs = Array.isArray(data.logs) ? data.logs : [];
      if (newLogs.length > 0) {
        setLogs(prev => [...prev, ...newLogs]);
      }
      if (data.variables && typeof data.variables === 'object') {
        setLiveVariables(data.variables);
      }
      pollOffsetRef.current = Number(data.nextOffset || pollOffsetRef.current);
      if (data.status && data.status !== 'RUNNING') {
        setRunning(false);
        setResult({
          status: data.status,
          variables: data.variables || {}
        });
        return;
      }
      // 中文注释：调试日志轮询改为 5 秒一次，降低 /debug/{sid}/logs 的请求频率与后端日志刷屏。
      pollTimerRef.current = setTimeout(() => {
        void fetchLogs(sid);
      }, DEBUG_LOG_POLL_INTERVAL_MS);
    } catch (err) {
      setRunning(false);
      setResult({
        status: 'ERROR',
        variables: {},
      });
      setLogs(prev => [...prev, {
        timestamp: new Date().toLocaleTimeString(),
        level: 'ERROR',
        message: '拉取实时日志失败: ' + err.message,
        actionType: 'SYSTEM',
        nodeName: 'DebugConsole'
      }]);
    }
  }, [taskId]);

  const handleRun = useCallback(async () => {
    stopPolling();
    setRunning(true);
    setResult({ status: 'RUNNING', variables: {} });
    setLogs([]);
    setLiveVariables({});
    setSessionId(null);
    pollOffsetRef.current = 0;
    try {
      const start = await api.post(`/task-flow-configs/${taskId}/debug/start`);
      const sid = start?.sessionId;
      if (!sid) throw new Error('未获取到调试会话ID');
      setSessionId(sid);
      await fetchLogs(sid);
      if (onSuccess) onSuccess();
    } catch (err) {
      setRunning(false);
      setResult({ status: 'ERROR', variables: {} });
      setLogs([{
        timestamp: new Date().toLocaleTimeString(),
        level: 'ERROR',
        message: '启动调试失败: ' + err.message,
        actionType: 'SYSTEM',
        nodeName: 'DebugConsole'
      }]);
    }
  }, [taskId, onSuccess, fetchLogs, stopPolling]);

  useEffect(() => {
    if (!visible) {
      stopPolling();
      setRunning(false);
      setSessionId(null);
      setLiveVariables({});
      pollOffsetRef.current = 0;
      return;
    }
    if (!taskId) return;
    void handleRun();
    return () => stopPolling();
  }, [visible, taskId, handleRun, stopPolling]);

  const renderVariableValue = (rawValue) => {
    const structured = parseStructuredValue(rawValue);
    if (structured && typeof structured === 'object' && !Array.isArray(structured)) {
      const entries = Object.entries(structured);
      return (
        <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
          {entries.map(([k, v]) => (
            <div key={k}>
              <span style={{ color: '#8c8c8c' }}>{k}</span>
              <span>: </span>
              <span>{formatPrimitive(v)}</span>
            </div>
          ))}
        </div>
      );
    }
    return (
      <span style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        {formatPrimitive(rawValue)}
      </span>
    );
  };

  const varsColumns = [
    { title: '变量名', dataIndex: 'key', width: '40%', render: t => <span style={{ color: '#1890ff', fontFamily: 'monospace' }}>{t}</span> },
    { title: '值', dataIndex: 'value', render: renderVariableValue }
  ];

  const currentVariables = (running ? liveVariables : (result?.variables || liveVariables)) || {};
  const varsData = Object.keys(currentVariables).map(k => ({
    key: k,
    value: currentVariables[k]
  }));

  useEffect(() => {
    try {
      localStorage.setItem(FULL_PAYLOAD_STORAGE_KEY, showFullPayload ? '1' : '0');
    } catch {
      // 中文注释：本地存储不可用时忽略，不影响主流程。
    }
  }, [showFullPayload]);

  return (
    <Modal
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 32 }}>
          <span>流程调试控制台{sessionId ? ` (${sessionId.slice(0, 8)})` : ''}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#666', fontSize: 12 }}>
              <span>完整报文</span>
              <Switch size="small" checked={showFullPayload} onChange={setShowFullPayload} />
            </div>
            <Button
              onClick={() => {
                setLogs([]);
              }}
              disabled={running}
            >
              清空
            </Button>
            <Button type="primary" onClick={handleRun} loading={running} style={{ background: '#52c41a' }}>
              {running ? '运行中...' : '开始运行'}
            </Button>
          </div>
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
        <ExecutionLogPanel
          logs={logs}
          running={running}
          result={result}
          emptyText="[SYSTEM] 当前调试窗口暂无日志"
          showFullPayload={showFullPayload}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid #e8e8e8', borderRadius: 4 }}>
          <div style={{ padding: '8px 12px', background: '#fafafa', borderBottom: '1px solid #e8e8e8', fontWeight: 'bold' }}>变量状态</div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {varsData.length > 0 ? (
              <Table
                columns={varsColumns}
                dataSource={varsData}
                pagination={false}
                size="small"
                showHeader={false}
              />
            ) : running ? (
              <div style={{ padding: 16, color: '#999' }}>运行中...（等待变量）</div>
            ) : (
              <div style={{ padding: 16, color: '#999' }}>暂无数据</div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default DebugConsole;