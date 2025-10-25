'use strict';

// Configuración de la API
const API_BASE_URL = '/api';

// Elementos del DOM
let connectionIndicator, connectionText, formQuini, formBrinco;

// Estado de la aplicación
let isConnected = false;

// Helpers para UI
function qs(sel) { return document.querySelector(sel); }

function showMessage(selector, text, isError = true) {
    const el = qs(selector);
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('exito', !isError);
    el.hidden = false;
    if (!isError) {
        setTimeout(() => el.hidden = true, 4000);
    }
}

function updateConnectionStatus(connected, message = '') {
    isConnected = connected;
    
    if (connected) {
        connectionIndicator.className = 'status-indicator status-connected';
        connectionText.textContent = message || 'Conectado a MySQL';
    } else {
        connectionIndicator.className = 'status-indicator status-disconnected';
        connectionText.textContent = message || 'Desconectado del servidor';
    }
    
    // Habilitar/deshabilitar formularios
    const formElements = document.querySelectorAll('form button[type="submit"]');
    formElements.forEach(btn => {
        btn.disabled = !connected;
    });
}

function setLoading(selector, loading = true) {
    const el = qs(selector);
    if (el) {
        if (loading) {
            el.textContent = 'Cargando...';
            el.style.opacity = '0.6';
        } else {
            el.style.opacity = '1';
        }
    }
}

// Helper para parsear números
function parseNumbers(input, opts = {}) {
    const { min = 0, max = 45, requiredCount = null, allowUpTo = null } = opts;
    if (!input) return [];
    
    const tokens = String(input).split(/[\s,;]+/).map(t => t.trim()).filter(Boolean);
    const nums = tokens.map(t => {
        const cleaned = String(t).replace(/[^0-9]/g, '');
        if (cleaned === '') throw new Error(`Token inválido: "${t}"`);
        const n = parseInt(cleaned, 10);
        if (Number.isNaN(n)) throw new Error(`Token inválido: "${t}"`);
        if (n < min || n > max) throw new Error(`Número fuera de rango (${min}-${max}): ${t}`);
        return n;
    });
    
    const unique = Array.from(new Set(nums));
    if (unique.length !== nums.length) throw new Error('Números repetidos en la lista');
    
    if (requiredCount !== null && unique.length !== requiredCount) {
        throw new Error(`Se requieren exactamente ${requiredCount} números, se recibieron ${unique.length}`);
    }
    
    if (allowUpTo !== null && unique.length > allowUpTo) {
        throw new Error(`Se permiten hasta ${allowUpTo} números, se recibieron ${unique.length}`);
    }
    
    return unique.sort((a, b) => a - b);
}

// Funciones de API
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
        },
        ...options
    };
    
    try {
        const response = await fetch(url, config);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `Error HTTP: ${response.status}`);
        }
        
        return data;
    } catch (error) {
        console.error(`Error en API ${endpoint}:`, error);
        throw error;
    }
}

async function loadQuiniData() {
    try {
        const sorteos = await apiRequest('/quini');
        qs('#modelo-quini').textContent = JSON.stringify(sorteos, null, 2);
        return sorteos;
    } catch (error) {
        qs('#modelo-quini').textContent = `Error: ${error.message}`;
        throw error;
    }
}

async function loadBrincoData() {
    try {
        const sorteos = await apiRequest('/brinco');
        qs('#modelo-brinco').textContent = JSON.stringify(sorteos, null, 2);
        return sorteos;
    } catch (error) {
        qs('#modelo-brinco').textContent = `Error: ${error.message}`;
        throw error;
    }
}

async function loadQuiniFrequencies() {
    try {
        const frequencies = await apiRequest('/quini/frequencies');
        const filtered = frequencies.filter(f => f.cantidad > 0);
        
        if (filtered.length > 0) {
            const freqText = `Números más sorteados:\n` +
                filtered.map(f => `${String(f.numero).padStart(2,'0')}: ${f.cantidad} veces`).join('\n');
            qs('#frecuencias-quini').textContent = freqText;
        } else {
            qs('#frecuencias-quini').textContent = '(sin datos)';
        }
    } catch (error) {
        console.error('Error cargando frecuencias Quini:', error);
        qs('#frecuencias-quini').textContent = `Error: ${error.message}`;
    }
}

async function loadBrincoFrequencies() {
    try {
        const frequencies = await apiRequest('/brinco/frequencies');
        const filtered = frequencies.filter(f => f.cantidad > 0);
        
        if (filtered.length > 0) {
            const freqText = `Números más sorteados:\n` +
                filtered.map(f => `${String(f.numero).padStart(2,'0')}: ${f.cantidad} veces`).join('\n');
            qs('#frecuencias-brinco').textContent = freqText;
        } else {
            qs('#frecuencias-brinco').textContent = '(sin datos)';
        }
    } catch (error) {
        console.error('Error cargando frecuencias Brinco:', error);
        qs('#frecuencias-brinco').textContent = `Error: ${error.message}`;
    }
}

async function loadAllData() {
    setLoading('#modelo-quini', true);
    setLoading('#modelo-brinco', true);
    setLoading('#frecuencias-quini', true);
    setLoading('#frecuencias-brinco', true);
    
    try {
        await Promise.all([
            loadQuiniData(),
            loadBrincoData(),
            loadQuiniFrequencies(),
            loadBrincoFrequencies()
        ]);
        updateConnectionStatus(true);
    } catch (error) {
        updateConnectionStatus(false, 'Error cargando datos');
        console.error('Error loading data:', error);
    } finally {
        setLoading('#modelo-quini', false);
        setLoading('#modelo-brinco', false);
        setLoading('#frecuencias-quini', false);
        setLoading('#frecuencias-brinco', false);
    }
}

