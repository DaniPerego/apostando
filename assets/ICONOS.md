# Información sobre iconos creados

## ✅ Iconos Disponibles:

- **icon.ico** (Windows) - Icono básico 16x16 con fondo verde y letra 'A'
- **icon.png** (Linux) - Copia del icono ICO para compatibilidad
- **icon.svg** - Icono vectorial base con diseño completo
- **icon-generator.html** - Generador web para crear PNG de alta calidad

## 🎨 Diseño del Icono:

- **Color principal**: Verde (#2E7D32) - representa suerte y dinero
- **Elementos**: Bolas de lotería con números (6, 15, 23, 31) y letra 'A' dorada
- **Texto**: "APOSTANDO" y "Análisis de Sorteos"
- **Estilo**: Circular, profesional, fácil de identificar

## 📱 Cómo mejorar los iconos:

1. **Para mejor calidad PNG**: 
   - Abrir `assets/icon-generator.html` en navegador
   - Hacer clic en "Descargar PNG" 
   - Guardar como `assets/icon.png`

2. **Para macOS (ICNS)**:
   - Usar herramientas online como https://convertio.co/png-icns/
   - O instalar imagemagick: `convert icon.png icon.icns`

3. **Para iconos de múltiples tamaños**:
   - Crear versiones 16x16, 32x32, 48x48, 128x128, 256x256
   - Usar herramientas como GIMP o Photoshop

## 🔧 Configuración actual:

```json
"win": {
  "icon": "assets/icon.ico"
},
"mac": {
  "icon": "assets/icon.png"
},
"linux": {
  "icon": "assets/icon.png"
}
```