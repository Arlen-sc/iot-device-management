Pages.alerts = {
    activeTab: 'configs',

    async render(container) {
        container.innerHTML = '<div style="padding:24px;">' +
            '<h2 style="margin:0 0 20px 0;font-size:20px;">告警管理</h2>' +
            '<div style="display:flex;gap:0;margin-bottom:20px;border-bottom:2px solid #e8e8e8;">' +
            '<button id="tab-configs" class="alert-tab" data-tab="configs" style="padding:10px 24px;border:none;background:none;cursor:pointer;font-size:14px;border-bottom:2px solid #1890ff;margin-bottom:-2px;color:#1890ff;font-weight:500;">告警配置</button>' +
            '<button id="tab-records" class="alert-tab" data-tab="records" style="padding:10px 24px;border:none;background:none;cursor:pointer;font-size:14px;border-bottom:2px solid transparent;margin-bottom:-2px;color:#666;">告警记录</button>' +
            '</div>' +
            '<div id="alert-content"></div>' +
            '</div>';

        container.querySelector('.alert-tab[data-tab="configs"]').addEventListener('click', () => this.switchTab('configs'));
        container.querySelector('.alert-tab[data-tab="records"]').addEventListener('click', () => this.switchTab('records'));

        this.switchTab('configs');
    },

    switchTab(tab) {
        this.activeTab = tab;
        document.querySelectorAll('.alert-tab').forEach(btn => {
            const isActive = btn.dataset.tab === tab;
            btn.style.borderBottomColor = isActive ? '#1890ff' : 'transparent';
            btn.style.color = isActive ? '#1890ff' : '#666';
            btn.style.fontWeight = isActive ? '500' : 'normal';
        });

        if (tab === 'configs') {
            this.renderConfigs();
        } else {
            this.renderRecords();
        }
    },

    async renderConfigs() {
        const content = document.getElementById('alert-content');
        if (!content) return;
        content.innerHTML = '<div style="display:flex;justify-content:flex-end;margin-bottom:16px;">' +
            '<button id="btn-add-alert-config" style="padding:8px 20px;border:none;border-radius:4px;background:#1890ff;color:#fff;cursor:pointer;font-size:14px;">新建配置</button>' +
            '</div>' +
            '<table style="width:100%;border-collapse:collapse;font-size:14px;">' +
            '<thead><tr style="background:#fafafa;">' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">名称</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">设备</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">条件</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">状态</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">操作</th>' +
            '</tr></thead>' +
            '<tbody id="alert-config-tbody"></tbody>' +
            '</table>';

        document.getElementById('btn-add-alert-config').addEventListener('click', () => this.showConfigForm());

        try {
            const configs = await API.get('/alerts/configs');
            const tbody = document.getElementById('alert-config-tbody');
            if (!tbody) return;
            if (!configs || configs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="padding:24px;text-align:center;color:#999;">暂无数据</td></tr>';
                return;
            }
            const statusMap = {
                0: '<span style="padding:2px 8px;border-radius:10px;background:#d9d9d9;color:#595959;font-size:12px;">禁用</span>',
                1: '<span style="padding:2px 8px;border-radius:10px;background:#f6ffed;color:#52c41a;font-size:12px;">启用</span>'
            };
            tbody.innerHTML = configs.map(c =>
                '<tr style="border-bottom:1px solid #e8e8e8;">' +
                '<td style="padding:12px;">' + App.escapeHtml(c.name) + '</td>' +
                '<td style="padding:12px;">' + App.escapeHtml(c.deviceName || c.deviceId || '') + '</td>' +
                '<td style="padding:12px;"><code style="font-size:12px;background:#f5f5f5;padding:2px 6px;border-radius:3px;">' + App.escapeHtml(c.conditionExpression || '') + '</code></td>' +
                '<td style="padding:12px;">' + (statusMap[c.status] || c.status) + '</td>' +
                '<td style="padding:12px;">' +
                '<button class="btn-edit-config" data-id="' + c.id + '" data-item=\'' + App.escapeHtml(JSON.stringify(c)) + '\' style="padding:4px 12px;border:1px solid #d9d9d9;border-radius:4px;background:#fff;cursor:pointer;font-size:12px;margin-right:6px;">编辑</button>' +
                '<button class="btn-del-config" data-id="' + c.id + '" style="padding:4px 12px;border:none;border-radius:4px;background:#ff4d4f;color:#fff;cursor:pointer;font-size:12px;">删除</button>' +
                '</td></tr>'
            ).join('');

            tbody.addEventListener('click', async (e) => {
                const btn = e.target.closest('button');
                if (!btn) return;
                const id = btn.dataset.id;

                if (btn.classList.contains('btn-edit-config')) {
                    try {
                        const item = JSON.parse(btn.dataset.item);
                        this.showConfigForm(item);
                    } catch (err) {
                        App.showToast('解析数据失败', 'error');
                    }
                } else if (btn.classList.contains('btn-del-config')) {
                    App.confirm('确定要删除该告警配置吗？', async () => {
                        try {
                            await API.del('/alerts/configs/' + id);
                            App.hideModal();
                            App.showToast('删除成功', 'success');
                            this.renderConfigs();
                        } catch (err) {
                            App.showToast('删除失败: ' + err.message, 'error');
                        }
                    });
                }
            });
        } catch (e) {
            App.showToast('加载告警配置失败: ' + e.message, 'error');
        }
    },

    async renderRecords() {
        const content = document.getElementById('alert-content');
        if (!content) return;
        content.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:14px;">' +
            '<thead><tr style="background:#fafafa;">' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">配置</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">设备</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">级别</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">消息</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">触发时间</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">状态</th>' +
            '</tr></thead>' +
            '<tbody id="alert-record-tbody"></tbody>' +
            '</table>';

        try {
            const records = await API.get('/alerts/records');
            const tbody = document.getElementById('alert-record-tbody');
            if (!tbody) return;
            if (!records || records.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="padding:24px;text-align:center;color:#999;">暂无数据</td></tr>';
                return;
            }

            const levelMap = {
                INFO: '<span style="padding:2px 8px;border-radius:10px;background:#e6f7ff;color:#1890ff;font-size:12px;">信息</span>',
                WARNING: '<span style="padding:2px 8px;border-radius:10px;background:#fff7e6;color:#fa8c16;font-size:12px;">警告</span>',
                CRITICAL: '<span style="padding:2px 8px;border-radius:10px;background:#fff2f0;color:#ff4d4f;font-size:12px;">严重</span>'
            };
            const recordStatusMap = {
                0: '<span style="padding:2px 8px;border-radius:10px;background:#fff2f0;color:#ff4d4f;font-size:12px;">未处理</span>',
                1: '<span style="padding:2px 8px;border-radius:10px;background:#f6ffed;color:#52c41a;font-size:12px;">已处理</span>',
                2: '<span style="padding:2px 8px;border-radius:10px;background:#d9d9d9;color:#595959;font-size:12px;">已忽略</span>'
            };

            tbody.innerHTML = records.map(r =>
                '<tr style="border-bottom:1px solid #e8e8e8;">' +
                '<td style="padding:12px;">' + App.escapeHtml(r.configName || r.configId || '') + '</td>' +
                '<td style="padding:12px;">' + App.escapeHtml(r.deviceName || r.deviceId || '') + '</td>' +
                '<td style="padding:12px;">' + (levelMap[r.level] || App.escapeHtml(r.level || '')) + '</td>' +
                '<td style="padding:12px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + App.escapeHtml(r.message || '') + '">' + App.escapeHtml(r.message || '') + '</td>' +
                '<td style="padding:12px;">' + App.escapeHtml(r.triggeredAt || r.createTime || '') + '</td>' +
                '<td style="padding:12px;">' + (recordStatusMap[r.status] || r.status) + '</td>' +
                '</tr>'
            ).join('');
        } catch (e) {
            App.showToast('加载告警记录失败: ' + e.message, 'error');
        }
    },

    showConfigForm(item) {
        const isEdit = !!item;
        const title = isEdit ? '编辑告警配置' : '新建告警配置';
        const c = item || {};

        const fieldStyle = 'width:100%;padding:8px 12px;border:1px solid #d9d9d9;border-radius:4px;font-size:14px;box-sizing:border-box;';
        const labelStyle = 'display:block;margin-bottom:6px;font-size:14px;color:#333;font-weight:500;';
        const rowStyle = 'margin-bottom:16px;';

        const formHtml = '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">名称</label>' +
            '<input id="form-name" type="text" value="' + App.escapeHtml(c.name || '') + '" style="' + fieldStyle + '" placeholder="请输入配置名称" />' +
            '</div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">设备ID</label>' +
            '<input id="form-deviceId" type="text" value="' + App.escapeHtml(c.deviceId || '') + '" style="' + fieldStyle + '" placeholder="请输入设备ID" />' +
            '</div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">条件表达式</label>' +
            '<input id="form-conditionExpression" type="text" value="' + App.escapeHtml(c.conditionExpression || '') + '" style="' + fieldStyle + '" placeholder="例: temperature > 80" />' +
            '</div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">告警级别</label>' +
            '<select id="form-level" style="' + fieldStyle + '">' +
            '<option value="INFO"' + (c.level === 'INFO' ? ' selected' : '') + '>信息</option>' +
            '<option value="WARNING"' + (c.level === 'WARNING' ? ' selected' : '') + '>警告</option>' +
            '<option value="CRITICAL"' + (c.level === 'CRITICAL' ? ' selected' : '') + '>严重</option>' +
            '</select></div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">描述</label>' +
            '<textarea id="form-description" rows="2" style="' + fieldStyle + 'resize:vertical;" placeholder="请输入描述">' + App.escapeHtml(c.description || '') + '</textarea>' +
            '</div>';

        App.showModal(title, formHtml, async () => {
            const name = document.getElementById('form-name').value.trim();
            if (!name) {
                App.showToast('请输入配置名称', 'warning');
                return;
            }

            const data = {
                name,
                deviceId: document.getElementById('form-deviceId').value.trim(),
                conditionExpression: document.getElementById('form-conditionExpression').value.trim(),
                level: document.getElementById('form-level').value,
                description: document.getElementById('form-description').value.trim()
            };

            try {
                if (isEdit) {
                    await API.put('/alerts/configs/' + item.id, data);
                    App.showToast('更新成功', 'success');
                } else {
                    await API.post('/alerts/configs', data);
                    App.showToast('创建成功', 'success');
                }
                App.hideModal();
                this.renderConfigs();
            } catch (err) {
                App.showToast('操作失败: ' + err.message, 'error');
            }
        });
    }
};
