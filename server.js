const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { testConnection, initializeTables } = require('./config/database');
const quiniRoutes = require('./routes/quini');
const brincoRoutes = require('./routes/brinco');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos (HTML, CSS, JS del frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Rutas de la API
app.use('/api/quini', quiniRoutes);
app.use('/api/brinco', brincoRoutes);

// Ruta principal - servir el index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Manejo de errores
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({ 
        error: 'Error interno del servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Ha ocurrido un error' 
    });
});

// Ruta 404
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

// Función para inicializar servidor
async function startServer() {
    try {
        console.log('🔄 Verificando conexión a MySQL...');
        const connectionOk = await testConnection();
        
        if (!connectionOk) {
            console.error('\n❌ Error: No se pudo conectar a MySQL');
            console.log('💡 Ejecuta: node init.js para configurar la base de datos');
            
            // Si se ejecuta desde Electron, lanzar error en lugar de salir
            const isElectron = process.env.ELECTRON || process.versions.electron;
            if (isElectron) {
                throw new Error('No se pudo conectar a MySQL');
            } else {
                process.exit(1);
            }
        }
        
        console.log('🔄 Inicializando tablas...');
        await initializeTables();
        
        // Iniciar servidor
        app.listen(PORT, () => {
            console.log(`\n🚀 Servidor iniciado exitosamente!`);
            console.log(`📊 Panel web: http://localhost:${PORT}`);
            console.log(`🔗 API REST: http://localhost:${PORT}/api`);
            console.log(`📂 Archivos: ${path.join(__dirname, 'public')}`);
            
            if (process.env.NODE_ENV === 'development') {
                console.log('📝 Modo desarrollo activado');
            }
            
            // Detectar si está corriendo en Electron
            const isElectron = process.env.ELECTRON || process.versions.electron;
            if (isElectron) {
                console.log('\n🖥️ ¡Aplicación de escritorio iniciada correctamente!\n');
            } else {
                console.log('\n✨ ¡Listo para usar! Abre tu navegador y comienza a cargar sorteos.\n');
            }
        });
        
    } catch (error) {
        console.error('❌ Error iniciando el servidor:', error.message);
        
        // Si se ejecuta desde Electron, relanzar error
        const isElectron = process.env.ELECTRON || process.versions.electron;
        if (isElectron) {
            throw error;
        } else {
            process.exit(1);
        }
    }
}

// Solo iniciar servidor si no se está ejecutando desde Electron (importado desde main.js)
const isElectron = process.env.ELECTRON || process.versions.electron;
if (!isElectron || require.main === module) {
    startServer();
}

module.exports = { app, startServer };