const DebugConsole = {
    show: function(taskId) {
        var html = '<div style="display:flex;flex-direction:column;gap:16px;height:60vh;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;background:#fafafa;padding:12px;border-radius:4px;border:1px solid #e8e8e8;">' +
            '  <span style="font-size:14px;font-weight:bold;color:#333;">流程调试控制台</span>' +
            '  <button id="btn-run-debug" style="padding:6px 16px;background:#52c41a;color:#fff;border:none;border-radius:4px;cursor:pointer;">开始运行</button>' +
            '</div>' +
            '<div style="display:flex;gap:16px;flex:1;min-height:0;">' +
            '  <div style="flex:2;display:flex;flex-direction:column;border:1px solid #e8e8e8;border-radius:4px;">' +
            '    <div style="padding:8px;background:#f5f5f5;border-bottom:1px solid #e8e8e8;font-weight:bold;font-size:13px;">运行过程 (日志)</div>' +
            '    <div id="debug-logs" style="flex:1;overflow-y:auto;padding:12px;background:#1e1e1e;color:#a0e8af;font-family:monospace;font-size:13px;line-height:1.6;">' +
            '      <div style="color:#666;">等待运行...</div>' +
            '    </div>' +
            '  </div>' +
            '  <div style="flex:1;display:flex;flex-direction:column;border:1px solid #e8e8e8;border-radius:4px;">' +
            '    <div style="padding:8px;background:#f5f5f5;border-bottom:1px solid #e8e8e8;font-weight:bold;font-size:13px;">变量状态</div>' +
            '    <div id="debug-vars" style="flex:1;overflow-y:auto;padding:12px;font-family:monospace;font-size:13px;background:#fff;">' +
            '      <div style="color:#999;">暂无数据</div>' +
            '    </div>' +
            '  </div>' +
            '</div>' +
            '</div>';

        var overlay = document.getElementById('debug-modal-overlay');
        if (overlay) overlay.remove();

        overlay = document.createElement('div');
        overlay.id = 'debug-modal-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:5000;';

        var modal = document.createElement('div');
        modal.style.cssText = 'background:#fff;border-radius:8px;width:900px;max-width:95vw;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.2);';

        var header = document.createElement('div');
        header.style.cssText = 'padding:16px 24px;border-bottom:1px solid #e8e8e8;display:flex;align-items:center;justify-content:space-between;';
        header.innerHTML = '<h3 style="margin:0;font-size:18px;">调试界面</h3><button id="debug-close-btn" style="border:none;background:none;font-size:20px;cursor:pointer;color:#999;padding:0;line-height:1;">&times;</button>';

        var body = document.createElement('div');
        body.style.cssText = 'padding:24px;';
        body.innerHTML = html;

        modal.appendChild(header);
        modal.appendChild(body);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        var closeModal = function() { overlay.remove(); };
        document.getElementById('debug-close-btn').addEventListener('click', closeModal);
        overlay.addEventListener('click', function(e) { if (e.target === overlay) closeModal(); });

        document.getElementById('btn-run-debug').addEventListener('click', async function() {
            var btn = this;
            var logsEl = document.getElementById('debug-logs');
            var varsEl = document.getElementById('debug-vars');
            
            btn.disabled = true;
            btn.textContent = '运行中...';
            btn.style.background = '#d9d9d9';
            logsEl.innerHTML = '<div style="color:#1890ff;">[SYSTEM] 开始执行流程...</div>';
            varsEl.innerHTML = '<div style="color:#999;">运行中...</div>';

            try {
                const result = await API.post('/task-flow-configs/' + taskId + '/execute');
                
                // Render Logs
                var logs = result.logs || [];
                if (logs.length === 0) {
                    logsEl.innerHTML += '<div style="color:#999;">[SYSTEM] 无日志输出</div>';
                } else {
                    var logsHtml = '';
                    logs.forEach((logText) => {
                        var logColor = '#a0e8af';
                        var escaped = App.escapeHtml(logText);
                        if (escaped.indexOf('ERROR') >= 0 || escaped.indexOf('error') >= 0 || escaped.indexOf('fail') >= 0 || escaped.indexOf('【节点执行异常】') >= 0 || escaped.indexOf('【节点执行失败】') >= 0) {
                            logColor = '#ff6b6b';
                        } else if (escaped.indexOf('WARN') >= 0 || escaped.indexOf('warn') >= 0 || escaped.indexOf('【节点执行警告】') >= 0) {
                            logColor = '#ffd93d';
                        } else if (escaped.indexOf('================') >= 0) {
                            logColor = '#1890ff';
                        } else if (escaped.indexOf('【流程流转】') >= 0) {
                            logColor = '#b37feb';
                        } else if (escaped.indexOf('【节点执行成功】') >= 0) {
                            logColor = '#52c41a';
                        }
                        
                        logsHtml += '<div style="color:' + logColor + ';margin-bottom:6px;word-break:break-all;border-bottom:1px dashed #333;padding-bottom:4px;">' + escaped + '</div>';
                    });
                    logsEl.innerHTML = logsHtml;
                }
                
                var statusColor = result.status === 'SUCCESS' ? '#52c41a' : '#ff4d4f';
                logsEl.innerHTML += '<div style="color:' + statusColor + ';margin-top:10px;font-weight:bold;">[SYSTEM] 执行结束，状态: ' + result.status + '</div>';

                // Render Variables
                var variables = result.variables || {};
                var varKeys = Object.keys(variables);
                if (varKeys.length === 0) {
                    varsEl.innerHTML = '<div style="color:#999;">无变量</div>';
                } else {
                    var varsHtml = '<table style="width:100%;border-collapse:collapse;font-size:12px;">';
                    varKeys.forEach(k => {
                        var val = variables[k];
                        var displayVal = (typeof val === 'object') ? JSON.stringify(val) : String(val);
                        varsHtml += '<tr style="border-bottom:1px solid #f0f0f0;">';
                        varsHtml += '<td style="padding:6px;color:#1890ff;word-break:break-all;width:40%;">' + App.escapeHtml(k) + '</td>';
                        varsHtml += '<td style="padding:6px;word-break:break-all;color:#333;">' + App.escapeHtml(displayVal) + '</td>';
                        varsHtml += '</tr>';
                    });
                    varsHtml += '</table>';
                    varsEl.innerHTML = varsHtml;
                }

            } catch (err) {
                logsEl.innerHTML += '<div style="color:#ff6b6b;margin-top:10px;">[SYSTEM] 执行异常: ' + App.escapeHtml(err.message) + '</div>';
                varsEl.innerHTML = '<div style="color:#ff4d4f;">执行失败</div>';
            } finally {
                btn.disabled = false;
                btn.textContent = '开始运行';
                btn.style.background = '#52c41a';
                if (window.Pages && window.Pages.tasks && typeof window.Pages.tasks.loadData === 'function') {
                    window.Pages.tasks.loadData();
                }
            }
        });
    }
};
