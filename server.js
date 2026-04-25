const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const __root = __dirname;
const DB_FILE = path.join(__root, 'licenses.json');
const PENDING_ORDERS_FILE = path.join(__root, 'pending_orders.json');
const SPECS_FILE = path.join(__root, 'public', 'data', 'specs.json');
const NOWPAYMENTS_API = 'https://api.nowpayments.io/v1';

app.use(express.static(path.join(__root, 'public')));
// Note: /specs images are now served natively from public/specs directory

function publicBaseUrl() {
    const u = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
    return u || null;
}

function loadSpecsCatalog() {
    if (!fs.existsSync(SPECS_FILE)) {
        return { pricePerSpecUsdPerMonth: 6, currency: 'USD', specs: [] };
    }
    return JSON.parse(fs.readFileSync(SPECS_FILE, 'utf8'));
}

function validSpecIdsSet() {
    const cat = loadSpecsCatalog();
    return new Set(cat.specs.map((s) => s.id));
}

function selectedSpecsMeta(specIds) {
    const cat = loadSpecsCatalog();
    const map = new Map((cat.specs || []).map((s) => [String(s.id), String(s.label || s.id)]));
    const ids = Array.isArray(specIds) ? [...new Set(specIds.map((s) => String(s)))] : [];
    const labels = ids.map((id) => map.get(id) || id);
    return { ids, labels };
}

function selectedSpecsShortText(specIds, maxLen = 180) {
    const { labels } = selectedSpecsMeta(specIds);
    const raw = labels.join(', ');
    if (raw.length <= maxLen) return raw;
    return `${raw.slice(0, Math.max(0, maxLen - 3))}...`;
}

function generateLicenseKey() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const part = () =>
        Array.from({ length: 4 }, () => chars[crypto.randomInt(chars.length)]).join('');
    return [part(), part(), part(), part()].join('-');
}

function normalizeLicenseKey(value) {
    const raw = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const clipped = raw.slice(0, 16);
    const chunks = clipped.match(/.{1,4}/g) || [];
    return chunks.join('-');
}

function adminToken() {
    return String(process.env.ADMIN_TOKEN || '').trim();
}

function getAdminAccounts() {
    const out = [];
    const single = adminToken();
    if (single) {
        out.push({ role: 'owner', token: single, name: 'owner' });
    }

    const rawJson = String(process.env.ADMIN_ACCOUNTS_JSON || '').trim();
    if (rawJson) {
        try {
            const parsed = JSON.parse(rawJson);
            if (Array.isArray(parsed)) {
                parsed.forEach((item) => {
                    if (!item || typeof item !== 'object') return;
                    const role = String(item.role || '').trim().toLowerCase();
                    const token = String(item.token || '').trim();
                    const name = String(item.name || role || 'admin').trim().slice(0, 80);
                    if (!token) return;
                    if (role !== 'owner' && role !== 'support') return;
                    out.push({ role, token, name });
                });
            }
        } catch {
            // ignore invalid json
        }
    }
    return out;
}

const { 
    initDB, 
    loadDB, 
    saveDB, 
    loadPendingOrders, 
    savePendingOrders, 
    findPendingByOrderId, 
    upsertPendingOrder, 
    deletePendingOrder, 
    appendAudit, 
    readAudit 
} = require('./database');

// We initialize the Postgres table on startup
initDB().catch(console.error);

function requireAdmin(minRole = 'support') {
    return (req, res, next) => {
        const accounts = getAdminAccounts();
        if (!accounts.length) {
            return res.status(503).json({ error: 'Admin API disabled: set ADMIN_TOKEN or ADMIN_ACCOUNTS_JSON' });
        }

        const provided = String(
            req.get('x-admin-token') || req.query.token || (req.body && req.body.adminToken) || ''
        ).trim();
        const matched = accounts.find((a) => a.token === provided);
        if (!matched) {
            return res.status(401).json({ error: 'Unauthorized admin request' });
        }

        if (minRole === 'owner' && matched.role !== 'owner') {
            return res.status(403).json({ error: 'Owner role required for this action' });
        }

        req.admin = {
            role: matched.role,
            name: matched.name,
        };
        return next();
    };
}

