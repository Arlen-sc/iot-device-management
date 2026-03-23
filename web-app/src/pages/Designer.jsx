import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Graph } from '@antv/x6';
import { Dnd } from '@antv/x6-plugin-dnd';
import { Snapline } from '@antv/x6-plugin-snapline';
import { Keyboard } from '@antv/x6-plugin-keyboard';
import { Selection } from '@antv/x6-plugin-selection';
import { Menu, Button, message, Space, Modal, Drawer } from 'antd';
import { 
  ZoomInOutlined, 
  ZoomOutOutlined, 
  AimOutlined, 
  SaveOutlined, 
  BugOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';
import api from '../utils/api';
import NodeForm from './NodeForm';
import DebugConsole from './DebugConsole';
import './Designer.css';

// 注册自定义节点样式
try {
  Graph.registerNode('flow-node', {
    inherit: 'rect',
    width: 140,
    height: 40,
    attrs: {
      body: {
        stroke: '#1890ff',
        strokeWidth: 2,
        fill: '#e6f7ff',
        rx: 6,
        ry: 6,
      },
      label: {
        fill: '#333',
        fontSize: 13,
      },
    },
    ports: {
      items: [
        { id: 'port_top', group: 'top' },
        { id: 'port_bottom', group: 'bottom' },
        { id: 'port_left', group: 'left' },
        { id: 'port_right', group: 'right' }
      ],
      groups: {
        top: { 
          position: 'top', 
          attrs: { 
            circle: { 
              r: 4, 
              magnet: true, 
              stroke: '#1890ff', 
              fill: '#fff',
              style: { visibility: 'visible' }
            } 
          } 
        },
        bottom: { 
          position: 'bottom', 
          attrs: { 
            circle: { 
              r: 4, 
              magnet: true, 
              stroke: '#1890ff', 
              fill: '#fff',
              style: { visibility: 'visible' }
            } 
          } 
        },
        left: { 
          position: 'left', 
          attrs: { 
            circle: { 
              r: 4, 
              magnet: true, 
              stroke: '#1890ff', 
              fill: '#fff',
              style: { visibility: 'visible' }
            } 
          } 
        },
        right: { 
          position: 'right', 
          attrs: { 
            circle: { 
              r: 4, 
              magnet: true, 
              stroke: '#1890ff', 
              fill: '#fff',
              style: { visibility: 'visible' }
            } 
          } 
        },
      },
    },
  });
} catch (e) {
  // 节点已注册，忽略错误
}

try {
  Graph.registerNode('start-node', {
    inherit: 'circle',
    width: 50,
    height: 50,
    attrs: {
      body: { fill: '#f6ffed', stroke: '#52c41a', strokeWidth: 2 },
      label: { text: '开始', fill: '#52c41a', fontSize: 14 },
    },
    ports: {
      items: [
        { id: 'port_out', group: 'out' }
      ],
      groups: { 
        out: { 
          position: 'bottom', 
          attrs: { 
            circle: { 
              r: 4, 
              magnet: true, 
              stroke: '#52c41a', 
              fill: '#fff',
              style: { visibility: 'visible' }
            } 
          } 
        } 
      } 
    },
  });
} catch (e) {
  // 节点已注册，忽略错误
}

try {
  Graph.registerNode('end-node', {
    inherit: 'circle',
    width: 50,
    height: 50,
    attrs: {
      body: { fill: '#fff1f0', stroke: '#ff4d4f', strokeWidth: 2 },
      label: { text: '结束', fill: '#ff4d4f', fontSize: 14 },
    },
    ports: {
      items: [
        { id: 'port_in', group: 'in' }
      ],
      groups: { 
        in: { 
          position: 'top', 
          attrs: { 
            circle: { 
              r: 4, 
              magnet: true, 
              stroke: '#ff4d4f', 
              fill: '#fff',
              style: { visibility: 'visible' }
            } 
          } 
        } 
      } 
    },
  });
} catch (e) {
  // 节点已注册，忽略错误
}

const nodeTypeMap = {
  START: { label: '开始', type: 'start-node' },
  END: { label: '结束', type: 'end-node' },
  CONDITION: { label: '条件分支', color: '#faad14' },
  DELAY: { label: '延迟节点', color: '#13c2c2' },
  SCRIPT: { label: '脚本处理', color: '#722ed1' },
  HTTP_REQUEST: { label: 'HTTP 请求', color: '#1890ff' },
  PLC_READ: { label: 'PLC 读取', color: '#eb2f96' },
  PLC_WRITE: { label: 'PLC 写入', color: '#eb2f96' },
  TCP_LISTEN: { label: 'TCP 监听', color: '#fa8c16' },
  TCP_SEND: { label: 'TCP 发送', color: '#fa8c16' },
  DEVICE_CONTROL: { label: '设备控制', color: '#52c41a' },
  DEVICE_DATA: { label: '设备数据', color: '#52c41a' },
  LOG: { label: '日志记录', color: '#8c8c8c' },
  DEDUP_FILTER: { label: '去重过滤', color: '#fa541c' },
  DB_OPERATION: { label: '数据库操作', color: '#2f54eb' },
};

const Designer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const stencilRef = useRef(null);
  
  const [graph, setGraph] = useState(null);
  const [dnd, setDnd] = useState(null);
  const [taskName, setTaskName] = useState('加载中...');
  
  const [selectedNode, setSelectedNode] = useState(null);
  const [formVisible, setFormVisible] = useState(true);
  const [debugVisible, setDebugVisible] = useState(false);

  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    node: null
  });

  // Initialize Graph
  useEffect(() => {
    if (!containerRef.current) return;

    const g = new Graph({
      container: containerRef.current,
      grid: { size: 10, visible: true, type: 'dot', args: { color: '#e8e8e8', thickness: 1 } },
      panning: { enabled: true, eventTypes: ['leftMouseDown'] },
      mousewheel: { enabled: true, modifiers: ['ctrl', 'meta'] },
      connecting: {
        snap: true, allowBlank: false, allowLoop: false, allowNode: false,
        router: {
          name: 'orth',
          args: {
            startDirections: ['top', 'bottom', 'left', 'right'],
            endDirections: ['top', 'bottom', 'left', 'right'],
            padding: 10
          }
        },
        createEdge() {
          return g.createEdge({
            attrs: {
              line: { stroke: '#1890ff', strokeWidth: 2, targetMarker: { name: 'block', width: 10, height: 6 } }
            },
            zIndex: -1,
          });
        }
      }
    });

    g.use(new Snapline({ enabled: true }));
    g.use(new Keyboard({ enabled: true }));
    g.use(new Selection({ enabled: true, rubberband: true, showNodeSelectionBox: true }));

    // Bind keyboard delete
    g.bindKey(['backspace', 'del'], () => {
      const cells = g.getSelectedCells();
      if (cells.length) {
        g.removeCells(cells);
      }
    });

    g.on('node:click', ({ node }) => {
      setSelectedNode(node);
      setFormVisible(true);
    });

    // Right-click menu for nodes
    g.on('node:contextmenu', ({ node, x, y, e }) => {
      e.preventDefault();
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        node
      });
    });

    // Right-click menu for canvas
    g.on('blank:contextmenu', ({ x, y, e }) => {
      e.preventDefault();
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        node: null
      });
    });

    const dndInstance = new Dnd({
      target: g,
      scaled: false,
      dndContainer: stencilRef.current,
    });

    // Close context menu when clicking elsewhere
    const handleClickOutside = () => {
      setContextMenu(prev => ({ ...prev, visible: false }));
    };
    document.addEventListener('click', handleClickOutside);

    setGraph(g);
    setDnd(dndInstance);

    return () => {
      g.dispose();
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // Load Data
  useEffect(() => {
    if (!graph || !id) return;

    const loadTask = async () => {
      try {
        const data = await api.get(`/task-flow-configs/${id}`);
        setTaskName(data.name);
        if (data.flowJson) {
          const graphData = JSON.parse(data.flowJson);
          graph.fromJSON(graphData);
          graph.centerContent();
        }
      } catch (err) {
        message.error('加载流程失败: ' + err.message);
      }
    };
    loadTask();
  }, [graph, id]);

  const handleDragStart = (e, type) => {
    if (!graph || !dnd) return;
    
    const config = nodeTypeMap[type];
    const isStartEnd = type === 'START' || type === 'END';
    
    const node = graph.createNode({
      shape: config.type || 'flow-node',
      label: config.label,
      data: { type, config: { name: config.label } },
      ports: isStartEnd ? undefined : {
        items: [
          { id: 'port_top', group: 'top' },
          { id: 'port_bottom', group: 'bottom' },
          { id: 'port_left', group: 'left' },
          { id: 'port_right', group: 'right' }
        ]
      }
    });
    
    if (!isStartEnd && config.color) {
      node.attr('body/stroke', config.color);
      node.attr('ports/groups/top/attrs/circle/stroke', config.color);
      node.attr('ports/groups/bottom/attrs/circle/stroke', config.color);
      node.attr('ports/groups/left/attrs/circle/stroke', config.color);
      node.attr('ports/groups/right/attrs/circle/stroke', config.color);
    }

    dnd.start(node, e.nativeEvent);
  };

  const handleSave = async () => {
    if (!graph) return;
    const json = graph.toJSON();
    
    // Check validation (simplified)
    const nodes = json.cells.filter(c => c.shape !== 'edge');
    if (!nodes.find(n => n.data?.type === 'START')) {
      return message.warning('流程必须包含一个开始节点');
    }

    try {
      await api.put(`/task-flow-configs/${id}`, { flowJson: JSON.stringify(json) });
      message.success('保存成功');
    } catch (err) {
      message.error('保存失败: ' + err.message);
    }
  };

  return (
    <div className="designer-layout">
      {/* Header */}
      <div className="designer-header">
        <div className="header-left">
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/tasks')}>返回</Button>
          <span className="task-title">{taskName}</span>
        </div>
        <Space>
          <Button type="text" icon={<ZoomOutOutlined />} onClick={() => graph?.zoom(-0.1)} />
          <Button type="text" icon={<ZoomInOutlined />} onClick={() => graph?.zoom(0.1)} />
          <Button type="text" icon={<AimOutlined />} onClick={() => graph?.centerContent()} />
          <Button type="default" icon={<SaveOutlined />} onClick={handleSave}>保存</Button>
          <Button type="primary" style={{background: '#10b981', borderColor: '#10b981'}} icon={<BugOutlined />} onClick={() => { handleSave().then(() => setDebugVisible(true)); }}>调试</Button>
        </Space>
      </div>

      <div className="designer-body">
        {/* Left Stencil */}
        <div className="designer-stencil" ref={stencilRef}>
          <div className="stencil-group">基础节点</div>
          <div className="stencil-items-grid">
            <div className="stencil-item start" onMouseDown={e => handleDragStart(e, 'START')}>开始节点</div>
            <div className="stencil-item end" onMouseDown={e => handleDragStart(e, 'END')}>结束节点</div>
            <div className="stencil-item condition" onMouseDown={e => handleDragStart(e, 'CONDITION')}>条件分支</div>
            <div className="stencil-item delay" onMouseDown={e => handleDragStart(e, 'DELAY')}>延迟节点</div>
            <div className="stencil-item script" onMouseDown={e => handleDragStart(e, 'SCRIPT')}>脚本处理</div>
          </div>
          
          <div className="stencil-group">设备与通信</div>
          <div className="stencil-items-grid">
            <div className="stencil-item default" onMouseDown={e => handleDragStart(e, 'DEVICE_DATA')}>设备数据</div>
            <div className="stencil-item default" onMouseDown={e => handleDragStart(e, 'DEVICE_CONTROL')}>设备控制</div>
            <div className="stencil-item tcp" onMouseDown={e => handleDragStart(e, 'TCP_SEND')}>TCP 发送</div>
            <div className="stencil-item http" onMouseDown={e => handleDragStart(e, 'HTTP_REQUEST')}>HTTP 请求</div>
          </div>
          
          <div className="stencil-group">数据处理</div>
          <div className="stencil-items-grid">
            <div className="stencil-item db" onMouseDown={e => handleDragStart(e, 'DB_OPERATION')}>数据库操作</div>
            <div className="stencil-item dedup" onMouseDown={e => handleDragStart(e, 'DEDUP_FILTER')}>去重过滤</div>
            <div className="stencil-item log" onMouseDown={e => handleDragStart(e, 'LOG')}>日志记录</div>
          </div>
        </div>

        {/* Canvas */}
        <div className="designer-canvas-container" ref={containerRef} />
      </div>

      {/* Node Config Modal */}
      <Drawer
        title={`节点配置 - ${selectedNode?.getData()?.type || '未知'}`}
        placement="right"
        size={500}
        onClose={() => setFormVisible(true)}
        open={formVisible}
        destroyOnHidden
      >
        {selectedNode ? (
          <NodeForm 
            nodeData={selectedNode.getData()} 
            onSave={(data) => {
              selectedNode.setData(data);
              selectedNode.attr('label/text', data.config.name);
            }} 
          />
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
            <p>请选择一个节点进行配置</p>
          </div>
        )}
      </Drawer>

      {debugVisible && (
        <DebugConsole 
          visible={debugVisible} 
          taskId={id} 
          onCancel={() => setDebugVisible(false)} 
        />
      )}

      {/* Context Menu */}
      {contextMenu.visible && (
        <Menu
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 10000
          }}
          onClick={(e) => {
            setContextMenu({ ...contextMenu, visible: false });
            if (e.key === 'edit' && contextMenu.node) {
              setSelectedNode(contextMenu.node);
            } else if (e.key === 'delete' && contextMenu.node) {
              graph?.removeCells([contextMenu.node]);
            } else if (e.key === 'center') {
              graph?.centerContent();
            }
          }}
        >
          {contextMenu.node ? (
            [
              <Menu.Item key="edit">编辑节点</Menu.Item>,
              <Menu.Item key="delete">删除节点</Menu.Item>
            ]
          ) : (
            [
              <Menu.Item key="center">居中显示</Menu.Item>
            ]
          )}
        </Menu>
      )}
    </div>
  );
};

export default Designer;