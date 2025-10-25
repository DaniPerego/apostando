// LOTO PLUS - Modelo de datos de ejemplo + algoritmo de frecuencias
// Estructura JSON de ejemplo: 3 sorteos simulados
// Placeholders en mayúsculas entre corchetes deben ser reemplazados por la programación real

const sorteosLotoPlusEjemplo = [
  {
    concursoID_LotoPlus: 4100,
    fechaSorteo: '2025-09-10',
    // sorteoPrincipal: Array de [CANTIDAD_PRINCIPAL] números entre 00 y [UNIVERSO_MÁXIMO]
    sorteoPrincipal: ['03','07','11','18','24','29'], // ejemplo (p. ej. 6 números)
    // sorteoJackpot: Array de [CANTIDAD_JACKPOT] números entre 00 y [UNIVERSO_JACKPOT]
    sorteoJackpot: ['01','05'], // ejemplo (p. ej. 2 números de jackpot)
    // loto5Plus: Array de [CANTIDAD_LOTO5] números entre 00 y [UNIVERSO_MÁXIMO_LOTO5]
    loto5Plus: ['03','11','25','30','35']
  },
  {
    concursoID_LotoPlus: 4101,
    fechaSorteo: '2025-09-17',
    sorteoPrincipal: ['02','07','14','18','24','33'],
    sorteoJackpot: ['05','08'],
    loto5Plus: ['02','07','20','30','33']
  },
  {
    concursoID_LotoPlus: 4102,
    fechaSorteo: '2025-09-24',
    sorteoPrincipal: ['03','09','11','19','24','29'],
    sorteoJackpot: ['01','09'],
    loto5Plus: ['03','11','19','29','34']
  }
];

/**
 * calcularFrecuenciasLotoPlus
 * @param {Array} sorteos - Array de sorteos con la estructura definida arriba
 * @param {number} universoMaximoPrincipal - número máximo (inclusive) del universo principal (ej: 35 para 00-35)
 * @param {number} universoMaximoJackpot - número máximo (inclusive) del universo jackpot
 * @returns {Object} { principal: Array, jackpot: Array }
 *
 * Explicación:
 * - Inicializa contadores para todos los números en ambos universos (0..universoMaximo inclusive)
 * - Cuenta apariciones en sorteoPrincipal y loto5Plus en la estructura 'principal'
 * - Cuenta apariciones en sorteoJackpot en la estructura 'jackpot'
 * - Calcula frecuenciaRelativa (%) = (apariciones / total_apariciones_categoria) * 100
 * - Devuelve arrays ordenados por apariciones desc, luego por número asc
 */
function calcularFrecuenciasLotoPlus(sorteos, universoMaximoPrincipal, universoMaximoJackpot) {
  // Validaciones básicas
  if (!Array.isArray(sorteos)) throw new Error('sorteos debe ser un arreglo');
  if (typeof universoMaximoPrincipal !== 'number' || typeof universoMaximoJackpot !== 'number') {
    throw new Error('Los universos deben ser números');
  }

  // Inicializar conteo para principal (0..universoMaximoPrincipal)
  const principalCounts = Array.from({ length: universoMaximoPrincipal + 1 }, () => 0);
  // Inicializar conteo para jackpot (0..universoMaximoJackpot)
  const jackpotCounts = Array.from({ length: universoMaximoJackpot + 1 }, () => 0);

  // Helper para normalizar entradas: convertir string '03' o number 3 a integer
  const normalize = (v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return v;
    const s = String(v).trim();
    if (s === '') return null;
    // permitir valores con leading zero
    const n = parseInt(s, 10);
    if (Number.isNaN(n)) return null;
    return n;
  };

  // Contadores totales para calcular frecuencia relativa
  let totalPrincipalApariciones = 0; // suma de todas las apariciones en sorteoPrincipal + loto5Plus
  let totalJackpotApariciones = 0;

  // Iterar sobre sorteos y acumular
  for (const s of sorteos) {
    // procesar sorteoPrincipal
    if (Array.isArray(s.sorteoPrincipal)) {
      for (const numRaw of s.sorteoPrincipal) {
        const num = normalize(numRaw);
        if (num === null) continue;
        if (num >= 0 && num <= universoMaximoPrincipal) {
          principalCounts[num] += 1;
          totalPrincipalApariciones += 1;
        }
      }
    }

    // procesar loto5Plus (se incluye en principal según requerimiento)
    if (Array.isArray(s.loto5Plus)) {
      for (const numRaw of s.loto5Plus) {
        const num = normalize(numRaw);
        if (num === null) continue;
        if (num >= 0 && num <= universoMaximoPrincipal) {
          principalCounts[num] += 1;
          totalPrincipalApariciones += 1;
        }
      }
    }

    // procesar jackpot
    if (Array.isArray(s.sorteoJackpot)) {
      for (const numRaw of s.sorteoJackpot) {
        const num = normalize(numRaw);
        if (num === null) continue;
        if (num >= 0 && num <= universoMaximoJackpot) {
          jackpotCounts[num] += 1;
          totalJackpotApariciones += 1;
        }
      }
    }
  }

  // Construir arrays de resultado con frecuencia relativa
  const principal = principalCounts.map((apariciones, numero) => ({
    numero,
    apariciones,
    frecuenciaRelativa: totalPrincipalApariciones > 0 ? (apariciones / totalPrincipalApariciones) * 100 : 0
  }));

  const jackpot = jackpotCounts.map((apariciones, numero) => ({
    numero,
    apariciones,
    frecuenciaRelativa: totalJackpotApariciones > 0 ? (apariciones / totalJackpotApariciones) * 100 : 0
  }));

  // Ordenar por apariciones desc, luego número asc
  principal.sort((a, b) => b.apariciones - a.apariciones || a.numero - b.numero);
  jackpot.sort((a, b) => b.apariciones - a.apariciones || a.numero - b.numero);

  return { principal, jackpot };
}

// Ejemplo de invocación con los datos simulados
(function ejemploInvocacion() {
  try {
    // Definir universos (ejemplo): si principal es 00-35 -> universoMaximoPrincipal = 35
    const universoMaximoPrincipal = 35; // reemplazar por [UNIVERSO_MÁXIMO]
    const universoMaximoJackpot = 9;    // reemplazar por [UNIVERSO_JACKPOT]

    const resultado = calcularFrecuenciasLotoPlus(sorteosLotoPlusEjemplo, universoMaximoPrincipal, universoMaximoJackpot);

    console.log('📊 Frecuencias Loto Plus - Principal (top 10):');
    console.table(resultado.principal.slice(0, 10).map(r => ({ numero: String(r.numero).padStart(2,'0'), apariciones: r.apariciones, frecuencia: r.frecuenciaRelativa.toFixed(2) + '%' })));

    console.log('📊 Frecuencias Loto Plus - Jackpot (top 10):');
    console.table(resultado.jackpot.slice(0, 10).map(r => ({ numero: String(r.numero).padStart(2,'0'), apariciones: r.apariciones, frecuencia: r.frecuenciaRelativa.toFixed(2) + '%' })));
  } catch (err) {
    console.error('Error en ejemploInvocacion:', err.message);
  }
})();

// Exportar para uso modular (si se usa bundler o import dinámico)
if (typeof window !== 'undefined') {
  window.sorteosLotoPlusEjemplo = sorteosLotoPlusEjemplo;
  window.calcularFrecuenciasLotoPlus = calcularFrecuenciasLotoPlus;
}