function adminActor(req) {
    const name = req.admin?.name || 'admin';
    const role = req.admin?.role || 'unknown';
    return { name, role };
}

function auditAdmin(req, action, details) {
    appendAudit({
        actor: adminActor(req),
        action,
        details: details || {},
        ip: req.ip || '',
    }).catch(console.error);
}

function adminApiUnavailable() {
    return !getAdminAccounts().length;
}

function requireAdminLegacy(req, res, next) {
    if (adminApiUnavailable()) {
        return res.status(503).json({ error: 'Admin API disabled: set ADMIN_TOKEN in server environment' });
    }
    return requireAdmin()(req, res, next);
}

async function buildAdminStats() {
    const db = await loadDB();
    const orders = await loadPendingOrders();
    const now = new Date();
    const licenses = Object.entries(db).map(([key, value]) => ({ key, ...value }));
    const active = licenses.filter((l) => l.active && (l.plan === 'lifetime' || new Date(l.expiresAt) > now));
    const expired = licenses.filter((l) => l.plan !== 'lifetime' && new Date(l.expiresAt) <= now);
    const monthlyPerSpec = licenses.filter((l) => l.plan === 'monthly_per_spec').length;
    const pendingOrders = orders.filter((o) => String(o.status || 'pending') !== 'fulfilled').length;
    const fulfilledOrders = orders.filter((o) => String(o.status || '') === 'fulfilled').length;
    return {
        totalLicenses: licenses.length,
        activeLicenses: active.length,
        expiredLicenses: expired.length,
        monthlyPerSpecLicenses: monthlyPerSpec,
        pendingOrders,
        fulfilledOrders,
    };
}

function normalizeOrderId(value) {
    return String(value || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9-]/g, '')
        .slice(0, 120);
}

function licenseHasPaymentId(db, paymentId) {
    if (!paymentId) return false;
    return Object.values(db).some((l) => String(l.npPaymentId || '') === String(paymentId));
}

/** Deep-sort object keys for NOWPayments IPN signature (HMAC-SHA512). */
function sortKeysDeep(value) {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(sortKeysDeep);
    const out = {};
    Object.keys(value)
        .sort()
        .forEach((k) => {
            out[k] = sortKeysDeep(value[k]);
        });
    return out;
}

function verifyNowpaymentsIpnSignature(bodyObj, signatureHeader, ipnSecret) {
    if (!ipnSecret) return true;
    if (!signatureHeader || typeof signatureHeader !== 'string') return false;
    const payload = JSON.stringify(sortKeysDeep(bodyObj));
    const h = crypto.createHmac('sha512', ipnSecret).update(payload).digest('hex');
    const sig = signatureHeader.trim().toLowerCase();
    return h.toLowerCase() === sig;
}

