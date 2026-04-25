const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS licenses (
        key VARCHAR(255) PRIMARY KEY,
        data JSONB NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS pending_orders (
        order_id VARCHAR(255) PRIMARY KEY,
        data JSONB NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } finally {
    client.release();
  }
}

async function loadDB() {
  const res = await pool.query('SELECT key, data FROM licenses');
  const db = {};
  for (const row of res.rows) {
    db[row.key] = row.data;
  }
  return db;
}

// In Postgres, we don't need to rewrite the entire DB. We can upsert.
// However, the original code passes the entire DB object: `saveDB({ "key": { hwid:... } })`
// For compatibility, we'll sync the object if needed, or we just write a new `upsertLicense` instead of `saveDB`.
// But honestly, doing a bulk upsert is fine since there's ~100 licenses.
async function saveDB(data) {
  // To avoid updating all rows unnecessarily, we generally recommend changing the calling signature.
  // But for full drop-in replacement of `saveDB`:
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // For simplicity, we can do an UPSERT for each key... or replace all.
    for (const [key, val] of Object.entries(data)) {
      await client.query(
        'INSERT INTO licenses(key, data) VALUES($1, $2) ON CONFLICT(key) DO UPDATE SET data = EXCLUDED.data',
        [key, val]
      );
    }
    
    // Deleting keys that are in DB but no longer in data:
    const existing = await client.query('SELECT key FROM licenses');
    const existingKeys = existing.rows.map(r => r.key);
    for (const ek of existingKeys) {
      if (!data[ek]) {
        await client.query('DELETE FROM licenses WHERE key = $1', [ek]);
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function loadPendingOrders() {
  const res = await pool.query('SELECT data FROM pending_orders');
  return res.rows.map(r => r.data);
}

async function savePendingOrders(list) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const order of list) {
      if (order.orderId) {
        await client.query(
          'INSERT INTO pending_orders(order_id, data) VALUES($1, $2) ON CONFLICT(order_id) DO UPDATE SET data = EXCLUDED.data',
          [order.orderId, order]
        );
      }
    }
    // Deleting orders that are no longer in the list
    const orderIds = list.map(o => o.orderId).filter(Boolean);
    if (orderIds.length > 0) {
      await client.query('DELETE FROM pending_orders WHERE order_id != ALL($1::varchar[])', [orderIds]);
    } else {
      await client.query('DELETE FROM pending_orders');
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function findPendingByOrderId(orderId) {
  const res = await pool.query('SELECT data FROM pending_orders WHERE order_id = $1', [orderId]);
  return res.rows.length ? res.rows[0].data : null;
}

async function upsertPendingOrder(entry) {
  if (!entry.orderId) return;
  await pool.query(
    'INSERT INTO pending_orders(order_id, data) VALUES($1, $2) ON CONFLICT(order_id) DO UPDATE SET data = EXCLUDED.data',
    [entry.orderId, entry]
  );
}

async function deletePendingOrder(orderId) {
  await pool.query('DELETE FROM pending_orders WHERE order_id = $1', [orderId]);
}


async function appendAudit(entry) {
  const logEntry = {
    at: new Date().toISOString(),
    ...entry,
  };
  await pool.query('INSERT INTO audit_log(data) VALUES($1)', [logEntry]);
}

async function readAudit(limit = 200) {
  const safeLimit = Math.max(1, Math.min(1000, Number(limit) || 200));
  const res = await pool.query('SELECT data FROM audit_log ORDER BY id DESC LIMIT $1', [safeLimit]);
  return res.rows.map(r => r.data);
}

module.exports = {
  pool,
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
};
