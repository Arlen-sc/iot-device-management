Pages.dataSources = {
    async render(container) {
        container.innerHTML = '<div style="padding:24px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
            '<h2 style="margin:0;font-size:20px;">数据源管理</h2>' +
            '<button id="btn-add-data-source" style="padding:8px 20px;border:none;border-radius:4px;background:#1890ff;color:#fff;cursor:pointer;font-size:14px;">新建数据源</button>' +
            '</div>' +
            '<table style="width:100%;border-collapse:collapse;font-size:14px;">' +
            '<thead><tr style="background:#fafafa;">' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">名称</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">类型</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">连接URL</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">用户名</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">状态</th>' +
            '<th style="padding:12px;text-align:left;border-bottom:2px solid #e8e8e8;">操作</th>' +
            '</tr></thead>' +
            '<tbody id="data-source-tbody"></tbody>' +
            '</table></div>';

        this.loadData();
        document.getElementById('btn-add-data-source').addEventListener('click', () => this.showForm());
    },

    async loadData() {
        try {
            const dataSources = await API.get('/data-sources');
            const tbody = document.getElementById('data-source-tbody');
            if (!tbody) return;
            if (!dataSources || dataSources.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="padding:24px;text-align:center;color:#999;">暂无数据</td></tr>';
                return;
            }
            tbody.innerHTML = dataSources.map(d => this.renderRow(d)).join('');
            this.bindRowEvents(tbody);
        } catch (e) {
            App.showToast('加载数据源列表失败: ' + e.message, 'error');
        }
    },

    renderRow(d) {
        const statusMap = {
            0: '<span style="padding:2px 8px;border-radius:10px;background:#d9d9d9;color:#595959;font-size:12px;">禁用</span>',
            1: '<span style="padding:2px 8px;border-radius:10px;background:#f6ffed;color:#52c41a;font-size:12px;">启用</span>'
        };

        const typeMap = {
            'sqlserver2008': 'SQL Server 2008',
            'sqlserver2008plus': 'SQL Server 2008+',
            'mysql': 'MySQL',
            'sqlite': 'SQLite',
            'oracle': 'Oracle',
            'pg': 'PostgreSQL'
        };

        return '<tr style="border-bottom:1px solid #e8e8e8;">' +
            '<td style="padding:12px;">' + App.escapeHtml(d.name) + '</td>' +
            '<td style="padding:12px;">' + App.escapeHtml(typeMap[d.type] || d.type) + '</td>' +
            '<td style="padding:12px;">' + App.escapeHtml(d.url) + '</td>' +
            '<td style="padding:12px;">' + App.escapeHtml(d.username) + '</td>' +
            '<td style="padding:12px;">' + (statusMap[d.status] || d.status) + '</td>' +
            '<td style="padding:12px;">' +
            '<button class="btn-test" data-id="' + d.id + '" data-item=' + App.escapeHtml(JSON.stringify(d)) + ' style="padding:4px 12px;border:1px solid #52c41a;border-radius:4px;background:#f6ffed;color:#52c41a;cursor:pointer;font-size:12px;margin-right:6px;">测试连接</button>' +
            '<button class="btn-edit" data-id="' + d.id + '" data-item=' + App.escapeHtml(JSON.stringify(d)) + ' style="padding:4px 12px;border:1px solid #d9d9d9;border-radius:4px;background:#fff;cursor:pointer;font-size:12px;margin-right:6px;">编辑</button>' +
            '<button class="btn-del" data-id="' + d.id + '" style="padding:4px 12px;border:none;border-radius:4px;background:#ff4d4f;color:#fff;cursor:pointer;font-size:12px;">删除</button>' +
            '</td></tr>';
    },

    bindRowEvents(tbody) {
        tbody.addEventListener('click', async (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const id = btn.dataset.id;

            if (btn.classList.contains('btn-test')) {
                try {
                    const item = JSON.parse(btn.dataset.item);
                    this.testConnection(item);
                } catch (err) {
                    App.showToast('解析数据失败', 'error');
                }
            } else if (btn.classList.contains('btn-edit')) {
                try {
                    const item = JSON.parse(btn.dataset.item);
                    this.showForm(item);
                } catch (err) {
                    App.showToast('解析数据失败', 'error');
                }
            } else if (btn.classList.contains('btn-del')) {
                App.confirm('确定要删除该数据源吗？', async () => {
                    try {
                        await API.del('/data-sources/' + id);
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

    async testConnection(dataSource) {
        try {
            // App.showLoading('正在测试连接...');
            const result = await API.post('/data-sources/test-connection', dataSource);
            // App.hideLoading();
            if (result) {
                App.showToast('连接成功', 'success');
            } else {
                App.showToast('连接失败', 'error');
            }
        } catch (err) {
            // App.hideLoading();
            App.showToast('测试连接失败: ' + err.message, 'error');
        }
    },

    showForm(item) {
        const isEdit = !!item;
        const title = isEdit ? '编辑数据源' : '新建数据源';
        const d = item || {};

        const fieldStyle = 'width:100%;padding:8px 12px;border:1px solid #d9d9d9;border-radius:4px;font-size:14px;box-sizing:border-box;';
        const labelStyle = 'display:block;margin-bottom:6px;font-size:14px;color:#333;font-weight:500;';
        const rowStyle = 'margin-bottom:16px;';

        const typeOptions = [
            { value: 'sqlserver2008', label: 'SQL Server 2008' },
            { value: 'sqlserver2008plus', label: 'SQL Server 2008+' },
            { value: 'mysql', label: 'MySQL' },
            { value: 'sqlite', label: 'SQLite' },
            { value: 'oracle', label: 'Oracle' },
            { value: 'pg', label: 'PostgreSQL' }
        ].map(opt =>
            '<option value="' + opt.value + '"' + (d.type === opt.value ? ' selected' : '') + '>' + App.escapeHtml(opt.label) + '</option>'
        ).join('');

        const formHtml = '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">名称</label>' +
            '<input id="form-name" type="text" value="' + App.escapeHtml(d.name || '') + '" style="' + fieldStyle + '" placeholder="请输入数据源名称" />' +
            '</div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">数据库类型</label>' +
            '<select id="form-type" style="' + fieldStyle + '">' +
            '<option value="">请选择</option>' + typeOptions +
            '</select></div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">连接URL</label>' +
            '<input id="form-url" type="text" value="' + App.escapeHtml(d.url || '') + '" style="' + fieldStyle + '" placeholder="请输入连接URL" />' +
            '</div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">用户名</label>' +
            '<input id="form-username" type="text" value="' + App.escapeHtml(d.username || '') + '" style="' + fieldStyle + '" placeholder="请输入用户名" />' +
            '</div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">密码</label>' +
            '<input id="form-password" type="password" value="' + App.escapeHtml(d.password || '') + '" style="' + fieldStyle + '" placeholder="请输入密码" />' +
            '</div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">驱动类名</label>' +
            '<input id="form-driverClass" type="text" value="' + App.escapeHtml(d.driverClass || '') + '" style="' + fieldStyle + '" placeholder="请输入驱动类名" />' +
            '</div>' +
            '<div style="' + rowStyle + '">' +
            '<label style="' + labelStyle + '">状态</label>' +
            '<select id="form-status" style="' + fieldStyle + '">' +
            '<option value="0"' + (d.status === 0 ? ' selected' : '') + '>禁用</option>' +
            '<option value="1"' + (d.status === 1 ? ' selected' : '') + '>启用</option>' +
            '</select></div>' +
            '<div style="' + rowStyle + '">' +
            '<button id="btn-test-connection" style="padding:8px 20px;border:1px solid #52c41a;border-radius:4px;background:#f6ffed;color:#52c41a;cursor:pointer;font-size:14px;">测试连接</button>' +
            '</div>';

        App.showModal(title, formHtml, async () => {
            const name = document.getElementById('form-name').value.trim();
            const type = document.getElementById('form-type').value;
            const url = document.getElementById('form-url').value.trim();
            if (!name || !type || !url) {
                App.showToast('请填写名称、类型和连接URL', 'warning');
                return;
            }

            const data = {
                name,
                type,
                url,
                username: document.getElementById('form-username').value.trim(),
                password: document.getElementById('form-password').value,
                driverClass: document.getElementById('form-driverClass').value.trim(),
                status: parseInt(document.getElementById('form-status').value)
            };

            try {
                if (isEdit) {
                    await API.put('/data-sources/' + item.id, data);
                    App.showToast('更新成功', 'success');
                } else {
                    await API.post('/data-sources', data);
                    App.showToast('创建成功', 'success');
                }
                App.hideModal();
                this.loadData();
            } catch (err) {
                App.showToast('操作失败: ' + err.message, 'error');
            }
        });

        // 绑定类型选择事件，自动填充默认驱动和URL
        document.getElementById('form-type').addEventListener('change', async (e) => {
            const type = e.target.value;
            if (!type) return;

            try {
                const driverClass = await API.get('/data-sources/default-driver/' + type);
                const urlTemplate = await API.get('/data-sources/default-url/' + type);
                
                if (driverClass) {
                    document.getElementById('form-driverClass').value = driverClass;
                }
                if (urlTemplate && !d.url) {
                    document.getElementById('form-url').value = urlTemplate;
                }
            } catch (err) {
                console.error('获取默认配置失败:', err);
            }
        });

        // 绑定测试连接按钮事件
        document.getElementById('btn-test-connection').addEventListener('click', async () => {
            const name = document.getElementById('form-name').value.trim();
            const type = document.getElementById('form-type').value;
            const url = document.getElementById('form-url').value.trim();
            const username = document.getElementById('form-username').value.trim();
            const password = document.getElementById('form-password').value;
            const driverClass = document.getElementById('form-driverClass').value.trim();

            if (!type || !url || !driverClass) {
                App.showToast('请填写完整的连接信息', 'warning');
                return;
            }

            const testData = {
                name,
                type,
                url,
                username,
                password,
                driverClass
            };

            this.testConnection(testData);
        });
    }
};