async function nowpaymentsCreateInvoice(body) {
    const key = process.env.NOWPAYMENTS_API_KEY;
    if (!key) throw new Error('NOWPAYMENTS_API_KEY is not set');
    const res = await fetch(`${NOWPAYMENTS_API}/invoice`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
        },
        body: JSON.stringify(body),
    });
    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error(text || `NOWPayments HTTP ${res.status}`);
    }
    if (!res.ok) {
        const msg = data.message || data.error || text || `HTTP ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

function licenseAllowsSpec(license, specId) {
    if (!specId) return true;
    if (license.plan === 'lifetime' || license.plan === 'monthly') {
        return true;
    }
    if (license.plan === 'monthly_per_spec') {
        if (!license.specs || !Array.isArray(license.specs) || license.specs.length === 0) {
            return false;
        }
        return license.specs.includes(specId);
    }
    if (!license.specs || !Array.isArray(license.specs) || license.specs.length === 0) {
        return true;
    }
    return license.specs.includes(specId);
}

// ── API: Spec catalog ──
app.get('/api/specs', (req, res) => {
    res.json(loadSpecsCatalog());
});

// ── API: Checkout config (what the UI can rely on) ──
app.get('/api/checkout/config', (req, res) => {
    const base = publicBaseUrl();
    res.json({
        invoiceEnabled: !!(process.env.NOWPAYMENTS_API_KEY && base),
        publicBaseUrl: base,
    });
});

// ── API: Legacy draft (manual JSON flow) ──
app.post('/api/checkout-draft', async (req, res) => {
    const allowed = validSpecIdsSet();
    const cat = loadSpecsCatalog();
    const priceEach = cat.pricePerSpecUsdPerMonth || 6;

    const { specIds, email } = req.body || {};
    if (!Array.isArray(specIds) || specIds.length === 0) {
        return res.status(400).json({ error: 'Select at least one specialization.' });
    }

    const normalized = [...new Set(specIds.map((s) => String(s)))];
    for (const id of normalized) {
        if (!allowed.has(id)) {
            return res.status(400).json({ error: `Unknown spec: ${id}` });
        }
    }

    const amountUsd = normalized.length * priceEach;
    const orderId = `MCA-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const specMeta = selectedSpecsMeta(normalized);
    await upsertPendingOrder({
        kind: 'per_spec_monthly',
        orderId,
        specIds: specMeta.ids,
        specLabels: specMeta.labels,
        selectedSummary: selectedSpecsShortText(specMeta.ids),
        amountUsd,
        currency: cat.currency || 'USD',
        email: email ? String(email).slice(0, 200) : null,
        createdAt: new Date().toISOString(),
        status: 'pending',
    });

    res.json({
        mode: 'manual',
        orderId,
        reference: orderId,
        specIds: normalized,
        specCount: normalized.length,
        pricePerSpecUsdPerMonth: priceEach,
        amountUsd,
        currency: cat.currency || 'USD',
        message:
            'If invoice checkout is disabled, paste the JSON from the checkout window into your payment order description.',
    });
});

// ── API: Professional checkout — NOWPayments invoice + IPN ──
app.post('/api/checkout/per-spec', async (req, res) => {
    const allowed = validSpecIdsSet();
    const cat = loadSpecsCatalog();
    const priceEach = cat.pricePerSpecUsdPerMonth || 6;
    const base = publicBaseUrl();
    const apiKey = process.env.NOWPAYMENTS_API_KEY;

    const { specIds, email } = req.body || {};
    if (!Array.isArray(specIds) || specIds.length === 0) {
        return res.status(400).json({ error: 'Select at least one specialization.' });
    }

    const em = (email && String(email).trim()) || '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        return res.status(400).json({ error: 'Enter a valid email for license delivery.' });
    }

    const normalized = [...new Set(specIds.map((s) => String(s)))];
    for (const id of normalized) {
        if (!allowed.has(id)) {
            return res.status(400).json({ error: `Unknown spec: ${id}` });
        }
    }

    const amountUsd = Number((normalized.length * priceEach).toFixed(2));
    const orderId = `MCA-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const specMeta = selectedSpecsMeta(normalized);
    await upsertPendingOrder({
        kind: 'per_spec_monthly',
        orderId,
        specIds: specMeta.ids,
        specLabels: specMeta.labels,
        selectedSummary: selectedSpecsShortText(specMeta.ids),
        amountUsd,
        currency: cat.currency || 'USD',
        email: em.slice(0, 200),
        createdAt: new Date().toISOString(),
        status: 'pending',
    });

    if (!apiKey || !base) {
        return res.json({
            mode: 'manual',
            orderId,
            specIds: normalized,
            amountUsd,
            currency: cat.currency || 'USD',
            pricePerSpecUsdPerMonth: priceEach,
            message:
                'Set NOWPAYMENTS_API_KEY and PUBLIC_BASE_URL on the server to enable automatic crypto checkout.',
        });
    }

    const ipnUrl = `${base}/api/webhook/nowpayments`;
    const successUrl = `${base}/payment-success.html?order=${encodeURIComponent(orderId)}`;
    const cancelUrl = `${base}/index.html#spec-store`;

    const invoiceBody = {
        price_amount: amountUsd,
        price_currency: (cat.currency || 'usd').toLowerCase(),
        order_id: orderId,
        order_description: `Max Combat Assistant — ${normalized.length} spec(s): ${selectedSpecsShortText(normalized, 120)}`,
        ipn_callback_url: ipnUrl,
        success_url: successUrl,
        cancel_url: cancelUrl,
    };

    const payCurrency = (process.env.NOWPAYMENTS_PAY_CURRENCY || '').trim();
    if (payCurrency) invoiceBody.pay_currency = payCurrency.toLowerCase();

    try {
        const inv = await nowpaymentsCreateInvoice(invoiceBody);
        const invoiceUrl = inv.invoice_url || inv.invoiceUrl;
        const npId = inv.id != null ? String(inv.id) : null;

        await upsertPendingOrder({
            orderId,
            npInvoiceId: npId,
            invoiceUrl,
        });

        return res.json({
            mode: 'invoice',
            orderId,
            invoiceUrl,
            specIds: normalized,
            amountUsd,
            currency: cat.currency || 'USD',
            pricePerSpecUsdPerMonth: priceEach,
        });
    } catch (e) {
        console.error('NOWPayments invoice error:', e.message || e);
        return res.status(502).json({
            error: 'Payment provider error',
            detail: e.message || String(e),
            mode: 'manual',
            orderId,
            specIds: normalized,
            amountUsd,
        });
    }
});

