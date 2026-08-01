const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'apostando_db',
    port: process.env.DB_PORT || 3306
};

async function restore() {
    const args = process.argv.slice(2);
    const backupDir = path.join(__dirname, 'backups');

    if (args.length > 0) {
        var filePath = path.resolve(args[0]);
    } else {
        const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.sql')).sort().reverse();
        if (files.length === 0) { console.log('No hay backups en backups/'); return; }
        var filePath = path.join(backupDir, files[0]);
    }

    if (!fs.existsSync(filePath)) { console.log('Archivo no encontrado:', filePath); return; }

    const sql = fs.readFileSync(filePath, 'utf8');
    const statements = sql.split(';\n').filter(s => s.trim());

    const c = await mysql.createConnection(dbConfig);

    for (const stmt of statements) {
        try { await c.execute(stmt + ';'); } catch (e) { console.log('Error en:', stmt.slice(0, 80), e.message); }
    }

    console.log(`Restaurado desde: ${filePath}`);
    await c.end();
}

restore().catch(e => { console.error('Error:', e.message); process.exit(1); });