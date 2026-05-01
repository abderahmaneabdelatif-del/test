const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const { WebSocketServer } = require('ws');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');

require('dotenv').config();

const app = express();

// ── CORS — restrict to production domain ──
const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.PUBLIC_BASE_URL || '')
    .split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
    origin: (origin, callback) => {
        // Allow server-to-server (no origin) and localhost in dev
        if (!origin || allowedOrigins.length === 0) return callback(null, true);
        if (allowedOrigins.some(o => origin.startsWith(o))) return callback(null, true);
        return callback(new Error('CORS: origin not allowed'));
    },
    credentials: true,
}));

// ── JSON body size limit (protect against payload flooding) ──
app.use(express.json({ limit: '50kb' }));

// ── Rate Limiters ──
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30, // 30 validate attempts per 15 min per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many validation attempts, please try again later.' },
});

const checkoutLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 checkout attempts per hour per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many checkout attempts, please try again later.' },
});

app.use(generalLimiter);

const __root = __dirname;
const DB_FILE = path.join(__root, 'licenses.json');
const PENDING_ORDERS_FILE = path.join(__root, 'pending_orders.json');
const SPECS_FILE = path.join(__root, 'public', 'data', 'specs.json');
const NOWPAYMENTS_API = 'https://api.nowpayments.io/v1';

app.use(express.static(path.join(__root, 'public')));
// Note: /specs images are now served natively from public/specs directory

// ── Email (SMTP) transporter ──
const smtpConfig = {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
    },
};
const emailFrom = process.env.EMAIL_FROM || process.env.SMTP_USER || '';
let mailTransporter = null;
function getMailer() {
    if (!smtpConfig.host || !smtpConfig.auth.user) return null;
    if (!mailTransporter) {
        mailTransporter = nodemailer.createTransport(smtpConfig);
    }
    return mailTransporter;
}