// ── API: Validate License & Bind HWID ──
app.post('/api/validate', async (req, res) => {
    const { key, hwid, spec } = req.body;

    if (!key || !hwid) {
        return res.json({ valid: false, message: 'Missing key or HWID' });
    }

    const db = await loadDB();
    const license = db[key];

    if (!license) {
        return res.json({ valid: false, message: 'License key not found' });
    }

    if (!license.active) {
        return res.json({ valid: false, message: 'License is disabled/banned' });
    }

    const now = new Date();
    const expiresAt = new Date(license.expiresAt);

    if (now > expiresAt && license.plan !== 'lifetime') {
        return res.json({ valid: false, message: 'License has expired' });
    }

    if (!licenseAllowsSpec(license, spec)) {
        return res.json({
            valid: false,
            message: 'This license does not include the selected specialization',
        });
    }

    if (!license.hwid) {
        license.hwid = hwid;
        await saveDB({ ...db, [key]: license });
        return res.json({
            valid: true,
            plan: license.plan,
            expiresAt: license.expiresAt,
            specs: license.specs || null,
            message: 'License successfully activated and bound to this PC',
        });
    }
    if (license.hwid !== hwid) {
        return res.json({
            valid: false,
            message: 'This license key is already bound to another computer',
        });
    }

    return res.json({
        valid: true,
        plan: license.plan,
        expiresAt: license.expiresAt,
        specs: license.specs || null,
        message: 'License validated successfully',
    });
});

app.get('/api/status/:key', async (req, res) => {
    const key = req.params.key;
    const db = await loadDB();
    const license = db[key];

    if (!license) {
        return res.status(404).json({ error: 'License not found' });
    }

    const cat = loadSpecsCatalog();
    const priceEach = cat.pricePerSpecUsdPerMonth || 6;
    const specList = Array.isArray(license.specs) ? license.specs : null;
    const monthlyRate =
        license.plan === 'monthly_per_spec' && specList && specList.length
            ? specList.length * priceEach
            : null;

    res.json({
        plan: license.plan,
        createdAt: license.createdAt,
        expiresAt: license.expiresAt,
        active: license.active,
        isBound: !!license.hwid,
        isExpired: license.plan !== 'lifetime' && new Date() > new Date(license.expiresAt),
        specs: specList,
        monthlyRateUsd: monthlyRate,
        email: license.email || null,
    });
});

app.get('/api/order/:orderId', async (req, res) => {
    const orderId = normalizeOrderId(req.params.orderId);
    if (!orderId) {
        return res.status(400).json({ error: 'Missing order id' });
    }

    const pending = await findPendingByOrderId(orderId);
    if (!pending) {
        return res.status(404).json({ error: 'Order not found' });
    }

    const safe = {
        orderId: pending.orderId,
        status: pending.status || 'pending',
        kind: pending.kind || null,
        createdAt: pending.createdAt || null,
        fulfilledAt: pending.fulfilledAt || null,
        amountUsd: pending.amountUsd != null ? Number(pending.amountUsd) : null,
        currency: pending.currency || 'USD',
        specIds: Array.isArray(pending.specIds) ? pending.specIds : [],
        licenseKey: pending.status === 'fulfilled' ? pending.licenseKey || null : null,
    };

    return res.json(safe);
});

