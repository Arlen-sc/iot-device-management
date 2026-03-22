Pages.operations = {
    async render(container) {
        container.innerHTML = '<div style="padding:24px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
            '<h2 style="margin:0;font-size:20px;">操作类型</h2>' +
            '<button id="btn-add-operation" style="padding:8px 20px;border:none;border-radius:4px;background:#1890ff;color:#fff;cursor:pointer;font-size:14px;">新建操作</button>' +
            '</div>' +
            '<table style="width:100%;border-collapse:collapse;font-size:14px;">' +
            '<thead><tr style="background:#fafafa;">' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">名称</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">编码</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">协议类型</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">状态</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">操作</th>' +
            '</tr></thead>' +
            '<tbody id="operation-tbody"></tbody>' +
            '</table></div>';

        this.loadData();
        document.getElementById('btn-add-operation').addEventListener('click', () => this.showForm());
    },

    async loadData() {
        try {
            const ops = await API.get('/operation-types');
            const tbody = document.getElementById('operation-tbody');
            if (!tbody) return;
            if (!ops || ops.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="padding:24px;text-align:center;color:#999;">暂无数据</td></tr>';
                return;
            }
            tbody.innerHTML = ops.map(o => this.renderRow(o)).join('');
            this.bindRowEvents(tbody);
        } catch (e) {
            App.showToast('加载操作类型列表失败: ' + e.message, 'error');
        }
    },

    renderRow(o) {
        const statusMap = {
            0: '<span style="padding:2px 8px;border-radius:10px;background:#d9d9d9;color:#595959;font-size:12px;">禁用</span>',
            1: '<span style="padding:2px 8px;border-radius:10px;background:#f6ffed;color:#52c41a;font-size:12px;">启用</span>'
        };

        return '<tr style="border-bottom:1px solid #e8e8e8;">' +
            '<td style="padding:12px;">' + App.escapeHtml(o.name) + '</td>' +
            '<td style="padding:12px;">' + App.escapeHtml(o.code || '') + '</td>' +
            '<td style="padding:12px;">' + App.escapeHtml(o.protocolType || '') + '</td>' +
            '<td style="padding:12px;">' + (statusMap[o.status] || o.status) + '</td>' +
            '<td style="padding:12px;">' +
            '<button class="btn-edit" data-id="' + o.id + '" data-item=\'' + App.escapeHtml(JSON.stringify(o)) + '\' style="padding:4px 12px;border:1px solid #d9d9d9;border-radius:4px;background:#fff;cursor:pointer;font-size:12px;margin-right:6px;">编辑</button>' +
            '<button class="btn-del" data-id="' + o.id + '" style="padding:4px 12px;border:none;border-radius:4px;background:#ff4d4f;color:#fff;cursor:pointer;font-size:12px;">删除</button>' +
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
                App.confirm('确定要删除该操作类型吗？', async () => {
                    try {
                        await API.del('/operation-types/' + id);
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
        const title = isEdit ? '编辑操作类型' : '新建操作类型';
        const o = item || {};

        const fieldStyle = 'width:100%;padding:8px 12px;border:1px solid #d9d9d9;border-radius:4px;font-size:14px;box-sizing:border-box;';
        const labelStyle = 'display:block;margin-bottom:6px;font-size:14px;color:#333;font-weight:500;';
        const rowStyle = 'margin-bottom:16px;';

        const formHtml = '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">名称</label>' +
            '<input id="form-name" type="text" value="' + App.escapeHtml(o.name || '') + '" style="' + fieldStyle + '" placeholder="请输入操作类型名称" />' +
            '</div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">编码</label>' +
            '<input id="form-code" type="text" value="' + App.escapeHtml(o.code || '') + '" style="' + fieldStyle + '" placeholder="请输入编码" />' +
            '</div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">协议类型</label>' +
            '<select id="form-protocolType" style="' + fieldStyle + '">' +
            '<option value="MQTT"' + (o.protocolType === 'MQTT' ? ' selected' : '') + '>MQTT</option>' +
            '<option value="HTTP"' + (o.protocolType === 'HTTP' ? ' selected' : '') + '>HTTP</option>' +
            '</select></div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">参数模式 (JSON Schema)</label>' +
            '<textarea id="form-paramSchema" rows="5" style="' + fieldStyle + 'resize:vertical;font-family:monospace;" placeholder=\'{"type":"object","properties":{}}\'>' + App.escapeHtml(typeof o.paramSchema === 'string' ? o.paramSchema : JSON.stringify(o.paramSchema || '', null, 2)) + '</textarea>' +
            '</div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">描述</label>' +
            '<textarea id="form-description" rows="2" style="' + fieldStyle + 'resize:vertical;" placeholder="请输入描述">' + App.escapeHtml(o.description || '') + '</textarea>' +
            '</div>';

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
                protocolType: document.getElementById('form-protocolType').value,
                paramSchema: document.getElementById('form-paramSchema').value.trim(),
                description: document.getElementById('form-description').value.trim()
            };

            try {
                if (isEdit) {
                    await API.put('/operation-types/' + item.id, data);
                    App.showToast('更新成功', 'success');
                } else {
                    await API.post('/operation-types', data);
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
