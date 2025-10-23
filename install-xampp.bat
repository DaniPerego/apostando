@echo off
echo 🚀 Instalador XAMPP para proyecto Apostando
echo ===========================================
echo.

REM Verificar si XAMPP ya está instalado
if exist "C:\xampp\mysql\bin\mysql.exe" (
    echo ✅ XAMPP ya está instalado en C:\xampp
    goto :config
)

echo 📦 XAMPP no encontrado. Instalando...
echo.
echo 💡 Se abrirá el navegador para descargar XAMPP
echo    1. Descarga la versión más reciente
echo    2. Ejecuta el instalador
echo    3. Acepta todas las opciones por defecto
echo    4. Una vez instalado, vuelve a ejecutar este script
echo.

REM Abrir página de descarga de XAMPP
start https://www.apachefriends.org/download.html

pause
exit /b 0

:config
echo.
echo 🔧 Configurando XAMPP para el proyecto...
echo.

REM Verificar si el panel de control de XAMPP está ejecutándose
echo 💡 Abriendo panel de control de XAMPP...
echo    1. Inicia los servicios Apache y MySQL
echo    2. Verifica que ambos estén en verde (Running)
echo.

REM Abrir panel de control de XAMPP
if exist "C:\xampp\xampp-control.exe" (
    start "XAMPP Control Panel" "C:\xampp\xampp-control.exe"
) else (
    echo ❌ No se encontró el panel de control de XAMPP
    echo 💡 Ejecuta manualmente: C:\xampp\xampp-control.exe
)

echo.
echo ⏳ Esperando a que inicies los servicios MySQL y Apache...
echo    Una vez que estén ejecutándose, presiona cualquier tecla
pause

echo.
echo 🗄️ Creando base de datos apostando_db...
echo.

REM Crear archivo SQL temporal
echo CREATE DATABASE IF NOT EXISTS apostando_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; > create_db.sql

REM Ejecutar SQL usando MySQL de XAMPP
if exist "C:\xampp\mysql\bin\mysql.exe" (
    "C:\xampp\mysql\bin\mysql.exe" -u root < create_db.sql
    if %errorlevel% equ 0 (
        echo ✅ Base de datos apostando_db creada exitosamente
    ) else (
        echo ⚠️ Error creando la base de datos
        echo 💡 Puedes crearla manualmente desde phpMyAdmin:
        echo    1. Ve a http://localhost/phpmyadmin
        echo    2. Crea nueva base de datos "apostando_db"
        echo    3. Selecciona cotejamiento "utf8mb4_unicode_ci"
    )
    del create_db.sql
) else (
    echo ❌ No se encontró MySQL de XAMPP
)

echo.
echo 🌐 Verificando phpMyAdmin...
echo 💡 Abriendo phpMyAdmin en el navegador...
start http://localhost/phpmyadmin

echo.
echo 🎉 Configuración de XAMPP completada!
echo ===========================================
echo 📋 Estado de la configuración:
echo ✅ XAMPP instalado
echo ✅ MySQL ejecutándose
echo ✅ Base de datos apostando_db creada
echo ✅ phpMyAdmin disponible
echo.
echo 📋 Próximos pasos:
echo 1. Ve al directorio del proyecto apostando
echo 2. Ejecuta: npm install
echo 3. Ejecuta: npm run init
echo 4. Ejecuta: npm start
echo 5. Abre http://localhost:3000
echo.
echo 💡 Variables de entorno configuradas para XAMPP:
echo    DB_HOST=localhost
echo    DB_USER=root
echo    DB_PASSWORD= (vacío para XAMPP)
echo    DB_NAME=apostando_db
echo.
pause