app.get('/api/admin/health', requireAdmin('support'), (req, res) => {
    res.json({ ok: true, admin: adminActor(req) });
});

app.get('/api/admin/overview', requireAdmin('support'), async (req, res) => {
    const stats = await buildAdminStats();
    res.json(stats);
});

app.post('/api/admin/config/price', requireAdmin('owner'), (req, res) => {
    const price = Number(req.body?.price);
    if (Number.isNaN(price) || price < 0) {
        return res.status(400).json({ error: 'Valid price is required' });
    }
    try {
        let cat = { pricePerSpecUsdPerMonth: 6, currency: 'USD', specs: [] };
        if (fs.existsSync(SPECS_FILE)) {
            cat = JSON.parse(fs.readFileSync(SPECS_FILE, 'utf8'));
        }
        cat.pricePerSpecUsdPerMonth = price;
        fs.writeFileSync(SPECS_FILE, JSON.stringify(cat, null, 2));
        auditAdmin(req, 'config.update_price', { price });
        res.json({ ok: true, price });
    } catch (e) {
        res.status(500).json({ error: 'Failed to update price' });
    }
});

app.get('/api/admin/licenses', requireAdmin('support'), async (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    const plan = String(req.query.plan || '').trim().toLowerCase();
    const status = String(req.query.status || '').trim().toLowerCase();
    const db = await loadDB();
    const now = new Date();

    let list = Object.entries(db).map(([key, license]) => ({
        key,
        ...license,
        isExpired: license.plan !== 'lifetime' && new Date(license.expiresAt) <= now,
        isBound: !!license.hwid,
    }));

    if (q) {
        list = list.filter((l) => {
            const hay = [
                l.key,
                l.plan,
                l.email || '',
                l.orderId || '',
                Array.isArray(l.specs) ? l.specs.join(',') : '',
            ]
                .join(' ')
                .toLowerCase();
            return hay.includes(q);
        });
    }
    if (plan) list = list.filter((l) => String(l.plan || '').toLowerCase() === plan);
    if (status === 'active') list = list.filter((l) => l.active && !l.isExpired);
    if (status === 'expired') list = list.filter((l) => l.isExpired);
    if (status === 'disabled') list = list.filter((l) => !l.active);
    if (status === 'bound') list = list.filter((l) => l.isBound);
    if (status === 'unbound') list = list.filter((l) => !l.isBound);

    list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    res.json({ items: list });
});

app.post('/api/admin/licenses/create', requireAdmin('owner'), async (req, res) => {
    const {
        plan = 'monthly',
        months = 1,
        specs = [],
        email = null,
        active = true,
        key: customKey,
    } = req.body || {};
    const db = await loadDB();

    let key = normalizeLicenseKey(customKey);
    if (!key) key = generateLicenseKey();
    while (db[key]) {
        key = generateLicenseKey();
    }

    const normalizedPlan = ['lifetime', 'monthly', 'monthly_per_spec'].includes(String(plan))
        ? String(plan)
        : 'monthly';
    const entry = {
        hwid: null,
        plan: normalizedPlan,
        createdAt: new Date().toISOString(),
        expiresAt: '2099-12-31T23:59:59.000Z',
        active: !!active,
        email: email ? String(email).slice(0, 200) : undefined,
    };

    if (normalizedPlan !== 'lifetime') {
        const exp = new Date();
        const safeMonths = Math.max(1, Math.min(36, Number(months) || 1));
        exp.setMonth(exp.getMonth() + safeMonths);
        entry.expiresAt = exp.toISOString();
    }
    if (normalizedPlan === 'monthly_per_spec') {
        entry.specs = Array.isArray(specs) ? [...new Set(specs.map((s) => String(s)))].slice(0, 64) : [];
    }

    db[key] = entry;
    saveDB(db);
    auditAdmin(req, 'license.create', { key, plan: normalizedPlan, months, specsCount: entry.specs?.length || 0 });
    res.json({ ok: true, key, license: entry });
});

