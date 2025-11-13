const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
const PORT = 3001; // Puerto diferente para no conflicto

// Middleware básico
app.use(express.json());
app.use(express.static('simple-public'));

// Configuración MySQL simple
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'apostando_db'
};

// Conexión global
let db;

// ============= ENDPOINTS ESENCIALES =============

// 1. GUARDAR SORTEO
app.post('/sorteo', async (req, res) => {
    try {
        console.log('📝 Datos recibidos:', JSON.stringify(req.body, null, 2));
        
        const { concurso, fecha, primer, segunda, revancha, siempre } = req.body;
        
        // Log detallado
        console.log('Desglose de datos:');
        console.log('- Concurso:', concurso, typeof concurso);
        console.log('- Fecha:', fecha, typeof fecha);
        console.log('- Primera:', primer, Array.isArray(primer));
        console.log('- Segunda:', segunda, Array.isArray(segunda));
        console.log('- Revancha:', revancha, Array.isArray(revancha));
        console.log('- Siempre:', siempre, Array.isArray(siempre));
        
        // Validación mínima con más detalle
        const errores = [];
        if (!concurso) errores.push('Falta concurso');
        if (!fecha) errores.push('Falta fecha');
        if (!primer || !Array.isArray(primer) || primer.length !== 6) errores.push('Primera incorrecta');
        if (!segunda || !Array.isArray(segunda) || segunda.length !== 6) errores.push('Segunda incorrecta');
        if (!revancha || !Array.isArray(revancha) || revancha.length !== 6) errores.push('Revancha incorrecta');
        if (!siempre || !Array.isArray(siempre) || siempre.length !== 6) errores.push('Siempre Sale incorrecta');
        
        if (errores.length > 0) {
            console.log('❌ Errores:', errores);
            return res.status(400).json({ error: errores.join(', ') });
        }
        
        // Premio Extra automático (18 números únicos)
        const premioExtra = [...primer, ...segunda, ...revancha].sort((a, b) => a - b);
        
        // Insertar sorteo
        await db.execute('INSERT INTO quini_sorteos (id, fecha) VALUES (?, ?)', [concurso, fecha]);
        
        // Insertar números (batch simple)
        const numeros = [];
        primer.forEach(n => numeros.push([concurso, 'primer', n]));
        segunda.forEach(n => numeros.push([concurso, 'segunda', n]));
        revancha.forEach(n => numeros.push([concurso, 'revancha', n]));
        siempre.forEach(n => numeros.push([concurso, 'siempre', n]));
        premioExtra.forEach(n => numeros.push([concurso, 'premio_extra', n]));
        
        const values = numeros.map(() => '(?, ?, ?)').join(', ');
        await db.execute(`INSERT INTO quini_numeros (sorteo_id, tipo, numero) VALUES ${values}`, numeros.flat());
        
        res.json({ success: true, concurso, premioExtra });
        
    } catch (error) {
        // Log detallado del error
        console.error('❌ Error detallado:', {
            message: error.message,
            code: error.code,
            errno: error.errno,
            sql: error.sql,
            sqlMessage: error.sqlMessage,
            sqlState: error.sqlState
        });
        res.status(500).json({ 
            error: 'Error guardando sorteo', 
            details: error.sqlMessage || error.message 
        });
    }
});

// 2. VER SORTEOS
app.get('/sorteos', async (req, res) => {
    try {
        const [sorteos] = await db.execute('SELECT * FROM quini_sorteos ORDER BY fecha DESC LIMIT 10');
        res.json(sorteos);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error obteniendo sorteos' });
    }
});

// 3. FRECUENCIAS QUINI 6
app.get('/frecuencias', async (req, res) => {
    try {
        const [result] = await db.execute(`
            SELECT numero, COUNT(*) as frecuencia
            FROM quini_numeros 
            WHERE tipo IN ('primer', 'segunda', 'revancha', 'siempre')
            GROUP BY numero 
            ORDER BY frecuencia DESC, numero ASC
        `);
        
        res.json(result);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error calculando frecuencias' });
    }
});

// ============= LOTO PLUS ENDPOINTS =============

