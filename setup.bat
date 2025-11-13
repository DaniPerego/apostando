@echo off
title Configurador Completo - Proyecto Apostando
color 0A
cls

echo.
echo   ╔══════════════════════════════════════════════════════╗
echo   ║          🎯 PROYECTO APOSTANDO - CONFIGURADOR        ║  
echo   ║            Quini 6 y Loto Plus con MySQL           ║
echo   ╚══════════════════════════════════════════════════════╝
echo.

REM Verificar que estemos en el directorio correcto
if not exist "package.json" (
    echo ❌ Error: No se encontró package.json
    echo 💡 Asegúrate de estar en el directorio del proyecto apostando
    echo.
    echo 📁 Directorio actual: %CD%
    echo 📁 Debería contener: package.json, server.js, etc.
    echo.
    pause
    exit /b 1
)

echo ✅ Directorio del proyecto confirmado
echo 📁 Ubicación: %CD%
echo.

REM Verificar Node.js
echo 🔍 Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js no está instalado
    echo 💡 Descarga e instala Node.js desde: https://nodejs.org
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js instalado: %NODE_VERSION%

REM Verificar npm
echo 🔍 Verificando npm...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm no está instalado
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo ✅ npm instalado: %NPM_VERSION%
echo.

REM Instalar dependencias de Node.js
echo 📦 Instalando dependencias de Node.js...
echo    express, mysql2, cors, dotenv, etc...
echo.
npm install
if %errorlevel% neq 0 (
    echo ❌ Error instalando dependencias de Node.js
    pause
    exit /b 1
)
echo ✅ Dependencias de Node.js instaladas
echo.

REM Verificar configuración MySQL
echo 🗄️ Verificando configuración de MySQL...
echo.

REM Buscar XAMPP
if exist "C:\xampp\mysql\bin\mysql.exe" (
    echo ✅ XAMPP encontrado en C:\xampp
    set MYSQL_PATH=C:\xampp\mysql\bin\mysql.exe
    set MYSQL_TYPE=XAMPP
    goto :mysql_found
)

REM Buscar MySQL instalación estándar
mysql --version >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ MySQL encontrado en PATH del sistema
    set MYSQL_PATH=mysql
    set MYSQL_TYPE=STANDARD
    goto :mysql_found
)

REM MySQL no encontrado
echo ❌ MySQL no encontrado
echo.
echo 🚀 Opciones de instalación:
echo.
echo [1] Instalar XAMPP (recomendado - más fácil)
echo [2] Instalar MySQL Server (avanzado)
echo [3] Salir y configurar manualmente
echo.
set /p choice="Selecciona una opción (1-3): "

if "%choice%"=="1" (
    echo.
    echo 📦 Instalando XAMPP...
    call install-xampp.bat
    goto :end
)

if "%choice%"=="2" (
    echo.
    echo 📦 Instalando MySQL Server...
    powershell -ExecutionPolicy Bypass -File install-mysql.ps1
    goto :end
)

echo.
echo 📋 Configuración manual:
echo 1. Instala XAMPP desde: https://www.apachefriends.org/download.html
echo 2. O instala MySQL desde: https://dev.mysql.com/downloads/installer/
echo 3. Ejecuta este script nuevamente
goto :end

:mysql_found
echo ✅ MySQL encontrado: %MYSQL_TYPE%
echo.

REM Verificar si MySQL está ejecutándose
echo 🔍 Verificando si MySQL está ejecutándose...

if "%MYSQL_TYPE%"=="XAMPP" (
    tasklist /fi "imagename eq mysqld.exe" | find /i "mysqld.exe" >nul
    if %errorlevel% neq 0 (
        echo ❌ MySQL no está ejecutándose
        echo 💡 Abre el Panel de Control de XAMPP y inicia MySQL
        start "XAMPP Control Panel" "C:\xampp\xampp-control.exe"
        echo.
        echo ⏳ Inicia MySQL desde XAMPP y presiona cualquier tecla...
        pause >nul
    )
)

REM Crear base de datos
echo 🏗️ Creando base de datos apostando_db...
echo CREATE DATABASE IF NOT EXISTS apostando_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; > create_db.sql

if "%MYSQL_TYPE%"=="XAMPP" (
    "C:\xampp\mysql\bin\mysql.exe" -u root < create_db.sql 2>nul
) else (
    mysql -u root < create_db.sql 2>nul
)

if %errorlevel% equ 0 (
    echo ✅ Base de datos apostando_db creada
) else (
    echo ⚠️ La base de datos podría ya existir o necesitas configurar credenciales
)

del create_db.sql 2>nul

REM Verificar archivo .env
echo 🔧 Verificando configuración (.env)...
if not exist ".env" (
    echo 📝 Creando archivo .env...
    copy .env.example .env >nul
)
echo ✅ Archivo .env configurado
echo.

REM Inicializar tablas de base de datos
echo 🚀 Inicializando tablas de la base de datos...
npm run init
if %errorlevel% neq 0 (
    echo ❌ Error inicializando tablas
    echo 💡 Verifica que MySQL esté ejecutándose y las credenciales sean correctas
    echo.
    echo 📋 Configuración actual (.env):
    type .env
    echo.
    pause
    goto :end
)

echo ✅ Tablas inicializadas correctamente
echo.

REM Todo listo
echo.
echo   ╔══════════════════════════════════════════════════════╗
echo   ║                ✅ CONFIGURACIÓN COMPLETA             ║  
echo   ╚══════════════════════════════════════════════════════╝
echo.
echo 🎉 ¡El proyecto está listo para usar!
echo.
echo 📋 Resumen de configuración:
echo ✅ Node.js %NODE_VERSION%
echo ✅ npm %NPM_VERSION%  
echo ✅ Dependencias instaladas
echo ✅ MySQL (%MYSQL_TYPE%) configurado
echo ✅ Base de datos apostando_db creada
echo ✅ Variables de entorno configuradas
echo ✅ Tablas de base de datos inicializadas
echo.
echo 🚀 Para usar el sistema:
echo.
echo    1. npm start
echo    2. Abre http://localhost:3000
echo    3. ¡Comienza a cargar sorteos!
echo.
echo ¿Quieres iniciar el servidor ahora? (s/n)
set /p start_now="Respuesta: "

if /i "%start_now%"=="s" (
    echo.
    echo 🚀 Iniciando servidor...
    npm start
) else (
    echo.
    echo 📋 Para iniciar más tarde ejecuta: npm start
)

:end
echo.
pause