app.post('/api/admin/licenses/:key/toggle-active', requireAdmin('owner'), async (req, res) => {
    const key = normalizeLicenseKey(req.params.key);
    const db = await loadDB();
    const l = db[key];
    if (!l) return res.status(404).json({ error: 'License not found' });
    l.active = !l.active;
    await saveDB(db);
    auditAdmin(req, 'license.toggle_active', { key, active: l.active });
    res.json({ ok: true, key, active: l.active });
});

app.post('/api/admin/licenses/:key/reset-hwid', requireAdmin('owner'), async (req, res) => {
    const key = normalizeLicenseKey(req.params.key);
    const db = await loadDB();
    const l = db[key];
    if (!l) return res.status(404).json({ error: 'License not found' });
    l.hwid = null;
    await saveDB(db);
    auditAdmin(req, 'license.reset_hwid', { key });
    res.json({ ok: true, key, hwid: null });
});

app.post('/api/admin/licenses/:key/extend', requireAdmin('owner'), async (req, res) => {
    const key = normalizeLicenseKey(req.params.key);
    const months = Math.max(1, Math.min(36, Number(req.body?.months) || 1));
    const db = await loadDB();
    const l = db[key];
    if (!l) return res.status(404).json({ error: 'License not found' });
    if (l.plan === 'lifetime') return res.status(400).json({ error: 'Lifetime licenses do not need extension' });

    const now = new Date();
    const base = new Date(l.expiresAt);
    const from = Number.isNaN(base.getTime()) || base < now ? now : base;
    from.setMonth(from.getMonth() + months);
    l.expiresAt = from.toISOString();
    await saveDB(db);
    auditAdmin(req, 'license.extend', { key, months, expiresAt: l.expiresAt });
    res.json({ ok: true, key, expiresAt: l.expiresAt });
});

app.post('/api/admin/licenses/:key/delete', requireAdmin('owner'), async (req, res) => {
    const key = normalizeLicenseKey(req.params.key);
    const db = await loadDB();
    const l = db[key];
    if (!l) return res.status(404).json({ error: 'License not found' });

    delete db[key];
    await saveDB(db);
    auditAdmin(req, 'license.delete', { key });
    res.json({ ok: true, key });
});

app.post('/api/admin/licenses/bulk-delete', requireAdmin('owner'), async (req, res) => {
    const keys = Array.isArray(req.body?.keys) ? req.body.keys : [];
    const normalized = [...new Set(keys.map((k) => normalizeLicenseKey(k)).filter(Boolean))].slice(0, 500);
    if (!normalized.length) return res.status(400).json({ error: 'No license keys provided' });

    const db = await loadDB();
    const deleted = [];
    const missing = [];
    normalized.forEach((key) => {
        if (db[key]) {
            delete db[key];
            deleted.push(key);
        } else {
            missing.push(key);
        }
    });
    await saveDB(db);
    auditAdmin(req, 'license.bulk_delete', { deletedCount: deleted.length, missingCount: missing.length });
    res.json({ ok: true, deleted, missing });
});

app.get('/api/admin/orders', requireAdmin('support'), async (req, res) => {
    const status = String(req.query.status || '').trim().toLowerCase();
    const q = String(req.query.q || '').trim().toLowerCase();
    let list = await loadPendingOrders();

    if (status) list = list.filter((o) => String(o.status || 'pending').toLowerCase() === status);
    if (q) {
        list = list.filter((o) => {
            const hay = [
                o.orderId || '',
                o.email || '',
                o.licenseKey || '',
                Array.isArray(o.specIds) ? o.specIds.join(',') : '',
            ]
                .join(' ')
                .toLowerCase();
            return hay.includes(q);
        });
    }

    list = list.map((o) => {
        const specIds = Array.isArray(o.specIds) ? o.specIds.map((id) => String(id)) : [];
        const specLabels =
            Array.isArray(o.specLabels) && o.specLabels.length
                ? o.specLabels.map((s) => String(s))
                : selectedSpecsMeta(specIds).labels;
        return {
            ...o,
            specIds,
            specLabels,
            selectedSummary:
                o.selectedSummary && String(o.selectedSummary).trim()
                    ? String(o.selectedSummary)
                    : selectedSpecsShortText(specLabels, 180),
        };
    });

    list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    res.json({ items: list });
});

