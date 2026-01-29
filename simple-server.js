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
        
        const { concurso, fecha, primer, segunda, revancha, siempre, huboGanador, cantidadGanadores } = req.body;
        
        // Log detallado
        console.log('Desglose de datos:');
        console.log('- Concurso:', concurso, typeof concurso);
        console.log('- Fecha:', fecha, typeof fecha);
        console.log('- Primera:', primer, Array.isArray(primer));
        console.log('- Segunda:', segunda, Array.isArray(segunda));
        console.log('- Revancha:', revancha, Array.isArray(revancha));
        console.log('- Siempre:', siempre, Array.isArray(siempre));
        console.log('- Hubo ganador:', huboGanador);
        console.log('- Cantidad ganadores:', cantidadGanadores);
        
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
        
        // Convertir huboGanador a boolean o NULL
        let huboGanadorBool = null;
        if (huboGanador === 'si') huboGanadorBool = true;
        else if (huboGanador === 'no') huboGanadorBool = false;
        
        // Convertir cantidadGanadores a número o NULL
        const cantGanadores = cantidadGanadores ? parseInt(cantidadGanadores) : null;
        
        // Insertar sorteo con información de ganadores
        await db.execute(
            'INSERT INTO quini_sorteos (id, fecha, hubo_ganador, cantidad_ganadores) VALUES (?, ?, ?, ?)', 
            [concurso, fecha, huboGanadorBool, cantGanadores]
        );
        
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
        const [sorteos] = await db.execute('SELECT id, fecha, hubo_ganador, cantidad_ganadores FROM quini_sorteos ORDER BY fecha DESC');
        
        console.log('📊 Consultando sorteos. Primeros 3 resultados:');
        sorteos.slice(0, 3).forEach((sorteo, index) => {
            console.log(`  ${index + 1}. ID: ${sorteo.id}, Fecha: ${sorteo.fecha}, Ganador: ${sorteo.hubo_ganador}, Cantidad: ${sorteo.cantidad_ganadores}`);
        });
        
        // Para cada sorteo, obtener sus números ordenados por tipo con info de ganadores por categoría
        const sorteosConNumeros = await Promise.all(sorteos.map(async (sorteo) => {
            const [numeros] = await db.execute(
                `SELECT numero, tipo, hubo_ganador, cantidad_ganadores FROM quini_numeros 
                 WHERE sorteo_id = ? AND tipo != 'premio_extra'
                 ORDER BY 
                    CASE tipo
                        WHEN 'primer' THEN 1
                        WHEN 'segunda' THEN 2
                        WHEN 'revancha' THEN 3
                        WHEN 'siempre' THEN 4
                    END,
                    numero`,
                [sorteo.id]
            );
            
            // Agrupar por tipo
            const ganadoresPorTipo = {};
            numeros.forEach(n => {
                if (!ganadoresPorTipo[n.tipo]) {
                    ganadoresPorTipo[n.tipo] = {
                        hubo_ganador: n.hubo_ganador,
                        cantidad_ganadores: n.cantidad_ganadores
                    };
                }
            });
            
            return {
                ...sorteo,
                concurso: sorteo.id,
                numeros: numeros.map(n => n.numero),
                ganadores_por_tipo: ganadoresPorTipo
            };
        }));
        
        res.json(sorteosConNumeros);
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
        const { concurso, fecha, tradicional, match, desquite, saleOSale, numeroJack, huboGanador, cantidadGanadores } = req.body;
        
        // Validación mínima
        if (!concurso || !fecha || !tradicional || !match || !desquite || !saleOSale || numeroJack === undefined) {
            return res.status(400).json({ error: 'Datos incompletos' });
        }
        
        // Convertir huboGanador a boolean o NULL
        let huboGanadorBool = null;
        if (huboGanador === 'si') huboGanadorBool = true;
        else if (huboGanador === 'no') huboGanadorBool = false;
        
        // Convertir cantidadGanadores a número o NULL
        const cantGanadores = cantidadGanadores ? parseInt(cantidadGanadores) : null;
        
        // Crear registro con información de ganadores
        await db.execute(
            'INSERT INTO loto_plus_sorteos (id, fecha, hubo_ganador, cantidad_ganadores) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE fecha = ?, hubo_ganador = ?, cantidad_ganadores = ?', 
            [concurso, fecha, huboGanadorBool, cantGanadores, fecha, huboGanadorBool, cantGanadores]
        );
        
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

// 5. ANÁLISIS DE PATRONES QUINI 6
app.get('/patrones-quini', async (req, res) => {
    try {
        // Obtener todos los sorteos ordenados por fecha
        const [sorteos] = await db.execute(`
            SELECT s.id as concurso, s.fecha 
            FROM quini_sorteos s 
            ORDER BY s.fecha ASC
        `);
        
        if (sorteos.length === 0) {
            return res.json({ patrones: [] });
        }
        
        // Para cada número del 0 al 45, calcular sus patrones
        const patrones = [];
        
        for (let num = 0; num <= 45; num++) {
            // Obtener todos los sorteos donde apareció este número
            const [apariciones] = await db.execute(`
                SELECT s.id as concurso, s.fecha,
                       ROW_NUMBER() OVER (ORDER BY s.fecha ASC) as posicion_sorteo
                FROM quini_sorteos s
                INNER JOIN quini_numeros n ON s.id = n.sorteo_id
                WHERE n.numero = ? AND n.tipo IN ('primer', 'segunda', 'revancha', 'siempre')
                ORDER BY s.fecha ASC
            `, [num]);
            
            if (apariciones.length === 0) {
                // Número nunca salió
                patrones.push({
                    numero: num,
                    frecuencia: 0,
                    intervaloPromedio: null,
                    sorteosSinSalir: sorteos.length,
                    ultimaAparicion: null,
                    estado: 'muy-frio'
                });
                continue;
            }
            
            // Calcular intervalos entre apariciones
            const intervalos = [];
            for (let i = 1; i < apariciones.length; i++) {
                const intervalo = apariciones[i].posicion_sorteo - apariciones[i-1].posicion_sorteo;
                intervalos.push(intervalo);
            }
            
            const intervaloPromedio = intervalos.length > 0 
                ? intervalos.reduce((a, b) => a + b, 0) / intervalos.length 
                : null;
            
            // Sorteos desde última aparición
            const ultimaPosicion = apariciones[apariciones.length - 1].posicion_sorteo;
            const sorteosSinSalir = sorteos.length - ultimaPosicion;
            
            // Determinar estado (caliente/tibio/frío) - basado en desviación del patrón
            let estado = 'tibio';
            if (intervaloPromedio !== null && intervaloPromedio > 0) {
                const desviacion = sorteosSinSalir / intervaloPromedio;
                
                if (desviacion >= 2.5) {
                    estado = 'muy-frio';  // Más del doble de lo esperado sin salir
                } else if (desviacion >= 1.5) {
                    estado = 'frio';      // 50% más de lo esperado
                } else if (desviacion <= 0.3) {
                    estado = 'caliente';  // Salió muy recientemente
                }
                // Entre 0.3 y 1.5 queda como 'tibio'
            } else if (apariciones.length === 1) {
                // Solo apareció una vez, usar sorteosSinSalir absoluto
                if (sorteosSinSalir > 30) {
                    estado = 'muy-frio';
                } else if (sorteosSinSalir > 15) {
                    estado = 'frio';
                } else if (sorteosSinSalir < 3) {
                    estado = 'caliente';
                }
            }
            
            patrones.push({
                numero: num,
                frecuencia: apariciones.length,
                intervaloPromedio: intervaloPromedio ? Math.round(intervaloPromedio * 10) / 10 : null,
                sorteosSinSalir: sorteosSinSalir,
                ultimaAparicion: apariciones[apariciones.length - 1].fecha,
                estado: estado
            });
        }
        
        // Ordenar por estado primero, luego por sorteos sin salir
        const ordenEstado = { 'muy-frio': 1, 'frio': 2, 'tibio': 3, 'caliente': 4 };
        patrones.sort((a, b) => {
            // Primero por estado
            if (ordenEstado[a.estado] !== ordenEstado[b.estado]) {
                return ordenEstado[a.estado] - ordenEstado[b.estado];
            }
            // Dentro del mismo estado, por sorteos sin salir (descendente)
            return b.sorteosSinSalir - a.sorteosSinSalir;
        });
        
        res.json({ 
            patrones,
            totalSorteos: sorteos.length
        });
    } catch (error) {
        console.error('Error calculando patrones:', error);
        res.status(500).json({ error: 'Error calculando patrones' });
    }
});

