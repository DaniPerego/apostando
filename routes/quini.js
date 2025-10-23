const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

// Función helper para validar números
function validateNumbers(numbers, min = 0, max = 45, count = 6) {
    if (!Array.isArray(numbers)) {
        throw new Error('Los números deben ser un array');
    }
    
    if (numbers.length !== count) {
        throw new Error(`Se requieren exactamente ${count} números`);
    }
    
    for (const num of numbers) {
        if (!Number.isInteger(num) || num < min || num > max) {
            throw new Error(`Número inválido: ${num}. Debe estar entre ${min} y ${max}`);
        }
    }
    
    // Verificar números únicos
    const uniqueNumbers = [...new Set(numbers)];
    if (uniqueNumbers.length !== numbers.length) {
        throw new Error('No se permiten números repetidos');
    }
}

// Función helper para validar premio extra
function validatePremioExtra(numbers, min = 0, max = 45, maxCount = 18) {
    if (!numbers || numbers.length === 0) {
        return; // Premio extra es opcional
    }
    
    if (!Array.isArray(numbers)) {
        throw new Error('El premio extra debe ser un array');
    }
    
    if (numbers.length > maxCount) {
        throw new Error(`El premio extra puede tener máximo ${maxCount} números`);
    }
    
    for (const num of numbers) {
        if (!Number.isInteger(num) || num < min || num > max) {
            throw new Error(`Número inválido en premio extra: ${num}. Debe estar entre ${min} y ${max}`);
        }
    }
    
    // Verificar números únicos
    const uniqueNumbers = [...new Set(numbers)];
    if (uniqueNumbers.length !== numbers.length) {
        throw new Error('No se permiten números repetidos en premio extra');
    }
}

// GET /api/quini - Obtener todos los sorteos
router.get('/', async (req, res) => {
    try {
        const sorteos = await query(`
            SELECT s.id, s.fecha, s.created_at, s.updated_at
            FROM quini_sorteos s
            ORDER BY s.fecha DESC, s.id DESC
        `);

        // Obtener números para cada sorteo
        for (const sorteo of sorteos) {
            const numeros = await query(`
                SELECT tipo, numero
                FROM quini_numeros
                WHERE sorteo_id = ?
                ORDER BY tipo, numero
            `, [sorteo.id]);

            // Organizar números por tipo
            sorteo.primerSorteo = [];
            sorteo.segundaDelQuini = [];
            sorteo.revancha = [];
            sorteo.siempreSale = [];
            sorteo.premioExtra = [];

            for (const { tipo, numero } of numeros) {
                switch (tipo) {
                    case 'primer':
                        sorteo.primerSorteo.push(numero);
                        break;
                    case 'segunda':
                        sorteo.segundaDelQuini.push(numero);
                        break;
                    case 'revancha':
                        sorteo.revancha.push(numero);
                        break;
                    case 'siempre':
                        sorteo.siempreSale.push(numero);
                        break;
                    case 'premio_extra':
                        sorteo.premioExtra.push(numero);
                        break;
                }
            }

            // Ordenar arrays
            sorteo.primerSorteo.sort((a, b) => a - b);
            sorteo.segundaDelQuini.sort((a, b) => a - b);
            sorteo.revancha.sort((a, b) => a - b);
            sorteo.siempreSale.sort((a, b) => a - b);
            sorteo.premioExtra.sort((a, b) => a - b);
        }

        res.json(sorteos);
    } catch (error) {
        console.error('Error obteniendo sorteos Quini:', error);
        res.status(500).json({ error: 'Error obteniendo sorteos' });
    }
});

// GET /api/quini/:id - Obtener un sorteo específico
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const sorteos = await query(`
            SELECT s.id, s.fecha, s.created_at, s.updated_at
            FROM quini_sorteos s
            WHERE s.id = ?
        `, [id]);

        if (sorteos.length === 0) {
            return res.status(404).json({ error: 'Sorteo no encontrado' });
        }

        const sorteo = sorteos[0];
        
        // Obtener números
        const numeros = await query(`
            SELECT tipo, numero
            FROM quini_numeros
            WHERE sorteo_id = ?
            ORDER BY tipo, numero
        `, [id]);

        // Organizar números por tipo
        sorteo.primerSorteo = [];
        sorteo.segundaDelQuini = [];
        sorteo.revancha = [];
        sorteo.siempreSale = [];
        sorteo.premioExtra = [];

        for (const { tipo, numero } of numeros) {
            switch (tipo) {
                case 'primer':
                    sorteo.primerSorteo.push(numero);
                    break;
                case 'segunda':
                    sorteo.segundaDelQuini.push(numero);
                    break;
                case 'revancha':
                    sorteo.revancha.push(numero);
                    break;
                case 'siempre':
                    sorteo.siempreSale.push(numero);
                    break;
                case 'premio_extra':
                    sorteo.premioExtra.push(numero);
                    break;
            }
        }

        res.json(sorteo);
    } catch (error) {
        console.error('Error obteniendo sorteo Quini:', error);
        res.status(500).json({ error: 'Error obteniendo sorteo' });
    }
});

