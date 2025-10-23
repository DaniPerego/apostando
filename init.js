#!/usr/bin/env node

const { testConnection, initializeTables } = require('./config/database');

async function initializeApp() {
    console.log('🚀 Iniciando configuración del sistema Apostando...\n');
    
    console.log('1️⃣ Verificando conexión a MySQL...');
    const connectionOk = await testConnection();
    
    if (!connectionOk) {
        console.error('\n❌ No se pudo conectar a MySQL.');
        console.log('\n📝 Para solucionar este problema:');
        console.log('1. Asegúrate de que MySQL esté ejecutándose');
        console.log('2. Verifica las credenciales en el archivo .env');
        console.log('3. Crea la base de datos si no existe:');
        console.log('   mysql -u root -p');
        console.log('   CREATE DATABASE apostando_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
        process.exit(1);
    }
    
    console.log('2️⃣ Inicializando tablas...');
    const tablesOk = await initializeTables();
    
    if (!tablesOk) {
        console.error('\n❌ Error inicializando las tablas.');
        process.exit(1);
    }
    
    console.log('\n✅ ¡Configuración completada exitosamente!');
    console.log('\n🎯 Próximos pasos:');
    console.log('1. Ejecuta: npm start');
    console.log('2. Abre tu navegador en: http://localhost:3000');
    console.log('3. ¡Comienza a cargar sorteos!');
    
    process.exit(0);
}

// Ejecutar solo si se llama directamente
if (require.main === module) {
    initializeApp().catch(error => {
        console.error('❌ Error durante la inicialización:', error.message);
        process.exit(1);
    });
}

module.exports = { initializeApp };