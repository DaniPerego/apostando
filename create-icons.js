// Script para crear iconos básicos para la aplicación
const fs = require('fs');
const path = require('path');

// Crear carpeta assets si no existe
const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir);
}

// Crear un icono SVG básico
const iconSVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <!-- Fondo circular -->
  <circle cx="128" cy="128" r="120" fill="#2E7D32" stroke="#1B5E20" stroke-width="4"/>
  
  <!-- Números de lotería -->
  <circle cx="80" cy="80" r="15" fill="#FFF" stroke="#333" stroke-width="2"/>
  <text x="80" y="85" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#333">6</text>
  
  <circle cx="176" cy="80" r="15" fill="#FFF" stroke="#333" stroke-width="2"/>
  <text x="176" y="85" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#333">15</text>
  
  <circle cx="80" cy="176" r="15" fill="#FFF" stroke="#333" stroke-width="2"/>
  <text x="80" y="181" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#333">23</text>
  
  <circle cx="176" cy="176" r="15" fill="#FFF" stroke="#333" stroke-width="2"/>
  <text x="176" y="181" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#333">31</text>
  
  <circle cx="128" cy="128" r="15" fill="#FFD700" stroke="#333" stroke-width="2"/>
  <text x="128" y="133" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#333">A</text>
  
  <!-- Texto -->
  <text x="128" y="210" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#FFF">APOSTANDO</text>
  <text x="128" y="230" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#FFF">Análisis de Sorteos</text>
</svg>`;

// Guardar el SVG
fs.writeFileSync(path.join(assetsDir, 'icon.svg'), iconSVG);

console.log('✅ Icono SVG creado en assets/icon.svg');
console.log('📝 Para generar iconos .ico, .png, .icns necesitas convertir el SVG usando herramientas online o instalar imagemagick');
console.log('🌐 Recomendado: https://convertio.co/svg-ico/ para convertir SVG a ICO');
console.log('🌐 También: https://cloudconvert.com/svg-to-png para PNG');