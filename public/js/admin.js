function esc(v) {
    return String(v == null ? '' : v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', () => {
    const authCard = document.getElementById('adminAuthCard');
    const panel = document.getElementById('adminPanel');
    const topbar = document.getElementById('adminTopbar');
    const hero = document.getElementById('adminHero');
    const tokenInput = document.getElementById('adminTokenInput');
    const loginBtn = document.getElementById('adminLoginBtn');
    const authMsg = document.getElementById('adminAuthMsg');
    const logoutBtn = document.getElementById('adminLogoutBtn');
    const sessionLine = document.getElementById('adminSessionLine');
    const sideNav = document.getElementById('adminSideNav');
    const lastRefreshEl = document.getElementById('adminLastRefresh');

    const kpisEl = document.getElementById('adminKpis');

    const createPlan = document.getElementById('createPlan');
    const createMonths = document.getElementById('createMonths');
    const createMonthsLabel = document.getElementById('createMonthsLabel');
    const createCustomDurationLabel = document.getElementById('createCustomDurationLabel');
    const createDurationValue = document.getElementById('createDurationValue');
    const createDurationUnit = document.getElementById('createDurationUnit');
    const createEmail = document.getElementById('createEmail');
    const createSpecsContainer = document.getElementById('createSpecsContainer');
    const createBtn = document.getElementById('createLicenseBtn');
    const createMsg = document.getElementById('createLicenseMsg');

    const configPriceInput = document.getElementById('configPriceInput');
    const updateConfigBtn = document.getElementById('updateConfigBtn');
    const updateConfigMsg = document.getElementById('updateConfigMsg');

    const ordersSearch = document.getElementById('ordersSearch');
    const ordersStatus = document.getElementById('ordersStatus');
    const refreshOrdersBtn = document.getElementById('refreshOrdersBtn');
    const ordersList = document.getElementById('ordersList');
    const exportOrdersBtn = document.getElementById('exportOrdersBtn');
    const ordersSelectVisibleBtn = document.getElementById('ordersSelectVisibleBtn');
    const bulkDeleteOrdersBtn = document.getElementById('bulkDeleteOrdersBtn');
    const ordersPrev = document.getElementById('ordersPrev');
    const ordersNext = document.getElementById('ordersNext');
    const ordersPageText = document.getElementById('ordersPageText');
    const ordersPageSize = document.getElementById('ordersPageSize');
    const ordersSort = document.getElementById('ordersSort');

    const licensesSearch = document.getElementById('licensesSearch');
    const licensesPlan = document.getElementById('licensesPlan');
    const licensesStatus = document.getElementById('licensesStatus');
    const refreshLicensesBtn = document.getElementById('refreshLicensesBtn');
    const licensesList = document.getElementById('licensesList');
    const exportLicensesBtn = document.getElementById('exportLicensesBtn');
    const licensesSelectVisibleBtn = document.getElementById('licensesSelectVisibleBtn');
    const bulkDeleteLicensesBtn = document.getElementById('bulkDeleteLicensesBtn');
    const licensesPrev = document.getElementById('licensesPrev');
    const licensesNext = document.getElementById('licensesNext');
    const licensesPageText = document.getElementById('licensesPageText');
    const licensesPageSize = document.getElementById('licensesPageSize');
    const licensesSort = document.getElementById('licensesSort');
    const refreshAuditBtn = document.getElementById('refreshAuditBtn');
    const clearAuditBtn = document.getElementById('clearAuditBtn');
    const auditLimit = document.getElementById('auditLimit');
    const auditTbody = document.querySelector('#auditTable tbody');
    const exportAuditBtn = document.getElementById('exportAuditBtn');
    const auditTable = document.getElementById('auditTable');
    const ordersCount = document.getElementById('ordersCount');
    const licensesCount = document.getElementById('licensesCount');
    const auditCount = document.getElementById('auditCount');
    const globalSearch = document.getElementById('adminGlobalSearch');
    const quickRefreshBtn = document.getElementById('adminQuickRefresh');
    const autoRefreshToggle = document.getElementById('adminAutoRefresh');
    const ordersSavedView = document.getElementById('ordersSavedView');
    const licensesSavedView = document.getElementById('licensesSavedView');
    const bulkExtendLicensesBtn = document.getElementById('bulkExtendLicensesBtn');
    const bulkResetHwidBtn = document.getElementById('bulkResetHwidBtn');
    const bulkToggleLicensesBtn = document.getElementById('bulkToggleLicensesBtn');
    const sessionExpiryEl = document.getElementById('adminSessionExpiry');
    const confirmModal = document.getElementById('adminConfirmModal');
    const confirmTitle = document.getElementById('adminConfirmTitle');
    const confirmText = document.getElementById('adminConfirmText');
    const confirmInput = document.getElementById('adminConfirmInput');
    const confirmKeyword = document.getElementById('adminConfirmKeyword');
    const confirmCancel = document.getElementById('adminConfirmCancel');
    const confirmOk = document.getElementById('adminConfirmOk');

    let token = localStorage.getItem('adminToken') || '';
    let currentRole = 'support';
    let currentName = 'admin';
    let autoRefreshTimer = null;
    let idleTimer = null;
    let sessionTicker = null;
    let sessionExpiresAt = 0;
    let confirmResolve = null;
    const specsMap = new Map(); // id -> label

    const state = {
        orders: { items: [], page: 1, pageSize: 25, sortKey: 'createdAt', sortDir: 'desc' },
        licenses: { items: [], page: 1, pageSize: 25, sortKey: 'createdAt', sortDir: 'desc' },
        audit: { items: [] },
        savedViews: {
            orders: localStorage.getItem('adminSavedViewOrders') || '',
            licenses: localStorage.getItem('adminSavedViewLicenses') || '',
        },
    };
    const selectedOrders = new Set();
    const selectedLicenses = new Set();

    function toNumber(v) {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }

    function compare(a, b, dir) {
        if (a == null && b == null) return 0;
        if (a == null) return dir === 'asc' ? -1 : 1;
        if (b == null) return dir === 'asc' ? 1 : -1;
        if (typeof a === 'number' && typeof b === 'number') return dir === 'asc' ? a - b : b - a;
        return dir === 'asc'
            ? String(a).localeCompare(String(b))
            : String(b).localeCompare(String(a));
    }

    function downloadCsv(filename, rows) {
        const escCsv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const text = rows.map((r) => r.map(escCsv).join(',')).join('\n');
        const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    }

    async function adminFetch(path, options = {}) {
        const headers = { ...(options.headers || {}) };
        headers['x-admin-token'] = token;
        const res = await fetch(path, { ...options, headers });
        let data = {};
        try {
            data = await res.json();
        } catch (_) {
            data = {};
        }
        if (!res.ok) {
            throw new Error(data.error || `HTTP ${res.status}`);
        }
        return data;
    }

    function fmtDate(v) {
        if (!v) return '-';
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) return '-';
        return d.toLocaleString();
    }

    function escRegExp(s) {
        return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function highlight(text, query) {
        const raw = String(text == null ? '' : text);
        const q = String(query || '').trim();
        if (!q) return esc(raw);
        try {
            const re = new RegExp(`(${escRegExp(q)})`, 'ig');
            return esc(raw).replace(re, '<mark class="admin-hl">$1</mark>');
        } catch {
            return esc(raw);
        }
    }

    function setAuthMessage(msg, isError = false) {
        authMsg.textContent = msg || '';
        authMsg.classList.toggle('is-error', !!isError);
    }

    function setCreateMessage(msg, isError = false) {
        createMsg.textContent = msg || '';
        createMsg.classList.toggle('is-error', !!isError);
    }

    function syncCreatePlanInputs() {
        if (!createPlan) return;
        const plan = String(createPlan.value || '').toLowerCase();
        const isCustom = plan === 'custom';
        const isLifetime = plan === 'lifetime';

        if (createMonthsLabel) createMonthsLabel.style.display = isCustom ? 'none' : '';
        if (createMonths) createMonths.disabled = isCustom || isLifetime;

        if (createCustomDurationLabel) createCustomDurationLabel.style.display = isCustom ? '' : 'none';
        if (createDurationValue) createDurationValue.disabled = !isCustom;
        if (createDurationUnit) createDurationUnit.disabled = !isCustom;
    }

    function statusBadge(status) {
        const safe = esc(status || 'unknown');
        const cls =
            safe === 'fulfilled'
                ? 'ok'
                : safe === 'pending'
                ? 'warn'
                : safe === 'disabled'
                ? 'bad'
                : 'neutral';
        return `<span class="admin-pill ${cls}">${safe}</span>`;
    }

    function canWrite() {
        return currentRole === 'owner';
    }

    function updateRoleUi() {
        if (!sessionLine) return;
        sessionLine.innerHTML = `Signed in as <strong>${esc(currentName)}</strong> (${esc(currentRole)})`;
        if (createBtn) createBtn.disabled = !canWrite();
        if (clearAuditBtn) clearAuditBtn.disabled = !canWrite();
    }

    function markRefreshedNow() {
        if (!lastRefreshEl) return;
        lastRefreshEl.textContent = new Date().toLocaleTimeString();
    }

    function applyGlobalSearch(value) {
        const v = String(value || '').trim();
        if (ordersSearch) ordersSearch.value = v;
        if (licensesSearch) licensesSearch.value = v;
        loadOrders().catch(() => {});
        loadLicenses().catch(() => {});
    }

    function setAutoRefresh(enabled) {
        if (autoRefreshTimer) {
            clearInterval(autoRefreshTimer);
            autoRefreshTimer = null;
        }
        if (!enabled) return;
        autoRefreshTimer = setInterval(() => {
            refreshAll().catch(() => {});
        }, 60000);
    }

    function updateBulkButtons() {
        if (bulkDeleteOrdersBtn) bulkDeleteOrdersBtn.disabled = !canWrite() || selectedOrders.size === 0;
        if (bulkDeleteLicensesBtn) bulkDeleteLicensesBtn.disabled = !canWrite() || selectedLicenses.size === 0;
        if (bulkExtendLicensesBtn) bulkExtendLicensesBtn.disabled = !canWrite() || selectedLicenses.size === 0;
        if (bulkResetHwidBtn) bulkResetHwidBtn.disabled = !canWrite() || selectedLicenses.size === 0;
        if (bulkToggleLicensesBtn) bulkToggleLicensesBtn.disabled = !canWrite() || selectedLicenses.size === 0;
    }

    function applySavedViews() {
        if (ordersSavedView && state.savedViews.orders) ordersSavedView.value = state.savedViews.orders;
        if (licensesSavedView && state.savedViews.licenses) licensesSavedView.value = state.savedViews.licenses;
    }

    function applyOrderSavedView(view) {
        if (view === 'pending_new') {
            if (ordersStatus) ordersStatus.value = 'pending';
            if (ordersSort) ordersSort.value = 'createdAt:desc';
        } else if (view === 'fulfilled_new') {
            if (ordersStatus) ordersStatus.value = 'fulfilled';
            if (ordersSort) ordersSort.value = 'createdAt:desc';
        }
    }

    function applyLicenseSavedView(view) {
        if (view === 'active_bound') {
            if (licensesStatus) licensesStatus.value = 'bound';
        } else if (view === 'disabled_only') {
            if (licensesStatus) licensesStatus.value = 'disabled';
        } else if (view === 'expiring_soon') {
            if (licensesStatus) licensesStatus.value = 'active';
            if (licensesSort) licensesSort.value = 'expiresAt:asc';
        }
    }

    function startSessionTimers() {
        const SESSION_MS = 30 * 60 * 1000;
        const reset = () => {
            sessionExpiresAt = Date.now() + SESSION_MS;
            if (idleTimer) clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                token = '';
                localStorage.removeItem('adminToken');
                setAuthenticated(false);
                setAuthMessage('Session expired due to inactivity.');
            }, SESSION_MS);
        };

        const updateTicker = () => {
            if (!sessionExpiryEl || !sessionExpiresAt) return;
            const diff = Math.max(0, sessionExpiresAt - Date.now());
            const mins = Math.floor(diff / 60000);
            const secs = Math.floor((diff % 60000) / 1000);
            sessionExpiryEl.textContent = `${mins}m ${String(secs).padStart(2, '0')}s`;
        };

        ['mousemove', 'keydown', 'click'].forEach((ev) => document.addEventListener(ev, reset, { passive: true }));
        reset();
        if (sessionTicker) clearInterval(sessionTicker);
        sessionTicker = setInterval(updateTicker, 1000);
        updateTicker();
    }

    function stopSessionTimers() {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = null;
        if (sessionTicker) clearInterval(sessionTicker);
        sessionTicker = null;
        if (sessionExpiryEl) sessionExpiryEl.textContent = '-';
    }

    function askConfirm({ title, text, keyword = 'CONFIRM' }) {
        return new Promise((resolve) => {
            if (!confirmModal || !confirmInput || !confirmOk || !confirmCancel || !confirmTitle || !confirmText || !confirmKeyword) {
                resolve(window.confirm(text || 'Are you sure?'));
                return;
            }
            confirmResolve = resolve;
            confirmTitle.textContent = title || 'Confirm action';
            confirmText.textContent = text || 'Please confirm action';
            confirmKeyword.textContent = keyword;
            confirmInput.value = '';
            confirmOk.disabled = true;
            confirmModal.hidden = false;
            confirmInput.focus();
        });
    }

    async function loadOverview() {
        const stats = await adminFetch('/api/admin/overview');
        const soon = (state.licenses.items || []).filter((l) => {
            if (!l.active || l.plan === 'lifetime') return false;
            const ms = new Date(l.expiresAt).getTime() - Date.now();
            return ms > 0 && ms <= 3 * 24 * 60 * 60 * 1000;
        }).length;
        const cards = [
            ['Total Licenses', stats.totalLicenses],
            ['Active', stats.activeLicenses],
            ['Expired', stats.expiredLicenses],
            ['Expiring < 3 days', soon],
            ['Per Spec', stats.monthlyPerSpecLicenses],
            ['Pending Orders', stats.pendingOrders],
            ['Fulfilled Orders', stats.fulfilledOrders],
        ];
        kpisEl.innerHTML = cards
            .map(
                ([label, value]) =>
                    `<div class="admin-kpi card"><div class="admin-kpi-label">${esc(label)}</div><div class="admin-kpi-value">${esc(value)}</div></div>`
            )
            .join('');
    }

    function getOrderSortValue(o, key) {
        if (key === 'selected') {
            const list = Array.isArray(o.specLabels) && o.specLabels.length ? o.specLabels : o.specIds || [];
            return (list || []).join(', ');
        }
        if (key === 'amountUsd') return toNumber(o.amountUsd);
        return o[key];
    }

    function renderOrders() {
        const { items, page, pageSize, sortKey, sortDir } = state.orders;
        const q = String(ordersSearch?.value || '').trim();
        const sorted = [...items].sort((a, b) =>
            compare(getOrderSortValue(a, sortKey), getOrderSortValue(b, sortKey), sortDir)
        );
        const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
        const cur = Math.min(Math.max(1, page), totalPages);
        state.orders.page = cur;
        const slice = sorted.slice((cur - 1) * pageSize, cur * pageSize);

        if (ordersPageText) ordersPageText.textContent = `Page ${cur} / ${totalPages}`;
        if (ordersPrev) ordersPrev.disabled = cur <= 1;
        if (ordersNext) ordersNext.disabled = cur >= totalPages;

        if (!slice.length) {
            ordersList.innerHTML = '<div class="admin-empty">No orders found.</div>';
            return;
        }

        ordersList.innerHTML = slice
            .map((o) => {
                const selected =
                    Array.isArray(o.specLabels) && o.specLabels.length
                        ? o.specLabels.join(', ')
                        : Array.isArray(o.specIds) && o.specIds.length
                        ? o.specIds.join(', ')
                        : '-';
                const selectedList =
                    Array.isArray(o.specLabels) && o.specLabels.length
                        ? o.specLabels
                        : Array.isArray(o.specIds) && o.specIds.length
                        ? o.specIds
                        : [];
                const chips = selectedList
                    .slice(0, 4)
                    .map((x) => `<span class="admin-chip">${esc(x)}</span>`)
                    .join('');
                const more =
                    selectedList.length > 4
                        ? `<span class="admin-chip admin-chip--muted">+${selectedList.length - 4}</span>`
                        : '';
                const selectedCell =
                    selectedList.length === 0
                        ? '<span class="admin-truncate">-</span>'
                        : `<div class="admin-chips" title="${esc(selected)}">${chips}${more}</div>`;

                const amountText =
                    o.amountUsd != null && !Number.isNaN(Number(o.amountUsd))
                        ? `$${Number(o.amountUsd).toFixed(2)}`
                        : '-';
                const currencyText = o.currency ? ` ${esc(o.currency)}` : '';
                const email = o.email ? esc(o.email) : '-';
                const checked = selectedOrders.has(String(o.orderId || '')) ? 'checked' : '';
                const orderIdSafe = String(o.orderId || '-');
                const emailSafe = email;
                const licenseSafe = o.licenseKey ? o.licenseKey : '-';

                return `<details class="admin-item" data-order="${esc(o.orderId || '')}">
                    <summary class="admin-item-summary">
                        <div class="admin-item-left">
                            <div class="admin-item-title"><code>${highlight(orderIdSafe, q)}</code></div>
                            <div class="admin-item-sub">${esc(fmtDate(o.createdAt))} · ${amountText}${currencyText}</div>
                        </div>
                        <div class="admin-item-right">
                            ${statusBadge(o.status || 'pending')}
                        </div>
                    </summary>
                    <div class="admin-item-body">
                        <div class="admin-item-grid">
                            <div class="admin-item-field">
                                <div class="admin-item-label">Selected</div>
                                <div class="admin-item-value">${selectedCell}</div>
                            </div>
                            <div class="admin-item-field">
                                <div class="admin-item-label">Email</div>
                                <div class="admin-item-value"><span class="admin-truncate" title="${esc(emailSafe)}">${highlight(emailSafe, q)}</span></div>
                            </div>
                            <div class="admin-item-field">
                                <div class="admin-item-label">License</div>
                                <div class="admin-item-value">${o.licenseKey ? `<code>${highlight(licenseSafe, q)}</code>` : '-'}</div>
                            </div>
                            <div class="admin-item-field admin-item-field--actions">
                                <div class="admin-item-label">Actions</div>
                                <div class="admin-item-value">
                                    <div class="admin-actions">
                                        <label class="admin-multi-check"><input type="checkbox" class="admin-row-check" data-order-check="${esc(o.orderId || '')}" ${checked}> Select</label>
                                        <button class="btn-action admin-action-btn admin-danger" data-act="delete-order" ${canWrite() ? '' : 'disabled'}>Delete</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </details>`;
            })
            .join('');
        updateBulkButtons();
    }

    async function loadOrders() {
        ordersList.innerHTML = '<div class="admin-empty">Loading...</div>';
        const q = encodeURIComponent((ordersSearch.value || '').trim());
        const s = encodeURIComponent(ordersStatus.value || '');
        const data = await adminFetch(`/api/admin/orders?q=${q}&status=${s}`);
        if (ordersCount) ordersCount.textContent = String(Array.isArray(data.items) ? data.items.length : 0);
        state.orders.items = Array.isArray(data.items) ? data.items : [];
        renderOrders();
    }

    function licenseStatusText(l) {
        if (!l.active) return 'disabled';
        if (l.isExpired) return 'expired';
        return 'active';
    }

    function getLicenseSortValue(l, key) {
        if (key === 'status') return licenseStatusText(l);
        if (key === 'specs') return Array.isArray(l.specs) ? l.specs.join(', ') : '';
        if (key === 'expiresAt') return l.plan === 'lifetime' ? '2099-12-31' : l.expiresAt || '';
        return l[key];
    }

    function renderLicenses() {
        const { items, page, pageSize, sortKey, sortDir } = state.licenses;
        const q = String(licensesSearch?.value || '').trim();
        let filtered = [...items];
        if (state.savedViews.licenses === 'expiring_soon') {
            filtered = filtered.filter((l) => {
                if (!l.active || l.plan === 'lifetime') return false;
                const ms = new Date(l.expiresAt).getTime() - Date.now();
                return ms > 0 && ms <= 7 * 24 * 60 * 60 * 1000;
            });
        }
        const sorted = filtered.sort((a, b) =>
            compare(getLicenseSortValue(a, sortKey), getLicenseSortValue(b, sortKey), sortDir)
        );
        const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
        const cur = Math.min(Math.max(1, page), totalPages);
        state.licenses.page = cur;
        const slice = sorted.slice((cur - 1) * pageSize, cur * pageSize);

        if (licensesPageText) licensesPageText.textContent = `Page ${cur} / ${totalPages}`;
        if (licensesPrev) licensesPrev.disabled = cur <= 1;
        if (licensesNext) licensesNext.disabled = cur >= totalPages;

        if (!slice.length) {
            licensesList.innerHTML = '<div class="admin-empty">No licenses found.</div>';
            return;
        }

        licensesList.innerHTML = slice
            .map((l) => {
                const specList = Array.isArray(l.specs) ? l.specs : [];
                const specLabels = specList.map(id => specsMap.get(id) || id);
                const specsText = specLabels.length ? specLabels.join(', ') : '-';
                const specChips = specLabels
                    .slice(0, 3)
                    .map((x) => `<span class="admin-chip admin-chip--spec">${esc(x)}</span>`)
                    .join('');
                const specMore =
                    specLabels.length > 3 ? `<span class="admin-chip admin-chip--muted">+${specLabels.length - 3}</span>` : '';
                const specCell =
                    specLabels.length === 0
                        ? '<span class="admin-truncate">-</span>'
                        : `<div class="admin-chips" title="${esc(specsText)}">${specChips}${specMore}</div>`;
                const email = l.email ? esc(l.email) : '-';
                const exp = l.plan === 'lifetime' ? 'Never' : fmtDate(l.expiresAt);
                const status = licenseStatusText(l);
                const checked = selectedLicenses.has(String(l.key || '')) ? 'checked' : '';
                const history = (state.audit.items || [])
                    .filter((a) => JSON.stringify(a.details || {}).toUpperCase().includes(String(l.key || '').toUpperCase()))
                    .slice(0, 4)
                    .map((a) => `<div class="admin-item-sub">• ${esc(a.action || '')} · ${esc(fmtDate(a.at))}</div>`)
                    .join('');
                return `<details class="admin-item" data-key="${esc(l.key)}">
                    <summary class="admin-item-summary">
                        <div class="admin-item-left">
                            <div class="admin-item-title"><code>${highlight(l.key, q)}</code></div>
                            <div class="admin-item-sub">${highlight(l.plan || '-', q)} · Expires: ${highlight(exp, q)}</div>
                        </div>
                        <div class="admin-item-right">
                            ${statusBadge(status)}
                        </div>
                    </summary>
                    <div class="admin-item-body">
                        <div class="admin-item-grid">
                            <div class="admin-item-field">
                                <div class="admin-item-label">Email</div>
                                <div class="admin-item-value"><span class="admin-truncate" title="${esc(email)}">${highlight(email, q)}</span></div>
                            </div>
                            <div class="admin-item-field">
                                <div class="admin-item-label">Specs</div>
                                <div class="admin-item-value">${specCell}</div>
                            </div>
                            <div class="admin-item-field">
                                <div class="admin-item-label">Timeline</div>
                                <div class="admin-item-value">${history || '<span class="admin-truncate">No events</span>'}</div>
                            </div>
                            <div class="admin-item-field admin-item-field--actions">
                                <div class="admin-item-label">Actions</div>
                                <div class="admin-item-value">
                                    <div class="admin-actions">
                                        <label class="admin-multi-check"><input type="checkbox" class="admin-row-check" data-license-check="${esc(l.key)}" ${checked}> Select</label>
                                        <button class="btn-action admin-action-btn" data-act="toggle" ${canWrite() ? '' : 'disabled'}>Toggle</button>
                                        <button class="btn-action admin-action-btn" data-act="extend" ${canWrite() ? '' : 'disabled'}>+1 Month</button>
                                        <button class="btn-action admin-action-btn" data-act="reset" ${canWrite() ? '' : 'disabled'}>Reset HWID</button>
                                        <button class="btn-action admin-action-btn admin-danger" data-act="delete" ${canWrite() ? '' : 'disabled'}>Delete</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </details>`;
            })
            .join('');
        updateBulkButtons();
    }

    async function loadLicenses() {
        licensesList.innerHTML = '<div class="admin-empty">Loading...</div>';
        const q = encodeURIComponent((licensesSearch.value || '').trim());
        const plan = encodeURIComponent(licensesPlan.value || '');
        const status = encodeURIComponent(licensesStatus.value || '');
        const data = await adminFetch(`/api/admin/licenses?q=${q}&plan=${plan}&status=${status}`);
        if (licensesCount) licensesCount.textContent = String(Array.isArray(data.items) ? data.items.length : 0);
        state.licenses.items = Array.isArray(data.items) ? data.items : [];
        renderLicenses();
    }

    async function loadAudit() {
        auditTbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';
        const limit = Math.max(10, Math.min(500, Number(auditLimit.value) || 100));
        const data = await adminFetch(`/api/admin/audit?limit=${encodeURIComponent(limit)}`);
        if (auditCount) auditCount.textContent = String(Array.isArray(data.items) ? data.items.length : 0);
        if (!Array.isArray(data.items) || data.items.length === 0) {
            auditTbody.innerHTML = '<tr><td colspan="4">No audit entries.</td></tr>';
            return;
        }
        auditTbody.innerHTML = data.items
            .map((a) => {
                const actor = a.actor ? `${a.actor.name || 'admin'} (${a.actor.role || '-'})` : '-';
                return `<tr>
                    <td>${esc(fmtDate(a.at))}</td>
                    <td>${esc(actor)}</td>
                    <td>${esc(a.action || '-')}</td>
                    <td><code>${esc(JSON.stringify(a.details || {}))}</code></td>
                </tr>`;
            })
            .join('');
        state.audit.items = Array.isArray(data.items) ? data.items : [];
    }

    async function runLicenseAction(key, act) {
        if (!key || !act) return;
        if (act === 'toggle') {
            await adminFetch(`/api/admin/licenses/${encodeURIComponent(key)}/toggle-active`, { method: 'POST' });
        } else if (act === 'extend') {
            await adminFetch(`/api/admin/licenses/${encodeURIComponent(key)}/extend`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ months: 1 }),
            });
        } else if (act === 'reset') {
            await adminFetch(`/api/admin/licenses/${encodeURIComponent(key)}/reset-hwid`, { method: 'POST' });
        } else if (act === 'delete') {
            await adminFetch(`/api/admin/licenses/${encodeURIComponent(key)}/delete`, { method: 'POST' });
        }
    }

    async function loadConfig() {
        try {
            const res = await fetch('/api/specs');
            const data = await res.json();
            if (configPriceInput) {
                configPriceInput.value = data.pricePerSpecUsdPerMonth || 6;
            }
            if (Array.isArray(data.specs)) {
                specsMap.clear();
                data.specs.forEach(s => specsMap.set(s.id, s.label || s.id));
                if (createSpecsContainer) {
                    createSpecsContainer.innerHTML = data.specs.map(s => `
                        <label class="admin-multi-check">
                            <input type="checkbox" class="admin-row-check create-spec-cb" value="${esc(s.id)}"> 
                            ${esc(s.label || s.id)}
                        </label>
                    `).join('');
                }
            }
        } catch(e) {
            console.error('Failed to load config', e);
        }
    }

    async function refreshAll() {
        await Promise.all([loadOrders(), loadLicenses(), loadAudit(), loadConfig()]);
        await loadOverview();
        markRefreshedNow();
    }

    function initSectionNavigation() {
        if (!sideNav) return;
        const links = Array.from(sideNav.querySelectorAll('.admin-nav-link'));
        const sections = links
            .map((a) => document.querySelector(a.getAttribute('href')))
            .filter(Boolean);

        links.forEach((link) => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(link.getAttribute('href'));
                if (!target) return;
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });

        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    const id = `#${entry.target.id}`;
                    links.forEach((l) => l.classList.toggle('is-active', l.getAttribute('href') === id));
                });
            },
            { rootMargin: '-20% 0px -65% 0px', threshold: 0.01 }
        );

        sections.forEach((s) => io.observe(s));
    }

    function setAuthenticated(on) {
        panel.hidden = !on;
        authCard.hidden = !!on;
        if (topbar) topbar.hidden = !on;
        if (hero) hero.hidden = !on;
        if (on) startSessionTimers();
        else stopSessionTimers();
    }

    async function tryLogin() {
        token = (tokenInput.value || token || '').trim();
        if (!token) {
            setAuthMessage('Please enter admin token.', true);
            return;
        }
        localStorage.setItem('adminToken', token);
        try {
            const health = await adminFetch('/api/admin/health');
            currentRole = health?.admin?.role || 'support';
            currentName = health?.admin?.name || 'admin';
            updateRoleUi();
            setAuthenticated(true);
            setAuthMessage('');
            applySavedViews();
            applyOrderSavedView(state.savedViews.orders);
            applyLicenseSavedView(state.savedViews.licenses);
            await refreshAll();
        } catch (e) {
            setAuthenticated(false);
            setAuthMessage(e.message || 'Authentication failed.', true);
            localStorage.removeItem('adminToken');
            token = '';
        }
    }

    loginBtn.addEventListener('click', () => {
        tryLogin().catch((e) => setAuthMessage(e.message || 'Login failed.', true));
    });
    tokenInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            tryLogin().catch((err) => setAuthMessage(err.message || 'Login failed.', true));
        }
    });

    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        token = '';
        localStorage.removeItem('adminToken');
        currentRole = 'support';
        currentName = 'admin';
        updateRoleUi();
        setAuthenticated(false);
        setAuthMessage('Logged out.');
    });

    if (confirmInput && confirmOk && confirmCancel && confirmModal) {
        const syncConfirmState = () => {
            const keyword = String(confirmKeyword?.textContent || 'CONFIRM').trim();
            confirmOk.disabled = String(confirmInput.value || '').trim().toUpperCase() !== keyword.toUpperCase();
        };
        confirmInput.addEventListener('input', syncConfirmState);
        confirmCancel.addEventListener('click', () => {
            confirmModal.hidden = true;
            if (confirmResolve) confirmResolve(false);
            confirmResolve = null;
        });
        confirmOk.addEventListener('click', () => {
            confirmModal.hidden = true;
            if (confirmResolve) confirmResolve(true);
            confirmResolve = null;
        });
    }

    createBtn.addEventListener('click', async () => {
        createBtn.disabled = true;
        setCreateMessage('');
        try {
            const plan = createPlan.value;
            const payload = {
                plan,
                months: Number(createMonths.value || 1),
                email: (createEmail.value || '').trim() || null,
                specs: Array.from(document.querySelectorAll('.create-spec-cb:checked')).map(cb => cb.value),
            };
            if (plan === 'custom') {
                payload.durationValue = Number(createDurationValue?.value || 1);
                payload.durationUnit = String(createDurationUnit?.value || 'minutes');
            }
            const data = await adminFetch('/api/admin/licenses/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            setCreateMessage(`License created: ${data.key}`);
            document.querySelectorAll('.create-spec-cb:checked').forEach(cb => cb.checked = false);
            await refreshAll();
        } catch (e) {
            setCreateMessage(e.message || 'Create failed.', true);
        } finally {
            createBtn.disabled = false;
        }
    });

    if (updateConfigBtn) {
        updateConfigBtn.addEventListener('click', async () => {
            updateConfigBtn.disabled = true;
            if (updateConfigMsg) {
                updateConfigMsg.textContent = '';
                updateConfigMsg.classList.remove('is-error');
            }
            try {
                await adminFetch('/api/admin/config/price', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ price: Number(configPriceInput.value) }),
                });
                if (updateConfigMsg) updateConfigMsg.textContent = 'Configuration saved!';
                await refreshAll();
            } catch (e) {
                if (updateConfigMsg) {
                    updateConfigMsg.textContent = e.message || 'Save failed.';
                    updateConfigMsg.classList.add('is-error');
                }
            } finally {
                updateConfigBtn.disabled = false;
            }
        });
    }

    refreshOrdersBtn.addEventListener('click', () => {
        loadOrders().catch((e) => alert(e.message || 'Cannot load orders'));
    });
    if (exportOrdersBtn) {
        exportOrdersBtn.addEventListener('click', () => {
            const rows = [
                ['orderId', 'status', 'selected', 'amountUsd', 'currency', 'email', 'licenseKey', 'createdAt'],
                ...state.orders.items.map((o) => [
                    o.orderId || '',
                    o.status || '',
                    (Array.isArray(o.specLabels) && o.specLabels.length ? o.specLabels : o.specIds || []).join(' | '),
                    o.amountUsd ?? '',
                    o.currency || '',
                    o.email || '',
                    o.licenseKey || '',
                    o.createdAt || '',
                ]),
            ];
            downloadCsv('orders.csv', rows);
        });
    }
    if (ordersPageSize) {
        ordersPageSize.addEventListener('change', () => {
            state.orders.pageSize = Math.max(5, Number(ordersPageSize.value) || 25);
            state.orders.page = 1;
            renderOrders();
        });
    }
    if (ordersPrev) {
        ordersPrev.addEventListener('click', () => {
            state.orders.page = Math.max(1, state.orders.page - 1);
            renderOrders();
        });
    }
    if (ordersNext) {
        ordersNext.addEventListener('click', () => {
            state.orders.page = state.orders.page + 1;
            renderOrders();
        });
    }
    if (ordersSort) {
        ordersSort.addEventListener('change', () => {
            const [k, d] = String(ordersSort.value || 'createdAt:desc').split(':');
            state.orders.sortKey = k || 'createdAt';
            state.orders.sortDir = d === 'asc' ? 'asc' : 'desc';
            state.orders.page = 1;
            renderOrders();
        });
    }
    if (ordersSelectVisibleBtn) {
        ordersSelectVisibleBtn.addEventListener('click', () => {
            const { items, page, pageSize, sortKey, sortDir } = state.orders;
            const sorted = [...items].sort((a, b) =>
                compare(getOrderSortValue(a, sortKey), getOrderSortValue(b, sortKey), sortDir)
            );
            const cur = state.orders.page;
            const slice = sorted.slice((cur - 1) * pageSize, cur * pageSize);
            slice.forEach((o) => {
                if (o.orderId) selectedOrders.add(String(o.orderId));
            });
            renderOrders();
        });
    }
    if (bulkDeleteOrdersBtn) {
        bulkDeleteOrdersBtn.addEventListener('click', () => {
            if (!canWrite() || selectedOrders.size === 0) return;
            askConfirm({
                title: 'Bulk delete orders',
                text: `Delete ${selectedOrders.size} order(s)? This cannot be undone.`,
                keyword: 'DELETE',
            }).then((ok) => {
                if (!ok) return;
                bulkDeleteOrdersBtn.disabled = true;
                return adminFetch('/api/admin/orders/bulk-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderIds: [...selectedOrders] }),
            })
                .then(() => {
                    selectedOrders.clear();
                    return refreshAll();
                })
                .catch((err) => alert(err.message || 'Bulk delete failed'))
                .finally(() => {
                    updateBulkButtons();
                });
            });
        });
    }
    refreshLicensesBtn.addEventListener('click', () => {
        loadLicenses().catch((e) => alert(e.message || 'Cannot load licenses'));
    });
    if (exportLicensesBtn) {
        exportLicensesBtn.addEventListener('click', () => {
            const rows = [
                ['key', 'plan', 'active', 'expiresAt', 'email', 'specs', 'isBound', 'createdAt', 'orderId'],
                ...state.licenses.items.map((l) => [
                    l.key || '',
                    l.plan || '',
                    String(!!l.active),
                    l.expiresAt || '',
                    l.email || '',
                    (Array.isArray(l.specs) ? l.specs : []).join(' | '),
                    String(!!l.isBound),
                    l.createdAt || '',
                    l.orderId || '',
                ]),
            ];
            downloadCsv('licenses.csv', rows);
        });
    }
    if (licensesPageSize) {
        licensesPageSize.addEventListener('change', () => {
            state.licenses.pageSize = Math.max(5, Number(licensesPageSize.value) || 25);
            state.licenses.page = 1;
            renderLicenses();
        });
    }
    if (licensesPrev) {
        licensesPrev.addEventListener('click', () => {
            state.licenses.page = Math.max(1, state.licenses.page - 1);
            renderLicenses();
        });
    }
    if (licensesNext) {
        licensesNext.addEventListener('click', () => {
            state.licenses.page = state.licenses.page + 1;
            renderLicenses();
        });
    }
    if (licensesSort) {
        licensesSort.addEventListener('change', () => {
            const [k, d] = String(licensesSort.value || 'createdAt:desc').split(':');
            state.licenses.sortKey = k || 'createdAt';
            state.licenses.sortDir = d === 'asc' ? 'asc' : 'desc';
            state.licenses.page = 1;
            renderLicenses();
        });
    }
    if (licensesSelectVisibleBtn) {
        licensesSelectVisibleBtn.addEventListener('click', () => {
            const { items, page, pageSize, sortKey, sortDir } = state.licenses;
            const sorted = [...items].sort((a, b) =>
                compare(getLicenseSortValue(a, sortKey), getLicenseSortValue(b, sortKey), sortDir)
            );
            const cur = state.licenses.page;
            const slice = sorted.slice((cur - 1) * pageSize, cur * pageSize);
            slice.forEach((l) => {
                if (l.key) selectedLicenses.add(String(l.key));
            });
            renderLicenses();
        });
    }
    if (bulkDeleteLicensesBtn) {
        bulkDeleteLicensesBtn.addEventListener('click', () => {
            if (!canWrite() || selectedLicenses.size === 0) return;
            askConfirm({
                title: 'Bulk delete licenses',
                text: `Delete ${selectedLicenses.size} license(s)? This cannot be undone.`,
                keyword: 'DELETE',
            }).then((ok) => {
                if (!ok) return;
                bulkDeleteLicensesBtn.disabled = true;
                return adminFetch('/api/admin/licenses/bulk-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keys: [...selectedLicenses] }),
            })
                .then(() => {
                    selectedLicenses.clear();
                    return refreshAll();
                })
                .catch((err) => alert(err.message || 'Bulk delete failed'))
                .finally(() => {
                    updateBulkButtons();
                });
            });
        });
    }

    if (bulkExtendLicensesBtn) {
        bulkExtendLicensesBtn.addEventListener('click', async () => {
            if (!canWrite() || selectedLicenses.size === 0) return;
            const ok = await askConfirm({ title: 'Bulk extend', text: `Extend ${selectedLicenses.size} license(s) by 1 month?`, keyword: 'EXTEND' });
            if (!ok) return;
            for (const key of selectedLicenses) {
                await adminFetch(`/api/admin/licenses/${encodeURIComponent(key)}/extend`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ months: 1 }),
                });
            }
            await refreshAll();
        });
    }
    if (bulkResetHwidBtn) {
        bulkResetHwidBtn.addEventListener('click', async () => {
            if (!canWrite() || selectedLicenses.size === 0) return;
            const ok = await askConfirm({ title: 'Bulk reset HWID', text: `Reset HWID for ${selectedLicenses.size} license(s)?`, keyword: 'RESET' });
            if (!ok) return;
            for (const key of selectedLicenses) {
                await adminFetch(`/api/admin/licenses/${encodeURIComponent(key)}/reset-hwid`, { method: 'POST' });
            }
            await refreshAll();
        });
    }
    if (bulkToggleLicensesBtn) {
        bulkToggleLicensesBtn.addEventListener('click', async () => {
            if (!canWrite() || selectedLicenses.size === 0) return;
            const ok = await askConfirm({ title: 'Bulk toggle', text: `Toggle active state for ${selectedLicenses.size} license(s)?`, keyword: 'TOGGLE' });
            if (!ok) return;
            for (const key of selectedLicenses) {
                await adminFetch(`/api/admin/licenses/${encodeURIComponent(key)}/toggle-active`, { method: 'POST' });
            }
            await refreshAll();
        });
    }
    refreshAuditBtn.addEventListener('click', () => {
        loadAudit().catch((e) => alert(e.message || 'Cannot load audit'));
    });
    if (clearAuditBtn) {
        clearAuditBtn.addEventListener('click', async () => {
            if (!canWrite()) return;
            const ok = await askConfirm({
                title: 'Clear audit log',
                text: 'Delete ALL audit entries? This cannot be undone.',
                keyword: 'CLEAR',
            });
            if (!ok) return;
            clearAuditBtn.disabled = true;
            try {
                await adminFetch('/api/admin/audit/clear', { method: 'POST' });
                await loadAudit();
            } catch (e) {
                alert(e.message || 'Failed to clear audit log');
            } finally {
                clearAuditBtn.disabled = !canWrite();
            }
        });
    }
    if (exportAuditBtn) {
        exportAuditBtn.addEventListener('click', () => {
            const rows = [
                ['at', 'actor', 'action', 'details', 'ip'],
                ...state.audit.items.map((a) => [
                    a.at || '',
                    a.actor ? `${a.actor.name || ''} (${a.actor.role || ''})` : '',
                    a.action || '',
                    JSON.stringify(a.details || {}),
                    a.ip || '',
                ]),
            ];
            downloadCsv('audit.csv', rows);
        });
    }
    if (quickRefreshBtn) {
        quickRefreshBtn.addEventListener('click', () => {
            refreshAll().catch((e) => alert(e.message || 'Cannot refresh dashboard'));
        });
    }
    if (globalSearch) {
        let timer = null;
        globalSearch.addEventListener('input', () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => applyGlobalSearch(globalSearch.value), 220);
        });
    }
    if (autoRefreshToggle) {
        autoRefreshToggle.addEventListener('change', () => {
            setAutoRefresh(!!autoRefreshToggle.checked);
        });
    }
    if (ordersSavedView) {
        ordersSavedView.addEventListener('change', () => {
            state.savedViews.orders = ordersSavedView.value || '';
            localStorage.setItem('adminSavedViewOrders', state.savedViews.orders);
            applyOrderSavedView(state.savedViews.orders);
            refreshAll().catch(() => {});
        });
    }
    if (licensesSavedView) {
        licensesSavedView.addEventListener('change', () => {
            state.savedViews.licenses = licensesSavedView.value || '';
            localStorage.setItem('adminSavedViewLicenses', state.savedViews.licenses);
            applyLicenseSavedView(state.savedViews.licenses);
            refreshAll().catch(() => {});
        });
    }
    ordersSearch.addEventListener('input', () => {
        loadOrders().catch(() => {});
    });
    ordersStatus.addEventListener('change', () => {
        loadOrders().catch(() => {});
    });
    if (ordersSort) {
        ordersSort.addEventListener('change', () => {
            const [k, d] = String(ordersSort.value || 'createdAt:desc').split(':');
            state.orders.sortKey = k || 'createdAt';
            state.orders.sortDir = d === 'asc' ? 'asc' : 'desc';
            state.orders.page = 1;
            renderOrders();
        });
    }
    licensesSearch.addEventListener('input', () => {
        loadLicenses().catch(() => {});
    });
    licensesPlan.addEventListener('change', () => {
        loadLicenses().catch(() => {});
    });
    licensesStatus.addEventListener('change', () => {
        loadLicenses().catch(() => {});
    });
    if (licensesSort) {
        licensesSort.addEventListener('change', () => {
            const [k, d] = String(licensesSort.value || 'createdAt:desc').split(':');
            state.licenses.sortKey = k || 'createdAt';
            state.licenses.sortDir = d === 'asc' ? 'asc' : 'desc';
            state.licenses.page = 1;
            renderLicenses();
        });
    }

    ordersList.addEventListener('click', (e) => {
        const check = e.target.closest('[data-order-check]');
        if (check) {
            const id = check.getAttribute('data-order-check');
            if (id) {
                if (check.checked) selectedOrders.add(id);
                else selectedOrders.delete(id);
                updateBulkButtons();
            }
            return;
        }
        const btn = e.target.closest('.admin-action-btn');
        if (!btn) return;
        const act = btn.getAttribute('data-act');
        if (act !== 'delete-order') return;
        const card = e.target.closest('[data-order]');
        if (!card) return;
        const orderId = card.getAttribute('data-order');
        if (!orderId) return;
        if (!canWrite()) return;
        askConfirm({
            title: 'Delete order',
            text: `Delete order ${orderId}? This cannot be undone.`,
            keyword: 'DELETE',
        }).then((ok) => {
            if (!ok) return;
            btn.disabled = true;
            return adminFetch(`/api/admin/orders/${encodeURIComponent(orderId)}/delete`, { method: 'POST' })
                .then(refreshAll)
                .catch((err) => alert(err.message || 'Delete failed'))
                .finally(() => {
                    btn.disabled = false;
                });
        });
    });

    licensesList.addEventListener('click', (e) => {
        const check = e.target.closest('[data-license-check]');
        if (check) {
            const id = check.getAttribute('data-license-check');
            if (id) {
                if (check.checked) selectedLicenses.add(id);
                else selectedLicenses.delete(id);
                updateBulkButtons();
            }
            return;
        }
        const btn = e.target.closest('.admin-action-btn');
        if (!btn) return;
        const card = e.target.closest('[data-key]');
        if (!card) return;
        const key = card.getAttribute('data-key');
        const act = btn.getAttribute('data-act');
        const proceed = async () => {
            btn.disabled = true;
            try {
                await runLicenseAction(key, act);
                await refreshAll();
            } catch (err) {
                alert(err.message || 'Action failed');
            } finally {
                btn.disabled = false;
            }
        };
        if (act === 'delete') {
            askConfirm({
                title: 'Delete license',
                text: `Delete license ${key}? This cannot be undone.`,
                keyword: 'DELETE',
            }).then((ok) => { if (ok) proceed(); });
            return;
        }
        proceed();
    });

    if (token) {
        tokenInput.value = token;
        tryLogin().catch((e) => setAuthMessage(e.message || 'Login failed.', true));
    } else {
        updateRoleUi();
        setAuthenticated(false);
        updateBulkButtons();
    }

    if (createPlan) {
        createPlan.addEventListener('change', syncCreatePlanInputs);
    }
    syncCreatePlanInputs();

    initSectionNavigation();

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k') {
            if (!globalSearch) return;
            e.preventDefault();
            globalSearch.focus();
            globalSearch.select();
        }
    });
});
