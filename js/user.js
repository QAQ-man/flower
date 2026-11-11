// ==========================================
// 全局：侧边栏用户信息 + 权限控制 + 退出登录 + 导航高亮
// ==========================================

const CURRENT_USER_ID = parseInt(localStorage.getItem('userId')) || 1;

// 原生 GET 请求封装 (如果你的项目中已经使用了 request.js 中的 get，可以保留，直接删掉这个函数)
async function get(url) {
    const res = await fetch('http://localhost:8080' + url);
    if (!res.ok) throw new Error('Network response was not ok');
    const data = await res.json();
    if (data.code !== 200) throw new Error(data.msg || 'API Error');
    return data.data;
}

/**
 * 加载侧边栏用户信息（姓名 + 角色）
 */
async function loadSidebarUser() {
    const sideAvatar = document.getElementById('sideAvatar');
    const sideRealName = document.getElementById('sideRealName');
    const sideRoleName = document.getElementById('sideRoleName');

    if (!sideAvatar || !sideRealName || !sideRoleName) return;

    try {
        const realName = localStorage.getItem('realName') || '未登录';
        const roleId = localStorage.getItem('roleId');

        sideAvatar.textContent = realName.charAt(0);
        sideRealName.textContent = realName;

        if (roleId) {
            // 1. 先用本地字典兜底显示（防网络慢）
            const roleNames = { '1': '超级管理员', '2': '门店管理员', '3': '客服' };
            sideRoleName.textContent = roleNames[roleId] || '未知角色';

            // 2. 异步请求后端获取最准确的角色名
            try {
                const roleData = await get('/api/sysRole/' + roleId);
                if (roleData && roleData.roleName) {
                    sideRoleName.textContent = roleData.roleName;
                }
            } catch (e) {
                console.warn('获取角色名失败，使用本地兜底:', e);
            }
        } else {
            sideRoleName.textContent = '未分配角色';
        }
    } catch (error) {
        console.error('加载侧边栏用户信息失败:', error);
    }
}

/**
 * 统一处理左侧菜单：权限控制 + 当前页高亮
 */
