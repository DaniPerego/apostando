'use strict';

const quini6Resultados = [
    {
        concursoID: 3090,
        fechaSorteo: '2025-10-12',
        primerSorteo: [3, 12, 18, 26, 33, 44],
        segundaDelQuini: [5, 11, 19, 24, 37, 43],
        revancha: [2, 5, 8, 16, 21, 27],
        siempreSale: [1, 7, 14, 22, 29, 41],
        premioExtra: [3, 12, 18, 26, 33, 44, 2, 5, 8, 16, 21, 27]
    },
    {
        concursoID: 3091,
        fechaSorteo: '2025-10-19',
        primerSorteo: [4, 9, 17, 28, 35, 42],
        segundaDelQuini: [6, 13, 20, 25, 38, 45],
        revancha: [0, 6, 14, 19, 25, 32],
        siempreSale: [5, 10, 18, 24, 31, 39],
        premioExtra: [4, 9, 17, 28, 35, 42, 0, 6, 14, 19, 25, 32]
    }
];

const brincoResultados = [
    {
        concursoID_Brinco: 1,
        fechaSorteo: '2025-10-05',
        brincoTradicional: [0, 7, 14, 19, 28, 36],
        brincoJunior: [3, 9, 15, 21, 30, 37]
    },
    {
        concursoID_Brinco: 2,
        fechaSorteo: '2025-10-12',
        brincoTradicional: [2, 11, 18, 23, 29, 34],
        brincoJunior: [4, 12, 20, 27, 32, 39]
    }
];

const MYSQL_SCRIPT_PATH = 'sql/schema.sql';

function calcularFrecuencias(sorteos, universoMaximo) {
    const frecuencias = Array.from({ length: universoMaximo + 1 }, (_, numero) => ({
        numero,
        apariciones: 0,
        frecuenciaRelativa: 0
    }));

    let totalExtracciones = 0;

    sorteos.forEach(registro => {
        Object.values(registro).forEach(valor => {
            if (!Array.isArray(valor)) {
                return;
            }

            valor.forEach(numero => {
                if (Number.isInteger(numero) && numero >= 0 && numero <= universoMaximo) {
                    frecuencias[numero].apariciones += 1;
                    totalExtracciones += 1;
                }
            });
        });
    });

    if (totalExtracciones > 0) {
        frecuencias.forEach(item => {
            const porcentaje = (item.apariciones / totalExtracciones) * 100;
            item.frecuenciaRelativa = Number(porcentaje.toFixed(2));
        });
    }

    return frecuencias
        .map(item => ({
            numero: item.numero.toString().padStart(2, '0'),
            apariciones: item.apariciones,
            frecuenciaRelativa: item.frecuenciaRelativa
        }))
        .sort((a, b) => {
            if (b.apariciones !== a.apariciones) {
                return b.apariciones - a.apariciones;
            }
            return a.numero.localeCompare(b.numero);
        });
}

function renderModelos() {
    document.getElementById('modelo-quini').textContent = JSON.stringify(quini6Resultados, null, 2);
    document.getElementById('modelo-brinco').textContent = JSON.stringify(brincoResultados, null, 2);
}

function renderFrecuencias() {
    const frecuenciasQuini = calcularFrecuencias(quini6Resultados, 45);
    const frecuenciasBrinco = calcularFrecuencias(brincoResultados, 39);

    document.getElementById('frecuencias-quini').textContent = JSON.stringify(frecuenciasQuini, null, 2);
    document.getElementById('frecuencias-brinco').textContent = JSON.stringify(frecuenciasBrinco, null, 2);
}

function mostrarMensaje(elemento, mensaje, esError = false) {
    elemento.textContent = mensaje;
    elemento.hidden = false;
    if (esError) {
        elemento.classList.remove('exito');
    } else {
        elemento.classList.add('exito');
    }
}

function limpiarMensaje(elemento) {
    elemento.hidden = true;
    elemento.textContent = '';
    elemento.classList.remove('exito');
}

