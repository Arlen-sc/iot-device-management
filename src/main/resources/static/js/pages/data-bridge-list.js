Pages.dataBridges = {
    async render(container) {
        container.innerHTML = '<div style="padding:24px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
            '<h2 style="margin:0;font-size:20px;">数据桥接</h2>' +
            '<button id="btn-add-bridge" style="padding:8px 20px;border:none;border-radius:4px;background:#1890ff;color:#fff;cursor:pointer;font-size:14px;">新建桥接</button>' +
            '</div>' +
            '<table style="width:100%;border-collapse:collapse;font-size:14px;">' +
            '<thead><tr style="background:#fafafa;">' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">名称</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">源类型</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">目标类型</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">状态</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">操作</th>' +
            '</tr></thead>' +
            '<tbody id="bridge-tbody"></tbody>' +
            '</table></div>';

        this.loadData();
        document.getElementById('btn-add-bridge').addEventListener('click', () => this.showForm());
    },

    async loadData() {
        try {
            const bridges = await API.get('/data-bridges');
            const tbody = document.getElementById('bridge-tbody');
            if (!tbody) return;
            if (!bridges || bridges.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="padding:24px;text-align:center;color:#999;">暂无数据</td></tr>';
                return;
            }
            tbody.innerHTML = bridges.map(b => this.renderRow(b)).join('');
            this.bindRowEvents(tbody);
        } catch (e) {
            App.showToast('加载数据桥接列表失败: ' + e.message, 'error');
        }
    },

    renderRow(b) {
        const statusMap = {
            0: '<span style="padding:2px 8px;border-radius:10px;background:#d9d9d9;color:#595959;font-size:12px;">禁用</span>',
            1: '<span style="padding:2px 8px;border-radius:10px;background:#f6ffed;color:#52c41a;font-size:12px;">启用</span>',
            2: '<span style="padding:2px 8px;border-radius:10px;background:#fff2f0;color:#ff4d4f;font-size:12px;">异常</span>'
        };

        return '<tr style="border-bottom:1px solid #e8e8e8;">' +
            '<td style="padding:12px;">' + App.escapeHtml(b.name) + '</td>' +
            '<td style="padding:12px;">' + App.escapeHtml(b.sourceType || '') + '</td>' +
            '<td style="padding:12px;">' + App.escapeHtml(b.targetType || '') + '</td>' +
            '<td style="padding:12px;">' + (statusMap[b.status] || b.status) + '</td>' +
            '<td style="padding:12px;">' +
            '<button class="btn-edit" data-id="' + b.id + '" data-item=\'' + App.escapeHtml(JSON.stringify(b)) + '\' style="padding:4px 12px;border:1px solid #d9d9d9;border-radius:4px;background:#fff;cursor:pointer;font-size:12px;margin-right:6px;">编辑</button>' +
            '<button class="btn-del" data-id="' + b.id + '" style="padding:4px 12px;border:none;border-radius:4px;background:#ff4d4f;color:#fff;cursor:pointer;font-size:12px;">删除</button>' +
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
                App.confirm('确定要删除该数据桥接吗？', async () => {
                    try {
                        await API.del('/data-bridges/' + id);
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
        const title = isEdit ? '编辑数据桥接' : '新建数据桥接';
        const b = item || {};

        const fieldStyle = 'width:100%;padding:8px 12px;border:1px solid #d9d9d9;border-radius:4px;font-size:14px;box-sizing:border-box;';
        const labelStyle = 'display:block;margin-bottom:6px;font-size:14px;color:#333;font-weight:500;';
        const rowStyle = 'margin-bottom:16px;';

        const formHtml = '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">名称</label>' +
            '<input id="form-name" type="text" value="' + App.escapeHtml(b.name || '') + '" style="' + fieldStyle + '" placeholder="请输入桥接名称" />' +
            '</div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">源类型</label>' +
            '<input id="form-sourceType" type="text" value="' + App.escapeHtml(b.sourceType || '') + '" style="' + fieldStyle + '" placeholder="例: MQTT, Kafka, HTTP" />' +
            '</div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">源配置 (JSON)</label>' +
            '<textarea id="form-sourceConfig" rows="4" style="' + fieldStyle + 'resize:vertical;font-family:monospace;" placeholder=\'{"host":"...","topic":"..."}\'>' + App.escapeHtml(typeof b.sourceConfig === 'string' ? b.sourceConfig : JSON.stringify(b.sourceConfig || '', null, 2)) + '</textarea>' +
            '</div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">目标类型</label>' +
            '<input id="form-targetType" type="text" value="' + App.escapeHtml(b.targetType || '') + '" style="' + fieldStyle + '" placeholder="例: MySQL, InfluxDB, HTTP" />' +
            '</div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">目标配置 (JSON)</label>' +
            '<textarea id="form-targetConfig" rows="4" style="' + fieldStyle + 'resize:vertical;font-family:monospace;" placeholder=\'{"url":"...","table":"..."}\'>' + App.escapeHtml(typeof b.targetConfig === 'string' ? b.targetConfig : JSON.stringify(b.targetConfig || '', null, 2)) + '</textarea>' +
            '</div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">字段映射 (JSON)</label>' +
            '<textarea id="form-mappingJson" rows="4" style="' + fieldStyle + 'resize:vertical;font-family:monospace;" placeholder=\'[{"source":"field1","target":"col1"}]\'>' + App.escapeHtml(typeof b.mappingJson === 'string' ? b.mappingJson : JSON.stringify(b.mappingJson || '', null, 2)) + '</textarea>' +
            '</div>';

        App.showModal(title, formHtml, async () => {
            const name = document.getElementById('form-name').value.trim();
            if (!name) {
                App.showToast('请输入桥接名称', 'warning');
                return;
            }

            const data = {
                name,
                sourceType: document.getElementById('form-sourceType').value.trim(),
                sourceConfig: document.getElementById('form-sourceConfig').value.trim(),
                targetType: document.getElementById('form-targetType').value.trim(),
                targetConfig: document.getElementById('form-targetConfig').value.trim(),
                mappingJson: document.getElementById('form-mappingJson').value.trim()
            };

            try {
                if (isEdit) {
                    await API.put('/data-bridges/' + item.id, data);
                    App.showToast('更新成功', 'success');
                } else {
                    await API.post('/data-bridges', data);
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
