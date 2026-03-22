Pages.categories = {
    flatList: [],

    async render(container) {
        container.innerHTML = '<div style="padding:24px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
            '<h2 style="margin:0;font-size:20px;">设备分类</h2>' +
            '<button id="btn-add-category" style="padding:8px 20px;border:none;border-radius:4px;background:#1890ff;color:#fff;cursor:pointer;font-size:14px;">新建分类</button>' +
            '</div>' +
            '<table style="width:100%;border-collapse:collapse;font-size:14px;">' +
            '<thead><tr style="background:#fafafa;">' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">名称</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">编码</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">排序</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">状态</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">操作</th>' +
            '</tr></thead>' +
            '<tbody id="category-tbody"></tbody>' +
            '</table></div>';

        this.loadData();
        document.getElementById('btn-add-category').addEventListener('click', () => this.showForm());
    },

    async loadData() {
        try {
            const tree = await API.get('/device-categories/tree');
            const tbody = document.getElementById('category-tbody');
            if (!tbody) return;
            this.flatList = [];
            this.flattenTree(tree || [], 0);

            if (this.flatList.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="padding:24px;text-align:center;color:#999;">暂无数据</td></tr>';
                return;
            }
            tbody.innerHTML = this.flatList.map(item => this.renderRow(item.node, item.depth)).join('');
            this.bindRowEvents(tbody);
        } catch (e) {
            App.showToast('加载分类列表失败: ' + e.message, 'error');
        }
    },

    flattenTree(nodes, depth) {
        if (!nodes) return;
        nodes.forEach(node => {
            this.flatList.push({ node, depth });
            if (node.children && node.children.length > 0) {
                this.flattenTree(node.children, depth + 1);
            }
        });
    },

    renderRow(c, depth) {
        const statusMap = {
            0: '<span style="padding:2px 8px;border-radius:10px;background:#d9d9d9;color:#595959;font-size:12px;">禁用</span>',
            1: '<span style="padding:2px 8px;border-radius:10px;background:#f6ffed;color:#52c41a;font-size:12px;">启用</span>'
        };
        const indent = depth * 24;

        return '<tr style="border-bottom:1px solid #e8e8e8;">' +
            '<td style="padding:12px;padding-left:' + (12 + indent) + 'px;">' +
            (depth > 0 ? '<span style="color:#d9d9d9;margin-right:6px;">└</span>' : '') +
            App.escapeHtml(c.name) + '</td>' +
            '<td style="padding:12px;">' + App.escapeHtml(c.code || '') + '</td>' +
            '<td style="padding:12px;">' + (c.sortOrder !== undefined ? c.sortOrder : '') + '</td>' +
            '<td style="padding:12px;">' + (statusMap[c.status] || c.status) + '</td>' +
            '<td style="padding:12px;">' +
            '<button class="btn-edit" data-id="' + c.id + '" data-item=\'' + App.escapeHtml(JSON.stringify(c)) + '\' style="padding:4px 12px;border:1px solid #d9d9d9;border-radius:4px;background:#fff;cursor:pointer;font-size:12px;margin-right:6px;">编辑</button>' +
            '<button class="btn-del" data-id="' + c.id + '" style="padding:4px 12px;border:none;border-radius:4px;background:#ff4d4f;color:#fff;cursor:pointer;font-size:12px;">删除</button>' +
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
                App.confirm('确定要删除该分类吗？', async () => {
                    try {
                        await API.del('/device-categories/' + id);
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
        const title = isEdit ? '编辑分类' : '新建分类';
        const c = item || {};

        const fieldStyle = 'width:100%;padding:8px 12px;border:1px solid #d9d9d9;border-radius:4px;font-size:14px;box-sizing:border-box;';
        const labelStyle = 'display:block;margin-bottom:6px;font-size:14px;color:#333;font-weight:500;';
        const rowStyle = 'margin-bottom:16px;';

        const parentOptions = this.flatList.map(f =>
            '<option value="' + f.node.id + '"' + (c.parentId === f.node.id ? ' selected' : '') + '>' +
            '\u00A0'.repeat(f.depth * 4) + App.escapeHtml(f.node.name) + '</option>'
        ).join('');

        const formHtml = '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">名称</label>' +
            '<input id="form-name" type="text" value="' + App.escapeHtml(c.name || '') + '" style="' + fieldStyle + '" placeholder="请输入分类名称" />' +
            '</div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">编码</label>' +
            '<input id="form-code" type="text" value="' + App.escapeHtml(c.code || '') + '" style="' + fieldStyle + '" placeholder="请输入分类编码" />' +
            '</div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">上级分类</label>' +
            '<select id="form-parentId" style="' + fieldStyle + '">' +
            '<option value="0"' + (!c.parentId || c.parentId === 0 ? ' selected' : '') + '>无 (顶级分类)</option>' +
            parentOptions +
            '</select></div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">排序</label>' +
            '<input id="form-sortOrder" type="number" value="' + (c.sortOrder !== undefined ? c.sortOrder : 0) + '" style="' + fieldStyle + '" />' +
            '</div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">描述</label>' +
            '<textarea id="form-description" rows="3" style="' + fieldStyle + 'resize:vertical;" placeholder="请输入描述">' + App.escapeHtml(c.description || '') + '</textarea>' +
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
                parentId: parseInt(document.getElementById('form-parentId').value) || 0,
                sortOrder: parseInt(document.getElementById('form-sortOrder').value) || 0,
                description: document.getElementById('form-description').value.trim()
            };

            try {
                if (isEdit) {
                    await API.put('/device-categories/' + item.id, data);
                    App.showToast('更新成功', 'success');
                } else {
                    await API.post('/device-categories', data);
                    App.showToast('创建成功', 'success');
                }
                App.hideModal();
                this.loadData();
            } catch (err) {
                App.showToast('操作失败: ' + err.message, 'error');
            }
        }, { fullscreenable: true });
    }
};
