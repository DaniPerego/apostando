const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

let mainWindow = null;

// Función para iniciar el servidor backend
async function startServer() {
  console.log('🚀 Iniciando servidor backend...');
  
  try {
    // Importar y ejecutar el servidor simple directamente
    require('./server.js');
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
          label: 'Acerca de Apostando Desktop',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Acerca de Apostando Desktop',
              message: 'Sistema de Análisis de Sorteos - Desktop',
              detail: 'Análisis estadístico de Quini 6 y Loto Plus\nVersión Desktop 1.0.0\n\nDesarrollado con Node.js + Electron'
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
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // Cargar la aplicación
  mainWindow.loadURL('http://localhost:3001');

  // Mostrar ventana cuando esté lista
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('✅ Ventana principal mostrada');
  });

  // Manejar cierre de ventana
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Este método se ejecuta cuando Electron ha terminado de inicializarse
app.whenReady().then(async () => {
  try {
    console.log('🚀 Iniciando Apostando Desktop...');
    
    // Iniciar servidor backend
    await startServer();
    
    // Pequeña pausa para asegurar que el servidor esté listo
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Crear ventana principal
    createWindow();
    
    console.log('✅ Aplicación Desktop lista!');
    
  } catch (error) {
    console.error('❌ Error iniciando aplicación:', error);
    app.quit();
  }
});

// Salir cuando todas las ventanas estén cerradas
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
