Pages.models = {
    categories: [],

    async render(container) {
        container.innerHTML = '<div style="padding:24px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
            '<h2 style="margin:0;font-size:20px;">设备型号</h2>' +
            '<button id="btn-add-model" style="padding:8px 20px;border:none;border-radius:4px;background:#1890ff;color:#fff;cursor:pointer;font-size:14px;">新建型号</button>' +
            '</div>' +
            '<table style="width:100%;border-collapse:collapse;font-size:14px;">' +
            '<thead><tr style="background:#fafafa;">' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">名称</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">编码</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">分类</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">协议类型</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">厂商</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">状态</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">操作</th>' +
            '</tr></thead>' +
            '<tbody id="model-tbody"></tbody>' +
            '</table></div>';

        try {
            this.categories = await API.get('/device-categories/tree') || [];
        } catch (e) {
            this.categories = [];
        }

        this.loadData();
        document.getElementById('btn-add-model').addEventListener('click', () => this.showForm());
    },

    flattenCategories(nodes, depth, result) {
        if (!nodes) return;
        nodes.forEach(node => {
            result.push({ id: node.id, name: node.name, depth });
            if (node.children && node.children.length > 0) {
                this.flattenCategories(node.children, depth + 1, result);
            }
        });
    },

    async loadData() {
        try {
            const models = await API.get('/device-models');
            const tbody = document.getElementById('model-tbody');
            if (!tbody) return;
            if (!models || models.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="padding:24px;text-align:center;color:#999;">暂无数据</td></tr>';
                return;
            }
            tbody.innerHTML = models.map(m => this.renderRow(m)).join('');
            this.bindRowEvents(tbody);
        } catch (e) {
            App.showToast('加载型号列表失败: ' + e.message, 'error');
        }
    },

    renderRow(m) {
        const statusMap = {
            0: '<span style="padding:2px 8px;border-radius:10px;background:#d9d9d9;color:#595959;font-size:12px;">禁用</span>',
            1: '<span style="padding:2px 8px;border-radius:10px;background:#f6ffed;color:#52c41a;font-size:12px;">启用</span>'
        };

        return '<tr style="border-bottom:1px solid #e8e8e8;">' +
            '<td style="padding:12px;">' + App.escapeHtml(m.name) + '</td>' +
            '<td style="padding:12px;">' + App.escapeHtml(m.code || '') + '</td>' +
            '<td style="padding:12px;">' + App.escapeHtml(m.categoryName || '') + '</td>' +
            '<td style="padding:12px;">' + App.escapeHtml(m.protocolType || '') + '</td>' +
            '<td style="padding:12px;">' + App.escapeHtml(m.manufacturer || '') + '</td>' +
            '<td style="padding:12px;">' + (statusMap[m.status] || m.status) + '</td>' +
            '<td style="padding:12px;">' +
            '<button class="btn-edit" data-id="' + m.id + '" data-item=\'' + App.escapeHtml(JSON.stringify(m)) + '\' style="padding:4px 12px;border:1px solid #d9d9d9;border-radius:4px;background:#fff;cursor:pointer;font-size:12px;margin-right:6px;">编辑</button>' +
            '<button class="btn-del" data-id="' + m.id + '" style="padding:4px 12px;border:none;border-radius:4px;background:#ff4d4f;color:#fff;cursor:pointer;font-size:12px;">删除</button>' +
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
                App.confirm('确定要删除该型号吗？', async () => {
                    try {
                        await API.del('/device-models/' + id);
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
        const title = isEdit ? '编辑型号' : '新建型号';
        const m = item || {};

        const fieldStyle = 'width:100%;padding:8px 12px;border:1px solid #d9d9d9;border-radius:4px;font-size:14px;box-sizing:border-box;';
        const labelStyle = 'display:block;margin-bottom:6px;font-size:14px;color:#333;font-weight:500;';
        const rowStyle = 'margin-bottom:16px;';

        const flatCats = [];
        this.flattenCategories(this.categories, 0, flatCats);
        const catOptions = flatCats.map(c =>
            '<option value="' + c.id + '"' + (m.categoryId === c.id ? ' selected' : '') + '>' +
            '\u00A0'.repeat(c.depth * 4) + App.escapeHtml(c.name) + '</option>'
        ).join('');

        const formHtml = '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">名称</label>' +
            '<input id="form-name" type="text" value="' + App.escapeHtml(m.name || '') + '" style="' + fieldStyle + '" placeholder="请输入型号名称" />' +
            '</div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">编码</label>' +
            '<input id="form-code" type="text" value="' + App.escapeHtml(m.code || '') + '" style="' + fieldStyle + '" placeholder="请输入型号编码" />' +
            '</div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">分类</label>' +
            '<select id="form-categoryId" style="' + fieldStyle + '">' +
            '<option value="">请选择</option>' + catOptions +
            '</select></div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">协议类型</label>' +
            '<select id="form-protocolType" style="' + fieldStyle + '">' +
            '<option value="MQTT"' + (m.protocolType === 'MQTT' ? ' selected' : '') + '>MQTT</option>' +
            '<option value="HTTP"' + (m.protocolType === 'HTTP' ? ' selected' : '') + '>HTTP</option>' +
            '</select></div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">厂商</label>' +
            '<input id="form-manufacturer" type="text" value="' + App.escapeHtml(m.manufacturer || '') + '" style="' + fieldStyle + '" placeholder="请输入厂商名称" />' +
            '</div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">规格参数 (JSON)</label>' +
            '<textarea id="form-specsJson" rows="4" style="' + fieldStyle + 'resize:vertical;font-family:monospace;" placeholder=\'{"key":"value"}\'>' + App.escapeHtml(typeof m.specsJson === 'string' ? m.specsJson : JSON.stringify(m.specsJson || '', null, 2)) + '</textarea>' +
            '</div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">描述</label>' +
            '<textarea id="form-description" rows="2" style="' + fieldStyle + 'resize:vertical;" placeholder="请输入描述">' + App.escapeHtml(m.description || '') + '</textarea>' +
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
                categoryId: parseInt(document.getElementById('form-categoryId').value) || null,
                protocolType: document.getElementById('form-protocolType').value,
                manufacturer: document.getElementById('form-manufacturer').value.trim(),
                specsJson: document.getElementById('form-specsJson').value.trim(),
                description: document.getElementById('form-description').value.trim()
            };

            try {
                if (isEdit) {
                    await API.put('/device-models/' + item.id, data);
                    App.showToast('更新成功', 'success');
                } else {
                    await API.post('/device-models', data);
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