app.post('/api/admin/orders/:orderId/delete', requireAdmin('owner'), async (req, res) => {
    const orderId = normalizeOrderId(req.params.orderId);
    if (!orderId) return res.status(400).json({ error: 'Missing order id' });

    const list = await loadPendingOrders();
    const idx = list.findIndex((o) => String(o.orderId || '').toUpperCase() === orderId);
    if (idx < 0) return res.status(404).json({ error: 'Order not found' });

    const removed = list[idx];
    list.splice(idx, 1);
    await savePendingOrders(list);
    auditAdmin(req, 'order.delete', { orderId, status: removed?.status || 'pending' });
    res.json({ ok: true, orderId });
});

app.post('/api/admin/orders/bulk-delete', requireAdmin('owner'), async (req, res) => {
    const orderIds = Array.isArray(req.body?.orderIds) ? req.body.orderIds : [];
    const normalized = [...new Set(orderIds.map((o) => normalizeOrderId(o)).filter(Boolean))].slice(0, 500);
    if (!normalized.length) return res.status(400).json({ error: 'No order ids provided' });

    const list = await loadPendingOrders();
    const set = new Set(normalized);
    const kept = [];
    let deletedCount = 0;
    list.forEach((o) => {
        const id = normalizeOrderId(o.orderId);
        if (set.has(id)) deletedCount += 1;
        else kept.push(o);
    });
    await savePendingOrders(kept);
    const missingCount = normalized.length - deletedCount;
    auditAdmin(req, 'order.bulk_delete', { deletedCount, missingCount });
    res.json({ ok: true, deletedCount, missingCount });
});

app.get('/api/admin/audit', requireAdmin('support'), async (req, res) => {
    const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 100));
    const items = await readAudit(limit);
    res.json({ items });
});

async function fulfillPerSpecMonthly(payment, specIds, emailFromPayment) {
    const db = await loadDB();
    const paymentId = payment.payment_id != null ? String(payment.payment_id) : '';
    if (paymentId && licenseHasPaymentId(db, paymentId)) {
        console.log('IPN duplicate ignored payment_id=', paymentId);
        return;
    }

    const cat = loadSpecsCatalog();
    const priceEach = cat.pricePerSpecUsdPerMonth || 6;
    const newKey = generateLicenseKey();
    const exp = new Date();
    exp.setMonth(exp.getMonth() + 1);

    const entry = {
        hwid: null,
        plan: 'monthly_per_spec',
        specs: specIds,
        pricePerSpecUsdPerMonth: priceEach,
        createdAt: new Date().toISOString(),
        expiresAt: exp.toISOString(),
        active: true,
        orderId: payment.order_id,
        npPaymentId: paymentId || undefined,
        email: emailFromPayment ? String(emailFromPayment).slice(0, 200) : undefined,
    };

    db[newKey] = entry;
    await saveDB(db);

    const pending = await findPendingByOrderId(payment.order_id);
    if (pending) {
        await upsertPendingOrder({
            orderId: pending.orderId,
            status: 'fulfilled',
            licenseKey: newKey,
            npPaymentId: paymentId,
            fulfilledAt: new Date().toISOString(),
        });
    }

    console.log(`License issued: ${newKey} monthly_per_spec specs=${specIds.join(',')}`);
}

