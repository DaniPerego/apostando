'use strict';

// Helpers y lógica (exportable para tests y usable en navegador)
(function () {
    const normalizeNumberToken = tok => {
        if (!tok) return null;
        const cleaned = String(tok).replace(/[^0-9]/g, '');
        if (cleaned === '') return null;
        return parseInt(cleaned, 10);
    };

    function parseNumbers(input, opts = {}) {
        const { min = 0, max = 45, requiredCount = null, allowUpTo = null } = opts;
        if (!input) return [];
        const tokens = String(input).split(/[\s,;]+/).map(t => t.trim()).filter(Boolean);
        const nums = tokens.map(t => {
            const n = normalizeNumberToken(t);
            if (n === null || Number.isNaN(n)) throw new Error(`Token inválido: "${t}"`);
            if (n < min || n > max) throw new Error(`Número fuera de rango (${min}-${max}): ${t}`);
            return n;
        });
        const unique = Array.from(new Set(nums));
        if (unique.length !== nums.length) throw new Error('Números repetidos en la lista');
        if (requiredCount !== null && unique.length !== requiredCount) throw new Error(`Se requieren exactamente ${requiredCount} números, se recibieron ${unique.length}`);
        if (allowUpTo !== null && unique.length > allowUpTo) throw new Error(`Se permiten hasta ${allowUpTo} números, se recibieron ${unique.length}`);
        return unique.sort((a, b) => a - b);
    }

    // Almacenamiento en localStorage
    const STORAGE_KEY = 'apostando_data_v1';
    const defaultModel = { quini: [], brinco: [] };

    function loadModel() {
        try {
            const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(STORAGE_KEY) : null;
            return raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(defaultModel));
        } catch (e) {
            return JSON.parse(JSON.stringify(defaultModel));
        }
    }
    function saveModel(model) {
        if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(model, null, 2));
    }

    // Frecuencias
    function computeFrequenciesQuini(model) {
        const counts = Array(46).fill(0);
        (model.quini || []).forEach(s => {
            ['primerSorteo','segundaDelQuini','revancha','siempreSale'].forEach(k => (s[k]||[]).forEach(n => counts[n]++));
            (s.premioExtra||[]).forEach(n => counts[n]++);
        });
        return counts.map((c, i) => ({ numero: i, cantidad: c }));
    }
    function computeFrequenciesBrinco(model) {
        const counts = Array(40).fill(0);
        (model.brinco || []).forEach(s => {
            ['brincoTradicional','brincoJunior'].forEach(k => (s[k]||[]).forEach(n => counts[n]++));
        });
        return counts.map((c, i) => ({ numero: i, cantidad: c }));
    }

    // Generador SQL simple
    function generateSQL(model) {
        const lines = [];
        lines.push('-- Esquema sugerido para MySQL');
        lines.push('CREATE TABLE IF NOT EXISTS quini_sorteos (id INT PRIMARY KEY, fecha DATE);');
        lines.push('CREATE TABLE IF NOT EXISTS quini_numeros (sorteo_id INT, tipo ENUM(\'primer\',\'segunda\',\'revancha\',\'siempre\',\'premio_extra\'), numero TINYINT, PRIMARY KEY (sorteo_id, tipo, numero));');
        lines.push('CREATE TABLE IF NOT EXISTS brinco_sorteos (id INT PRIMARY KEY, fecha DATE);');
        lines.push('CREATE TABLE IF NOT EXISTS brinco_numeros (sorteo_id INT, tipo ENUM(\'tradicional\',\'junior\'), numero TINYINT, PRIMARY KEY (sorteo_id, tipo, numero));');
        lines.push('');

        (model.quini || []).forEach(s => {
            lines.push(`-- Quini ${s.concursoId} (${s.fecha})`);
            lines.push(`INSERT INTO quini_sorteos (id, fecha) VALUES (${s.concursoId}, '${s.fecha}');`);
            [['primerSorteo','primer'],['segundaDelQuini','segunda'],['revancha','revancha'],['siempreSale','siempre']].forEach(([k,t])=> (s[k]||[]).forEach(n=> lines.push(`INSERT INTO quini_numeros (sorteo_id, tipo, numero) VALUES (${s.concursoId}, '${t}', ${n});`))));
            (s.premioExtra||[]).forEach(n=> lines.push(`INSERT INTO quini_numeros (sorteo_id, tipo, numero) VALUES (${s.concursoId}, 'premio_extra', ${n});`));
            lines.push('');
        });

        (model.brinco || []).forEach(s => {
            lines.push(`-- Brinco ${s.concursoId} (${s.fecha})`);
            lines.push(`INSERT INTO brinco_sorteos (id, fecha) VALUES (${s.concursoId}, '${s.fecha}');`);
            (s.brincoTradicional||[]).forEach(n=> lines.push(`INSERT INTO brinco_numeros (sorteo_id, tipo, numero) VALUES (${s.concursoId}, 'tradicional', ${n});`));
            (s.brincoJunior||[]).forEach(n=> lines.push(`INSERT INTO brinco_numeros (sorteo_id, tipo, numero) VALUES (${s.concursoId}, 'junior', ${n});`));
            lines.push('');
        });

        return lines.join('\n');
    }

    // Export helper: descarga un archivo en el navegador
    function downloadFile(filename, content, mime = 'text/sql;charset=utf-8') {
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    // Export y attach a window
    const api = {
        parseNumbers,
        computeFrequenciesQuini,
        computeFrequenciesBrinco,
        generateSQL,
        loadModel,
        saveModel
    };

    if (typeof window !== 'undefined') {
        window._apostando = Object.assign(window._apostando || {}, api);
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    // Inicialización DOM solo en navegador (no cuando se require en Node/jest)
    function qs(sel){ return document.querySelector(sel); }
    function renderModel(model) {
        if (!document) return;
        qs('#modelo-quini').textContent = JSON.stringify(model.quini || [], null, 2);
        qs('#modelo-brinco').textContent = JSON.stringify(model.brinco || [], null, 2);
        qs('#frecuencias-quini').textContent = computeFrequenciesQuini(model).filter(x=>x.cantidad>0).sort((a,b)=>b.cantidad-a.cantidad||a.numero-b.numero).map(x=>`${String(x.numero).padStart(2,'0')}: ${x.cantidad}`).join('\n') || '(sin datos)';
        qs('#frecuencias-brinco').textContent = computeFrequenciesBrinco(model).filter(x=>x.cantidad>0).sort((a,b)=>b.cantidad-a.cantidad||a.numero-b.numero).map(x=>`${String(x.numero).padStart(2,'0')}: ${x.cantidad}`).join('\n') || '(sin datos)';
        qs('#sql-script').textContent = generateSQL(model);
    }
    function showMessage(selector, text, isError=true){
        const el = qs(selector); if(!el) return;
        el.textContent = text; el.classList.toggle('exito', !isError); el.hidden = false;
        if(!isError) setTimeout(()=>el.hidden=true, 4000);
    }

    function init() {
        const model = loadModel();
        renderModel(model);
        const formQuini = qs('#form-quini');
        const formBrinco = qs('#form-brinco');
        if (formQuini) formQuini.addEventListener('submit', handleQuiniSubmit);
        if (formBrinco) formBrinco.addEventListener('submit', handleBrincoSubmit);
        const btnExport = qs('#export-sql');
        if (btnExport) {
            btnExport.addEventListener('click', () => {
                try {
                    const modelLocal = loadModel();
                    const sql = generateSQL(modelLocal);
                    downloadFile('apostando.sql', sql);
                    showMessage('#sql-script', 'Archivo .sql descargado.', false);
                } catch (err) {
                    showMessage('#sql-script', 'Error al generar SQL: ' + (err.message || ''), true);
                }
            });
        }
    }

    const isNode = (typeof module !== 'undefined' && module.exports);
    if (!isNode && typeof document !== 'undefined') {
        document.addEventListener('DOMContentLoaded', init);
    }

})();
