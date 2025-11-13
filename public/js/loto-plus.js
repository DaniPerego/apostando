// LOTO PLUS - Modelo de datos de ejemplo + algoritmo de frecuencias
// Estructura igual a Quini 6 pero con número Jack adicional (0-9)
// 4 sorteos por fecha: Tradicional, Match, Desquite, Sale o Sale
// Sorteos los Miércoles y Domingos

const sorteosLotoPlusEjemplo = [
  {
    concursoID_LotoPlus: 4100,
    fechaSorteo: '2025-09-25', // Miércoles
    // Estructura igual a Quini 6: 4 sorteos de 6 números (1-45) + Jack (0-9)
    tradicional: ['03','12','18','26','33','44'],
    match: ['05','11','19','24','37','43'],
    desquite: ['02','05','08','16','21','27'],
    saleOSale: ['01','07','14','22','29','41'],
    numeroJack: 5 // 0-9
  },
  {
    concursoID_LotoPlus: 4101,
    fechaSorteo: '2025-09-28', // Domingo
    tradicional: ['04','09','15','23','31','42'],
    match: ['01','08','16','25','34','45'],
    desquite: ['06','13','20','28','35','39'],
    saleOSale: ['10','17','24','30','38','44'],
    numeroJack: 8
  },
  {
    concursoID_LotoPlus: 4102,
    fechaSorteo: '2025-10-02', // Miércoles
    tradicional: ['02','11','17','25','32','40'],
    match: ['03','14','21','29','36','43'],
    desquite: ['07','15','23','31','38','45'],
    saleOSale: ['01','09','18','26','33','41'],
    numeroJack: 2
  }
];

/**
 * calcularFrecuenciasLotoPlus
 * @param {Array} sorteos - Array de sorteos con estructura igual a Quini 6 + numeroJack
 * @param {number} universoMaximo - número máximo (1-45) como Quini 6
 * @param {number} universoMaximoJack - número máximo Jack (0-9)
 * @returns {Object} { principal: Array, jack: Array }
 *
 * Explicación:
 * - Cuenta apariciones en tradicional, match, desquite, saleOSale (1-45)
 * - Cuenta apariciones de numeroJack (0-9)
 * - Calcula frecuenciaRelativa (%) = (apariciones / total_apariciones_categoria) * 100
 * - Devuelve arrays ordenados por apariciones desc, luego por número asc
 */
function calcularFrecuenciasLotoPlus(sorteos, universoMaximo, universoMaximoJack) {
  // Validaciones básicas
  if (!Array.isArray(sorteos)) throw new Error('sorteos debe ser un arreglo');
  if (typeof universoMaximo !== 'number' || typeof universoMaximoJack !== 'number') {
    throw new Error('Los universos deben ser números');
  }

  // Inicializar conteo para números principales (1..universoMaximo)
  const principalCounts = Array.from({ length: universoMaximo + 1 }, () => 0);
  // Inicializar conteo para números Jack (0..universoMaximoJack)
  const jackCounts = Array.from({ length: universoMaximoJack + 1 }, () => 0);

  // Helper para normalizar entradas: convertir string '03' o number 3 a integer
  const normalize = (v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return v;
    const s = String(v).trim();
    if (s === '') return null;
    const n = parseInt(s, 10);
    if (Number.isNaN(n)) return null;
    return n;
  };

  // Contadores totales para calcular frecuencia relativa
  let totalPrincipalApariciones = 0;
  let totalJackApariciones = 0;

  // Iterar sobre sorteos y acumular (estructura como Quini 6)
  for (const s of sorteos) {
    // Procesar tradicional
    if (Array.isArray(s.tradicional)) {
      for (const numRaw of s.tradicional) {
        const num = normalize(numRaw);
        if (num === null) continue;
        if (num >= 1 && num <= universoMaximo) {
          principalCounts[num] += 1;
          totalPrincipalApariciones += 1;
        }
      }
    }

    // Procesar match
    if (Array.isArray(s.match)) {
      for (const numRaw of s.match) {
        const num = normalize(numRaw);
        if (num === null) continue;
        if (num >= 1 && num <= universoMaximo) {
          principalCounts[num] += 1;
          totalPrincipalApariciones += 1;
        }
      }
    }

    // Procesar desquite
    if (Array.isArray(s.desquite)) {
      for (const numRaw of s.desquite) {
        const num = normalize(numRaw);
        if (num === null) continue;
        if (num >= 1 && num <= universoMaximo) {
          principalCounts[num] += 1;
          totalPrincipalApariciones += 1;
        }
      }
    }

    // Procesar saleOSale
    if (Array.isArray(s.saleOSale)) {
      for (const numRaw of s.saleOSale) {
        const num = normalize(numRaw);
        if (num === null) continue;
        if (num >= 1 && num <= universoMaximo) {
          principalCounts[num] += 1;
          totalPrincipalApariciones += 1;
        }
      }
    }

    // Procesar numeroJack
    if (s.numeroJack !== null && s.numeroJack !== undefined) {
      const jackNum = normalize(s.numeroJack);
      if (jackNum !== null && jackNum >= 0 && jackNum <= universoMaximoJack) {
        jackCounts[jackNum] += 1;
        totalJackApariciones += 1;
      }
    }
  }

  // Construir arrays de resultado con frecuencia relativa
  const principal = principalCounts.map((apariciones, numero) => ({
    numero,
    apariciones,
    frecuenciaRelativa: totalPrincipalApariciones > 0 ? (apariciones / totalPrincipalApariciones) * 100 : 0
  }));

  const jack = jackCounts.map((apariciones, numero) => ({
    numero,
    apariciones,
    frecuenciaRelativa: totalJackApariciones > 0 ? (apariciones / totalJackApariciones) * 100 : 0
  }));

  // Ordenar por apariciones desc, luego número asc
  principal.sort((a, b) => b.apariciones - a.apariciones || a.numero - b.numero);
  jack.sort((a, b) => b.apariciones - a.apariciones || a.numero - b.numero);

  return { principal, jack };
}

// Ejemplo de invocación con los datos simulados
(function ejemploInvocacion() {
  try {
    // Definir universos: números 1-45 como Quini 6, Jack 0-9
    const universoMaximo = 45; // números del 1 al 45
    const universoMaximoJack = 9; // Jack del 0 al 9

    const resultado = calcularFrecuenciasLotoPlus(sorteosLotoPlusEjemplo, universoMaximo, universoMaximoJack);

    console.log('📊 Frecuencias Loto Plus - Números principales (1-45):');
    console.table(resultado.principal.slice(0, 10).map(r => ({ numero: String(r.numero).padStart(2,'0'), apariciones: r.apariciones, frecuencia: r.frecuenciaRelativa.toFixed(2) + '%' })));

    console.log('📊 Frecuencias Loto Plus - Números Jack (0-9):');
    console.table(resultado.jack.slice(0, 10).map(r => ({ numero: String(r.numero), apariciones: r.apariciones, frecuencia: r.frecuenciaRelativa.toFixed(2) + '%' })));
  } catch (err) {
    console.error('Error en ejemploInvocacion:', err.message);
  }
})();

// Exportar para uso modular (si se usa bundler o import dinámico)
if (typeof window !== 'undefined') {
  window.sorteosLotoPlusEjemplo = sorteosLotoPlusEjemplo;
  window.calcularFrecuenciasLotoPlus = calcularFrecuenciasLotoPlus;
}
