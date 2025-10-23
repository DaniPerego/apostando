# 🚀 Guía de instalación de MySQL para el proyecto Apostando

## Opción 1: XAMPP (Recomendado para Windows)

### 1. Descargar e instalar XAMPP
1. Ve a: https://www.apachefriends.org/download.html
2. Descarga la versión para Windows
3. Instala XAMPP (acepta todas las opciones por defecto)
4. Abre el Panel de Control de XAMPP
5. Inicia los servicios "Apache" y "MySQL"

### 2. Acceder a phpMyAdmin
1. Con XAMPP ejecutándose, ve a: http://localhost/phpmyadmin
2. Crea una nueva base de datos llamada "apostando_db"
3. Selecciona "utf8mb4_unicode_ci" como cotejamiento

### 3. Configurar variables de entorno
Crea o edita el archivo .env en la carpeta del proyecto con:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=apostando_db
DB_PORT=3306
PORT=3000
NODE_ENV=development
```

## Opción 2: MySQL Installer para Windows

### 1. Descargar MySQL
1. Ve a: https://dev.mysql.com/downloads/installer/
2. Descarga "MySQL Installer for Windows"
3. Ejecuta el instalador
4. Selecciona "Developer Default" o "Server only"
5. Sigue el asistente de instalación
6. Configura una contraseña para el usuario root

### 2. Configurar la base de datos
```sql
-- Abre MySQL Command Line Client o MySQL Workbench
-- Ejecuta estos comandos:

CREATE DATABASE apostando_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
SHOW DATABASES;
```

### 3. Configurar variables de entorno
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_contraseña_aqui
DB_NAME=apostando_db
DB_PORT=3306
PORT=3000
NODE_ENV=development
```

## Opción 3: Usar Docker (Para desarrolladores avanzados)

### 1. Instalar Docker Desktop
1. Descarga Docker Desktop para Windows
2. Instálalo y reinicia tu computadora

### 2. Ejecutar MySQL en Docker
```bash
# Crear y ejecutar contenedor MySQL
docker run --name mysql-apostando -e MYSQL_ROOT_PASSWORD=123456 -e MYSQL_DATABASE=apostando_db -p 3306:3306 -d mysql:8.0

# Verificar que está funcionando
docker ps
```

### 3. Configurar variables de entorno
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=123456
DB_NAME=apostando_db
DB_PORT=3306
PORT=3000
NODE_ENV=development
```

## 📋 Pasos después de instalar MySQL:

### 1. Verificar instalación
```bash
# Navegar al directorio del proyecto
cd "ruta/del/proyecto/apostando"

# Instalar dependencias (si no se hizo antes)
npm install

# Inicializar base de datos
npm run init
```

### 2. Iniciar el servidor
```bash
npm start
```

### 3. Abrir la aplicación
Abre tu navegador en: http://localhost:3000

## 🛟 Solución de problemas comunes

### Error "ECONNREFUSED"
- MySQL no está ejecutándose
- Verifica el puerto en .env (por defecto 3306)
- En XAMPP: asegúrate de que el servicio MySQL esté iniciado

### Error "Access denied for user 'root'"
- Contraseña incorrecta en .env
- Usuario incorrecto
- En XAMPP, por defecto no hay contraseña (deja DB_PASSWORD vacío)

### Error "Unknown database 'apostando_db'"
- La base de datos no existe
- Créala manualmente en phpMyAdmin o MySQL Workbench
- O ejecuta: CREATE DATABASE apostando_db;

## 💡 Recomendación

Para un proyecto de desarrollo en Windows, **XAMPP es la opción más fácil**:
1. Una sola descarga
2. Interfaz gráfica simple
3. Incluye phpMyAdmin para gestión visual
4. No requiere configuración compleja

¿Cuál opción prefieres usar?