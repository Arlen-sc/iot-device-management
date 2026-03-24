import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Button, Popconfirm, message, Space, Select, DatePicker, Input, Spin, Empty } from 'antd';
import api from '../utils/api';
import ExecutionLogPanel from '../components/ExecutionLogPanel';
import dayjs from 'dayjs';

const LogViewer = ({ visible, taskId, onCancel }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFullPayload, setShowFullPayload] = useState(false);
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [keyword, setKeyword] = useState('');
  const [timeRange, setTimeRange] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.get(`/flow-logs/${taskId}?limit=500`);
      // 中文注释：将数据库日志字段映射成调试面板通用结构，直接复用同一渲染逻辑。
      const normalized = (Array.isArray(data) ? data : []).map(item => {
        let parsedData = null;
        if (item.dataJson) {
          try {
            parsedData = JSON.parse(item.dataJson);
          } catch {
            parsedData = item.dataJson;
          }
        }
        // 中文注释：耗时等字段在落库时写入 dataJson，需提升到顶层供 ExecutionLogPanel 与关键词检索使用。
        const dataObj = parsedData && typeof parsedData === 'object' && !Array.isArray(parsedData) ? parsedData : null;
        return {
          ...item,
          timestamp: item.createdAt,
          data: parsedData,
          nodeType: item.actionType,
          durationMs: dataObj?.durationMs ?? item.durationMs,
        };
      });
      setLogs(normalized);
      // 中文注释：刷新后默认选中最新事件，确保右侧能立即看到一次完整流程。
      const firstEvent = normalized.find(item => item?.eventId)?.eventId || null;
      setSelectedEventId(firstEvent);
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

  const filteredLogs = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return logs.filter((log) => {
      if (levelFilter !== 'ALL' && String(log?.level || '').toUpperCase() !== levelFilter) {
        return false;
      }

      if (timeRange && timeRange.length === 2) {
        const logTime = dayjs(log?.timestamp);
        if (!logTime.isValid()) {
          return false;
        }
        const [start, end] = timeRange;
        // 中文注释：按分钟粒度筛选，结束时间扩展到该分钟末尾，避免边界误差。
        if (start && logTime.isBefore(start)) return false;
        if (end && logTime.isAfter(end.endOf('minute'))) return false;
      }

      if (kw) {
        const text = [
          log?.message,
          log?.nodeName,
          log?.actionType,
          typeof log?.data === 'string' ? log.data : JSON.stringify(log?.data || {}),
        ].join(' ').toLowerCase();
        if (!text.includes(kw)) {
          return false;
        }
      }
      return true;
    });
  }, [logs, levelFilter, keyword, timeRange]);

  const events = useMemo(() => {
    const eventMap = new Map();
    filteredLogs.forEach((log) => {
      const eventId = log?.eventId || 'unknown';
      const ts = dayjs(log?.timestamp);
      const current = eventMap.get(eventId);
      if (!current) {
        eventMap.set(eventId, {
          eventId,
          time: ts.isValid() ? ts : dayjs(0),
          count: 1,
        });
      } else {
        current.count += 1;
        if (ts.isValid() && ts.isAfter(current.time)) {
          current.time = ts;
        }
      }
    });
    return Array.from(eventMap.values()).sort((a, b) => b.time.valueOf() - a.time.valueOf());
  }, [filteredLogs]);

  useEffect(() => {
    if (!events.length) {
      setSelectedEventId(null);
      return;
    }
    if (!selectedEventId || !events.some(e => e.eventId === selectedEventId)) {
      setSelectedEventId(events[0].eventId);
    }
  }, [events, selectedEventId]);

  const selectedEventLogs = useMemo(() => {
    if (!selectedEventId) return [];
    return filteredLogs.filter(log => (log?.eventId || 'unknown') === selectedEventId);
  }, [filteredLogs, selectedEventId]);

  const handleClear = async () => {
    try {
      await api.delete(`/flow-logs/${taskId}`);
      message.success('日志已清空');
      setLogs([]);
    } catch (err) {
      message.error('清空失败: ' + err.message);
    }
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 32 }}>
          <span>任务执行日志</span>
          <Space>
            <Select
              size="small"
              value={levelFilter}
              style={{ width: 110 }}
              onChange={setLevelFilter}
              options={[
                { label: '全部级别', value: 'ALL' },
                { label: 'ERROR', value: 'ERROR' },
                { label: 'WARN', value: 'WARN' },
                { label: 'INFO', value: 'INFO' },
                { label: 'SUCCESS', value: 'SUCCESS' },
                { label: 'SYSTEM', value: 'SYSTEM' },
              ]}
            />
            <DatePicker.RangePicker
              size="small"
              showTime
              value={timeRange}
              onChange={setTimeRange}
              placeholder={['开始时间', '结束时间']}
            />
            <Input
              size="small"
              placeholder="关键词"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ width: 140 }}
              allowClear
            />
            <Button size="small" onClick={() => setShowFullPayload(v => !v)}>
              {showFullPayload ? '简略报文' : '完整报文'}
            </Button>
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
      width={1000}
      bodyStyle={{ padding: 16, height: '70vh', display: 'flex' }}
      destroyOnClose
    >
      <div style={{ display: 'flex', width: '100%', gap: 12 }}>
        <div style={{ width: 260, border: '1px solid #e8e8e8', borderRadius: 4, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 12px', background: '#fafafa', borderBottom: '1px solid #e8e8e8', fontWeight: 'bold' }}>
            事件列表
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <Spin spinning={loading}>
              {!events.length ? (
                <div style={{ paddingTop: 24 }}>
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无事件日志" />
                </div>
              ) : (
                events.map((ev) => (
                  <div
                    key={ev.eventId}
                    onClick={() => setSelectedEventId(ev.eventId)}
                    style={{
                      padding: '10px 12px',
                      borderBottom: '1px solid #f0f0f0',
                      cursor: 'pointer',
                      background: selectedEventId === ev.eventId ? '#e6f7ff' : '#fff',
                    }}
                  >
                    <div style={{ fontSize: 12, color: '#333' }}>{ev.time.format('YYYY-MM-DD HH:mm:ss')}</div>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                      {ev.eventId === 'unknown' ? '历史日志(无eventId)' : `事件ID: ${ev.eventId.slice(0, 8)}...`}
                    </div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>日志数: {ev.count}</div>
                  </div>
                ))
              )}
            </Spin>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex' }}>
          <ExecutionLogPanel
            logs={selectedEventLogs}
            running={loading}
            result={null}
            emptyText={selectedEventId ? '[SYSTEM] 当前事件暂无日志' : '[SYSTEM] 请先在左侧选择事件'}
            showFullPayload={showFullPayload}
            viewMode="raw"
          />
        </div>
      </div>
    </Modal>
  );
};

export default LogViewer;