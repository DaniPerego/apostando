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

async function backup() {
    const c = await mysql.createConnection(dbConfig);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupDir = path.join(__dirname, 'backups');
    const filePath = path.join(backupDir, `backup_${timestamp}.sql`);

    let sql = `-- Apostando Backup - ${new Date().toISOString()}\n\n`;

    // Quini 6
    const [sorteos] = await c.execute('SELECT * FROM quini_sorteos ORDER BY id');
    for (const s of sorteos) {
        sql += `INSERT INTO quini_sorteos (id, fecha) VALUES (${s.id}, '${s.fecha}');\n`;
        const [nums] = await c.execute('SELECT tipo, numero FROM quini_numeros WHERE sorteo_id = ?', [s.id]);
        for (const n of nums) {
            sql += `INSERT INTO quini_numeros (sorteo_id, tipo, numero) VALUES (${s.id}, '${n.tipo}', ${n.numero});\n`;
        }
    }

    // Loto Plus
    const [loto] = await c.execute('SELECT * FROM loto_plus_sorteos ORDER BY id');
    for (const s of loto) {
        sql += `INSERT INTO loto_plus_sorteos (id, fecha) VALUES (${s.id}, '${s.fecha}');\n`;
        const [nums] = await c.execute('SELECT tipo, numero FROM loto_plus_numeros WHERE sorteo_id = ?', [s.id]);
        for (const n of nums) {
            sql += `INSERT INTO loto_plus_numeros (sorteo_id, tipo, numero) VALUES (${s.id}, '${n.tipo}', ${n.numero});\n`;
        }
    }

    fs.writeFileSync(filePath, sql, 'utf8');
    console.log(`Backup creado: ${filePath}`);
    console.log(`${sorteos.length} sorteos Quini 6, ${loto.length} sorteos Loto Plus`);

    await c.end();
}

backup().catch(e => { console.error('Error:', e.message); process.exit(1); });