// POST /api/quini - Crear nuevo sorteo
router.post('/', async (req, res) => {
    try {
        const { 
            concursoId, 
            fecha, 
            primerSorteo, 
            segundaDelQuini, 
            revancha, 
            siempreSale, 
            premioExtra 
        } = req.body;

        // Validaciones
        if (!concursoId || !fecha) {
            return res.status(400).json({ error: 'ID de concurso y fecha son requeridos' });
        }

        if (!Number.isInteger(concursoId) || concursoId <= 0) {
            return res.status(400).json({ error: 'ID de concurso debe ser un número entero positivo' });
        }

        // Validar formato de fecha
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
            return res.status(400).json({ error: 'Fecha debe estar en formato YYYY-MM-DD' });
        }

        // Validar números
        validateNumbers(primerSorteo, 0, 45, 6);
        validateNumbers(segundaDelQuini, 0, 45, 6);
        validateNumbers(revancha, 0, 45, 6);
        validateNumbers(siempreSale, 0, 45, 6);
        
        if (premioExtra && premioExtra.length > 0) {
            validatePremioExtra(premioExtra, 0, 45, 18);
        }

        // Verificar si ya existe el sorteo
        const existingSorteo = await query('SELECT id FROM quini_sorteos WHERE id = ?', [concursoId]);
        if (existingSorteo.length > 0) {
            return res.status(409).json({ error: `Ya existe un sorteo con ID ${concursoId}` });
        }

        // Insertar sorteo
        await query('INSERT INTO quini_sorteos (id, fecha) VALUES (?, ?)', [concursoId, fecha]);

        // Insertar números
        const numerosData = [];
        
        // Primer sorteo
        for (const numero of primerSorteo) {
            numerosData.push([concursoId, 'primer', numero]);
        }
        
        // Segunda del Quini
        for (const numero of segundaDelQuini) {
            numerosData.push([concursoId, 'segunda', numero]);
        }
        
        // Revancha
        for (const numero of revancha) {
            numerosData.push([concursoId, 'revancha', numero]);
        }
        
        // Siempre Sale
        for (const numero of siempreSale) {
            numerosData.push([concursoId, 'siempre', numero]);
        }
        
        // Premio Extra (opcional)
        if (premioExtra && premioExtra.length > 0) {
            for (const numero of premioExtra) {
                numerosData.push([concursoId, 'premio_extra', numero]);
            }
        }

        // Insertar todos los números
        if (numerosData.length > 0) {
            const placeholders = numerosData.map(() => '(?, ?, ?)').join(', ');
            const flatData = numerosData.flat();
            await query(`INSERT INTO quini_numeros (sorteo_id, tipo, numero) VALUES ${placeholders}`, flatData);
        }

        res.status(201).json({ 
            message: 'Sorteo creado exitosamente',
            sorteo: { 
                id: concursoId, 
                fecha,
                primerSorteo,
                segundaDelQuini,
                revancha,
                siempreSale,
                premioExtra: premioExtra || []
            }
        });

    } catch (error) {
        console.error('Error creando sorteo Quini:', error);
        
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Ya existe un sorteo con este ID' });
        }
        
        res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
});

// GET /api/quini/frequencies - Obtener frecuencias de números
router.get('/frequencies', async (req, res) => {
    try {
        const frequencies = await query(`
            SELECT numero, COUNT(*) as cantidad
            FROM quini_numeros
            GROUP BY numero
            ORDER BY cantidad DESC, numero ASC
        `);

        // Crear array con todos los números (0-45) y sus frecuencias
        const result = Array.from({ length: 46 }, (_, i) => {
            const found = frequencies.find(f => f.numero === i);
            return {
                numero: i,
                cantidad: found ? found.cantidad : 0
            };
        });

        // Ordenar por cantidad (descendente) y luego por número (ascendente)
        result.sort((a, b) => b.cantidad - a.cantidad || a.numero - b.numero);

        res.json(result);
    } catch (error) {
        console.error('Error obteniendo frecuencias Quini:', error);
        res.status(500).json({ error: 'Error obteniendo frecuencias' });
    }
});

// DELETE /api/quini/:id - Eliminar sorteo
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await query('DELETE FROM quini_sorteos WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Sorteo no encontrado' });
        }

        res.json({ message: 'Sorteo eliminado exitosamente' });
    } catch (error) {
        console.error('Error eliminando sorteo Quini:', error);
        res.status(500).json({ error: 'Error eliminando sorteo' });
    }
});

module.exports = router;