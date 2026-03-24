import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Tag } from 'antd';

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
  // 中文注释：PLC 节点默认输出变量，便于条件分支等引用
  PLC_READ: 'plcReadResult',
  PLC_WRITE: 'plcWriteResult',
};

const NODE_FINAL_MARKERS = ['【节点执行成功】', '【节点执行失败】', '【节点执行异常】', '【节点执行警告】'];
const PROCESS_LINE_SKIP_MARKERS = ['【节点执行开始】', '【节点输入数据】'];
const FLOW_START_MARKER = '================ 流程执行开始 ================';
const FLOW_END_MARKER = '================ 流程执行结束 ================';

// 中文注释：统一动作类型映射，保证 TCP_SEND 在展示侧始终按 TCP_CLIENT 处理。
const normalizeActionType = (actionType) => (actionType === 'TCP_SEND' ? 'TCP_CLIENT' : actionType);

const stringifyValue = (value) => (typeof value === 'object' ? JSON.stringify(value) : String(value));

const truncateText = (text, limit = 120) => {
  const value = String(text ?? '');
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
};

const isNodeFinalMessage = (message) => {
  const text = String(message || '');
  return NODE_FINAL_MARKERS.some((marker) => text.includes(marker));
};

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

const shouldSkipSummaryProcessLine = (text) => {
  const t = String(text || '');
  // 中文注释：摘要模式仅跳过低价值“开始/输入”行，其它业务过程行保留。
  return PROCESS_LINE_SKIP_MARKERS.some((marker) => t.includes(marker));
};

const buildKvLines = (title, data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  const lines = [`${title}:`];
  Object.entries(data).forEach(([k, v]) => {
    lines.push(`  ${k} = ${stringifyValue(v)}`);
  });
  return lines;
};

const getLogColor = (log) => {
  if (log.level === 'ERROR') return '#ff6b6b';
  if (log.level === 'WARN') return '#ffd93d';
  if (log.level === 'SYSTEM') return '#1890ff';
  if (log.message?.includes('【流程流转】')) return '#b37feb';
  if (log.message?.includes('【节点执行成功】')) return '#52c41a';
  return '#a0e8af';
};

const buildLogKey = (log, idx) =>
  `${log?.nodeId || '-'}|${log?.nodeName || '-'}|${log?.actionType || '-'}|${log?.timestamp || idx}|${idx}`;

