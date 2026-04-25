require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool, initDB, saveDB, savePendingOrders, appendAudit } = require('./database');

async function migrate() {
    try {
        console.log('Connecting to Postgres and initializing tables...');
        await initDB();
        console.log('Tables initialized or verified.');

        const dbFile = path.join(__dirname, 'licenses.json');
        if (fs.existsSync(dbFile)) {
            console.log('Migrating licenses.json...');
            const dbData = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
            await saveDB(dbData);
            console.log(`Migrated ${Object.keys(dbData).length} licenses.`);
        }

        const pendingFile = path.join(__dirname, 'pending_orders.json');
        if (fs.existsSync(pendingFile)) {
            console.log('Migrating pending_orders.json...');
            const pendingData = JSON.parse(fs.readFileSync(pendingFile, 'utf8'));
            await savePendingOrders(pendingData);
            console.log(`Migrated ${pendingData.length} pending orders.`);
        }

        const auditFile = path.join(__dirname, 'admin_audit.jsonl');
        if (fs.existsSync(auditFile)) {
            console.log('Migrating admin_audit.jsonl...');
            const raw = fs.readFileSync(auditFile, 'utf8');
            const lines = raw.split(/\r?\n/).filter(Boolean);
            for (const line of lines) {
                try {
                    const entry = JSON.parse(line);
                    await appendAudit(entry);
                } catch (e) {
                    // ignore invalid
                }
            }
            console.log(`Migrated ${lines.length} audit logs.`);
        }

        console.log('\nMigration complete! Data was successfully pushed to Supabase Postgres.');
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        await pool.end();
    }
}

migrate();
