const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

// Variable para mantener referencia del servidor
let server = null;
let mainWindow = null;

// Función para iniciar el servidor backend
async function startServer() {
  console.log('🚀 Iniciando servidor backend...');
  
  try {
    // Importar y ejecutar el servidor directamente
    const { startServer: serverStart } = require('./server.js');
    await serverStart();
    console.log('✅ Servidor backend iniciado directamente');
  } catch (error) {
    console.error('❌ Error iniciando servidor:', error);
    throw error;
  }
}

// Función para crear la ventana principal
function createWindow() {
  // Crear la ventana del navegador
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    icon: path.join(__dirname, 'assets', 'icon.png'), // Agregaremos el icono después
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true
    },
    titleBarStyle: 'default',
    show: false // No mostrar hasta que esté listo
  });

  // Crear menú personalizado
  const template = [
    {
      label: 'Aplicación',
      submenu: [
        {
          label: 'Acerca de Apostando',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Acerca de Apostando',
              message: 'Sistema de Análisis de Sorteos',
              detail: 'Análisis estadístico de Quini 6, Brinco y Loto Plus\nVersión 1.0.0\n\nDesarrollado con Node.js + Electron'
            });
          }
        },
        { type: 'separator' },
        {
          label: 'Salir',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload', label: 'Recargar' },
        { role: 'forceReload', label: 'Forzar Recarga' },
        { role: 'toggleDevTools', label: 'Herramientas de Desarrollador' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom Normal' },
        { role: 'zoomIn', label: 'Acercar' },
        { role: 'zoomOut', label: 'Alejar' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla Completa' }
      ]
    },
    {
      label: 'Ventana',
      submenu: [
        { role: 'minimize', label: 'Minimizar' },
        { role: 'close', label: 'Cerrar' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // Cargar la aplicación
  mainWindow.loadURL('http://localhost:3000');

  // Mostrar ventana cuando esté lista
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('✅ Ventana principal mostrada');
  });

  // Manejar cierre de ventana
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Manejar links externos
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
}

// Este método se ejecuta cuando Electron ha terminado de inicializarse
app.whenReady().then(async () => {
  try {
    console.log('🚀 Iniciando aplicación Apostando...');
    
    // Iniciar servidor backend
    await startServer();
    
    // Pequeña pausa para asegurar que el servidor esté listo
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Crear ventana principal
    createWindow();
    
    console.log('✅ Aplicación lista!');
    
  } catch (error) {
    console.error('❌ Error iniciando aplicación:', error);
    
    const { dialog } = require('electron');
    dialog.showErrorBox('Error de Inicio', 
      'No se pudo iniciar el servidor backend.\n\n' +
      'Asegúrate de que MySQL/MariaDB esté ejecutándose.\n\n' +
      'Error: ' + error.message
    );
    
    app.quit();
  }
});

// Salir cuando todas las ventanas estén cerradas
app.on('window-all-closed', () => {
  // En macOS es común que las aplicaciones permanezcan activas
  // hasta que el usuario las cierre explícitamente con Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // En macOS es común recrear una ventana cuando el icono del dock es clickeado
  // y no hay otras ventanas abiertas
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Limpiar al cerrar la aplicación
app.on('before-quit', () => {
  console.log('🛑 Cerrando aplicación...');
  // El servidor se cerrará automáticamente cuando termine el proceso de Electron
});

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
  console.error('Error no capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promesa rechazada sin manejar:', reason);
});