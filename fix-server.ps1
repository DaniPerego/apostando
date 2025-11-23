$content = Get-Content -Path "server.js" -Raw

# Reemplazar el endpoint /sorteos
$content = $content -replace "(?s)// 2\. VER SORTEOS.*?app\.get\('/sorteos'.*?\}\);", @"
// 2. VER SORTEOS
app.get('/sorteos', async (req, res) => {
    try {
        const [sorteos] = await db.execute('SELECT * FROM quini_sorteos ORDER BY fecha DESC LIMIT 10');
        
        // Obtener números para cada sorteo
        for (const sorteo of sorteos) {
            const [numeros] = await db.execute('SELECT numero FROM quini_numeros WHERE sorteo_id = ? AND tipo IN ("primer", "segunda", "revancha", "siempre") ORDER BY id', [sorteo.id]);
            sorteo.numeros = numeros.map(n => n.numero);
            sorteo.concurso = sorteo.id;
        }
        
        res.json(sorteos);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error obteniendo sorteos' });
    }
});
"@

# Reemplazar el endpoint /sorteos-loto-plus
$content = $content -replace "(?s)// 6\. VER SORTEOS LOTO PLUS.*?app\.get\('/sorteos-loto-plus'.*?\}\);", @"
// 6. VER SORTEOS LOTO PLUS
app.get('/sorteos-loto-plus', async (req, res) => {
    try {
        const [sorteos] = await db.execute('SELECT * FROM loto_plus_sorteos ORDER BY fecha DESC LIMIT 10');
        
        // Obtener números para cada sorteo
        for (const sorteo of sorteos) {
            const [numeros] = await db.execute('SELECT numero, tipo FROM loto_plus_numeros WHERE sorteo_id = ?', [sorteo.id]);
            sorteo.numeros = numeros.filter(n => n.tipo !== 'jack').map(n => n.numero);
            const jack = numeros.find(n => n.tipo === 'jack');
            if (jack) sorteo.jack = jack.numero;
            sorteo.concurso = sorteo.id;
        }
        
        res.json(sorteos);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error obteniendo sorteos Loto Plus' });
    }
});
"@

# Agregar los nuevos endpoints antes de "// Página principal"
$newEndpoints = @"

// ============= ENDPOINTS DE PATRONES =============

function calcularPatrones(numeros, totalSorteos) {
    const stats = {};
    for (let i = 0; i <= 45; i++) {
        stats[i] = { numero: i, apariciones: 0, ultimaAparicion: null, intervalos: [], sorteosSinSalir: 0 };
    }
    numeros.forEach((sorteo, indexSorteo) => {
        sorteo.numeros.forEach(num => {
            if (stats[num]) {
                if (stats[num].ultimaAparicion === null) {
                    stats[num].sorteosSinSalir = indexSorteo;
                } else {
                    stats[num].intervalos.push(indexSorteo - stats[num].ultimaAparicion);
                }
                stats[num].ultimaAparicion = indexSorteo;
                stats[num].apariciones++;
            }
        });
    });
    return Object.values(stats).map(stat => {
        if (stat.ultimaAparicion === null) stat.sorteosSinSalir = totalSorteos;
        const promedio = stat.intervalos.length > 0 ? stat.intervalos.reduce((a, b) => a + b, 0) / stat.intervalos.length : totalSorteos;
        let estado = 'tibio';
        if (stat.sorteosSinSalir > promedio * 2) estado = 'muy-frio';
        else if (stat.sorteosSinSalir > promedio) estado = 'frio';
        else if (stat.sorteosSinSalir < promedio * 0.2) estado = 'caliente';
        return { numero: stat.numero, sorteosSinSalir: stat.sorteosSinSalir, intervaloPromedio: parseFloat(promedio.toFixed(2)), estado, frecuencia: stat.apariciones };
    }).filter(s => s.numero > 0 || (s.numero === 0 && s.apariciones > 0));
}

app.get('/patrones-quini', async (req, res) => {
    try {
        const [sorteosDB] = await db.execute('SELECT * FROM quini_sorteos ORDER BY fecha DESC');
        const sorteos = [];
        for (const s of sorteosDB) {
            const [nums] = await db.execute('SELECT numero FROM quini_numeros WHERE sorteo_id = ? AND tipo IN ("primer", "segunda", "revancha", "siempre")', [s.id]);
            sorteos.push({ fecha: s.fecha, numeros: nums.map(n => n.numero) });
        }
        res.json({ patrones: calcularPatrones(sorteos, sorteos.length) });
    } catch (error) {
        console.error('Error patrones quini:', error);
        res.status(500).json({ error: 'Error calculando patrones' });
    }
});

app.get('/patrones-loto-plus', async (req, res) => {
    try {
        const [sorteosDB] = await db.execute('SELECT * FROM loto_plus_sorteos ORDER BY fecha DESC');
        const sorteos = [];
        for (const s of sorteosDB) {
            const [nums] = await db.execute('SELECT numero FROM loto_plus_numeros WHERE sorteo_id = ? AND tipo IN ("tradicional", "match", "desquite", "sale_o_sale")', [s.id]);
            sorteos.push({ fecha: s.fecha, numeros: nums.map(n => n.numero) });
        }
        const sorteosJack = [];
        for (const s of sorteosDB) {
            const [nums] = await db.execute('SELECT numero FROM loto_plus_numeros WHERE sorteo_id = ? AND tipo = "jack"', [s.id]);
            if (nums.length > 0) sorteosJack.push({ fecha: s.fecha, numeros: nums.map(n => n.numero) });
        }
        res.json({ patrones: calcularPatrones(sorteos, sorteos.length), patronesJack: calcularPatrones(sorteosJack, sorteosJack.length) });
    } catch (error) {
        console.error('Error patrones loto:', error);
        res.status(500).json({ error: 'Error calculando patrones' });
    }
});

app.post('/sorteo/eliminar', async (req, res) => {
    try {
        const { concurso } = req.body;
        await db.execute('DELETE FROM quini_sorteos WHERE id = ?', [concurso]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/loto-plus/eliminar', async (req, res) => {
    try {
        const { concurso } = req.body;
        await db.execute('DELETE FROM loto_plus_sorteos WHERE id = ?', [concurso]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

"@

$content = $content -replace "(?s)(// Página principal)", "$newEndpoints`$1"

Set-Content -Path "server.js" -Value $content -NoNewline
Write-Host "Archivo modificado exitosamente"