// 6. ANÁLISIS DE PATRONES LOTO PLUS
app.get('/patrones-loto-plus', async (req, res) => {
    try {
        // Obtener todos los sorteos ordenados por fecha
        const [sorteos] = await db.execute(`
            SELECT s.id as concurso, s.fecha 
            FROM loto_plus_sorteos s 
            ORDER BY s.fecha ASC
        `);
        
        if (sorteos.length === 0) {
            return res.json({ patrones: [], patronesJack: [] });
        }
        
        // Patrones para números normales (1-42)
        const patrones = [];
        
        for (let num = 1; num <= 42; num++) {
            const [apariciones] = await db.execute(`
                SELECT s.id as concurso, s.fecha,
                       ROW_NUMBER() OVER (ORDER BY s.fecha ASC) as posicion_sorteo
                FROM loto_plus_sorteos s
                INNER JOIN loto_plus_numeros n ON s.id = n.sorteo_id
                WHERE n.numero = ? AND n.tipo IN ('tradicional', 'match', 'desquite', 'sale_o_sale')
                ORDER BY s.fecha ASC
            `, [num]);
            
            if (apariciones.length === 0) {
                patrones.push({
                    numero: num,
                    frecuencia: 0,
                    intervaloPromedio: null,
                    sorteosSinSalir: sorteos.length,
                    ultimaAparicion: null,
                    estado: 'muy-frio'
                });
                continue;
            }
            
            const intervalos = [];
            for (let i = 1; i < apariciones.length; i++) {
                const intervalo = apariciones[i].posicion_sorteo - apariciones[i-1].posicion_sorteo;
                intervalos.push(intervalo);
            }
            
            const intervaloPromedio = intervalos.length > 0 
                ? intervalos.reduce((a, b) => a + b, 0) / intervalos.length 
                : null;
            
            const ultimaPosicion = apariciones[apariciones.length - 1].posicion_sorteo;
            const sorteosSinSalir = sorteos.length - ultimaPosicion;
            
            let estado = 'tibio';
            if (intervaloPromedio !== null && intervaloPromedio > 0) {
                const desviacion = sorteosSinSalir / intervaloPromedio;
                
                if (desviacion >= 2.5) {
                    estado = 'muy-frio';  // Más del doble de lo esperado sin salir
                } else if (desviacion >= 1.5) {
                    estado = 'frio';      // 50% más de lo esperado
                } else if (desviacion <= 0.3) {
                    estado = 'caliente';  // Salió muy recientemente
                }
                // Entre 0.3 y 1.5 queda como 'tibio'
            } else if (apariciones.length === 1) {
                // Solo apareció una vez, usar sorteosSinSalir absoluto
                if (sorteosSinSalir > 30) {
                    estado = 'muy-frio';
                } else if (sorteosSinSalir > 15) {
                    estado = 'frio';
                } else if (sorteosSinSalir < 3) {
                    estado = 'caliente';
                }
            }
            
            patrones.push({
                numero: num,
                frecuencia: apariciones.length,
                intervaloPromedio: intervaloPromedio ? Math.round(intervaloPromedio * 10) / 10 : null,
                sorteosSinSalir: sorteosSinSalir,
                ultimaAparicion: apariciones[apariciones.length - 1].fecha,
                estado: estado
            });
        }
        
        // Patrones para números Jack (1-10)
        const patronesJack = [];
        
        for (let num = 1; num <= 10; num++) {
            const [apariciones] = await db.execute(`
                SELECT s.id as concurso, s.fecha,
                       ROW_NUMBER() OVER (ORDER BY s.fecha ASC) as posicion_sorteo
                FROM loto_plus_sorteos s
                INNER JOIN loto_plus_numeros n ON s.id = n.sorteo_id
                WHERE n.numero = ? AND n.tipo = 'jack'
                ORDER BY s.fecha ASC
            `, [num]);
            
            if (apariciones.length === 0) {
                patronesJack.push({
                    numero: num,
                    frecuencia: 0,
                    intervaloPromedio: null,
                    sorteosSinSalir: sorteos.length,
                    ultimaAparicion: null,
                    estado: 'muy-frio'
                });
                continue;
            }
            
            const intervalos = [];
            for (let i = 1; i < apariciones.length; i++) {
                const intervalo = apariciones[i].posicion_sorteo - apariciones[i-1].posicion_sorteo;
                intervalos.push(intervalo);
            }
            
            const intervaloPromedio = intervalos.length > 0 
                ? intervalos.reduce((a, b) => a + b, 0) / intervalos.length 
                : null;
            
            const ultimaPosicion = apariciones[apariciones.length - 1].posicion_sorteo;
            const sorteosSinSalir = sorteos.length - ultimaPosicion;
            
            let estado = 'tibio';
            if (intervaloPromedio !== null && intervaloPromedio > 0) {
                const desviacion = sorteosSinSalir / intervaloPromedio;
                
                if (desviacion >= 2.5) {
                    estado = 'muy-frio';  // Más del doble de lo esperado sin salir
                } else if (desviacion >= 1.5) {
                    estado = 'frio';      // 50% más de lo esperado
                } else if (desviacion <= 0.3) {
                    estado = 'caliente';  // Salió muy recientemente
                }
                // Entre 0.3 y 1.5 queda como 'tibio'
            } else if (apariciones.length === 1) {
                // Solo apareció una vez, usar sorteosSinSalir absoluto (Jack sale menos frecuente)
                if (sorteosSinSalir > 40) {
                    estado = 'muy-frio';
                } else if (sorteosSinSalir > 20) {
                    estado = 'frio';
                } else if (sorteosSinSalir < 5) {
                    estado = 'caliente';
                }
            }
            
            patronesJack.push({
                numero: num,
                frecuencia: apariciones.length,
                intervaloPromedio: intervaloPromedio ? Math.round(intervaloPromedio * 10) / 10 : null,
                sorteosSinSalir: sorteosSinSalir,
                ultimaAparicion: apariciones[apariciones.length - 1].fecha,
                estado: estado
            });
        }
        
        // Ordenar por estado primero, luego por sorteos sin salir
        const ordenEstado = { 'muy-frio': 1, 'frio': 2, 'tibio': 3, 'caliente': 4 };
        patrones.sort((a, b) => {
            // Primero por estado
            if (ordenEstado[a.estado] !== ordenEstado[b.estado]) {
                return ordenEstado[a.estado] - ordenEstado[b.estado];
            }
            // Dentro del mismo estado, por sorteos sin salir (descendente)
            return b.sorteosSinSalir - a.sorteosSinSalir;
        });
        patronesJack.sort((a, b) => {
            // Primero por estado
            if (ordenEstado[a.estado] !== ordenEstado[b.estado]) {
                return ordenEstado[a.estado] - ordenEstado[b.estado];
            }
            // Dentro del mismo estado, por sorteos sin salir (descendente)
            return b.sorteosSinSalir - a.sorteosSinSalir;
        });
        
        res.json({ 
            patrones,
            patronesJack,
            totalSorteos: sorteos.length
        });
    } catch (error) {
        console.error('Error calculando patrones Loto Plus:', error);
        res.status(500).json({ error: 'Error calculando patrones Loto Plus' });
    }
});

