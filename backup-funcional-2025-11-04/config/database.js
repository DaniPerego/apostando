const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuración de la base de datos
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'apostando_db',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
};

// Crear pool de conexiones
const pool = mysql.createPool(dbConfig);

// Función para verificar conexión
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Conexión a MySQL exitosa');
        console.log(`📊 Base de datos: ${dbConfig.database}`);
        console.log(`🏠 Host: ${dbConfig.host}:${dbConfig.port}`);
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Error de conexión a MySQL:', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.error('💡 Sugerencia: Verifica que MySQL esté ejecutándose en el puerto', dbConfig.port);
        } else if (error.code === 'ER_BAD_DB_ERROR') {
            console.error('💡 Sugerencia: La base de datos no existe. Ejecuta el script de inicialización.');
        } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('💡 Sugerencia: Verifica usuario y contraseña en el archivo .env');
        }
        
        return false;
    }
}

// Función para inicializar las tablas
async function initializeTables() {
    try {
        const connection = await pool.getConnection();
        
        // Crear tablas Quini 6
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS quini_sorteos (
                id INT PRIMARY KEY,
                fecha DATE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await connection.execute(`
            CREATE TABLE IF NOT EXISTS quini_numeros (
                sorteo_id INT NOT NULL,
                tipo ENUM('primer','segunda','revancha','siempre','premio_extra') NOT NULL,
                numero TINYINT NOT NULL,
                PRIMARY KEY (sorteo_id, tipo, numero),
                FOREIGN KEY (sorteo_id) REFERENCES quini_sorteos(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        connection.release();
        console.log('✅ Tablas inicializadas correctamente');
        return true;
    } catch (error) {
        console.error('❌ Error inicializando tablas:', error.message);
        return false;
    }
}

// Función helper para ejecutar queries
async function query(sql, params = []) {
    try {
        const [rows] = await pool.execute(sql, params);
        return rows;
    } catch (error) {
        console.error('Error en query:', error.message);
        throw error;
    }
}

// Función para cerrar el pool (útil para testing)
async function closePool() {
    try {
        await pool.end();
        console.log('📚 Pool de conexiones cerrado');
    } catch (error) {
        console.error('Error cerrando pool:', error.message);
    }
}

module.exports = {
    pool,
    query,
    testConnection,
    initializeTables,
    closePool
};