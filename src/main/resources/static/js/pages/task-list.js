Pages.tasks = {
    async render(container) {
        container.innerHTML = '<div style="padding:24px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
            '<h2 style="margin:0;font-size:20px;">任务管理</h2>' +
            '<button id="btn-add-task" style="padding:8px 20px;border:none;border-radius:4px;background:#1890ff;color:#fff;cursor:pointer;font-size:14px;">新建任务</button>' +
            '</div>' +
            '<table id="task-table" style="width:100%;border-collapse:collapse;font-size:14px;">' +
            '<thead><tr style="background:#fafafa;">' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">名称</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">流程类型</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">触发类型</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">执行模式</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">状态</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">最近执行</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">操作</th>' +
            '</tr></thead>' +
            '<tbody id="task-tbody"></tbody>' +
            '</table></div>';

        this.loadData();
        document.getElementById('btn-add-task').addEventListener('click', () => this.showForm());
    },

    async loadData() {
        try {
            const tasks = await API.get('/task-flow-configs');
            // Also fetch running status
            let runningMap = {};
            try {
                const running = await API.get('/task-flow-configs/running');
                (running || []).forEach(function (r) { runningMap[r.configId] = r; });
            } catch (_) {}
            this._runningMap = runningMap;

            const tbody = document.getElementById('task-tbody');
            if (!tbody) return;
            if (!tasks || tasks.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="padding:24px;text-align:center;color:#999;">暂无数据</td></tr>';
                return;
            }
            tbody.innerHTML = tasks.map(t => this.renderRow(t)).join('');
            this.bindRowEvents(tbody);
        } catch (e) {
            App.showToast('加载任务列表失败: ' + e.message, 'error');
        }
    },

    renderRow(t) {
        const flowTypes = { DEVICE_CONTROL: '设备控制', DATA_PROCESS: '数据处理', MIXED: '混合' };
        const triggerTypes = { ONCE: '手动', SCHEDULED: '定时', EVENT: '事件' };
        const execModes = { SERIAL: '串行', CONCURRENT: '并行', BY_DEVICE: '按设备' };
        const statusMap = {
            0: '<span style="padding:2px 8px;border-radius:10px;background:#d9d9d9;color:#595959;font-size:12px;">禁用</span>',
            1: '<span style="padding:2px 8px;border-radius:10px;background:#e6f7ff;color:#1890ff;font-size:12px;">草稿</span>',
            2: '<span style="padding:2px 8px;border-radius:10px;background:#f6ffed;color:#52c41a;font-size:12px;">已发布</span>'
        };
        const execStatusMap = {
            SUCCESS: '<span style="padding:2px 8px;border-radius:10px;background:#f6ffed;color:#52c41a;font-size:12px;">成功</span>',
            FAILED: '<span style="padding:2px 8px;border-radius:10px;background:#fff2f0;color:#ff4d4f;font-size:12px;">失败</span>',
            ERROR: '<span style="padding:2px 8px;border-radius:10px;background:#fff2f0;color:#ff4d4f;font-size:12px;">异常</span>'
        };
        var lastExec = '';
        var isRunning = this._runningMap && this._runningMap[t.id];
        if (isRunning) {
            var r = this._runningMap[t.id];
            lastExec = '<span style="padding:2px 8px;border-radius:10px;background:#e6f7ff;color:#1890ff;font-size:12px;animation:pulse 1.5s infinite;">运行中 #' + (r.iterations || 0) + '</span>';
            lastExec += '<br><span style="font-size:11px;color:#999;">' + (r.lastStatus || '') + '</span>';
        } else if (t.lastExecutionStatus) {
            var statusStr = t.lastExecutionStatus || '';
            if (statusStr.indexOf('RUNNING') >= 0) {
                lastExec = '<span style="padding:2px 8px;border-radius:10px;background:#fff7e6;color:#d48806;font-size:12px;">已停止</span>';
            } else {
                lastExec = (execStatusMap[t.lastExecutionStatus] || App.escapeHtml(t.lastExecutionStatus));
            }
            if (t.lastExecutionTime) {
                lastExec += '<br><span style="font-size:11px;color:#999;">' + App.escapeHtml(t.lastExecutionTime) + '</span>';
            }
        } else {
            lastExec = '<span style="color:#999;font-size:12px;">未执行</span>';
        }

        var startStopBtn = '';
        if (isRunning) {
            startStopBtn = '<button class="btn-stop" data-id="' + t.id + '" style="padding:4px 12px;border:none;border-radius:4px;background:#ff4d4f;color:#fff;cursor:pointer;font-size:12px;margin-right:6px;">停止</button>';
        } else {
            startStopBtn = '<button class="btn-start" data-id="' + t.id + '" style="padding:4px 12px;border:none;border-radius:4px;background:#722ed1;color:#fff;cursor:pointer;font-size:12px;margin-right:6px;">启动</button>';
        }

        var debugBtn = '';
        if (t.triggerType === 'ONCE') {
             debugBtn = '<button class="btn-debug" data-id="' + t.id + '" style="padding:4px 12px;border:none;border-radius:4px;background:#fa8c16;color:#fff;cursor:pointer;font-size:12px;margin-right:6px;">单次执行</button>';
        }

        return '<tr style="border-bottom:1px solid #e8e8e8;">' +
            '<td style="padding:12px;">' + App.escapeHtml(t.name) + '</td>' +
            '<td style="padding:12px;">' + (flowTypes[t.flowType] || t.flowType || '') + '</td>' +
            '<td style="padding:12px;">' + (triggerTypes[t.triggerType] || t.triggerType || '') + '</td>' +
            '<td style="padding:12px;">' + (execModes[t.executionMode] || t.executionMode || '') + '</td>' +
            '<td style="padding:12px;">' + (statusMap[t.status] || t.status) + '</td>' +
            '<td style="padding:12px;">' + lastExec + '</td>' +
            '<td style="padding:12px;white-space:nowrap;">' +
            '<button class="btn-design" data-id="' + t.id + '" style="padding:4px 12px;border:none;border-radius:4px;background:#1890ff;color:#fff;cursor:pointer;font-size:12px;margin-right:6px;">设计流程</button>' +
            '<button class="btn-edit" data-id="' + t.id + '" data-task=\'' + App.escapeHtml(JSON.stringify(t)) + '\' style="padding:4px 12px;border:1px solid #d9d9d9;border-radius:4px;background:#fff;cursor:pointer;font-size:12px;margin-right:6px;">编辑</button>' +
            startStopBtn +
            debugBtn +
            '<button class="btn-logs" data-id="' + t.id + '" style="padding:4px 12px;border:none;border-radius:4px;background:#13c2c2;color:#fff;cursor:pointer;font-size:12px;margin-right:6px;">日志</button>' +
            '<button class="btn-del" data-id="' + t.id + '" style="padding:4px 12px;border:none;border-radius:4px;background:#ff4d4f;color:#fff;cursor:pointer;font-size:12px;">删除</button>' +
            '</td></tr>';
    },

    bindRowEvents(tbody) {
        tbody.addEventListener('click', async (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const id = btn.dataset.id;

            if (btn.classList.contains('btn-design')) {
                location.hash = '#/designer/' + id;
            } else if (btn.classList.contains('btn-edit')) {
                try {
                    const task = JSON.parse(btn.dataset.task);
                    this.showForm(task);
                } catch (err) {
                    App.showToast('解析任务数据失败', 'error');
                }
            } else if (btn.classList.contains('btn-debug')) {
                try {
                    const result = await API.post('/task-flow-configs/' + id + '/execute');
                    this.showExecResult(result);
                } catch (err) {
                    App.showToast('执行失败: ' + err.message, 'error');
                }
            } else if (btn.classList.contains('btn-logs')) {
                this.showLogsInterface(id);
            } else if (btn.classList.contains('btn-start')) {
                try {
                    await API.post('/task-flow-configs/' + id + '/start?interval=1000');
                    App.showToast('任务已启动持续监听', 'success');
                    Pages.tasks.loadData();
                } catch (err) {
                    App.showToast('启动失败: ' + err.message, 'error');
                }
            } else if (btn.classList.contains('btn-stop')) {
                try {
                    var result = await API.post('/task-flow-configs/' + id + '/stop');
                    App.showToast('任务已停止 (' + (result.iterations || 0) + ' 次迭代)', 'success');
                    Pages.tasks.loadData();
                } catch (err) {
                    App.showToast('停止失败: ' + err.message, 'error');
                }
            } else if (btn.classList.contains('btn-del')) {
                App.confirm('确定要删除该任务吗？', async () => {
                    try {
                        await API.del('/task-flow-configs/' + id);
                        App.hideModal();
                        App.showToast('删除成功', 'success');
                        this.loadData();
                    } catch (err) {
                        App.showToast('删除失败: ' + err.message, 'error');
                    }
                });
            }
        });
    },

    showForm(task) {
        const isEdit = !!task;
        const title = isEdit ? '编辑任务' : '新建任务';
        const formHtml = this.buildFormHtml(task);

        App.showModal(title, formHtml, async () => {
            const name = document.getElementById('form-name').value.trim();
            const description = document.getElementById('form-description').value.trim();
            const flowType = document.getElementById('form-flowType').value;
            const triggerType = document.getElementById('form-triggerType').value;
            const executionMode = document.getElementById('form-executionMode').value;
            const cronExpression = document.getElementById('form-cronExpression').value.trim();

            if (!name) {
                App.showToast('请输入任务名称', 'warning');
                return;
            }

            const data = { name, description, flowType, triggerType, executionMode };
            if (triggerType === 'SCHEDULED') data.cronExpression = cronExpression;

            try {
                if (isEdit) {
                    await API.put('/task-flow-configs/' + task.id, data);
                    App.showToast('更新成功', 'success');
                } else {
                    await API.post('/task-flow-configs', data);
                    App.showToast('创建成功', 'success');
                }
                App.hideModal();
                this.loadData();
            } catch (err) {
                App.showToast('操作失败: ' + err.message, 'error');
            }
        }, { fullscreenable: true });

        // Toggle cron expression field visibility
        const triggerSelect = document.getElementById('form-triggerType');
        const cronRow = document.getElementById('form-cron-row');
        const toggleCron = () => {
            cronRow.style.display = triggerSelect.value === 'SCHEDULED' ? 'block' : 'none';
        };
        triggerSelect.addEventListener('change', toggleCron);
        toggleCron();
    },

    buildFormHtml(task) {
        const t = task || {};
        const fieldStyle = 'width:100%;padding:8px 12px;border:1px solid #d9d9d9;border-radius:4px;font-size:14px;box-sizing:border-box;';
        const labelStyle = 'display:block;margin-bottom:6px;font-size:14px;color:#333;font-weight:500;';
        const rowStyle = 'margin-bottom:16px;';

        return '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">名称</label>' +
            '<input id="form-name" type="text" value="' + App.escapeHtml(t.name || '') + '" style="' + fieldStyle + '" placeholder="请输入任务名称" />' +
            '</div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">描述</label>' +
            '<textarea id="form-description" rows="3" style="' + fieldStyle + 'resize:vertical;" placeholder="请输入描述">' + App.escapeHtml(t.description || '') + '</textarea>' +
            '</div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">流程类型</label>' +
            '<select id="form-flowType" style="' + fieldStyle + '">' +
            '<option value="DEVICE_CONTROL"' + (t.flowType === 'DEVICE_CONTROL' ? ' selected' : '') + '>设备控制</option>' +
            '<option value="DATA_PROCESS"' + (t.flowType === 'DATA_PROCESS' ? ' selected' : '') + '>数据处理</option>' +
            '<option value="MIXED"' + (t.flowType === 'MIXED' ? ' selected' : '') + '>混合</option>' +
            '</select></div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">触发类型</label>' +
            '<select id="form-triggerType" style="' + fieldStyle + '">' +
            '<option value="ONCE"' + (t.triggerType === 'ONCE' ? ' selected' : '') + '>手动</option>' +
            '<option value="SCHEDULED"' + (t.triggerType === 'SCHEDULED' ? ' selected' : '') + '>定时</option>' +
            '<option value="EVENT"' + (t.triggerType === 'EVENT' ? ' selected' : '') + '>事件</option>' +
            '</select></div>' +
            '<div id="form-cron-row" style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">Cron 表达式</label>' +
            '<input id="form-cronExpression" type="text" value="' + App.escapeHtml(t.cronExpression || '') + '" style="' + fieldStyle + '" placeholder="例: 0 0/5 * * * ?" />' +
            '</div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">执行模式</label>' +
            '<select id="form-executionMode" style="' + fieldStyle + '">' +
            '<option value="SERIAL"' + (t.executionMode === 'SERIAL' ? ' selected' : '') + '>串行</option>' +
            '<option value="CONCURRENT"' + (t.executionMode === 'CONCURRENT' ? ' selected' : '') + '>并行</option>' +
            '<option value="BY_DEVICE"' + (t.executionMode === 'BY_DEVICE' ? ' selected' : '') + '>按设备</option>' +
            '</select></div>';
    },

    showLogsInterface: async function(id) {
        try {
            const logs = await API.get('/flow-logs/' + id + '?limit=100');
            
            // 按eventId分组日志
            const events = {};
            logs.forEach(log => {
                const eventId = log.eventId || 'unknown';
                if (!events[eventId]) {
                    events[eventId] = {
                        id: eventId,
                        date: log.createdAt,
                        logs: []
                    };
                }
                events[eventId].logs.push(log);
            });
            
            // 按日期排序事件
            const eventList = Object.values(events).sort((a, b) => {
                return new Date(b.date) - new Date(a.date);
            });
            
            var html = '<div style="display:flex;height:100%;min-height:500px;">';
            
            // Left side event list
            html += '<div style="width:250px;border-right:1px solid #e8e8e8;background:#fafafa;display:flex;flex-direction:column;">';
            html += '<div style="padding:12px;font-size:14px;font-weight:600;border-bottom:1px solid #e8e8e8;flex-shrink:0;">执行事件</div>';
            html += '<div style="flex:1;overflow-y:auto;" id="log-event-list">';
            
            if (eventList.length === 0) {
                html += '<div style="padding:40px 12px;text-align:center;color:#999;">暂无事件记录</div>';
            } else {
                eventList.forEach((event, index) => {
                    const date = new Date(event.date);
                    const formattedDate = date.toLocaleString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    });
                    
                    html += '<div class="event-item" data-event-id="' + event.id + '" style="padding:12px;border-bottom:1px solid #f0f0f0;cursor:pointer;' + (index === 0 ? 'background:#e6f7ff;' : '') + '">' +
                        '<div style="font-size:13px;font-weight:500;margin-bottom:4px;">事件 ' + (eventList.length - index) + '</div>' +
                        '<div style="font-size:12px;color:#666;">' + formattedDate + '</div>' +
                        '<div style="font-size:11px;color:#999;margin-top:2px;">包含 ' + event.logs.length + ' 条日志</div>' +
                        '</div>';
                });
            }
            html += '</div></div>';
            
            // 右侧日志详情
            html += '<div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">';
            html += '<div style="padding:12px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e8e8e8;flex-shrink:0;">' +
                '<div style="font-size:14px;font-weight:600;">流程日志</div>' +
                '<div>' +
                '<button id="log-refresh-btn" style="padding:6px 16px;background:#fff;border:1px solid #d9d9d9;border-radius:4px;cursor:pointer;font-size:13px;margin-right:8px;">刷新</button>' +
                '<button id="log-clear-btn" style="padding:6px 16px;background:#fff;border:1px solid #ff4d4f;color:#ff4d4f;border-radius:4px;cursor:pointer;font-size:13px;">清空</button>' +
                '</div>' +
                '</div>';
            
            // 默认显示第一个事件的日志
            if (eventList.length > 0) {
                html += this.generateLogTable(eventList[0].logs);
            } else {
                html += '<div style="padding:40px;text-align:center;color:#999;">暂无日志记录</div>';
            }
            
            html += '</div>';
            html += '</div>';

            // Update modal settings
            App.showModal('查看日志', html, () => {
                App.hideModal();
            }, { width: '1000px', maxWidth: '95vw', fullscreenable: true });
            
            // Adjust body style for flex layout
            const modalBody = document.querySelector('#modal-overlay .modal-body');
            if (modalBody) {
                modalBody.style.padding = '20px';
                modalBody.style.display = 'flex';
                modalBody.style.flexDirection = 'column';
                modalBody.style.height = '100%';
            }

            // Increase modal width for better log viewing
            const modalEl = document.querySelector('#modal-overlay .modal');
            if (modalEl) {
                modalEl.style.width = '1000px';
                modalEl.style.maxWidth = '95vw';
                modalEl.style.height = '80vh';
            }

            // Hide the cancel button since it's just a view
            const cancelBtn = document.getElementById('modal-cancel-btn');
            if (cancelBtn) cancelBtn.style.display = 'none';
            const confirmBtn = document.getElementById('modal-confirm-btn');
            if (confirmBtn) confirmBtn.textContent = '关闭';
 
            // Bind events for event items
            document.querySelectorAll('.event-item').forEach(item => {
                item.addEventListener('click', () => {
                    // 移除所有事件项的选中状态
                    document.querySelectorAll('.event-item').forEach(i => {
                        i.style.background = '';
                    });
                    // 设置当前事件项为选中状态
                    item.style.background = '#e6f7ff';
                    
                    // 获取当前事件的日志
                    const eventId = item.dataset.eventId;
                    const event = events[eventId];
                    
                    // 更新右侧日志内容
                    const logContainer = document.querySelector('#modal-overlay .modal .modal-body > div > div:nth-child(2)');
                    if (logContainer) {
                        // 保留顶部的标题和按钮
                        const header = logContainer.querySelector('div:first-child');
                        if (header) {
                            logContainer.innerHTML = '';
                            logContainer.appendChild(header);
                            logContainer.innerHTML += this.generateLogTable(event.logs);
                        }
                    }
                });
            });

            // Bind events for refresh and clear
            document.getElementById('log-refresh-btn').addEventListener('click', () => {
                App.hideModal();
                this.showLogsInterface(id);
            });
            document.getElementById('log-clear-btn').addEventListener('click', () => {
                App.confirm('确定要清空该任务的所有日志吗？', async () => {
                    try {
                        await API.del('/flow-logs/' + id);
                        App.showToast('日志已清空', 'success');
                        App.hideModal();
                        this.showLogsInterface(id);
                    } catch (e) {
                        App.showToast('清空失败: ' + e.message, 'error');
                    }
                });
            });
            
        } catch (err) {
            App.showToast('加载日志失败: ' + err.message, 'error');
        }
    },
    
    generateLogTable(logs) {
        let html = '';
        if (!logs || logs.length === 0) {
            html += '<div style="color:#999;text-align:center;padding:40px;background:#fafafa;border-radius:4px;margin:12px;flex:1;">暂无日志记录</div>';
        } else {
            html += '<div style="flex:1;overflow-y:auto;border:1px solid #e8e8e8;border-radius:4px;min-height:0;">';
            html += '<table style="width:100%;border-collapse:collapse;font-size:13px;table-layout:fixed;word-wrap:break-word;">';
            html += '<thead style="position:sticky;top:0;z-index:1;background:#fafafa;box-shadow:0 1px 2px rgba(0,0,0,0.05);"><tr style="background:#fafafa;">';
            html += '<th style="padding:10px 8px;text-align:left;border-bottom:1px solid #e8e8e8;width:160px;">时间</th>';
            html += '<th style="padding:10px 8px;text-align:left;border-bottom:1px solid #e8e8e8;width:60px;">级别</th>';
            html += '<th style="padding:10px 8px;text-align:left;border-bottom:1px solid #e8e8e8;width:120px;">节点</th>';
            html += '<th style="padding:10px 8px;text-align:left;border-bottom:1px solid #e8e8e8;">消息与数据</th>';
            html += '</tr></thead><tbody>';
            
            logs.forEach(log => {
                let color = '#333';
                if (log.level === 'ERROR' || (log.message && log.message.indexOf('【节点执行失败】') >= 0) || (log.message && log.message.indexOf('【节点执行异常】') >= 0)) color = '#ff4d4f';
                if (log.level === 'WARN' || (log.message && log.message.indexOf('【节点执行警告】') >= 0)) color = '#faad14';
                if (log.message && log.message.indexOf('================') >= 0) color = '#1890ff';
                if (log.message && log.message.indexOf('【流程流转】') >= 0) color = '#b37feb';
                if (log.message && log.message.indexOf('【节点执行成功】') >= 0) color = '#52c41a';
                
                let dataHtml = '';
                if (log.dataJson && log.dataJson !== 'null') {
                    try {
                        const parsed = JSON.parse(log.dataJson);
                        dataHtml = '<div style="margin-top:6px;padding:8px;background:#f5f5f5;border-radius:4px;font-family:monospace;font-size:12px;overflow-x:auto;color:#666;">' + 
                                   App.escapeHtml(JSON.stringify(parsed, null, 2)) + 
                                   '</div>';
                    } catch (e) {
                        dataHtml = '<div style="margin-top:6px;padding:8px;background:#f5f5f5;border-radius:4px;font-family:monospace;font-size:12px;overflow-x:auto;color:#666;">' + 
                                   App.escapeHtml(log.dataJson) + 
                                   '</div>';
                    }
                }

                html += '<tr style="border-bottom:1px solid #f0f0f0;color:' + color + '">';
                html += '<td style="padding:10px 8px;vertical-align:top;">' + App.escapeHtml(log.createdAt ? log.createdAt.replace('T', ' ') : '') + '</td>';
                
                let levelBadge = log.level;
                if (log.level === 'ERROR') levelBadge = '<span style="background:#fff2f0;color:#ff4d4f;padding:2px 6px;border-radius:4px;border:1px solid #ffccc7;font-size:12px;">ERROR</span>';
                else if (log.level === 'WARN') levelBadge = '<span style="background:#fffbe6;color:#fa8c16;padding:2px 6px;border-radius:4px;border:1px solid #ffe8cc;font-size:12px;">WARN</span>';
                else if (log.level === 'INFO') levelBadge = '<span style="background:#e6f7ff;color:#1890ff;padding:2px 6px;border-radius:4px;border:1px solid #91d5ff;font-size:12px;">INFO</span>';
                
                html += '<td style="padding:10px 8px;vertical-align:top;">' + levelBadge + '</td>';
                html += '<td style="padding:10px 8px;vertical-align:top;word-break:break-all;">' + App.escapeHtml(log.nodeName || log.nodeId || '-') + '</td>';
                html += '<td style="padding:10px 8px;vertical-align:top;word-break:break-all;">' + 
                        '<div style="line-height:1.5;">' + App.escapeHtml(log.message || '') + '</div>' + 
                        dataHtml + 
                        '</td>';
                html += '</tr>';
            });
            html += '</tbody></table></div>';
        }
        return html;
    },

    showExecResult(result) {
        var status = result.status || 'UNKNOWN';
        var logs = result.logs || [];
        var variables = result.variables || {};

        var statusColor = status === 'SUCCESS' ? '#52c41a' : '#ff4d4f';
        var statusLabel = status === 'SUCCESS' ? '执行成功' : '执行失败';

        var html = '<div style="margin-bottom:16px;">' +
            '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">' +
            '<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:' + statusColor + ';"></span>' +
            '<span style="font-size:16px;font-weight:600;color:' + statusColor + ';">' + statusLabel + '</span>' +
            '</div>';

        // Execution logs section
        html += '<div style="margin-bottom:16px;">' +
            '<div style="font-size:13px;font-weight:600;color:#333;margin-bottom:8px;">执行日志</div>' +
            '<div style="background:#1e1e1e;border-radius:6px;padding:12px;max-height:300px;overflow-y:auto;font-family:monospace;font-size:13px;line-height:1.6;">';
        if (logs.length === 0) {
            html += '<div style="color:#999;font-size:13px;">无日志记录</div>';
        } else {
            for (var i = 0; i < logs.length; i++) {
                var logColor = '#a0e8af';
                var logText = App.escapeHtml(logs[i]);
                if (logText.indexOf('ERROR') >= 0 || logText.indexOf('error') >= 0 || logText.indexOf('fail') >= 0 || logText.indexOf('【节点执行异常】') >= 0 || logText.indexOf('【节点执行失败】') >= 0) {
                    logColor = '#ff6b6b';
                } else if (logText.indexOf('WARN') >= 0 || logText.indexOf('warn') >= 0 || logText.indexOf('【节点执行警告】') >= 0) {
                    logColor = '#ffd93d';
                } else if (logText.indexOf('================') >= 0) {
                    logColor = '#1890ff';
                } else if (logText.indexOf('【流程流转】') >= 0) {
                    logColor = '#b37feb';
                } else if (logText.indexOf('【节点执行成功】') >= 0) {
                    logColor = '#52c41a';
                }
                html += '<div style="color:' + logColor + ';margin-bottom:6px;word-break:break-all;border-bottom:1px dashed #333;padding-bottom:4px;">' + logText + '</div>';
            }
        }
        html += '</div></div>';

        // Variables section
        var varKeys = Object.keys(variables);
        if (varKeys.length > 0) {
            html += '<div>' +
                '<div style="font-size:13px;font-weight:600;color:#333;margin-bottom:8px;">流程变量</div>' +
                '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
                '<thead><tr style="background:#fafafa;">' +
                '<th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e8e8e8;color:#666;">变量名</th>' +
                '<th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e8e8e8;color:#666;">值</th>' +
                '</tr></thead><tbody>';
            for (var k = 0; k < varKeys.length; k++) {
                var key = varKeys[k];
                var val = variables[key];
                var displayVal = (typeof val === 'object') ? JSON.stringify(val) : String(val);
                html += '<tr style="border-bottom:1px solid #f0f0f0;">' +
                    '<td style="padding:6px 12px;font-family:monospace;color:#1890ff;">' + App.escapeHtml(key) + '</td>' +
                    '<td style="padding:6px 12px;font-family:monospace;word-break:break-all;">' + App.escapeHtml(displayVal) + '</td>' +
                    '</tr>';
            }
            html += '</tbody></table></div>';
        }

        html += '</div>';

        App.showModal('执行结果', html, () => {
            App.hideModal();
        }, { width: '800px', maxWidth: '90vw', fullscreenable: true });

        const cancelBtn = document.getElementById('modal-cancel-btn');
        if (cancelBtn) cancelBtn.style.display = 'none';
        const confirmBtn = document.getElementById('modal-confirm-btn');
        if (confirmBtn) confirmBtn.textContent = '关闭';
    }
};
