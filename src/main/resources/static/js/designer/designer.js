/* ============================================================
 *  Flow Designer  -  drag-and-drop visual flow editor (AntV X6 v2)
 * ============================================================ */

(function () {
    'use strict';

    // -----------------------------------------------------------------
    //  Node type definitions
    // -----------------------------------------------------------------
    const NODE_TYPES = {
        START:           { label: '开始',     color: '#2a9d8f', icon: '\u25B6', category: 'flow',   ports: { in: 0, out: 1 } },
        END:             { label: '结束',     color: '#e76f51', icon: '\u25A0', category: 'flow',   ports: { in: 1, out: 0 } },
        DELAY:           { label: '延时',     color: '#f4a261', icon: '\u23F1', category: 'flow',   ports: { in: 1, out: 1 } },
        CONDITION:       { label: '条件判断', color: '#e9c46a', icon: '\u25C6', category: 'logic',  ports: { in: 1, out: 3 } },
        VARIABLE:        { label: '变量设置', color: '#8ecae6', icon: '\uD835\uDC65', category: 'logic',  ports: { in: 1, out: 1 } },
        DATA_EXTRACT:    { label: '数据抽取', color: '#219ebc', icon: '\u2193', category: 'data',   ports: { in: 1, out: 1 } },
        DATA_FILTER:     { label: '数据过滤', color: '#023047', icon: '\u2298', category: 'data',   ports: { in: 1, out: 1 } },
        DATA_TRANSFORM:  { label: '数据转换', color: '#6a4c93', icon: '\u27F3', category: 'data',   ports: { in: 1, out: 1 } },
        DATA_LOAD:       { label: '数据保存', color: '#1982c4', icon: '\uD83D\uDCBE', category: 'data',   ports: { in: 1, out: 1 } },
        DEVICE_OPERATION:{ label: '设备操作', color: '#ff595e', icon: '\u26A1', category: 'device', ports: { in: 1, out: 1 } },
        TCP_LISTEN:      { label: 'TCP监听',  color: '#0077b6', icon: '\uD83D\uDD0C', category: 'comm',   ports: { in: 1, out: 1 } },
        TCP_CLIENT:      { label: 'TCP客户端', color: '#0096c7', icon: '\u21C4', category: 'comm',   ports: { in: 1, out: 1 } },
        TCP_SERVER:      { label: 'TCP服务器', color: '#48cae4', icon: '\uD83D\uDDA5', category: 'comm',   ports: { in: 1, out: 1 } },
        SQL_QUERY:       { label: 'SQL查询',  color: '#606c38', icon: '\uD83D\uDDC3', category: 'comm',   ports: { in: 1, out: 1 } },
        HTTP_REQUEST:    { label: 'HTTP请求',  color: '#bc6c25', icon: '\uD83C\uDF10', category: 'comm',   ports: { in: 1, out: 1 } },
        PLC_WRITE:       { label: 'PLC写入',  color: '#9b2226', icon: '\u2699', category: 'comm',   ports: { in: 1, out: 1 } },
        SCRIPT:          { label: '脚本处理', color: '#7209b7', icon: '\uD83D\uDCDC', category: 'data',   ports: { in: 1, out: 1 } },
        LOG:             { label: '日志记录', color: '#06d6a0', icon: '\uD83D\uDCDD', category: 'data',   ports: { in: 1, out: 1 } },
        DEDUP_FILTER:    { label: '防重过滤', color: '#495057', icon: '\uD83D\uDEE1', category: 'logic',  ports: { in: 1, out: 1 } },
    };

    const NODE_CATEGORIES = [
        { key: 'flow',   label: '流程控制', types: ['START', 'END', 'DELAY'] },
        { key: 'logic',  label: '逻辑判断', types: ['CONDITION', 'VARIABLE', 'DEDUP_FILTER'] },
        { key: 'data',   label: '数据处理', types: ['DATA_LOAD', 'SCRIPT', 'LOG'] },
        { key: 'device', label: '设备控制', types: ['DEVICE_OPERATION'] },
        { key: 'comm',   label: '通信集成', types: ['TCP_CLIENT', 'TCP_SERVER', 'HTTP_REQUEST', 'PLC_WRITE'] },
    ];

    // -----------------------------------------------------------------
    //  Caches
    // -----------------------------------------------------------------
    let _deviceCache = null;
    let _operationTypeCache = null;

    async function fetchDevices() {
        if (_deviceCache) return _deviceCache;
        try {
            _deviceCache = await API.get('/devices');
        } catch (_) {
            // Fallback for demo/development if API fails
            _deviceCache = [
                { id: 'dev001', name: '1号温湿度传感器', protocolType: 'MQTT', status: 'ONLINE' },
                { id: 'dev002', name: '2号智能插座', protocolType: 'TCP', status: 'OFFLINE' },
                { id: 'dev003', name: '厂区主网关', protocolType: 'HTTP', status: 'ONLINE' }
            ];
        }
        return _deviceCache;
    }

    async function fetchOperationTypes() {
        if (_operationTypeCache) return _operationTypeCache;
        try {
            _operationTypeCache = await API.get('/operation-types');
        } catch (_) {
            // Fallback for demo/development if API fails
            _operationTypeCache = [
                { code: 'light_on', name: '开灯', description: '打开设备的主控开关。需要参数：无。' },
                { code: 'light_off', name: '关灯', description: '关闭设备的主控开关。需要参数：无。' },
                { code: 'set_temp', name: '设置温度', description: '调节空调或温控设备的设定温度。需要参数：temperature (整数，单位℃)' },
                { code: 'reboot', name: '重启设备', description: '向设备下发软重启指令，设备将在一分钟内离线并重新上线。' },
                { code: 'read_status', name: '读取状态', description: '主动拉取设备的最新全量运行状态数据。' }
            ];
        }
        return _operationTypeCache;
    }

    // -----------------------------------------------------------------
    //  Helpers
    // -----------------------------------------------------------------
    const esc = (s) => App.escapeHtml(s);

    function uid() {
        return 'n_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    }

    const fieldStyle  = 'width:100%;padding:6px 10px;border:1px solid #d9d9d9;border-radius:4px;font-size:13px;box-sizing:border-box;';
    const labelStyle  = 'display:block;margin:10px 0 4px;font-size:13px;color:#333;font-weight:500;';
    const smallBtn    = 'padding:4px 10px;border:none;border-radius:4px;cursor:pointer;font-size:12px;';

    // -----------------------------------------------------------------
    //  FlowDesigner object
    // -----------------------------------------------------------------
    const FlowDesigner = {
        graph: null,
        taskId: null,
        taskData: null,
        dirty: false,
        selectedNode: null,
        selectedEdge: null,
        _resizeObserver: null,

        // =============================================================
        //  Initialise / Open
        // =============================================================
        async open(taskId) {
            this.taskId = taskId;
            this.dirty = false;
            this.selectedNode = null;
            this.selectedEdge = null;

            // Show overlay, hide layout
            const overlay = document.getElementById('designer-overlay');
            const layout  = document.getElementById('layout');
            if (overlay) overlay.classList.remove('hidden');
            if (layout)  layout.style.display = 'none';

            // Load task data
            try {
                this.taskData = await API.get('/task-flow-configs/' + taskId);
            } catch (e) {
                App.showToast('加载任务失败: ' + e.message, 'error');
                this.close();
                return;
            }

            const titleEl = document.getElementById('designer-title');
            if (titleEl) titleEl.textContent = '流程设计器 - ' + (this.taskData.name || '');

            this.renderNodePanel();
            this.initGraph();
            this.bindToolbar();
            this.loadFlow();
            this.bindGraphEvents();
            this.renderConfigHint();
        },

        // =============================================================
        //  Node Panel (left sidebar)
        // =============================================================
        renderNodePanel() {
            const panel = document.getElementById('node-panel');
            if (!panel) return;

            let html = '';
            NODE_CATEGORIES.forEach(cat => {
                html += '<div class="node-category">';
                html += '<div style="font-size:12px;color:#888;padding:8px 12px 4px;font-weight:600;text-transform:uppercase;">' + esc(cat.label) + '</div>';
                cat.types.forEach(type => {
                    const def = NODE_TYPES[type];
                    html += '<div class="node-item" draggable="true" data-type="' + type + '" style="display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:grab;border-radius:4px;margin:2px 8px;transition:background 0.15s;">';
                    html += '<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;background:' + def.color + ';color:#fff;font-size:14px;">' + def.icon + '</span>';
                    html += '<span style="font-size:13px;color:#333;">' + esc(def.label) + '</span>';
                    html += '</div>';
                });
                html += '</div>';
            });
            panel.innerHTML = html;

            // Drag start
            panel.querySelectorAll('.node-item').forEach(item => {
                item.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('application/x-flow-node-type', item.dataset.type);
                    e.dataTransfer.effectAllowed = 'copy';
                });
            });

            // Hover style
            panel.addEventListener('mouseover', (e) => {
                const ni = e.target.closest('.node-item');
                if (ni) ni.style.background = '#f0f5ff';
            });
            panel.addEventListener('mouseout', (e) => {
                const ni = e.target.closest('.node-item');
                if (ni) ni.style.background = '';
            });
        },

        // =============================================================
        //  Graph initialisation
        // =============================================================
        initGraph() {
            if (this.graph) {
                this.graph.dispose();
                this.graph = null;
            }

            const container = document.getElementById('canvas-container');
            if (!container) return;

            // Clear any previous content inside the container (X6 appends SVG)
            container.innerHTML = '';

            const graph = new X6.Graph({
                container: container,
                autoResize: true,
                background: { color: '#fafafa' },
                grid: { visible: true, size: 15, type: 'dot' },
                panning: { enabled: true, modifiers: [] },
                mousewheel: { enabled: true, modifiers: [] },
                connecting: {
                    router: 'manhattan',
                    connector: { name: 'rounded', args: { radius: 8 } },
                    snap: { radius: 30 },
                    allowBlank: false,
                    allowMulti: true,
                    allowLoop: false,
                    allowEdge: false,
                    createEdge: function () {
                        return new X6.Shape.Edge({
                            attrs: {
                                line: {
                                    stroke: '#8f8f8f',
                                    strokeWidth: 2,
                                    targetMarker: { name: 'classic', size: 8 },
                                },
                            },
                            labels: [{ attrs: { label: { text: '' } } }],
                        });
                    },
                    validateConnection: function (args) {
                        var sourceCell = args.sourceCell;
                        var targetCell = args.targetCell;
                        if (!sourceCell || !targetCell) return false;
                        if (sourceCell === targetCell) return false;
                        var targetData = targetCell.getData && targetCell.getData();
                        if (targetData && targetData.type === 'START') return false;
                        var sourceData = sourceCell.getData && sourceCell.getData();
                        if (sourceData && sourceData.type === 'END') return false;
                        return true;
                    },
                },
                selecting: { enabled: true, showNodeSelectionBox: true },
                snapline: { enabled: true },
                history: { enabled: true },
            });

            this.graph = graph;

            // Drop handler on canvas
            container.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
            });

            container.addEventListener('drop', (e) => {
                e.preventDefault();
                const type = e.dataTransfer.getData('application/x-flow-node-type');
                if (!type || !NODE_TYPES[type]) return;

                // Calculate position relative to the graph canvas
                const rect = container.getBoundingClientRect();
                const zoom = graph.zoom();
                const translate = graph.translate();

                const x = (e.clientX - rect.left - translate.tx) / zoom;
                const y = (e.clientY - rect.top  - translate.ty) / zoom;

                this.createFlowNode(type, x, y);
                this.dirty = true;
            });

            // ResizeObserver to keep X6 sized correctly
            if (this._resizeObserver) this._resizeObserver.disconnect();
            this._resizeObserver = new ResizeObserver(() => {
                if (this.graph) this.graph.resize();
            });
            this._resizeObserver.observe(container);
        },

        // =============================================================
        //  Create a flow node on the graph
        // =============================================================
        createFlowNode(type, x, y, config) {
            config = config || {};
            var typeDef = NODE_TYPES[type];
            if (!typeDef) return null;

            var portItems = [];
            var i;
            for (i = 0; i < typeDef.ports.in; i++) {
                portItems.push({ id: 'in_' + i, group: 'in' });
            }
            for (i = 0; i < typeDef.ports.out; i++) {
                portItems.push({ id: 'out_' + i, group: 'out' });
            }

            var displayName = config.name || typeDef.label;
            var nodeId = config._id || uid();

            var node = this.graph.addNode({
                id: nodeId,
                x: x,
                y: y,
                width: 180,
                height: 60,
                shape: 'rect',
                attrs: {
                    body: {
                        rx: 8, ry: 8,
                        fill: '#fff',
                        stroke: typeDef.color,
                        strokeWidth: 2,
                    },
                    label: {
                        text: typeDef.icon + ' ' + displayName,
                        fill: '#333',
                        fontSize: 14,
                    },
                },
                ports: {
                    groups: {
                        'in': {
                            position: 'left',
                            attrs: {
                                circle: {
                                    r: 6, magnet: true,
                                    stroke: '#8f8f8f', strokeWidth: 1, fill: '#fff',
                                },
                            },
                        },
                        'out': {
                            position: type === 'CONDITION' ? 'bottom' : 'right',
                            attrs: {
                                circle: {
                                    r: 6, magnet: true,
                                    stroke: '#8f8f8f', strokeWidth: 1, fill: typeDef.color,
                                },
                            },
                        },
                    },
                    items: portItems,
                },
                data: {
                    type: type,
                    config: Object.assign({ name: typeDef.label }, config),
                },
            });

            return node;
        },

        // =============================================================
        //  Load existing flow from taskData
        // =============================================================
        loadFlow() {
            if (!this.graph) return;
            this.graph.clearCells();

            var flowJson = null;
            if (this.taskData && this.taskData.flowJson) {
                try {
                    flowJson = typeof this.taskData.flowJson === 'string'
                        ? JSON.parse(this.taskData.flowJson)
                        : this.taskData.flowJson;
                } catch (_) {
                    flowJson = null;
                }
            }

            if (!flowJson || !flowJson.nodes || flowJson.nodes.length === 0) {
                // Default: single START node
                this.createFlowNode('START', 100, 200);
                this.dirty = false;
                return;
            }

            // Restore nodes
            var idMap = {};
            var self = this;
            flowJson.nodes.forEach(function (n) {
                var cfg = Object.assign({}, n.config || {});
                cfg.name = cfg.name || n.name || NODE_TYPES[n.type].label;
                cfg._id = n.id;
                var node = self.createFlowNode(n.type, n.x || 0, n.y || 0, cfg);
                if (node) idMap[n.id] = node.id;
            });

            // Restore edges
            if (flowJson.edges) {
                flowJson.edges.forEach(function (e) {
                    self.graph.addEdge({
                        id: e.id || uid(),
                        source: { cell: e.source, port: e.sourcePort },
                        target: { cell: e.target, port: e.targetPort },
                        attrs: {
                            line: {
                                stroke: '#8f8f8f',
                                strokeWidth: 2,
                                targetMarker: { name: 'classic', size: 8 },
                            },
                        },
                        labels: e.label ? [{ attrs: { label: { text: e.label } } }] : [],
                    });
                });
            }

            this.dirty = false;
        },

        // =============================================================
        //  Graph event bindings
        // =============================================================
        bindGraphEvents() {
            var self = this;
            var graph = this.graph;
            if (!graph) return;

            graph.on('node:click', function (args) {
                self.selectedEdge = null;
                self.selectedNode = args.node;
                self.renderNodeConfig(args.node);
            });

            graph.on('edge:click', function (args) {
                self.selectedNode = null;
                self.selectedEdge = args.edge;
                self.renderEdgeConfig(args.edge);
            });

            graph.on('blank:click', function () {
                self.selectedNode = null;
                self.selectedEdge = null;
                self.renderConfigHint();
            });

            // Track dirty state on any cell change
            graph.on('cell:change:*', function () { self.dirty = true; });
            graph.on('cell:added',    function () { self.dirty = true; });
            graph.on('cell:removed',  function () { self.dirty = true; });
            graph.on('edge:connected', function () { self.dirty = true; });
        },

        // =============================================================
        //  Toolbar bindings
        // =============================================================
        bindToolbar() {
            var self = this;

            var backBtn = document.getElementById('designer-back');
            var saveBtn = document.getElementById('designer-save');
            var validateBtn = document.getElementById('designer-validate');

            // Remove previous listeners by cloning
            if (backBtn) {
                var newBack = backBtn.cloneNode(true);
                backBtn.parentNode.replaceChild(newBack, backBtn);
                newBack.addEventListener('click', function () { self.handleClose(); });
            }
            if (saveBtn) {
                var newSave = saveBtn.cloneNode(true);
                saveBtn.parentNode.replaceChild(newSave, saveBtn);
                newSave.addEventListener('click', function () { self.handleSave(); });
            }
            if (validateBtn) {
                var newVal = validateBtn.cloneNode(true);
                validateBtn.parentNode.replaceChild(newVal, validateBtn);
                newVal.addEventListener('click', function () { self.validate(true); });
            }

            var executeBtn = document.getElementById('designer-execute');
            if (executeBtn) {
                var newExec = executeBtn.cloneNode(true);
                executeBtn.parentNode.replaceChild(newExec, executeBtn);
                newExec.addEventListener('click', function () { self.handleExecute(); });
            }
        },

        // =============================================================
        //  Close
        // =============================================================
        handleClose() {
            var self = this;
            if (this.dirty) {
                App.confirm('有未保存的修改，确定要离开吗？', function () {
                    App.hideModal();
                    self.dispose();
                    location.hash = '#/tasks';
                });
            } else {
                this.dispose();
                location.hash = '#/tasks';
            }
        },

        dispose() {
            if (this._resizeObserver) {
                this._resizeObserver.disconnect();
                this._resizeObserver = null;
            }
            if (this.graph) {
                this.graph.dispose();
                this.graph = null;
            }
            var overlay = document.getElementById('designer-overlay');
            var layout  = document.getElementById('layout');
            if (overlay) overlay.classList.add('hidden');
            if (layout)  layout.style.display = '';

            this.selectedNode = null;
            this.selectedEdge = null;
            this.taskId = null;
            this.taskData = null;
            this.dirty = false;
        },

        // =============================================================
        //  Serialise graph -> flow_json
        // =============================================================
        serialise() {
            var graph = this.graph;
            if (!graph) return { nodes: [], edges: [] };

            var nodes = graph.getNodes().map(function (node) {
                var pos  = node.getPosition();
                var data = node.getData() || {};
                return {
                    id: node.id,
                    type: data.type,
                    name: (data.config && data.config.name) || NODE_TYPES[data.type].label,
                    x: pos.x,
                    y: pos.y,
                    config: data.config || {},
                };
            });

            var edges = graph.getEdges().map(function (edge) {
                var src = edge.getSourceCellId();
                var tgt = edge.getTargetCellId();
                var srcPort = edge.getSourcePortId();
                var tgtPort = edge.getTargetPortId();
                var lbl = '';
                var labels = edge.getLabels();
                if (labels && labels.length > 0 && labels[0].attrs && labels[0].attrs.label) {
                    lbl = labels[0].attrs.label.text || '';
                }
                return {
                    id: edge.id,
                    source: src,
                    sourcePort: srcPort || '',
                    target: tgt,
                    targetPort: tgtPort || '',
                    label: lbl,
                };
            });

            return { nodes: nodes, edges: edges };
        },

        // =============================================================
        //  Save
        // =============================================================
        async handleSave() {
            var warnings = this.validate(false);
            // Warnings don't block save - only show them
            if (warnings.length > 0) {
                warnings.forEach(function (msg) { App.showToast(msg, 'warning'); });
            }

            var flowData = this.serialise();

            // Extract start node config
            var startNodeConfig = null;
            flowData.nodes.forEach(function (n) {
                if (n.type === 'START') startNodeConfig = n.config;
            });

            var payload = {
                flowJson: JSON.stringify(flowData),
                startNodeConfig: startNodeConfig ? JSON.stringify(startNodeConfig) : null,
            };

            try {
                await API.put('/task-flow-configs/' + this.taskId, payload);
                this.dirty = false;
                App.showToast('保存成功', 'success');
            } catch (e) {
                App.showToast('保存失败: ' + e.message, 'error');
            }
        },

        async handleExecute() {
            // Save first, then execute
            var warnings = this.validate(false);
            if (warnings.length > 0) {
                warnings.forEach(function (msg) { App.showToast(msg, 'warning'); });
            }

            var flowData = this.serialise();
            var startNodeConfig = null;
            flowData.nodes.forEach(function (n) {
                if (n.type === 'START') startNodeConfig = n.config;
            });

            var payload = {
                flowJson: JSON.stringify(flowData),
                startNodeConfig: startNodeConfig ? JSON.stringify(startNodeConfig) : null,
            };

            try {
                await API.put('/task-flow-configs/' + this.taskId, payload);
                this.dirty = false;
                App.showToast('已保存，开始执行...', 'info');
            } catch (e) {
                App.showToast('保存失败，无法执行: ' + e.message, 'error');
                return;
            }

            // Execute
            var execBtn = document.getElementById('designer-execute');
            if (execBtn) {
                execBtn.disabled = true;
                execBtn.textContent = '执行中...';
            }
            try {
                var result = await API.post('/task-flow-configs/' + this.taskId + '/execute');
                if (window.Pages && window.Pages.tasks) {
                    window.Pages.tasks.showExecResult(result);
                }
            } catch (e) {
                App.showToast('执行失败: ' + e.message, 'error');
            } finally {
                if (execBtn) {
                    execBtn.disabled = false;
                    execBtn.textContent = '执行';
                }
            }
        },

        // =============================================================
        //  Validate
        // =============================================================
        validate(showToast) {
            var graph = this.graph;
            if (!graph) return ['设计器未初始化'];

            var errors = [];
            var nodes = graph.getNodes();
            var edges = graph.getEdges();

            // Restore all node borders first
            nodes.forEach(function (n) {
                var data = n.getData() || {};
                var typeDef = NODE_TYPES[data.type];
                if (typeDef) {
                    n.attr('body/stroke', typeDef.color);
                }
            });

            // Exactly one START node
            var startNodes = nodes.filter(function (n) {
                var d = n.getData();
                return d && d.type === 'START';
            });
            if (startNodes.length === 0) {
                errors.push('必须有一个开始节点');
            } else if (startNodes.length > 1) {
                errors.push('只能有一个开始节点');
                startNodes.slice(1).forEach(function (n) { n.attr('body/stroke', '#ff4d4f'); });
            }

            // At least one END node
            var endNodes = nodes.filter(function (n) {
                var d = n.getData();
                return d && d.type === 'END';
            });
            if (endNodes.length === 0) {
                errors.push('至少需要一个结束节点');
            }

            // All nodes reachable from START (BFS)
            if (startNodes.length === 1) {
                var visited = {};
                var queue = [startNodes[0].id];
                visited[startNodes[0].id] = true;
                while (queue.length > 0) {
                    var current = queue.shift();
                    edges.forEach(function (e) {
                        if (e.getSourceCellId() === current) {
                            var tid = e.getTargetCellId();
                            if (!visited[tid]) {
                                visited[tid] = true;
                                queue.push(tid);
                            }
                        }
                    });
                }
                nodes.forEach(function (n) {
                    if (!visited[n.id]) {
                        errors.push('节点 "' + ((n.getData() && n.getData().config && n.getData().config.name) || n.id) + '" 不可达');
                        n.attr('body/stroke', '#ff4d4f');
                    }
                });
            }

            // Required config checks
            startNodes.forEach(function (n) {
                var cfg = (n.getData() && n.getData().config) || {};
                if (!cfg.deviceId) {
                    errors.push('开始节点必须选择设备');
                    n.attr('body/stroke', '#ff4d4f');
                }
            });

            nodes.forEach(function (n) {
                var data = n.getData() || {};
                if (data.type === 'CONDITION') {
                    var cfg = data.config || {};
                    if (!cfg.branches || cfg.branches.length === 0) {
                        errors.push('条件节点 "' + (cfg.name || '') + '" 至少需要一个分支');
                        n.attr('body/stroke', '#ff4d4f');
                    }
                }
            });

            if (showToast) {
                if (errors.length === 0) {
                    App.showToast('校验通过', 'success');
                } else {
                    errors.forEach(function (msg) { App.showToast(msg, 'error'); });
                }
            }

            return errors;
        },

        // =============================================================
        //  Config panel  -  hint (no selection)
        // =============================================================
        renderConfigHint() {
            var el = document.getElementById('config-content');
            if (!el) return;
            el.innerHTML = '<p class="config-hint" style="color:#999;text-align:center;margin-top:40px;">点击节点或连线查看配置</p>';
        },

        // =============================================================
        //  Config panel  -  edge
        // =============================================================
        renderEdgeConfig(edge) {
            var el = document.getElementById('config-content');
            if (!el) return;

            var labels = edge.getLabels();
            var currentLabel = '';
            if (labels && labels.length > 0 && labels[0].attrs && labels[0].attrs.label) {
                currentLabel = labels[0].attrs.label.text || '';
            }

            el.innerHTML =
                '<div style="padding:12px;">' +
                '<h4 style="margin:0 0 12px;font-size:15px;border-bottom:1px solid #e8e8e8;padding-bottom:8px;">连线配置</h4>' +
                '<label style="' + labelStyle + '">标签</label>' +
                '<input id="cfg-edge-label" type="text" value="' + esc(currentLabel) + '" style="' + fieldStyle + '" placeholder="连线标签" />' +
                '<button id="cfg-edge-delete" style="' + smallBtn + 'background:#ff4d4f;color:#fff;margin-top:16px;width:100%;">删除连线</button>' +
                '</div>';

            var self = this;
            document.getElementById('cfg-edge-label').addEventListener('input', function () {
                edge.setLabels([{ attrs: { label: { text: this.value } } }]);
                self.dirty = true;
            });
            document.getElementById('cfg-edge-delete').addEventListener('click', function () {
                self.graph.removeEdge(edge);
                self.selectedEdge = null;
                self.renderConfigHint();
            });
        },

        // =============================================================
        //  Config panel  -  node (dispatch by type)
        // =============================================================
        renderNodeConfig(node) {
            var data = node.getData() || {};
            var type = data.type;
            var config = data.config || {};
            var el = document.getElementById('config-content');
            if (!el) return;

            var html = '<div style="padding:12px;">';
            html += '<h4 style="margin:0 0 12px;font-size:15px;border-bottom:1px solid #e8e8e8;padding-bottom:8px;">' + esc(NODE_TYPES[type].icon + ' ' + NODE_TYPES[type].label) + ' 配置</h4>';

            switch (type) {
                case 'START':       html += this.buildStartConfig(config); break;
                case 'END':         html += this.buildEndConfig(config); break;
                case 'DELAY':       html += this.buildDelayConfig(config); break;
                case 'CONDITION':   html += this.buildConditionConfig(config); break;
                case 'VARIABLE':    html += this.buildVariableConfig(config); break;
                case 'DATA_EXTRACT': html += this.buildDataExtractConfig(config); break;
                case 'DATA_FILTER': html += this.buildDataFilterConfig(config); break;
                case 'DATA_TRANSFORM': html += this.buildDataTransformConfig(config); break;
                case 'DATA_LOAD':   html += this.buildDataLoadConfig(config); break;
                case 'DEVICE_OPERATION': html += this.buildDeviceOperationConfig(config); break;
                case 'TCP_LISTEN':      html += this.buildTcpListenConfig(config); break;
                case 'TCP_CLIENT':      html += this.buildTcpClientConfig(config); break;
                case 'TCP_SERVER':      html += this.buildTcpServerConfig(config); break;
                case 'SQL_QUERY':       html += this.buildSqlQueryConfig(config); break;
                case 'HTTP_REQUEST':    html += this.buildHttpRequestConfig(config); break;
                case 'PLC_WRITE':       html += this.buildPlcWriteConfig(config); break;
                case 'SCRIPT':          html += this.buildScriptConfig(config); break;
                case 'LOG':             html += this.buildLogConfig(config); break;
                case 'DEDUP_FILTER':    html += this.buildDedupFilterConfig(config); break;
                default:            html += this.buildGenericConfig(config); break;
            }

            html += '<button id="cfg-delete-node" style="' + smallBtn + 'background:#ff4d4f;color:#fff;margin-top:20px;width:100%;">删除节点</button>';
            html += '</div>';
            el.innerHTML = html;

            this.bindConfigEvents(node, type);
        },

        // -- Config builders -------------------------------------------

        buildNameField(config) {
            return '<label style="' + labelStyle + '">名称</label>' +
                '<input id="cfg-name" type="text" value="' + esc(config.name || '') + '" style="' + fieldStyle + '" />';
        },

        buildGenericConfig(config) {
            return this.buildNameField(config);
        },

        // START
        buildStartConfig(config) {
            var h = this.buildNameField(config);
            h += '<label style="' + labelStyle + '">描述</label>';
            h += '<textarea id="cfg-description" rows="2" style="' + fieldStyle + 'resize:vertical;">' + esc(config.description || '') + '</textarea>';
            h += '<label style="' + labelStyle + '">设备 (可选)</label>';
            h += '<select id="cfg-deviceId" style="' + fieldStyle + '"><option value="">-- 全局流程 / 不绑定具体设备 --</option></select>';
            h += '<label style="' + labelStyle + '">协议类型</label>';
            h += '<select id="cfg-protocolType" style="' + fieldStyle + '">' +
                 '<option value="MQTT"' + (config.protocolType === 'MQTT' ? ' selected' : '') + '>MQTT</option>' +
                 '<option value="HTTP"' + (config.protocolType === 'HTTP' ? ' selected' : '') + '>HTTP</option>' +
                 '</select>';
            h += '<label style="' + labelStyle + '">触发类型</label>';
            h += '<div id="cfg-trigger-group" style="display:flex;gap:12px;margin-bottom:4px;">';
            ['ONCE', 'SCHEDULED', 'EVENT'].forEach(function (v) {
                var lbl = { ONCE: '单次', SCHEDULED: '定时', EVENT: '事件' }[v];
                h += '<label style="font-size:13px;cursor:pointer;"><input type="radio" name="cfg-triggerType" value="' + v + '"' + (config.triggerType === v ? ' checked' : '') + ' /> ' + lbl + '</label>';
            });
            h += '</div>';
            h += '<div id="cfg-cron-row" style="display:' + (config.triggerType === 'SCHEDULED' ? 'block' : 'none') + ';">';
            h += '<label style="' + labelStyle + '">Cron 表达式</label>';
            h += '<input id="cfg-cronExpression" type="text" value="' + esc(config.cronExpression || '') + '" style="' + fieldStyle + '" placeholder="0 0/5 * * * ?" />';
            h += '</div>';
            h += '<div id="cfg-topic-row" style="display:' + (config.triggerType === 'EVENT' ? 'block' : 'none') + ';">';
            h += '<label style="' + labelStyle + '">监听主题 (Topic) 说明</label>';
            h += '<p style="font-size:12px;color:#888;margin-top:0;margin-bottom:8px;line-height:1.4;">如选择由设备事件或MQTT消息触发此流程，可在此处指定监听的主题(例如: /device/+/data)。流程引擎将自动把匹配该主题的消息路由到本流程进行处理。</p>';
            h += '<input id="cfg-listenTopic" type="text" value="' + esc(config.listenTopic || '') + '" style="' + fieldStyle + '" placeholder="/device/+/data" />';
            h += '</div>';
            return h;
        },

        // END
        buildEndConfig(config) {
            var h = this.buildNameField(config);
            h += '<label style="' + labelStyle + '">描述</label>';
            h += '<textarea id="cfg-description" rows="2" style="' + fieldStyle + 'resize:vertical;">' + esc(config.description || '') + '</textarea>';
            return h;
        },

        // DELAY
        buildDelayConfig(config) {
            var h = this.buildNameField(config);
            h += '<label style="' + labelStyle + '">延时 (毫秒)</label>';
            h += '<input id="cfg-delayMs" type="number" value="' + (config.delayMs || 1000) + '" style="' + fieldStyle + '" min="0" />';
            return h;
        },

        // CONDITION
        buildConditionConfig(config) {
            var h = this.buildNameField(config);
            var branches = config.branches || [];
            
            // Logic operator (AND/OR)
            var logic = config.logic || 'AND';
            h += '<label style="' + labelStyle + '">条件组合逻辑</label>';
            h += '<select id="cfg-cond-logic" style="' + fieldStyle + 'margin-bottom:12px;">';
            h += '<option value="AND"' + (logic === 'AND' ? ' selected' : '') + '>满足所有条件 (AND)</option>';
            h += '<option value="OR"' + (logic === 'OR' ? ' selected' : '') + '>满足任一条件 (OR)</option>';
            h += '</select>';

            h += '<label style="' + labelStyle + '">分支条件</label>';
            h += '<div id="cfg-branches">';
            branches.forEach(function (br, idx) {
                var cond = br.condition || {};
                h += '<div class="branch-row" data-idx="' + idx + '" style="border:1px solid #e8e8e8;border-radius:4px;padding:8px;margin-bottom:6px;background:#fafafa;">';
                h += '<input class="br-name" type="text" value="' + esc(br.name || '') + '" placeholder="分支名称" style="' + fieldStyle + 'margin-bottom:4px;" />';
                h += '<input class="br-variable" type="text" value="' + esc(cond.left || '') + '" placeholder="变量路径" style="' + fieldStyle + 'margin-bottom:4px;" />';
                h += '<select class="br-operator" style="' + fieldStyle + 'margin-bottom:4px;">';
                
                // Use Chinese labels for operators
                const ops = [
                    {val: '==', label: '等于 (=='},
                    {val: '!=', label: '不等于 (!=)'},
                    {val: '>', label: '大于 (>)'},
                    {val: '<', label: '小于 (<)'},
                    {val: '>=', label: '大于等于 (>=)'},
                    {val: '<=', label: '小于等于 (<=)'},
                    {val: 'contains', label: '包含 (contains)'},
                    {val: 'starts_with', label: '以...开头 (starts_with)'},
                    {val: 'array_length_gte', label: '数组长度>= (array_length_gte)'},
                    {val: 'array_length_gt', label: '数组长度> (array_length_gt)'},
                    {val: 'not_null', label: '不为空 (not_null)'},
                    {val: 'is_null', label: '为空 (is_null)'}
                ];
                
                ops.forEach(function (op) {
                    h += '<option value="' + op.val + '"' + (cond.operator === op.val ? ' selected' : '') + '>' + esc(op.label) + '</option>';
                });
                h += '</select>';
                
                // Hide value input for null checks
                var hideValue = (cond.operator === 'is_null' || cond.operator === 'not_null') ? 'display:none;' : '';
                h += '<input class="br-value" type="text" value="' + esc(cond.right || '') + '" placeholder="比较值" style="' + fieldStyle + 'margin-bottom:4px;' + hideValue + '" />';
                h += '<button class="br-remove" data-idx="' + idx + '" style="' + smallBtn + 'background:#ff4d4f;color:#fff;">移除</button>';
                h += '</div>';
            });
            h += '</div>';
            h += '<button id="cfg-add-branch" style="' + smallBtn + 'background:#1890ff;color:#fff;margin-top:4px;">+ 添加分支</button>';
            h += '<label style="' + labelStyle + 'margin-top:12px;">默认分支名称</label>';
            h += '<input id="cfg-defaultBranch" type="text" value="' + esc(config.defaultBranch || 'default') + '" style="' + fieldStyle + '" />';
            return h;
        },

        // VARIABLE
        buildVariableConfig(config) {
            var h = this.buildNameField(config);
            var ops = config.operations || [];
            h += '<label style="' + labelStyle + '">变量操作</label>';
            h += '<div id="cfg-var-ops">';
            ops.forEach(function (op, idx) {
                h += '<div class="var-op-row" data-idx="' + idx + '" style="border:1px solid #e8e8e8;border-radius:4px;padding:8px;margin-bottom:6px;background:#fafafa;">';
                h += '<select class="vo-action" style="' + fieldStyle + 'margin-bottom:4px;">';
                ['set', 'copy', 'delete'].forEach(function (a) {
                    h += '<option value="' + a + '"' + (op.action === a ? ' selected' : '') + '>' + a + '</option>';
                });
                h += '</select>';
                h += '<input class="vo-path" type="text" value="' + esc(op.path || '') + '" placeholder="变量路径" style="' + fieldStyle + 'margin-bottom:4px;" />';
                h += '<input class="vo-value" type="text" value="' + esc(op.value || op.source || '') + '" placeholder="值/来源" style="' + fieldStyle + 'margin-bottom:4px;' + (op.action === 'delete' ? 'display:none;' : '') + '" />';
                h += '<button class="vo-remove" data-idx="' + idx + '" style="' + smallBtn + 'background:#ff4d4f;color:#fff;">移除</button>';
                h += '</div>';
            });
            h += '</div>';
            h += '<button id="cfg-add-var-op" style="' + smallBtn + 'background:#1890ff;color:#fff;margin-top:4px;">+ 添加操作</button>';
            return h;
        },

        // DATA_EXTRACT
        buildDataExtractConfig(config) {
            var h = this.buildNameField(config);
            h += '<label style="' + labelStyle + '">数据源路径</label>';
            h += '<input id="cfg-sourcePath" type="text" value="' + esc(config.sourcePath || '') + '" style="' + fieldStyle + '" placeholder="$.payload.data" />';
            h += '<label style="' + labelStyle + '">目标路径</label>';
            h += '<input id="cfg-targetPath" type="text" value="' + esc(config.targetPath || '') + '" style="' + fieldStyle + '" placeholder="$.variables.extracted" />';
            return h;
        },

        // DATA_FILTER
        buildDataFilterConfig(config) {
            var h = this.buildNameField(config);
            var conditions = config.conditions || [];
            h += '<label style="' + labelStyle + '">过滤条件</label>';
            h += '<div id="cfg-filter-conds">';
            conditions.forEach(function (c, idx) {
                h += '<div class="filter-row" data-idx="' + idx + '" style="border:1px solid #e8e8e8;border-radius:4px;padding:8px;margin-bottom:6px;background:#fafafa;">';
                h += '<input class="fc-field" type="text" value="' + esc(c.field || '') + '" placeholder="字段" style="' + fieldStyle + 'margin-bottom:4px;" />';
                h += '<select class="fc-operator" style="' + fieldStyle + 'margin-bottom:4px;">';
                ['==', '!=', '>', '<', '>=', '<=', 'contains'].forEach(function (op) {
                    h += '<option value="' + op + '"' + (c.operator === op ? ' selected' : '') + '>' + esc(op) + '</option>';
                });
                h += '</select>';
                h += '<input class="fc-value" type="text" value="' + esc(c.value || '') + '" placeholder="值" style="' + fieldStyle + 'margin-bottom:4px;" />';
                h += '<button class="fc-remove" data-idx="' + idx + '" style="' + smallBtn + 'background:#ff4d4f;color:#fff;">移除</button>';
                h += '</div>';
            });
            h += '</div>';
            h += '<button id="cfg-add-filter" style="' + smallBtn + 'background:#1890ff;color:#fff;margin-top:4px;">+ 添加条件</button>';
            return h;
        },

        // SCRIPT
        buildScriptConfig(config) {
            var h = this.buildNameField(config);
            h += '<p style="color:#666;font-size:12px;margin-bottom:8px;">对变量或数据进行转换处理。每个步骤按顺序执行，执行结果将保存到指定的输出变量中。</p>';
            
            var ops = config.operations || [];
            h += '<label style="' + labelStyle + '">处理步骤</label>';
            h += '<div id="cfg-script-ops">';
            ops.forEach(function (op, idx) {
                h += '<div class="script-op-row" data-idx="' + idx + '" style="border:1px solid #e8e8e8;border-radius:4px;padding:8px;margin-bottom:6px;background:#fafafa;">';
                
                h += '<label style="font-size:11px;color:#888;">源变量路径 (如: $.payload.data)</label>';
                h += '<input class="so-source" type="text" value="' + esc(op.source || '') + '" placeholder="源变量" style="' + fieldStyle + 'margin-bottom:4px;" />';
                
                h += '<label style="font-size:11px;color:#888;">操作类型</label>';
                h += '<select class="so-op" style="' + fieldStyle + 'margin-bottom:4px;">';
                const opTypes = [
                    {val: 'HEX_TO_DEC', label: '16进制转10进制 (单个)'},
                    {val: 'DEC_TO_HEX', label: '10进制转16进制 (单个)'},
                    {val: 'HEX_ARRAY_TO_DEC', label: '16进制转10进制 (数组)'},
                    {val: 'DEC_ARRAY_TO_HEX', label: '10进制转16进制 (数组)'},
                    {val: 'HEX_STRING_TO_DEC_ARRAY', label: '16进制字符串转10进制数组'},
                    {val: 'STRING_TO_HEX', label: '字符串转16进制'},
                    {val: 'HEX_TO_STRING', label: '16进制转字符串'},
                    {val: 'SUBSTRING', label: '截取字符串 (SUBSTRING)'},
                    {val: 'REPLACE', label: '替换字符串 (REPLACE)'},
                    {val: 'SPLIT', label: '分割字符串 (SPLIT)'},
                    {val: 'JOIN', label: '拼接数组 (JOIN)'},
                    {val: 'CONCAT', label: '合并多个值 (CONCAT)'},
                    {val: 'ROUND', label: '四舍五入 (ROUND)'},
                    {val: 'TO_NUMBER', label: '转为数字 (TO_NUMBER)'},
                    {val: 'TO_STRING', label: '转为字符串 (TO_STRING)'},
                    {val: 'ARRAY_LENGTH', label: '获取长度 (ARRAY_LENGTH)'},
                    {val: 'JSON_PARSE', label: '解析JSON (JSON_PARSE)'},
                    {val: 'JSON_STRINGIFY', label: '转为JSON字符串 (JSON_STRINGIFY)'}
                ];
                opTypes.forEach(function (t) {
                    h += '<option value="' + t.val + '"' + (op.op === t.val ? ' selected' : '') + '>' + t.label + '</option>';
                });
                h += '</select>';
                
                h += '<label style="font-size:11px;color:#888;">操作参数 (JSON格式，例如: {"start":0,"end":5})</label>';
                h += '<input class="so-params" type="text" value="' + esc(typeof op.params === 'object' ? JSON.stringify(op.params) : (op.params || '')) + '" placeholder="参数" style="' + fieldStyle + 'margin-bottom:4px;" />';
                
                h += '<label style="font-size:11px;color:#888;">输出变量路径 (结果保存位置，若留空则不保存)</label>';
                h += '<input class="so-target" type="text" value="' + esc(op.target || '') + '" placeholder="目标变量" style="' + fieldStyle + 'margin-bottom:4px;" />';
                
                h += '<button class="so-remove" data-idx="' + idx + '" style="' + smallBtn + 'background:#ff4d4f;color:#fff;">移除</button>';
                h += '</div>';
            });
            h += '</div>';
            h += '<button id="cfg-add-script-op" style="' + smallBtn + 'background:#1890ff;color:#fff;margin-top:4px;">+ 添加处理步骤</button>';
            return h;
        },

            // DATA_LOAD
        buildDataLoadConfig(config) {
            var h = this.buildNameField(config);

            // Database mode
            h += '<label style="' + labelStyle + '">数据库模式</label>';
            h += '<select id="cfg-dl-dbMode" style="' + fieldStyle + '">';
            ['LOCAL', 'REMOTE'].forEach(function (m) {
                h += '<option value="' + m + '"' + (config.dbMode === m ? ' selected' : '') + '>' + (m === 'LOCAL' ? '本地SQLite' : '远程数据库 (复用系统数据源)') + '</option>';
            });
            h += '</select>';

            // Remote DB config (hidden when LOCAL) - No longer needed if we use system data source!
            // BUT wait, does the backend support system data source? 
            // Let's modify the UI to not show the connection info if REMOTE is selected, but instead maybe a hint.
            // Wait, the backend DataLoadNodeHandler uses JdbcUtils.getConnection(...)
            // Let's hide the complex connection fields and just show a message or dropdown for data sources.
            // Actually, if we just want to hide them to make it simple:
            var showRemote = config.dbMode === 'REMOTE' ? 'block' : 'none';
            h += '<div id="cfg-dl-remote-section" style="display:' + showRemote + '; padding: 8px; background: #e6f7ff; border: 1px solid #91d5ff; border-radius: 4px; margin-bottom: 8px; font-size: 12px; color: #1890ff;">';
            h += '已选择远程数据库。系统将自动使用主配置 (application.yml) 中的默认数据源进行连接，无需额外配置。';
            h += '</div>';

            // SQL section
            h += '<label style="' + labelStyle + '">SQL语句</label>';
            h += '<textarea id="cfg-dl-sql" rows="4" style="' + fieldStyle + 'resize:vertical;font-family:monospace;font-size:12px;" placeholder="INSERT INTO table (col) VALUES (${var})">' + esc(config.sql || '') + '</textarea>';
            h += '<p style="font-size:11px;color:#888;margin-top:2px;">支持 ${变量名} 占位符, 支持INSERT/UPDATE/DELETE/SELECT</p>';

            // Output variable
            h += '<label style="' + labelStyle + '">输出变量名</label>';
            h += '<input id="cfg-dl-outputVar" type="text" value="' + esc(config.outputVariable || 'saveResult') + '" style="' + fieldStyle + '" />';

            return h;
        },

        // DEVICE_OPERATION
        buildDeviceOperationConfig(config) {
            var h = this.buildNameField(config);
            h += '<p style="color:#666;font-size:12px;margin-bottom:8px;">下发控制指令到指定设备。底层会自动根据设备的通讯协议(如 MQTT, TCP, HTTP 等)进行路由发送，无需关心底层细节。</p>';
            
            h += '<label style="' + labelStyle + '"><span style="color:red;margin-right:4px;">*</span>目标设备</label>';
            h += '<select id="cfg-opDeviceId" style="' + fieldStyle + '"><option value="">加载中...</option></select>';
            
            // Device Info Panel (Dynamically populated)
            h += '<div id="cfg-device-info-panel" style="display:none; margin-top:8px; padding:8px; background:#f5f5f5; border-radius:4px; font-size:12px; color:#555;">';
            h += '<div style="margin-bottom:4px;"><strong>协议类型：</strong><span id="cfg-dev-info-protocol">-</span></div>';
            h += '<div><strong>状态：</strong><span id="cfg-dev-info-status">-</span></div>';
            h += '</div>';

            h += '<label style="' + labelStyle + '"><span style="color:red;margin-right:4px;">*</span>操作类型</label>';
            h += '<select id="cfg-operationType" style="' + fieldStyle + '"><option value="">加载中...</option></select>';
            h += '<p id="cfg-op-desc" style="font-size:11px;color:#888;margin-top:4px;line-height:1.4;display:none;"></p>';
            
            var params = config.params || [];
            h += '<label style="' + labelStyle + '">指令参数设置</label>';
            h += '<p style="font-size:11px;color:#888;margin-top:0;margin-bottom:8px;line-height:1.4;">根据上方选择的【操作类型】，在此处配置需要下发给设备的具体参数键值对（例如控制空调时：键为 temperature，值为 26）。</p>';
            h += '<div id="cfg-op-params">';
            h += '<div style="display:flex;gap:4px;margin-bottom:4px;font-size:11px;color:#888;"><span style="flex:1;">参数名 (键)</span><span style="flex:1;">参数值 (支持${变量})</span><span style="width:50px;"></span></div>';
            params.forEach(function (p, idx) {
                h += '<div class="op-param-row" data-idx="' + idx + '" style="display:flex;gap:4px;margin-bottom:4px;">';
                h += '<input class="op-key" type="text" value="' + esc(p.key || '') + '" style="' + fieldStyle + 'flex:1;" placeholder="如: color" />';
                h += '<input class="op-val" type="text" value="' + esc(p.value || '') + '" style="' + fieldStyle + 'flex:1;" placeholder="如: red" />';
                h += '<button class="op-param-remove" data-idx="' + idx + '" style="' + smallBtn + 'background:#ff4d4f;color:#fff;width:50px;">X</button>';
                h += '</div>';
            });
            h += '</div>';
            h += '<button id="cfg-add-op-param" style="' + smallBtn + 'background:#1890ff;color:#fff;margin-top:4px;">+ 添加参数</button>';
            return h;
        },

        // TCP_LISTEN
        buildTcpListenConfig(config) {
            var h = this.buildNameField(config);
            h += '<label style="' + labelStyle + '">主机地址</label>';
            h += '<input id="cfg-tcp-host" type="text" value="' + esc(config.host || '') + '" style="' + fieldStyle + '" placeholder="192.168.0.1" />';
            h += '<label style="' + labelStyle + '">端口</label>';
            h += '<input id="cfg-tcp-port" type="number" value="' + (config.port || '') + '" style="' + fieldStyle + '" placeholder="8002" />';
            h += '<label style="' + labelStyle + '">超时 (ms)</label>';
            h += '<input id="cfg-tcp-timeout" type="number" value="' + (config.timeout || 5000) + '" style="' + fieldStyle + '" />';
            h += '<label style="' + labelStyle + '">读取模式</label>';
            h += '<select id="cfg-tcp-readMode" style="' + fieldStyle + '">';
            ['LINE', 'LENGTH', 'DELIMITER'].forEach(function (m) {
                h += '<option value="' + m + '"' + (config.readMode === m ? ' selected' : '') + '>' + m + '</option>';
            });
            h += '</select>';
            h += '<div id="cfg-tcp-length-row" style="display:' + (config.readMode === 'LENGTH' ? 'block' : 'none') + ';">';
            h += '<label style="' + labelStyle + '">读取字节数</label>';
            h += '<input id="cfg-tcp-readLength" type="number" value="' + (config.readLength || 1024) + '" style="' + fieldStyle + '" />';
            h += '</div>';
            h += '<div id="cfg-tcp-delim-row" style="display:' + (config.readMode === 'DELIMITER' ? 'block' : 'none') + ';">';
            h += '<label style="' + labelStyle + '">分隔符</label>';
            h += '<input id="cfg-tcp-delimiter" type="text" value="' + esc(config.delimiter || '\\n') + '" style="' + fieldStyle + '" />';
            h += '</div>';
            h += '<label style="' + labelStyle + '">输出变量名</label>';
            h += '<input id="cfg-tcp-outputVar" type="text" value="' + esc(config.outputVariable || 'tcpData') + '" style="' + fieldStyle + '" />';
            h += '<p style="font-size:11px;color:#888;margin-top:4px;">接收到的字符串将存入此变量，后续节点可用 ${tcpData} 引用</p>';
            return h;
        },

        // SQL_QUERY
        buildSqlQueryConfig(config) {
            var h = this.buildNameField(config);
            h += '<label style="' + labelStyle + '">数据库类型</label>';
            h += '<select id="cfg-sql-dbType" style="' + fieldStyle + '">';
            ['MYSQL', 'POSTGRESQL', 'SQLSERVER'].forEach(function (t) {
                h += '<option value="' + t + '"' + (config.dbType === t ? ' selected' : '') + '>' + t + '</option>';
            });
            h += '</select>';
            h += '<label style="' + labelStyle + '">主机地址</label>';
            h += '<input id="cfg-sql-dbHost" type="text" value="' + esc(config.dbHost || '') + '" style="' + fieldStyle + '" placeholder="192.168.0.2" />';
            h += '<label style="' + labelStyle + '">端口</label>';
            h += '<input id="cfg-sql-dbPort" type="number" value="' + (config.dbPort || '') + '" style="' + fieldStyle + '" placeholder="3306" />';
            h += '<label style="' + labelStyle + '">数据库名</label>';
            h += '<input id="cfg-sql-dbName" type="text" value="' + esc(config.dbName || '') + '" style="' + fieldStyle + '" />';
            h += '<label style="' + labelStyle + '">用户名</label>';
            h += '<input id="cfg-sql-username" type="text" value="' + esc(config.username || '') + '" style="' + fieldStyle + '" />';
            h += '<label style="' + labelStyle + '">密码</label>';
            h += '<input id="cfg-sql-password" type="password" value="' + esc(config.password || '') + '" style="' + fieldStyle + '" />';
            h += '<label style="' + labelStyle + '">SQL语句</label>';
            h += '<textarea id="cfg-sql-sql" rows="4" style="' + fieldStyle + 'resize:vertical;font-family:monospace;font-size:12px;" placeholder="SELECT * FROM table WHERE code = \'${tcpData}\'">' + esc(config.sql || '') + '</textarea>';
            h += '<p style="font-size:11px;color:#888;margin-top:2px;">支持 ${变量名} 引用上游变量</p>';
            h += '<label style="' + labelStyle + '">输出变量名</label>';
            h += '<input id="cfg-sql-outputVar" type="text" value="' + esc(config.outputVariable || 'sqlResult') + '" style="' + fieldStyle + '" />';
            return h;
        },

        // HTTP_REQUEST
        buildHttpRequestConfig(config) {
            var h = this.buildNameField(config);
            h += '<label style="' + labelStyle + '">请求方法</label>';
            h += '<select id="cfg-http-method" style="' + fieldStyle + '">';
            ['GET', 'POST', 'PUT', 'DELETE'].forEach(function (m) {
                h += '<option value="' + m + '"' + (config.method === m ? ' selected' : '') + '>' + m + '</option>';
            });
            h += '</select>';
            h += '<label style="' + labelStyle + '">URL</label>';
            h += '<input id="cfg-http-url" type="text" value="' + esc(config.url || '') + '" style="' + fieldStyle + '" placeholder="http://api.example.com/validate" />';
            h += '<p style="font-size:11px;color:#888;margin-top:2px;">支持 ${变量名}，如 http://host/api?code=${tcpData}</p>';
            
            // Hide Body and Content-Type for GET requests
            var isGet = config.method === 'GET' || !config.method; // Default is often considered GET or POST depending on context, let's say if GET it's hidden
            var showBody = isGet ? 'none' : 'block';
            
            h += '<div id="cfg-http-body-section" style="display:' + showBody + ';">';
            h += '<label style="' + labelStyle + '">Content-Type</label>';
            h += '<input id="cfg-http-contentType" type="text" value="' + esc(config.contentType || 'application/json') + '" style="' + fieldStyle + '" />';
            h += '<label style="' + labelStyle + '">请求体 (Body)</label>';
            h += '<textarea id="cfg-http-body" rows="4" style="' + fieldStyle + 'resize:vertical;font-family:monospace;font-size:12px;" placeholder=\'{"code":"${tcpData}"}\'>' + esc(config.body || '') + '</textarea>';
            h += '<p style="font-size:11px;color:#888;margin-top:2px;">支持 ${变量名} 引用</p>';
            h += '</div>';
            
            h += '<label style="' + labelStyle + '">超时 (ms)</label>';
            h += '<input id="cfg-http-timeout" type="number" value="' + (config.timeout || 10000) + '" style="' + fieldStyle + '" />';
            h += '<label style="' + labelStyle + '">输出变量名</label>';
            h += '<input id="cfg-http-outputVar" type="text" value="' + esc(config.outputVariable || 'httpResponse') + '" style="' + fieldStyle + '" />';
            h += '<p style="font-size:11px;color:#888;margin-top:2px;">响应JSON自动解析，可用 ${httpResponse.data1} 引用字段</p>';
            return h;
        },

        // PLC_WRITE
        buildPlcWriteConfig(config) {
            var h = this.buildNameField(config);
            h += '<p style="color:#666;font-size:12px;margin-bottom:8px;">专用于通过 Modbus TCP 协议直接向 PLC 或网关设备的寄存器写入数据。如果是其他协议设备，请使用「设备操作」节点。</p>';
            h += '<label style="' + labelStyle + '">PLC主机地址</label>';
            h += '<input id="cfg-plc-host" type="text" value="' + esc(config.host || '') + '" style="' + fieldStyle + '" placeholder="192.168.0.3" />';
            h += '<label style="' + labelStyle + '">端口 (Modbus TCP)</label>';
            h += '<input id="cfg-plc-port" type="number" value="' + (config.port || 502) + '" style="' + fieldStyle + '" />';
            
            h += '<label style="' + labelStyle + '">从站地址 (Unit ID)</label>';
            h += '<p style="font-size:11px;color:#888;margin-top:0;margin-bottom:4px;line-height:1.4;">即 Modbus 协议中的设备地址或站号(Slave ID)，通常用于区分挂在同一总线或网关下的不同 PLC 设备。默认为 1。</p>';
            h += '<input id="cfg-plc-unitId" type="number" value="' + (config.unitId || 1) + '" style="' + fieldStyle + '" />';
            
            h += '<label style="' + labelStyle + '">超时 (ms)</label>';
            h += '<input id="cfg-plc-timeout" type="number" value="' + (config.timeout || 5000) + '" style="' + fieldStyle + '" />';
            var registers = config.registers || [];
            h += '<label style="' + labelStyle + '">寄存器写入</label>';
            h += '<div id="cfg-plc-registers">';
            h += '<div style="display:flex;gap:4px;margin-bottom:4px;font-size:11px;color:#888;"><span style="flex:1;">寄存器地址</span><span style="flex:2;">值来源</span><span style="width:50px;"></span></div>';
            registers.forEach(function (r, idx) {
                h += '<div class="plc-reg-row" data-idx="' + idx + '" style="display:flex;gap:4px;margin-bottom:4px;">';
                h += '<input class="pr-addr" type="number" value="' + (r.address || 0) + '" style="' + fieldStyle + 'flex:1;" placeholder="0" />';
                h += '<input class="pr-val" type="text" value="' + esc(r.valueSource || '') + '" style="' + fieldStyle + 'flex:2;" placeholder="${httpResponse.data1}" />';
                h += '<button class="pr-remove" data-idx="' + idx + '" style="' + smallBtn + 'background:#ff4d4f;color:#fff;width:50px;">X</button>';
                h += '</div>';
            });
            h += '</div>';
            h += '<button id="cfg-add-plc-reg" style="' + smallBtn + 'background:#1890ff;color:#fff;margin-top:4px;">+ 添加寄存器</button>';
            h += '<p style="font-size:11px;color:#888;margin-top:4px;">值来源支持 ${变量名} 引用或直接填写数字</p>';
            return h;
        },

        // TCP_CLIENT
        buildTcpClientConfig(config) {
            var h = this.buildNameField(config);
            h += '<label style="' + labelStyle + '">主机地址</label>';
            h += '<input id="cfg-tcpc-host" type="text" value="' + esc(config.host || '') + '" style="' + fieldStyle + '" placeholder="192.168.0.1" />';
            h += '<label style="' + labelStyle + '">端口</label>';
            h += '<input id="cfg-tcpc-port" type="number" value="' + (config.port || '') + '" style="' + fieldStyle + '" placeholder="8002" />';
            h += '<label style="' + labelStyle + '">发送数据</label>';
            h += '<textarea id="cfg-tcpc-sendData" rows="3" style="' + fieldStyle + 'resize:vertical;font-family:monospace;font-size:12px;">' + esc(config.sendData || '') + '</textarea>';
            h += '<p style="font-size:11px;color:#888;margin-top:2px;">支持 ${变量名} 引用，如 ${hexCommand}</p>';
            h += '<label style="' + labelStyle + '"><input id="cfg-tcpc-sendHex" type="checkbox"' + (config.sendHex ? ' checked' : '') + ' /> 发送数据为16进制</label>';
            h += '<label style="' + labelStyle + '"><input id="cfg-tcpc-waitResponse" type="checkbox"' + (config.waitResponse !== false ? ' checked' : '') + ' /> 等待返回数据</label>';
            h += '<label style="' + labelStyle + '">超时 (ms)</label>';
            h += '<input id="cfg-tcpc-timeout" type="number" value="' + (config.timeout || 5000) + '" style="' + fieldStyle + '" />';
            h += '<label style="' + labelStyle + '">读取模式</label>';
            h += '<select id="cfg-tcpc-readMode" style="' + fieldStyle + '">';
            ['LINE', 'LENGTH', 'DELIMITER', 'RAW'].forEach(function (m) {
                h += '<option value="' + m + '"' + (config.readMode === m ? ' selected' : '') + '>' + m + '</option>';
            });
            h += '</select>';
            h += '<label style="' + labelStyle + '">输出变量名</label>';
            h += '<input id="cfg-tcpc-outputVar" type="text" value="' + esc(config.outputVariable || 'tcpClientData') + '" style="' + fieldStyle + '" />';
            return h;
        },

        // TCP_SERVER
        buildTcpServerConfig(config) {
            var h = this.buildNameField(config);
            h += '<label style="' + labelStyle + '">服务端口</label>';
            h += '<input id="cfg-tcps-port" type="number" value="' + (config.port || '') + '" style="' + fieldStyle + '" placeholder="9000" />';
            h += '<label style="' + labelStyle + '">操作类型</label>';
            h += '<select id="cfg-tcps-operation" style="' + fieldStyle + '">';
            ['START', 'BROADCAST', 'RECEIVE', 'STOP'].forEach(function (op) {
                var labels = { START: '启动服务器', BROADCAST: '广播数据', RECEIVE: '接收数据', STOP: '停止服务器' };
                h += '<option value="' + op + '"' + (config.operation === op ? ' selected' : '') + '>' + labels[op] + ' (' + op + ')</option>';
            });
            h += '</select>';
            h += '<div id="cfg-tcps-send-row" style="display:' + (config.operation === 'BROADCAST' ? 'block' : 'none') + ';">';
            h += '<label style="' + labelStyle + '">广播数据</label>';
            h += '<textarea id="cfg-tcps-sendData" rows="3" style="' + fieldStyle + 'resize:vertical;font-family:monospace;font-size:12px;">' + esc(config.sendData || '') + '</textarea>';
            h += '<p style="font-size:11px;color:#888;margin-top:2px;">支持 ${变量名} 引用</p>';
            h += '<label style="' + labelStyle + '"><input id="cfg-tcps-sendHex" type="checkbox"' + (config.sendHex ? ' checked' : '') + ' /> 发送数据为16进制</label>';
            h += '</div>';
            h += '<div id="cfg-tcps-recv-row" style="display:' + (config.operation === 'RECEIVE' ? 'block' : 'none') + ';">';
            h += '<label style="' + labelStyle + '">接收超时 (ms)</label>';
            h += '<input id="cfg-tcps-timeout" type="number" value="' + (config.timeout || 10000) + '" style="' + fieldStyle + '" />';
            h += '</div>';
            h += '<label style="' + labelStyle + '">输出变量名</label>';
            h += '<input id="cfg-tcps-outputVar" type="text" value="' + esc(config.outputVariable || 'tcpServerData') + '" style="' + fieldStyle + '" />';
            return h;
        },

        // SCRIPT
        buildScriptConfig(config) {
            var h = this.buildNameField(config);
            var ops = config.operations || [];
            h += '<label style="' + labelStyle + '">脚本操作列表</label>';
            h += '<div id="cfg-script-ops">';
            ops.forEach(function (op, idx) {
                h += '<div class="script-op-row" data-idx="' + idx + '" style="border:1px solid #e8e8e8;border-radius:4px;padding:8px;margin-bottom:6px;background:#fafafa;">';
                h += '<select class="so-op" style="' + fieldStyle + 'margin-bottom:4px;">';
                ['SPLIT', 'JOIN', 'HEX_ARRAY_TO_DEC', 'DEC_ARRAY_TO_HEX', 'ARRAY_LENGTH', 'ARRAY_SLICE',
                 'JSON_BUILD', 'JSON_PARSE', 'FORMAT_VALUES', 'PARSE_CSV_VALUES', 'STRING_TO_HEX',
                 'HEX_TO_STRING', 'STRIP_PREFIX', 'CONCAT', 'TEMPLATE',
                 'HEX_TO_DEC', 'DEC_TO_HEX', 'ROUND', 'TO_NUMBER', 'SUBSTRING', 'REPLACE', 'TO_STRING', 'JSON_STRINGIFY'].forEach(function (t) {
                    h += '<option value="' + t + '"' + ((op.op || op.type) === t ? ' selected' : '') + '>' + t + '</option>';
                });
                h += '</select>';
                h += '<input class="so-source" type="text" value="' + esc(op.source || '') + '" placeholder="来源变量路径" style="' + fieldStyle + 'margin-bottom:4px;" />';
                h += '<input class="so-target" type="text" value="' + esc(op.target || '') + '" placeholder="目标变量路径" style="' + fieldStyle + 'margin-bottom:4px;" />';
                h += '<input class="so-params" type="text" value="' + esc(typeof op.params === 'object' ? JSON.stringify(op.params) : (op.params || '')) + '" placeholder="参数(JSON) 如 {&quot;delimiter&quot;:&quot;,&quot;}" style="' + fieldStyle + 'margin-bottom:4px;" />';
                h += '<button class="so-remove" data-idx="' + idx + '" style="' + smallBtn + 'background:#ff4d4f;color:#fff;">移除</button>';
                h += '</div>';
            });
            h += '</div>';
            h += '<button id="cfg-add-script-op" style="' + smallBtn + 'background:#1890ff;color:#fff;margin-top:4px;">+ 添加操作</button>';
            h += '<p style="font-size:11px;color:#888;margin-top:8px;">常用操作: SPLIT(拆分字符串), JOIN(合并数组), HEX_ARRAY_TO_DEC(16进制数组转10进制), JSON_BUILD(构建JSON), FORMAT_VALUES(格式化为v1=x,v2=y), STRING_TO_HEX(字符串转16进制)</p>';
            return h;
        },

        // LOG
        buildLogConfig(config) {
            var h = this.buildNameField(config);
            h += '<label style="' + labelStyle + '">日志消息</label>';
            h += '<textarea id="cfg-log-message" rows="2" style="' + fieldStyle + 'resize:vertical;">' + esc(config.message || '') + '</textarea>';
            h += '<p style="font-size:11px;color:#888;margin-top:2px;">支持 ${变量名} 引用</p>';
            h += '<label style="' + labelStyle + '">数据路径</label>';
            h += '<input id="cfg-log-dataPath" type="text" value="' + esc(config.dataPath || '') + '" style="' + fieldStyle + '" placeholder="变量路径，如 rs" />';
            h += '<label style="' + labelStyle + '">日志级别</label>';
            h += '<select id="cfg-log-level" style="' + fieldStyle + '">';
            ['INFO', 'WARN', 'ERROR'].forEach(function (l) {
                h += '<option value="' + l + '"' + (config.logLevel === l ? ' selected' : '') + '>' + l + '</option>';
            });
            h += '</select>';
            h += '<label style="' + labelStyle + '"><input id="cfg-log-saveToDb" type="checkbox"' + (config.saveToDb !== false ? ' checked' : '') + ' /> 保存到数据库</label>';
            h += '<label style="' + labelStyle + '">输出变量名</label>';
            h += '<input id="cfg-log-outputVar" type="text" value="' + esc(config.outputVariable || '') + '" style="' + fieldStyle + '" placeholder="logEntry" />';
            return h;
        },

        // DEDUP_FILTER
        buildDedupFilterConfig(config) {
            var h = this.buildNameField(config);
            h += '<label style="' + labelStyle + '">检测变量名</label>';
            h += '<input id="cfg-dedup-inputVar" type="text" value="' + esc(config.inputVariable || 'tcpData') + '" style="' + fieldStyle + '" />';
            h += '<p style="font-size:11px;color:#888;margin-top:2px;">要检测重复的变量，如 tcpData</p>';
            h += '<label style="' + labelStyle + '">去重窗口 (秒)</label>';
            h += '<input id="cfg-dedup-ttl" type="number" value="' + (config.ttlSeconds || 60) + '" style="' + fieldStyle + '" min="1" />';
            h += '<p style="font-size:11px;color:#888;margin-top:2px;">相同数据在此时间窗口内只处理一次</p>';
            h += '<label style="' + labelStyle + '">缓存命名空间</label>';
            h += '<input id="cfg-dedup-cacheKey" type="text" value="' + esc(config.cacheKey || 'default') + '" style="' + fieldStyle + '" />';
            h += '<p style="font-size:11px;color:#888;margin-top:2px;">不同流程可用不同命名空间隔离去重缓存</p>';
            return h;
        },

        // =============================================================
        //  Bind config panel events (after innerHTML is set)
        // =============================================================
        bindConfigEvents(node, type) {
            var self = this;

            // Helper: update node data and label
            function updateConfig(patch) {
                var data = node.getData() || {};
                var cfg = Object.assign({}, data.config || {}, patch);
                node.setData({ config: cfg }, { overwrite: false });
                // Reflect on assignment: update data reference
                node.setData({ type: data.type, config: cfg }, { overwrite: true });
                // Update label
                var typeDef = NODE_TYPES[data.type];
                if (typeDef) {
                    node.attr('label/text', typeDef.icon + ' ' + (cfg.name || typeDef.label));
                }
                self.dirty = true;
            }

            function getConfig() {
                var d = node.getData() || {};
                return Object.assign({}, d.config || {});
            }

            // Name (common to all)
            var nameEl = document.getElementById('cfg-name');
            if (nameEl) {
                nameEl.addEventListener('input', function () {
                    updateConfig({ name: this.value });
                });
            }

            // Delete node button
            var delBtn = document.getElementById('cfg-delete-node');
            if (delBtn) {
                delBtn.addEventListener('click', function () {
                    self.graph.removeNode(node);
                    self.selectedNode = null;
                    self.renderConfigHint();
                });
            }

            // Type-specific bindings
            switch (type) {
                case 'START':
                    this._bindStartEvents(node, updateConfig, getConfig);
                    break;
                case 'END':
                    this._bindEndEvents(node, updateConfig);
                    break;
                case 'DELAY':
                    this._bindDelayEvents(node, updateConfig);
                    break;
                case 'CONDITION':
                    this._bindConditionEvents(node, updateConfig, getConfig);
                    break;
                case 'VARIABLE':
                    this._bindVariableEvents(node, updateConfig, getConfig);
                    break;
                case 'DATA_EXTRACT':
                    this._bindDataExtractEvents(node, updateConfig);
                    break;
                case 'DATA_FILTER':
                    this._bindDataFilterEvents(node, updateConfig, getConfig);
                    break;
                case 'DATA_TRANSFORM':
                    this._bindDataTransformEvents(node, updateConfig, getConfig);
                    break;
                case 'DATA_LOAD':
                    this._bindDataLoadEvents(node, updateConfig, getConfig);
                    break;
                case 'DEVICE_OPERATION':
                    this._bindDeviceOperationEvents(node, updateConfig, getConfig);
                    break;
                case 'TCP_LISTEN':
                    this._bindTcpListenEvents(node, updateConfig);
                    break;
                case 'TCP_CLIENT':
                    this._bindTcpClientEvents(node, updateConfig);
                    break;
                case 'TCP_SERVER':
                    this._bindTcpServerEvents(node, updateConfig, getConfig);
                    break;
                case 'SQL_QUERY':
                    this._bindSqlQueryEvents(node, updateConfig);
                    break;
                case 'HTTP_REQUEST':
                    this._bindHttpRequestEvents(node, updateConfig);
                    break;
                case 'PLC_WRITE':
                    this._bindPlcWriteEvents(node, updateConfig, getConfig);
                    break;
                case 'SCRIPT':
                    this._bindScriptEvents(node, updateConfig, getConfig);
                    break;
                case 'LOG':
                    this._bindLogEvents(node, updateConfig);
                    break;
                case 'DEDUP_FILTER':
                    this._bindDedupFilterEvents(node, updateConfig);
                    break;
            }
        },

        // -- START events
        _bindStartEvents(node, updateConfig, getConfig) {
            var self = this;

            var descEl = document.getElementById('cfg-description');
            if (descEl) descEl.addEventListener('input', function () { updateConfig({ description: this.value }); });

            var protoEl = document.getElementById('cfg-protocolType');
            if (protoEl) protoEl.addEventListener('change', function () { updateConfig({ protocolType: this.value }); });

            // Trigger type radios
            var triggerRadios = document.querySelectorAll('input[name="cfg-triggerType"]');
            triggerRadios.forEach(function (r) {
                r.addEventListener('change', function () {
                    updateConfig({ triggerType: this.value });
                    var cronRow  = document.getElementById('cfg-cron-row');
                    var topicRow = document.getElementById('cfg-topic-row');
                    if (cronRow)  cronRow.style.display  = this.value === 'SCHEDULED' ? 'block' : 'none';
                    if (topicRow) topicRow.style.display  = this.value === 'EVENT'     ? 'block' : 'none';
                });
            });

            var cronEl = document.getElementById('cfg-cronExpression');
            if (cronEl) cronEl.addEventListener('input', function () { updateConfig({ cronExpression: this.value }); });

            var topicEl = document.getElementById('cfg-listenTopic');
            if (topicEl) topicEl.addEventListener('input', function () { updateConfig({ listenTopic: this.value }); });

            // Async: load devices
            fetchDevices().then(function (devices) {
                var sel = document.getElementById('cfg-deviceId');
                if (!sel) return;
                var cfg = getConfig();
                var html = '<option value="">-- 全局流程 / 不绑定具体设备 --</option>';
                (devices || []).forEach(function (d) {
                    html += '<option value="' + d.id + '"' + (String(cfg.deviceId) === String(d.id) ? ' selected' : '') + '>' + esc(d.name || d.id) + '</option>';
                });
                sel.innerHTML = html;
                sel.addEventListener('change', function () { updateConfig({ deviceId: this.value }); });
            });
        },

        // -- END events
        _bindEndEvents(node, updateConfig) {
            var descEl = document.getElementById('cfg-description');
            if (descEl) descEl.addEventListener('input', function () { updateConfig({ description: this.value }); });
        },

        // -- DELAY events
        _bindDelayEvents(node, updateConfig) {
            var el = document.getElementById('cfg-delayMs');
            if (el) el.addEventListener('input', function () { updateConfig({ delayMs: parseInt(this.value, 10) || 0 }); });
        },

        // -- CONDITION events
        _bindConditionEvents(node, updateConfig, getConfig) {
            var self = this;

            var logicEl = document.getElementById('cfg-cond-logic');
            if (logicEl) logicEl.addEventListener('change', function () { updateConfig({ logic: this.value }); });

            var defaultEl = document.getElementById('cfg-defaultBranch');
            if (defaultEl) defaultEl.addEventListener('input', function () { updateConfig({ defaultBranch: this.value }); });

            // Branch change events via delegation
            var container = document.getElementById('cfg-branches');
            if (container) {
                container.addEventListener('input', function (e) {
                    var row = e.target.closest('.branch-row');
                    if (!row) return;
                    var cfg = getConfig();
                    var branches = cfg.branches || [];
                    var idx = parseInt(row.dataset.idx, 10);
                    if (!branches[idx]) return;
                    
                    if (!branches[idx].condition) branches[idx].condition = {};
                    
                    if (e.target.classList.contains('br-name'))     branches[idx].name     = e.target.value;
                    if (e.target.classList.contains('br-variable')) branches[idx].condition.left = e.target.value;
                    if (e.target.classList.contains('br-value'))    branches[idx].condition.right = e.target.value;
                    updateConfig({ branches: branches });
                });
                container.addEventListener('change', function (e) {
                    if (!e.target.classList.contains('br-operator')) return;
                    var row = e.target.closest('.branch-row');
                    if (!row) return;
                    var cfg = getConfig();
                    var branches = cfg.branches || [];
                    var idx = parseInt(row.dataset.idx, 10);
                    if (branches[idx]) {
                        if (!branches[idx].condition) branches[idx].condition = {};
                        branches[idx].condition.operator = e.target.value;
                        updateConfig({ branches: branches });
                        self.renderNodeConfig(node); // Re-render to show/hide value input
                    }
                });
                container.addEventListener('click', function (e) {
                    if (!e.target.classList.contains('br-remove')) return;
                    var cfg = getConfig();
                    var branches = cfg.branches || [];
                    var idx = parseInt(e.target.dataset.idx, 10);
                    branches.splice(idx, 1);
                    updateConfig({ branches: branches });
                    self.renderNodeConfig(node);
                });
            }

            var addBtn = document.getElementById('cfg-add-branch');
            if (addBtn) {
                addBtn.addEventListener('click', function () {
                    var cfg = getConfig();
                    var branches = cfg.branches || [];
                    branches.push({ name: '', condition: { left: '', operator: '==', right: '' } });
                    updateConfig({ branches: branches });
                    self.renderNodeConfig(node);
                });
            }
        },

        // -- VARIABLE events
        _bindVariableEvents(node, updateConfig, getConfig) {
            var self = this;
            var container = document.getElementById('cfg-var-ops');
            if (container) {
                container.addEventListener('input', function (e) {
                    var row = e.target.closest('.var-op-row');
                    if (!row) return;
                    var cfg = getConfig();
                    var ops = cfg.operations || [];
                    var idx = parseInt(row.dataset.idx, 10);
                    if (!ops[idx]) return;
                    if (e.target.classList.contains('vo-path'))  ops[idx].path  = e.target.value;
                    if (e.target.classList.contains('vo-value')) {
                        if (ops[idx].action === 'copy') ops[idx].source = e.target.value;
                        else ops[idx].value = e.target.value;
                    }
                    updateConfig({ operations: ops });
                });
                container.addEventListener('change', function (e) {
                    if (!e.target.classList.contains('vo-action')) return;
                    var row = e.target.closest('.var-op-row');
                    if (!row) return;
                    var cfg = getConfig();
                    var ops = cfg.operations || [];
                    var idx = parseInt(row.dataset.idx, 10);
                    if (ops[idx]) {
                        ops[idx].action = e.target.value;
                        updateConfig({ operations: ops });
                        self.renderNodeConfig(node);
                    }
                });
                container.addEventListener('click', function (e) {
                    if (!e.target.classList.contains('vo-remove')) return;
                    var cfg = getConfig();
                    var ops = cfg.operations || [];
                    ops.splice(parseInt(e.target.dataset.idx, 10), 1);
                    updateConfig({ operations: ops });
                    self.renderNodeConfig(node);
                });
            }
            var addBtn = document.getElementById('cfg-add-var-op');
            if (addBtn) {
                addBtn.addEventListener('click', function () {
                    var cfg = getConfig();
                    var ops = cfg.operations || [];
                    ops.push({ action: 'set', path: '', value: '' });
                    updateConfig({ operations: ops });
                    self.renderNodeConfig(node);
                });
            }
        },

        // -- DATA_EXTRACT events
        _bindDataExtractEvents(node, updateConfig) {
            var src = document.getElementById('cfg-sourcePath');
            var tgt = document.getElementById('cfg-targetPath');
            if (src) src.addEventListener('input', function () { updateConfig({ sourcePath: this.value }); });
            if (tgt) tgt.addEventListener('input', function () { updateConfig({ targetPath: this.value }); });
        },

        // -- DATA_FILTER events
        _bindDataFilterEvents(node, updateConfig, getConfig) {
            var self = this;
            var container = document.getElementById('cfg-filter-conds');
            if (container) {
                container.addEventListener('input', function (e) {
                    var row = e.target.closest('.filter-row');
                    if (!row) return;
                    var cfg = getConfig();
                    var conds = cfg.conditions || [];
                    var idx = parseInt(row.dataset.idx, 10);
                    if (!conds[idx]) return;
                    if (e.target.classList.contains('fc-field')) conds[idx].field = e.target.value;
                    if (e.target.classList.contains('fc-value')) conds[idx].value = e.target.value;
                    updateConfig({ conditions: conds });
                });
                container.addEventListener('change', function (e) {
                    if (!e.target.classList.contains('fc-operator')) return;
                    var row = e.target.closest('.filter-row');
                    if (!row) return;
                    var cfg = getConfig();
                    var conds = cfg.conditions || [];
                    var idx = parseInt(row.dataset.idx, 10);
                    if (conds[idx]) {
                        conds[idx].operator = e.target.value;
                        updateConfig({ conditions: conds });
                    }
                });
                container.addEventListener('click', function (e) {
                    if (!e.target.classList.contains('fc-remove')) return;
                    var cfg = getConfig();
                    var conds = cfg.conditions || [];
                    conds.splice(parseInt(e.target.dataset.idx, 10), 1);
                    updateConfig({ conditions: conds });
                    self.renderNodeConfig(node);
                });
            }
            var addBtn = document.getElementById('cfg-add-filter');
            if (addBtn) {
                addBtn.addEventListener('click', function () {
                    var cfg = getConfig();
                    var conds = cfg.conditions || [];
                    conds.push({ field: '', operator: '==', value: '' });
                    updateConfig({ conditions: conds });
                    self.renderNodeConfig(node);
                });
            }
        },

        // -- DATA_TRANSFORM events
        _bindDataTransformEvents(node, updateConfig, getConfig) {
            var self = this;
            var inputEl  = document.getElementById('cfg-inputSource');
            var outputEl = document.getElementById('cfg-outputPath');
            if (inputEl)  inputEl.addEventListener('input', function () { updateConfig({ inputSource: this.value }); });
            if (outputEl) outputEl.addEventListener('input', function () { updateConfig({ outputPath: this.value }); });

            var container = document.getElementById('cfg-transform-steps');
            if (container) {
                container.addEventListener('input', function (e) {
                    var row = e.target.closest('.step-row');
                    if (!row) return;
                    var cfg = getConfig();
                    var steps = cfg.steps || [];
                    var idx = parseInt(row.dataset.idx, 10);
                    if (!steps[idx]) return;
                    if (e.target.classList.contains('ts-params')) {
                        try { steps[idx].params = JSON.parse(e.target.value); }
                        catch (_) { steps[idx].params = e.target.value; }
                    }
                    updateConfig({ steps: steps });
                });
                container.addEventListener('change', function (e) {
                    if (!e.target.classList.contains('ts-type')) return;
                    var row = e.target.closest('.step-row');
                    if (!row) return;
                    var cfg = getConfig();
                    var steps = cfg.steps || [];
                    var idx = parseInt(row.dataset.idx, 10);
                    if (steps[idx]) {
                        steps[idx].type = e.target.value;
                        updateConfig({ steps: steps });
                    }
                });
                container.addEventListener('click', function (e) {
                    if (!e.target.classList.contains('ts-remove')) return;
                    var cfg = getConfig();
                    var steps = cfg.steps || [];
                    steps.splice(parseInt(e.target.dataset.idx, 10), 1);
                    updateConfig({ steps: steps });
                    self.renderNodeConfig(node);
                });
            }
            var addBtn = document.getElementById('cfg-add-step');
            if (addBtn) {
                addBtn.addEventListener('click', function () {
                    var cfg = getConfig();
                    var steps = cfg.steps || [];
                    steps.push({ type: 'HEX_TO_DEC', params: '' });
                    updateConfig({ steps: steps });
                    self.renderNodeConfig(node);
                });
            }
        },

        // -- DATA_LOAD events
        _bindDataLoadEvents(node, updateConfig, getConfig) {
            var self = this;

            // Simple text/select fields
            var simpleIds = {
                'cfg-dl-outputVar': 'outputVariable',
                'cfg-dl-dbHost': 'dbHost',
                'cfg-dl-dbName': 'dbName',
                'cfg-dl-username': 'username',
                'cfg-dl-password': 'password'
            };
            Object.keys(simpleIds).forEach(function (elId) {
                var el = document.getElementById(elId);
                if (el) el.addEventListener('input', function () {
                    var p = {}; p[simpleIds[elId]] = this.value; updateConfig(p);
                });
            });

            var portEl = document.getElementById('cfg-dl-dbPort');
            if (portEl) portEl.addEventListener('input', function () { updateConfig({ dbPort: parseInt(this.value, 10) || 0 }); });

            // SQL textarea
            var sqlEl = document.getElementById('cfg-dl-sql');
            if (sqlEl) sqlEl.addEventListener('input', function () { updateConfig({ sql: this.value }); });

            // Select fields
            var dbModeEl = document.getElementById('cfg-dl-dbMode');
            if (dbModeEl) dbModeEl.addEventListener('change', function () {
                updateConfig({ dbMode: this.value });
                var sec = document.getElementById('cfg-dl-remote-section');
                if (sec) sec.style.display = this.value === 'REMOTE' ? 'block' : 'none';
            });

            var dbTypeEl = document.getElementById('cfg-dl-dbType');
            if (dbTypeEl) dbTypeEl.addEventListener('change', function () { updateConfig({ dbType: this.value }); });
        },

        // -- DEVICE_OPERATION events
        _bindDeviceOperationEvents(node, updateConfig, getConfig) {
            var self = this;

            // Async: load devices for override select
            fetchDevices().then(function (devices) {
                var sel = document.getElementById('cfg-opDeviceId');
                if (!sel) return;
                var cfg = getConfig();
                var html = '<option value="">-- 请选择设备 --</option>';
                (devices || []).forEach(function (d) {
                    html += '<option value="' + d.id + '"' + (String(cfg.opDeviceId) === String(d.id) ? ' selected' : '') + '>' + esc(d.name || d.id) + '</option>';
                });
                sel.innerHTML = html;
                
                // Show device info on load if selected
                var updateDevInfo = function(devId) {
                    var panel = document.getElementById('cfg-device-info-panel');
                    var protoSpan = document.getElementById('cfg-dev-info-protocol');
                    var statusSpan = document.getElementById('cfg-dev-info-status');
                    if (!panel || !devId) {
                        if (panel) panel.style.display = 'none';
                        return;
                    }
                    var dev = devices.find(d => String(d.id) === String(devId));
                    if (dev) {
                        protoSpan.textContent = dev.protocolType || '未知';
                        statusSpan.textContent = dev.status === 'ONLINE' ? '在线 🟢' : '离线 🔴';
                        panel.style.display = 'block';
                    } else {
                        panel.style.display = 'none';
                    }
                };
                updateDevInfo(cfg.opDeviceId);
                
                sel.addEventListener('change', function () { 
                    updateConfig({ opDeviceId: this.value }); 
                    updateDevInfo(this.value);
                });
            });

            // Async: load operation types
            fetchOperationTypes().then(function (types) {
                var sel = document.getElementById('cfg-operationType');
                if (!sel) return;
                var cfg = getConfig();
                var html = '<option value="">-- 请选择操作类型 --</option>';
                (types || []).forEach(function (t) {
                    var label = t.name ? (t.name + ' (' + t.code + ')') : (t.code || t.id);
                    html += '<option value="' + (t.code || t.id) + '"' + (String(cfg.operationType) === String(t.code || t.id) ? ' selected' : '') + '>' + esc(label) + '</option>';
                });
                sel.innerHTML = html;
                
                var updateOpDesc = function(opCode) {
                    var descEl = document.getElementById('cfg-op-desc');
                    if (!descEl) return;
                    var op = types.find(t => String(t.code || t.id) === String(opCode));
                    if (op && op.description) {
                        descEl.textContent = op.description;
                        descEl.style.display = 'block';
                    } else {
                        descEl.style.display = 'none';
                    }
                };
                updateOpDesc(cfg.operationType);
                
                sel.addEventListener('change', function () { 
                    updateConfig({ operationType: this.value }); 
                    updateOpDesc(this.value);
                });
            });

            // Params key-value
            var container = document.getElementById('cfg-op-params');
            if (container) {
                container.addEventListener('input', function (e) {
                    var row = e.target.closest('.op-param-row');
                    if (!row) return;
                    var cfg = getConfig();
                    var params = cfg.params || [];
                    var idx = parseInt(row.dataset.idx, 10);
                    if (!params[idx]) return;
                    if (e.target.classList.contains('op-key')) params[idx].key   = e.target.value;
                    if (e.target.classList.contains('op-val')) params[idx].value = e.target.value;
                    updateConfig({ params: params });
                });
                container.addEventListener('click', function (e) {
                    if (!e.target.classList.contains('op-param-remove')) return;
                    var cfg = getConfig();
                    var params = cfg.params || [];
                    params.splice(parseInt(e.target.dataset.idx, 10), 1);
                    updateConfig({ params: params });
                    self.renderNodeConfig(node);
                });
            }
            var addBtn = document.getElementById('cfg-add-op-param');
            if (addBtn) {
                addBtn.addEventListener('click', function () {
                    var cfg = getConfig();
                    var params = cfg.params || [];
                    params.push({ key: '', value: '' });
                    updateConfig({ params: params });
                    self.renderNodeConfig(node);
                });
            }
        },

        // -- TCP_LISTEN events
        _bindTcpListenEvents(node, updateConfig) {
            var self = this;
            var hostEl = document.getElementById('cfg-tcp-host');
            if (hostEl) hostEl.addEventListener('input', function () { updateConfig({ host: this.value }); });
            var portEl = document.getElementById('cfg-tcp-port');
            if (portEl) portEl.addEventListener('input', function () { updateConfig({ port: parseInt(this.value, 10) || 0 }); });
            var timeoutEl = document.getElementById('cfg-tcp-timeout');
            if (timeoutEl) timeoutEl.addEventListener('input', function () { updateConfig({ timeout: parseInt(this.value, 10) || 5000 }); });
            var readModeEl = document.getElementById('cfg-tcp-readMode');
            if (readModeEl) {
                readModeEl.addEventListener('change', function () {
                    updateConfig({ readMode: this.value });
                    var lenRow = document.getElementById('cfg-tcp-length-row');
                    var delimRow = document.getElementById('cfg-tcp-delim-row');
                    if (lenRow) lenRow.style.display = this.value === 'LENGTH' ? 'block' : 'none';
                    if (delimRow) delimRow.style.display = this.value === 'DELIMITER' ? 'block' : 'none';
                });
            }
            var readLenEl = document.getElementById('cfg-tcp-readLength');
            if (readLenEl) readLenEl.addEventListener('input', function () { updateConfig({ readLength: parseInt(this.value, 10) || 1024 }); });
            var delimEl = document.getElementById('cfg-tcp-delimiter');
            if (delimEl) delimEl.addEventListener('input', function () { updateConfig({ delimiter: this.value }); });
            var outputVarEl = document.getElementById('cfg-tcp-outputVar');
            if (outputVarEl) outputVarEl.addEventListener('input', function () { updateConfig({ outputVariable: this.value }); });
        },

        // -- SQL_QUERY events
        _bindSqlQueryEvents(node, updateConfig) {
            var ids = {
                'cfg-sql-dbType': 'dbType',
                'cfg-sql-dbHost': 'dbHost',
                'cfg-sql-dbName': 'dbName',
                'cfg-sql-username': 'username',
                'cfg-sql-password': 'password',
                'cfg-sql-sql': 'sql',
                'cfg-sql-outputVar': 'outputVariable'
            };
            Object.keys(ids).forEach(function (elId) {
                var el = document.getElementById(elId);
                if (el) {
                    var evtType = el.tagName === 'SELECT' ? 'change' : 'input';
                    el.addEventListener(evtType, function () {
                        var patch = {};
                        patch[ids[elId]] = this.value;
                        updateConfig(patch);
                    });
                }
            });
            var portEl = document.getElementById('cfg-sql-dbPort');
            if (portEl) portEl.addEventListener('input', function () { updateConfig({ dbPort: parseInt(this.value, 10) || 3306 }); });
        },

        // -- HTTP_REQUEST events
        _bindHttpRequestEvents(node, updateConfig) {
            var ids = {
                'cfg-http-method': 'method',
                'cfg-http-url': 'url',
                'cfg-http-contentType': 'contentType',
                'cfg-http-body': 'body',
                'cfg-http-outputVar': 'outputVariable'
            };
            Object.keys(ids).forEach(function (elId) {
                var el = document.getElementById(elId);
                if (el) {
                    var evtType = el.tagName === 'SELECT' ? 'change' : 'input';
                    el.addEventListener(evtType, function () {
                        var patch = {};
                        patch[ids[elId]] = this.value;
                        updateConfig(patch);
                        
                        // Dynamically hide/show body section when method changes
                        if (elId === 'cfg-http-method') {
                            var bodySec = document.getElementById('cfg-http-body-section');
                            if (bodySec) {
                                bodySec.style.display = (this.value === 'GET') ? 'none' : 'block';
                            }
                        }
                    });
                }
            });
            var timeoutEl = document.getElementById('cfg-http-timeout');
            if (timeoutEl) timeoutEl.addEventListener('input', function () { updateConfig({ timeout: parseInt(this.value, 10) || 10000 }); });
        },

        // -- PLC_WRITE events
        _bindPlcWriteEvents(node, updateConfig, getConfig) {
            var self = this;
            var hostEl = document.getElementById('cfg-plc-host');
            if (hostEl) hostEl.addEventListener('input', function () { updateConfig({ host: this.value }); });
            var portEl = document.getElementById('cfg-plc-port');
            if (portEl) portEl.addEventListener('input', function () { updateConfig({ port: parseInt(this.value, 10) || 502 }); });
            var unitEl = document.getElementById('cfg-plc-unitId');
            if (unitEl) unitEl.addEventListener('input', function () { updateConfig({ unitId: parseInt(this.value, 10) || 1 }); });
            var timeoutEl = document.getElementById('cfg-plc-timeout');
            if (timeoutEl) timeoutEl.addEventListener('input', function () { updateConfig({ timeout: parseInt(this.value, 10) || 5000 }); });

            // Register rows (address + valueSource)
            var container = document.getElementById('cfg-plc-registers');
            if (container) {
                container.addEventListener('input', function (e) {
                    var row = e.target.closest('.plc-reg-row');
                    if (!row) return;
                    var cfg = getConfig();
                    var registers = cfg.registers || [];
                    var idx = parseInt(row.dataset.idx, 10);
                    if (!registers[idx]) return;
                    if (e.target.classList.contains('pr-addr')) registers[idx].address = parseInt(e.target.value, 10) || 0;
                    if (e.target.classList.contains('pr-val'))  registers[idx].valueSource = e.target.value;
                    updateConfig({ registers: registers });
                });
                container.addEventListener('click', function (e) {
                    if (!e.target.classList.contains('pr-remove')) return;
                    var cfg = getConfig();
                    var registers = cfg.registers || [];
                    registers.splice(parseInt(e.target.dataset.idx, 10), 1);
                    updateConfig({ registers: registers });
                    self.renderNodeConfig(node);
                });
            }
            var addBtn = document.getElementById('cfg-add-plc-reg');
            if (addBtn) {
                addBtn.addEventListener('click', function () {
                    var cfg = getConfig();
                    var registers = cfg.registers || [];
                    registers.push({ address: registers.length, valueSource: '' });
                    updateConfig({ registers: registers });
                    self.renderNodeConfig(node);
                });
            }
        },

        // -- TCP_CLIENT events
        _bindTcpClientEvents(node, updateConfig) {
            var ids = {
                'cfg-tcpc-host': 'host',
                'cfg-tcpc-sendData': 'sendData',
                'cfg-tcpc-outputVar': 'outputVariable'
            };
            Object.keys(ids).forEach(function (elId) {
                var el = document.getElementById(elId);
                if (el) el.addEventListener('input', function () {
                    var p = {}; p[ids[elId]] = this.value; updateConfig(p);
                });
            });
            var portEl = document.getElementById('cfg-tcpc-port');
            if (portEl) portEl.addEventListener('input', function () { updateConfig({ port: parseInt(this.value, 10) || 0 }); });
            var timeoutEl = document.getElementById('cfg-tcpc-timeout');
            if (timeoutEl) timeoutEl.addEventListener('input', function () { updateConfig({ timeout: parseInt(this.value, 10) || 5000 }); });
            var sendHexEl = document.getElementById('cfg-tcpc-sendHex');
            if (sendHexEl) sendHexEl.addEventListener('change', function () { updateConfig({ sendHex: this.checked }); });
            var waitRespEl = document.getElementById('cfg-tcpc-waitResponse');
            if (waitRespEl) waitRespEl.addEventListener('change', function () { updateConfig({ waitResponse: this.checked }); });
            var readModeEl = document.getElementById('cfg-tcpc-readMode');
            if (readModeEl) readModeEl.addEventListener('change', function () { updateConfig({ readMode: this.value }); });
        },

        // -- TCP_SERVER events
        _bindTcpServerEvents(node, updateConfig, getConfig) {
            var portEl = document.getElementById('cfg-tcps-port');
            if (portEl) portEl.addEventListener('input', function () { updateConfig({ port: parseInt(this.value, 10) || 0 }); });
            var opEl = document.getElementById('cfg-tcps-operation');
            if (opEl) opEl.addEventListener('change', function () {
                updateConfig({ operation: this.value });
                var sendRow = document.getElementById('cfg-tcps-send-row');
                var recvRow = document.getElementById('cfg-tcps-recv-row');
                if (sendRow) sendRow.style.display = this.value === 'BROADCAST' ? 'block' : 'none';
                if (recvRow) recvRow.style.display = this.value === 'RECEIVE' ? 'block' : 'none';
            });
            var sendDataEl = document.getElementById('cfg-tcps-sendData');
            if (sendDataEl) sendDataEl.addEventListener('input', function () { updateConfig({ sendData: this.value }); });
            var sendHexEl = document.getElementById('cfg-tcps-sendHex');
            if (sendHexEl) sendHexEl.addEventListener('change', function () { updateConfig({ sendHex: this.checked }); });
            var timeoutEl = document.getElementById('cfg-tcps-timeout');
            if (timeoutEl) timeoutEl.addEventListener('input', function () { updateConfig({ timeout: parseInt(this.value, 10) || 10000 }); });
            var outputVarEl = document.getElementById('cfg-tcps-outputVar');
            if (outputVarEl) outputVarEl.addEventListener('input', function () { updateConfig({ outputVariable: this.value }); });
        },

        // -- SCRIPT events
        _bindScriptEvents(node, updateConfig, getConfig) {
            var self = this;
            var container = document.getElementById('cfg-script-ops');
            if (container) {
                container.addEventListener('input', function (e) {
                    var row = e.target.closest('.script-op-row');
                    if (!row) return;
                    var cfg = getConfig();
                    var ops = cfg.operations || [];
                    var idx = parseInt(row.dataset.idx, 10);
                    if (!ops[idx]) return;
                    if (e.target.classList.contains('so-source')) ops[idx].source = e.target.value;
                    if (e.target.classList.contains('so-target')) ops[idx].target = e.target.value;
                    if (e.target.classList.contains('so-params')) {
                        try { ops[idx].params = JSON.parse(e.target.value); }
                        catch (_) { ops[idx].params = e.target.value; }
                    }
                    updateConfig({ operations: ops });
                });
                container.addEventListener('change', function (e) {
                    if (!e.target.classList.contains('so-op')) return;
                    var row = e.target.closest('.script-op-row');
                    if (!row) return;
                    var cfg = getConfig();
                    var ops = cfg.operations || [];
                    var idx = parseInt(row.dataset.idx, 10);
                    if (ops[idx]) {
                        ops[idx].op = e.target.value;
                        updateConfig({ operations: ops });
                    }
                });
                container.addEventListener('click', function (e) {
                    if (!e.target.classList.contains('so-remove')) return;
                    var cfg = getConfig();
                    var ops = cfg.operations || [];
                    ops.splice(parseInt(e.target.dataset.idx, 10), 1);
                    updateConfig({ operations: ops });
                    self.renderNodeConfig(node);
                });
            }
            var addBtn = document.getElementById('cfg-add-script-op');
            if (addBtn) {
                addBtn.addEventListener('click', function () {
                    var cfg = getConfig();
                    var ops = cfg.operations || [];
                    ops.push({ op: 'SPLIT', source: '', target: '', params: {} });
                    updateConfig({ operations: ops });
                    self.renderNodeConfig(node);
                });
            }
        },

        // -- LOG events
        _bindLogEvents(node, updateConfig) {
            var ids = {
                'cfg-log-message': 'message',
                'cfg-log-dataPath': 'dataPath',
                'cfg-log-outputVar': 'outputVariable'
            };
            Object.keys(ids).forEach(function (elId) {
                var el = document.getElementById(elId);
                if (el) el.addEventListener('input', function () {
                    var p = {}; p[ids[elId]] = this.value; updateConfig(p);
                });
            });
            var levelEl = document.getElementById('cfg-log-level');
            if (levelEl) levelEl.addEventListener('change', function () { updateConfig({ logLevel: this.value }); });
            var saveEl = document.getElementById('cfg-log-saveToDb');
            if (saveEl) saveEl.addEventListener('change', function () { updateConfig({ saveToDb: this.checked }); });
        },

        // -- DEDUP_FILTER events
        _bindDedupFilterEvents(node, updateConfig) {
            var inputEl = document.getElementById('cfg-dedup-inputVar');
            if (inputEl) inputEl.addEventListener('input', function () { updateConfig({ inputVariable: this.value }); });
            var ttlEl = document.getElementById('cfg-dedup-ttl');
            if (ttlEl) ttlEl.addEventListener('input', function () { updateConfig({ ttlSeconds: parseInt(this.value, 10) || 60 }); });
            var keyEl = document.getElementById('cfg-dedup-cacheKey');
            if (keyEl) keyEl.addEventListener('input', function () { updateConfig({ cacheKey: this.value }); });
        },
    };

    // -----------------------------------------------------------------
    //  Register as a page for the router
    // -----------------------------------------------------------------
    Pages.designer = {
        render: function (_container, taskId) {
            FlowDesigner.open(taskId);
        },
    };

    // Expose globally
    window.FlowDesigner = FlowDesigner;
})();