// 4. GUARDAR LOTO PLUS
app.post('/loto-plus', async (req, res) => {
    try {
        const { concurso, fecha, tradicional, match, desquite, saleOSale, numeroJack } = req.body;
        
        // Validación mínima
        if (!concurso || !fecha || !tradicional || !match || !desquite || !saleOSale || numeroJack === undefined) {
            return res.status(400).json({ error: 'Datos incompletos' });
        }
        
        // Crear registro simple en tabla temporal (usaremos la misma estructura adaptada)
        await db.execute('INSERT INTO loto_plus_sorteos (id, fecha) VALUES (?, ?) ON DUPLICATE KEY UPDATE fecha = ?', [concurso, fecha, fecha]);
        
        // Insertar números
        const numeros = [];
        tradicional.forEach(n => numeros.push([concurso, 'tradicional', n]));
        match.forEach(n => numeros.push([concurso, 'match', n]));
        desquite.forEach(n => numeros.push([concurso, 'desquite', n]));
        saleOSale.forEach(n => numeros.push([concurso, 'sale_o_sale', n]));
        numeros.push([concurso, 'jack', numeroJack]);
        
        // Limpiar números existentes del sorteo
        await db.execute('DELETE FROM loto_plus_numeros WHERE sorteo_id = ?', [concurso]);
        
        const values = numeros.map(() => '(?, ?, ?)').join(', ');
        await db.execute(`INSERT INTO loto_plus_numeros (sorteo_id, tipo, numero) VALUES ${values}`, numeros.flat());
        
        res.json({ success: true, concurso });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error guardando sorteo Loto Plus' });
    }
});

// 5. FRECUENCIAS LOTO PLUS
app.get('/frecuencias-loto-plus', async (req, res) => {
    try {
        const [numeros] = await db.execute(`
            SELECT numero, COUNT(*) as frecuencia
            FROM loto_plus_numeros 
            WHERE tipo IN ('tradicional', 'match', 'desquite', 'sale_o_sale')
            GROUP BY numero 
            ORDER BY frecuencia DESC, numero ASC
        `);
        
        const [jacks] = await db.execute(`
            SELECT numero, COUNT(*) as frecuencia
            FROM loto_plus_numeros 
            WHERE tipo = 'jack'
            GROUP BY numero 
            ORDER BY frecuencia DESC, numero ASC
        `);
        
        res.json({ numeros, jacks });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error calculando frecuencias Loto Plus' });
    }
});

// 6. VER SORTEOS LOTO PLUS
app.get('/sorteos-loto-plus', async (req, res) => {
    try {
        const [sorteos] = await db.execute('SELECT * FROM loto_plus_sorteos ORDER BY fecha DESC LIMIT 10');
        res.json(sorteos);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error obteniendo sorteos Loto Plus' });
    }
});

// Página principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'simple-public', 'index.html'));
});

// ============= INICIO =============
async function start() {
    try {
        // Conectar DB
        db = await mysql.createConnection(dbConfig);
        console.log('✅ MySQL conectado');
        
        // Crear tablas de Quini 6 si no existen
        await db.execute(`
            CREATE TABLE IF NOT EXISTS quini_sorteos (
                id INT PRIMARY KEY,
                fecha DATE NOT NULL
            )
        `);
        
        await db.execute(`
            CREATE TABLE IF NOT EXISTS quini_numeros (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sorteo_id INT NOT NULL,
                tipo ENUM('primer', 'segunda', 'revancha', 'siempre', 'premio_extra') NOT NULL,
                numero INT NOT NULL,
                FOREIGN KEY (sorteo_id) REFERENCES quini_sorteos(id) ON DELETE CASCADE
            )
        `);
        
        console.log('✅ Tablas Quini 6 verificadas');
        
        // Crear tablas de Loto Plus si no existen
        await db.execute(`
            CREATE TABLE IF NOT EXISTS loto_plus_sorteos (
                id INT PRIMARY KEY,
                fecha DATE NOT NULL
            )
        `);
        
        await db.execute(`
            CREATE TABLE IF NOT EXISTS loto_plus_numeros (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sorteo_id INT NOT NULL,
                tipo ENUM('tradicional', 'match', 'desquite', 'sale_o_sale', 'jack') NOT NULL,
                numero INT NOT NULL
            )
        `);
        
        console.log('✅ Tablas Loto Plus verificadas');
        
        // Iniciar servidor
        app.listen(PORT, () => {
            console.log(`🚀 Servidor simple en http://localhost:${PORT}`);
            console.log('📊 Quini 6: /sorteo (POST), /sorteos (GET), /frecuencias (GET)');
            console.log('📊 Loto Plus: /loto-plus (POST), /sorteos-loto-plus (GET), /frecuencias-loto-plus (GET)');
        });
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

start();