async function initNavAndPermissions() {
    const roleId = localStorage.getItem('roleId');
    const currentPage = window.location.pathname.substring(
        window.location.pathname.lastIndexOf('/') + 1
    ) || 'dashboard.html';

    // ===== 1. 查询权限 =====
    let permKeys = [];

    // 1.1 系统管理员兜底：直接赋予所有权限，不走接口
    if (roleId === '1') {
        permKeys = [
            'dashboard:view', 'order:view', 'goods:view', 'member:view',
            'settings:view', 'shop:view',
            'account:view', 'role:view', 'notify:view', 'log:view'
        ];
    } 
    // 1.2 其他角色：必须强制去后端拉取最新权限
    else if (roleId) {
        try {
            const res = await get('/api/sysRolePermission/permKeys/' + roleId);
            if (Array.isArray(res)) {
                permKeys = res;
                // 更新本地缓存
                localStorage.setItem('permKeys_' + roleId, JSON.stringify(permKeys));
            } else {
                throw new Error("后端返回的权限格式不是数组");
            }
        } catch (e) {
            console.warn('拉取最新权限失败，降级使用旧缓存:', e);
            const cached = localStorage.getItem('permKeys_' + roleId);
            if (cached) {
                try { permKeys = JSON.parse(cached); } catch (err) { permKeys = []; }
            }
        }
    }

    // ===== 2. 渲染左侧一级菜单 =====
    const ACTIVE_CLASS = ['bg-[#c8102e]/15', 'text-white', 'ring-1', 'ring-inset', 'ring-[#c8102e]/30'];
    const DEFAULT_CLASS = ['text-white/55', 'hover:text-white', 'hover:bg-white/[0.05]'];

    document.querySelectorAll('aside nav a[data-perm]').forEach(link => {
        const href = link.getAttribute('href') || '';
        const linkPage = href.split('?')[0].split('#')[0];
        const requiredPerm = link.dataset.perm;

        // ⭐ 核心拦截：超级管理员直接放行，其他人必须鉴权。没权限直接隐藏！
        const hasPerm = roleId === '1' || (requiredPerm && permKeys.includes(requiredPerm));
        
        if (!hasPerm) {
            link.style.display = 'none';
            return;
        } else {
            link.style.display = 'flex'; // 恢复显示
        }

        // 高亮判断
        const isActive = linkPage === currentPage;
        if (isActive) {
            link.classList.remove(...DEFAULT_CLASS);
            link.classList.add(...ACTIVE_CLASS);
            const icon = link.querySelector('iconify-icon');
            if (icon) {
                icon.classList.remove('text-white/70');
                icon.classList.add('text-[#e6a6b0]');
            }
        } else {
            link.classList.remove(...ACTIVE_CLASS);
            link.classList.add(...DEFAULT_CLASS);
            const icon = link.querySelector('iconify-icon');
            if (icon) {
                icon.classList.remove('text-[#e6a6b0]');
                icon.classList.add('text-white/70');
            }
        }

        // 加 .nav-ready 让菜单最终显示出来
        link.classList.add('nav-ready');
    });

    // ===== 3. 处理右侧二级菜单（`.stab`） =====
    const PANE_PERMS = {
        account: 'account:view',
        role:    'role:view',
        notify:  'notify:view',
        log:     'log:view'
    };
    document.querySelectorAll('.stab').forEach(btn => {
        const requiredPerm = PANE_PERMS[btn.dataset.pane];
        const hasPerm = roleId === '1' || (requiredPerm && permKeys.includes(requiredPerm));
        btn.style.display = hasPerm ? '' : 'none';
    });

    // ===== 4. 自动切到有权限的第一个面板 =====
    const currentActive = document.querySelector('.stab.bg-\\[\\#c8102e\\]\\/15');
    if (currentActive && currentActive.style.display !== 'none') {
        return permKeys;
    }
    const firstVisible = document.querySelector('.stab:not([style*="display: none"])');
    if (firstVisible && typeof switchPane === 'function') {
        switchPane(firstVisible.dataset.pane);
    }

    return permKeys;
}

/**
 * 退出登录
 */
function logout() {
    if (confirm('确定要退出登录吗？')) {
        localStorage.clear();
        window.location.href = 'login.html';
    }
}

// ==========================================
// 页面加载时自动执行
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initNavAndPermissions();
    } catch (e) {
        console.error('initNavAndPermissions 出错，兜底显示所有菜单:', e);
        document.querySelectorAll('aside nav a[data-perm]').forEach(link => {
            link.classList.add('nav-ready');
        });
    }
    loadSidebarUser();
});

// ==========================================
// 用户切回页面时，重新检查权限（应对多开标签页情况）
// ==========================================
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        initNavAndPermissions().catch(e => console.error(e));
    }
});

/* ================= 全局通用：自动加载侧边栏花材预警 ================= */
document.addEventListener('DOMContentLoaded', async function() {
    const warnEl = document.getElementById('flowerWarnText');
    if (!warnEl) return; 

    try {
        const res = await get('/api/dashboard/getData');
        if (res.warnFlower) {
            const wf = res.warnFlower;
            if (!wf.flower_name) {
                warnEl.textContent = '暂无库存预警';
                return;
            }
            warnEl.innerHTML = `<span class="text-white/80">${wf.flower_name}</span> 库存仅剩 
                <span class="text-[#e6a6b0]">${wf.stock_num}</span> 支（安全水位 
                <span class="text-white/60">${wf.safe_water}</span> 支）。`;
        } else {
            warnEl.textContent = '暂无库存预警';
        }
    } catch (e) {
        console.error('加载预警失败:', e);
        warnEl.textContent = '获取预警失败，请检查网络';
    }
});
