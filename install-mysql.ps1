# Script de instalación automática de MySQL para Windows
# Ejecutar como Administrador en PowerShell

Write-Host "🚀 Instalación automática de MySQL para proyecto Apostando" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green

# Verificar si se ejecuta como administrador
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "❌ Este script requiere permisos de administrador" -ForegroundColor Red
    Write-Host "💡 Haz clic derecho en PowerShell y selecciona 'Ejecutar como administrador'" -ForegroundColor Yellow
    Read-Host "Presiona Enter para salir"
    exit 1
}

# Verificar si Chocolatey está instalado
try {
    $chocoVersion = choco --version
    Write-Host "✅ Chocolatey ya está instalado: $chocoVersion" -ForegroundColor Green
} catch {
    Write-Host "📦 Instalando Chocolatey..." -ForegroundColor Yellow
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    
    # Refrescar variables de entorno
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

# Instalar MySQL
Write-Host "🗄️ Instalando MySQL Server..." -ForegroundColor Yellow
try {
    choco install mysql -y
    Write-Host "✅ MySQL instalado exitosamente" -ForegroundColor Green
} catch {
    Write-Host "❌ Error instalando MySQL: $_" -ForegroundColor Red
    Read-Host "Presiona Enter para salir"
    exit 1
}

# Iniciar servicio MySQL
Write-Host "🚀 Iniciando servicio MySQL..." -ForegroundColor Yellow
try {
    Start-Service MySQL80  # El nombre puede variar según la versión
    Write-Host "✅ Servicio MySQL iniciado" -ForegroundColor Green
} catch {
    Write-Host "❌ Error iniciando servicio MySQL: $_" -ForegroundColor Red
    Write-Host "💡 Intenta iniciar el servicio manualmente desde Servicios de Windows" -ForegroundColor Yellow
}

# Crear base de datos
Write-Host "🏗️ Creando base de datos apostando_db..." -ForegroundColor Yellow
$createDB = @"
CREATE DATABASE IF NOT EXISTS apostando_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
SHOW DATABASES;
"@

# Guardar script SQL temporal
$createDB | Out-File -FilePath "create_db.sql" -Encoding UTF8

try {
    # Ejecutar script (asumiendo que no hay contraseña de root por defecto)
    mysql -u root -e "CREATE DATABASE IF NOT EXISTS apostando_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    Write-Host "✅ Base de datos apostando_db creada" -ForegroundColor Green
    
    # Limpiar archivo temporal
    Remove-Item "create_db.sql" -Force
} catch {
    Write-Host "⚠️ No se pudo crear la base de datos automáticamente" -ForegroundColor Yellow
    Write-Host "💡 Puedes crearla manualmente con:" -ForegroundColor Cyan
    Write-Host "mysql -u root -p" -ForegroundColor White
    Write-Host "CREATE DATABASE apostando_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" -ForegroundColor White
}

Write-Host "`n🎉 Instalación completada!" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green
Write-Host "📋 Próximos pasos:" -ForegroundColor Yellow
Write-Host "1. Navega al directorio del proyecto apostando" -ForegroundColor White
Write-Host "2. Ejecuta: npm install" -ForegroundColor White
Write-Host "3. Ejecuta: npm run init" -ForegroundColor White
Write-Host "4. Ejecuta: npm start" -ForegroundColor White
Write-Host "5. Abre http://localhost:3000 en tu navegador" -ForegroundColor White

Read-Host "`nPresiona Enter para salir"