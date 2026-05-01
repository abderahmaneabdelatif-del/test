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
    const configPlanMonthly = document.getElementById('configPlanMonthly');
    const configPlan3Month = document.getElementById('configPlan3Month');
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
    const ordersCount = document.getElementById('ordersCount');
    const licensesCount = document.getElementById('licensesCount');
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
    let licenseViewMode = localStorage.getItem('adminLicView') || 'table';

    const state = {
        orders: { items: [], page: 1, pageSize: 25, sortKey: 'createdAt', sortDir: 'desc' },
        licenses: { items: [], page: 1, pageSize: 25, sortKey: 'createdAt', sortDir: 'desc' },
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
        const isPerSpec = plan === 'monthly_per_spec';

        if (createMonthsLabel) createMonthsLabel.style.display = isCustom ? 'none' : '';
        if (createMonths) createMonths.disabled = isCustom || isLifetime;

        if (createCustomDurationLabel) createCustomDurationLabel.style.display = isCustom ? '' : 'none';
        if (createDurationValue) createDurationValue.disabled = !isCustom;
        if (createDurationUnit) createDurationUnit.disabled = !isCustom;

        // Show specs selection only for per-spec plan
        const specsSection = document.querySelector('.create-specs-section');
        if (specsSection) specsSection.style.display = isPerSpec ? '' : 'none';
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
        } else if (view === '') {
            if (licensesStatus) licensesStatus.value = '';
            if (licensesSort) licensesSort.value = 'createdAt:desc';
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

        // Quick stats
        const pendingCount = items.filter(o => String(o.status || 'pending') !== 'fulfilled').length;
        const fulfilledCount = items.filter(o => String(o.status || '') === 'fulfilled').length;
        const ordPendingEl = document.getElementById('ordPendingCount');
        const ordFulfilledEl = document.getElementById('ordFulfilledCount');
        const ordPagerInfo = document.getElementById('ordPagerInfo');
        if (ordPendingEl) ordPendingEl.textContent = pendingCount;
        if (ordFulfilledEl) ordFulfilledEl.textContent = fulfilledCount;
        if (ordPagerInfo) {
            const from = sorted.length ? (cur - 1) * pageSize + 1 : 0;
            const to = Math.min(cur * pageSize, sorted.length);
            ordPagerInfo.textContent = `Showing ${from}–${to} of ${sorted.length} orders`;
        }

        if (!slice.length) {
            ordersList.innerHTML = '<div class="admin-empty">No orders found.</div>';
            return;
        }

        const w = canWrite();
        const rows = slice.map(o => {
            const status = String(o.status || 'pending').toLowerCase();
            const isPending = status !== 'fulfilled';
            const checked = selectedOrders.has(String(o.orderId || '')) ? 'checked' : '';
            const amountText = o.amountUsd != null && !Number.isNaN(Number(o.amountUsd))
                        ? `$${Number(o.amountUsd).toFixed(2)}`
                        : '-';
                const currencyText = o.currency ? ` ${esc(o.currency)}` : '';
            const email = o.email ? esc(o.email) : '';
            const licenseKey = o.licenseKey ? esc(o.licenseKey) : '';
            const kind = o.kind || '-';
            const provider = o.provider || (o.paypalOrderId ? 'PayPal' : o.npPaymentId ? 'NOWPayments' : '—');

            // Specs summary
            const specLabels = Array.isArray(o.specLabels) && o.specLabels.length
                ? o.specLabels : Array.isArray(o.specIds) && o.specIds.length
                ? o.specIds : [];
            let specsCell = '';
            if (specLabels.length > 0) {
                const chips = specLabels.slice(0, 2).map(x => `<span class="ot-spec">${esc(x)}</span>`).join('');
                const more = specLabels.length > 2 ? `<span class="ot-spec ot-spec--more">+${specLabels.length - 2}</span>` : '';
                specsCell = chips + more;
            } else {
                specsCell = '<span class="ot-spec ot-spec--none">—</span>';
            }

            const statusCls = isPending ? 'warn' : 'ok';
            const rowCls = isPending ? 'ot-row--pending' : '';

            // Expand detail
            const detailFields = [
                { label: 'Kind', value: esc(kind) },
                { label: 'Provider', value: esc(provider) },
                { label: 'Email', value: email || '—' },
                { label: 'License Key', value: licenseKey ? `<code class="ot-detail-code">${licenseKey}</code>` : '—' },
                { label: 'Specs', value: specLabels.length ? specLabels.map(x => `<span class="ot-detail-spec">${esc(x)}</span>`).join(' ') : '—' },
                { label: 'Created', value: fmtDate(o.createdAt) },
                { label: 'Fulfilled At', value: o.fulfilledAt ? fmtDate(o.fulfilledAt) : '—' },
            ];
            const detailHtml = `<div class="ot-expand">
                <div class="ot-detail-grid">
                    ${detailFields.map(f => `<div class="ot-detail-field">
                        <span class="ot-detail-label">${f.label}</span>
                        <span class="ot-detail-value">${f.value}</span>
                    </div>`).join('')}
                        </div>
                <div class="ot-detail-actions">
                    <label class="ot-detail-check"><input type="checkbox" class="admin-row-check" data-order-check="${esc(o.orderId || '')}" ${checked}> Select</label>
                    <button class="ot-detail-delete admin-action-btn admin-danger" data-act="delete-order" ${w ? '' : 'disabled'}>Delete</button>
                        </div>
            </div>`;

            return `<tr class="ot-row ${rowCls}" data-order="${esc(o.orderId || '')}">
                <td class="ot-cell ot-cell--check"><input type="checkbox" class="admin-row-check" data-order-check="${esc(o.orderId || '')}" ${checked}></td>
                <td class="ot-cell ot-cell--id"><code class="ot-id-code">${highlight(String(o.orderId || '-'), q)}</code></td>
                <td class="ot-cell ot-cell--amount"><span class="ot-amount">${amountText}</span><span class="ot-currency">${currencyText}</span></td>
                <td class="ot-cell ot-cell--specs"><div class="ot-specs-wrap">${specsCell}</div></td>
                <td class="ot-cell ot-cell--email">${email ? `<span class="ot-email" title="${esc(email)}">${highlight(email.length > 16 ? email.substring(0, 16) + '…' : email, q)}</span>` : '<span class="ot-email--none">—</span>'}</td>
                <td class="ot-cell ot-cell--license">${licenseKey ? `<code class="ot-license-code">${highlight(licenseKey, q)}</code>` : '<span class="ot-license--none">—</span>'}</td>
                <td class="ot-cell ot-cell--date">${fmtDate(o.createdAt)}</td>
                <td class="ot-cell ot-cell--status"><span class="admin-pill ${statusCls}">${esc(isPending ? 'Pending' : 'Fulfilled')}</span></td>
                <td class="ot-cell ot-cell--actions">
                    <button class="ot-expand-btn" data-ot-expand="${esc(o.orderId || '')}" title="Details">▼</button>
                </td>
            </tr>
            <tr class="ot-expand-row" data-ot-expand-parent="${esc(o.orderId || '')}" hidden><td colspan="9" class="ot-expand-cell">${detailHtml}</td></tr>`;
        }).join('');

        ordersList.innerHTML = `<div class="ot-container"><table class="ot-table">
            <thead><tr>
                <th class="ot-th ot-th--check"><input type="checkbox" class="ot-check-all" title="Select all"></th>
                <th class="ot-th ot-th--id">Order ID</th>
                <th class="ot-th ot-th--amount">Amount</th>
                <th class="ot-th ot-th--specs">Specs</th>
                <th class="ot-th ot-th--email">Email</th>
                <th class="ot-th ot-th--license">License</th>
                <th class="ot-th ot-th--date">Date</th>
                <th class="ot-th ot-th--status">Status</th>
                <th class="ot-th ot-th--actions"></th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table></div>`;

        // Expand toggle
        ordersList.querySelectorAll('.ot-expand-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.otExpand;
                const row = ordersList.querySelector(`tr[data-ot-expand-parent="${id}"]`);
                if (row) {
                    const isHidden = row.hidden;
                    row.hidden = !isHidden;
                    btn.textContent = isHidden ? '▲' : '▼';
                    btn.classList.toggle('is-open', isHidden);
                }
            });
        });

        // Select all
        const checkAll = ordersList.querySelector('.ot-check-all');
        if (checkAll) {
            checkAll.addEventListener('change', () => {
                const checked = checkAll.checked;
                ordersList.querySelectorAll('.ot-row .admin-row-check').forEach(cb => {
                    cb.checked = checked;
                    const id = cb.dataset.orderCheck;
                    if (id) { if (checked) selectedOrders.add(id); else selectedOrders.delete(id); }
                });
                updateBulkButtons();
            });
        }

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
        if (!l.isBound && !l._expiryStarted && l.plan !== 'lifetime') return 'unbound';
        return 'active';
    }

    function getLicenseSortValue(l, key) {
        if (key === 'status') return licenseStatusText(l);
        if (key === 'specs') {
            const specList = Array.isArray(l.specs) ? l.specs : [];
            // Handle both old string format and new object format
            return specList.map(s => typeof s === 'object' ? s.id : s).join(', ');
        }
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

        // Quick stats
        const activeCount = items.filter(l => l.active && !l.isExpired).length;
        const expiringCount = items.filter(l => {
            if (!l.active || l.plan === 'lifetime' || !l.expiresAt) return false;
            const ms = new Date(l.expiresAt).getTime() - Date.now();
            return ms > 0 && ms <= 7 * 24 * 60 * 60 * 1000;
        }).length;
        const expiredCount = items.filter(l => l.isExpired).length;
        const licActiveEl = document.getElementById('licActiveCount');
        const licExpiringEl = document.getElementById('licExpiringCount');
        const licExpiredEl = document.getElementById('licExpiredCount');
        const licPagerInfo = document.getElementById('licPagerInfo');
        if (licActiveEl) licActiveEl.textContent = activeCount;
        if (licExpiringEl) licExpiringEl.textContent = expiringCount;
        if (licExpiredEl) licExpiredEl.textContent = expiredCount;
        if (licPagerInfo) {
            const from = sorted.length ? (cur - 1) * pageSize + 1 : 0;
            const to = Math.min(cur * pageSize, sorted.length);
            licPagerInfo.textContent = `Showing ${from}–${to} of ${sorted.length} licenses`;
        }

        if (!slice.length) {
            licensesList.innerHTML = '<div class="admin-empty">No licenses found.</div>';
            return;
        }

        if (licenseViewMode === 'table') {
            renderLicensesTable(slice, q);
        } else {
            renderLicensesCards(slice, q);
        }

        // Copy key buttons
        licensesList.querySelectorAll('.lic-copy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const text = btn.dataset.copy;
                navigator.clipboard?.writeText(text).then(() => {
                    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--adm-accent)" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
                    setTimeout(() => {
                        btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`;
                    }, 1500);
                });
            });
        });

        updateBulkButtons();
    }

    function renderLicensesTable(slice, q) {
        const w = canWrite();
        const now = Date.now();
        const rows = slice.map(l => {
            const status = licenseStatusText(l);
            const checked = selectedLicenses.has(String(l.key || '')) ? 'checked' : '';
                const specList = Array.isArray(l.specs) ? l.specs : [];
            const specEntries = specList.map(s => {
                if (typeof s === 'string') return { id: s, label: specsMap.get(s) || s, expiresAt: null, isExpired: false };
                const id = String(s.id || '');
                const exp = s.expiresAt ? new Date(s.expiresAt) : null;
                const isExpired = exp ? exp.getTime() <= now : false;
                return { id, label: specsMap.get(id) || id, expiresAt: s.expiresAt, isExpired, addedAt: s.addedAt };
            });
            const activeSpecs = specEntries.filter(s => !s.isExpired);
            const expiredSpecs = specEntries.filter(s => s.isExpired);
            const email = l.email ? esc(l.email) : '';
            const isBound = !!l.isBound;
            const expiryStarted = isBound || !!l._expiryStarted;
            const timerNotStarted = !expiryStarted && l.plan !== 'lifetime';
            let pendingLabel;
            if (l._customDuration) {
                const { value, unit } = l._customDuration;
                pendingLabel = `${value}${unit.charAt(0)}`;
            } else {
                pendingLabel = `${l.pendingDurationMonths || 1}mo`;
            }
            const exp = l.plan === 'lifetime' ? 'Never' : timerNotStarted ? `Pending (${pendingLabel} on bind)` : fmtDate(l.expiresAt);
            const planLabel = { monthly: 'Monthly', monthly_per_spec: 'Per Spec', lifetime: 'Lifetime', custom: 'Custom' }[l.plan] || l.plan || 'Unknown';
            const planCls = { monthly: 'plan-monthly', monthly_per_spec: 'plan-spec', lifetime: 'plan-lifetime', custom: 'plan-custom' }[l.plan] || 'plan-custom';
            const statusCls = status === 'active' ? 'ok' : status === 'disabled' ? 'bad' : status === 'unbound' ? 'unbound' : 'warn';
            const boundIcon = l.isBound ? '🔗' : '—';

            // Specs summary for table
            let specsCell = '';
            if (l.plan === 'monthly_per_spec') {
                const activeChips = activeSpecs.slice(0, 2).map(x => `<span class="lt-spec lt-spec--active">${esc(x.label)}</span>`).join('');
                const expiredChips = expiredSpecs.slice(0, 1).map(x => `<span class="lt-spec lt-spec--expired">${esc(x.label)}</span>`).join('');
                const moreActive = activeSpecs.length > 2 ? `<span class="lt-spec lt-spec--more">+${activeSpecs.length - 2}</span>` : '';
                const moreExpired = expiredSpecs.length > 1 ? `<span class="lt-spec lt-spec--more lt-spec--expired-more">+${expiredSpecs.length - 1} exp</span>` : '';
                specsCell = activeChips + moreActive + expiredChips + moreExpired;
                if (!specEntries.length) specsCell = '<span class="lt-spec lt-spec--none">None</span>';
            } else {
                specsCell = '<span class="lt-spec lt-spec--all">All</span>';
            }

            // Expand detail for per-spec
            let expandHtml = '';
            if (l.plan === 'monthly_per_spec' && specEntries.length > 0) {
                const detailRows = specEntries.map(s => {
                    const expDate = s.expiresAt ? new Date(s.expiresAt) : null;
                    const isExpired = s.isExpired;
                    const daysLeft = expDate && !isExpired ? Math.max(0, Math.ceil((expDate - now) / 86400000)) : 0;
                    const rowCls = isExpired ? 'lt-detail-row--expired' : 'lt-detail-row--active';
                    const icon = isExpired
                        ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ff6464" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`
                        : `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#00DDB3" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
                    const expText = isExpired ? 'Expired' : s.expiresAt ? `${expDate.toLocaleDateString()} (${daysLeft}d)` : 'Pending (bind to start)';
                    const miniPct = isExpired ? 0 : s.expiresAt && s.addedAt
                        ? Math.max(0, Math.min(100, Math.round(((expDate - now) / (expDate - new Date(s.addedAt))) * 100)))
                        : 100;
                    const miniCls = miniPct < 20 ? 'lt-mini--danger' : miniPct < 50 ? 'lt-mini--warn' : 'lt-mini--ok';
                    return `<div class="lt-detail-row ${rowCls}">
                        <span class="lt-detail-icon">${icon}</span>
                        <span class="lt-detail-label">${esc(s.label)}</span>
                        <span class="lt-detail-exp">${expText}</span>
                        <div class="lt-mini-bar"><div class="lt-mini-fill ${miniCls}" style="width:${miniPct}%"></div></div>
                    </div>`;
                }).join('');
                expandHtml = `<div class="lt-expand" data-expand-key="${esc(l.key)}">
                    <div class="lt-expand-header">
                        <span>${activeSpecs.length} active</span>
                        ${expiredSpecs.length > 0 ? `<span class="lt-expand-expired">${expiredSpecs.length} expired</span>` : ''}
                    </div>
                    ${detailRows}
                </div>`;
            }

            return `<tr class="lt-row ${status === 'disabled' ? 'lt-row--disabled' : status === 'expired' ? 'lt-row--expired' : ''}" data-key="${esc(l.key)}">
                <td class="lt-cell lt-cell--check"><input type="checkbox" class="admin-row-check" data-license-check="${esc(l.key)}" ${checked}></td>
                <td class="lt-cell lt-cell--key">
                    <div class="lt-key-wrap">
                        <code class="lt-key-code">${highlight(l.key, q)}</code>
                        <button class="lic-copy-btn" data-copy="${esc(l.key)}" title="Copy">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                        </button>
                    </div>
                </td>
                <td class="lt-cell lt-cell--email">${email ? `<span class="lt-email" title="${esc(email)}">${highlight(email.length > 18 ? email.substring(0, 18) + '…' : email, q)}</span>` : '<span class="lt-email--none">—</span>'}</td>
                <td class="lt-cell lt-cell--plan"><span class="lic-plan-badge ${planCls} lt-plan-badge">${esc(planLabel)}</span></td>
                <td class="lt-cell lt-cell--specs"><div class="lt-specs-wrap">${specsCell}</div></td>
                <td class="lt-cell lt-cell--expiry">${l.plan === 'lifetime' ? '<span class="lt-never">∞ Never</span>' : `<span class="lt-expiry ${statusCls === 'warn' ? 'lt-expiry--expired' : ''}">${exp}</span>`}</td>
                <td class="lt-cell lt-cell--hwid">${l.isBound ? '<span class="lt-bound" title="HWID bound">🔗</span>' : '<span class="lt-unbound">—</span>'}</td>
                <td class="lt-cell lt-cell--status"><span class="admin-pill ${statusCls}">${esc(status)}</span></td>
                <td class="lt-cell lt-cell--actions">
                    <div class="lt-actions">
                        <button class="lt-act-btn" data-act="toggle" title="Toggle" ${w ? '' : 'disabled'}>⏻</button>
                        <button class="lt-act-btn" data-act="extend" title="+1 month" ${w ? '' : 'disabled'}>⏱</button>
                        <button class="lt-act-btn" data-act="reset" title="Reset HWID" ${w ? '' : 'disabled'}>↺</button>
                        <button class="lt-act-btn lt-act-btn--danger" data-act="delete" title="Delete" ${w ? '' : 'disabled'}>✕</button>
                        <button class="lt-act-btn" data-act="resend-email" title="Resend Email" ${w ? '' : 'disabled'}>✉</button>
                        ${expandHtml ? `<button class="lt-act-btn lt-expand-toggle" data-expand="${esc(l.key)}" title="Details">▼</button>` : ''}
                    </div>
                </td>
            </tr>
            ${expandHtml ? `<tr class="lt-expand-row" data-expand-parent="${esc(l.key)}" hidden><td colspan="9" class="lt-expand-cell">${expandHtml}</td></tr>` : ''}`;
        }).join('');

        licensesList.innerHTML = `<div class="lt-container"><table class="lt-table">
            <thead><tr>
                <th class="lt-th lt-th--check"><input type="checkbox" class="lt-check-all" title="Select all"></th>
                <th class="lt-th lt-th--key">Key</th>
                <th class="lt-th lt-th--email">Email</th>
                <th class="lt-th lt-th--plan">Plan</th>
                <th class="lt-th lt-th--specs">Specs</th>
                <th class="lt-th lt-th--expiry">Expires</th>
                <th class="lt-th lt-th--hwid">HWID</th>
                <th class="lt-th lt-th--status">Status</th>
                <th class="lt-th lt-th--actions">Actions</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table></div>`;

        // Expand toggle
        licensesList.querySelectorAll('.lt-expand-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const key = btn.dataset.expand;
                const row = licensesList.querySelector(`tr[data-expand-parent="${key}"]`);
                if (row) {
                    const isHidden = row.hidden;
                    row.hidden = !isHidden;
                    btn.textContent = isHidden ? '▲' : '▼';
                    btn.classList.toggle('is-open', isHidden);
                }
            });
        });

        // Select all checkbox
        const checkAll = licensesList.querySelector('.lt-check-all');
        if (checkAll) {
            checkAll.addEventListener('change', () => {
                const checked = checkAll.checked;
                licensesList.querySelectorAll('.lt-row .admin-row-check').forEach(cb => {
                    cb.checked = checked;
                    const key = cb.dataset.licenseCheck;
                    if (key) { if (checked) selectedLicenses.add(key); else selectedLicenses.delete(key); }
                });
                updateBulkButtons();
            });
        }
    }

    function renderLicensesCards(slice, q) {
        const now = Date.now();
        const w = canWrite();
        licensesList.innerHTML = slice.map((l) => {
            const specList = Array.isArray(l.specs) ? l.specs : [];
            const specEntries = specList.map(s => {
                if (typeof s === 'string') return { id: s, label: specsMap.get(s) || s, expiresAt: null, isExpired: false };
                const id = String(s.id || '');
                const exp = s.expiresAt ? new Date(s.expiresAt) : null;
                const isExpired = exp ? exp.getTime() <= now : false;
                return { id, label: specsMap.get(id) || id, expiresAt: s.expiresAt, isExpired, addedAt: s.addedAt };
            });
            const activeSpecs = specEntries.filter(s => !s.isExpired);
            const expiredSpecs = specEntries.filter(s => s.isExpired);
                const email = l.email ? esc(l.email) : '';
                const emailDisplay = email || 'No email';
            const isBound = !!l.isBound;
            const expiryStarted = isBound || !!l._expiryStarted;
            const timerNotStarted = !expiryStarted && l.plan !== 'lifetime';
            let pendingLabel;
            if (l._customDuration) {
                const { value, unit } = l._customDuration;
                pendingLabel = `${value}${unit.charAt(0)}`;
            } else {
                pendingLabel = `${l.pendingDurationMonths || 1}mo`;
            }
            const exp = l.plan === 'lifetime' ? 'Never' : timerNotStarted ? `Timer pending (${pendingLabel} on bind)` : fmtDate(l.expiresAt);
                const status = licenseStatusText(l);
                const checked = selectedLicenses.has(String(l.key || '')) ? 'checked' : '';
            const planColors = { monthly: 'plan-monthly', monthly_per_spec: 'plan-spec', lifetime: 'plan-lifetime', custom: 'plan-custom' };
                const planCls = planColors[l.plan] || 'plan-custom';
            const planLabel = { monthly: 'Monthly', monthly_per_spec: 'Per Spec', lifetime: 'Lifetime', custom: 'Custom' }[l.plan] || (l.plan || 'Unknown');
                let expiryBar = '';
            if (timerNotStarted) {
                expiryBar = `<div class="lic-card-expiry"><div class="lic-expiry-bar"><div class="lic-expiry-fill bar-pending" style="width:100%"></div></div><span class="lic-expiry-label">${exp}</span></div>`;
            } else if (l.plan !== 'lifetime' && l.expiresAt && l.boundAt) {
                const total = new Date(l.expiresAt) - new Date(l.boundAt);
                const remaining = new Date(l.expiresAt) - Date.now();
                const expiryPct = Math.max(0, Math.min(100, Math.round((remaining / total) * 100)));
                const barCls = expiryPct < 20 ? 'bar-danger' : expiryPct < 50 ? 'bar-warn' : 'bar-ok';
                expiryBar = `<div class="lic-card-expiry"><div class="lic-expiry-bar"><div class="lic-expiry-fill ${barCls}" style="width:${expiryPct}%"></div></div><span class="lic-expiry-label">${exp}</span></div>`;
            } else if (l.plan !== 'lifetime' && l.expiresAt && l.createdAt) {
                    const total = new Date(l.expiresAt) - new Date(l.createdAt);
                    const remaining = new Date(l.expiresAt) - Date.now();
                const expiryPct = Math.max(0, Math.min(100, Math.round((remaining / total) * 100)));
                    const barCls = expiryPct < 20 ? 'bar-danger' : expiryPct < 50 ? 'bar-warn' : 'bar-ok';
                expiryBar = `<div class="lic-card-expiry"><div class="lic-expiry-bar"><div class="lic-expiry-fill ${barCls}" style="width:${expiryPct}%"></div></div><span class="lic-expiry-label">${exp}</span></div>`;
                } else if (l.plan === 'lifetime') {
                expiryBar = `<div class="lic-card-expiry"><div class="lic-expiry-bar"><div class="lic-expiry-fill bar-lifetime" style="width:100%"></div></div><span class="lic-expiry-label">Never expires</span></div>`;
            }
            let specDetailHtml = '';
            if (l.plan === 'monthly_per_spec' && specEntries.length > 0) {
                const rows = specEntries.map(s => {
                    const expDate = s.expiresAt ? new Date(s.expiresAt) : null;
                    const isExpired = s.isExpired;
                    const daysLeft = expDate && !isExpired ? Math.max(0, Math.ceil((expDate - now) / 86400000)) : 0;
                    const rowCls = isExpired ? 'lic-spec-row--expired' : 'lic-spec-row--active';
                    const statusIcon = isExpired
                        ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ff6464" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`
                        : `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#00DDB3" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
                    const expiryText = isExpired
                        ? `<span class="lic-spec-exp-text lic-spec-exp-text--expired">Expired</span>`
                        : s.expiresAt
                        ? `<span class="lic-spec-exp-text">Expires ${expDate.toLocaleDateString()} <span class="lic-spec-days">(${daysLeft}d left)</span></span>`
                        : `<span class="lic-spec-exp-text">Pending (bind to start)</span>`;
                    const miniBarPct = isExpired ? 0 : s.expiresAt && s.addedAt
                        ? Math.max(0, Math.min(100, Math.round(((expDate - now) / (expDate - new Date(s.addedAt))) * 100)))
                        : 100;
                    const miniBarCls = miniBarPct < 20 ? 'lic-mini-bar--danger' : miniBarPct < 50 ? 'lic-mini-bar--warn' : 'lic-mini-bar--ok';
                    return `<div class="lic-spec-row ${rowCls}">
                        <div class="lic-spec-row-left">${statusIcon}<span class="lic-spec-row-label">${esc(s.label)}</span></div>
                        <div class="lic-spec-row-right">${expiryText}<div class="lic-mini-bar"><div class="lic-mini-bar-fill ${miniBarCls}" style="width:${miniBarPct}%"></div></div></div>
                    </div>`;
                }).join('');
                specDetailHtml = `<div class="lic-spec-detail">
                    <div class="lic-spec-detail-header">
                        <span class="lic-spec-detail-title">Specializations</span>
                        <div class="lic-spec-detail-counts">
                            <span class="lic-spec-count lic-spec-count--active">${activeSpecs.length} active</span>
                            ${expiredSpecs.length > 0 ? `<span class="lic-spec-count lic-spec-count--expired">${expiredSpecs.length} expired</span>` : ''}
                            </div>
                    </div>
                    <div class="lic-spec-detail-rows">${rows}</div>
                        </div>`;
            } else if (l.plan === 'monthly_per_spec' && specEntries.length === 0) {
                specDetailHtml = `<div class="lic-spec-detail"><div class="lic-spec-detail-header"><span class="lic-spec-detail-title">Specializations</span></div><div class="lic-spec-detail-rows"><div class="lic-spec-row lic-spec-row--empty">No specs assigned</div></div></div>`;
            }
            let simpleSpecsHtml = '';
            if (l.plan !== 'monthly_per_spec') {
                simpleSpecsHtml = `<div class="lic-card-specs-simple"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--adm-text-3)" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg><span>All Specializations</span></div>`;
            }
                const boundBadge = l.isBound
                ? `<span class="lic-bound-badge is-bound"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>Bound</span>`
                : `<span class="lic-bound-badge is-unbound"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>Unbound</span>`;
            const initials = email ? email.substring(0, 2).toUpperCase() : (l.plan || '?').substring(0, 2).toUpperCase();
                const statusCls = status === 'active' ? 'status-ok' : status === 'disabled' ? 'status-bad' : 'status-warn';
            return `<div class="lic-card ${statusCls === 'status-bad' ? 'lic-card--disabled' : statusCls === 'status-warn' ? 'lic-card--expired' : ''}" data-key="${esc(l.key)}">
                    <div class="lic-card-header">
                        <div class="lic-card-header-left">
                        <div class="lic-card-check"><input type="checkbox" class="lic-check-input admin-row-check" data-license-check="${esc(l.key)}" ${checked} id="lic-cb-${esc(l.key)}"><label class="lic-check-label" for="lic-cb-${esc(l.key)}"></label></div>
                        <div class="lic-avatar ${statusCls === 'status-ok' ? 'lic-avatar--active' : statusCls === 'status-warn' ? 'lic-avatar--expired' : 'lic-avatar--disabled'}">${esc(initials)}</div>
                            <div class="lic-card-identity">
                            <div class="lic-card-key"><code class="lic-key-code">${highlight(l.key, q)}</code><button class="lic-copy-btn" data-copy="${esc(l.key)}" title="Copy key"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button></div>
                            <div class="lic-card-meta">${email ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg><span>${highlight(emailDisplay, q)}</span>` : `<span style="color:var(--adm-text-3)">No email</span>`}</div>
                            </div>
                        </div>
                        <div class="lic-card-header-right">
                            <span class="lic-plan-badge ${planCls}">${esc(planLabel)}</span>
                            ${boundBadge}
                            <span class="admin-pill ${status === 'active' ? 'ok' : status === 'disabled' ? 'bad' : 'warn'}">${esc(status)}</span>
                        </div>
                    </div>
                ${specDetailHtml || simpleSpecsHtml}
                    ${expiryBar}
                    <div class="lic-card-footer">
                        <div class="lic-card-actions">
                        <button class="lic-action-btn" data-act="toggle" title="Toggle active" ${w ? '' : 'disabled'}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="5" width="22" height="14" rx="7"/><circle cx="${l.active ? '16' : '8'}" cy="12" r="3"/></svg>Toggle</button>
                        <button class="lic-action-btn" data-act="extend" title="+1 month" ${w ? '' : 'disabled'}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>+1 Month</button>
                        <button class="lic-action-btn" data-act="reset" title="Reset HWID" ${w ? '' : 'disabled'}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>Reset HWID</button>
                        <button class="lic-action-btn lic-action-danger" data-act="delete" title="Delete" ${w ? '' : 'disabled'}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>Delete</button>
                        <button class="lic-action-btn" data-act="resend-email" title="Resend Email" ${w ? '' : 'disabled'}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>Email</button>
                        </div>
                    </div>
                </div>`;
        }).join('');
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
        } else if (act === 'resend-email') {
            const result = await adminFetch(`/api/admin/licenses/${encodeURIComponent(key)}/resend-email`, { method: 'POST' });
            window.adminToast(result.email ? `Email sent to ${result.email}` : 'Email sent', 'success');
        }
    }

    async function loadConfig() {
        try {
            const res = await fetch('/api/specs', { cache: 'no-store' });
            const data = await res.json();
            if (configPriceInput) {
                configPriceInput.value = data.pricePerSpecUsdPerMonth || 6;
            }
            if (configPlanMonthly) {
                configPlanMonthly.value = data.priceMonthlyAll || 30;
            }
            if (configPlan3Month) {
                configPlan3Month.value = data.price3MonthAll || 75;
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
        await Promise.all([loadOrders(), loadLicenses(), loadConfig()]);
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

    // ── CREATE LICENSE MULTI-STEP WIZARD ──
    const planCards = document.querySelectorAll('.create-plan-card');
    const stepEls = document.querySelectorAll('.create-step');
    const stepPanels = [
        document.getElementById('createStep1'),
        document.getElementById('createStep2'),
        document.getElementById('createStep3'),
    ];
    const reviewSummary = document.getElementById('createReviewSummary');
    const specsCountEl = document.getElementById('createSpecsCount');
    const specsSearchEl = document.getElementById('createSpecsSearch');
    let currentCreateStep = 1;

    // Plan card click
    planCards.forEach(card => {
        card.addEventListener('click', () => {
            planCards.forEach(c => c.classList.remove('is-selected'));
            card.classList.add('is-selected');
            const radio = card.querySelector('input[type=radio]');
            if (radio) radio.checked = true;
            if (createPlan) createPlan.value = card.dataset.plan;
            syncCreatePlanInputs();
        });
    });

    // Step navigation
    function goToStep(step) {
        currentCreateStep = step;
        stepPanels.forEach((p, i) => {
            if (p) p.hidden = (i + 1) !== step;
        });
        stepEls.forEach(el => {
            const s = Number(el.dataset.step);
            el.classList.remove('is-active', 'is-done');
            if (s === step) el.classList.add('is-active');
            else if (s < step) el.classList.add('is-done');
        });
        // Update step lines
        const lines = document.querySelectorAll('.create-step-line');
        lines.forEach((line, i) => {
            if (i < step - 1) line.style.background = 'var(--adm-accent)';
            else line.style.background = 'var(--adm-border)';
        });
        // Build review on step 3
        if (step === 3) buildReviewSummary();
    }

    document.querySelectorAll('.create-next-btn, .create-back-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const goto = Number(btn.dataset.goto);
            if (goto) goToStep(goto);
        });
    });

    // Specs search filter
    if (specsSearchEl) {
        specsSearchEl.addEventListener('input', () => {
            const q = specsSearchEl.value.toLowerCase().trim();
            document.querySelectorAll('#createSpecsContainer .admin-multi-check').forEach(label => {
                const text = label.textContent.toLowerCase();
                label.style.display = !q || text.includes(q) ? '' : 'none';
            });
        });
    }

    // Update specs count
    if (createSpecsContainer) {
        createSpecsContainer.addEventListener('change', () => {
            const count = document.querySelectorAll('.create-spec-cb:checked').length;
            if (specsCountEl) specsCountEl.textContent = `${count} selected`;
        });
    }

    function buildReviewSummary() {
        if (!reviewSummary) return;
        const plan = createPlan ? createPlan.value : 'monthly';
        const planNames = { monthly: 'Monthly', monthly_per_spec: 'Per Spec', lifetime: 'Lifetime', custom: 'Custom' };
        const email = createEmail ? (createEmail.value || '').trim() : '';
        const selectedSpecs = Array.from(document.querySelectorAll('.create-spec-cb:checked')).map(cb => {
            const label = cb.parentElement?.textContent?.trim() || cb.value;
            return label;
        });

        let durationText = '';
        if (plan === 'lifetime') {
            durationText = 'Never expires';
        } else if (plan === 'custom') {
            durationText = `${createDurationValue?.value || 1} ${createDurationUnit?.value || 'minutes'}`;
        } else {
            durationText = `${createMonths?.value || 1} month(s)`;
        }

        reviewSummary.innerHTML = `
            <div class="create-review-item">
                <div class="create-review-label">Plan</div>
                <div class="create-review-value">${esc(planNames[plan] || plan)}</div>
            </div>
            <div class="create-review-item">
                <div class="create-review-label">Duration</div>
                <div class="create-review-value">${esc(durationText)}</div>
            </div>
            <div class="create-review-item">
                <div class="create-review-label">Email</div>
                <div class="create-review-value">${email ? esc(email) : '<span style="color:var(--adm-text-3)">Not set</span>'}</div>
            </div>
            <div class="create-review-item">
                <div class="create-review-label">Specs (${selectedSpecs.length})</div>
                <div class="create-review-value">${selectedSpecs.length ? selectedSpecs.map(s => `<code>${esc(s)}</code>`).join(' ') : '<span style="color:var(--adm-text-3)">None selected</span>'}</div>
            </div>
        `;
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
            if (specsCountEl) specsCountEl.textContent = '0 selected';
            // Reset to step 1
            goToStep(1);
            planCards.forEach(c => c.classList.remove('is-selected'));
            planCards[0]?.classList.add('is-selected');
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
                    body: JSON.stringify({ 
                        price: Number(configPriceInput.value),
                        priceMonthlyAll: Number(configPlanMonthly.value),
                        price3MonthAll: Number(configPlan3Month.value)
                    }),
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

    // License Filter Tabs
    const licTabs = document.querySelectorAll('.lic-tab');
    if (licTabs.length > 0) {
        licTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const view = tab.getAttribute('data-view') || '';
                
                // Update UI
                licTabs.forEach(t => t.classList.remove('is-active'));
                tab.classList.add('is-active');

                // Sync and apply state
                if (licensesSavedView) licensesSavedView.value = view;
                state.savedViews.licenses = view;
                localStorage.setItem('adminSavedViewLicenses', view);
                
                applyLicenseSavedView(view);
                refreshAll().catch(() => {});
            });
        });
    }

    // Initialize Active Tab
    if (state.savedViews.licenses) {
        licTabs.forEach(tab => {
            tab.classList.toggle('is-active', (tab.getAttribute('data-view') || '') === state.savedViews.licenses);
        });
    }

    // Orders Filter Tabs
    const ordTabs = document.querySelectorAll('.ord-tab');
    if (ordTabs.length > 0) {
        ordTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const view = tab.getAttribute('data-view') || '';
                ordTabs.forEach(t => t.classList.remove('is-active'));
                tab.classList.add('is-active');
                if (ordersStatus) ordersStatus.value = view;
                loadOrders().catch(() => {});
            });
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
        // Support .admin-action-btn, .lic-action-btn (cards), and .lt-act-btn (table)
        const btn = e.target.closest('.admin-action-btn, .lic-action-btn, .lt-act-btn');
        if (!btn) return;
        const card = e.target.closest('[data-key]');
        if (!card) return;
        const key = card.getAttribute('data-key');
        const act = btn.getAttribute('data-act');
        if (!act) return; // skip expand toggle etc.
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

    // License view toggle (table / cards)
    const viewToggle = document.getElementById('licViewToggle');
    if (viewToggle) {
        const btns = viewToggle.querySelectorAll('.lic-view-btn');
        const setActive = (mode) => {
            licenseViewMode = mode;
            localStorage.setItem('adminLicView', mode);
            btns.forEach(b => b.classList.toggle('is-active', b.dataset.view === mode));
            renderLicenses();
        };
        btns.forEach(b => b.addEventListener('click', () => setActive(b.dataset.view)));
        // Sync initial state
        btns.forEach(b => b.classList.toggle('is-active', b.dataset.view === licenseViewMode));
    }

    initSectionNavigation();

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k') {
            if (!globalSearch) return;
            e.preventDefault();
            globalSearch.focus();
            globalSearch.select();
        }
    });

    // ── Sidebar toggle ──
    const sidebarToggleBtn = document.getElementById('sidebarToggle');
    if (sidebarToggleBtn) {
        const collapsed = localStorage.getItem('adminSidebarCollapsed') === 'true';
        if (collapsed) document.body.classList.add('sidebar-collapsed');
        sidebarToggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('sidebar-collapsed');
            localStorage.setItem('adminSidebarCollapsed', document.body.classList.contains('sidebar-collapsed'));
        });
    }

    // ── Toast notifications ──
    window.adminToast = function(message, type = 'info') {
        const container = document.getElementById('adminToastContainer');
        if (!container) return;
        const icons = {
            success: '✓',
            error: '✕',
            info: 'ℹ',
            warn: '⚠',
        };
        const toast = document.createElement('div');
        toast.className = `admin-toast toast-${type}`;
        toast.innerHTML = `<span style="font-size:16px;">${icons[type] || icons.info}</span> ${esc(message)}`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 4200);
    };

    // Override setCreateMessage to also show toast
    const origSetCreateMsg = setCreateMessage;
    setCreateMessage = function(msg, isError) {
        origSetCreateMsg(msg, isError);
        if (msg) window.adminToast(msg, isError ? 'error' : 'success');
    };

    // ── Live Activity Feed (WebSocket) ──
    const activityFeed = document.getElementById('adminActivityFeed');
    const liveDot = document.getElementById('adminLiveDot');
    const activityItems = [];
    let ws = null;

    function renderActivityItem(item) {
        const typeMap = {
            'license.create': { icon: '+', cls: 'type-create', verb: 'created license' },
            'license.toggle_active': { icon: '⟳', cls: 'type-activate', verb: 'toggled license' },
            'license.extend': { icon: '↑', cls: 'type-activate', verb: 'extended license' },
            'license.delete': { icon: '✕', cls: 'type-delete', verb: 'deleted license' },
            'license.reset_hwid': { icon: '↻', cls: 'type-activate', verb: 'reset HWID for' },
            'license.bulk_delete': { icon: '✕✕', cls: 'type-delete', verb: 'bulk deleted licenses' },
            'order.create': { icon: '$', cls: 'type-payment', verb: 'new order' },
            'order.fulfill': { icon: '✓', cls: 'type-create', verb: 'fulfilled order' },
            'order.delete': { icon: '✕', cls: 'type-delete', verb: 'deleted order' },
            'config.update_price': { icon: '⚙', cls: 'type-activate', verb: 'updated pricing' },
            'audit.clear': { icon: '🗑', cls: 'type-delete', verb: 'cleared audit log' },
        };
        const info = typeMap[item.action] || { icon: '•', cls: 'type-activate', verb: item.action || 'action' };
        const actor = item.actor ? (item.actor.name || 'admin') : 'system';
        const details = item.details ? (item.details.key || item.details.orderId || '') : '';
        const time = item.at ? new Date(item.at).toLocaleTimeString() : '';

        return `<div class="admin-activity-item">
            <div class="admin-activity-icon ${info.cls}">${info.icon}</div>
            <div class="admin-activity-text"><strong>${esc(actor)}</strong> ${esc(info.verb)} ${details ? `<code>${esc(details)}</code>` : ''}</div>
            <div class="admin-activity-time">${esc(time)}</div>
        </div>`;
    }

    function renderActivityFeed() {
        if (!activityFeed) return;
        if (activityItems.length === 0) {
            activityFeed.innerHTML = '<div class="admin-empty">Waiting for activity...</div>';
            return;
        }
        activityFeed.innerHTML = activityItems.map(renderActivityItem).join('');
    }

    function connectWebSocket() {
        if (ws) { try { ws.close(); } catch(_) {} }
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Pass admin token for server-side authentication
        const url = `${protocol}//${location.host}/ws/admin?token=${encodeURIComponent(token || '')}`;
        ws = new WebSocket(url);

        ws.onopen = () => {
            if (liveDot) {
                liveDot.style.background = 'var(--adm-accent)';
                liveDot.style.boxShadow = '0 0 8px rgba(0,229,192,0.5)';
            }
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                activityItems.unshift(data);
                if (activityItems.length > 50) activityItems.length = 50;
                renderActivityFeed();
                // Toast for important events
                if (data.action && data.action.includes('create')) {
                    window.adminToast(`New: ${data.action}`, 'success');
                }
            } catch (_) {}
        };

        ws.onclose = () => {
            if (liveDot) {
                liveDot.style.background = 'var(--adm-danger)';
                liveDot.style.boxShadow = '0 0 8px rgba(255,90,90,0.5)';
            }
            // Reconnect after 5 seconds
            setTimeout(() => {
                if (token) connectWebSocket();
            }, 5000);
        };

        ws.onerror = () => { try { ws.close(); } catch(_) {} };
    }

    // Load initial activity from audit
    async function loadInitialActivity() {
        if (!activityFeed) return;
        try {
            const data = await adminFetch('/api/admin/audit?limit=20');
            if (Array.isArray(data.items)) {
                activityItems.length = 0;
                data.items.forEach(item => activityItems.push(item));
                renderActivityFeed();
            }
        } catch (_) {}
    }

    // Start WebSocket after login
    const origSetAuth = setAuthenticated;
    setAuthenticated = function(on) {
        origSetAuth(on);
        if (on) {
            connectWebSocket();
            loadInitialActivity();
        } else {
            if (ws) { try { ws.close(); } catch(_) {} ws = null; }
        }
    };
});