async function fulfillLegacyPayment(payment) {
    const db = await loadDB();
    const paymentId = payment.payment_id != null ? String(payment.payment_id) : '';
    if (paymentId && licenseHasPaymentId(db, paymentId)) {
        return;
    }

    let specsFromOrder = null;
    let parsedOrder = null;
    const desc = payment.order_description || '';
    if (typeof desc === 'string' && desc.trim().startsWith('{')) {
        try {
            parsedOrder = JSON.parse(desc);
            if (parsedOrder && Array.isArray(parsedOrder.specs)) {
                const allowed = validSpecIdsSet();
                specsFromOrder = parsedOrder.specs.filter((id) => allowed.has(String(id)));
            }
        } catch {
            parsedOrder = null;
        }
    }

    const priceAmount = Number(payment.price_amount) || 0;
    const cat = loadSpecsCatalog();
    const priceEach = cat.pricePerSpecUsdPerMonth || 6;

    let plan = 'monthly';
    let expiresAt;
    if (specsFromOrder && specsFromOrder.length > 0) {
        plan = 'monthly_per_spec';
        const exp = new Date();
        exp.setMonth(exp.getMonth() + 1);
        expiresAt = exp.toISOString();
    } else if (priceAmount > 20) {
        plan = 'lifetime';
        expiresAt = '2099-12-31T23:59:59.000Z';
    } else {
        const exp = new Date();
        exp.setMonth(exp.getMonth() + 1);
        expiresAt = exp.toISOString();
    }

    const newKey = generateLicenseKey();
    const entry = {
        hwid: null,
        plan,
        createdAt: new Date().toISOString(),
        expiresAt,
        active: true,
        orderId: payment.order_id,
        npPaymentId: paymentId || undefined,
        email:
            parsedOrder && parsedOrder.email
                ? String(parsedOrder.email).slice(0, 200)
                : typeof desc === 'string' && !parsedOrder
                ? desc.slice(0, 200)
                : undefined,
    };

    if (plan === 'monthly_per_spec' && specsFromOrder && specsFromOrder.length > 0) {
        entry.specs = specsFromOrder;
        entry.pricePerSpecUsdPerMonth = priceEach;
    }

    db[newKey] = entry;
    await saveDB(db);
    console.log(`License issued (legacy): ${newKey} plan=${plan}`);
}

async function handleNowpaymentsIpn(req, res) {
    const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET || '';
    const sig = req.get('x-nowpayments-sig') || '';

    const payment = req.body;
    if (!payment || typeof payment !== 'object') {
        return res.status(400).send('Bad body');
    }

    if (ipnSecret && !verifyNowpaymentsIpnSignature(payment, sig, ipnSecret)) {
        console.warn('NOWPayments IPN signature mismatch');
        return res.status(403).send('Invalid signature');
    }

    const status = String(payment.payment_status || '').toLowerCase();
    if (status !== 'finished' && status !== 'confirmed') {
        return res.sendStatus(200);
    }

    const paymentIdEarly = payment.payment_id != null ? String(payment.payment_id) : '';
    if (paymentIdEarly && licenseHasPaymentId(await loadDB(), paymentIdEarly)) {
        return res.sendStatus(200);
    }

    const orderId = payment.order_id;
    const pending = orderId ? await findPendingByOrderId(orderId) : null;

    if (pending && pending.status === 'fulfilled') {
        return res.sendStatus(200);
    }

    if (
        pending &&
        pending.kind === 'per_spec_monthly' &&
        Array.isArray(pending.specIds) &&
        pending.specIds.length > 0
    ) {
        await fulfillPerSpecMonthly(payment, pending.specIds, pending.email);
    } else {
        await fulfillLegacyPayment(payment);
    }

    res.sendStatus(200);
}

const webhookParser = express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf.toString('utf8');
    },
});

app.post('/api/webhook/nowpayments', webhookParser, handleNowpaymentsIpn);
app.post('/api/webhook/usdt', webhookParser, handleNowpaymentsIpn);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    const base = publicBaseUrl();
    if (process.env.NOWPAYMENTS_API_KEY && base) {
        console.log('NOWPayments invoice checkout: enabled');
    } else {
        console.log('NOWPayments invoice checkout: disabled (set NOWPAYMENTS_API_KEY + PUBLIC_BASE_URL)');
    }
    if (!process.env.NOWPAYMENTS_IPN_SECRET) {
        console.warn('NOWPayments IPN: signature verification disabled until NOWPAYMENTS_IPN_SECRET is set');
    }
    if (!getAdminAccounts().length) {
        console.warn('Admin API: disabled until ADMIN_TOKEN or ADMIN_ACCOUNTS_JSON is set');
    }
});

// Export the Express app for Vercel
module.exports = app;
