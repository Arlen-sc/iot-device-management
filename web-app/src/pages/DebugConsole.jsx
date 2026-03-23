import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, Button, Tag, Table, Switch } from 'antd';
import api from '../utils/api';

const FULL_PAYLOAD_STORAGE_KEY = 'debugConsole.showFullPayload';
const NODE_TYPE_LABEL_MAP = {
  START: '开始',
  END: '结束',
  CONDITION: '条件分支',
  DELAY: '延迟节点',
  SCRIPT: '脚本处理',
  HTTP_REQUEST: 'HTTP 请求',
  PLC_READ: 'PLC 读取',
  PLC_WRITE: 'PLC 写入',
  TCP_LISTEN: 'TCP 监听',
  TCP_CLIENT: 'TCP 客户端',
  TCP_SERVER: 'TCP 服务端',
  TCP_SEND: 'TCP 客户端',
  DEVICE_CONTROL: '设备控制',
  DEVICE_DATA: '设备数据',
  DEVICE_OPERATION: '设备控制',
  DATA_LOAD: '设备数据',
  LOG: '日志记录',
  DEDUP_FILTER: '去重过滤',
  DB_OPERATION: '数据库操作',
};

const DEFAULT_OUTPUT_VAR_BY_TYPE = {
  TCP_CLIENT: 'tcpClientData',
  TCP_SERVER: 'tcpServerData',
  TCP_LISTEN: 'tcpData',
  HTTP_REQUEST: 'httpResponse',
  SQL_QUERY: 'sqlResult',
  DATA_LOAD: 'saveResult',
};

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
    // Java Map.toString-like fallback: {a=1, b=2}
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
  const [expandedExceptionMap, setExpandedExceptionMap] = useState({});
  const [showFullPayload, setShowFullPayload] = useState(() => {
    try {
      return localStorage.getItem(FULL_PAYLOAD_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const pollOffsetRef = useRef(0);
  const pollTimerRef = useRef(null);
  const logContainerRef = useRef(null);

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
      pollTimerRef.current = setTimeout(() => {
        void fetchLogs(sid);
      }, 400);
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
    setExpandedExceptionMap({});
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

  const renderLogEntry = (log, idx) => {
    if (log.actionType === 'SYSTEM') {
      return (
        <div key={idx} style={{ marginBottom: 8, color: log.level === 'ERROR' ? '#ff7875' : '#91caff', fontSize: 12 }}>
          <span style={{ color: '#8c8c8c' }}>[{log.timestamp || '-'}]</span>
          <span style={{ marginLeft: 8 }}>[SYSTEM]</span>
          <span style={{ marginLeft: 8 }}>{log.message}</span>
        </div>
      );
    }

    if (typeof log === 'string') {
      return <div key={idx} style={{ color: '#a0e8af', marginBottom: 8 }}>{log}</div>;
    }

    let color = '#a0e8af';
    if (log.level === 'ERROR') color = '#ff6b6b';
    else if (log.level === 'WARN') color = '#ffd93d';
    else if (log.level === 'SYSTEM') color = '#1890ff';
    else if (log.message?.includes('【流程流转】')) color = '#b37feb';
    else if (log.message?.includes('【节点执行成功】')) color = '#52c41a';

    const processLines = Array.isArray(log.processLines) ? log.processLines : [log.process || log.message || '-'];
    const outputVariable = log.outputVariable || '-';
    const sendVariable = log.sendVariable || '';
    const recvVariable = log.recvVariable || '';
    const exception = log.exception || (log.level === 'ERROR' ? log.message : '');
    const logKey = `${log?.nodeId || '-'}|${log?.nodeName || '-'}|${log?.actionType || '-'}|${log?.timestamp || idx}|${idx}`;
    const isExpanded = !!expandedExceptionMap[logKey];
    const exceptionPreview = exception && exception.length > 120 ? `${exception.slice(0, 120)}...` : exception;

    const nodeTypeCode = log.nodeType || log.actionType;
    const nodeTypeLabel = NODE_TYPE_LABEL_MAP[nodeTypeCode] || nodeTypeCode || '-';
    const statusText = exception ? '失败' : '成功';
    const statusColor = exception ? 'error' : 'success';

    return (
      <div
        key={idx}
        style={{
          marginBottom: 8,
          padding: '8px 10px',
          borderRadius: 6,
          borderLeft: `3px solid ${color}`,
          background: 'rgba(255,255,255,0.02)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#d9d9d9', fontSize: 12, flexWrap: 'wrap' }}>
          <span style={{ color: '#8c8c8c' }}>时间: {log.timestamp || '-'}</span>
          <span>名称: {log.nodeName || '-'}</span>
          <span>类型: {nodeTypeLabel}</span>
          <span>
            状态: <Tag color={statusColor} style={{ marginInlineEnd: 0 }}>{statusText}</Tag>
          </span>
          {log.durationMs != null && <span style={{ color: '#8c8c8c' }}>耗时: {log.durationMs}ms</span>}
        </div>
        {(processLines.length > 0 || outputVariable !== '-' || sendVariable || recvVariable || exception) && (
          <div style={{ marginTop: 6, fontSize: 11, color: '#8c8c8c' }}>
            {processLines.length > 0 && (
              <div>
                <span>过程:</span>
                {processLines.map((line, i) => (
                  <div key={`${logKey}-p-${i}`} style={{ paddingLeft: 18, color: '#bfbfbf', marginTop: 2 }}>
                    - {line}
                  </div>
                ))}
              </div>
            )}
            {sendVariable ? <div style={{ marginTop: 4 }}>发送变量: <span style={{ fontFamily: 'monospace', color: '#d3adf7' }}>{sendVariable}</span></div> : null}
            {recvVariable ? <div style={{ marginTop: 2 }}>接收变量: <span style={{ fontFamily: 'monospace', color: '#95de64' }}>{recvVariable}</span></div> : null}
            {outputVariable !== '-' ? <div style={{ marginTop: 2 }}>输出变量: <span style={{ fontFamily: 'monospace' }}>{outputVariable}</span></div> : null}
            {exception ? (
              <div style={{ marginTop: 4, color: '#ff7875' }}>
                异常: {isExpanded ? exception : exceptionPreview}
                {exception.length > 120 && (
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0, marginLeft: 6, height: 'auto' }}
                    onClick={() => {
                      setExpandedExceptionMap(prev => ({ ...prev, [logKey]: !prev[logKey] }));
                    }}
                  >
                    {isExpanded ? '收起' : '展开'}
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    );
  };

  const buildDisplayLogs = useCallback((rawLogs) => {
    if (!Array.isArray(rawLogs) || rawLogs.length === 0) {
      return [];
    }

    const displayed = [];
    const nodeLatestMap = new Map();
    const nodeDetailMap = new Map();

    const kvToLines = (title, data) => {
      if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
      const lines = [`${title}:`];
      Object.entries(data).forEach(([k, v]) => {
        const text = typeof v === 'object' ? JSON.stringify(v) : String(v);
        lines.push(`  ${k} = ${text}`);
      });
      return lines;
    };

    rawLogs.forEach((log) => {
      if (typeof log === 'string') {
        displayed.push(log);
        return;
      }

      const message = String(log?.message || '');
      const nodeId = log?.nodeId;
      const nodeName = log?.nodeName;
      const actionTypeRaw = log?.actionType;
      const actionType = actionTypeRaw === 'TCP_SEND' ? 'TCP_CLIENT' : actionTypeRaw;
      const isNodeLog = nodeName && nodeName !== '-' && actionType && actionType !== '-' && actionType !== 'SYSTEM';
      const isNodeFinal =
        message.includes('【节点执行成功】') ||
        message.includes('【节点执行失败】') ||
        message.includes('【节点执行异常】') ||
        message.includes('【节点执行警告】');

      if (isNodeLog) {
        // 优先用 nodeId 聚合同一节点，避免同节点 actionType 别名（TCP_SEND/TCP_CLIENT）导致重复摘要
        const key = nodeId ? `node:${nodeId}` : `name:${nodeName}`;
        const lowered = message.toLowerCase();
        if (lowered.includes('tcp_client sent')) {
          const raw = log?.data ? String(log.data) : message;
          const detail = `发送: ${showFullPayload ? raw : `${raw.slice(0, 120)}${raw.length > 120 ? '...' : ''}`}`;
          nodeDetailMap.set(key, { ...(nodeDetailMap.get(key) || {}), send: detail });
        } else if (lowered.includes('tcp_client received') || lowered.includes('tcp server received')) {
          const raw = log?.data ? String(log.data) : message;
          const detail = `接收: ${showFullPayload ? raw : `${raw.slice(0, 120)}${raw.length > 120 ? '...' : ''}`}`;
          nodeDetailMap.set(key, { ...(nodeDetailMap.get(key) || {}), recv: detail });
        } else if (message.includes('TCP_SERVER 接收参数')) {
          nodeDetailMap.set(key, {
            ...(nodeDetailMap.get(key) || {}),
            tcpServerParamsLines: kvToLines('接收参数', log?.data),
            tcpServerOutputVar: log?.data?.outputVariable || ''
          });
        } else if (message.includes('TCP_SERVER 输出变量')) {
          nodeDetailMap.set(key, {
            ...(nodeDetailMap.get(key) || {}),
            tcpServerOutputLines: kvToLines('输出变量', log?.data),
            tcpServerOutputVar: log?.data?.variable || ''
          });
        } else if (message.includes('DB_OPERATION')) {
          const extra = kvToLines(
            message.includes('执行参数') ? '数据库执行参数' : '数据库执行结果',
            log?.data
          );
          const prev = nodeDetailMap.get(key) || {};
          nodeDetailMap.set(key, {
            ...prev,
            extraLines: [...(prev.extraLines || []), ...extra]
          });
        }

        if (isNodeFinal) {
          nodeLatestMap.set(key, { ...log, actionType });
        } else if (!nodeLatestMap.has(key)) {
          // 若没有最终状态，先保留首条，后续有最终状态会覆盖
          nodeLatestMap.set(key, { ...log, actionType });
        }
        return;
      }

      const isSeparatorSystem =
        message.includes('================ 流程执行开始 ================') ||
        message.includes('================ 流程执行结束 ================');
      const isImportantSystem =
        !isSeparatorSystem && (
          message.includes('Flow config loaded') ||
          message.includes('等待数据传入') ||
          log?.level === 'ERROR'
        );
      if (isImportantSystem) {
        displayed.push(log);
      }
    });

    const sanitizeProcessText = (text) => {
      if (!text) return '';
      return String(text)
        .replace(/【节点执行成功】/g, '')
        .replace(/【节点执行失败】/g, '')
        .replace(/【节点执行异常】/g, '')
        .replace(/【节点执行警告】/g, '')
        .replace(/\s+\|\s+/g, ' | ')
        .replace(/^\s*\|\s*/g, '')
        .replace(/\s*\|\s*$/g, '')
        .trim();
    };

    const buildProcessLines = (parts) => parts
      .map(sanitizeProcessText)
      .filter(Boolean);

    const nodeLogs = Array.from(nodeLatestMap.entries()).map(([key, log]) => {
      const detail = nodeDetailMap.get(key);
      const parts = [log.message];
      if (detail?.send) parts.push(detail.send);
      if (detail?.recv) parts.push(detail.recv);
      if (Array.isArray(detail?.extraLines)) parts.push(...detail.extraLines);
      if (Array.isArray(detail?.tcpServerParamsLines)) parts.push(...detail.tcpServerParamsLines);
      if (Array.isArray(detail?.tcpServerOutputLines)) parts.push(...detail.tcpServerOutputLines);
      const outputVariable = log.outputVariable
        || log.outputVar
        || log.targetVariable
        || log.variableName
        || detail?.tcpServerOutputVar
        || DEFAULT_OUTPUT_VAR_BY_TYPE[log.nodeType || log.actionType]
        || '-';
      const exception =
        log.level === 'ERROR' || String(log.message || '').includes('异常') || String(log.message || '').includes('失败')
          ? log.errorMessage || log.exception || log.message
          : '';
      const sendVarName = detail?.send ? 'sendData' : '';
      const recvVarName = detail?.recv ? outputVariable : '';
      return {
        ...log,
        processLines: buildProcessLines(parts),
        outputVariable,
        sendVariable: detail?.send ? `${sendVarName} = ${detail.send.replace(/^发送:\s*/, '')}` : '',
        recvVariable: detail?.recv ? `${recvVarName} = ${detail.recv.replace(/^接收:\s*/, '')}` : '',
        exception,
        nodeType: log.nodeType || log.actionType
      };
    });

    return [...displayed, ...nodeLogs];
  }, [showFullPayload]);

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
    { title: '变量名', dataIndex: 'key', width: '40%', render: t => <span style={{color: '#1890ff', fontFamily: 'monospace'}}>{t}</span> },
    { title: '值', dataIndex: 'value', render: renderVariableValue }
  ];

  const currentVariables = (running ? liveVariables : (result?.variables || liveVariables)) || {};
  const varsData = Object.keys(currentVariables).map(k => ({
    key: k, 
    value: currentVariables[k]
  }));

  const displayLogs = buildDisplayLogs(logs);

  useEffect(() => {
    if (!visible || !logContainerRef.current) return;
    // 始终跟随到最新日志（底部）
    logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
  }, [visible, displayLogs, running, result]);

  useEffect(() => {
    try {
      localStorage.setItem(FULL_PAYLOAD_STORAGE_KEY, showFullPayload ? '1' : '0');
    } catch {
      // ignore storage errors (private mode, disabled storage, etc.)
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
                setExpandedExceptionMap({});
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
        {/* Logs */}
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', border: '1px solid #e8e8e8', borderRadius: 4 }}>
          <div style={{ padding: '8px 12px', background: '#fafafa', borderBottom: '1px solid #e8e8e8', fontWeight: 'bold' }}>运行过程 (日志)</div>
          <div
            ref={logContainerRef}
            style={{ flex: 1, overflowY: 'auto', background: '#1e1e1e', padding: 16, fontFamily: 'monospace', fontSize: 13 }}
          >
            {logs.length === 0 && !result && !running ? (
              <div style={{color: '#666'}}>等待运行...</div>
            ) : (
              <>
                {running && displayLogs.length === 0 && (
                  <div style={{color: '#1890ff', marginBottom: 8}}>[SYSTEM] 开始执行流程...</div>
                )}
                {displayLogs.length ? displayLogs.map(renderLogEntry) : <div style={{color: '#999'}}>[SYSTEM] 当前调试窗口暂无日志</div>}
                {!running && result?.status && result.status !== 'RUNNING' && (
                  <div style={{ color: result.status === 'SUCCESS' ? '#52c41a' : '#ff4d4f', marginTop: 16, fontWeight: 'bold' }}>
                    [SYSTEM] 执行结束，状态: {result.status}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        
        {/* Variables */}
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
              <div style={{padding: 16, color: '#999'}}>运行中...（等待变量）</div>
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