async function sendLicenseEmail({ email, licenseKey, plan, specs, expiresAt, kind }) {
    const mailer = getMailer();
    if (!mailer || !email) {
        console.log('[EMAIL] Skipping — no SMTP config or no email address');
        return { sent: false, reason: 'no-smtp-or-email' };
    }

    const planLabels = {
        monthly: 'Monthly (All Specs)',
        monthly_per_spec: 'Monthly Per Spec',
        lifetime: 'Lifetime',
        custom: 'Custom',
    };
    const planLabel = planLabels[plan] || plan || 'N/A';
    const expiryText = plan === 'lifetime' ? 'Never expires' : expiresAt ? new Date(expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Timer starts on first bind';

    // Specs list HTML
    let specsHtml = '';
    if (Array.isArray(specs) && specs.length > 0) {
        const specItems = specs.map(s => {
            const label = typeof s === 'object' ? s.id : s;
            const expDate = typeof s === 'object' && s.expiresAt ? new Date(s.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
            return `<tr>
                <td style="padding:8px 12px;border-bottom:1px solid #1e293b;color:#e2e8f0;font-weight:600;">${label}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #1e293b;color:#94a3b8;">${expDate || 'Pending'}</td>
            </tr>`;
        }).join('');
        specsHtml = `
        <div style="margin:20px 0;">
            <p style="color:#94a3b8;font-size:13px;margin:0 0 8px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Your Specializations</p>
            <table style="width:100%;border-collapse:collapse;background:#0f172a;border-radius:8px;overflow:hidden;">
                <thead><tr>
                    <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;border-bottom:1px solid #1e293b;text-transform:uppercase;">Spec</th>
                    <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;border-bottom:1px solid #1e293b;text-transform:uppercase;">Expires</th>
                </tr></thead>
                <tbody>${specItems}</tbody>
            </table>
        </div>`;
    }

    const html = `
    <div style="max-width:520px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0e1a;color:#e2e8f0;border-radius:16px;overflow:hidden;">
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#00ddb3 0%,#0ea5e9 100%);padding:28px 24px;text-align:center;">
            <h1 style="margin:0;font-size:22px;font-weight:800;color:#0a0e1a;letter-spacing:-0.5px;">TWW Combat Assistant</h1>
            <p style="margin:6px 0 0;font-size:13px;color:rgba(10,14,26,0.7);font-weight:600;">Your license is ready! 🎉</p>
        </div>

        <!-- Body -->
        <div style="padding:24px;">
            <p style="margin:0 0 16px;font-size:14px;color:#94a3b8;">Thank you for your purchase! Here are your license details:</p>

            <!-- License Key -->
            <div style="background:#111827;border:1px solid #1e293b;border-radius:10px;padding:16px;text-align:center;margin-bottom:20px;">
                <p style="margin:0 0 6px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">License Key</p>
                <p style="margin:0;font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:700;color:#00ddb3;letter-spacing:2px;">${licenseKey}</p>
            </div>

            <!-- Details Grid -->
            <table style="width:100%;border-collapse:collapse;margin-bottom:4px;">
                <tr>
                    <td style="padding:8px 0;color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Plan</td>
                    <td style="padding:8px 0;color:#e2e8f0;font-size:13px;text-align:right;font-weight:600;">${planLabel}</td>
                </tr>
                <tr>
                    <td style="padding:8px 0;color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Expires</td>
                    <td style="padding:8px 0;color:#e2e8f0;font-size:13px;text-align:right;font-weight:600;">${expiryText}</td>
                </tr>
            </table>

            ${specsHtml}

            <!-- How to activate -->
            <div style="background:#111827;border:1px solid #1e293b;border-radius:10px;padding:16px;margin-top:16px;">
                <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#00ddb3;text-transform:uppercase;letter-spacing:1px;">How to Activate</p>
                <ol style="margin:0;padding-left:18px;color:#94a3b8;font-size:13px;line-height:1.7;">
                    <li>Open TWW Combat Assistant</li>
                    <li>Go to the License section</li>
                    <li>Enter your license key above</li>
                    <li>Select your specialization and start! 🚀</li>
                </ol>
            </div>

            <p style="margin:20px 0 0;font-size:11px;color:#475569;text-align:center;">If you did not make this purchase, please ignore this email.</p>
        </div>

        <!-- Footer -->
        <div style="background:#060a14;padding:14px 24px;text-align:center;border-top:1px solid #1e293b;">
            <p style="margin:0;font-size:11px;color:#475569;">© ${new Date().getFullYear()} TWW Combat Assistant. All rights reserved.</p>
        </div>
    </div>`;

    try {
        const result = await mailer.sendMail({
            from: emailFrom,
            to: email,
            subject: `Your License Key — TWW Combat Assistant`,
            html,
        });
        console.log(`[EMAIL] Sent license key to ${email} — ${result.messageId}`);
        return { sent: true, messageId: result.messageId };
    } catch (err) {
        console.error(`[EMAIL] Failed to send to ${email}:`, err.message);
        return { sent: false, reason: err.message };
    }
}

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

async function getActivePrice() {
    const cat = loadSpecsCatalog();
    const conf = await getConfig();
    if (conf && conf.pricePerSpecUsdPerMonth != null) {
        return Number(conf.pricePerSpecUsdPerMonth);
    }
    return cat.pricePerSpecUsdPerMonth || 6;
}

async function getPlanPrices() {
    const conf = await getConfig();
    return {
        priceMonthlyAll: conf && conf.priceMonthlyAll != null ? Number(conf.priceMonthlyAll) : 30,
        price3MonthAll: conf && conf.price3MonthAll != null ? Number(conf.price3MonthAll) : 75
    };
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
    readAudit,
    clearAudit,
    getConfig,
    saveConfig
} = require('./database');

// We initialize the Postgres table on startup
initDB().catch(console.error);

function requireAdmin(minRole = 'support') {
    return (req, res, next) => {
        const accounts = getAdminAccounts();
        if (!accounts.length) {
            return res.status(503).json({ error: 'Admin API disabled: set ADMIN_TOKEN or ADMIN_ACCOUNTS_JSON' });
        }

        // Token only from header or body — NOT from query string (avoids leaking in logs)
        const provided = String(
            req.get('x-admin-token') || (req.body && req.body.adminToken) || ''
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
    const entry = {
        actor: adminActor(req),
        action,
        details: details || {},
        ip: req.ip || '',
        at: new Date().toISOString(),
    };
    appendAudit(entry).catch(console.error);
    wsBroadcast(entry);
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
    const active = licenses.filter((l) => l.active && (l.plan === 'lifetime' || new Date(getLicenseExpiresAt(l)) > now));
    const expired = licenses.filter((l) => l.plan !== 'lifetime' && new Date(getLicenseExpiresAt(l)) <= now);
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

function paypalApiBase() {
    const mode = String(process.env.PAYPAL_MODE || 'live').toLowerCase();
    return mode === 'sandbox'
        ? 'https://api-m.sandbox.paypal.com'
        : 'https://api-m.paypal.com';
}

function paypalEnabled() {
    return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET && publicBaseUrl());
}

async function paypalAccessToken() {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        throw new Error('PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are missing');
    }

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetch(`${paypalApiBase()}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
        throw new Error(data.error_description || data.error || `PayPal token HTTP ${res.status}`);
    }
    return data.access_token;
}

async function paypalCreateOrder({ amountUsd, orderId, description }) {
    const base = publicBaseUrl();
    if (!base) throw new Error('PUBLIC_BASE_URL is missing');

    const token = await paypalAccessToken();
    const res = await fetch(`${paypalApiBase()}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
        },
        body: JSON.stringify({
            intent: 'CAPTURE',
            purchase_units: [
                {
                    reference_id: orderId,
                    custom_id: orderId,
                    description,
                    amount: {
                        currency_code: 'USD',
                        value: Number(amountUsd).toFixed(2),
                    },
                },
            ],
            application_context: {
                brand_name: 'Max Combat Assistant',
                landing_page: 'LOGIN',
                user_action: 'PAY_NOW',
                return_url: `${base}/payment-success.html?provider=paypal&order=${encodeURIComponent(orderId)}`,
                cancel_url: `${base}/index.html#pricing`,
            },
        }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.id) {
        throw new Error(data.message || data.details?.[0]?.description || `PayPal create order HTTP ${res.status}`);
    }

    const approveUrl = Array.isArray(data.links)
        ? (data.links.find((l) => l.rel === 'approve') || {}).href
        : null;
    if (!approveUrl) throw new Error('PayPal approve URL missing');
    return { paypalOrderId: data.id, approveUrl };
}

async function paypalCaptureOrder(paypalOrderId) {
    const token = await paypalAccessToken();
    const res = await fetch(`${paypalApiBase()}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
        },
        body: '{}',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.message || data.details?.[0]?.description || `PayPal capture HTTP ${res.status}`);
    }
    return data;
}

function captureCompleted(captureData) {
    if (!captureData || String(captureData.status || '').toUpperCase() !== 'COMPLETED') return false;
    const captures = captureData.purchase_units?.[0]?.payments?.captures || [];
    return captures.some((c) => String(c.status || '').toUpperCase() === 'COMPLETED');
}

function generateUniqueLicenseKey(db) {
    let key = generateLicenseKey();
    while (db[key]) key = generateLicenseKey();
    return key;
}

async function fulfillPendingOrderToLicense(pending, meta = {}) {
    if (!pending || !pending.orderId) throw new Error('Invalid pending order');
    if (String(pending.status || '').toLowerCase() === 'fulfilled' && pending.licenseKey) {
        return { key: pending.licenseKey, alreadyFulfilled: true };
    }

    // ── Add specs to an existing license ──
    if (pending.licenseKey && pending.kind === 'per_spec_monthly') {
        const db = await loadDB();
        const existingKey = normalizeLicenseKey(pending.licenseKey);
        const license = db[existingKey];

        if (!license) throw new Error('License not found for add-specs');
        if (!license.active) throw new Error('License is disabled');
        if (license.plan !== 'monthly_per_spec') throw new Error('License is not per-spec plan');

        const existingNormalized = normalizeSpecs(license.specs);
        const existingMap = new Map(existingNormalized.map(s => [s.id, s]));
        const newSpecs = Array.isArray(pending.specIds) ? pending.specIds : [];
        let addedCount = 0;
        const nowAdd = new Date();
        const isBound = !!license.hwid || !!license._expiryStarted;

        for (const id of newSpecs) {
            const sid = String(id);
            const existing = existingMap.get(sid);
            if (existing) {
                // If expired, renew it
                if (existing.expiresAt && new Date(existing.expiresAt) <= nowAdd) {
                    existing.addedAt = nowAdd.toISOString();
                    if (isBound) {
                        const expAdd = new Date(nowAdd);
                        expAdd.setMonth(expAdd.getMonth() + 1);
                        existing.expiresAt = expAdd.toISOString();
                    } else {
                        existing.expiresAt = null; // Timer not started yet
                    }
                    addedCount++;
                }
                // If still active, skip
            } else {
                if (isBound) {
                    const expAdd = new Date(nowAdd);
                    expAdd.setMonth(expAdd.getMonth() + 1);
                    existingMap.set(sid, { id: sid, addedAt: nowAdd.toISOString(), expiresAt: expAdd.toISOString() });
                } else {
                    existingMap.set(sid, { id: sid, addedAt: nowAdd.toISOString(), expiresAt: null });
                }
                addedCount++;
            }
        }
        license.specs = [...existingMap.values()];
        license.pricePerSpecUsdPerMonth = await getActivePrice();
        license.expiresAt = getLicenseExpiresAt(license);

        if (meta.paypalOrderId) license.paypalOrderId = String(meta.paypalOrderId);
        if (meta.paypalCaptureId) license.paypalCaptureId = String(meta.paypalCaptureId);

        await saveDB(db);

        await upsertPendingOrder({
            ...pending,
            status: 'fulfilled',
            licenseKey: existingKey,
            fulfilledAt: new Date().toISOString(),
            paypalOrderId: meta.paypalOrderId || pending.paypalOrderId,
            paypalCaptureId: meta.paypalCaptureId || pending.paypalCaptureId,
        });

        // Send email with updated license info
        if (license.email) {
            sendLicenseEmail({
                email: license.email,
                licenseKey: existingKey,
                plan: license.plan,
                specs: license.specs,
                expiresAt: license.expiresAt,
                kind: pending.kind,
            }).catch(err => console.error('[EMAIL] Add-specs email error:', err.message));
        }

        return { key: existingKey, alreadyFulfilled: false, specsAdded: true, addedCount };
    }

    // ── Create a new license ──
    const db = await loadDB();
    const key = generateUniqueLicenseKey(db);
    const nowIso = new Date().toISOString();
    const email = pending.email ? String(pending.email).slice(0, 200) : undefined;

    const entry = {
        hwid: null,
        createdAt: nowIso,
        active: true,
        orderId: pending.orderId,
        email,
    };

    if (pending.kind === 'per_spec_monthly') {
        entry.plan = 'monthly_per_spec';
        // Store duration but don't set expiresAt yet — timer starts when bound
        entry.pendingDurationMonths = 1;
        entry._expiryStarted = false;
        entry.expiresAt = null; // Will be set when HWID is bound
        const nowIso2 = new Date().toISOString();
        entry.specs = Array.isArray(pending.specIds)
            ? pending.specIds.map(id => ({ id: String(id), addedAt: nowIso2, expiresAt: null }))
            : [];
        entry.pricePerSpecUsdPerMonth = await getActivePrice();
    } else if (pending.kind === '3month_all') {
        entry.plan = 'monthly';
        entry.pendingDurationMonths = 3;
        entry._expiryStarted = false;
        entry.expiresAt = null; // Will be set when HWID is bound
    } else {
        entry.plan = 'monthly';
        entry.pendingDurationMonths = 1;
        entry._expiryStarted = false;
        entry.expiresAt = null; // Will be set when HWID is bound
    }

    if (meta.paypalOrderId) entry.paypalOrderId = String(meta.paypalOrderId);
    if (meta.paypalCaptureId) entry.paypalCaptureId = String(meta.paypalCaptureId);

    db[key] = entry;
    await saveDB(db);

    await upsertPendingOrder({
        ...pending,
        status: 'fulfilled',
        licenseKey: key,
        fulfilledAt: new Date().toISOString(),
        paypalOrderId: meta.paypalOrderId || pending.paypalOrderId,
        paypalCaptureId: meta.paypalCaptureId || pending.paypalCaptureId,
    });

    // Send email with license key
    if (email) {
        sendLicenseEmail({
            email,
            licenseKey: key,
            plan: entry.plan,
            specs: entry.specs || null,
            expiresAt: entry.expiresAt,
            kind: pending.kind,
        }).catch(err => console.error('[EMAIL] New license email error:', err.message));
    }

    return { key, alreadyFulfilled: false };
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
        const spec = findSpecEntry(license.specs, specId);
        if (!spec) return false;
        // Per-spec expiration check
        if (spec.expiresAt && new Date(spec.expiresAt) <= new Date()) return false;
        return true;
    }
    if (!license.specs || !Array.isArray(license.specs) || license.specs.length === 0) {
        return true;
    }
    const spec = findSpecEntry(license.specs, specId);
    if (!spec) return true; // old format: string array, not found = allowed
    if (spec.expiresAt && new Date(spec.expiresAt) <= new Date()) return false;
    return true;
}

// ── Per-spec data helpers ──
// Old format: specs = ["dk_frost", "mage_fire"]
// New format: specs = [{id:"dk_frost", addedAt:"...", expiresAt:"..."}, ...]

function normalizeSpecs(specs) {
    if (!Array.isArray(specs)) return [];
    return specs.map(s => {
        if (typeof s === 'string') {
            return { id: s, addedAt: null, expiresAt: null };
        }
        return {
            id: String(s.id || ''),
            addedAt: s.addedAt || null,
            expiresAt: s.expiresAt || null,
        };
    }).filter(s => s.id);
}

function findSpecEntry(specs, specId) {
    const normalized = normalizeSpecs(specs);
    return normalized.find(s => s.id === String(specId)) || null;
}

function getActiveSpecIds(specs) {
    const now = new Date();
    return normalizeSpecs(specs)
        .filter(s => !s.expiresAt || new Date(s.expiresAt) > now)
        .map(s => s.id);
}

function getExpiredSpecIds(specs) {
    const now = new Date();
    return normalizeSpecs(specs)
        .filter(s => s.expiresAt && new Date(s.expiresAt) <= now)
        .map(s => s.id);
}

function getLicenseExpiresAt(license) {
    // Lifetime never expires
    if (license.plan === 'lifetime') return license.expiresAt || '2099-12-31';
    // Not yet bound — timer hasn't started, return far future so it's not expired
    if (!license.hwid && !license._expiryStarted) return '2099-12-31';
    // For per-spec: return the latest spec expiration
    if (license.plan === 'monthly_per_spec' && Array.isArray(license.specs)) {
        const normalized = normalizeSpecs(license.specs);
        const dates = normalized.map(s => s.expiresAt).filter(Boolean).map(d => new Date(d));
        if (dates.length) return new Date(Math.max(...dates)).toISOString();
    }
    return license.expiresAt || '2099-12-31';
}

// ── API: Spec catalog ──
app.get('/api/specs', async (req, res) => {
    // Pricing/spec catalog changes should be visible immediately in admin/site.
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    const cat = loadSpecsCatalog();
    cat.pricePerSpecUsdPerMonth = await getActivePrice();
    const plans = await getPlanPrices();
    cat.priceMonthlyAll = plans.priceMonthlyAll;
    cat.price3MonthAll = plans.price3MonthAll;
    res.json(cat);
});

// ── API: Checkout config (what the UI can rely on) ──
app.get('/api/checkout/config', (req, res) => {
    const base = publicBaseUrl();
    const testMode = String(process.env.CHECKOUT_TEST_MODE || '').toLowerCase() === 'true';
    res.json({
        invoiceEnabled: !!(process.env.NOWPAYMENTS_API_KEY && base),
        paypalEnabled: paypalEnabled() || testMode,
        testMode,
        publicBaseUrl: base,
    });
});

app.post('/api/checkout/paypal/create-order', checkoutLimiter, async (req, res) => {
    if (!paypalEnabled()) {
        return res.status(503).json({ error: 'PayPal checkout is not configured on server' });
    }

    const { kind, plan, email, specIds, licenseKey } = req.body || {};
    const em = (email && String(email).trim()) || '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        return res.status(400).json({ error: 'Enter a valid email for license delivery.' });
    }

    let pending = null;
    if (kind === 'plan') {
        const plans = await getPlanPrices();
        const planConfig = {
            monthly: { label: 'Monthly — All Specs', amount: plans.priceMonthlyAll, kind: 'monthly_all' },
            '3month': { label: '3-Month — All Specs', amount: plans.price3MonthAll, kind: '3month_all' },
        };
        const cfg = planConfig[String(plan || '')];
        if (!cfg) return res.status(400).json({ error: 'Invalid plan type.' });

        const orderId = `MCA-PP-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        pending = {
            kind: cfg.kind,
            orderId,
            specIds: [],
            specLabels: [],
            selectedSummary: cfg.label,
            amountUsd: Number(cfg.amount.toFixed(2)),
            currency: 'USD',
            email: em.slice(0, 200),
            createdAt: new Date().toISOString(),
            status: 'pending',
        };
    } else if (kind === 'per_spec') {
        const allowed = validSpecIdsSet();
        let normalized = Array.isArray(specIds)
            ? [...new Set(specIds.map((s) => String(s)))]
            : [];
        if (!normalized.length) {
            return res.status(400).json({ error: 'Select at least one specialization.' });
        }
        for (const id of normalized) {
            if (!allowed.has(id)) return res.status(400).json({ error: `Unknown spec: ${id}` });
        }

        // If licenseKey provided, validate and filter out already-owned specs
        let existingKey = null;
        let existingSpecs = [];
        if (licenseKey) {
            const nk = normalizeLicenseKey(String(licenseKey).trim());
            const db = await loadDB();
            const lic = db[nk];
            if (!lic) return res.status(400).json({ error: 'License key not found.' });
            if (!lic.active) return res.status(400).json({ error: 'This license is disabled.' });
            if (lic.plan !== 'monthly_per_spec') return res.status(400).json({ error: 'Only per-spec licenses support adding specs.' });
            const now = new Date();
            // Allow adding specs even if some are expired, as long as key is active
            // (no global expiry check needed for per-spec keys)

            existingKey = nk;
            existingSpecs = getActiveSpecIds(lic.specs);

            // Filter out specs already active on the license
            const ownedSet = new Set(existingSpecs.map((s) => String(s)));
            normalized = normalized.filter((id) => !ownedSet.has(id));

            if (!normalized.length) {
                return res.status(400).json({ error: 'All selected specs are already on this license.' });
            }
        }

        const orderId = `MCA-PP-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        const amountUsd = Number((normalized.length * (await getActivePrice())).toFixed(2));
        const meta = selectedSpecsMeta(normalized);
        pending = {
            kind: 'per_spec_monthly',
            orderId,
            specIds: meta.ids,
            specLabels: meta.labels,
            selectedSummary: selectedSpecsShortText(meta.ids),
            amountUsd,
            currency: 'USD',
            email: em.slice(0, 200),
            createdAt: new Date().toISOString(),
            status: 'pending',
            ...(existingKey ? { licenseKey: existingKey } : {}),
        };
    } else {
        return res.status(400).json({ error: 'Invalid checkout kind' });
    }

    try {
        const pp = await paypalCreateOrder({
            amountUsd: pending.amountUsd,
            orderId: pending.orderId,
            description: `Max Combat Assistant — ${pending.selectedSummary || pending.kind}`,
        });
        pending.paypalOrderId = pp.paypalOrderId;
        await upsertPendingOrder(pending);
        return res.json({
            ok: true,
            provider: 'paypal',
            orderId: pending.orderId,
            paypalOrderId: pp.paypalOrderId,
            approveUrl: pp.approveUrl,
            amountUsd: pending.amountUsd,
            currency: pending.currency || 'USD',
        });
    } catch (e) {
        return res.status(502).json({ error: 'PayPal create order failed', detail: e.message || String(e) });
    }
});

app.post('/api/checkout/paypal/capture', checkoutLimiter, async (req, res) => {
    if (!paypalEnabled()) {
        return res.status(503).json({ error: 'PayPal checkout is not configured on server' });
    }
    const paypalOrderId = String(req.body?.paypalOrderId || req.body?.token || '').trim();
    const orderId = String(req.body?.orderId || '').trim();
    if (!paypalOrderId) return res.status(400).json({ error: 'Missing paypalOrderId' });

    const list = await loadPendingOrders();
    const pending = list.find((o) =>
        (orderId && String(o.orderId || '') === orderId) ||
        String(o.paypalOrderId || '') === paypalOrderId
    );
    if (!pending) return res.status(404).json({ error: 'Pending order not found' });

    if (String(pending.status || '').toLowerCase() === 'fulfilled' && pending.licenseKey) {
        return res.json({ ok: true, orderId: pending.orderId, licenseKey: pending.licenseKey, alreadyFulfilled: true });
    }

    try {
        const capture = await paypalCaptureOrder(paypalOrderId);
        if (!captureCompleted(capture)) {
            return res.status(409).json({ error: 'PayPal payment not completed', status: capture.status || 'UNKNOWN' });
        }
        const cap = capture.purchase_units?.[0]?.payments?.captures?.[0];
        const out = await fulfillPendingOrderToLicense(pending, {
            paypalOrderId,
            paypalCaptureId: cap?.id || '',
        });
        return res.json({
            ok: true,
            provider: 'paypal',
            orderId: pending.orderId,
            licenseKey: out.key,
            alreadyFulfilled: out.alreadyFulfilled,
        });
    } catch (e) {
        return res.status(502).json({ error: 'PayPal capture failed', detail: e.message || String(e) });
    }
});

// ── API: Test checkout — simulate full flow without real payment ──
app.post('/api/checkout/test-create', async (req, res) => {
    const { kind, plan, email, specIds, licenseKey } = req.body || {};
    const em = (email && String(email).trim()) || '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        return res.status(400).json({ error: 'Enter a valid email for license delivery.' });
    }

    let pending = null;
    if (kind === 'plan') {
        const plans = await getPlanPrices();
        const planConfig = {
            monthly: { label: 'Monthly — All Specs', amount: plans.priceMonthlyAll, kind: 'monthly_all' },
            '3month': { label: '3-Month — All Specs', amount: plans.price3MonthAll, kind: '3month_all' },
        };
        const cfg = planConfig[String(plan || '')];
        if (!cfg) return res.status(400).json({ error: 'Invalid plan type.' });

        const orderId = `MCA-TEST-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        pending = {
            kind: cfg.kind,
            orderId,
            specIds: [],
            specLabels: [],
            selectedSummary: cfg.label,
            amountUsd: Number(cfg.amount.toFixed(2)),
            currency: 'USD',
            email: em.slice(0, 200),
            createdAt: new Date().toISOString(),
            status: 'pending',
        };
    } else if (kind === 'per_spec') {
        const allowed = validSpecIdsSet();
        let normalized = Array.isArray(specIds)
            ? [...new Set(specIds.map((s) => String(s)))]
            : [];
        if (!normalized.length) {
            return res.status(400).json({ error: 'Select at least one specialization.' });
        }
        for (const id of normalized) {
            if (!allowed.has(id)) return res.status(400).json({ error: `Unknown spec: ${id}` });
        }

        let existingKey = null;
        let existingSpecs = [];
        if (licenseKey) {
            const nk = normalizeLicenseKey(String(licenseKey).trim());
            const db = await loadDB();
            const lic = db[nk];
            if (!lic) return res.status(400).json({ error: 'License key not found.' });
            if (!lic.active) return res.status(400).json({ error: 'This license is disabled.' });
            if (lic.plan !== 'monthly_per_spec') return res.status(400).json({ error: 'Only per-spec licenses support adding specs.' });
            existingKey = nk;
            existingSpecs = getActiveSpecIds(lic.specs);
            const ownedSet = new Set(existingSpecs.map((s) => String(s)));
            normalized = normalized.filter((id) => !ownedSet.has(id));
            if (!normalized.length) {
                return res.status(400).json({ error: 'All selected specs are already on this license.' });
            }
        }

        const orderId = `MCA-TEST-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        const amountUsd = Number((normalized.length * (await getActivePrice())).toFixed(2));
        const meta = selectedSpecsMeta(normalized);
        pending = {
            kind: 'per_spec_monthly',
            orderId,
            specIds: meta.ids,
            specLabels: meta.labels,
            selectedSummary: selectedSpecsShortText(meta.ids),
            amountUsd,
            currency: 'USD',
            email: em.slice(0, 200),
            createdAt: new Date().toISOString(),
            status: 'pending',
            ...(existingKey ? { licenseKey: existingKey } : {}),
        };
    } else {
        return res.status(400).json({ error: 'Invalid checkout kind' });
    }

    await upsertPendingOrder(pending);

    return res.json({
        ok: true,
        provider: 'test',
        orderId: pending.orderId,
        amountUsd: pending.amountUsd,
        currency: pending.currency || 'USD',
        email: pending.email,
        message: 'Test order created — use /api/checkout/test-capture to fulfill',
    });
});

app.post('/api/checkout/test-capture', async (req, res) => {
    const orderId = String(req.body?.orderId || '').trim();
    if (!orderId) return res.status(400).json({ error: 'orderId required' });

    const orders = await loadPendingOrders();
    const pending = orders.find(o => o.orderId === orderId);
    if (!pending) return res.status(404).json({ error: 'Order not found' });
    if (String(pending.status || '').toLowerCase() === 'fulfilled') {
        return res.json({ ok: true, key: pending.licenseKey, alreadyFulfilled: true });
    }

    try {
        const out = await fulfillPendingOrderToLicense(pending, {
            paypalOrderId: `TEST-${orderId}`,
            paypalCaptureId: `TEST-CAPTURE-${Date.now()}`,
        });
        return res.json({
            ok: true,
            provider: 'test',
            orderId: pending.orderId,
            licenseKey: out.key,
            alreadyFulfilled: out.alreadyFulfilled,
            specsAdded: out.specsAdded || false,
            addedCount: out.addedCount || 0,
        });
    } catch (e) {
        return res.status(500).json({ error: 'Test fulfillment failed', detail: e.message || String(e) });
    }
});

// ── API: Plan checkout (monthly / 3-month — all specs) ──
app.post('/api/checkout/plan', checkoutLimiter, async (req, res) => {
    const { plan, email, months, amountUsd } = req.body || {};
    const em = (email && String(email).trim()) || '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        return res.status(400).json({ error: 'Enter a valid email for license delivery.' });
    }

    const plans = await getPlanPrices();
    const planConfig = {
        monthly:  { label: 'Monthly — All Specs', amount: plans.priceMonthlyAll, months: 1 },
        '3month': { label: '3-Month — All Specs', amount: plans.price3MonthAll, months: 3 },
    };
    const cfg = planConfig[plan];
    if (!cfg) {
        return res.status(400).json({ error: 'Invalid plan type.' });
    }

    const finalAmount = Number(cfg.amount.toFixed(2));
    const orderId = `MCA-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const base = publicBaseUrl();
    const apiKey = process.env.NOWPAYMENTS_API_KEY;

    await upsertPendingOrder({
        kind: plan === '3month' ? '3month_all' : 'monthly_all',
        orderId,
        specIds: [],
        specLabels: [],
        selectedSummary: cfg.label,
        amountUsd: finalAmount,
        currency: 'USD',
        email: em.slice(0, 200),
        createdAt: new Date().toISOString(),
        status: 'pending',
    });

    if (!apiKey || !base) {
        return res.json({
            mode: 'manual',
            orderId,
            amountUsd: finalAmount,
            currency: 'USD',
            message: 'Set NOWPAYMENTS_API_KEY and PUBLIC_BASE_URL to enable automatic checkout.',
        });
    }

    const ipnUrl = `${base}/api/webhook/nowpayments`;
    const successUrl = `${base}/payment-success.html?order=${encodeURIComponent(orderId)}`;
    const cancelUrl = `${base}/index.html#pricing`;

    const invoiceBody = {
        price_amount: finalAmount,
        price_currency: 'usd',
        order_id: orderId,
        order_description: `Max Combat Assistant — ${cfg.label}`,
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

        await upsertPendingOrder({ orderId, npInvoiceId: npId, invoiceUrl });

        return res.json({
            mode: 'invoice',
            orderId,
            invoiceUrl,
            amountUsd: finalAmount,
            currency: 'USD',
        });
    } catch (e) {
        console.error('NOWPayments invoice error:', e.message || e);
        return res.status(502).json({
            error: 'Payment provider error',
            detail: e.message || String(e),
            mode: 'manual',
            orderId,
            amountUsd: finalAmount,
        });
    }
});

// ── API: Legacy draft (manual JSON flow) ──
app.post('/api/checkout-draft', async (req, res) => {
    const allowed = validSpecIdsSet();
    const cat = loadSpecsCatalog();
    const priceEach = await getActivePrice();

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
app.post('/api/checkout/per-spec', checkoutLimiter, async (req, res) => {
    const allowed = validSpecIdsSet();
    const cat = loadSpecsCatalog();
    const priceEach = await getActivePrice();
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
app.post('/api/validate', authLimiter, async (req, res) => {
    const { key, hwid, spec } = req.body;

    if (!key || !hwid) {
        return res.json({ valid: false, message: 'Missing key or HWID' });
    }

    const normalizedKey = normalizeLicenseKey(String(key).trim());
    if (!normalizedKey || normalizedKey.replace(/-/g, '').length !== 16) {
        return res.json({ valid: false, message: 'Invalid license key format' });
    }

    const db = await loadDB();
    const license = db[normalizedKey];

    if (!license) {
        return res.json({ valid: false, message: 'License key not found' });
    }

    if (!license.active) {
        return res.json({ valid: false, message: 'License is disabled/banned' });
    }

    const now = new Date();
    const effectiveExpiresAt = getLicenseExpiresAt(license);

    // Don't check expiry if license is not yet bound (timer hasn't started)
    if (license.plan !== 'lifetime' && !license.hwid) {
        // License not bound yet — timer not started, skip expiry check
    } else if (now > new Date(effectiveExpiresAt) && license.plan !== 'lifetime') {
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
        license.boundAt = new Date().toISOString();
        // Recalculate expiresAt from boundAt if license was not yet bound
        if (license.plan !== 'lifetime' && !license._expiryStarted) {
            license._expiryStarted = true;
            const boundDate = new Date(license.boundAt);
            let exp;

            // Custom plans use their own duration unit
            if (license._customDuration) {
                exp = new Date(boundDate);
                const { value, unit } = license._customDuration;
                if (unit === 'minutes') exp.setMinutes(exp.getMinutes() + value);
                else if (unit === 'hours') exp.setHours(exp.getHours() + value);
                else if (unit === 'days') exp.setDate(exp.getDate() + value);
                else if (unit === 'weeks') exp.setDate(exp.getDate() + value * 7);
                else if (unit === 'months') exp.setMonth(exp.getMonth() + value);
                else if (unit === 'years') exp.setFullYear(exp.getFullYear() + value);
                else exp.setMinutes(exp.getMinutes() + value);
            } else {
                const durationMonths = license.pendingDurationMonths || 1;
                exp = new Date(boundDate);
                exp.setMonth(exp.getMonth() + durationMonths);
            }
            license.expiresAt = exp.toISOString();

            // Also recalculate per-spec expiry dates
            if (license.plan === 'monthly_per_spec' && Array.isArray(license.specs)) {
                const specExp = new Date(boundDate);
                const durationMonths = license.pendingDurationMonths || 1;
                specExp.setMonth(specExp.getMonth() + durationMonths);
                license.specs = normalizeSpecs(license.specs).map(s => ({
                    ...s,
                    addedAt: boundDate.toISOString(),
                    expiresAt: specExp.toISOString(),
                }));
            }
        }
        await saveDB({ ...db, [key]: license });
        return res.json({
            valid: true,
            plan: license.plan,
            expiresAt: license.expiresAt,
            specs: license.specs || null,
            activeSpecIds: license.plan === 'monthly_per_spec' ? getActiveSpecIds(license.specs) : null,
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
        expiresAt: effectiveExpiresAt,
        specs: license.specs || null,
        activeSpecIds: license.plan === 'monthly_per_spec' ? getActiveSpecIds(license.specs) : null,
        message: 'License validated successfully',
    });
});

// ── API: Validate license key for add-specs checkout ──
app.post('/api/license/validate-for-add-specs', async (req, res) => {
    const rawKey = String(req.body?.key || '').trim().toUpperCase();
    const normalized = normalizeLicenseKey(rawKey);
    if (!normalized || normalized.replace(/-/g, '').length !== 16) {
        return res.status(400).json({ error: 'Invalid license key format.' });
    }

    const db = await loadDB();
    const license = db[normalized];
    if (!license) {
        return res.status(404).json({ error: 'License key not found.' });
    }
    if (!license.active) {
        return res.status(400).json({ error: 'This license is disabled.', eligible: false });
    }
    if (license.plan !== 'monthly_per_spec') {
        return res.status(400).json({ error: 'Only per-spec licenses support adding specs.', eligible: false });
    }
    const now = new Date();
    // A per-spec key is eligible as long as it has at least one active spec or can add new ones
    // (even if some specs are expired, the key itself isn't "expired" for add-specs purpose)
    const allSpecsExpired = license.plan === 'monthly_per_spec' &&
        Array.isArray(license.specs) &&
        license.specs.length > 0 &&
        getActiveSpecIds(license.specs).length === 0;
    if (allSpecsExpired) {
        return res.status(400).json({ error: 'All specs on this license have expired. Renew or add new specs.', eligible: false });
    }

    const specList = normalizeSpecs(license.specs);
    const activeSpecIds = getActiveSpecIds(license.specs);
    const expiredSpecIds = getExpiredSpecIds(license.specs);
    const latestExpiry = getLicenseExpiresAt(license);
    const isBound = !!license.hwid;
    const expiryStarted = isBound || !!license._expiryStarted;
    res.json({
        eligible: true,
        key: normalized,
        plan: license.plan,
        specs: specList,
        activeSpecIds,
        expiredSpecIds,
        expiresAt: expiryStarted ? latestExpiry : null,
        expiryStarted,
        pendingDurationMonths: license.pendingDurationMonths || null,
        _customDuration: license._customDuration || null,
        email: license.email || null,
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
    const priceEach = await getActivePrice();
    const specList = normalizeSpecs(license.specs);
    const activeSpecIds = getActiveSpecIds(license.specs);
    const expiredSpecIds = getExpiredSpecIds(license.specs);
    const monthlyRate =
        license.plan === 'monthly_per_spec' && activeSpecIds.length
            ? activeSpecIds.length * priceEach
            : null;
    const effectiveExpiresAt = getLicenseExpiresAt(license);

    const isBound = !!license.hwid;
    const expiryStarted = isBound || !!license._expiryStarted;
    const isExpired = license.plan !== 'lifetime' && expiryStarted && new Date() > new Date(effectiveExpiresAt);

    res.json({
        plan: license.plan,
        createdAt: license.createdAt,
        boundAt: license.boundAt || null,
        expiresAt: expiryStarted ? effectiveExpiresAt : null,
        pendingDurationMonths: license.pendingDurationMonths || null,
        _customDuration: license._customDuration || null,
        expiryStarted,
        active: license.active,
        isBound,
        isExpired,
        specs: specList,
        activeSpecIds,
        expiredSpecIds,
        monthlyRateUsd: monthlyRate,
        // email intentionally omitted — use admin API to view
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

app.post('/api/admin/config/price', requireAdmin('owner'), async (req, res) => {
    const { price, priceMonthlyAll, price3MonthAll } = req.body || {};
    
    const pSpec = Number(price);
    const p1m = Number(priceMonthlyAll);
    const p3m = Number(price3MonthAll);

    if (Number.isNaN(pSpec) || pSpec < 0 || Number.isNaN(p1m) || p1m < 0 || Number.isNaN(p3m) || p3m < 0) {
        return res.status(400).json({ error: 'Valid prices are required' });
    }
    
    try {
        await saveConfig({ 
            pricePerSpecUsdPerMonth: pSpec,
            priceMonthlyAll: p1m,
            price3MonthAll: p3m
        });
        auditAdmin(req, 'config.update_price', { pSpec, p1m, p3m });
        res.json({ ok: true, price: pSpec, priceMonthlyAll: p1m, price3MonthAll: p3m });
    } catch (e) {
        res.status(500).json({ error: 'Failed to update configuration' });
    }
});

app.get('/api/admin/licenses', requireAdmin('support'), async (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    const plan = String(req.query.plan || '').trim().toLowerCase();
    const status = String(req.query.status || '').trim().toLowerCase();
    const db = await loadDB();
    const now = new Date();

    let list = Object.entries(db).map(([key, license]) => {
        const effectiveExpiresAt = getLicenseExpiresAt(license);
        const isBound = !!license.hwid;
        const expiryStarted = isBound || !!license._expiryStarted;
        return {
            key,
            ...license,
            expiresAt: expiryStarted ? effectiveExpiresAt : null,
            isExpired: license.plan !== 'lifetime' && expiryStarted && new Date(effectiveExpiresAt) <= now,
            isBound,
            _expiryStarted: expiryStarted,
            pendingDurationMonths: license.pendingDurationMonths || null,
            boundAt: license.boundAt || null,
        };
    });

    if (q) {
        list = list.filter((l) => {
            const specIds = Array.isArray(l.specs)
                ? l.specs.map(s => typeof s === 'object' ? s.id : s).join(',')
                : '';
            const hay = [
                l.key,
                l.plan,
                l.email || '',
                l.orderId || '',
                specIds,
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
        durationValue = 1,
        durationUnit = 'minutes',
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

    const normalizedPlan = ['lifetime', 'monthly', 'monthly_per_spec', 'custom'].includes(String(plan))
        ? String(plan)
        : 'monthly';
    const entry = {
        hwid: null,
        plan: normalizedPlan,
        createdAt: new Date().toISOString(),
        expiresAt: null, // Timer starts when HWID is bound
        _expiryStarted: false,
        active: !!active,
        email: email ? String(email).slice(0, 200) : undefined,
    };

    if (normalizedPlan === 'custom') {
        // Custom plans: store duration info, timer starts on bind
        const unit = String(durationUnit || 'minutes').toLowerCase();
        const value = Math.max(1, Number(durationValue) || 1);
        const safeValue = Math.min(525600, value);
        entry.pendingDurationMonths = null; // custom uses its own unit
        entry._customDuration = { value: safeValue, unit };
        // Don't set expiresAt — timer starts when HWID is bound
        entry._expiryStarted = false;
    } else if (normalizedPlan === 'lifetime') {
        entry.expiresAt = '2099-12-31T23:59:59.000Z';
        entry._expiryStarted = true;
    } else {
        const safeMonths = Math.max(1, Math.min(36, Number(months) || 1));
        entry.pendingDurationMonths = safeMonths;
        // expiresAt stays null — will be set when HWID is bound
    }
    if (normalizedPlan === 'monthly_per_spec') {
        const specIds = Array.isArray(specs) ? [...new Set(specs.map((s) => String(s)))].slice(0, 64) : [];
        const nowCreate = new Date().toISOString();
        entry.specs = specIds.map(id => ({ id, addedAt: nowCreate, expiresAt: null }));
    }

    db[key] = entry;
    saveDB(db);
    auditAdmin(req, 'license.create', {
        key,
        plan: normalizedPlan,
        months,
        durationValue,
        durationUnit,
        specsCount: entry.specs?.length || 0
    });
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
    l.boundAt = null;
    // Don't reset _expiryStarted or expiresAt — the timer keeps running
    // The user just needs to re-bind on a new PC, but time already consumed is lost
    await saveDB(db);
    auditAdmin(req, 'license.reset_hwid', { key });
    res.json({ ok: true, key, hwid: null });
});

app.post('/api/admin/licenses/:key/resend-email', requireAdmin('owner'), async (req, res) => {
    const key = normalizeLicenseKey(req.params.key);
    const db = await loadDB();
    const l = db[key];
    if (!l) return res.status(404).json({ error: 'License not found' });
    if (!l.email) return res.status(400).json({ error: 'License has no email address' });

    const result = await sendLicenseEmail({
        email: l.email,
        licenseKey: key,
        plan: l.plan,
        specs: l.specs || null,
        expiresAt: l.expiresAt,
        kind: l.plan,
    });

    if (result.sent) {
        auditAdmin(req, 'license.resend_email', { key, email: l.email });
        res.json({ ok: true, key, email: l.email, messageId: result.messageId });
    } else {
        res.status(500).json({ error: 'Failed to send email', reason: result.reason });
    }
});

app.post('/api/admin/licenses/:key/extend', requireAdmin('owner'), async (req, res) => {
    const key = normalizeLicenseKey(req.params.key);
    const months = Math.max(1, Math.min(36, Number(req.body?.months) || 1));
    const db = await loadDB();
    const l = db[key];
    if (!l) return res.status(404).json({ error: 'License not found' });
    if (l.plan === 'lifetime') return res.status(400).json({ error: 'Lifetime licenses do not need extension' });

    const now = new Date();
    const expiryStarted = !!l.hwid || !!l._expiryStarted;
    if (!expiryStarted) {
        // License not yet bound — increase pending duration
        if (l._customDuration) {
            // Custom plans: add months to the custom duration as months
            if (l._customDuration.unit === 'months' || l._customDuration.unit === 'years') {
                l._customDuration.value += (l._customDuration.unit === 'years' ? months : months);
            } else {
                // For other units, convert months to approximate days and add
                const daysToAdd = months * 30;
                if (l._customDuration.unit === 'days') l._customDuration.value += daysToAdd;
                else if (l._customDuration.unit === 'weeks') l._customDuration.value += Math.round(daysToAdd / 7);
                else if (l._customDuration.unit === 'hours') l._customDuration.value += daysToAdd * 24;
                else if (l._customDuration.unit === 'minutes') l._customDuration.value += daysToAdd * 24 * 60;
                else l._customDuration.value += daysToAdd;
            }
        } else {
            l.pendingDurationMonths = (l.pendingDurationMonths || 1) + months;
        }
    } else {
        const base = l.expiresAt ? new Date(l.expiresAt) : now;
        const from = Number.isNaN(base.getTime()) || base < now ? now : base;
        from.setMonth(from.getMonth() + months);
        l.expiresAt = from.toISOString();
    }

    // For per-spec licenses, also extend each spec's expiration
    if (l.plan === 'monthly_per_spec' && Array.isArray(l.specs)) {
        const normalized = normalizeSpecs(l.specs);
        for (const spec of normalized) {
            if (!expiryStarted) {
                // Don't set spec expiry if timer hasn't started
                spec.expiresAt = null;
            } else {
                const specBase = spec.expiresAt ? new Date(spec.expiresAt) : null;
                const specFrom = (!specBase || Number.isNaN(specBase.getTime()) || specBase < now) ? now : specBase;
                specFrom.setMonth(specFrom.getMonth() + months);
                spec.expiresAt = specFrom.toISOString();
            }
        }
        l.specs = normalized;
    }

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

app.post('/api/admin/audit/clear', requireAdmin('owner'), async (req, res) => {
    await clearAudit();
    auditAdmin(req, 'audit.clear', { cleared: true });
    res.json({ ok: true });
});

async function fulfillPerSpecMonthly(payment, specIds, emailFromPayment) {
    const db = await loadDB();
    const paymentId = payment.payment_id != null ? String(payment.payment_id) : '';
    if (paymentId && licenseHasPaymentId(db, paymentId)) {
        console.log('IPN duplicate ignored payment_id=', paymentId);
        return;
    }

    const cat = loadSpecsCatalog();
    const priceEach = await getActivePrice();
    const newKey = generateLicenseKey();
    const exp = new Date();
    exp.setMonth(exp.getMonth() + 1);

    const entry = {
        hwid: null,
        plan: 'monthly_per_spec',
        specs: specIds.map(id => ({ id: String(id), addedAt: new Date().toISOString(), expiresAt: null })),
        pricePerSpecUsdPerMonth: priceEach,
        createdAt: new Date().toISOString(),
        expiresAt: null, // Timer starts when HWID is bound
        _expiryStarted: false,
        pendingDurationMonths: 1,
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
    const priceEach = await getActivePrice();

    let plan = 'monthly';
    let expiresAt;
    let pendingDurationMonths = 1;
    let expiryStarted = false;
    if (specsFromOrder && specsFromOrder.length > 0) {
        plan = 'monthly_per_spec';
        expiresAt = null; // Timer starts on bind
        pendingDurationMonths = 1;
    } else if (priceAmount > 20) {
        plan = 'lifetime';
        expiresAt = '2099-12-31T23:59:59.000Z';
        expiryStarted = true;
    } else {
        expiresAt = null; // Timer starts on bind
        pendingDurationMonths = 1;
    }

    const newKey = generateLicenseKey();
    const entry = {
        hwid: null,
        plan,
        createdAt: new Date().toISOString(),
        expiresAt,
        _expiryStarted: expiryStarted,
        pendingDurationMonths: plan !== 'lifetime' ? pendingDurationMonths : undefined,
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
        const nowLegacy = new Date().toISOString();
        entry.specs = specsFromOrder.map(id => ({ id: String(id), addedAt: nowLegacy, expiresAt: null }));
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

// ── WebSocket Server (authenticated) ──
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/admin', noServer: false });

const wsClients = new Set();
wss.on('connection', (ws, req) => {
    // ── Authenticate via ?token= query param on WS upgrade ──
    const url = new URL(req.url, 'http://localhost');
    const provided = String(url.searchParams.get('token') || '').trim();
    const accounts = getAdminAccounts();
    const matched = accounts.find(a => a.token === provided);
    if (!matched) {
        ws.close(4401, 'Unauthorized');
        return;
    }
    wsClients.add(ws);
    ws.on('close', () => wsClients.delete(ws));
    ws.on('error', () => wsClients.delete(ws));
});

function wsBroadcast(data) {
    const msg = JSON.stringify(data);
    for (const ws of wsClients) {
        try { ws.send(msg); } catch (_) { /* ignore */ }
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`WebSocket admin feed: ws://localhost:${PORT}/ws/admin`);
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
