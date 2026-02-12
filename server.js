const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
const PORT = 3001;

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

        // Validación mínima
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
        console.error('❌ Error:', error);
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

        // Obtener números para cada sorteo
        for (const sorteo of sorteos) {
            // Obtener todos los números incluyendo premio extra
            const [numeros] = await db.execute('SELECT numero, tipo FROM quini_numeros WHERE sorteo_id = ? ORDER BY id', [sorteo.id]);
            
            // Separar por tipo
            sorteo.primer = numeros.filter(n => n.tipo === 'primer').map(n => n.numero);
            sorteo.segunda = numeros.filter(n => n.tipo === 'segunda').map(n => n.numero);
            sorteo.revancha = numeros.filter(n => n.tipo === 'revancha').map(n => n.numero);
            sorteo.siempre = numeros.filter(n => n.tipo === 'siempre').map(n => n.numero);
            sorteo.premioExtra = numeros.filter(n => n.tipo === 'premio_extra').map(n => n.numero);
            
            sorteo.numeros = numeros.map(n => n.numero);
            sorteo.concurso = sorteo.id;
        }

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

// 3.5 ACTUALIZAR SORTEO QUINI 6
app.put('/sorteo/actualizar', async (req, res) => {
    try {
        const { concurso, fecha, primer, segunda, revancha, siempre, concursoOriginal, fechaOriginal } = req.body;

        console.log('📝 Actualizar sorteo:', { concurso, fecha, concursoOriginal, fechaOriginal });

        // Validación
        if (!concurso || !fecha || !primer || !segunda || !revancha || !siempre) {
            return res.status(400).json({ error: 'Datos incompletos' });
        }

        // Si el concurso o fecha cambiaron, eliminar el sorteo anterior
        if (concursoOriginal && fechaOriginal && (concursoOriginal !== concurso || fechaOriginal !== fecha)) {
            await db.execute('DELETE FROM quini_sorteos WHERE id = ?', [concursoOriginal]);
        } else {
            // Si no cambiaron, solo eliminar los números del sorteo actual
            await db.execute('DELETE FROM quini_numeros WHERE sorteo_id = ?', [concurso]);
        }

        // Insertar/actualizar sorteo
        await db.execute('INSERT INTO quini_sorteos (id, fecha) VALUES (?, ?) ON DUPLICATE KEY UPDATE fecha = ?', [concurso, fecha, fecha]);

        // Insertar números
        const premioExtra = [...primer, ...segunda, ...revancha].sort((a, b) => a - b);
        const numeros = [];
        primer.forEach(n => numeros.push([concurso, 'primer', n]));
        segunda.forEach(n => numeros.push([concurso, 'segunda', n]));
        revancha.forEach(n => numeros.push([concurso, 'revancha', n]));
        siempre.forEach(n => numeros.push([concurso, 'siempre', n]));
        premioExtra.forEach(n => numeros.push([concurso, 'premio_extra', n]));

        const values = numeros.map(() => '(?, ?, ?)').join(', ');
        await db.execute(`INSERT INTO quini_numeros (sorteo_id, tipo, numero) VALUES ${values}`, numeros.flat());

        res.json({ success: true, concurso });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error actualizando sorteo', details: error.message });
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

        // Crear registro simple en tabla temporal
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

// 4.5 ACTUALIZAR LOTO PLUS
app.put('/loto-plus/actualizar', async (req, res) => {
    try {
        const { concurso, fecha, tradicional, match, desquite, saleOSale, numeroJack, concursoOriginal, fechaOriginal } = req.body;

        console.log('📝 Actualizar Loto Plus:', { concurso, fecha, concursoOriginal, fechaOriginal });

        // Validación
        if (!concurso || !fecha || !tradicional || !match || !desquite || !saleOSale || numeroJack === undefined) {
            return res.status(400).json({ error: 'Datos incompletos' });
        }

        // Si el concurso o fecha cambiaron, eliminar el sorteo anterior
        if (concursoOriginal && fechaOriginal && (concursoOriginal !== concurso || fechaOriginal !== fecha)) {
            await db.execute('DELETE FROM loto_plus_sorteos WHERE id = ?', [concursoOriginal]);
        } else {
            // Si no cambiaron, solo eliminar los números del sorteo actual
            await db.execute('DELETE FROM loto_plus_numeros WHERE sorteo_id = ?', [concurso]);
        }

        // Insertar/actualizar sorteo
        await db.execute('INSERT INTO loto_plus_sorteos (id, fecha) VALUES (?, ?) ON DUPLICATE KEY UPDATE fecha = ?', [concurso, fecha, fecha]);

        // Insertar números
        const numeros = [];
        tradicional.forEach(n => numeros.push([concurso, 'tradicional', n]));
        match.forEach(n => numeros.push([concurso, 'match', n]));
        desquite.forEach(n => numeros.push([concurso, 'desquite', n]));
        saleOSale.forEach(n => numeros.push([concurso, 'sale_o_sale', n]));
        numeros.push([concurso, 'jack', numeroJack]);

        const values = numeros.map(() => '(?, ?, ?)').join(', ');
        await db.execute(`INSERT INTO loto_plus_numeros (sorteo_id, tipo, numero) VALUES ${values}`, numeros.flat());

        res.json({ success: true, concurso });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error actualizando sorteo Loto Plus', details: error.message });
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

        // Obtener números para cada sorteo
        for (const sorteo of sorteos) {
            const [numeros] = await db.execute('SELECT numero, tipo FROM loto_plus_numeros WHERE sorteo_id = ?', [sorteo.id]);
            sorteo.numeros = numeros.filter(n => n.tipo !== 'jack').map(n => n.numero);
            const jack = numeros.find(n => n.tipo === 'jack');
            if (jack) sorteo.jack = jack.numero;
            sorteo.concurso = sorteo.id;
        }

        res.json(sorteos);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error obteniendo sorteos Loto Plus' });
    }
});

// ============= ENDPOINTS DE PATRONES =============

function calcularPatrones(numeros, totalSorteos) {
    const stats = {};
    for (let i = 0; i <= 45; i++) {
        stats[i] = { numero: i, apariciones: 0, ultimaAparicion: null, intervalos: [], sorteosSinSalir: 0 };
    }
    numeros.forEach((sorteo, indexSorteo) => {
        sorteo.numeros.forEach(num => {
            if (stats[num]) {
                if (stats[num].ultimaAparicion === null) {
                    stats[num].sorteosSinSalir = indexSorteo;
                } else {
                    stats[num].intervalos.push(indexSorteo - stats[num].ultimaAparicion);
                }
                stats[num].ultimaAparicion = indexSorteo;
                stats[num].apariciones++;
            }
        });
    });
    return Object.values(stats).map(stat => {
        if (stat.ultimaAparicion === null) stat.sorteosSinSalir = totalSorteos;
        const promedio = stat.intervalos.length > 0 ? stat.intervalos.reduce((a, b) => a + b, 0) / stat.intervalos.length : totalSorteos;
        let estado = 'tibio';
        if (stat.sorteosSinSalir > promedio * 2) estado = 'muy-frio';
        else if (stat.sorteosSinSalir > promedio) estado = 'frio';
        else if (stat.sorteosSinSalir < promedio * 0.2) estado = 'caliente';
        return { numero: stat.numero, sorteosSinSalir: stat.sorteosSinSalir, intervaloPromedio: parseFloat(promedio.toFixed(2)), estado, frecuencia: stat.apariciones };
    }).filter(s => s.numero > 0 || (s.numero === 0 && s.apariciones > 0));
}

app.get('/patrones-quini', async (req, res) => {
    try {
        const [sorteosDB] = await db.execute('SELECT * FROM quini_sorteos ORDER BY fecha DESC');
        const sorteos = [];
        for (const s of sorteosDB) {
            const [nums] = await db.execute('SELECT numero FROM quini_numeros WHERE sorteo_id = ? AND tipo IN ("primer", "segunda", "revancha", "siempre")', [s.id]);
            sorteos.push({ fecha: s.fecha, numeros: nums.map(n => n.numero) });
        }
        res.json({ patrones: calcularPatrones(sorteos, sorteos.length) });
    } catch (error) {
        console.error('Error patrones quini:', error);
        res.status(500).json({ error: 'Error calculando patrones' });
    }
});

app.get('/patrones-loto-plus', async (req, res) => {
    try {
        const [sorteosDB] = await db.execute('SELECT * FROM loto_plus_sorteos ORDER BY fecha DESC');
        const sorteos = [];
        for (const s of sorteosDB) {
            const [nums] = await db.execute('SELECT numero FROM loto_plus_numeros WHERE sorteo_id = ? AND tipo IN ("tradicional", "match", "desquite", "sale_o_sale")', [s.id]);
            sorteos.push({ fecha: s.fecha, numeros: nums.map(n => n.numero) });
        }
        const sorteosJack = [];
        for (const s of sorteosDB) {
            const [nums] = await db.execute('SELECT numero FROM loto_plus_numeros WHERE sorteo_id = ? AND tipo = "jack"', [s.id]);
            if (nums.length > 0) sorteosJack.push({ fecha: s.fecha, numeros: nums.map(n => n.numero) });
        }
        res.json({ patrones: calcularPatrones(sorteos, sorteos.length), patronesJack: calcularPatrones(sorteosJack, sorteosJack.length) });
    } catch (error) {
        console.error('Error patrones loto:', error);
        res.status(500).json({ error: 'Error calculando patrones' });
    }
});

app.post('/sorteo/eliminar', async (req, res) => {
    try {
        const { concurso } = req.body;
        await db.execute('DELETE FROM quini_sorteos WHERE id = ?', [concurso]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/loto-plus/eliminar', async (req, res) => {
    try {
        const { concurso } = req.body;
        await db.execute('DELETE FROM loto_plus_sorteos WHERE id = ?', [concurso]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
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
            console.log('📊 Quini 6: /sorteo (POST), /sorteos (GET), /frecuencias (GET), /sorteo/actualizar (PUT)');
            console.log('📊 Loto Plus: /loto-plus (POST), /sorteos-loto-plus (GET), /frecuencias-loto-plus (GET), /loto-plus/actualizar (PUT)');
        });

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

start();