// Manejadores de formularios
async function handleQuiniSubmit(event) {
    event.preventDefault();
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Guardando...';
    
    try {
        const formData = new FormData(event.target);
        
        const concursoId = parseInt(formData.get('concursoId'));
        const fecha = formData.get('fecha');
        const primerSorteo = parseNumbers(formData.get('primerSorteo'), { min: 1, max: 45, requiredCount: 6 });
        const segundaDelQuini = parseNumbers(formData.get('segundaDelQuini'), { min: 1, max: 45, requiredCount: 6 });
        const revancha = parseNumbers(formData.get('revancha'), { min: 1, max: 45, requiredCount: 6 });
        const siempreSale = parseNumbers(formData.get('siempreSale'), { min: 1, max: 45, requiredCount: 6 });
        const premioExtra = parseNumbers(formData.get('premioExtra') || '', { min: 1, max: 45, allowUpTo: 18 });

        const sorteoData = {
            concursoId,
            fecha,
            primerSorteo,
            segundaDelQuini,
            revancha,
            siempreSale,
            premioExtra
        };

        await apiRequest('/quini', {
            method: 'POST',
            body: JSON.stringify(sorteoData)
        });

        event.target.reset();
        showMessage('#mensaje-quini', `Sorteo Quini 6 #${concursoId} guardado exitosamente en la base de datos.`, false);
        
        // Recargar datos
        await loadAllData();
        
    } catch (error) {
        console.error('Error submitting Quini:', error);
        showMessage('#mensaje-quini', `Error: ${error.message}`, true);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

async function handleBrincoSubmit(event) {
    event.preventDefault();
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Guardando...';
    
    try {
        const formData = new FormData(event.target);
        
        const concursoId = parseInt(formData.get('concursoIdBrinco'));
        const fecha = formData.get('fecha');
        const brincoTradicional = parseNumbers(formData.get('brincoTradicional'), { min: 1, max: 45, requiredCount: 4 });
        const brincoJunior = parseNumbers(formData.get('brincoJunior'), { min: 1, max: 45, requiredCount: 4 });

        const sorteoData = {
            concursoId,
            fecha,
            brincoTradicional,
            brincoJunior
        };

        await apiRequest('/brinco', {
            method: 'POST',
            body: JSON.stringify(sorteoData)
        });

        event.target.reset();
        showMessage('#mensaje-brinco', `Sorteo Brinco #${concursoId} guardado exitosamente en la base de datos.`, false);
        
        // Recargar datos
        await loadAllData();
        
    } catch (error) {
        console.error('Error submitting Brinco:', error);
        showMessage('#mensaje-brinco', `Error: ${error.message}`, true);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// Función para exportar SQL (mantenida por compatibilidad)
function generateAndDownloadSQL() {
    try {
        // Crear un SQL simple basado en los datos actuales
        const quinData = JSON.parse(qs('#modelo-quini').textContent || '[]');
        const brincoData = JSON.parse(qs('#modelo-brinco').textContent || '[]');
        
        const lines = [];
        lines.push('-- Exportación de datos desde el sistema web');
        lines.push('-- Generado el: ' + new Date().toLocaleString());
        lines.push('');
        
        lines.push('-- Datos de Quini 6');
        quinData.forEach(sorteo => {
            lines.push(`-- Sorteo ${sorteo.id} (${sorteo.fecha})`);
            lines.push(`INSERT IGNORE INTO quini_sorteos (id, fecha) VALUES (${sorteo.id}, '${sorteo.fecha}');`);
            
            if (sorteo.primerSorteo) {
                sorteo.primerSorteo.forEach(num => {
                    lines.push(`INSERT IGNORE INTO quini_numeros (sorteo_id, tipo, numero) VALUES (${sorteo.id}, 'primer', ${num});`);
                });
            }
            // ... otros tipos de sorteo
            lines.push('');
        });
        
        const sql = lines.join('\n');
        
        // Descargar archivo
        const blob = new Blob([sql], { type: 'text/sql;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `apostando_export_${new Date().toISOString().split('T')[0]}.sql`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        
        showMessage('#mensaje-quini', 'Archivo SQL exportado exitosamente.', false);
        
    } catch (error) {
        showMessage('#mensaje-quini', 'Error al exportar SQL: ' + error.message, true);
    }
}

// Inicialización
function init() {
    // Obtener elementos
    connectionIndicator = qs('#connection-indicator');
    connectionText = qs('#connection-text');
    formQuini = qs('#form-quini');
    formBrinco = qs('#form-brinco');
    
    // Configurar event listeners
    if (formQuini) {
        formQuini.addEventListener('submit', handleQuiniSubmit);
    }
    
    if (formBrinco) {
        formBrinco.addEventListener('submit', handleBrincoSubmit);
    }
    
    const refreshBtn = qs('#refresh-data');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadAllData);
    }
    
    const exportBtn = qs('#export-sql');
    if (exportBtn) {
        exportBtn.addEventListener('click', generateAndDownloadSQL);
    }
    
    // Cargar datos iniciales
    loadAllData();
    
    // Cargar estadísticas adicional después de un pequeño retraso
    setTimeout(() => {
        loadQuiniFrequencies();
        loadBrincoFrequencies();
    }, 2000);
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}