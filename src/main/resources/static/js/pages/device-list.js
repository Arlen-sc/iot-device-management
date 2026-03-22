Pages.devices = {
    models: [],

    async render(container) {
        container.innerHTML = '<div style="padding:24px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
            '<h2 style="margin:0;font-size:20px;">设备管理</h2>' +
            '<button id="btn-add-device" style="padding:8px 20px;border:none;border-radius:4px;background:#1890ff;color:#fff;cursor:pointer;font-size:14px;">新建设备</button>' +
            '</div>' +
            '<table style="width:100%;border-collapse:collapse;font-size:14px;">' +
            '<thead><tr style="background:#fafafa;">' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">名称</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">编码</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">协议类型</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">IP地址</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">端口</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">状态</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">操作</th>' +
            '</tr></thead>' +
            '<tbody id="device-tbody"></tbody>' +
            '</table></div>';

        try {
            this.models = await API.get('/device-models') || [];
        } catch (e) {
            this.models = [];
        }

        this.loadData();
        document.getElementById('btn-add-device').addEventListener('click', () => this.showForm());
    },

    async loadData() {
        try {
            const devices = await API.get('/devices');
            const tbody = document.getElementById('device-tbody');
            if (!tbody) return;
            if (!devices || devices.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="padding:24px;text-align:center;color:#999;">暂无数据</td></tr>';
                return;
            }
            tbody.innerHTML = devices.map(d => this.renderRow(d)).join('');
            this.bindRowEvents(tbody);
        } catch (e) {
            App.showToast('加载设备列表失败: ' + e.message, 'error');
        }
    },

    renderRow(d) {
        const statusMap = {
            0: '<span style="padding:2px 8px;border-radius:10px;background:#d9d9d9;color:#595959;font-size:12px;">离线</span>',
            1: '<span style="padding:2px 8px;border-radius:10px;background:#f6ffed;color:#52c41a;font-size:12px;">在线</span>',
            2: '<span style="padding:2px 8px;border-radius:10px;background:#fff2f0;color:#ff4d4f;font-size:12px;">故障</span>',
            3: '<span style="padding:2px 8px;border-radius:10px;background:#fff7e6;color:#fa8c16;font-size:12px;">维护中</span>'
        };

        return '<tr style="border-bottom:1px solid #e8e8e8;">' +
            '<td style="padding:12px;">' + App.escapeHtml(d.name) + '</td>' +
            '<td style="padding:12px;">' + App.escapeHtml(d.code) + '</td>' +
            '<td style="padding:12px;">' + App.escapeHtml(d.protocolType || '') + '</td>' +
            '<td style="padding:12px;">' + App.escapeHtml(d.ipAddress || '') + '</td>' +
            '<td style="padding:12px;">' + App.escapeHtml(d.port || '') + '</td>' +
            '<td style="padding:12px;">' + (statusMap[d.status] || d.status) + '</td>' +
            '<td style="padding:12px;">' +
            '<button class="btn-edit" data-id="' + d.id + '" data-item=\'' + App.escapeHtml(JSON.stringify(d)) + '\' style="padding:4px 12px;border:1px solid #d9d9d9;border-radius:4px;background:#fff;cursor:pointer;font-size:12px;margin-right:6px;">编辑</button>' +
            '<button class="btn-del" data-id="' + d.id + '" style="padding:4px 12px;border:none;border-radius:4px;background:#ff4d4f;color:#fff;cursor:pointer;font-size:12px;">删除</button>' +
            '</td></tr>';
    },

    bindRowEvents(tbody) {
        tbody.addEventListener('click', async (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const id = btn.dataset.id;

            if (btn.classList.contains('btn-edit')) {
                try {
                    const item = JSON.parse(btn.dataset.item);
                    this.showForm(item);
                } catch (err) {
                    App.showToast('解析数据失败', 'error');
                }
            } else if (btn.classList.contains('btn-del')) {
                App.confirm('确定要删除该设备吗？', async () => {
                    try {
                        await API.del('/devices/' + id);
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

    showForm(item) {
        const isEdit = !!item;
        const title = isEdit ? '编辑设备' : '新建设备';
        const d = item || {};

        const fieldStyle = 'width:100%;padding:8px 12px;border:1px solid #d9d9d9;border-radius:4px;font-size:14px;box-sizing:border-box;';
        const labelStyle = 'display:block;margin-bottom:6px;font-size:14px;color:#333;font-weight:500;';
        const rowStyle = 'margin-bottom:16px;';

        const modelOptions = this.models.map(m =>
            '<option value="' + m.id + '"' + (d.modelId === m.id ? ' selected' : '') + '>' + App.escapeHtml(m.name) + '</option>'
        ).join('');

        const formHtml = '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">名称</label>' +
            '<input id="form-name" type="text" value="' + App.escapeHtml(d.name || '') + '" style="' + fieldStyle + '" placeholder="请输入设备名称" />' +
            '</div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">编码</label>' +
            '<input id="form-code" type="text" value="' + App.escapeHtml(d.code || '') + '" style="' + fieldStyle + '" placeholder="请输入设备编码" />' +
            '</div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">设备型号</label>' +
            '<select id="form-modelId" style="' + fieldStyle + '">' +
            '<option value="">请选择</option>' + modelOptions +
            '</select></div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">协议类型</label>' +
            '<select id="form-protocolType" style="' + fieldStyle + '">' +
            '<option value="MQTT"' + (d.protocolType === 'MQTT' ? ' selected' : '') + '>MQTT</option>' +
            '<option value="HTTP"' + (d.protocolType === 'HTTP' ? ' selected' : '') + '>HTTP</option>' +
            '</select></div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">连接配置 (JSON)</label>' +
            '<textarea id="form-connectionConfig" rows="3" style="' + fieldStyle + 'resize:vertical;font-family:monospace;" placeholder=\'{"host":"...","port":1883}\'>' + App.escapeHtml(typeof d.connectionConfig === 'string' ? d.connectionConfig : JSON.stringify(d.connectionConfig || '', null, 2)) + '</textarea>' +
            '</div>' +
            '<div style="display:flex;gap:16px;">' +
            '<div style="flex:1;' + rowStyle + '">' +
            '<label style="' + labelStyle + '">IP地址</label>' +
            '<input id="form-ipAddress" type="text" value="' + App.escapeHtml(d.ipAddress || '') + '" style="' + fieldStyle + '" placeholder="192.168.1.100" />' +
            '</div>' +
            '<div style="flex:1;' + rowStyle + '">' +
            '<label style="' + labelStyle + '">端口</label>' +
            '<input id="form-port" type="number" value="' + App.escapeHtml(d.port || '') + '" style="' + fieldStyle + '" placeholder="8080" />' +
            '</div></div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">位置</label>' +
            '<input id="form-location" type="text" value="' + App.escapeHtml(d.location || '') + '" style="' + fieldStyle + '" placeholder="请输入设备位置" />' +
            '</div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">描述</label>' +
            '<textarea id="form-description" rows="2" style="' + fieldStyle + 'resize:vertical;" placeholder="请输入描述">' + App.escapeHtml(d.description || '') + '</textarea>' +
            '</div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">状态</label>' +
            '<select id="form-status" style="' + fieldStyle + '">' +
            '<option value="0"' + (d.status === 0 ? ' selected' : '') + '>离线</option>' +
            '<option value="1"' + (d.status === 1 ? ' selected' : '') + '>在线</option>' +
            '<option value="2"' + (d.status === 2 ? ' selected' : '') + '>故障</option>' +
            '<option value="3"' + (d.status === 3 ? ' selected' : '') + '>维护中</option>' +
            '</select></div>';

        App.showModal(title, formHtml, async () => {
            const name = document.getElementById('form-name').value.trim();
            const code = document.getElementById('form-code').value.trim();
            if (!name || !code) {
                App.showToast('请填写名称和编码', 'warning');
                return;
            }

            const data = {
                name,
                code,
                modelId: document.getElementById('form-modelId').value || null,
                protocolType: document.getElementById('form-protocolType').value,
                connectionConfig: document.getElementById('form-connectionConfig').value.trim(),
                ipAddress: document.getElementById('form-ipAddress').value.trim(),
                port: parseInt(document.getElementById('form-port').value) || null,
                location: document.getElementById('form-location').value.trim(),
                description: document.getElementById('form-description').value.trim(),
                status: parseInt(document.getElementById('form-status').value)
            };

            try {
                if (isEdit) {
                    await API.put('/devices/' + item.id, data);
                    App.showToast('更新成功', 'success');
                } else {
                    await API.post('/devices', data);
                    App.showToast('创建成功', 'success');
                }
                App.hideModal();
                this.loadData();
            } catch (err) {
                App.showToast('操作失败: ' + err.message, 'error');
            }
        });
    }
};