const ExecutionLogPanel = ({
  logs,
  running = false,
  result = null,
  emptyText = '[SYSTEM] 当前窗口暂无日志',
  showFullPayload = false,
  viewMode = 'summary',
}) => {
  const [expandedExceptionMap, setExpandedExceptionMap] = useState({});
  const logContainerRef = useRef(null);
  const toggleExceptionExpand = useCallback((logKey) => {
    setExpandedExceptionMap((prev) => ({ ...prev, [logKey]: !prev[logKey] }));
  }, []);

  const buildDisplayLogs = useCallback((rawLogs) => {
    if (!Array.isArray(rawLogs) || rawLogs.length === 0) {
      return [];
    }

    if (viewMode === 'raw') {
      // 中文注释：raw 模式用于“任务执行日志”，按数据库原始顺序完整展示，不做节点聚合压缩。
      return rawLogs.map((log) => {
        if (typeof log === 'string') {
          return log;
        }
        const actionType = normalizeActionType(log?.actionType);
        const message = String(log?.message || '');
        const dataLines = [];
        if (log?.data && typeof log.data === 'object') {
          // 中文注释：优先展开后端聚合后的 processLines，避免“条件分支过程”被压成一行。
          if (Array.isArray(log.data.processLines)) {
            dataLines.push(...log.data.processLines.map(v => String(v)));
          }
          if (Array.isArray(log.data.branches)) {
            log.data.branches.forEach((b, idx) => {
              dataLines.push(`branch[${idx}] ${b.branch || '-'} => matched=${b.matched}`);
              if (b.leftPath != null) dataLines.push(`  leftPath=${b.leftPath}`);
              if (b.leftValue != null) dataLines.push(`  leftValue=${stringifyValue(b.leftValue)}`);
              if (b.operator != null) dataLines.push(`  operator=${b.operator}`);
              if (b.rightValue != null) dataLines.push(`  rightValue=${stringifyValue(b.rightValue)}`);
              if (b.nextNodeId != null) dataLines.push(`  nextNodeId=${b.nextNodeId}`);
            });
          }
          Object.entries(log.data).forEach(([k, v]) => {
            if (k === 'processLines' || k === 'branches') return;
            dataLines.push(`${k} = ${stringifyValue(v)}`);
          });
        } else if (typeof log?.data === 'string' && log.data.trim()) {
          dataLines.push(log.data);
        }

        const processLines = [message, ...dataLines].filter(Boolean);
        const exception =
          log?.level === 'ERROR' || message.includes('异常') || message.includes('失败')
            ? (log?.exception || log?.errorMessage || message)
            : '';
        // 中文注释：数据库行无 durationMs 列时，从 dataJson.durationMs 读取，避免仅显示摘要行而缺少耗时。
        const durationMs = log?.durationMs ?? log?.data?.durationMs;
        return {
          ...log,
          actionType,
          nodeType: log?.nodeType || actionType,
          processLines,
          durationMs,
          outputVariable: log?.outputVariable || log?.outputVar || log?.targetVariable || log?.variableName || '-',
          exception,
        };
      });
    }

    const displayed = [];
    const nodeLatestMap = new Map();
    const nodeDetailMap = new Map();
    const updateNodeDetail = (key, updater) => {
      const prev = nodeDetailMap.get(key) || {};
      nodeDetailMap.set(key, updater(prev));
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
      const actionType = normalizeActionType(actionTypeRaw);
      const isNodeLog = nodeName && nodeName !== '-' && actionType && actionType !== '-' && actionType !== 'SYSTEM';
      const isNodeFinal = isNodeFinalMessage(message);

      if (isNodeLog) {
        // 中文注释：优先用 nodeId 聚合同一节点，避免别名导致重复摘要。
        const key = nodeId ? `node:${nodeId}` : `name:${nodeName}`;
        const lowered = message.toLowerCase();
        if (!isNodeFinal) {
          const line = message + (log?.data != null ? ` | data=${stringifyValue(log.data)}` : '');
          // 中文注释：除特判节点外，统一保留节点过程，避免“只有摘要无过程”。
          updateNodeDetail(key, (prev) => ({
            ...prev,
            genericLines: [...(prev.genericLines || []), line],
          }));
        }
        if (lowered.includes('tcp_client sent')) {
          const raw = log?.data ? String(log.data) : message;
          const detail = `发送: ${showFullPayload ? raw : truncateText(raw, 120)}`;
          updateNodeDetail(key, (prev) => ({ ...prev, send: detail }));
        } else if (lowered.includes('tcp_client received') || lowered.includes('tcp server received')) {
          const raw = log?.data ? String(log.data) : message;
          const detail = `接收: ${showFullPayload ? raw : truncateText(raw, 120)}`;
          updateNodeDetail(key, (prev) => ({ ...prev, recv: detail }));
        } else if (message.includes('TCP_SERVER 接收参数')) {
          updateNodeDetail(key, (prev) => ({
            ...prev,
            tcpServerParamsLines: buildKvLines('接收参数', log?.data),
            tcpServerOutputVar: log?.data?.outputVariable || ''
          }));
        } else if (message.includes('TCP_SERVER 输出变量')) {
          updateNodeDetail(key, (prev) => ({
            ...prev,
            tcpServerOutputLines: buildKvLines('输出变量', log?.data),
            tcpServerOutputVar: log?.data?.variable || ''
          }));
        } else if (message.includes('DB_OPERATION')) {
          const extra = buildKvLines(
            message.includes('执行参数') ? '数据库执行参数' : '数据库执行结果',
            log?.data
          );
          updateNodeDetail(key, (prev) => ({
            ...prev,
            extraLines: [...(prev.extraLines || []), ...extra]
          }));
        }

        if (isNodeFinal) {
          nodeLatestMap.set(key, { ...log, actionType });
        } else if (!nodeLatestMap.has(key)) {
          nodeLatestMap.set(key, { ...log, actionType });
        }
        return;
      }

      const isSeparatorSystem =
        message.includes(FLOW_START_MARKER) ||
        message.includes(FLOW_END_MARKER);
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

    const buildProcessLines = (parts) => parts
      .map(sanitizeProcessText)
      .filter(Boolean);

    const nodeLogs = Array.from(nodeLatestMap.entries()).map(([key, log]) => {
      const detail = nodeDetailMap.get(key);
      const parts = [log.message];
      const dbProcess = Array.isArray(log?.data?.processLines) ? log.data.processLines : [];
      if (dbProcess.length > 0) {
        if ((log.nodeType || log.actionType) === 'CONDITION') {
          // 中文注释：条件节点优先显示表达式判断行（如 ${var} > 1981723 => 命中）。
          const conditionExprLines = dbProcess.filter((line) => {
            const t = String(line || '');
            return t.includes('条件判断[') || t.includes('${');
          });
          parts.push(...(conditionExprLines.length > 0 ? conditionExprLines : dbProcess));
        } else {
          parts.push(...dbProcess.filter((line) => !shouldSkipSummaryProcessLine(line)));
        }
      }
      if (Array.isArray(detail?.genericLines)) {
        parts.push(...detail.genericLines.filter((line) => !shouldSkipSummaryProcessLine(line)));
      }
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
  }, [showFullPayload, viewMode]);

  const displayLogs = useMemo(() => buildDisplayLogs(logs), [buildDisplayLogs, logs]);

  useEffect(() => {
    if (!logContainerRef.current) return;
    // 中文注释：日志窗口自动跟随到底部，保证能看到最新输出。
    logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
  }, [displayLogs, running, result]);

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

    const color = getLogColor(log);

    const processLines = Array.isArray(log.processLines) ? log.processLines : [log.process || log.message || '-'];
    const outputVariable = log.outputVariable || '-';
    const sendVariable = log.sendVariable || '';
    const recvVariable = log.recvVariable || '';
    const exception = log.exception || (log.level === 'ERROR' ? log.message : '');
    const logKey = buildLogKey(log, idx);
    const isExpanded = !!expandedExceptionMap[logKey];
    const exceptionPreview = exception ? truncateText(exception, 120) : exception;

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
                    onClick={() => toggleExceptionExpand(logKey)}
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

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid #e8e8e8', borderRadius: 4 }}>
      <div style={{ padding: '8px 12px', background: '#fafafa', borderBottom: '1px solid #e8e8e8', fontWeight: 'bold' }}>运行过程 (日志)</div>
      <div
        ref={logContainerRef}
        style={{ flex: 1, overflowY: 'auto', background: '#1e1e1e', padding: 16, fontFamily: 'monospace', fontSize: 13 }}
      >
        {logs.length === 0 && !result && !running ? (
          <div style={{ color: '#666' }}>等待运行...</div>
        ) : (
          <>
            {running && displayLogs.length === 0 && (
              <div style={{ color: '#1890ff', marginBottom: 8 }}>[SYSTEM] 开始执行流程...</div>
            )}
            {displayLogs.length ? displayLogs.map(renderLogEntry) : <div style={{ color: '#999' }}>{emptyText}</div>}
            {!running && result?.status && result.status !== 'RUNNING' && (
              <div style={{ color: result.status === 'SUCCESS' ? '#52c41a' : '#ff4d4f', marginTop: 16, fontWeight: 'bold' }}>
                [SYSTEM] 执行结束，状态: {result.status}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ExecutionLogPanel;
