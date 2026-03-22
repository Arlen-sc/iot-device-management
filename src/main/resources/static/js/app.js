const Pages = {};

const Router = {
    routes: {
        '/tasks': 'tasks',
        '/devices': 'devices',
        '/categories': 'categories',
        '/models': 'models',
        '/operations': 'operations',
        '/alerts': 'alerts',
        '/data-bridges': 'dataBridges',
        '/data-sources': 'dataSources',
    },

    init() {
        window.addEventListener('hashchange', () => this.navigate());
        this.navigate();
    },

    navigate() {
        const hash = location.hash.slice(1) || '/tasks';
        const container = document.getElementById('app');
        if (!container) return;

        // Check for designer route with id parameter
        const designerMatch = hash.match(/^\/designer\/(\d+)$/);
        if (designerMatch) {
            this.highlightNav(null);
            if (Pages.designer && typeof Pages.designer.render === 'function') {
                Pages.designer.render(container, designerMatch[1]);
            }
            return;
        }

        const pageName = this.routes[hash];
        if (pageName && Pages[pageName] && typeof Pages[pageName].render === 'function') {
            this.highlightNav(hash);
            Pages[pageName].render(container);
        } else {
            // Default to tasks
            location.hash = '#/tasks';
        }
    },

    highlightNav(activeHash) {
        document.querySelectorAll('.nav-link[data-route]').forEach(link => {
            if (link.getAttribute('data-route') === activeHash) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }
};

const App = {
    showToast(message, type) {
        type = type || 'info';
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
            document.body.appendChild(toastContainer);
        }

        const colorMap = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };
        const bgColor = colorMap[type] || colorMap.info;

        const toast = document.createElement('div');
        toast.style.cssText = 'padding:12px 24px;border-radius:6px;color:#fff;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.15);opacity:0;transition:opacity 0.3s;max-width:400px;word-break:break-word;';
        toast.style.backgroundColor = bgColor;
        toast.textContent = message;

        toastContainer.appendChild(toast);
        requestAnimationFrame(() => { toast.style.opacity = '1'; });

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        }, 3000);
    },

    showModal(title, bodyHtml, onConfirm, options = {}) {
        let overlay = document.getElementById('modal-overlay');
        if (overlay) overlay.remove();

        overlay = document.createElement('div');
        overlay.id = 'modal-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:5000;';

        const modal = document.createElement('div');
        const defaultWidth = options.width || '560px';
        const defaultMaxWidth = options.maxWidth || '90vw';
        modal.style.cssText = `background:#fff;border-radius:8px;width:${defaultWidth};max-width:${defaultMaxWidth};max-height:85vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.2);position:relative;transition:all 0.3s ease;`;

        const header = document.createElement('div');
        header.style.cssText = 'padding:16px 24px;border-bottom:1px solid #e8e8e8;display:flex;align-items:center;justify-content:space-between;cursor:move;user-select:none;';
        
        let headerContent = `<span style="font-size:16px;font-weight:600;">${App.escapeHtml(title)}</span>`;
        headerContent += '<div style="display:flex;gap:12px;align-items:center;">';
        if (options.fullscreenable !== false) {
            headerContent += '<button id="modal-fullscreen-btn" style="border:none;background:none;font-size:14px;cursor:pointer;color:#666;padding:0;line-height:1;" title="全屏/还原">⛶</button>';
        }
        headerContent += '<button id="modal-close-btn" style="border:none;background:none;font-size:20px;cursor:pointer;color:#999;padding:0;line-height:1;">&times;</button>';
        headerContent += '</div>';
        header.innerHTML = headerContent;

        const body = document.createElement('div');
        body.style.cssText = 'padding:24px;overflow-y:auto;flex:1;display:flex;flex-direction:column;';
        body.innerHTML = bodyHtml;

        const footer = document.createElement('div');
        footer.style.cssText = 'padding:12px 24px;border-top:1px solid #e8e8e8;display:flex;justify-content:flex-end;gap:12px;';
        footer.innerHTML = '<button id="modal-cancel-btn" style="padding:8px 20px;border:1px solid #d9d9d9;border-radius:4px;background:#fff;cursor:pointer;font-size:14px;">取消</button>' +
            '<button id="modal-confirm-btn" style="padding:8px 20px;border:none;border-radius:4px;background:#1890ff;color:#fff;cursor:pointer;font-size:14px;">确定</button>';

        modal.appendChild(header);
        modal.appendChild(body);
        modal.appendChild(footer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Drag functionality
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;
        
        header.addEventListener('mousedown', (e) => {
            if (e.target.tagName.toLowerCase() === 'button') return;
            isDragging = true;
            
            // Get current transform or default to 0
            const style = window.getComputedStyle(modal);
            const matrix = new DOMMatrixReadOnly(style.transform);
            initialLeft = matrix.m41;
            initialTop = matrix.m42;
            
            startX = e.clientX;
            startY = e.clientY;
            
            modal.style.transition = 'none'; // Disable transition while dragging
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            modal.style.transform = `translate(${initialLeft + dx}px, ${initialTop + dy}px)`;
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                modal.style.transition = 'all 0.3s ease';
            }
        });

        // Fullscreen functionality
        let isFullscreen = false;
        let preFullscreenCss = '';
        let preTransform = '';
        const fsBtn = document.getElementById('modal-fullscreen-btn');
        if (fsBtn) {
            fsBtn.addEventListener('click', () => {
                if (!isFullscreen) {
                    preFullscreenCss = modal.style.cssText;
                    preTransform = modal.style.transform;
                    modal.style.cssText = `background:#fff;width:100vw;height:100vh;max-width:none;max-height:none;display:flex;flex-direction:column;position:fixed;top:0;left:0;border-radius:0;z-index:5001;transform:none;transition:all 0.3s ease;`;
                } else {
                    modal.style.cssText = preFullscreenCss;
                    modal.style.transform = preTransform;
                }
                isFullscreen = !isFullscreen;
            });
        }

        document.getElementById('modal-close-btn').addEventListener('click', () => App.hideModal());
        document.getElementById('modal-cancel-btn').addEventListener('click', () => App.hideModal());
        document.getElementById('modal-confirm-btn').addEventListener('click', () => {
            if (typeof onConfirm === 'function') onConfirm();
        });
        overlay.addEventListener('mousedown', (e) => {
            if (e.target === overlay) App.hideModal();
        });
    },

    hideModal() {
        const overlay = document.getElementById('modal-overlay');
        if (overlay) overlay.remove();
    },

    escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },

    confirm(message, onOk) {
        App.showModal('确认', '<p style="font-size:14px;">' + App.escapeHtml(message) + '</p>', onOk);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (!location.hash) {
        location.hash = '#/tasks';
    }
    Router.init();
});
