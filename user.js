// ==========================================
// 全局：侧边栏用户信息 + 权限控制 + 退出登录 + 导航高亮
// ==========================================

const CURRENT_USER_ID = parseInt(localStorage.getItem('userId')) || 1;

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
            const roleData = await get('/api/sysRole/' + roleId);
            sideRoleName.textContent = roleData.roleName;
        } else {
            sideRoleName.textContent = '未分配角色';
        }
    } catch (error) {
        console.error('加载侧边栏用户信息失败:', error);
        sideRoleName.textContent = '加载失败';
    }
}

/**
 * 统一处理左侧菜单：权限控制 + 当前页高亮
 * 【关键】所有请求都包了 try/catch，确保菜单一定会显示
 */
async function initNavAndPermissions() {
    const roleId = localStorage.getItem('roleId');
    const currentPage = window.location.pathname.substring(
        window.location.pathname.lastIndexOf('/') + 1
    ) || 'dashboard.html';

    // ===== 1. 查询权限（带容错） =====
    let permKeys = [];

    // 1.1 优先使用缓存
    if (roleId) {
        try {
            const cached = localStorage.getItem('permKeys_' + roleId);
            if (cached) permKeys = JSON.parse(cached);
        } catch (e) {
            permKeys = [];
        }
    }

    // 1.2 系统管理员兜底：全部权限
    if (roleId === '1') {
        permKeys = [
            'dashboard:view', 'order:view', 'goods:view', 'member:view',
            'settings:view', 'shop:view',
            'account:view', 'role:view', 'notify:view', 'log:view'
        ];
    }

    // 1.3 异步拉取最新权限（失败不影响菜单显示）
    if (roleId && roleId !== '1') {
        try {
            permKeys = await get('/api/sysRolePermission/permKeys/' + roleId);
            localStorage.setItem('permKeys_' + roleId, JSON.stringify(permKeys));
        } catch (e) {
            console.warn('拉取最新权限失败，使用缓存或空权限:', e);
        }
    }

    // ===== 2. 渲染左侧一级菜单（无论权限查没查到，都要显示出来） =====
    const ACTIVE_CLASS = ['bg-[#c8102e]/15', 'text-white', 'ring-1', 'ring-inset', 'ring-[#c8102e]/30'];
    const DEFAULT_CLASS = ['text-white/55', 'hover:text-white', 'hover:bg-white/[0.05]'];

    document.querySelectorAll('aside nav a[data-perm]').forEach(link => {
        const href = link.getAttribute('href') || '';
        const linkPage = href.split('?')[0].split('#')[0];
        const requiredPerm = link.dataset.perm;

        // 2.1 权限判断（如果 permKeys 是空的，就不隐藏，防止菜单全消失）
        if (requiredPerm && permKeys.length > 0 && !permKeys.includes(requiredPerm)) {
            link.style.display = 'none';
            link.classList.add('nav-ready');
            return;
        }

        // 2.2 高亮判断
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

        // 2.3 ⭐ 关键：无论如何都加 .nav-ready，让菜单显示出来
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
        if (requiredPerm && permKeys.length > 0 && !permKeys.includes(requiredPerm)) {
            btn.style.display = 'none';
        } else {
            btn.style.display = '';
        }
    });

    // ===== 4. 只在「当前激活的二级面板无权限」时才切换 =====
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
// 页面加载时自动执行（只注册一次！）
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initNavAndPermissions();
    } catch (e) {
        console.error('initNavAndPermissions 出错，兜底显示所有菜单:', e);
        // ⭐ 极端兜底：如果初始化失败，直接显示所有菜单
        document.querySelectorAll('aside nav a[data-perm]').forEach(link => {
            link.classList.add('nav-ready');
        });
    }
    loadSidebarUser();
});

// ==========================================
// 用户切回页面时，重新检查权限
// ==========================================
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        initNavAndPermissions().catch(e => console.error(e));
    }
});

/* ================= 全局通用：自动加载侧边栏花材预警 ================= */
document.addEventListener('DOMContentLoaded', async function() {
    const warnEl = document.getElementById('flowerWarnText');
    if (!warnEl) return; // 如果当前页面没有侧边栏预警卡片，直接退出

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

    // 可选：自动高亮当前所在的左侧菜单
    const path = window.location.pathname;
    const page = path.substring(path.lastIndexOf('/') + 1) || 'dashboard.html';
    document.querySelectorAll('aside nav a').forEach(a => {
        if (a.getAttribute('href') === page) {
            a.classList.add('bg-white/[0.05]', 'text-white');
            a.classList.remove('text-white/55');
        }
    });
});