// 7. VER SORTEOS LOTO PLUS
app.get('/sorteos-loto-plus', async (req, res) => {
    try {
        const [sorteos] = await db.execute('SELECT id, fecha, hubo_ganador, cantidad_ganadores FROM loto_plus_sorteos ORDER BY fecha DESC');
        
        // Para cada sorteo, obtener sus números ordenados por tipo con info de ganadores por categoría
        const sorteosConNumeros = await Promise.all(sorteos.map(async (sorteo) => {
            const [numeros] = await db.execute(
                `SELECT numero, tipo, hubo_ganador, cantidad_ganadores FROM loto_plus_numeros 
                 WHERE sorteo_id = ?
                 ORDER BY 
                    CASE tipo
                        WHEN 'tradicional' THEN 1
                        WHEN 'match' THEN 2
                        WHEN 'desquite' THEN 3
                        WHEN 'sale_o_sale' THEN 4
                        WHEN 'jack' THEN 5
                    END,
                    numero`,
                [sorteo.id]
            );
            
            // Agrupar por tipo
            const ganadoresPorTipo = {};
            numeros.forEach(n => {
                if (!ganadoresPorTipo[n.tipo]) {
                    ganadoresPorTipo[n.tipo] = {
                        hubo_ganador: n.hubo_ganador,
                        cantidad_ganadores: n.cantidad_ganadores
                    };
                }
            });
            
            return {
                ...sorteo,
                concurso: sorteo.id,
                numeros: numeros.map(n => n.numero),
                ganadores_por_tipo: ganadoresPorTipo
            };
        }));
        
        res.json(sorteosConNumeros);
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
        
        // Agregar columnas de ganadores si no existen
        try {
            await db.execute(`
                ALTER TABLE quini_sorteos 
                ADD COLUMN IF NOT EXISTS hubo_ganador BOOLEAN DEFAULT NULL,
                ADD COLUMN IF NOT EXISTS cantidad_ganadores INT DEFAULT NULL
            `);
        } catch (error) {
            // Ignorar si las columnas ya existen (MySQL anterior a 8.0.23)
            if (!error.message.includes('Duplicate column')) {
                console.log('⚠️ Nota: Columnas de ganadores podrían ya existir');
            }
        }
        
        await db.execute(`
            CREATE TABLE IF NOT EXISTS quini_numeros (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sorteo_id INT NOT NULL,
                tipo ENUM('primer', 'segunda', 'revancha', 'siempre', 'premio_extra') NOT NULL,
                numero INT NOT NULL,
                FOREIGN KEY (sorteo_id) REFERENCES quini_sorteos(id) ON DELETE CASCADE
            )
        `);
        
        // Agregar columnas de ganadores por tipo a quini_numeros
        try {
            await db.execute(`
                ALTER TABLE quini_numeros 
                ADD COLUMN IF NOT EXISTS hubo_ganador BOOLEAN DEFAULT NULL,
                ADD COLUMN IF NOT EXISTS cantidad_ganadores INT DEFAULT NULL
            `);
        } catch (error) {
            if (!error.message.includes('Duplicate column')) {
                console.log('⚠️ Nota: Columnas de ganadores en quini_numeros podrían ya existir');
            }
        }
        
        console.log('✅ Tablas Quini 6 verificadas');
        
        // Crear tablas de Loto Plus si no existen
        await db.execute(`
            CREATE TABLE IF NOT EXISTS loto_plus_sorteos (
                id INT PRIMARY KEY,
                fecha DATE NOT NULL
            )
        `);
        
        // Agregar columnas de ganadores si no existen
        try {
            await db.execute(`
                ALTER TABLE loto_plus_sorteos 
                ADD COLUMN IF NOT EXISTS hubo_ganador BOOLEAN DEFAULT NULL,
                ADD COLUMN IF NOT EXISTS cantidad_ganadores INT DEFAULT NULL
            `);
        } catch (error) {
            // Ignorar si las columnas ya existen
            if (!error.message.includes('Duplicate column')) {
                console.log('⚠️ Nota: Columnas de ganadores podrían ya existir');
            }
        }
        
        await db.execute(`
            CREATE TABLE IF NOT EXISTS loto_plus_numeros (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sorteo_id INT NOT NULL,
                tipo ENUM('tradicional', 'match', 'desquite', 'sale_o_sale', 'jack') NOT NULL,
                numero INT NOT NULL
            )
        `);
        
        // Agregar columnas de ganadores por tipo a loto_plus_numeros
        try {
            await db.execute(`
                ALTER TABLE loto_plus_numeros 
                ADD COLUMN IF NOT EXISTS hubo_ganador BOOLEAN DEFAULT NULL,
                ADD COLUMN IF NOT EXISTS cantidad_ganadores INT DEFAULT NULL
            `);
        } catch (error) {
            if (!error.message.includes('Duplicate column')) {
                console.log('⚠️ Nota: Columnas de ganadores en loto_plus_numeros podrían ya existir');
            }
        }
        
        console.log('✅ Tablas Loto Plus verificadas');
        
        // 6. ELIMINAR SORTEO QUINI 6
        app.post('/sorteo/eliminar', async (req, res) => {
            try {
                console.log('🗑️ Solicitud de eliminación Quini 6:', req.body);
                
                const { concurso, fecha } = req.body;
                
                if (!fecha) {
                    console.log('❌ Fecha requerida:', { concurso, fecha });
                    return res.status(400).json({ error: 'Fecha es requerida' });
                }
                
                console.log('🔍 Buscando sorteo con:', { concurso, fecha });
                
                // Extraer solo la parte de la fecha (sin hora) para comparación
                const fechaSolo = fecha.split('T')[0]; // "2025-11-06T03:00:00.000Z" -> "2025-11-06"
                console.log('📅 Fecha extraída:', fechaSolo);
                
                let query, params;
                
                // Si el concurso es null, undefined, o 'N/A', buscar solo por fecha
                if (!concurso || concurso === 'N/A' || concurso === null || concurso === 'null') {
                    query = 'SELECT id FROM quini_sorteos WHERE DATE(fecha) = ?';
                    params = [fechaSolo];
                    console.log('🔍 Buscando por fecha únicamente usando DATE()');
                } else {
                    // La tabla usa 'id' como concurso, no hay columna 'concurso'
                    query = 'SELECT id FROM quini_sorteos WHERE id = ? AND DATE(fecha) = ?';
                    params = [concurso, fechaSolo];
                    console.log('🔍 Buscando por id (concurso) y fecha usando DATE()');
                }
                
                // Buscar el sorteo
                const [sorteos] = await db.execute(query, params);
                
                console.log('📋 Resultados de búsqueda:', sorteos);
                
                if (sorteos.length === 0) {
                    console.log('❌ Sorteo no encontrado');
                    return res.status(404).json({ error: 'Sorteo no encontrado' });
                }
                
                const sorteoId = sorteos[0].id;
                console.log('🎯 ID del sorteo a eliminar:', sorteoId);
                
                // Eliminar números asociados
                const resultNumeros = await db.execute('DELETE FROM quini_numeros WHERE sorteo_id = ?', [sorteoId]);
                console.log('🔢 Números eliminados:', resultNumeros[0].affectedRows);
                
                // Eliminar sorteo
                const resultSorteo = await db.execute('DELETE FROM quini_sorteos WHERE id = ?', [sorteoId]);
                console.log('🎲 Sorteo eliminado:', resultSorteo[0].affectedRows);
                
                console.log('✅ Eliminación completada exitosamente');
                res.json({ success: true, message: 'Sorteo eliminado correctamente' });
            } catch (error) {
                console.error('💥 Error eliminando sorteo Quini 6:', error);
                res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
            }
        });
        
        // 7. ELIMINAR SORTEO LOTO PLUS
        app.post('/loto-plus/eliminar', async (req, res) => {
            try {
                console.log('🗑️ Solicitud de eliminación Loto Plus:', req.body);
                
                const { concurso, fecha } = req.body;
                
                if (!fecha) {
                    console.log('❌ Fecha requerida:', { concurso, fecha });
                    return res.status(400).json({ error: 'Fecha es requerida' });
                }
                
                console.log('🔍 Buscando sorteo Loto Plus con:', { concurso, fecha });
                
                // Extraer solo la parte de la fecha (sin hora) para comparación
                const fechaSolo = fecha.split('T')[0]; // "2025-11-06T03:00:00.000Z" -> "2025-11-06"
                console.log('📅 Fecha Loto Plus extraída:', fechaSolo);
                
                // Buscar el sorteo por concurso y fecha (concurso puede ser null en loto plus)
                let query, params;
                if (!concurso || concurso === 'N/A' || concurso === null || concurso === 'null') {
                    query = 'SELECT id FROM loto_plus_sorteos WHERE DATE(fecha) = ?';
                    params = [fechaSolo];
                    console.log('🔍 Buscando Loto Plus por fecha únicamente usando DATE()');
                } else {
                    query = 'SELECT id FROM loto_plus_sorteos WHERE id = ? AND DATE(fecha) = ?';
                    params = [concurso, fechaSolo];
                    console.log('🔍 Buscando Loto Plus por concurso y fecha usando DATE()');
                }
                
                const [sorteos] = await db.execute(query, params);
                
                console.log('📋 Resultados de búsqueda Loto Plus:', sorteos);
                
                if (sorteos.length === 0) {
                    console.log('❌ Sorteo Loto Plus no encontrado');
                    return res.status(404).json({ error: 'Sorteo no encontrado' });
                }
                
                const sorteoId = sorteos[0].id;
                console.log('🎯 ID del sorteo Loto Plus a eliminar:', sorteoId);
                
                // Eliminar números asociados
                const resultNumeros = await db.execute('DELETE FROM loto_plus_numeros WHERE sorteo_id = ?', [sorteoId]);
                console.log('🔢 Números Loto Plus eliminados:', resultNumeros[0].affectedRows);
                
                // Eliminar sorteo
                const resultSorteo = await db.execute('DELETE FROM loto_plus_sorteos WHERE id = ?', [sorteoId]);
                console.log('🎲 Sorteo Loto Plus eliminado:', resultSorteo[0].affectedRows);
                
                console.log('✅ Eliminación Loto Plus completada exitosamente');
                res.json({ success: true, message: 'Sorteo eliminado correctamente' });
            } catch (error) {
                console.error('💥 Error eliminando sorteo Loto Plus:', error);
                res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
            }
        });

        // 8. ACTUALIZAR SORTEO QUINI 6
        app.put('/sorteo/actualizar', async (req, res) => {
            try {
                const { concurso, fecha, primer, segunda, revancha, siempre, concursoOriginal, fechaOriginal } = req.body;
                
                console.log('📝 Actualizando sorteo Quini 6:', {
                    original: { concurso: concursoOriginal, fecha: fechaOriginal },
                    nuevo: { concurso, fecha }
                });
                
                // Validación
                if (!concurso || !fecha || !primer || !segunda || !revancha || !siempre) {
                    return res.status(400).json({ error: 'Datos incompletos' });
                }
                
                if (!concursoOriginal || !fechaOriginal) {
                    return res.status(400).json({ error: 'Datos originales requeridos para actualización' });
                }
                
                // Buscar el sorteo original (usar 'id' en lugar de 'concurso')
                const [sorteoOriginal] = await db.execute(
                    'SELECT id FROM quini_sorteos WHERE id = ? AND DATE(fecha) = ?',
                    [concursoOriginal, fechaOriginal.split('T')[0]]
                );
                
                if (sorteoOriginal.length === 0) {
                    return res.status(404).json({ error: 'Sorteo original no encontrado' });
                }
                
                const sorteoId = sorteoOriginal[0].id;
                
                // Si el concurso cambió, eliminar el sorteo anterior y crear uno nuevo
                if (concurso !== sorteoId) {
                    // Eliminar números antiguos
                    await db.execute('DELETE FROM quini_numeros WHERE sorteo_id = ?', [sorteoId]);
                    // Eliminar sorteo anterior
                    await db.execute('DELETE FROM quini_sorteos WHERE id = ?', [sorteoId]);
                    // Crear nuevo sorteo con el nuevo concurso
                    await db.execute('INSERT INTO quini_sorteos (id, fecha) VALUES (?, ?)', [concurso, fecha]);
                } else {
                    // Solo actualizar fecha si el concurso es el mismo
                    await db.execute('UPDATE quini_sorteos SET fecha = ? WHERE id = ?', [fecha, sorteoId]);
                    // Eliminar números antiguos para actualizarlos
                    await db.execute('DELETE FROM quini_numeros WHERE sorteo_id = ?', [sorteoId]);
                }
                
                // Insertar números nuevos (usar concurso que es el ID final)
                const numeros = [];
                primer.forEach(n => numeros.push([concurso, 'primer', n]));
                segunda.forEach(n => numeros.push([concurso, 'segunda', n]));
                revancha.forEach(n => numeros.push([concurso, 'revancha', n]));
                siempre.forEach(n => numeros.push([concurso, 'siempre', n]));
                
                await db.execute(
                    'INSERT INTO quini_numeros (sorteo_id, tipo, numero) VALUES ' + 
                    numeros.map(() => '(?, ?, ?)').join(', '),
                    numeros.flat()
                );
                
                res.json({ success: true, message: 'Sorteo actualizado correctamente' });
            } catch (error) {
                console.error('Error actualizando sorteo Quini 6:', error);
                res.status(500).json({ error: 'Error actualizando sorteo: ' + error.message });
            }
        });

        // 9. ACTUALIZAR SORTEO LOTO PLUS
        app.put('/loto-plus/actualizar', async (req, res) => {
            try {
                const { concurso, fecha, tradicional, match, desquite, saleOSale, numeroJack, concursoOriginal, fechaOriginal } = req.body;
                
                console.log('📝 Actualizando sorteo Loto Plus:', {
                    original: { concurso: concursoOriginal, fecha: fechaOriginal },
                    nuevo: { concurso, fecha }
                });
                
                // Validación
                if (!concurso || !fecha || !tradicional || !match || !desquite || !saleOSale || numeroJack === undefined) {
                    return res.status(400).json({ error: 'Datos incompletos' });
                }
                
                if (!fechaOriginal) {
                    return res.status(400).json({ error: 'Fecha original requerida para actualización' });
                }
                
                // Buscar el sorteo original
                const [sorteoOriginal] = await db.execute(
                    'SELECT id FROM loto_plus_sorteos WHERE id = ? AND DATE(fecha) = ?',
                    [concursoOriginal || concurso, fechaOriginal.split('T')[0]]
                );
                
                if (sorteoOriginal.length === 0) {
                    return res.status(404).json({ error: 'Sorteo original no encontrado' });
                }
                
                const sorteoId = sorteoOriginal[0].id;
                
                // Si el concurso cambió, eliminar el sorteo anterior y crear uno nuevo
                if (concurso !== sorteoId) {
                    // Eliminar números antiguos
                    await db.execute('DELETE FROM loto_plus_numeros WHERE sorteo_id = ?', [sorteoId]);
                    // Eliminar sorteo anterior
                    await db.execute('DELETE FROM loto_plus_sorteos WHERE id = ?', [sorteoId]);
                    // Crear nuevo sorteo con el nuevo concurso
                    await db.execute('INSERT INTO loto_plus_sorteos (id, fecha) VALUES (?, ?)', [concurso, fecha]);
                } else {
                    // Solo actualizar fecha si el concurso es el mismo
                    await db.execute('UPDATE loto_plus_sorteos SET fecha = ? WHERE id = ?', [fecha, sorteoId]);
                    // Eliminar números antiguos para actualizarlos
                    await db.execute('DELETE FROM loto_plus_numeros WHERE sorteo_id = ?', [sorteoId]);
                }
                
                // Insertar números nuevos
                const numeros = [];
                tradicional.forEach(n => numeros.push([concurso, 'tradicional', n]));
                match.forEach(n => numeros.push([concurso, 'match', n]));
                desquite.forEach(n => numeros.push([concurso, 'desquite', n]));
                saleOSale.forEach(n => numeros.push([concurso, 'sale_o_sale', n]));
                
                // Agregar el número jack
                if (numeroJack !== undefined) {
                    numeros.push([concurso, 'jack', numeroJack]);
                }
                
                await db.execute(
                    'INSERT INTO loto_plus_numeros (sorteo_id, tipo, numero) VALUES ' + 
                    numeros.map(() => '(?, ?, ?)').join(', '),
                    numeros.flat()
                );
                
                res.json({ success: true, message: 'Sorteo Loto Plus actualizado correctamente' });
            } catch (error) {
                console.error('Error actualizando sorteo Loto Plus:', error);
                res.status(500).json({ error: 'Error actualizando sorteo: ' + error.message });
            }
        });

        // 10. ACTUALIZAR GANADOR QUINI 6 POR TIPO
        app.put('/sorteo/actualizar-ganador', async (req, res) => {
            try {
                const { concurso, fecha, tipo, huboGanador, cantidadGanadores } = req.body;
                
                console.log('🏆 Actualizando ganador Quini 6:', { concurso, fecha, tipo, huboGanador, cantidadGanadores });
                
                if (!concurso || !fecha || !tipo) {
                    return res.status(400).json({ error: 'Concurso, fecha y tipo requeridos' });
                }
                
                // Convertir 'si'/'no'/null a boolean/null
                let huboGanadorValue = null;
                if (huboGanador === 'si' || huboGanador === true) {
                    huboGanadorValue = true;
                } else if (huboGanador === 'no' || huboGanador === false) {
                    huboGanadorValue = false;
                }
                
                const cantidadValue = cantidadGanadores !== null && cantidadGanadores !== undefined ? parseInt(cantidadGanadores) : null;
                
                // Actualizar solo los números de ese tipo específico
                await db.execute(
                    'UPDATE quini_numeros SET hubo_ganador = ?, cantidad_ganadores = ? WHERE sorteo_id = ? AND tipo = ?',
                    [huboGanadorValue, cantidadValue, concurso, tipo]
                );
                
                res.json({ success: true, message: 'Información de ganador actualizada' });
            } catch (error) {
                console.error('Error actualizando ganador Quini 6:', error);
                res.status(500).json({ error: 'Error actualizando ganador: ' + error.message });
            }
        });

        // 11. ACTUALIZAR GANADOR LOTO PLUS POR TIPO
        app.put('/loto-plus/actualizar-ganador', async (req, res) => {
            try {
                const { concurso, fecha, tipo, huboGanador, cantidadGanadores } = req.body;
                
                console.log('🏆 Actualizando ganador Loto Plus:', { concurso, fecha, tipo, huboGanador, cantidadGanadores });
                
                if (!concurso || !fecha || !tipo) {
                    return res.status(400).json({ error: 'Concurso, fecha y tipo requeridos' });
                }
                
                // Convertir 'si'/'no'/null a boolean/null
                let huboGanadorValue = null;
                if (huboGanador === 'si' || huboGanador === true) {
                    huboGanadorValue = true;
                } else if (huboGanador === 'no' || huboGanador === false) {
                    huboGanadorValue = false;
                }
                
                const cantidadValue = cantidadGanadores !== null && cantidadGanadores !== undefined ? parseInt(cantidadGanadores) : null;
                
                // Actualizar solo los números de ese tipo específico
                await db.execute(
                    'UPDATE loto_plus_numeros SET hubo_ganador = ?, cantidad_ganadores = ? WHERE sorteo_id = ? AND tipo = ?',
                    [huboGanadorValue, cantidadValue, concurso, tipo]
                );
                
                res.json({ success: true, message: 'Información de ganador actualizada' });
            } catch (error) {
                console.error('Error actualizando ganador Loto Plus:', error);
                res.status(500).json({ error: 'Error actualizando ganador: ' + error.message });
            }
        });

        // 12. ANÁLISIS DE PERIODICIDAD QUINI 6 - Cada cuántos sorteos sale cada número
        app.get('/periodicidad-quini', async (req, res) => {
            try {
                // Obtener todos los sorteos ordenados cronológicamente
                const [sorteos] = await db.execute(`
                    SELECT s.id as concurso, s.fecha 
                    FROM quini_sorteos s 
                    ORDER BY s.fecha ASC
                `);
                
                if (sorteos.length === 0) {
                    return res.json({ periodicidad: [] });
                }
                
                const totalSorteos = sorteos.length;
                const periodicidad = [];
                
                // Analizar cada número
                for (let num = 0; num <= 45; num++) {
                    // Obtener posiciones de sorteo donde apareció (numeradas desde 1)
                    const [apariciones] = await db.execute(`
                        SELECT s.id as concurso, s.fecha,
                               ROW_NUMBER() OVER (ORDER BY s.fecha ASC) as posicion
                        FROM quini_sorteos s
                        INNER JOIN quini_numeros n ON s.id = n.sorteo_id
                        WHERE n.numero = ? AND n.tipo IN ('primer', 'segunda', 'revancha', 'siempre')
                        ORDER BY s.fecha ASC
                    `, [num]);
                    
                    if (apariciones.length === 0) {
                        periodicidad.push({
                            numero: num,
                            vecesAparecio: 0,
                            intervaloPromedio: null,
                            intervaloMinimo: null,
                            intervaloMaximo: null,
                            desviacionEstandar: null,
                            sorteosSinSalir: totalSorteos,
                            probabilidadProximoSorteo: 0,
                            estado: 'nunca-salio'
                        });
                        continue;
                    }
                    
                    // Calcular intervalos entre apariciones consecutivas
                    const intervalos = [];
                    for (let i = 1; i < apariciones.length; i++) {
                        intervalos.push(apariciones[i].posicion - apariciones[i-1].posicion);
                    }
                    
                    // Estadísticas de intervalos
                    let intervaloPromedio = null;
                    let intervaloMin = null;
                    let intervaloMax = null;
                    let desviacion = null;
                    
                    if (intervalos.length > 0) {
                        intervaloPromedio = intervalos.reduce((a, b) => a + b, 0) / intervalos.length;
                        intervaloMin = Math.min(...intervalos);
                        intervaloMax = Math.max(...intervalos);
                        
                        // Desviación estándar
                        const varianza = intervalos.reduce((acc, val) => acc + Math.pow(val - intervaloPromedio, 2), 0) / intervalos.length;
                        desviacion = Math.sqrt(varianza);
                    }
                    
                    // Sorteos desde última aparición
                    const ultimaPosicion = apariciones[apariciones.length - 1].posicion;
                    const sorteosSinSalir = totalSorteos - ultimaPosicion;
                    
                    // PREDICCIÓN: Calcular probabilidad basada en el retraso actual vs el patrón histórico
                    let probabilidad = 0;
                    let estado = 'normal';
                    
                    if (intervaloPromedio && intervaloPromedio > 0) {
                        // Probabilidad aumenta cuanto más sorteos sin salir vs el promedio
                        const ratioRetraso = sorteosSinSalir / intervaloPromedio;
                        
                        // Fórmula de probabilidad: aumenta exponencialmente con el retraso
                        // Si sorteosSinSalir = intervaloPromedio, probabilidad ~50%
                        // Si sorteosSinSalir = 2*intervaloPromedio, probabilidad ~75%
                        probabilidad = Math.min(95, (1 - Math.exp(-ratioRetraso * 0.8)) * 100);
                        
                        // Clasificar estado
                        if (ratioRetraso >= 2.5) {
                            estado = 'muy-retrasado';
                        } else if (ratioRetraso >= 1.5) {
                            estado = 'retrasado';
                        } else if (ratioRetraso >= 0.8) {
                            estado = 'normal';
                        } else if (ratioRetraso >= 0.3) {
                            estado = 'reciente';
                        } else {
                            estado = 'muy-reciente';
                        }
                    } else if (apariciones.length === 1) {
                        // Solo salió una vez, usar heurística simple
                        probabilidad = Math.min(90, sorteosSinSalir * 2);
                        estado = sorteosSinSalir > 20 ? 'muy-retrasado' : sorteosSinSalir > 10 ? 'retrasado' : 'reciente';
                    }
                    
                    periodicidad.push({
                        numero: num,
                        vecesAparecio: apariciones.length,
                        intervaloPromedio: intervaloPromedio ? Math.round(intervaloPromedio * 100) / 100 : null,
                        intervaloMinimo: intervaloMin,
                        intervaloMaximo: intervaloMax,
                        desviacionEstandar: desviacion ? Math.round(desviacion * 100) / 100 : null,
                        sorteosSinSalir: sorteosSinSalir,
                        probabilidadProximoSorteo: Math.round(probabilidad * 100) / 100,
                        estado: estado,
                        ultimaAparicion: apariciones[apariciones.length - 1].fecha
                    });
                }
                
                // Ordenar por probabilidad descendente
                periodicidad.sort((a, b) => b.probabilidadProximoSorteo - a.probabilidadProximoSorteo);
                
                res.json({
                    periodicidad,
                    totalSorteos,
                    analisisGenerado: new Date().toISOString()
                });
                
            } catch (error) {
                console.error('Error calculando periodicidad Quini:', error);
                res.status(500).json({ error: 'Error en análisis de periodicidad' });
            }
        });

        // 13. ANÁLISIS DE PERIODICIDAD LOTO PLUS
        app.get('/periodicidad-loto-plus', async (req, res) => {
            try {
                const [sorteos] = await db.execute(`
                    SELECT s.id as concurso, s.fecha 
                    FROM loto_plus_sorteos s 
                    ORDER BY s.fecha ASC
                `);
                
                if (sorteos.length === 0) {
                    return res.json({ periodicidad: [], periodicidadJack: [] });
                }
                
                const totalSorteos = sorteos.length;
                const periodicidad = [];
                const periodicidadJack = [];
                
                // Analizar números tradicionales (1-42)
                for (let num = 1; num <= 42; num++) {
                    const [apariciones] = await db.execute(`
                        SELECT s.id as concurso, s.fecha,
                               ROW_NUMBER() OVER (ORDER BY s.fecha ASC) as posicion
                        FROM loto_plus_sorteos s
                        INNER JOIN loto_plus_numeros n ON s.id = n.sorteo_id
                        WHERE n.numero = ? AND n.tipo IN ('tradicional', 'match', 'desquite', 'sale_o_sale')
                        ORDER BY s.fecha ASC
                    `, [num]);
                    
                    if (apariciones.length === 0) {
                        periodicidad.push({
                            numero: num,
                            vecesAparecio: 0,
                            intervaloPromedio: null,
                            sorteosSinSalir: totalSorteos,
                            probabilidadProximoSorteo: 0,
                            estado: 'nunca-salio'
                        });
                        continue;
                    }
                    
                    const intervalos = [];
                    for (let i = 1; i < apariciones.length; i++) {
                        intervalos.push(apariciones[i].posicion - apariciones[i-1].posicion);
                    }
                    
                    const intervaloPromedio = intervalos.length > 0 
                        ? intervalos.reduce((a, b) => a + b, 0) / intervalos.length 
                        : null;
                    
                    const ultimaPosicion = apariciones[apariciones.length - 1].posicion;
                    const sorteosSinSalir = totalSorteos - ultimaPosicion;
                    
                    let probabilidad = 0;
                    let estado = 'normal';
                    
                    if (intervaloPromedio && intervaloPromedio > 0) {
                        const ratioRetraso = sorteosSinSalir / intervaloPromedio;
                        probabilidad = Math.min(95, (1 - Math.exp(-ratioRetraso * 0.8)) * 100);
                        
                        if (ratioRetraso >= 2.5) estado = 'muy-retrasado';
                        else if (ratioRetraso >= 1.5) estado = 'retrasado';
                        else if (ratioRetraso >= 0.8) estado = 'normal';
                        else if (ratioRetraso >= 0.3) estado = 'reciente';
                        else estado = 'muy-reciente';
                    }
                    
                    periodicidad.push({
                        numero: num,
                        vecesAparecio: apariciones.length,
                        intervaloPromedio: intervaloPromedio ? Math.round(intervaloPromedio * 100) / 100 : null,
                        sorteosSinSalir: sorteosSinSalir,
                        probabilidadProximoSorteo: Math.round(probabilidad * 100) / 100,
                        estado: estado,
                        ultimaAparicion: apariciones[apariciones.length - 1].fecha
                    });
                }
                
                // Analizar JACK (0-9)
                for (let num = 0; num <= 9; num++) {
                    const [apariciones] = await db.execute(`
                        SELECT s.id as concurso, s.fecha,
                               ROW_NUMBER() OVER (ORDER BY s.fecha ASC) as posicion
                        FROM loto_plus_sorteos s
                        INNER JOIN loto_plus_numeros n ON s.id = n.sorteo_id
                        WHERE n.numero = ? AND n.tipo = 'jack'
                        ORDER BY s.fecha ASC
                    `, [num]);
                    
                    if (apariciones.length === 0) {
                        periodicidadJack.push({
                            numero: num,
                            vecesAparecio: 0,
                            intervaloPromedio: null,
                            sorteosSinSalir: totalSorteos,
                            probabilidadProximoSorteo: 0,
                            estado: 'nunca-salio'
                        });
                        continue;
                    }
                    
                    const intervalos = [];
                    for (let i = 1; i < apariciones.length; i++) {
                        intervalos.push(apariciones[i].posicion - apariciones[i-1].posicion);
                    }
                    
                    const intervaloPromedio = intervalos.length > 0 
                        ? intervalos.reduce((a, b) => a + b, 0) / intervalos.length 
                        : null;
                    
                    const ultimaPosicion = apariciones[apariciones.length - 1].posicion;
                    const sorteosSinSalir = totalSorteos - ultimaPosicion;
                    
                    let probabilidad = 0;
                    let estado = 'normal';
                    
                    if (intervaloPromedio && intervaloPromedio > 0) {
                        const ratioRetraso = sorteosSinSalir / intervaloPromedio;
                        probabilidad = Math.min(95, (1 - Math.exp(-ratioRetraso * 0.8)) * 100);
                        
                        if (ratioRetraso >= 2.5) estado = 'muy-retrasado';
                        else if (ratioRetraso >= 1.5) estado = 'retrasado';
                        else if (ratioRetraso >= 0.8) estado = 'normal';
                        else if (ratioRetraso >= 0.3) estado = 'reciente';
                        else estado = 'muy-reciente';
                    }
                    
                    periodicidadJack.push({
                        numero: num,
                        vecesAparecio: apariciones.length,
                        intervaloPromedio: intervaloPromedio ? Math.round(intervaloPromedio * 100) / 100 : null,
                        sorteosSinSalir: sorteosSinSalir,
                        probabilidadProximoSorteo: Math.round(probabilidad * 100) / 100,
                        estado: estado,
                        ultimaAparicion: apariciones[apariciones.length - 1].fecha
                    });
                }
                
                periodicidad.sort((a, b) => b.probabilidadProximoSorteo - a.probabilidadProximoSorteo);
                periodicidadJack.sort((a, b) => b.probabilidadProximoSorteo - a.probabilidadProximoSorteo);
                
                res.json({
                    periodicidad,
                    periodicidadJack,
                    totalSorteos,
                    analisisGenerado: new Date().toISOString()
                });
                
            } catch (error) {
                console.error('Error calculando periodicidad Loto Plus:', error);
                res.status(500).json({ error: 'Error en análisis de periodicidad' });
            }
        });

        // 14. PREDICCIÓN INTELIGENTE QUINI 6 - Top números candidatos
        app.get('/prediccion-quini', async (req, res) => {
            try {
                const [sorteos] = await db.execute(`
                    SELECT s.id, s.fecha FROM quini_sorteos s ORDER BY s.fecha ASC
                `);
                
                if (sorteos.length < 10) {
                    return res.json({ 
                        error: 'Se necesitan al menos 10 sorteos para predicción',
                        candidatos: []
                    });
                }
                
                const totalSorteos = sorteos.length;
                const candidatos = [];
                
                for (let num = 0; num <= 45; num++) {
                    const [apariciones] = await db.execute(`
                        SELECT ROW_NUMBER() OVER (ORDER BY s.fecha ASC) as posicion
                        FROM quini_sorteos s
                        INNER JOIN quini_numeros n ON s.id = n.sorteo_id
                        WHERE n.numero = ? AND n.tipo IN ('primer', 'segunda', 'revancha', 'siempre')
                        ORDER BY s.fecha ASC
                    `, [num]);
                    
                    if (apariciones.length === 0) continue;
                    
                    const intervalos = [];
                    for (let i = 1; i < apariciones.length; i++) {
                        intervalos.push(apariciones[i].posicion - apariciones[i-1].posicion);
                    }
                    
                    if (intervalos.length === 0) continue;
                    
                    const intervaloPromedio = intervalos.reduce((a, b) => a + b, 0) / intervalos.length;
                    const ultimaPosicion = apariciones[apariciones.length - 1].posicion;
                    const sorteosSinSalir = totalSorteos - ultimaPosicion;
                    const ratioRetraso = sorteosSinSalir / intervaloPromedio;
                    
                    // Calcular score predictivo (0-100)
                    let score = 0;
                    
                    // Factor 1: Retraso (40 puntos máx) - Más retraso = más score
                    score += Math.min(40, ratioRetraso * 20);
                    
                    // Factor 2: Frecuencia histórica (30 puntos máx) - Más apariciones = más score
                    const frecuenciaRelativa = apariciones.length / totalSorteos;
                    score += frecuenciaRelativa * 30;
                    
                    // Factor 3: Regularidad (30 puntos máx) - Menos variación = más score
                    const varianza = intervalos.reduce((acc, val) => 
                        acc + Math.pow(val - intervaloPromedio, 2), 0) / intervalos.length;
                    const coeficienteVariacion = Math.sqrt(varianza) / intervaloPromedio;
                    score += Math.max(0, 30 - (coeficienteVariacion * 15));
                    
                    candidatos.push({
                        numero: num,
                        scorePredictivo: Math.round(score * 100) / 100,
                        sorteosSinSalir,
                        intervaloPromedio: Math.round(intervaloPromedio * 100) / 100,
                        vecesAparecio: apariciones.length,
                        ratioRetraso: Math.round(ratioRetraso * 100) / 100
                    });
                }
                
                // Ordenar por score predictivo
                candidatos.sort((a, b) => b.scorePredictivo - a.scorePredictivo);
                
                // Top 15 candidatos
                const topCandidatos = candidatos.slice(0, 15);
                
                res.json({
                    candidatos: topCandidatos,
                    totalSorteos,
                    fechaPrediccion: new Date().toISOString(),
                    nota: 'Score predictivo combina retraso, frecuencia histórica y regularidad'
                });
                
            } catch (error) {
                console.error('Error en predicción Quini:', error);
                res.status(500).json({ error: 'Error generando predicción' });
            }
        });

        // 15. PREDICCIÓN INTELIGENTE LOTO PLUS
        app.get('/prediccion-loto-plus', async (req, res) => {
            try {
                const [sorteos] = await db.execute(`
                    SELECT s.id, s.fecha FROM loto_plus_sorteos s ORDER BY s.fecha ASC
                `);
                
                if (sorteos.length < 10) {
                    return res.json({ 
                        error: 'Se necesitan al menos 10 sorteos para predicción',
                        candidatos: [],
                        candidatosJack: []
                    });
                }
                
                const totalSorteos = sorteos.length;
                const candidatos = [];
                const candidatosJack = [];
                
                // Analizar números tradicionales
                for (let num = 1; num <= 42; num++) {
                    const [apariciones] = await db.execute(`
                        SELECT ROW_NUMBER() OVER (ORDER BY s.fecha ASC) as posicion
                        FROM loto_plus_sorteos s
                        INNER JOIN loto_plus_numeros n ON s.id = n.sorteo_id
                        WHERE n.numero = ? AND n.tipo IN ('tradicional', 'match', 'desquite', 'sale_o_sale')
                        ORDER BY s.fecha ASC
                    `, [num]);
                    
                    if (apariciones.length === 0) continue;
                    
                    const intervalos = [];
                    for (let i = 1; i < apariciones.length; i++) {
                        intervalos.push(apariciones[i].posicion - apariciones[i-1].posicion);
                    }
                    
                    if (intervalos.length === 0) continue;
                    
                    const intervaloPromedio = intervalos.reduce((a, b) => a + b, 0) / intervalos.length;
                    const ultimaPosicion = apariciones[apariciones.length - 1].posicion;
                    const sorteosSinSalir = totalSorteos - ultimaPosicion;
                    const ratioRetraso = sorteosSinSalir / intervaloPromedio;
                    
                    let score = 0;
                    score += Math.min(40, ratioRetraso * 20);
                    const frecuenciaRelativa = apariciones.length / totalSorteos;
                    score += frecuenciaRelativa * 30;
                    const varianza = intervalos.reduce((acc, val) => 
                        acc + Math.pow(val - intervaloPromedio, 2), 0) / intervalos.length;
                    const coeficienteVariacion = Math.sqrt(varianza) / intervaloPromedio;
                    score += Math.max(0, 30 - (coeficienteVariacion * 15));
                    
                    candidatos.push({
                        numero: num,
                        scorePredictivo: Math.round(score * 100) / 100,
                        sorteosSinSalir,
                        intervaloPromedio: Math.round(intervaloPromedio * 100) / 100,
                        vecesAparecio: apariciones.length,
                        ratioRetraso: Math.round(ratioRetraso * 100) / 100
                    });
                }
                
                // Analizar JACK
                for (let num = 0; num <= 9; num++) {
                    const [apariciones] = await db.execute(`
                        SELECT ROW_NUMBER() OVER (ORDER BY s.fecha ASC) as posicion
                        FROM loto_plus_sorteos s
                        INNER JOIN loto_plus_numeros n ON s.id = n.sorteo_id
                        WHERE n.numero = ? AND n.tipo = 'jack'
                        ORDER BY s.fecha ASC
                    `, [num]);
                    
                    if (apariciones.length === 0) continue;
                    
                    const intervalos = [];
                    for (let i = 1; i < apariciones.length; i++) {
                        intervalos.push(apariciones[i].posicion - apariciones[i-1].posicion);
                    }
                    
                    if (intervalos.length === 0) continue;
                    
                    const intervaloPromedio = intervalos.reduce((a, b) => a + b, 0) / intervalos.length;
                    const ultimaPosicion = apariciones[apariciones.length - 1].posicion;
                    const sorteosSinSalir = totalSorteos - ultimaPosicion;
                    const ratioRetraso = sorteosSinSalir / intervaloPromedio;
                    
                    let score = 0;
                    score += Math.min(40, ratioRetraso * 20);
                    score += (apariciones.length / totalSorteos) * 30;
                    
                    candidatosJack.push({
                        numero: num,
                        scorePredictivo: Math.round(score * 100) / 100,
                        sorteosSinSalir,
                        intervaloPromedio: Math.round(intervaloPromedio * 100) / 100,
                        vecesAparecio: apariciones.length,
                        ratioRetraso: Math.round(ratioRetraso * 100) / 100
                    });
                }
                
                candidatos.sort((a, b) => b.scorePredictivo - a.scorePredictivo);
                candidatosJack.sort((a, b) => b.scorePredictivo - a.scorePredictivo);
                
                res.json({
                    candidatos: candidatos.slice(0, 15),
                    candidatosJack: candidatosJack.slice(0, 5),
                    totalSorteos,
                    fechaPrediccion: new Date().toISOString(),
                    nota: 'Score predictivo combina retraso, frecuencia histórica y regularidad'
                });
                
            } catch (error) {
                console.error('Error en predicción Loto Plus:', error);
                res.status(500).json({ error: 'Error generando predicción' });
            }
        });

        // Iniciar servidor
        app.listen(PORT, () => {
            console.log(`🚀 Servidor simple en http://localhost:${PORT}`);
            console.log('📊 Quini 6: /sorteo (POST), /sorteos (GET), /frecuencias (GET), /patrones-quini (GET), /sorteo/eliminar (POST), /sorteo/actualizar (PUT), /sorteo/actualizar-ganador (PUT)');
            console.log('📊 Loto Plus: /loto-plus (POST), /sorteos-loto-plus (GET), /frecuencias-loto-plus (GET), /patrones-loto-plus (GET), /loto-plus/eliminar (POST), /loto-plus/actualizar (PUT), /loto-plus/actualizar-ganador (PUT)');
            console.log('🔮 Análisis Predictivo: /periodicidad-quini, /periodicidad-loto-plus, /prediccion-quini, /prediccion-loto-plus');
        });
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

start();