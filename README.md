# 🎯 Apostando - Sistema de Quini 6 y Brinco

Sistema completo para el seguimiento y análisis estadístico de sorteos de Quini 6 y Brinco, con interfaz web y base de datos MySQL.

## ✨ Características

- 🎲 **Carga de sorteos**: Quini 6 (Primer Sorteo, Segunda del Quini, Revancha, Siempre Sale, Premio Extra) y Brinco (Tradicional, Junior)
- 📊 **Estadísticas en tiempo real**: Números más sorteados ordenados por frecuencia
- 🗄️ **Base de datos MySQL**: Persistencia de datos con API REST
- 🌐 **Interfaz web moderna**: Responsive y fácil de usar
- 📥 **Exportación SQL**: Backup y migración de datos
- ⚡ **Validación completa**: Números únicos, rangos correctos, formatos válidos

## 🚀 Instalación y Configuración

### Prerrequisitos
- Node.js (v14 o superior)
- MySQL Server
- npm o yarn

### 1️⃣ Clonar y configurar

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de MySQL
```

### 2️⃣ Configurar MySQL

```sql
-- Crear base de datos
mysql -u root -p
CREATE DATABASE apostando_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3️⃣ Inicializar sistema

```bash
# Configuración automática (recomendado)
npm run init

# O iniciar directamente
npm start
```

### 4️⃣ Usar la aplicación

1. Abre tu navegador en `http://localhost:3000`
2. ¡Comienza a cargar sorteos!

## 📁 Estructura del proyecto

```
apostando/
├── config/
│   └── database.js         # Configuración MySQL y pool de conexiones
├── routes/
│   ├── quini.js           # API endpoints para Quini 6
│   └── brinco.js          # API endpoints para Brinco
├── public/
│   ├── index.html         # Interfaz web principal
│   └── js/
│       └── app-api.js     # Frontend que consume la API
├── sql/
│   └── schema.sql         # Esquema de base de datos
├── .env                   # Variables de entorno
├── server.js              # Servidor Express principal
├── init.js                # Script de inicialización
└── package.json
```

## 🔌 API REST

### Quini 6 Endpoints

- `GET /api/quini` - Obtener todos los sorteos
- `GET /api/quini/:id` - Obtener sorteo específico
- `POST /api/quini` - Crear nuevo sorteo
- `GET /api/quini/frequencies` - Estadísticas de números
- `DELETE /api/quini/:id` - Eliminar sorteo

### Brinco Endpoints

- `GET /api/brinco` - Obtener todos los sorteos
- `GET /api/brinco/:id` - Obtener sorteo específico
- `POST /api/brinco` - Crear nuevo sorteo
- `GET /api/brinco/frequencies` - Estadísticas de números
- `DELETE /api/brinco/:id` - Eliminar sorteo

### Ejemplo de uso

```javascript
// Crear sorteo Quini 6
const response = await fetch('/api/quini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        concursoId: 1234,
        fecha: '2025-10-23',
        primerSorteo: [3, 12, 18, 26, 33, 44],
        segundaDelQuini: [5, 11, 19, 24, 37, 43],
        revancha: [2, 5, 8, 16, 21, 27],
        siempreSale: [1, 7, 14, 22, 29, 41],
        premioExtra: [3, 12, 18, 26, 33, 44]
    })
});
```

## ⚙️ Variables de entorno (.env)

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_contraseña
DB_NAME=apostando_db
DB_PORT=3306
PORT=3000
NODE_ENV=development
```

## 🧪 Testing

```bash
npm test
```

## 📝 Scripts disponibles

- `npm start` - Iniciar servidor en producción
- `npm run dev` - Desarrollo con nodemon (reinicio automático)
- `npm run init` - Configuración inicial de base de datos
- `npm test` - Ejecutar tests

## 🛠️ Desarrollo

### Agregar nuevos endpoints

1. Editar `/routes/quini.js` o `/routes/brinco.js`
2. Actualizar `/public/js/app-api.js` para consumir la nueva API
3. Reiniciar servidor con `npm run dev`

### Modificar esquema de base de datos

1. Actualizar `/config/database.js` en la función `initializeTables()`
2. Modificar `/sql/schema.sql` para mantener consistencia
3. Ejecutar `npm run init` para aplicar cambios

## 🐛 Solución de problemas

### Error de conexión MySQL
```bash
# Verificar que MySQL está ejecutándose
sudo service mysql start  # Linux
brew services start mysql # macOS

# Verificar credenciales en .env
# Crear base de datos si no existe
```

### Puerto ocupado
```bash
# Cambiar PORT en .env o terminar proceso
lsof -ti:3000 | xargs kill -9
```

### Dependencias faltantes
```bash
npm install
# O reinstalar completamente
rm -rf node_modules package-lock.json && npm install
```

## 📊 Esquema de base de datos

```sql
-- Quini 6
CREATE TABLE quini_sorteos (
    id INT PRIMARY KEY,
    fecha DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE quini_numeros (
    sorteo_id INT,
    tipo ENUM('primer','segunda','revancha','siempre','premio_extra'),
    numero TINYINT,
    PRIMARY KEY (sorteo_id, tipo, numero),
    FOREIGN KEY (sorteo_id) REFERENCES quini_sorteos(id)
);

-- Brinco
CREATE TABLE brinco_sorteos (
    id INT PRIMARY KEY,
    fecha DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE brinco_numeros (
    sorteo_id INT,
    tipo ENUM('tradicional','junior'),
    numero TINYINT,
    PRIMARY KEY (sorteo_id, tipo, numero),
    FOREIGN KEY (sorteo_id) REFERENCES brinco_sorteos(id)
);
```

## 📄 Licencia

MIT License - Ver archivo LICENSE para más detalles.

## 🤝 Contribuir

1. Fork del proyecto
2. Crear rama para nueva funcionalidad (`git checkout -b feature/nueva-funcionalidad`)
3. Commit de cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

---

**¡Desarrollado con ❤️ para facilitar el análisis de sorteos de Quini 6 y Brinco!**