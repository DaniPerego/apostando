# Iconos de la Aplicación

Para la aplicación de escritorio necesitamos crear iconos en diferentes formatos:

## Iconos requeridos:

1. **icon.ico (Windows)** - 256x256 pixels
2. **icon.png (Linux)** - 512x512 pixels  
3. **icon.icns (macOS)** - 512x512 pixels

## Diseño sugerido:

- Tema: Números de lotería con fondo colorido
- Colores: Azul (#007ACC), Blanco (#FFFFFF), Dorado (#FFD700)
- Elementos: Números "6", "21", "+" en tipografía bold
- Estilo: Moderno, profesional

## Temporal:

Por ahora usaremos un icono genérico hasta crear uno personalizado.

## Software recomendado para crear iconos:

- GIMP (gratuito)
- Photoshop 
- Canva
- Online icon generators

## Comandos para generar iconos:

```bash
# Convertir PNG a ICO (Windows)
convert icon.png -resize 256x256 icon.ico

# Convertir PNG a ICNS (macOS)
png2icns icon.icns icon.png
```