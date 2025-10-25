const fs = require('fs');
const path = require('path');

// Crear un archivo ICO básico (formato hexadecimal)
// Este es un icono muy simple de 16x16 píxeles
const icoData = Buffer.from([
    // ICO Header
    0x00, 0x00, // Reserved (must be 0)
    0x01, 0x00, // Type (1 = ICO)
    0x01, 0x00, // Image count (1)
    
    // Image Directory Entry
    0x00,       // Width (0 = 256)
    0x00,       // Height (0 = 256)
    0x00,       // Color count (0 = >256 colors)
    0x00,       // Reserved
    0x01, 0x00, // Color planes (1)
    0x20, 0x00, // Bits per pixel (32)
    0x00, 0x00, 0x01, 0x00, // Size of image data (65536 bytes)
    0x16, 0x00, 0x00, 0x00, // Offset to image data (22 bytes)
    
    // Bitmap Info Header
    0x28, 0x00, 0x00, 0x00, // Header size (40)
    0x00, 0x01, 0x00, 0x00, // Width (256)
    0x00, 0x02, 0x00, 0x00, // Height (512 = 256*2 for AND mask)
    0x01, 0x00,             // Planes (1)
    0x20, 0x00,             // Bits per pixel (32)
    0x00, 0x00, 0x00, 0x00, // Compression (0 = none)
    0x00, 0x00, 0x00, 0x00, // Image size (0 = calculated)
    0x00, 0x00, 0x00, 0x00, // X pixels per meter
    0x00, 0x00, 0x00, 0x00, // Y pixels per meter
    0x00, 0x00, 0x00, 0x00, // Colors used
    0x00, 0x00, 0x00, 0x00  // Important colors
]);

// Crear icono 256x256 píxeles
const size = 256;
const pixelData = Buffer.alloc(size * size * 4); // 256x256x4 bytes BGRA

// Llenar con color verde básico (formato BGRA)
for (let i = 0; i < pixelData.length; i += 4) {
    pixelData[i] = 0x32;     // B
    pixelData[i + 1] = 0x7D; // G
    pixelData[i + 2] = 0x2E; // R
    pixelData[i + 3] = 0xFF; // A
}

// Crear un círculo y letra más grande
const centerX = size / 2;
const centerY = size / 2;
const radius = size / 2 - 10;

// Crear círculo más definido
for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const offset = (y * size + x) * 4;
        
        if (distance > radius) {
            // Fuera del círculo - transparente
            pixelData[offset + 3] = 0x00; // Alpha = 0
        } else if (distance > radius - 8) {
            // Borde del círculo - verde oscuro
            pixelData[offset] = 0x20;     // B
            pixelData[offset + 1] = 0x5E; // G
            pixelData[offset + 2] = 0x1B; // R
            pixelData[offset + 3] = 0xFF; // A
        }
        
        // Crear una 'A' grande en el centro
        const letterSize = 80;
        const letterX = x - centerX + letterSize/2;
        const letterY = y - centerY + letterSize/2;
        
        if (letterX >= 0 && letterX < letterSize && letterY >= 0 && letterY < letterSize) {
            // Patrón simple para formar una 'A'
            const isLetter = (
                (letterY < 20 && letterX > 25 && letterX < 55) || // Top line
                (letterY > 20 && letterY < 40 && (letterX < 30 || letterX > 50)) || // Upper sides
                (letterY > 35 && letterY < 45 && letterX > 25 && letterX < 55) || // Middle line
                (letterY > 40 && (letterX < 35 || letterX > 45)) // Lower sides
            );
            
            if (isLetter && distance < radius - 8) {
                pixelData[offset] = 0x00;     // B - Dorado
                pixelData[offset + 1] = 0xD7; // G
                pixelData[offset + 2] = 0xFF; // R
                pixelData[offset + 3] = 0xFF; // A
            }
        }
    }
}

// También crear máscara AND (todos ceros para píxeles opacos)
const maskData = Buffer.alloc(size * size / 8); // 1 bit per pixel mask

// Combinar header + pixel data + mask data
const fullIco = Buffer.concat([icoData, pixelData, maskData]);

// Guardar archivo ICO
const iconPath = path.join(__dirname, 'assets', 'icon.ico');
fs.writeFileSync(iconPath, fullIco);

console.log('✅ Icono ICO básico creado:', iconPath);

// También crear un PNG simple usando Canvas si está disponible
try {
    // Intentar crear versión PNG también
    const pngHeader = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A // PNG signature
    ]);
    
    // Crear un archivo PNG mínimo (esto es complejo, mejor usar el HTML generator)
    console.log('💡 Para PNG de mejor calidad, abre assets/icon-generator.html en un navegador');
    
} catch (err) {
    console.log('ℹ️ Para PNG: usa assets/icon-generator.html');
}

console.log('✅ Recursos de iconos preparados');