function parsearNumeros(cadena, minimo, maximo, opciones = {}) {
    const {
        cantidadExacta,
        cantidadMaxima,
        permitirVacio = false,
        etiqueta = 'los números',
        exigirUnicidad = true
    } = opciones;

    if (!cadena) {
        if (permitirVacio) {
            return [];
        }
        throw new Error(`Debe ingresar valores para ${etiqueta}.`);
    }

    const partes = cadena.split(/[\s,;]+/).filter(Boolean);

    if (cantidadExacta && partes.length !== cantidadExacta) {
        throw new Error(`${etiqueta} debe incluir exactamente ${cantidadExacta} valores.`);
    }

    if (cantidadMaxima && partes.length > cantidadMaxima) {
        throw new Error(`${etiqueta} admite como máximo ${cantidadMaxima} valores.`);
    }

    const numeros = partes.map(parte => {
        if (!/^\d{1,2}$/.test(parte)) {
            throw new Error(`El valor "${parte}" no es un número válido de dos dígitos.`);
        }
        const numero = parseInt(parte, 10);
        if (Number.isNaN(numero) || numero < minimo || numero > maximo) {
            throw new Error(`El número ${parte} está fuera del rango permitido (${minimo}-${maximo}).`);
        }
        return numero;
    });

    if (exigirUnicidad) {
        const conjunto = new Set(numeros);
        if (conjunto.size !== numeros.length) {
            throw new Error(`${etiqueta} no debe contener números repetidos.`);
        }
    }

    return numeros;
}

function inicializarFormularios() {
    const formularioQuini = document.getElementById('form-quini');
    const formularioBrinco = document.getElementById('form-brinco');

    formularioQuini.addEventListener('submit', event => {
        event.preventDefault();
        const mensaje = document.getElementById('mensaje-quini');
        limpiarMensaje(mensaje);

        try {
            const formData = new FormData(event.target);

            const nuevoSorteo = {
                concursoID: Number(formData.get('concursoId')),
                fechaSorteo: formData.get('fecha'),
                primerSorteo: parsearNumeros(formData.get('primerSorteo'), 0, 45, {
                    cantidadExacta: 6,
                    etiqueta: 'Primer Sorteo'
                }),
                segundaDelQuini: parsearNumeros(formData.get('segundaDelQuini'), 0, 45, {
                    cantidadExacta: 6,
                    etiqueta: 'Segunda del Quini'
                }),
                revancha: parsearNumeros(formData.get('revancha'), 0, 45, {
                    cantidadExacta: 6,
                    etiqueta: 'Revancha'
                }),
                siempreSale: parsearNumeros(formData.get('siempreSale'), 0, 45, {
                    cantidadExacta: 6,
                    etiqueta: 'Siempre Sale'
                }),
                premioExtra: parsearNumeros(formData.get('premioExtra'), 0, 45, {
                    cantidadMaxima: 18,
                    permitirVacio: true,
                    etiqueta: 'Premio Extra'
                })
            };

            quini6Resultados.push(nuevoSorteo);
            renderModelos();
            renderFrecuencias();
            event.target.reset();
            mostrarMensaje(mensaje, 'Sorteo Quini 6 agregado correctamente.');
        } catch (error) {
            mostrarMensaje(mensaje, error.message, true);
        }
    });

    formularioBrinco.addEventListener('submit', event => {
        event.preventDefault();
        const mensaje = document.getElementById('mensaje-brinco');
        limpiarMensaje(mensaje);

        try {
            const formData = new FormData(event.target);

            const nuevoSorteo = {
                concursoID_Brinco: Number(formData.get('concursoIdBrinco')),
                fechaSorteo: formData.get('fecha'),
                brincoTradicional: parsearNumeros(formData.get('brincoTradicional'), 0, 39, {
                    cantidadExacta: 6,
                    etiqueta: 'Brinco Tradicional'
                }),
                brincoJunior: parsearNumeros(formData.get('brincoJunior'), 0, 39, {
                    cantidadExacta: 6,
                    etiqueta: 'Brinco Junior'
                })
            };

            brincoResultados.push(nuevoSorteo);
            renderModelos();
            renderFrecuencias();
            event.target.reset();
            mostrarMensaje(mensaje, 'Sorteo Brinco agregado correctamente.');
        } catch (error) {
            mostrarMensaje(mensaje, error.message, true);
        }
    });
}

async function cargarScriptSql() {
    const salidaSql = document.getElementById('sql-script');
    try {
        const respuesta = await fetch(MYSQL_SCRIPT_PATH);
        if (!respuesta.ok) {
            throw new Error(`HTTP ${respuesta.status}`);
        }
        const texto = await respuesta.text();
        salidaSql.textContent = texto;
    } catch (error) {
        salidaSql.textContent = `No se pudo cargar el script SQL (${error.message}).`;
    }
}

renderModelos();
renderFrecuencias();
inicializarFormularios();
cargarScriptSql();
