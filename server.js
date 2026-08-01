// ============= SIMULACIÓN DE ESTRATEGIAS =============
const getRandomNumbers = (cantidad, min, max) => {
    const nums = new Set();
    while (nums.size < cantidad) {
        nums.add(Math.floor(Math.random() * (max - min + 1)) + min);
    }
    return Array.from(nums);
};
// ...existing code...
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

function buildPremioExtra(primer, segunda, revancha) {
    return Array.from(new Set([...primer, ...segunda, ...revancha])).sort((a, b) => a - b);
}

function countHits(ticket, targetNumbers) {
    const targetSet = new Set(targetNumbers);
    return ticket.reduce((total, number) => total + (targetSet.has(number) ? 1 : 0), 0);
}

function fillTicket(primary, fallback, ticketSize = 6) {
    const ticket = [];

    [...primary, ...fallback].forEach(number => {
        if (!ticket.includes(number) && ticket.length < ticketSize) {
            ticket.push(number);
        }
    });

    return ticket.sort((a, b) => a - b);
}

function buildFrequentTicket(history, ticketSize = 6) {
    const frequencies = new Map();

    history.forEach(draw => {
        draw.premioExtra.forEach(number => {
            frequencies.set(number, (frequencies.get(number) || 0) + 1);
        });
    });

    return Array.from(frequencies.entries())
        .sort((a, b) => b[1] - a[1] || a[0] - b[0])
        .slice(0, ticketSize)
        .map(([number]) => number)
        .sort((a, b) => a - b);
}

function buildColdTicket(history, ticketSize = 6) {
    const lastSeen = new Map();

    for (let number = 0; number <= 45; number++) {
        lastSeen.set(number, -1);
    }

    history.forEach((draw, drawIndex) => {
        draw.premioExtra.forEach(number => {
            lastSeen.set(number, drawIndex);
        });
    });

    return Array.from(lastSeen.entries())
        .sort((a, b) => a[1] - b[1] || a[0] - b[0])
        .slice(0, ticketSize)
        .map(([number]) => number)
        .sort((a, b) => a - b);
}

function buildMixedTicket(history, ticketSize = 6) {
    const frequent = buildFrequentTicket(history, 12);
    const cold = buildColdTicket(history, 12);

    return fillTicket(
        [...frequent.slice(0, 3), ...cold.slice(0, 3)],
        [...frequent, ...cold],
        ticketSize
    );
}

function summarizeHits(name, hits, sampleTicket, extra = {}) {
    const total = hits.length;
    const countAtLeast = threshold => hits.filter(value => value >= threshold).length;
    const sum = hits.reduce((acc, value) => acc + value, 0);

    return {
        estrategia: name,
        sorteosEvaluados: total,
        promedioAciertos: total > 0 ? Number((sum / total).toFixed(2)) : 0,
        mejorAcierto: total > 0 ? Math.max(...hits) : 0,
        con1omas: countAtLeast(1),
        con2omas: countAtLeast(2),
        con3omas: countAtLeast(3),
        con4omas: countAtLeast(4),
        tasa1omas: total > 0 ? Number(((countAtLeast(1) / total) * 100).toFixed(1)) : 0,
        tasa2omas: total > 0 ? Number(((countAtLeast(2) / total) * 100).toFixed(1)) : 0,
        tasa3omas: total > 0 ? Number(((countAtLeast(3) / total) * 100).toFixed(1)) : 0,
        tasa4omas: total > 0 ? Number(((countAtLeast(4) / total) * 100).toFixed(1)) : 0,
        ticketMuestra: sampleTicket,
        ...extra
    };
}

function evaluatePremioExtraStrategy(draws, minHistory, name, buildTicket) {
    const hits = [];
    let sampleTicket = [];

    for (let index = minHistory; index < draws.length; index++) {
        const history = draws.slice(0, index);
        const ticket = buildTicket(history);

        if (ticket.length !== 6) {
            continue;
        }

        sampleTicket = ticket;
        hits.push(countHits(ticket, draws[index].premioExtra));
    }

    return summarizeHits(name, hits, sampleTicket);
}

function evaluateRandomPremioExtraBaseline(draws, minHistory, simulations = 120) {
    const hits = [];

    for (let simulation = 0; simulation < simulations; simulation++) {
        for (let index = minHistory; index < draws.length; index++) {
            hits.push(countHits(getRandomNumbers(6, 0, 45), draws[index].premioExtra));
        }
    }

    return summarizeHits('Azar', hits, [], { simulaciones: simulations });
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function average(values) {
    if (!values || values.length === 0) {
        return 0;
    }

    return values.reduce((total, value) => total + value, 0) / values.length;
}

function standardDeviation(values, mean) {
    if (!values || values.length === 0) {
        return 0;
    }

    const variance = values.reduce((total, value) => total + Math.pow(value - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
}

function rankLabel(score, delayRatio) {
    if (score >= 74 && delayRatio >= 0.95 && delayRatio <= 2.1) {
        return 'Muy firme';
    }

    if (score >= 64) {
        return 'Firme';
    }

    if (score >= 54) {
        return 'Equilibrado';
    }

    if (delayRatio > 1.6) {
        return 'Atrasado volatil';
    }

    return 'Secundario';
}

const DEFAULT_ANALYSIS_WEIGHTS = Object.freeze({
    frecuencia: 32,
    regularidad: 20,
    ventana: 23,
    atraso: 17,
    racha: 8,
    penalizacionReciente: 6
});

function resolveAnalysisWeights(customWeights = {}) {
    const merged = {
        ...DEFAULT_ANALYSIS_WEIGHTS,
        ...customWeights
    };

    return {
        frecuencia: Number(merged.frecuencia),
        regularidad: Number(merged.regularidad),
        ventana: Number(merged.ventana),
        atraso: Number(merged.atraso),
        racha: Number(merged.racha),
        penalizacionReciente: Number(merged.penalizacionReciente)
    };
}

function buildAdvancedAnalysis(draws, universeSize, gameLabel, options = {}) {
    const contests = draws.length;
    const rankingLimit = options.rankingLimit || 12;
    const weights = resolveAnalysisWeights(options.weights);

    if (contests === 0) {
        return {
            juego: gameLabel,
            totalSorteos: 0,
            promedioUnicos: 0,
            expectativa: {
                aparicionesEsperadas: 0,
                desvioConteo: 0,
                arrastreEsperado: 0
            },
            arrastre: {
                promedioObservado: 0,
                promedioEsperado: 0,
                maximaCoincidencia: null
            },
            pesos: weights,
            rankingCombinado: [],
            paresCalientes: [],
            reporte: ['Todavia no hay sorteos cargados para este analisis.']
        };
    }

    const presence = new Map();
    const intervals = new Map();
    const lastSeen = new Map();
    const activeStreak = new Map();
    const longestStreak = new Map();
    const pairCount = new Map();
    const currentGap = new Map();

    for (let number = 0; number <= universeSize; number++) {
        presence.set(number, 0);
        intervals.set(number, []);
        activeStreak.set(number, 0);
        longestStreak.set(number, 0);
        currentGap.set(number, contests);
    }

    let totalCarryOver = 0;
    let bestCarryOver = null;
    let previousNumbers = null;
    const uniqueCounts = [];

    draws.forEach((draw, index) => {
        const uniqueNumbers = Array.from(new Set(draw.numbers)).sort((a, b) => a - b);
        uniqueCounts.push(uniqueNumbers.length);

        uniqueNumbers.forEach(number => {
            presence.set(number, (presence.get(number) || 0) + 1);

            if (lastSeen.has(number)) {
                const gap = index - lastSeen.get(number);
                intervals.get(number).push(gap);
                activeStreak.set(number, gap === 1 ? activeStreak.get(number) + 1 : 1);
            } else {
                activeStreak.set(number, 1);
            }

            longestStreak.set(number, Math.max(longestStreak.get(number), activeStreak.get(number)));
            lastSeen.set(number, index);
            currentGap.set(number, contests - 1 - index);
        });

        for (let left = 0; left < uniqueNumbers.length; left++) {
            for (let right = left + 1; right < uniqueNumbers.length; right++) {
                const key = `${uniqueNumbers[left]}-${uniqueNumbers[right]}`;
                pairCount.set(key, (pairCount.get(key) || 0) + 1);
            }
        }

        if (previousNumbers) {
            const overlap = uniqueNumbers.filter(number => previousNumbers.has(number));
            totalCarryOver += overlap.length;

            if (!bestCarryOver || overlap.length > bestCarryOver.coincidencias) {
                bestCarryOver = {
                    coincidencias: overlap.length,
                    desdeConcurso: draws[index - 1].id,
                    hastaConcurso: draw.id,
                    desdeFecha: draws[index - 1].fecha,
                    hastaFecha: draw.fecha,
                    numeros: overlap
                };
            }
        }

        previousNumbers = new Set(uniqueNumbers);
    });

    const promedioUnicos = average(uniqueCounts);
    const probability = promedioUnicos / (universeSize + 1);
    const expectedCount = contests * probability;
    const countStdDev = Math.sqrt(contests * probability * (1 - probability)) || 1;
    const expectedCarryOver = (promedioUnicos * promedioUnicos) / (universeSize + 1);

    const ranking = [];
    for (let number = 0; number <= universeSize; number++) {
        const count = presence.get(number) || 0;
        if (count === 0) {
            continue;
        }

        const numberIntervals = intervals.get(number) || [];
        const avgGap = numberIntervals.length > 0 ? average(numberIntervals) : contests;
        const stdGap = numberIntervals.length > 0 ? standardDeviation(numberIntervals, avgGap) : contests;
        const regularity = avgGap > 0 ? stdGap / avgGap : 0;
        const delayRatio = avgGap > 0 ? currentGap.get(number) / avgGap : 0;
        const zScore = (count - expectedCount) / countStdDev;
        const frequencyScore = clamp((zScore + 2.5) / 5, 0, 1);
        const regularityScore = clamp(1 - (regularity / 1.25), 0, 1);
        const windowScore = numberIntervals.length > 0
            ? clamp(1 - (Math.abs(delayRatio - 1.1) / 1.1), 0, 1)
            : 0;
        const overdueScore = numberIntervals.length > 0
            ? clamp((delayRatio - 0.9) / 1.2, 0, 1)
            : 0;
        const freshnessPenalty = numberIntervals.length > 0
            ? clamp((0.55 - delayRatio) / 0.55, 0, 1)
            : 0;
        const streakScore = clamp(longestStreak.get(number) / 8, 0, 1);
        const weightedFrequency = frequencyScore * weights.frecuencia;
        const weightedRegularity = regularityScore * weights.regularidad;
        const weightedWindow = windowScore * weights.ventana;
        const weightedOverdue = overdueScore * weights.atraso;
        const weightedStreak = streakScore * weights.racha;
        const weightedPenalty = freshnessPenalty * weights.penalizacionReciente;
        const positiveWeightTotal = weights.frecuencia + weights.regularidad + weights.ventana + weights.atraso + weights.racha;
        const linearSignal = positiveWeightTotal > 0
            ? (weightedFrequency + weightedRegularity + weightedWindow + weightedOverdue + weightedStreak) / positiveWeightTotal
            : 0;
        const synergySignal = Math.sqrt(Math.max(windowScore, 0) * Math.max(overdueScore, 0));
        const stabilitySignal = Math.sqrt(Math.max(frequencyScore, 0) * Math.max(regularityScore, 0));
        const penaltySignal = Math.pow(Math.max(freshnessPenalty, 0), 1.15);
        const scoreSignal = clamp(
            (Math.pow(linearSignal, 1.18) * 0.72)
            + (stabilitySignal * 0.16)
            + (synergySignal * 0.12)
            - (penaltySignal * Math.min(0.24, weights.penalizacionReciente / (positiveWeightTotal + weights.penalizacionReciente || 1))),
            0,
            1
        );
        const score = scoreSignal * 100;

        ranking.push({
            numero: number,
            score: Number(score.toFixed(2)),
            etiqueta: rankLabel(score, delayRatio),
            frecuencia: count,
            frecuenciaPct: Number(((count / contests) * 100).toFixed(1)),
            zScore: Number(zScore.toFixed(2)),
            sorteosSinSalir: currentGap.get(number),
            intervaloPromedio: Number(avgGap.toFixed(2)),
            regularidad: Number(regularity.toFixed(2)),
            ratioVentana: Number(delayRatio.toFixed(2)),
            rachaMaxima: longestStreak.get(number),
            componentes: {
                frecuencia: Number(weightedFrequency.toFixed(2)),
                regularidad: Number(weightedRegularity.toFixed(2)),
                ventana: Number(weightedWindow.toFixed(2)),
                atraso: Number(weightedOverdue.toFixed(2)),
                racha: Number(weightedStreak.toFixed(2)),
                penalizacionReciente: Number(weightedPenalty.toFixed(2)),
                baseLineal: Number((linearSignal * 100).toFixed(2)),
                sinergia: Number((synergySignal * 100).toFixed(2)),
                estabilidad: Number((stabilitySignal * 100).toFixed(2))
            }
        });
    }

    ranking.sort((left, right) => right.score - left.score || right.zScore - left.zScore || left.numero - right.numero);

    const pairs = Array.from(pairCount.entries())
        .map(([key, count]) => {
            const [first, second] = key.split('-').map(Number);
            const lift = (count * contests) / ((presence.get(first) || 1) * (presence.get(second) || 1));

            return {
                par: key,
                apariciones: count,
                porcentaje: Number(((count / contests) * 100).toFixed(1)),
                lift: Number(lift.toFixed(2))
            };
        })
        .filter(item => item.apariciones >= Math.max(4, Math.floor(contests * 0.12)) && item.lift >= 1.05)
        .sort((left, right) => right.lift - left.lift || right.apariciones - left.apariciones)
        .slice(0, 8);

    const topRanking = ranking.slice(0, 6).map(item => `${item.numero.toString().padStart(2, '0')} (${item.score})`);
    const coldNow = ranking
        .slice()
        .sort((left, right) => right.sorteosSinSalir - left.sorteosSinSalir || left.numero - right.numero)
        .slice(0, 4)
        .map(item => `${item.numero.toString().padStart(2, '0')} (${item.sorteosSinSalir} sin salir)`);
    const topPairs = pairs.slice(0, 3).map(item => `${item.par} (${item.apariciones} veces, lift ${item.lift})`);
    const observedCarryOver = contests > 1 ? totalCarryOver / (contests - 1) : 0;

    return {
        juego: gameLabel,
        totalSorteos: contests,
        pesos: weights,
        promedioUnicos: Number(promedioUnicos.toFixed(2)),
        expectativa: {
            aparicionesEsperadas: Number(expectedCount.toFixed(2)),
            desvioConteo: Number(countStdDev.toFixed(2)),
            arrastreEsperado: Number(expectedCarryOver.toFixed(2))
        },
        arrastre: {
            promedioObservado: Number(observedCarryOver.toFixed(2)),
            promedioEsperado: Number(expectedCarryOver.toFixed(2)),
            maximaCoincidencia: bestCarryOver
        },
        rankingCombinado: ranking.slice(0, rankingLimit),
        paresCalientes: pairs,
        reporte: [
            `Ranking combinado sugerido: ${topRanking.join(', ')}.`,
            `Arrastre entre concursos: ${observedCarryOver.toFixed(2)} numeros repetidos en promedio frente a ${expectedCarryOver.toFixed(2)} esperados por base aleatoria.`,
            topPairs.length > 0
                ? `Pares con mejor convivencia relativa: ${topPairs.join(', ')}.`
                : 'No aparecieron pares con lift suficiente como para destacarlos sobre el ruido.',
            `Frio actual a vigilar: ${coldNow.join(', ')}.`,
            'Lectura corta: hay sesgos moderados y algunas parejas utiles, pero la repeticion entre concursos sigue bastante cerca de lo esperable por azar.'
        ]
    };
}

function buildRankingEvolution(draws, universeSize, gameLabel, options = {}) {
    const minHistory = options.minHistory || 12;
    const topSize = options.topSize || 3;

    if (draws.length < minHistory) {
        return {
            juego: gameLabel,
            totalSorteos: draws.length,
            minHistory,
            puntos: [],
            cambiosDeLider: 0,
            resumen: `Se necesitan al menos ${minHistory} sorteos para ver evolución temporal.`
        };
    }

    const puntos = [];
    let liderAnterior = null;
    let cambiosDeLider = 0;

    for (let index = minHistory; index <= draws.length; index++) {
        const slice = draws.slice(0, index);
        const analysis = buildAdvancedAnalysis(slice, universeSize, gameLabel, { rankingLimit: Math.max(topSize, 8) });
        const topActual = analysis.rankingCombinado.slice(0, topSize);
        const liderActual = topActual[0]?.numero ?? null;

        if (liderAnterior !== null && liderActual !== liderAnterior) {
            cambiosDeLider += 1;
        }

        liderAnterior = liderActual;
        puntos.push({
            sorteoId: slice[slice.length - 1].id,
            fecha: slice[slice.length - 1].fecha,
            top: topActual.map(item => ({
                numero: item.numero,
                score: item.score,
                etiqueta: item.etiqueta
            })),
            arrastre: analysis.arrastre.promedioObservado
        });
    }

    const ultimos = puntos.slice(-5).map(point => {
        const topTexto = point.top.map(item => `${item.numero.toString().padStart(2, '0')} (${item.score})`).join(', ');
        return `${point.fecha}: ${topTexto}`;
    });

    return {
        juego: gameLabel,
        totalSorteos: draws.length,
        minHistory,
        cambiosDeLider,
        puntos,
        resumen: `Hubo ${cambiosDeLider} cambios de lider desde la ventana ${minHistory}. Ultimos cortes: ${ultimos.join(' | ')}`
    };
}

function collectDraws(rows) {
    const grouped = new Map();

    rows.forEach(row => {
        if (!grouped.has(row.id)) {
            grouped.set(row.id, {
                id: row.id,
                fecha: row.fecha,
                numbers: []
            });
        }

        grouped.get(row.id).numbers.push(row.numero);
    });

    return Array.from(grouped.values());
}

function sortRankingByDelay(ranking) {
    return [...ranking].sort((left, right) => (right.componentes?.atraso || 0) - (left.componentes?.atraso || 0) || right.score - left.score);
}

function sortRankingByElite(ranking) {
    return [...ranking].sort((left, right) => (right.score + (right.componentes?.atraso || 0)) - (left.score + (left.componentes?.atraso || 0)));
}

function pairNumbersFromAnalysis(pair) {
    return pair ? pair.par.split('-').map(Number) : [];
}

function buildWalkForwardStrategyTickets(analysis) {
    const ranking = analysis.rankingCombinado || [];
    const elite = ranking.map(item => item.numero);
    const delayed = sortRankingByDelay(ranking).map(item => item.numero);
    const eliteExtended = sortRankingByElite(ranking).map(item => item.numero);
    const pairNumbers = (analysis.paresCalientes || []).flatMap(item => pairNumbersFromAnalysis(item));

    return [
        {
            key: 'ranking',
            estrategia: 'Ranking puro',
            descripcion: 'Top 6 del ranking combinado recalculado antes de cada sorteo.',
            ticket: fillTicket(elite.slice(0, 6), elite.slice(6), 6)
        },
        {
            key: 'atraso',
            estrategia: 'Atraso + ranking',
            descripcion: 'Números con atraso útil respaldados por score estable.',
            ticket: fillTicket(delayed.slice(0, 4), elite.slice(0, 10), 6)
        },
        {
            key: 'elite-pares',
            estrategia: 'Elite + pares',
            descripcion: 'Anclas elite mezcladas con los pares de mejor convivencia histórica.',
            ticket: fillTicket(pairNumbers.slice(0, 2), eliteExtended.slice(0, 10), 6)
        }
    ].filter(item => item.ticket.length === 6);
}

function summarizeSignal(name, hits, sampleSize) {
    const total = hits.length;
    const countAtLeast = threshold => hits.filter(value => value >= threshold).length;
    const sum = hits.reduce((acc, value) => acc + value, 0);

    return {
        senal: name,
        muestra: sampleSize,
        sorteosEvaluados: total,
        promedioAciertos: total > 0 ? Number((sum / total).toFixed(2)) : 0,
        tasa1omas: total > 0 ? Number(((countAtLeast(1) / total) * 100).toFixed(1)) : 0,
        tasa2omas: total > 0 ? Number(((countAtLeast(2) / total) * 100).toFixed(1)) : 0,
        tasa3omas: total > 0 ? Number(((countAtLeast(3) / total) * 100).toFixed(1)) : 0,
        mejorAcierto: total > 0 ? Math.max(...hits) : 0
    };
}

function buildWalkForwardBacktesting(draws, universeSize, gameLabel, options = {}) {
    const minHistory = Math.max(12, options.minHistory || 20);
    const randomSimulations = Math.max(40, options.randomSimulations || 120);
    const analysisOptions = options.analysisOptions || {};

    if (draws.length <= minHistory) {
        return {
            juego: gameLabel,
            error: `Se necesitan al menos ${minHistory + 1} sorteos válidos para ejecutar walk-forward.`,
            estrategias: [],
            senales: []
        };
    }

    const strategyStats = new Map();
    const signalTop6Hits = [];
    const signalTop12Hits = [];
    const top1Hits = [];
    const topPairHits = [];
    const randomHits = [];
    const cortesRecientes = [];

    for (let index = minHistory; index < draws.length; index++) {
        const history = draws.slice(0, index);
        const nextDraw = draws[index];
        const analysis = buildAdvancedAnalysis(history, universeSize, gameLabel, {
            rankingLimit: 12,
            ...analysisOptions
        });
        const targetNumbers = Array.from(new Set(nextDraw.numbers)).sort((left, right) => left - right);
        const strategyTickets = buildWalkForwardStrategyTickets(analysis);
        const top6 = (analysis.rankingCombinado || []).slice(0, 6).map(item => item.numero);
        const top12 = (analysis.rankingCombinado || []).slice(0, 12).map(item => item.numero);
        const topPair = pairNumbersFromAnalysis((analysis.paresCalientes || [])[0]);

        if (cortesRecientes.length < 6 || index >= draws.length - 4) {
            cortesRecientes.push({
                fecha: nextDraw.fecha,
                top6,
                aciertosTop6: countHits(top6, targetNumbers),
                objetivo: targetNumbers
            });
        }

        signalTop6Hits.push(countHits(top6, targetNumbers));
        signalTop12Hits.push(countHits(top12, targetNumbers));
        top1Hits.push(top6.length > 0 && targetNumbers.includes(top6[0]) ? 1 : 0);
        topPairHits.push(topPair.length === 2 && topPair.every(number => targetNumbers.includes(number)) ? 1 : 0);

        strategyTickets.forEach((strategy) => {
            if (!strategyStats.has(strategy.key)) {
                strategyStats.set(strategy.key, {
                    estrategia: strategy.estrategia,
                    descripcion: strategy.descripcion,
                    hits: [],
                    ticketMuestra: strategy.ticket
                });
            }

            const current = strategyStats.get(strategy.key);
            current.ticketMuestra = strategy.ticket;
            current.hits.push(countHits(strategy.ticket, targetNumbers));
        });

        for (let simulation = 0; simulation < randomSimulations; simulation++) {
            randomHits.push(countHits(getRandomNumbers(6, 0, universeSize), targetNumbers));
        }
    }

    const randomSummary = summarizeHits('Azar baseline', randomHits, [], { simulaciones: randomSimulations });
    const estrategias = Array.from(strategyStats.values())
        .map((strategy) => {
            const summary = summarizeHits(strategy.estrategia, strategy.hits, strategy.ticketMuestra, {
                descripcion: strategy.descripcion
            });

            return {
                ...summary,
                liftVsAzar: randomSummary.promedioAciertos > 0
                    ? Number((summary.promedioAciertos / randomSummary.promedioAciertos).toFixed(2))
                    : 0
            };
        })
        .sort((left, right) => right.tasa2omas - left.tasa2omas || right.promedioAciertos - left.promedioAciertos);

    const senales = [
        summarizeSignal('Cobertura top 6', signalTop6Hits, 6),
        summarizeSignal('Cobertura top 12', signalTop12Hits, 12),
        {
            senal: 'Líder del ranking',
            muestra: 1,
            sorteosEvaluados: top1Hits.length,
            tasaAparicion: top1Hits.length > 0 ? Number(((top1Hits.reduce((acc, value) => acc + value, 0) / top1Hits.length) * 100).toFixed(1)) : 0
        },
        {
            senal: 'Par más fuerte completo',
            muestra: 2,
            sorteosEvaluados: topPairHits.length,
            tasaAparicion: topPairHits.length > 0 ? Number(((topPairHits.reduce((acc, value) => acc + value, 0) / topPairHits.length) * 100).toFixed(1)) : 0
        }
    ];

    const analisisActual = buildAdvancedAnalysis(draws, universeSize, gameLabel, {
        rankingLimit: 12,
        ...analysisOptions
    });
    const sugerenciasActuales = buildWalkForwardStrategyTickets(analisisActual).map((strategy) => ({
        estrategia: strategy.estrategia,
        descripcion: strategy.descripcion,
        ticket: strategy.ticket
    }));

    return {
        juego: gameLabel,
        minHistory,
        totalSorteos: draws.length,
        pesos: analisisActual.pesos,
        sorteosEvaluados: draws.length - minHistory,
        estrategias: [...estrategias, randomSummary],
        senales,
        periodos: buildWalkForwardPeriods(draws, universeSize, gameLabel, options),
        sugerenciasActuales,
        cortesRecientes: cortesRecientes.slice(-4),
        nota: 'Walk-forward: cada corte recalcula las señales usando sólo historia previa y compara contra el sorteo siguiente real.'
    };
}

function buildWalkForwardPeriods(draws, universeSize, gameLabel, options = {}) {
    const minHistory = Math.max(12, options.minHistory || 20);
    const total = draws.length;

    if (total <= (minHistory + 6)) {
        return [];
    }

    const oneThird = Math.floor(total / 3);
    const slices = [
        {
            clave: 'inicio',
            etiqueta: 'Primer tramo',
            desde: 0,
            hasta: Math.max(oneThird, minHistory + 1)
        },
        {
            clave: 'medio',
            etiqueta: 'Tramo medio',
            desde: Math.max(0, oneThird - Math.floor(minHistory / 2)),
            hasta: Math.max((oneThird * 2), minHistory + 1)
        },
        {
            clave: 'reciente',
            etiqueta: 'Tramo reciente',
            desde: Math.max(0, total - Math.max(oneThird, minHistory + 1)),
            hasta: total
        }
    ];

    return slices
        .map((slice) => {
            const segmentDraws = draws.slice(slice.desde, slice.hasta);
            if (segmentDraws.length <= minHistory) {
                return null;
            }

            const result = buildWalkForwardBacktesting(segmentDraws, universeSize, gameLabel, options);
            const ranking = result.estrategias.find(item => item.estrategia === 'Ranking puro');
            const azar = result.estrategias.find(item => item.estrategia === 'Azar baseline');

            return {
                clave: slice.clave,
                etiqueta: slice.etiqueta,
                desde: segmentDraws[0]?.fecha,
                hasta: segmentDraws[segmentDraws.length - 1]?.fecha,
                totalSorteos: segmentDraws.length,
                sorteosEvaluados: result.sorteosEvaluados,
                rankingPuro: ranking,
                azar,
                liftVsAzar: ranking?.liftVsAzar || 0
            };
        })
        .filter(Boolean);
}

function scoreOptimizationResult(result) {
    const ranking = result.estrategias.find(item => item.estrategia === 'Ranking puro');
    const azar = result.estrategias.find(item => item.estrategia === 'Azar baseline');
    const promedio = ranking?.promedioAciertos || 0;
    const tasa2 = ranking?.tasa2omas || 0;
    const lift = azar && azar.promedioAciertos > 0 ? promedio / azar.promedioAciertos : 0;

    return Number((promedio * 100) + (tasa2 * 1.5) + (lift * 25));
}

function optimizeAnalysisWeights(draws, universeSize, gameLabel, options = {}) {
    const minHistory = Math.max(12, options.minHistory || 20);
    const randomSimulations = Math.max(40, options.randomSimulations || 120);
    const multipliers = options.multipliers || [0.8, 1, 1.2];
    const keys = ['frecuencia', 'regularidad', 'ventana', 'atraso', 'racha', 'penalizacionReciente'];
    const defaultWeights = resolveAnalysisWeights(options.baseWeights);
    let best = null;
    let tested = 0;

    const walk = (position, currentWeights) => {
        if (position === keys.length) {
            tested += 1;
            const result = buildWalkForwardBacktesting(draws, universeSize, gameLabel, {
                minHistory,
                randomSimulations,
                analysisOptions: {
                    weights: currentWeights
                }
            });

            if (result.error) {
                return;
            }

            const score = scoreOptimizationResult(result);
            if (!best || score > best.score) {
                best = {
                    score,
                    pesos: { ...currentWeights },
                    resultado: result
                };
            }
            return;
        }

        const key = keys[position];
        multipliers.forEach((multiplier) => {
            walk(position + 1, {
                ...currentWeights,
                [key]: Number((defaultWeights[key] * multiplier).toFixed(2))
            });
        });
    };

    const baseline = buildWalkForwardBacktesting(draws, universeSize, gameLabel, {
        minHistory,
        randomSimulations,
        analysisOptions: {
            weights: defaultWeights
        }
    });

    walk(0, {});

    const baselineRanking = baseline.estrategias.find(item => item.estrategia === 'Ranking puro');
    const bestRanking = best?.resultado?.estrategias.find(item => item.estrategia === 'Ranking puro');

    return {
        juego: gameLabel,
        minHistory,
        totalSorteos: draws.length,
        combinacionesProbadas: tested,
        baseline: {
            pesos: defaultWeights,
            rankingPuro: baselineRanking,
            resumen: baseline.nota
        },
        optimizado: best
            ? {
                pesos: best.pesos,
                rankingPuro: bestRanking,
                scoreOptimizacion: Number(best.score.toFixed(2)),
                resultadoCompleto: best.resultado
            }
            : null,
        mejora: baselineRanking && bestRanking
            ? {
                promedioAciertos: Number((bestRanking.promedioAciertos - baselineRanking.promedioAciertos).toFixed(2)),
                tasa2omas: Number((bestRanking.tasa2omas - baselineRanking.tasa2omas).toFixed(1)),
                liftVsAzar: Number(((bestRanking.liftVsAzar || 0) - (baselineRanking.liftVsAzar || 0)).toFixed(2))
            }
            : null,
        periodosBaseline: baseline.periodos || [],
        periodosOptimizados: best?.resultado?.periodos || []
    };
}

function applyMonotonicCalibration(rawBuckets, baselineProbability) {
    const blocks = [];

    rawBuckets.forEach((bucket) => {
        blocks.push({
            from: bucket.desde,
            to: bucket.hasta,
            totalWeight: bucket.observaciones,
            totalHits: bucket.aciertos,
            members: [bucket]
        });

        while (blocks.length > 1) {
            const current = blocks[blocks.length - 1];
            const previous = blocks[blocks.length - 2];
            const currentRate = current.totalHits / current.totalWeight;
            const previousRate = previous.totalHits / previous.totalWeight;

            if (currentRate >= previousRate) {
                break;
            }

            previous.to = current.to;
            previous.totalWeight += current.totalWeight;
            previous.totalHits += current.totalHits;
            previous.members = [...previous.members, ...current.members];
            blocks.pop();
        }
    });

    return blocks.flatMap((block) => {
        const adjustedRate = block.totalWeight > 0 ? block.totalHits / block.totalWeight : 0;
        return block.members.map((bucket) => ({
            ...bucket,
            probabilidadAjustada: Number((adjustedRate * 100).toFixed(2)),
            liftAjustado: baselineProbability > 0 ? Number((adjustedRate / baselineProbability).toFixed(2)) : 0
        }));
    });
}

function findCalibrationBucket(score, buckets = []) {
    if (!buckets || buckets.length === 0) {
        return null;
    }

    const direct = buckets.find((bucket) => score >= bucket.desde && score < bucket.hasta);
    if (direct) {
        return direct;
    }

    if (score < buckets[0].desde) {
        return buckets[0];
    }

    return buckets[buckets.length - 1];
}

function buildBucketsFromObservations(observations, bucketSize, baselineProbability, minimumObservations = 20) {
    const bucketStats = new Map();

    observations.forEach((observation) => {
        const bucketMin = Math.floor(observation.score / bucketSize) * bucketSize;
        const bucketKey = `${bucketMin}-${bucketMin + bucketSize}`;
        if (!bucketStats.has(bucketKey)) {
            bucketStats.set(bucketKey, {
                bucket: bucketKey,
                desde: bucketMin,
                hasta: bucketMin + bucketSize,
                observaciones: 0,
                aciertos: 0,
                scores: []
            });
        }

        const current = bucketStats.get(bucketKey);
        current.observaciones += 1;
        current.aciertos += observation.hit;
        current.scores.push(observation.score);
    });

    return Array.from(bucketStats.values())
        .map((bucket) => {
            const hitRate = bucket.observaciones > 0 ? bucket.aciertos / bucket.observaciones : 0;
            const scorePromedio = average(bucket.scores);

            return {
                bucket: bucket.bucket,
                desde: bucket.desde,
                hasta: bucket.hasta,
                observaciones: bucket.observaciones,
                aciertos: bucket.aciertos,
                scorePromedio: Number(scorePromedio.toFixed(2)),
                probabilidadEmpirica: Number((hitRate * 100).toFixed(2)),
                liftVsBase: baselineProbability > 0 ? Number((hitRate / baselineProbability).toFixed(2)) : 0
            };
        })
        .filter((bucket) => bucket.observaciones >= minimumObservations)
        .sort((left, right) => left.desde - right.desde);
}

function collectScoreObservations(draws, universeSize, gameLabel, options = {}) {
    const minHistory = Math.max(12, options.minHistory || 20);
    const analysisOptions = options.analysisOptions || {};

    if (draws.length <= minHistory) {
        return { observations: [], minHistory, totalEvaluated: 0 };
    }

    const observations = [];
    for (let index = minHistory; index < draws.length; index++) {
        const history = draws.slice(0, index);
        const nextDraw = draws[index];
        const analysis = buildAdvancedAnalysis(history, universeSize, gameLabel, {
            rankingLimit: universeSize + 1,
            ...analysisOptions
        });
        const target = new Set(nextDraw.numbers);

        (analysis.rankingCombinado || []).forEach((item) => {
            observations.push({
                drawIndex: index,
                fecha: nextDraw.fecha,
                numero: item.numero,
                score: item.score,
                hit: target.has(item.numero) ? 1 : 0
            });
        });
    }

    return {
        observations,
        minHistory,
        totalEvaluated: draws.length - minHistory
    };
}

function applyCalibrationToAnalysis(analysis, calibration) {
    if (!analysis || !analysis.rankingCombinado || !calibration || !calibration.buckets || calibration.buckets.length === 0) {
        return analysis;
    }

    const rankingCombinado = analysis.rankingCombinado
        .map((item) => {
            const bucket = findCalibrationBucket(item.score, calibration.buckets);
            return {
                ...item,
                bucketCalibrado: bucket?.bucket || 'sin bucket',
                probabilidadEmpirica: bucket?.probabilidadEmpirica || 0,
                probabilidadAjustada: bucket?.probabilidadAjustada || 0,
                liftAjustado: bucket?.liftAjustado || 0
            };
        })
        .sort((left, right) => (right.probabilidadAjustada || 0) - (left.probabilidadAjustada || 0) || right.score - left.score || right.zScore - left.zScore || left.numero - right.numero);

    return {
        ...analysis,
        rankingCombinado,
        calibracion: {
            split: calibration.split,
            monotonicViolations: calibration.monotonicViolations,
            baselineProbabilidad: calibration.baselineProbabilidad
        }
    };
}

function buildScoreCalibration(draws, universeSize, gameLabel, options = {}) {
    const minHistory = Math.max(12, options.minHistory || 20);
    const analysisOptions = options.analysisOptions || {};
    const bucketSize = Math.max(5, options.bucketSize || 5);
    const minimumObservations = Math.max(12, options.minimumObservations || 20);

    if (draws.length <= minHistory) {
        return {
            juego: gameLabel,
            error: `Se necesitan al menos ${minHistory + 1} sorteos válidos para calibrar el score.`,
            buckets: []
        };
    }

    const { observations, totalEvaluated } = collectScoreObservations(draws, universeSize, gameLabel, {
        minHistory,
        analysisOptions
    });
    const validationDraws = Math.min(
        Math.max(8, options.validationDraws || Math.ceil(totalEvaluated * 0.3)),
        Math.max(totalEvaluated - 6, 1)
    );
    const splitDrawIndex = draws.length - validationDraws;
    const baselineProbability = average(
        draws.slice(minHistory).map(draw => Array.from(new Set(draw.numbers)).length / (universeSize + 1))
    );
    const trainingObservations = observations.filter((observation) => observation.drawIndex < splitDrawIndex);
    const validationObservations = observations.filter((observation) => observation.drawIndex >= splitDrawIndex);
    const muestrasRecientes = [];

    for (let index = splitDrawIndex; index < draws.length; index++) {
        const history = draws.slice(0, index);
        const nextDraw = draws[index];
        const analysis = buildAdvancedAnalysis(history, universeSize, gameLabel, {
            rankingLimit: universeSize + 1,
            ...analysisOptions
        });
        const target = new Set(nextDraw.numbers);

        if (muestrasRecientes.length < 6 || index >= draws.length - 4) {
            muestrasRecientes.push({
                fecha: nextDraw.fecha,
                top: (analysis.rankingCombinado || []).slice(0, 6).map(item => ({
                    numero: item.numero,
                    score: item.score,
                    salio: target.has(item.numero)
                }))
            });
        }
    }

    const rawBuckets = buildBucketsFromObservations(trainingObservations, bucketSize, baselineProbability, minimumObservations);

    const monotonicBuckets = applyMonotonicCalibration(rawBuckets, baselineProbability)
        .sort((left, right) => left.desde - right.desde);

    const validationBuckets = buildBucketsFromObservations(validationObservations, bucketSize, baselineProbability, minimumObservations)
        .map((bucket) => {
            const adjusted = findCalibrationBucket(bucket.scorePromedio, monotonicBuckets);
            return {
                ...bucket,
                probabilidadAjustada: adjusted?.probabilidadAjustada || bucket.probabilidadEmpirica,
                liftAjustado: adjusted?.liftAjustado || bucket.liftVsBase
            };
        });

    const monotonicViolations = rawBuckets.reduce((total, bucket, index) => {
        if (index === 0) {
            return total;
        }

        return total + (bucket.probabilidadEmpirica < rawBuckets[index - 1].probabilidadEmpirica ? 1 : 0);
    }, 0);

    const currentAnalysis = buildAdvancedAnalysis(draws, universeSize, gameLabel, {
        rankingLimit: 12,
        ...analysisOptions
    });
    const candidatosActuales = (currentAnalysis.rankingCombinado || []).slice(0, 12).map((item) => {
        const bucket = monotonicBuckets.find((currentBucket) => item.score >= currentBucket.desde && item.score < currentBucket.hasta)
            || monotonicBuckets[monotonicBuckets.length - 1]
            || null;

        return {
            numero: item.numero,
            score: item.score,
            bucket: bucket?.bucket || 'sin bucket',
            probabilidadEmpirica: bucket?.probabilidadEmpirica || 0,
            probabilidadAjustada: bucket?.probabilidadAjustada || 0,
            liftAjustado: bucket?.liftAjustado || 0
        };
    });

    return {
        juego: gameLabel,
        minHistory,
        totalSorteos: draws.length,
        split: {
            entrenamiento: {
                sorteos: Math.max(splitDrawIndex - minHistory, 0),
                desde: draws[minHistory]?.fecha,
                hasta: draws[Math.max(splitDrawIndex - 1, minHistory)]?.fecha
            },
            validacion: {
                sorteos: validationDraws,
                desde: draws[splitDrawIndex]?.fecha,
                hasta: draws[draws.length - 1]?.fecha
            }
        },
        baselineProbabilidad: Number((baselineProbability * 100).toFixed(2)),
        buckets: monotonicBuckets,
        bucketsCrudos: rawBuckets,
        validationBuckets,
        monotonicViolations,
        candidatosActuales,
        muestrasRecientes: muestrasRecientes.slice(-4),
        nota: 'Probabilidad empírica: porcentaje real de aparición en el sorteo siguiente para números con score dentro de cada bucket. La probabilidad ajustada aplica suavizado monotónico para que el score no retroceda al subir.'
    };
}

// Middleware básico
app.use(express.json());

// 4.5 ACTUALIZAR QUINI 6
app.put('/sorteo/actualizar', async (req, res) => {
    try {
        const { concurso, fecha, primer, segunda, revancha, siempre, concursoOriginal, fechaOriginal } = req.body;
        console.log('📝 Actualizar Quini 6:', { concurso, fecha, concursoOriginal, fechaOriginal });
        // Validación
        if (!concurso || !fecha || !primer || !segunda || !revancha || !siempre) {
            return res.status(400).json({ error: 'Datos incompletos' });
        }
        // Si el concurso o fecha cambiaron, eliminar el sorteo anterior
        if (concursoOriginal && fechaOriginal && (concursoOriginal !== concurso || fechaOriginal !== fecha)) {
            await db.execute('DELETE FROM quini_sorteos WHERE id = ?', [concursoOriginal]);
        } else {
            // Si no cambiaron, solo eliminar los números del sorteo actual
            await db.execute('DELETE FROM quini_numeros WHERE sorteo_id = ?', [concurso]);
        }
        // Insertar/actualizar sorteo
        await db.execute('INSERT INTO quini_sorteos (id, fecha) VALUES (?, ?) ON DUPLICATE KEY UPDATE fecha = ?', [concurso, fecha, fecha]);
        // Insertar números
        const numerosInsert = [];
        const premioExtra = buildPremioExtra(primer, segunda, revancha);
        primer.forEach(n => numerosInsert.push([concurso, 'primer', n]));
        segunda.forEach(n => numerosInsert.push([concurso, 'segunda', n]));
        revancha.forEach(n => numerosInsert.push([concurso, 'revancha', n]));
        siempre.forEach(n => numerosInsert.push([concurso, 'siempre', n]));
        premioExtra.forEach(n => numerosInsert.push([concurso, 'premio_extra', n]));
        const values = numerosInsert.map(() => '(?, ?, ?)').join(', ');
        await db.execute(`INSERT INTO quini_numeros (sorteo_id, tipo, numero) VALUES ${values}`, numerosInsert.flat());
        res.json({ success: true, concurso, premioExtra });
    } catch (error) {
        console.error('Error actualizando sorteo Quini 6:', error);
        res.status(500).json({ error: 'Error actualizando sorteo Quini 6', details: error.message });
    }
});

app.use(express.static('simple-public'));

// Configuración MySQL simple
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'apostando_db'
};

// Conexión global
let db;


// ============= ENDPOINTS ESENCIALES =============

// Endpoint de simulación de estrategias (ahora correctamente ubicado)
app.get('/simulacion-estrategias', async (req, res) => {
    try {
        // --- QUINI 6 ---
        const [sorteosDB] = await db.execute('SELECT * FROM quini_sorteos ORDER BY fecha ASC');
        let sorteos = [];
        for (const s of sorteosDB) {
            const [nums] = await db.execute('SELECT numero FROM quini_numeros WHERE sorteo_id = ? AND tipo IN ("primer", "segunda", "revancha", "siempre")', [s.id]);
            sorteos.push(nums.map(n => n.numero));
        }
        // Frecuentes
        const freq = {};
        sorteos.flat().forEach(n => { freq[n] = (freq[n] || 0) + 1; });
        const topFrecuentes = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([n])=>parseInt(n));
        // Fríos
        const lastSeen = {};
        sorteos.forEach((nums, idx) => nums.forEach(n => lastSeen[n]=idx));
        const topFrios = Object.entries(lastSeen).sort((a,b)=>a[1]-b[1]).slice(0,6).map(([n])=>parseInt(n));
        // Simulación
        let aciertosFrecuentes = 0, aciertosFrios = 0, aciertosAzar = 0;
        sorteos.forEach(nums => {
            const azar = getRandomNumbers(6,0,45);
            aciertosFrecuentes += nums.filter(n=>topFrecuentes.includes(n)).length;
            aciertosFrios += nums.filter(n=>topFrios.includes(n)).length;
            aciertosAzar += nums.filter(n=>azar.includes(n)).length;
        });

        // --- LOTO PLUS ---
        const [sorteosLotoDB] = await db.execute('SELECT * FROM loto_plus_sorteos ORDER BY fecha ASC');
        let sorteosLoto = [];
        for (const s of sorteosLotoDB) {
            const [nums] = await db.execute('SELECT numero FROM loto_plus_numeros WHERE sorteo_id = ? AND tipo IN ("tradicional", "match", "desquite", "sale_o_sale")', [s.id]);
            sorteosLoto.push(nums.map(n => n.numero));
        }
        const freqLoto = {};
        sorteosLoto.flat().forEach(n => { freqLoto[n] = (freqLoto[n] || 0) + 1; });
        const topFrecuentesLoto = Object.entries(freqLoto).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([n])=>parseInt(n));
        const lastSeenLoto = {};
        sorteosLoto.forEach((nums, idx) => nums.forEach(n => lastSeenLoto[n]=idx));
        const topFriosLoto = Object.entries(lastSeenLoto).sort((a,b)=>a[1]-b[1]).slice(0,6).map(([n])=>parseInt(n));
        let aciertosFrecuentesLoto = 0, aciertosFriosLoto = 0, aciertosAzarLoto = 0;
        sorteosLoto.forEach(nums => {
            const azar = getRandomNumbers(6,0,45);
            aciertosFrecuentesLoto += nums.filter(n=>topFrecuentesLoto.includes(n)).length;
            aciertosFriosLoto += nums.filter(n=>topFriosLoto.includes(n)).length;
            aciertosAzarLoto += nums.filter(n=>azar.includes(n)).length;
        });

        res.json({
            quini6: {
                topFrecuentes, topFrios,
                aciertosFrecuentes, aciertosFrios, aciertosAzar,
                totalSorteos: sorteos.length
            },
            lotoPlus: {
                topFrecuentes: topFrecuentesLoto, topFrios: topFriosLoto,
                aciertosFrecuentes: aciertosFrecuentesLoto, aciertosFrios: aciertosFriosLoto, aciertosAzar: aciertosAzarLoto,
                totalSorteos: sorteosLoto.length
            }
        });
    } catch (error) {
        console.error('Error simulación estrategias:', error);
        res.status(500).json({ error: 'Error en simulación de estrategias', details: error.message });
    }
});

// ENDPOINT: Predicción Quini
app.get('/prediccion-quini', async (req, res) => {
    try {
        const [sorteos] = await db.execute(`
            SELECT s.id, s.fecha FROM quini_sorteos s ORDER BY s.fecha ASC
        `);
        
        if (sorteos.length < 10) {
            return res.json({ 
                error: 'Se necesitan al menos 10 sorteos para predicción',
                candidatos: []
            });
        }
        
        const totalSorteos = sorteos.length;
        const candidatos = [];
        
        for (let num = 0; num <= 45; num++) {
            const [apariciones] = await db.execute(`
                SELECT ROW_NUMBER() OVER (ORDER BY s.fecha ASC) as posicion
                FROM quini_sorteos s
                INNER JOIN quini_numeros n ON s.id = n.sorteo_id
                WHERE n.numero = ? AND n.tipo IN ('primer', 'segunda', 'revancha', 'siempre')
                ORDER BY s.fecha ASC
            `, [num]);
            
            if (apariciones.length === 0) continue;
            
            const intervalos = [];
            for (let i = 1; i < apariciones.length; i++) {
                intervalos.push(apariciones[i].posicion - apariciones[i-1].posicion);
            }
            
            if (intervalos.length === 0) continue;
            
            const intervaloPromedio = intervalos.reduce((a, b) => a + b, 0) / intervalos.length;
            const ultimaPosicion = apariciones[apariciones.length - 1].posicion;
            const sorteosSinSalir = totalSorteos - ultimaPosicion;
            const ratioRetraso = sorteosSinSalir / intervaloPromedio;
            
            // Calcular score predictivo (0-100)
            let score = 0;
            // Factor 1: Retraso (40 puntos máx) - Más retraso = más score
            score += Math.min(40, ratioRetraso * 20);
            // Factor 2: Frecuencia histórica (30 puntos máx) - Más apariciones = más score
            const frecuenciaRelativa = apariciones.length / totalSorteos;
            score += frecuenciaRelativa * 30;
            // Factor 3: Regularidad (30 puntos máx) - Menos variación = más score
            const varianza = intervalos.reduce((acc, val) => 
                acc + Math.pow(val - intervaloPromedio, 2), 0) / intervalos.length;
            const coeficienteVariacion = Math.sqrt(varianza) / intervaloPromedio;
            score += Math.max(0, 30 - (coeficienteVariacion * 15));
            candidatos.push({
                numero: num,
                scorePredictivo: Math.round(score * 100) / 100,
                sorteosSinSalir,
                intervaloPromedio: Math.round(intervaloPromedio * 100) / 100,
                vecesAparecio: apariciones.length,
                ratioRetraso: Math.round(ratioRetraso * 100) / 100
            });
        }
        // Ordenar por score predictivo
        candidatos.sort((a, b) => b.scorePredictivo - a.scorePredictivo);
        // Top 15 candidatos
        const topCandidatos = candidatos.slice(0, 15);
        res.json({
            candidatos: topCandidatos,
            totalSorteos,
            fechaPrediccion: new Date().toISOString(),
            nota: 'Score predictivo combina retraso, frecuencia histórica y regularidad'
        });
    } catch (error) {
        console.error('Error en predicción Quini:', error);
        res.status(500).json({ error: 'Error generando predicción' });
    }
});

// 1. GUARDAR SORTEO
app.post('/sorteo', async (req, res) => {
    try {
        console.log('📝 Datos recibidos:', JSON.stringify(req.body, null, 2));

        const { concurso, fecha, primer, segunda, revancha, siempre } = req.body;

        // Validación mínima
        const errores = [];
        if (!concurso) errores.push('Falta concurso');
        if (!fecha) errores.push('Falta fecha');
        if (!primer || !Array.isArray(primer) || primer.length !== 6) errores.push('Primera incorrecta');
        if (!segunda || !Array.isArray(segunda) || segunda.length !== 6) errores.push('Segunda incorrecta');
        if (!revancha || !Array.isArray(revancha) || revancha.length !== 6) errores.push('Revancha incorrecta');
        if (!siempre || !Array.isArray(siempre) || siempre.length !== 6) errores.push('Siempre Sale incorrecta');

        if (errores.length > 0) {
            console.log('❌ Errores:', errores);
            return res.status(400).json({ error: errores.join(', ') });
        }

        // Premio Extra automático: unión sin repetidos de Primera + Segunda + Revancha
        const premioExtra = buildPremioExtra(primer, segunda, revancha);

        // Insertar sorteo
        await db.execute('INSERT INTO quini_sorteos (id, fecha) VALUES (?, ?)', [concurso, fecha]);

        // Insertar números (batch simple)
        const numeros = [];
        primer.forEach(n => numeros.push([concurso, 'primer', n]));
        segunda.forEach(n => numeros.push([concurso, 'segunda', n]));
        revancha.forEach(n => numeros.push([concurso, 'revancha', n]));
        siempre.forEach(n => numeros.push([concurso, 'siempre', n]));
        premioExtra.forEach(n => numeros.push([concurso, 'premio_extra', n]));

        const values = numeros.map(() => '(?, ?, ?)').join(', ');
        await db.execute(`INSERT INTO quini_numeros (sorteo_id, tipo, numero) VALUES ${values}`, numeros.flat());

        res.json({ success: true, concurso, premioExtra });

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({
            error: 'Error guardando sorteo',
            details: error.sqlMessage || error.message
        });
    }
});

// 2. VER SORTEOS
app.get('/sorteos', async (req, res) => {
    try {
        const [sorteos] = await db.execute('SELECT * FROM quini_sorteos ORDER BY fecha DESC');

        // Obtener números para cada sorteo
        for (const sorteo of sorteos) {
            // Obtener todos los números incluyendo premio extra
            const [numeros] = await db.execute('SELECT numero, tipo FROM quini_numeros WHERE sorteo_id = ? ORDER BY id', [sorteo.id]);
            
            // Separar por tipo
            sorteo.primer = numeros.filter(n => n.tipo === 'primer').map(n => n.numero);
            sorteo.segunda = numeros.filter(n => n.tipo === 'segunda').map(n => n.numero);
            sorteo.revancha = numeros.filter(n => n.tipo === 'revancha').map(n => n.numero);
            sorteo.siempre = numeros.filter(n => n.tipo === 'siempre').map(n => n.numero);
            sorteo.premioExtra = buildPremioExtra(sorteo.primer, sorteo.segunda, sorteo.revancha);
            
            sorteo.numeros = numeros.map(n => n.numero);
            sorteo.concurso = sorteo.id;
        }

        res.json(sorteos);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error obteniendo sorteos' });
    }
});

// 3. FRECUENCIAS QUINI 6
app.get('/frecuencias', async (req, res) => {
    try {
        const [result] = await db.execute(`
            SELECT numero, COUNT(*) as frecuencia
            FROM quini_numeros 
            WHERE tipo IN ('primer', 'segunda', 'revancha', 'siempre')
            GROUP BY numero 
            ORDER BY frecuencia DESC, numero ASC
        `);
        res.json(result);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error calculando frecuencias' });
    }
});

// ============= LOTO PLUS ENDPOINTS =============

// ENDPOINT: Predicción Loto Plus
app.get('/prediccion-loto-plus', async (req, res) => {
    try {
        const [sorteos] = await db.execute(`
            SELECT s.id, s.fecha FROM loto_plus_sorteos s ORDER BY s.fecha ASC
        `);
        if (sorteos.length < 10) {
            return res.json({
                error: 'Se necesitan al menos 10 sorteos para predicción',
                candidatos: []
            });
        }
        const totalSorteos = sorteos.length;
        const candidatos = [];
        // Números principales (0-45)
        for (let num = 0; num <= 45; num++) {
            const [apariciones] = await db.execute(`
                SELECT ROW_NUMBER() OVER (ORDER BY s.fecha ASC) as posicion
                FROM loto_plus_sorteos s
                INNER JOIN loto_plus_numeros n ON s.id = n.sorteo_id
                WHERE n.numero = ? AND n.tipo IN ('tradicional', 'match', 'desquite', 'sale_o_sale')
                ORDER BY s.fecha ASC
            `, [num]);
            if (apariciones.length === 0) continue;
            const intervalos = [];
            for (let i = 1; i < apariciones.length; i++) {
                intervalos.push(apariciones[i].posicion - apariciones[i-1].posicion);
            }
            if (intervalos.length === 0) continue;
            const intervaloPromedio = intervalos.reduce((a, b) => a + b, 0) / intervalos.length;
            const ultimaPosicion = apariciones[apariciones.length - 1].posicion;
            const sorteosSinSalir = totalSorteos - ultimaPosicion;
            const ratioRetraso = sorteosSinSalir / intervaloPromedio;
            // Calcular score predictivo (0-100)
            let score = 0;
            // Factor 1: Retraso (40 puntos máx)
            score += Math.min(40, ratioRetraso * 20);
            // Factor 2: Frecuencia histórica (30 puntos máx)
            const frecuenciaRelativa = apariciones.length / totalSorteos;
            score += frecuenciaRelativa * 30;
            // Factor 3: Regularidad (30 puntos máx)
            const varianza = intervalos.reduce((acc, val) => acc + Math.pow(val - intervaloPromedio, 2), 0) / intervalos.length;
            const coeficienteVariacion = Math.sqrt(varianza) / intervaloPromedio;
            score += Math.max(0, 30 - (coeficienteVariacion * 15));
            candidatos.push({
                numero: num,
                scorePredictivo: Math.round(score * 100) / 100,
                sorteosSinSalir,
                intervaloPromedio: Math.round(intervaloPromedio * 100) / 100,
                vecesAparecio: apariciones.length,
                ratioRetraso: Math.round(ratioRetraso * 100) / 100
            });
        }
        // Ordenar por score predictivo
        candidatos.sort((a, b) => b.scorePredictivo - a.scorePredictivo);
        // Top 15 candidatos
        const topCandidatos = candidatos.slice(0, 15);

        // Predicción para Jack (0-9)
        const candidatosJack = [];
        for (let num = 0; num <= 9; num++) {
            const [apariciones] = await db.execute(`
                SELECT ROW_NUMBER() OVER (ORDER BY s.fecha ASC) as posicion
                FROM loto_plus_sorteos s
                INNER JOIN loto_plus_numeros n ON s.id = n.sorteo_id
                WHERE n.numero = ? AND n.tipo = 'jack'
                ORDER BY s.fecha ASC
            `, [num]);
            if (apariciones.length === 0) continue;
            const intervalos = [];
            for (let i = 1; i < apariciones.length; i++) {
                intervalos.push(apariciones[i].posicion - apariciones[i-1].posicion);
            }
            if (intervalos.length === 0) continue;
            const intervaloPromedio = intervalos.reduce((a, b) => a + b, 0) / intervalos.length;
            const ultimaPosicion = apariciones[apariciones.length - 1].posicion;
            const sorteosSinSalir = totalSorteos - ultimaPosicion;
            const ratioRetraso = sorteosSinSalir / intervaloPromedio;
            let score = 0;
            score += Math.min(40, ratioRetraso * 20);
            const frecuenciaRelativa = apariciones.length / totalSorteos;
            score += frecuenciaRelativa * 30;
            const varianza = intervalos.reduce((acc, val) => acc + Math.pow(val - intervaloPromedio, 2), 0) / intervalos.length;
            const coeficienteVariacion = Math.sqrt(varianza) / intervaloPromedio;
            score += Math.max(0, 30 - (coeficienteVariacion * 15));
            candidatosJack.push({
                numero: num,
                scorePredictivo: Math.round(score * 100) / 100,
                sorteosSinSalir,
                intervaloPromedio: Math.round(intervaloPromedio * 100) / 100,
                vecesAparecio: apariciones.length,
                ratioRetraso: Math.round(ratioRetraso * 100) / 100
            });
        }
        candidatosJack.sort((a, b) => b.scorePredictivo - a.scorePredictivo);
        const topCandidatosJack = candidatosJack.slice(0, 5);

        res.json({
            candidatos: topCandidatos,
            candidatosJack: topCandidatosJack,
            totalSorteos,
            fechaPrediccion: new Date().toISOString(),
            nota: 'Score predictivo combina retraso, frecuencia histórica y regularidad'
        });
    } catch (error) {
        console.error('Error en predicción Loto Plus:', error);
        res.status(500).json({ error: 'Error generando predicción Loto Plus' });
    }
});

app.get('/backtesting-premio-extra-quini', async (req, res) => {
    try {
        const minHistory = Math.max(10, Number.parseInt(req.query.minHistory, 10) || 20);
        const [sorteosDB] = await db.execute('SELECT id, fecha FROM quini_sorteos ORDER BY fecha ASC, id ASC');
        const sorteos = [];

        for (const sorteo of sorteosDB) {
            const [nums] = await db.execute(
                'SELECT numero, tipo FROM quini_numeros WHERE sorteo_id = ? AND tipo IN ("primer", "segunda", "revancha") ORDER BY id ASC',
                [sorteo.id]
            );

            const primer = nums.filter(item => item.tipo === 'primer').map(item => item.numero);
            const segunda = nums.filter(item => item.tipo === 'segunda').map(item => item.numero);
            const revancha = nums.filter(item => item.tipo === 'revancha').map(item => item.numero);
            const premioExtra = buildPremioExtra(primer, segunda, revancha);

            if (primer.length === 6 && segunda.length === 6 && revancha.length === 6 && premioExtra.length > 0) {
                sorteos.push({
                    id: sorteo.id,
                    fecha: sorteo.fecha,
                    premioExtra
                });
            }
        }

        if (sorteos.length <= minHistory) {
            return res.json({
                error: `Se necesitan al menos ${minHistory + 1} sorteos válidos para evaluar Premio Extra`,
                estrategias: []
            });
        }

        function evaluateCompletitud(draws, minHist, name, buildTicket) {
            const resultados = [];
            let sampleTicket = [];
            for (let index = minHist; index < draws.length; index++) {
                const history = draws.slice(0, index);
                const ticket = buildTicket(history);
                if (ticket.length !== 6) continue;
                sampleTicket = ticket;
                const tSet = new Set(ticket);
                const completo = ticket.every(n => draws[index].premioExtra.includes(n));
                resultados.push(completo);
            }
            const total = resultados.length;
            const completos = resultados.filter(r => r).length;
            return {
                estrategia: name,
                sorteosEvaluados: total,
                completos,
                tasaCompletitud: total > 0 ? Number((completos / total * 100).toFixed(2)) : 0,
                ticket: sampleTicket.sort((a, b) => a - b)
            };
        }

        const estrategias = [
            evaluateCompletitud(sorteos, minHistory, 'Frecuentes', history => buildFrequentTicket(history, 6)),
            evaluateCompletitud(sorteos, minHistory, 'Fríos', history => buildColdTicket(history, 6)),
            evaluateCompletitud(sorteos, minHistory, 'Mixta', history => buildMixedTicket(history, 6)),
            evaluateCompletitud(sorteos, minHistory, 'Azar', history => getRandomNumbers(6, 0, 45))
        ].sort((a, b) => b.tasaCompletitud - a.tasaCompletitud || b.completos - a.completos);

        const ultimoSorteo = sorteos[sorteos.length - 1];

        res.json({
            objetivo: 'Premio Extra de Quini 6 (unión de Primera + Segunda + Revancha)',
            minHistory,
            totalSorteos: sorteos.length,
            estrategias,
            ultimoSorteo: ultimoSorteo
                ? {
                    id: ultimoSorteo.id,
                    fecha: ultimoSorteo.fecha,
                    premioExtra: ultimoSorteo.premioExtra
                }
                : null,
            sugerenciasActuales: {
                frecuentes: buildFrequentTicket(sorteos, 6),
                frios: buildColdTicket(sorteos, 6),
                mixta: buildMixedTicket(sorteos, 6)
            },
            nota: 'Premio Extra se gana SOLO cuando los 6 números de tu ticket están TODOS en el pool (Primera+Segunda+Revancha). La tasa de completitud mide exactamente eso.'
        });
    } catch (error) {
        console.error('Error backtesting Premio Extra Quini:', error);
        res.status(500).json({ error: 'Error generando backtesting de Premio Extra', details: error.message });
    }
});

// 4. GUARDAR LOTO PLUS
app.post('/loto-plus', async (req, res) => {
    try {
        const { concurso, fecha, tradicional, match, desquite, saleOSale, numeroJack } = req.body;

        // Validación mínima
        if (!concurso || !fecha || !tradicional || !match || !desquite || !saleOSale || numeroJack === undefined) {
            return res.status(400).json({ error: 'Datos incompletos' });
        }

        // Crear registro simple en tabla temporal
        await db.execute('INSERT INTO loto_plus_sorteos (id, fecha) VALUES (?, ?) ON DUPLICATE KEY UPDATE fecha = ?', [concurso, fecha, fecha]);

        // Insertar números

        const numerosInsert = [];
        tradicional.forEach(n => numerosInsert.push([concurso, 'tradicional', n]));
        match.forEach(n => numerosInsert.push([concurso, 'match', n]));
        desquite.forEach(n => numerosInsert.push([concurso, 'desquite', n]));
        saleOSale.forEach(n => numerosInsert.push([concurso, 'sale_o_sale', n]));
        numerosInsert.push([concurso, 'jack', numeroJack]);

        // Limpiar números existentes del sorteo
        await db.execute('DELETE FROM loto_plus_numeros WHERE sorteo_id = ?', [concurso]);

        const values = numerosInsert.map(() => '(?, ?, ?)').join(', ');
        await db.execute(`INSERT INTO loto_plus_numeros (sorteo_id, tipo, numero) VALUES ${values}`, numerosInsert.flat());

        res.json({ success: true, concurso });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error guardando sorteo Loto Plus' });
    }
});

// 4.5 ACTUALIZAR LOTO PLUS
app.put('/loto-plus/actualizar', async (req, res) => {
    try {
        const { concurso, fecha, tradicional, match, desquite, saleOSale, numeroJack, concursoOriginal, fechaOriginal } = req.body;

        console.log('📝 Actualizar Loto Plus:', { concurso, fecha, concursoOriginal, fechaOriginal });

        // Validación
        if (!concurso || !fecha || !tradicional || !match || !desquite || !saleOSale || numeroJack === undefined) {
            return res.status(400).json({ error: 'Datos incompletos' });
        }

        // Si el concurso o fecha cambiaron, eliminar el sorteo anterior
        if (concursoOriginal && fechaOriginal && (concursoOriginal !== concurso || fechaOriginal !== fecha)) {
            await db.execute('DELETE FROM loto_plus_sorteos WHERE id = ?', [concursoOriginal]);
        } else {
            // Si no cambiaron, solo eliminar los números del sorteo actual
            await db.execute('DELETE FROM loto_plus_numeros WHERE sorteo_id = ?', [concurso]);
        }

        // Insertar/actualizar sorteo
        await db.execute('INSERT INTO loto_plus_sorteos (id, fecha) VALUES (?, ?) ON DUPLICATE KEY UPDATE fecha = ?', [concurso, fecha, fecha]);

        // Insertar números

        const numerosInsert = [];
        tradicional.forEach(n => numerosInsert.push([concurso, 'tradicional', n]));
        match.forEach(n => numerosInsert.push([concurso, 'match', n]));
        desquite.forEach(n => numerosInsert.push([concurso, 'desquite', n]));
        saleOSale.forEach(n => numerosInsert.push([concurso, 'sale_o_sale', n]));
        numerosInsert.push([concurso, 'jack', numeroJack]);

        const values = numerosInsert.map(() => '(?, ?, ?)').join(', ');
        await db.execute(`INSERT INTO loto_plus_numeros (sorteo_id, tipo, numero) VALUES ${values}`, numerosInsert.flat());

        res.json({ success: true, concurso });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error actualizando sorteo Loto Plus', details: error.message });
    }
});

// 5. FRECUENCIAS LOTO PLUS
app.get('/frecuencias-loto-plus', async (req, res) => {
    try {
        const [numeros] = await db.execute(`
            SELECT numero, COUNT(*) as frecuencia
            FROM loto_plus_numeros 
            WHERE tipo IN ('tradicional', 'match', 'desquite', 'sale_o_sale')
            GROUP BY numero 
            ORDER BY frecuencia DESC, numero ASC
        `);

        const [jacks] = await db.execute(`
            SELECT numero, COUNT(*) as frecuencia
            FROM loto_plus_numeros 
            WHERE tipo = 'jack'
            GROUP BY numero 
            ORDER BY frecuencia DESC, numero ASC
        `);

        res.json({ numeros, jacks });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error calculando frecuencias Loto Plus' });
    }
});

// 6. VER SORTEOS LOTO PLUS
app.get('/sorteos-loto-plus', async (req, res) => {
    try {
        const [sorteos] = await db.execute('SELECT * FROM loto_plus_sorteos ORDER BY fecha DESC');

        // Obtener números para cada sorteo
        for (const sorteo of sorteos) {
            const [numeros] = await db.execute('SELECT numero, tipo FROM loto_plus_numeros WHERE sorteo_id = ? ORDER BY id', [sorteo.id]);

            sorteo.tradicional = numeros.filter(n => n.tipo === 'tradicional').map(n => n.numero);
            sorteo.match = numeros.filter(n => n.tipo === 'match').map(n => n.numero);
            sorteo.desquite = numeros.filter(n => n.tipo === 'desquite').map(n => n.numero);
            sorteo.saleOSale = numeros.filter(n => n.tipo === 'sale_o_sale').map(n => n.numero);

            sorteo.numeros = numeros.map(n => n.numero);
            sorteo.concurso = sorteo.id;
        }

        res.json(sorteos);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error obteniendo sorteos Loto Plus' });
    }
});

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

app.get('/analisis-avanzado-quini', async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT s.id, DATE_FORMAT(s.fecha, '%Y-%m-%d') AS fecha, n.numero
            FROM quini_sorteos s
            INNER JOIN quini_numeros n ON n.sorteo_id = s.id
            WHERE n.tipo IN ('primer', 'segunda', 'revancha', 'siempre')
            ORDER BY s.fecha ASC, s.id ASC, n.id ASC
        `);
        const draws = collectDraws(rows);
        const analysis = buildAdvancedAnalysis(draws, 45, 'Quini 6');
        const calibration = buildScoreCalibration(draws, 45, 'Quini 6');

        res.json(applyCalibrationToAnalysis(analysis, calibration));
    } catch (error) {
        console.error('Error analisis avanzado Quini:', error);
        res.status(500).json({ error: 'Error generando analisis avanzado de Quini', details: error.message });
    }
});

app.get('/analisis-avanzado-loto-plus', async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT s.id, DATE_FORMAT(s.fecha, '%Y-%m-%d') AS fecha, n.numero
            FROM loto_plus_sorteos s
            INNER JOIN loto_plus_numeros n ON n.sorteo_id = s.id
            WHERE n.tipo IN ('tradicional', 'match', 'desquite', 'sale_o_sale')
            ORDER BY s.fecha ASC, s.id ASC, n.id ASC
        `);
        const draws = collectDraws(rows);
        const analysis = buildAdvancedAnalysis(draws, 45, 'Loto Plus');
        const calibration = buildScoreCalibration(draws, 45, 'Loto Plus');

        res.json(applyCalibrationToAnalysis(analysis, calibration));
    } catch (error) {
        console.error('Error analisis avanzado Loto Plus:', error);
        res.status(500).json({ error: 'Error generando analisis avanzado de Loto Plus', details: error.message });
    }
});

app.get('/evolucion-ranking-quini', async (req, res) => {
    try {
        const minHistory = Math.max(8, Number.parseInt(req.query.minHistory, 10) || 12);
        const [rows] = await db.execute(`
            SELECT s.id, DATE_FORMAT(s.fecha, '%Y-%m-%d') AS fecha, n.numero
            FROM quini_sorteos s
            INNER JOIN quini_numeros n ON n.sorteo_id = s.id
            WHERE n.tipo IN ('primer', 'segunda', 'revancha', 'siempre')
            ORDER BY s.fecha ASC, s.id ASC, n.id ASC
        `);

        res.json(buildRankingEvolution(collectDraws(rows), 45, 'Quini 6', { minHistory }));
    } catch (error) {
        console.error('Error evolucion ranking Quini:', error);
        res.status(500).json({ error: 'Error generando evolucion temporal de Quini', details: error.message });
    }
});

app.get('/evolucion-ranking-loto-plus', async (req, res) => {
    try {
        const minHistory = Math.max(8, Number.parseInt(req.query.minHistory, 10) || 12);
        const [rows] = await db.execute(`
            SELECT s.id, DATE_FORMAT(s.fecha, '%Y-%m-%d') AS fecha, n.numero
            FROM loto_plus_sorteos s
            INNER JOIN loto_plus_numeros n ON n.sorteo_id = s.id
            WHERE n.tipo IN ('tradicional', 'match', 'desquite', 'sale_o_sale')
            ORDER BY s.fecha ASC, s.id ASC, n.id ASC
        `);

        res.json(buildRankingEvolution(collectDraws(rows), 45, 'Loto Plus', { minHistory }));
    } catch (error) {
        console.error('Error evolucion ranking Loto Plus:', error);
        res.status(500).json({ error: 'Error generando evolucion temporal de Loto Plus', details: error.message });
    }
});

app.get('/backtesting-walkforward-quini', async (req, res) => {
    try {
        const minHistory = Math.max(12, Number.parseInt(req.query.minHistory, 10) || 20);
        const randomSimulations = Math.max(40, Number.parseInt(req.query.randomSimulations, 10) || 120);
        const [rows] = await db.execute(`
            SELECT s.id, DATE_FORMAT(s.fecha, '%Y-%m-%d') AS fecha, n.numero
            FROM quini_sorteos s
            INNER JOIN quini_numeros n ON n.sorteo_id = s.id
            WHERE n.tipo IN ('primer', 'segunda', 'revancha', 'siempre')
            ORDER BY s.fecha ASC, s.id ASC, n.id ASC
        `);

        res.json(buildWalkForwardBacktesting(collectDraws(rows), 45, 'Quini 6', { minHistory, randomSimulations }));
    } catch (error) {
        console.error('Error backtesting walk-forward Quini:', error);
        res.status(500).json({ error: 'Error generando backtesting walk-forward de Quini', details: error.message });
    }
});

app.get('/backtesting-walkforward-loto-plus', async (req, res) => {
    try {
        const minHistory = Math.max(12, Number.parseInt(req.query.minHistory, 10) || 20);
        const randomSimulations = Math.max(40, Number.parseInt(req.query.randomSimulations, 10) || 120);
        const [rows] = await db.execute(`
            SELECT s.id, DATE_FORMAT(s.fecha, '%Y-%m-%d') AS fecha, n.numero
            FROM loto_plus_sorteos s
            INNER JOIN loto_plus_numeros n ON n.sorteo_id = s.id
            WHERE n.tipo IN ('tradicional', 'match', 'desquite', 'sale_o_sale')
            ORDER BY s.fecha ASC, s.id ASC, n.id ASC
        `);

        res.json(buildWalkForwardBacktesting(collectDraws(rows), 45, 'Loto Plus', { minHistory, randomSimulations }));
    } catch (error) {
        console.error('Error backtesting walk-forward Loto Plus:', error);
        res.status(500).json({ error: 'Error generando backtesting walk-forward de Loto Plus', details: error.message });
    }
});

app.get('/optimizar-pesos-quini', async (req, res) => {
    try {
        const minHistory = Math.max(12, Number.parseInt(req.query.minHistory, 10) || 20);
        const randomSimulations = Math.max(40, Number.parseInt(req.query.randomSimulations, 10) || 120);
        const [rows] = await db.execute(`
            SELECT s.id, DATE_FORMAT(s.fecha, '%Y-%m-%d') AS fecha, n.numero
            FROM quini_sorteos s
            INNER JOIN quini_numeros n ON n.sorteo_id = s.id
            WHERE n.tipo IN ('primer', 'segunda', 'revancha', 'siempre')
            ORDER BY s.fecha ASC, s.id ASC, n.id ASC
        `);

        res.json(optimizeAnalysisWeights(collectDraws(rows), 45, 'Quini 6', { minHistory, randomSimulations }));
    } catch (error) {
        console.error('Error optimizando pesos Quini:', error);
        res.status(500).json({ error: 'Error optimizando pesos de Quini', details: error.message });
    }
});

app.get('/optimizar-pesos-loto-plus', async (req, res) => {
    try {
        const minHistory = Math.max(12, Number.parseInt(req.query.minHistory, 10) || 20);
        const randomSimulations = Math.max(40, Number.parseInt(req.query.randomSimulations, 10) || 120);
        const [rows] = await db.execute(`
            SELECT s.id, DATE_FORMAT(s.fecha, '%Y-%m-%d') AS fecha, n.numero
            FROM loto_plus_sorteos s
            INNER JOIN loto_plus_numeros n ON n.sorteo_id = s.id
            WHERE n.tipo IN ('tradicional', 'match', 'desquite', 'sale_o_sale')
            ORDER BY s.fecha ASC, s.id ASC, n.id ASC
        `);

        res.json(optimizeAnalysisWeights(collectDraws(rows), 45, 'Loto Plus', { minHistory, randomSimulations }));
    } catch (error) {
        console.error('Error optimizando pesos Loto Plus:', error);
        res.status(500).json({ error: 'Error optimizando pesos de Loto Plus', details: error.message });
    }
});

app.get('/calibracion-score-quini', async (req, res) => {
    try {
        const minHistory = Math.max(12, Number.parseInt(req.query.minHistory, 10) || 20);
        const bucketSize = Math.max(5, Number.parseInt(req.query.bucketSize, 10) || 5);
        const [rows] = await db.execute(`
            SELECT s.id, DATE_FORMAT(s.fecha, '%Y-%m-%d') AS fecha, n.numero
            FROM quini_sorteos s
            INNER JOIN quini_numeros n ON n.sorteo_id = s.id
            WHERE n.tipo IN ('primer', 'segunda', 'revancha', 'siempre')
            ORDER BY s.fecha ASC, s.id ASC, n.id ASC
        `);

        res.json(buildScoreCalibration(collectDraws(rows), 45, 'Quini 6', { minHistory, bucketSize }));
    } catch (error) {
        console.error('Error calibrando score Quini:', error);
        res.status(500).json({ error: 'Error calibrando score de Quini', details: error.message });
    }
});

app.get('/calibracion-score-loto-plus', async (req, res) => {
    try {
        const minHistory = Math.max(12, Number.parseInt(req.query.minHistory, 10) || 20);
        const bucketSize = Math.max(5, Number.parseInt(req.query.bucketSize, 10) || 5);
        const [rows] = await db.execute(`
            SELECT s.id, DATE_FORMAT(s.fecha, '%Y-%m-%d') AS fecha, n.numero
            FROM loto_plus_sorteos s
            INNER JOIN loto_plus_numeros n ON n.sorteo_id = s.id
            WHERE n.tipo IN ('tradicional', 'match', 'desquite', 'sale_o_sale')
            ORDER BY s.fecha ASC, s.id ASC, n.id ASC
        `);

        res.json(buildScoreCalibration(collectDraws(rows), 45, 'Loto Plus', { minHistory, bucketSize }));
    } catch (error) {
        console.error('Error calibrando score Loto Plus:', error);
        res.status(500).json({ error: 'Error calibrando score de Loto Plus', details: error.message });
    }
});

// ============= CADENAS DE MARKOV =============
app.get('/analisis-markov/:juego', async (req, res) => {
    try {
        const juego = req.params.juego;
        const tablaSorteos = juego === 'quini' ? 'quini_sorteos' : 'loto_plus_sorteos';
        const tablaNumeros = juego === 'quini' ? 'quini_numeros' : 'loto_plus_numeros';
        const tipos = juego === 'quini' ? ['primer', 'segunda', 'revancha', 'siempre'] : ['tradicional', 'match', 'desquite', 'sale_o_sale'];
        const tipoWhere = tipos.map(t => `'${t}'`).join(',');
        const [rows] = await db.execute(`SELECT n.sorteo_id AS id, n.numero, n.tipo, s.fecha FROM ${tablaNumeros} n INNER JOIN ${tablaSorteos} s ON n.sorteo_id = s.id WHERE n.tipo IN (${tipoWhere}) ORDER BY s.fecha ASC, n.tipo ASC`);
        const draws = collectDraws(rows);
        if (draws.length < 5) return res.json({ error: 'Se necesitan más sorteos', matriz: [], transiciones: [] });
        const size = 46;
        const matrix = Array.from({ length: size }, () => Array(size).fill(0));
        const count = Array(size).fill(0);
        for (let i = 1; i < draws.length; i++) {
            const prev = new Set(draws[i - 1].numbers);
            const curr = draws[i].numbers;
            for (const n of curr) {
                for (const p of prev) {
                    matrix[p][n]++;
                }
                count[n]++;
            }
        }
        const transitions = [];
        for (let from = 0; from < size; from++) {
            const row = matrix[from];
            const total = row.reduce((a, b) => a + b, 0);
            if (total === 0) continue;
            const top = row.map((v, to) => ({ from, to, prob: Number((v / total * 100).toFixed(1)), count: v }))
                .filter(x => x.count > 0)
                .sort((a, b) => b.prob - a.prob)
                .slice(0, 5);
            transitions.push({ numero: from, totalTransiciones: total, top });
        }
        transitions.sort((a, b) => b.totalTransiciones - a.totalTransiciones);
        const entrantes = [];
        for (let to = 0; to < size; to++) {
            const col = matrix.map(row => row[to]);
            const total = col.reduce((a, b) => a + b, 0);
            if (total === 0) continue;
            const top = col.map((v, from) => ({ from, to, prob: Number((v / total * 100).toFixed(1)), count: v }))
                .filter(x => x.count > 0)
                .sort((a, b) => b.prob - a.prob)
                .slice(0, 5);
            entrantes.push({ numero: to, totalEntradas: total, top });
        }
        entrantes.sort((a, b) => b.totalEntradas - a.totalEntradas);
        const sum = count.reduce((a, b) => a + b, 0);
        const selfTransitions = [];
        for (let n = 0; n < size; n++) {
            const probReal = count[n] / sum;
            selfTransitions.push({ numero: n, apariciones: count[n], probReal: Number((probReal * 100).toFixed(2)) });
        }
        selfTransitions.sort((a, b) => b.probReal - a.probReal);
        res.json({
            juego: juego === 'quini' ? 'Quini 6' : 'Loto Plus',
            sorteosAnalizados: draws.length,
            tamanioMatriz: size,
            matriz: matrix,
            transicionesSalientes: transitions.slice(0, 46),
            transicionesEntrantes: entrantes.slice(0, 46),
            probabilidadBase: selfTransitions.slice(0, 46),
            nota: 'Matriz de transición: probabilidad de que un número SALGA después de que otro haya salido en el sorteo anterior.'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============= MONTE CARLO =============
app.get('/simulacion-montecarlo/:juego', async (req, res) => {
    try {
        const juego = req.params.juego;
        const simulaciones = parseInt(req.query.n) || 500000;
        const tablaSorteos = juego === 'quini' ? 'quini_sorteos' : 'loto_plus_sorteos';
        const tablaNumeros = juego === 'quini' ? 'quini_numeros' : 'loto_plus_numeros';
        const tipos = juego === 'quini' ? ['primer', 'segunda', 'revancha', 'siempre'] : ['tradicional', 'match', 'desquite', 'sale_o_sale'];
        const tipoWhere = tipos.map(t => `'${t}'`).join(',');
        const [rows] = await db.execute(`SELECT n.sorteo_id AS id, n.numero, n.tipo FROM ${tablaNumeros} n INNER JOIN ${tablaSorteos} s ON n.sorteo_id = s.id WHERE n.tipo IN (${tipoWhere}) ORDER BY s.fecha ASC`);
        const draws = collectDraws(rows);
        if (draws.length < 5) return res.json({ error: 'Se necesitan más sorteos' });
        const freq = {};
        draws.flat().forEach(n => { freq[n] = (freq[n] || 0) + 1; });
        const weights = Array.from({ length: 46 }, (_, i) => freq[i] || 1);
        const weightedPick = () => {
            const total = weights.reduce((a, b) => a + b, 0);
            let r = Math.random() * total;
            for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; }
            return 45;
        };
        const hitDistribution = Array(7).fill(0);
        const coOccurrences = Array.from({ length: 46 }, () => Array(46).fill(0));
        const numberHits = Array(46).fill(0);
        for (let s = 0; s < simulaciones; s++) {
            const ticket = new Set();
            while (ticket.size < 6) ticket.add(weightedPick());
            const tArr = Array.from(ticket);
            for (let i = 0; i < tArr.length; i++) {
                for (let j = i + 1; j < tArr.length; j++) {
                    coOccurrences[tArr[i]][tArr[j]]++;
                    coOccurrences[tArr[j]][tArr[i]]++;
                }
                numberHits[tArr[i]]++;
            }
            let bestHits = 0;
            for (const draw of draws) {
                const h = tArr.filter(n => draw.numbers.includes(n)).length;
                if (h > bestHits) bestHits = h;
            }
            if (bestHits >= 0 && bestHits <= 6) hitDistribution[bestHits]++;
        }
        const topPairs = [];
        for (let i = 0; i < 46; i++) {
            for (let j = i + 1; j < 46; j++) {
                if (coOccurrences[i][j] > 0) topPairs.push({ par: `${i}-${j}`, coocurrencias: coOccurrences[i][j], prob: Number((coOccurrences[i][j] / simulaciones * 100).toFixed(2)) });
            }
        }
        topPairs.sort((a, b) => b.coocurrencias - a.coocurrencias).slice(0, 10);
        const frecuenciasSimuladas = numberHits.map((h, n) => ({ numero: n, aparicionesSimuladas: h, probSimulada: Number((h / simulaciones * 100).toFixed(2)) })).sort((a, b) => b.probSimulada - a.probSimulada);
        res.json({
            juego: juego === 'quini' ? 'Quini 6' : 'Loto Plus',
            simulaciones,
            sorteosHistoricos: draws.length,
            distribucionAciertos: hitDistribution.map((v, i) => ({ aciertos: i, veces: v, probabilidad: Number((v / simulaciones * 100).toFixed(4)) })),
            frecuenciasSimuladas: frecuenciasSimuladas.slice(0, 20),
            paresFrecuentesSimulados: topPairs.slice(0, 15),
            nota: `Simulación Monte Carlo de ${simulaciones.toLocaleString()} tickets generados con pesos históricos. Muestra distribución esperada de aciertos.`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============= CHI-CUADRADO =============
app.get('/sesgos-chi2/:juego', async (req, res) => {
    try {
        const juego = req.params.juego;
        const tablaSorteos = juego === 'quini' ? 'quini_sorteos' : 'loto_plus_sorteos';
        const tablaNumeros = juego === 'quini' ? 'quini_numeros' : 'loto_plus_numeros';
        const tipos = juego === 'quini' ? ['primer', 'segunda', 'revancha', 'siempre'] : ['tradicional', 'match', 'desquite', 'sale_o_sale'];
        const tipoWhere = tipos.map(t => `'${t}'`).join(',');
        const [sorteos] = await db.execute(`SELECT DISTINCT s.id FROM ${tablaSorteos} s INNER JOIN ${tablaNumeros} n ON s.id = n.sorteo_id WHERE n.tipo IN (${tipoWhere})`);
        const totalSorteos = sorteos.length;
        if (totalSorteos < 10) return res.json({ error: 'Se necesitan más sorteos' });
        const [rows] = await db.execute(`SELECT n.numero, COUNT(*) AS count FROM ${tablaNumeros} n INNER JOIN ${tablaSorteos} s ON n.sorteo_id = s.id WHERE n.tipo IN (${tipoWhere}) GROUP BY n.numero`);
        const totalApariciones = rows.reduce((sum, r) => sum + r.count, 0);
        const numerosPorSorteo = totalApariciones / totalSorteos;
        const expectedPerNumber = totalApariciones / 46;
        let chi2 = 0;
        const resultados = [];
        for (let n = 0; n < 46; n++) {
            const observed = rows.find(r => r.numero === n)?.count || 0;
            const diff = observed - expectedPerNumber;
            const contrib = (diff * diff) / expectedPerNumber;
            chi2 += contrib;
            const zScore = (observed - expectedPerNumber) / Math.sqrt(expectedPerNumber);
            resultados.push({
                numero: n,
                observado: observed,
                esperado: Number(expectedPerNumber.toFixed(1)),
                diferencia: Number(diff.toFixed(1)),
                contribucionChi2: Number(contrib.toFixed(2)),
                zScore: Number(zScore.toFixed(2)),
                sesgo: Math.abs(zScore) > 2 ? (zScore > 0 ? 'sobrerrepresentado' : 'subrrepresentado') : 'normal'
            });
        }
        resultados.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
        const df = 45;
        const significativo = chi2 > 67.5;
        const gradosLibertad = df;
        res.json({
            juego: juego === 'quini' ? 'Quini 6' : 'Loto Plus',
            totalSorteos,
            totalApariciones,
            promedioNumerosPorSorteo: Number(numerosPorSorteo.toFixed(2)),
            esperadoPorNumero: Number(expectedPerNumber.toFixed(1)),
            chi2: Number(chi2.toFixed(2)),
            gradosLibertad,
            significativo,
            interpretacion: significativo
                ? '⚠️ Los números muestran sesgos estadísticamente significativos (no se distribuyen uniformemente).'
                : '✅ Los números siguen una distribución compatible con el azar esperado.',
            rankingSesgos: resultados,
            nota: 'Test Chi-cuadrado: compara frecuencia observada vs esperada bajo distribución uniforme. |z|>2 sugiere sesgo individual.'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============= ENSEMBLE (FUSIÓN DE MODELOS) =============
app.get('/prediccion-ensemble/:juego', async (req, res) => {
    try {
        const juego = req.params.juego;
        const tablaSorteos = juego === 'quini' ? 'quini_sorteos' : 'loto_plus_sorteos';
        const tablaNumeros = juego === 'quini' ? 'quini_numeros' : 'loto_plus_numeros';
        const tipos = juego === 'quini' ? ['primer', 'segunda', 'revancha', 'siempre'] : ['tradicional', 'match', 'desquite', 'sale_o_sale'];
        const tipoWhere = tipos.map(t => `'${t}'`).join(',');
        const [rows] = await db.execute(`SELECT n.sorteo_id AS id, n.numero, n.tipo FROM ${tablaNumeros} n INNER JOIN ${tablaSorteos} s ON n.sorteo_id = s.id WHERE n.tipo IN (${tipoWhere}) ORDER BY s.fecha ASC`);
        const draws = collectDraws(rows);
        if (draws.length < 10) return res.json({ error: 'Se necesitan más sorteos' });
        const size = 46;
        // Modelo 1: Frecuencia
        const freq = Array(size).fill(0);
        draws.flat().forEach(n => freq[n]++);
        const maxFreq = Math.max(...freq);
        const scoreFreq = freq.map(f => maxFreq > 0 ? f / maxFreq : 0);
        // Modelo 2: Atraso (delay)
        const lastSeen = Array(size).fill(-1);
        draws.forEach((d, i) => { const uniq = new Set(d.numbers); uniq.forEach(n => lastSeen[n] = i); });
        const delay = lastSeen.map(ls => ls >= 0 ? draws.length - ls : draws.length);
        const maxDelay = Math.max(...delay);
        const scoreDelay = delay.map(d => d / maxDelay);
        // Modelo 3: Markov (puntaje de transición saliente)
        const markovScore = Array(size).fill(0);
        if (draws.length > 1) {
            const prev = new Set(draws[draws.length - 1].numbers);
            for (let n = 0; n < size; n++) {
                let count = 0;
                for (let i = 1; i < draws.length; i++) {
                    const p = new Set(draws[i - 1].numbers);
                    if (p.has(n) && draws[i].numbers.includes(n)) count++;
                }
                markovScore[n] = count;
            }
        }
        const maxMarkov = Math.max(...markovScore) || 1;
        const scoreMarkov = markovScore.map(m => m / maxMarkov);
        // Modelo 4: Regularidad (inverso del coeficiente de variación)
        const intervals = Array.from({ length: size }, () => []);
        const lastPos = Array(size).fill(-1);
        draws.forEach((d, i) => {
            const uniq = new Set(d.numbers);
            uniq.forEach(n => {
                if (lastPos[n] >= 0) intervals[n].push(i - lastPos[n]);
                lastPos[n] = i;
            });
        });
        const scoreRegularidad = intervals.map((arr, n) => {
            if (arr.length < 2) return 0;
            const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
            const std = Math.sqrt(arr.reduce((a, b) => a + (b - avg) ** 2, 0) / arr.length);
            const cv = avg > 0 ? std / avg : 1;
            return Math.max(0, 1 - cv);
        });
        // Ensemble: weighted average
        const pesos = { frecuencia: 0.25, atraso: 0.25, markov: 0.25, regularidad: 0.25 };
        const ensemble = Array.from({ length: size }, (_, i) => ({
            numero: i,
            scoreFrecuencia: Number((scoreFreq[i] * 100).toFixed(1)),
            scoreAtraso: Number((scoreDelay[i] * 100).toFixed(1)),
            scoreMarkov: Number((scoreMarkov[i] * 100).toFixed(1)),
            scoreRegularidad: Number((scoreRegularidad[i] * 100).toFixed(1)),
            scoreEnsemble: Number((
                scoreFreq[i] * pesos.frecuencia +
                scoreDelay[i] * pesos.atraso +
                scoreMarkov[i] * pesos.markov +
                scoreRegularidad[i] * pesos.regularidad
            ).toFixed(2))
        }));
        ensemble.sort((a, b) => b.scoreEnsemble - a.scoreEnsemble);
        const top6 = ensemble.slice(0, 6).map(e => e.numero);
        const cold = ensemble.slice().sort((a, b) => delay[a.numero] - delay[b.numero] || b.scoreEnsemble - a.scoreEnsemble).slice(0, 6).map(e => e.numero);
        res.json({
            juego: juego === 'quini' ? 'Quini 6' : 'Loto Plus',
            sorteosAnalizados: draws.length,
            pesos,
            rankingEnsemble: ensemble.slice(0, 20),
            ticketSugerido: top6.sort((a, b) => a - b),
            ticketFrio: cold.sort((a, b) => a - b),
            nota: 'Fusión de 4 modelos: frecuencia, atraso, markov (transición del último sorteo) y regularidad (consistencia de intervalos).'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============= CLUSTERING DE NÚMEROS =============
app.get('/clustering-numeros/:juego', async (req, res) => {
    try {
        const juego = req.params.juego;
        const tablaSorteos = juego === 'quini' ? 'quini_sorteos' : 'loto_plus_sorteos';
        const tablaNumeros = juego === 'quini' ? 'quini_numeros' : 'loto_plus_numeros';
        const tipos = juego === 'quini' ? ['primer', 'segunda', 'revancha', 'siempre'] : ['tradicional', 'match', 'desquite', 'sale_o_sale'];
        const tipoWhere = tipos.map(t => `'${t}'`).join(',');
        const [rows] = await db.execute(`SELECT n.sorteo_id AS id, n.numero, s.fecha ${tablaNumeros} n INNER JOIN ${tablaSorteos} s ON n.sorteo_id = s.id WHERE n.tipo IN (${tipoWhere}) ORDER BY s.fecha ASC`);
        const draws = collectDraws(rows);
        if (draws.length < 5) return res.json({ error: 'Se necesitan más sorteos' });
        const size = 46;
        const coMatrix = Array.from({ length: size }, () => Array(size).fill(0));
        draws.forEach(d => {
            const nums = [...new Set(d.numbers)];
            for (let i = 0; i < nums.length; i++) {
                for (let j = i + 1; j < nums.length; j++) {
                    coMatrix[nums[i]][nums[j]]++;
                    coMatrix[nums[j]][nums[i]]++;
                }
            }
        });
        const freq = Array(size).fill(0);
        draws.flat().forEach(n => freq[n]++);
        const jaccard = Array.from({ length: size }, () => Array(size).fill(0));
        for (let i = 0; i < size; i++) {
            for (let j = i + 1; j < size; j++) {
                const union = freq[i] + freq[j] - coMatrix[i][j];
                jaccard[i][j] = union > 0 ? coMatrix[i][j] / union : 0;
                jaccard[j][i] = jaccard[i][j];
            }
        }
        // Simple clustering: greedy agglomerative
        const clusters = [];
        const assigned = new Set();
        for (let seed = 0; seed < size; seed++) {
            if (assigned.has(seed)) continue;
            const cluster = [seed];
            assigned.add(seed);
            let candidates = Array.from({ length: size }, (_, i) => i).filter(i => !assigned.has(i));
            for (let round = 0; round < 3 && candidates.length > 0; round++) {
                let best = -1, bestSim = 0;
                for (const c of candidates) {
                    const sim = cluster.reduce((sum, m) => sum + jaccard[m][c], 0) / cluster.length;
                    if (sim > bestSim) { bestSim = sim; best = c; }
                }
                if (best >= 0 && bestSim > 0.03) {
                    cluster.push(best);
                    assigned.add(best);
                    candidates = candidates.filter(c => c !== best);
                }
            }
            if (cluster.length >= 2) {
                const pairs = [];
                for (let i = 0; i < cluster.length; i++) {
                    for (let j = i + 1; j < cluster.length; j++) {
                        pairs.push({ par: `${cluster[i]}-${cluster[j]}`, coocurrencias: coMatrix[cluster[i]][cluster[j]], similitud: Number((jaccard[cluster[i]][cluster[j]] * 100).toFixed(1)) });
                    }
                }
                pairs.sort((a, b) => b.coocurrencias - a.coocurrencias);
                clusters.push({
                    cluster: cluster.sort((a, b) => a - b),
                    tamanio: cluster.length,
                    paresInternos: pairs.slice(0, 6),
                    cohesion: Number((pairs.reduce((s, p) => s + p.similitud, 0) / pairs.length).toFixed(1))
                });
            }
        }
        clusters.sort((a, b) => b.cohesion - a.cohesion);
        const topPairs = [];
        for (let i = 0; i < size; i++) {
            for (let j = i + 1; j < size; j++) {
                if (coMatrix[i][j] >= 3) topPairs.push({ par: `${i}-${j}`, coocurrencias: coMatrix[i][j], similitud: Number((jaccard[i][j] * 100).toFixed(1)) });
            }
        }
        topPairs.sort((a, b) => b.coocurrencias - a.coocurrencias || b.similitud - a.similitud);
        res.json({
            juego: juego === 'quini' ? 'Quini 6' : 'Loto Plus',
            sorteosAnalizados: draws.length,
            clusters: clusters.slice(0, 8),
            paresDestacados: topPairs.slice(0, 20),
            nota: 'Clustering por similitud de Jaccard: agrupa números que aparecen juntos más de lo esperado. Cohesión = promedio de similitud dentro del cluster.'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============= COBERTURA ÓPTIMA =============
app.get('/cobertura-optima/:juego', async (req, res) => {
    try {
        const juego = req.params.juego;
        const presupuesto = parseInt(req.query.tickets) || 5;
        const tablaSorteos = juego === 'quini' ? 'quini_sorteos' : 'loto_plus_sorteos';
        const tablaNumeros = juego === 'quini' ? 'quini_numeros' : 'loto_plus_numeros';
        const tipos = juego === 'quini' ? ['primer', 'segunda', 'revancha', 'siempre'] : ['tradicional', 'match', 'desquite', 'sale_o_sale'];
        const tipoWhere = tipos.map(t => `'${t}'`).join(',');
        const [rows] = await db.execute(`SELECT n.sorteo_id AS id, n.numero, s.fecha ${tablaNumeros} n INNER JOIN ${tablaSorteos} s ON n.sorteo_id = s.id WHERE n.tipo IN (${tipoWhere}) ORDER BY s.fecha ASC`);
        const draws = collectDraws(rows);
        if (draws.length < 10) return res.json({ error: 'Se necesitan más sorteos' });
        const size = 46;
        const freq = Array(size).fill(0);
        draws.flat().forEach(n => freq[n]++);
        const ranked = freq.map((f, n) => ({ numero: n, frecuencia: f })).sort((a, b) => b.frecuencia - a.frecuencia);
        const topNumbers = ranked.slice(0, Math.min(presupuesto * 6, 46)).map(r => r.numero);
        // Greedy coverage: pick combinations that maximize coverage of top numbers
        const tickets = [];
        const covered = new Set();
        for (let t = 0; t < presupuesto; t++) {
            const available = topNumbers.filter(n => !covered.has(n));
            if (available.length <= 6) {
                const ticket = available.slice(0, 6).sort((a, b) => a - b);
                if (ticket.length === 6) tickets.push(ticket);
                available.forEach(n => covered.add(n));
                break;
            }
            const ticket = [];
            const pool = [...available];
            for (let i = 0; i < 6 && pool.length > 0; i++) {
                const pick = pool.shift();
                ticket.push(pick);
                covered.add(pick);
            }
            ticket.sort((a, b) => a - b);
            tickets.push(ticket);
        }
        // Historical coverage simulation
        const historialCobertura = draws.slice(-20).map(d => {
            const nums = [...new Set(d.numbers)];
            const aciertos = tickets.map(t => t.filter(n => nums.includes(n)).length);
            const mejor = Math.max(...aciertos, 0);
            return { fecha: d.fecha, sorteo: d.id, aciertos, mejor };
        });
        const totalAciertos = historialCobertura.reduce((s, h) => s + h.mejor, 0);
        res.json({
            juego: juego === 'quini' ? 'Quini 6' : 'Loto Plus',
            presupuestoTickets: presupuesto,
            numerosEnCobertura: topNumbers.length,
            ticketsSugeridos: tickets,
            simulacionHistorial: historialCobertura,
            resumen: {
                promedioMejorAcierto: Number((totalAciertos / historialCobertura.length).toFixed(2)),
                totalSorteosSimulados: historialCobertura.length,
                coberturaUnicos: covered.size
            },
            nota: `Estrategia de cobertura con ${presupuesto} ticket(s). Maximiza cobertura de los números más frecuentes usando selección greedy.`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============= PREDICCIÓN COMBINADA (MASTER ENSEMBLE) =============
app.get('/prediccion-combinada/:juego', async (req, res) => {
    try {
        const juego = req.params.juego;
        const tablaSorteos = juego === 'quini' ? 'quini_sorteos' : 'loto_plus_sorteos';
        const tablaNumeros = juego === 'quini' ? 'quini_numeros' : 'loto_plus_numeros';
        const tipos = juego === 'quini' ? ['primer', 'segunda', 'revancha', 'siempre'] : ['tradicional', 'match', 'desquite', 'sale_o_sale'];
        const tipoWhere = tipos.map(t => `'${t}'`).join(',');
        const [rows] = await db.execute(`SELECT n.sorteo_id AS id, n.numero, s.fecha FROM ${tablaNumeros} n INNER JOIN ${tablaSorteos} s ON n.sorteo_id = s.id WHERE n.tipo IN (${tipoWhere}) ORDER BY s.fecha ASC`);
        const draws = collectDraws(rows);
        if (draws.length < 10) return res.json({ error: 'Se necesitan más sorteos' });
        const size = 46;
        const total = draws.length;

        // ---- 1. Frecuencia ----
        const freq = Array(size).fill(0);
        draws.forEach(d => d.numbers.forEach(n => freq[n]++));
        const maxFreq = Math.max(...freq);

        // ---- 2. Atraso (delay) ----
        const lastSeen = Array(size).fill(-1);
        draws.forEach((d, i) => { const uniq = new Set(d.numbers); uniq.forEach(n => lastSeen[n] = i); });
        const delay = lastSeen.map(ls => ls >= 0 ? total - ls : total);
        const maxDelay = Math.max(...delay);

        // ---- 3. Markov ----
        const markovScore = Array(size).fill(0);
        if (draws.length > 1) {
            for (let n = 0; n < size; n++) {
                let count = 0;
                for (let i = 1; i < draws.length; i++) {
                    const p = new Set(draws[i - 1].numbers);
                    if (p.has(n) && draws[i].numbers.includes(n)) count++;
                }
                markovScore[n] = count;
            }
        }
        const maxMarkov = Math.max(...markovScore) || 1;

        // ---- 4. Monte Carlo probabilities ----
        const weights = freq.map(f => f || 1);
        const mcProb = Array(size).fill(0);
        for (let s = 0; s < 50000; s++) {
            const ticket = new Set();
            while (ticket.size < 6) {
                const totalW = weights.reduce((a, b) => a + b, 0);
                let r = Math.random() * totalW;
                for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) { ticket.add(i); break; } }
            }
            for (const n of ticket) mcProb[n]++;
        }

        // ---- 5. Chi-square z-scores ----
        const totalApariciones = freq.reduce((a, b) => a + b, 0);
        const expectedPerNumber = totalApariciones / size;
        const zScores = freq.map(f => (f - expectedPerNumber) / Math.sqrt(expectedPerNumber));

        // ---- 6. Regularidad ----
        const intervals = Array.from({ length: size }, () => []);
        const lastPos = Array(size).fill(-1);
        draws.forEach((d, i) => {
            const uniq = new Set(d.numbers);
            uniq.forEach(n => {
                if (lastPos[n] >= 0) intervals[n].push(i - lastPos[n]);
                lastPos[n] = i;
            });
        });
        const scoreRegularidad = intervals.map(arr => {
            if (arr.length < 2) return 0;
            const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
            const std = Math.sqrt(arr.reduce((a, b) => a + (b - avg) ** 2, 0) / arr.length);
            const cv = avg > 0 ? std / avg : 1;
            return Math.max(0, 1 - cv);
        });

        // ---- 7. Co-ocurrencia (pairs) ----
        const coMatrix = Array.from({ length: size }, () => Array(size).fill(0));
        draws.forEach(d => {
            const nums = [...new Set(d.numbers)];
            for (let i = 0; i < nums.length; i++)
                for (let j = i + 1; j < nums.length; j++) {
                    coMatrix[nums[i]][nums[j]]++;
                    coMatrix[nums[j]][nums[i]]++;
                }
        });

        // ---- 8. NPMI (entrelazamiento cuántico) ----
        const pairMap = {};
        for (let i = 0; i < size; i++)
            for (let j = i + 1; j < size; j++)
                if (coMatrix[i][j] > 0) {
                    const fi = freq[i] || 1;
                    const fj = freq[j] || 1;
                    const cooc = coMatrix[i][j];
                    const pmi = Math.log((cooc / total) / ((fi / total) * (fj / total)));
                    const npmi = pmi / (-Math.log(cooc / total) || 1);
                    pairMap[`${i}_${j}`] = Math.max(0, Math.min(1, npmi));
                }

        // ---- Normalize all scores to 0-100 ----
        const normFreq = freq.map(f => maxFreq > 0 ? (f / maxFreq * 100) : 0);
        const normDelay = delay.map(d => maxDelay > 0 ? (d / maxDelay * 100) : 0);
        const normMarkov = markovScore.map(m => maxMarkov > 0 ? (m / maxMarkov * 100) : 0);
        const normMC = mcProb.map(m => Math.max(...mcProb) > 0 ? (m / Math.max(...mcProb) * 100) : 0);
        const normChi = zScores.map(z => Math.min(100, Math.abs(z) * 25));
        const normReg = scoreRegularidad.map(r => r * 100);

        // ---- Combined score per number ----
        const scores = Array.from({ length: size }, (_, n) => ({
            numero: n,
            frecuencia: Number(normFreq[n].toFixed(1)),
            atraso: Number(normDelay[n].toFixed(1)),
            markov: Number(normMarkov[n].toFixed(1)),
            monteCarlo: Number(normMC[n].toFixed(1)),
            chi2: Number(normChi[n].toFixed(1)),
            regularidad: Number(normReg[n].toFixed(1)),
            scoreTotal: Number((
                normFreq[n] * 0.20 +
                normDelay[n] * 0.15 +
                normMarkov[n] * 0.10 +
                normMC[n] * 0.20 +
                normChi[n] * 0.10 +
                normReg[n] * 0.10 +
                (pairMap[`${n}_${n}`] !== undefined ? 0 : 0)
            ).toFixed(2))
        }));

        // Add pair bonus
        for (const s of scores) {
            let pairBonus = 0;
            let pairCount = 0;
            for (let j = 0; j < size; j++) {
                if (j === s.numero) continue;
                const key = s.numero < j ? `${s.numero}_${j}` : `${j}_${s.numero}`;
                if (pairMap[key]) {
                    pairBonus += pairMap[key];
                    pairCount++;
                }
            }
            const avgPair = pairCount > 0 ? (pairBonus / pairCount) : 0;
            s.scoreTotal = Number((s.scoreTotal * 0.85 + avgPair * 15).toFixed(2));
            s.entrelazamiento = Number((avgPair * 100).toFixed(1));
        }

        scores.sort((a, b) => b.scoreTotal - a.scoreTotal);

        // ---- Generate 3+ diverse betting strategies ----

        // Strategy 1: Top-score (highest combined probability)
        const opcion1 = scores.slice(0, 6).map(s => s.numero).sort((a, b) => a - b);

        // Strategy 2: Balanced (mix of top frecuencia + top delay)
        const byFreq = [...scores].sort((a, b) => b.frecuencia - a.frecuencia).slice(0, 8);
        const byDelay = [...scores].sort((a, b) => b.atraso - a.atraso).slice(0, 8);
        const pool2 = new Set();
        for (const s of byFreq) pool2.add(s.numero);
        for (const s of byDelay) pool2.add(s.numero);
        const opcion2 = Array.from(pool2).slice(0, 6).sort((a, b) => a - b);
        if (opcion2.length < 6) {
            for (const s of scores) { if (!opcion2.includes(s.numero)) opcion2.push(s.numero); if (opcion2.length >= 6) break; }
        }

        // Strategy 3: High-risk (highest entrelazamiento + high delay + lowest frequency)
        const byEntrelazamiento = [...scores].sort((a, b) => b.entrelazamiento - a.entrelazamiento).slice(0, 6);
        const pool3 = new Set(byEntrelazamiento.map(s => s.numero));
        const lowFreq = [...scores].sort((a, b) => a.frecuencia - b.frecuencia).slice(0, 6);
        for (const s of lowFreq) pool3.add(s.numero);
        const opcion3 = Array.from(pool3).slice(0, 6).sort((a, b) => a - b);
        if (opcion3.length < 6) {
            for (const s of scores) { if (!opcion3.includes(s.numero)) opcion3.push(s.numero); if (opcion3.length >= 6) break; }
        }

        // Strategy 4: Cluster-based (pick numbers from top clusters)
        const clusterTickets = [];
        const assigned = new Set();
        for (let seed = 0; seed < size && clusterTickets.length < 2; seed++) {
            if (assigned.has(seed)) continue;
            const cluster = [seed];
            assigned.add(seed);
            let candidates = Array.from({ length: size }, (_, i) => i).filter(i => !assigned.has(i));
            for (let round = 0; round < 3 && candidates.length > 0; round++) {
                let best = -1, bestSim = 0;
                for (const c of candidates) {
                    let sim = 0, cnt = 0;
                    for (const m of cluster) {
                        const key = m < c ? `${m}_${c}` : `${c}_${m}`;
                        if (pairMap[key]) { sim += pairMap[key]; cnt++; }
                    }
                    const avg = cnt > 0 ? sim / cnt : 0;
                    if (avg > bestSim) { bestSim = avg; best = c; }
                }
                if (best >= 0 && bestSim > 0.05) {
                    cluster.push(best);
                    assigned.add(best);
                    candidates = candidates.filter(c => c !== best);
                }
            }
            if (cluster.length >= 4) {
                const ordered = cluster.sort((a, b) => scores.find(s => s.numero === b)?.scoreTotal || 0 - scores.find(s => s.numero === a)?.scoreTotal || 0);
                const ticket = ordered.slice(0, 6);
                if (ticket.length === 6) clusterTickets.push(ticket.sort((a, b) => a - b));
            }
        }
        let opcion4 = null;
        if (clusterTickets.length > 0) {
            opcion4 = clusterTickets[0];
        } else {
            const finalPool = [];
            const highScore = scores.slice(0, 10);
            const reordered = [...highScore].sort((a, b) => b.entrelazamiento - a.entrelazamiento);
            const seen = new Set();
            for (const s of [...highScore, ...reordered]) {
                if (!seen.has(s.numero) && s.scoreTotal > 0) { finalPool.push(s.numero); seen.add(s.numero); }
            }
            opcion4 = finalPool.slice(0, 6).sort((a, b) => a - b);
            if (opcion4.length < 6) {
                for (const s of scores) { if (!opcion4.includes(s.numero)) opcion4.push(s.numero); if (opcion4.length >= 6) break; }
            }
        }

        // ---- Build explanations ----
        const topPairs10 = [];
        for (let i = 0; i < size; i++)
            for (let j = i + 1; j < size; j++)
                if (pairMap[`${i}_${j}`] > 0.1)
                    topPairs10.push({ par: `${i}-${j}`, fuerza: Number((pairMap[`${i}_${j}`] * 100).toFixed(1)) });
        topPairs10.sort((a, b) => b.fuerza - a.fuerza);

        const explicacion = (opcion, nombre, descripcion) => {
            const detalle = opcion.map(n => {
                const s = scores.find(x => x.numero === n);
                return { numero: n, score: s?.scoreTotal, freq: s?.frecuencia, delay: s?.atraso, ent: s?.entrelazamiento };
            });
            return { nombre, descripcion, ticket: opcion, detalle };
        };

        res.json({
            juego: juego === 'quini' ? 'Quini 6' : 'Loto Plus',
            sorteosAnalizados: total,
            opciones: [
                explicacion(opcion1, 'Opción 1: Máxima Probabilidad', 'Selecciona los 6 números con mayor score combinado de todos los métodos (frecuencia, atraso, Markov, Monte Carlo, Chi², regularidad, entrelazamiento).'),
                explicacion(opcion2, 'Opción 2: Balance Frecuencia + Atraso', 'Equilibrio entre números calientes (alta frecuencia) y fríos (mayor atraso). Cubre ambos extremos del espectro.'),
                explicacion(opcion3, 'Opción 3: Entrelazamiento + Valor', 'Prioriza números con alto entrelazamiento (NPMI) y los menos frecuentes. Estrategia de alto riesgo/recompensa.'),
                explicacion(opcion4, `Opción 4: Cluster + Score Mixto`, 'Basada en agrupaciones naturales de números que tienden a salir juntos, combinada con el score total individual.')
            ],
            paresEntrelazados: topPairs10.slice(0, 15),
            top10Ranking: scores.slice(0, 10),
            nota: 'Predicción combinada que integra 7 métodos: frecuencia, atraso, Markov, Monte Carlo, Chi², regularidad y entrelazamiento NPMI. Cada opción prioriza una estrategia diferente.'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============= ANÁLISIS PREMIO EXTRA QUINI 6 =============
app.get('/analisis-premio-extra-quini', async (req, res) => {
    try {
        // Premio Extra = unión de Primera + Segunda + Revancha (SIN Siempre Sale)
        const [rows] = await db.execute(`
            SELECT s.id, s.fecha, n.tipo, n.numero
            FROM quini_numeros n
            INNER JOIN quini_sorteos s ON n.sorteo_id = s.id
            WHERE n.tipo IN ('primer', 'segunda', 'revancha')
            ORDER BY s.fecha ASC, s.id ASC
        `);
        // Agrupar por sorteo: cada sorteo tiene su pool de Premio Extra (~18 únicos)
        const sorteoMap = new Map();
        for (const r of rows) {
            if (!sorteoMap.has(r.id)) {
                sorteoMap.set(r.id, { id: r.id, fecha: r.fecha, numbers: new Set() });
            }
            sorteoMap.get(r.id).numbers.add(r.numero);
        }
        const pools = Array.from(sorteoMap.values()).map(s => ({ id: s.id, fecha: s.fecha, numbers: Array.from(s.numbers).sort((a,b)=>a-b) }));
        if (pools.length < 5) return res.json({ error: 'Se necesitan más sorteos' });
        const total = pools.length;
        const size = 46;

        // Frecuencia individual en el pool (en cuántos sorteos aparece cada número)
        const freq = Array(size).fill(0);
        for (const p of pools) {
            for (const n of p.numbers) freq[n]++;
        }

        // Matriz de co-aparición: cuántos sorteos tienen AMBOS números en su pool
        const coMatrix = Array.from({ length: size }, () => Array(size).fill(0));
        for (const p of pools) {
            const nums = p.numbers;
            for (let i = 0; i < nums.length; i++) {
                for (let j = i + 1; j < nums.length; j++) {
                    coMatrix[nums[i]][nums[j]]++;
                    coMatrix[nums[j]][nums[i]]++;
                }
            }
        }

        // Probabilidad individual de aparecer en el pool
        const probInd = freq.map(f => Number((f / total * 100).toFixed(1)));

        // Para cada número, calcular co-aparición promedio con los otros números
        // (indica qué tan bien se "lleva" con otros)
        const coAvg = Array(size).fill(0);
        for (let n = 0; n < size; n++) {
            let sum = 0, count = 0;
            for (let j = 0; j < size; j++) {
                if (j !== n && coMatrix[n][j] > 0) {
                    sum += coMatrix[n][j];
                    count++;
                }
            }
            coAvg[n] = count > 0 ? Number((sum / count).toFixed(1)) : 0;
        }

        // Score combinado: frecuencia + co-aparición promedio
        const maxFreq = Math.max(...freq);
        const maxCo = Math.max(...coAvg);
        const scores = Array.from({ length: size }, (_, n) => ({
            numero: n,
            frecuencia: freq[n],
            probInd: probInd[n],
            coAvg: coAvg[n],
            scoreCompletitud: Number((
                (maxFreq > 0 ? (freq[n] / maxFreq) * 60 : 0) +
                (maxCo > 0 ? (coAvg[n] / maxCo) * 40 : 0)
            ).toFixed(2))
        }));
        scores.sort((a, b) => b.scoreCompletitud - a.scoreCompletitud);

        // Construir ticket maximizando co-aparición: greedy con top scores
        const buildCompletitudTicket = (seedCount) => {
            const ticket = [];
            const used = new Set();
            // Empezar con los seedCount mejores del ranking
            for (const s of scores) {
                if (ticket.length >= seedCount) break;
                if (!used.has(s.numero)) { ticket.push(s.numero); used.add(s.numero); }
            }
            // Completar con números que tengan mejor co-aparición con los ya elegidos
            while (ticket.length < 6) {
                let best = -1, bestScore2 = -1;
                for (let n = 0; n < size; n++) {
                    if (used.has(n)) continue;
                    // Puntaje = co-aparición promedio con los números ya en el ticket
                    let sum = 0;
                    for (const t of ticket) sum += coMatrix[n][t];
                    const avg = sum / ticket.length;
                    if (avg > bestScore2) { bestScore2 = avg; best = n; }
                }
                if (best >= 0) { ticket.push(best); used.add(best); }
                else break;
            }
            return ticket.sort((a, b) => a - b);
        };

        const ticketMaxProb = buildCompletitudTicket(3);
        const ticketBalance = buildCompletitudTicket(2);
        const ticketRiesgo = buildCompletitudTicket(4);

        // Calcular coberto: cuántos sorteos cubren COMPLETAMENTE cada ticket
        const calcCoberturaCompleta = (ticket) => {
            const tSet = new Set(ticket);
            let cubiertos = 0;
            for (const p of pools) {
                if (ticket.every(n => p.numbers.includes(n))) cubiertos++;
            }
            return { cubiertos, total, prob: Number((cubiertos / total * 100).toFixed(1)) };
        };

        // Top pares que aparecen juntos con más frecuencia
        const topPairs = [];
        for (let i = 0; i < size; i++) {
            for (let j = i + 1; j < size; j++) {
                if (coMatrix[i][j] >= 2) {
                    topPairs.push({ par: `${i}-${j}`, coapariciones: coMatrix[i][j], prob: Number((coMatrix[i][j] / total * 100).toFixed(1)) });
                }
            }
        }
        topPairs.sort((a, b) => b.coapariciones - a.coapariciones);

        res.json({
            juego: 'Quini 6',
            sorteosAnalizados: total,
            poolPremioExtra: 'Primera + Segunda + Revancha (promedio ~18 números únicos por sorteo)',
            ranking: scores.slice(0, 20),
            ticketMaximaProbabilidad: { ticket: ticketMaxProb, ...calcCoberturaCompleta(ticketMaxProb) },
            ticketBalance: { ticket: ticketBalance, ...calcCoberturaCompleta(ticketBalance) },
            ticketAltoRiesgo: { ticket: ticketRiesgo, ...calcCoberturaCompleta(ticketRiesgo) },
            paresDestacados: topPairs.slice(0, 20),
            nota: 'Análisis del Premio Extra: unión de Primera + Segunda + Revancha. Un ticket GANA cuando sus 6 números están TODOS presentes en el pool del sorteo. Los tickets maximizan co-aparición completa.'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
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

// ============= PERIODICIDAD QUINI 6 =============
app.get('/periodicidad-quini', async (req, res) => {
    try {
        const [sorteos] = await db.execute('SELECT id, fecha FROM quini_sorteos ORDER BY fecha ASC');
        const totalSorteos = sorteos.length;
        if (totalSorteos < 3) return res.json({ periodicidad: [], totalSorteos });

        const periodicidad = [];
        for (let num = 0; num <= 45; num++) {
            const [rows] = await db.execute(`
                SELECT ROW_NUMBER() OVER (ORDER BY s.fecha ASC) as pos
                FROM quini_sorteos s
                INNER JOIN quini_numeros n ON s.id = n.sorteo_id
                WHERE n.numero = ? AND n.tipo IN ('primer','segunda','revancha','siempre')
                ORDER BY s.fecha ASC
            `, [num]);

            const vecesAparecio = rows.length;
            let intervaloPromedio = null, sorteosSinSalir = totalSorteos;
            let probabilidad = 0, estado = 'nunca-salio';

            if (vecesAparecio > 0) {
                const intervalos = [];
                for (let i = 1; i < rows.length; i++) intervalos.push(rows[i].pos - rows[i-1].pos);
                intervaloPromedio = intervalos.length > 0
                    ? Math.round((intervalos.reduce((a,b)=>a+b,0)/intervalos.length)*100)/100
                    : totalSorteos;
                sorteosSinSalir = totalSorteos - rows[rows.length-1].pos;
                const ratio = sorteosSinSalir / intervaloPromedio;
                probabilidad = Math.round(Math.min(100, (1 / (ratio + 1)) * 100));
                if (ratio > 2) estado = 'muy-retrasado';
                else if (ratio > 1.3) estado = 'retrasado';
                else if (ratio > 0.5) estado = 'normal';
                else if (ratio > 0.2) estado = 'reciente';
                else estado = 'muy-reciente';
            }

            periodicidad.push({
                numero: num,
                vecesAparecio,
                intervaloPromedio,
                sorteosSinSalir,
                probabilidadProximoSorteo: probabilidad,
                estado
            });
        }
        res.json({ periodicidad, totalSorteos });
    } catch (e) {
        console.error('Error periodicidad Quini:', e);
        res.status(500).json({ error: e.message });
    }
});

// ============= PERIODICIDAD LOTO PLUS =============
app.get('/periodicidad-loto-plus', async (req, res) => {
    try {
        const [sorteos] = await db.execute('SELECT id, fecha FROM loto_plus_sorteos ORDER BY fecha ASC');
        const totalSorteos = sorteos.length;
        if (totalSorteos < 3) return res.json({ periodicidad: [], totalSorteos });

        const periodicidad = [];
        for (let num = 0; num <= 45; num++) {
            const [rows] = await db.execute(`
                SELECT ROW_NUMBER() OVER (ORDER BY s.fecha ASC) as pos
                FROM loto_plus_sorteos s
                INNER JOIN loto_plus_numeros n ON s.id = n.sorteo_id
                WHERE n.numero = ? AND n.tipo IN ('tradicional','match','desquite','sale_o_sale')
                ORDER BY s.fecha ASC
            `, [num]);

            const vecesAparecio = rows.length;
            let intervaloPromedio = null, sorteosSinSalir = totalSorteos;
            let probabilidad = 0, estado = 'nunca-salio';

            if (vecesAparecio > 0) {
                const intervalos = [];
                for (let i = 1; i < rows.length; i++) intervalos.push(rows[i].pos - rows[i-1].pos);
                intervaloPromedio = intervalos.length > 0
                    ? Math.round((intervalos.reduce((a,b)=>a+b,0)/intervalos.length)*100)/100
                    : totalSorteos;
                sorteosSinSalir = totalSorteos - rows[rows.length-1].pos;
                const ratio = sorteosSinSalir / intervaloPromedio;
                probabilidad = Math.round(Math.min(100, (1 / (ratio + 1)) * 100));
                if (ratio > 2) estado = 'muy-retrasado';
                else if (ratio > 1.3) estado = 'retrasado';
                else if (ratio > 0.5) estado = 'normal';
                else if (ratio > 0.2) estado = 'reciente';
                else estado = 'muy-reciente';
            }

            periodicidad.push({
                numero: num,
                vecesAparecio,
                intervaloPromedio,
                sorteosSinSalir,
                probabilidadProximoSorteo: probabilidad,
                estado
            });
        }
        res.json({ periodicidad, totalSorteos });
    } catch (e) {
        console.error('Error periodicidad Loto:', e);
        res.status(500).json({ error: e.message });
    }
});

// ============= ANÁLISIS CUÁNTICO-INSPIRADO =============

function calcularAmplitud(num, frecuencias, gaps, total, pares) {
    const freq = frecuencias[num] || 0;
    if (freq === 0) return 0;
    const gap = gaps[num] || total;
    const freqRatio = freq / Math.max(...Object.values(frecuencias), 1);
    const gapRatio = gap / (total || 1);

    const entanglementFactor = (pares[num] && pares[num].length > 0)
        ? 1 + (pares[num].reduce((s, p) => s + p.fuerza, 0) / pares[num].length) * 0.3
        : 1;

    const raw = Math.sqrt(freqRatio) * Math.exp(-gapRatio * 0.5) * entanglementFactor;
    return Math.round(raw * 10000) / 100;
}

function calcularEnergia(nums, amplitudes, matrizCorr) {
    // Energía = -sum(amplitudes) + sum(correlaciones de pares) + penalización por repetición
    let energia = 0;
    for (const n of nums) energia -= (amplitudes[n] || 0) * 2;
    for (let i = 0; i < nums.length; i++)
        for (let j = i + 1; j < nums.length; j++)
            energia += (matrizCorr[nums[i]] && matrizCorr[nums[i]][nums[j]]) || 0.5;
    return Math.round(energia * 100) / 100;
}

app.get('/api/analisis-cuantico/:juego', async (req, res) => {
    try {
        const juego = req.params.juego;
        const tablaSorteos = juego === 'quini' ? 'quini_sorteos' : 'loto_plus_sorteos';
        const tablaNumeros = juego === 'quini' ? 'quini_numeros' : 'loto_plus_numeros';
        const tipos = juego === 'quini'
            ? `'primer','segunda','revancha','siempre'`
            : `'tradicional','match','desquite','sale_o_sale'`;
        const maxNum = 45;

        // 1. Frecuencias individuales
        const [freqRows] = await db.execute(`
            SELECT numero, COUNT(*) as f
            FROM ${tablaNumeros}
            WHERE tipo IN (${tipos})
            GROUP BY numero
        `);
        const frecuencias = {};
        for (const r of freqRows) frecuencias[r.numero] = r.f;

        // 2. Gaps actuales
        const [sorteos] = await db.execute(`SELECT id FROM ${tablaSorteos} ORDER BY fecha ASC`);
        const total = sorteos.length;

        const gaps = {};
        for (let n = 0; n <= maxNum; n++) gaps[n] = total;

        const [posRows] = await db.execute(`
            SELECT sub.numero, MAX(sub.rn) as ultPos FROM (
                SELECT n.numero, ROW_NUMBER() OVER (ORDER BY s.fecha ASC) as rn
                FROM ${tablaSorteos} s
                INNER JOIN ${tablaNumeros} n ON s.id = n.sorteo_id
                WHERE n.tipo IN (${tipos})
            ) sub GROUP BY sub.numero
        `);
        for (const r of posRows) gaps[r.numero] = total - r.ultPos;

        // 3. Matriz de correlación cuántica (NPMI - entrelazamiento)
        const [pairRows] = await db.execute(`
            SELECT a.numero as n1, b.numero as n2, COUNT(*) as cooc
            FROM ${tablaSorteos} s
            INNER JOIN ${tablaNumeros} a ON s.id = a.sorteo_id AND a.tipo IN (${tipos})
            INNER JOIN ${tablaNumeros} b ON s.id = b.sorteo_id AND b.tipo IN (${tipos}) AND a.numero < b.numero
            GROUP BY a.numero, b.numero
        `);
        const pairMap = {};
        for (const r of pairRows) {
            const key = `${r.n1}_${r.n2}`;
            pairMap[key] = r.cooc;
        }

        const matrizCorr = {};
        for (let i = 0; i <= maxNum; i++) {
            matrizCorr[i] = {};
            for (let j = 0; j <= maxNum; j++) {
                if (i === j) { matrizCorr[i][j] = 1; continue; }
                const key = i < j ? `${i}_${j}` : `${j}_${i}`;
                const cooc = pairMap[key] || 0;
                const fi = frecuencias[i] || 0;
                const fj = frecuencias[j] || 0;
                if (cooc === 0 || fi === 0 || fj === 0) {
                    matrizCorr[i][j] = 0;
                    continue;
                }
                const pmi = Math.log((cooc / total) / ((fi / total) * (fj / total)));
                const npmi = pmi / (-Math.log(cooc / total));
                matrizCorr[i][j] = Math.round(Math.max(-1, Math.min(1, npmi)) * 1000) / 1000;
            }
        }

        // 4. Pares más entrelazados (top 30)
        const pares = [];
        for (let i = 0; i <= maxNum; i++)
            for (let j = i + 1; j <= maxNum; j++)
                if (matrizCorr[i][j] > 0.15)
                    pares.push({ n1: i, n2: j, entrelazamiento: matrizCorr[i][j], coocurrencias: pairMap[`${i}_${j}`] || 0 });
        pares.sort((a, b) => b.entrelazamiento - a.entrelazamiento);

        // 5. Amplitudes de superposición cuántica
        const paresForNum = {};
        for (let n = 0; n <= maxNum; n++) {
            paresForNum[n] = [];
            for (const p of pares) {
                if (p.n1 === n || p.n2 === n) paresForNum[n].push({ otro: p.n1 === n ? p.n2 : p.n1, fuerza: p.entrelazamiento });
            }
        }

        const amplitudes = [];
        for (let n = 0; n <= maxNum; n++) {
            const amp = calcularAmplitud(n, frecuencias, gaps, total, paresForNum);
            amplitudes.push({ numero: n, amplitud: amp, frecuencia: frecuencias[n] || 0, gap: gaps[n], pares: paresForNum[n].length });
        }
        amplitudes.sort((a, b) => b.amplitud - a.amplitud);

        // 6. Patrón de interferencia: ondas de probabilidad
        const interferencia = [];
        if (total > 0) {
            const ultimos20 = sorteos.slice(-Math.min(20, total));
            const [numsUltimos] = await db.execute(`
                SELECT n.numero, n.tipo
                FROM ${tablaSorteos} s
                INNER JOIN ${tablaNumeros} n ON s.id = n.sorteo_id
                WHERE s.id IN (${ultimos20.map(s => s.id).join(',')}) AND n.tipo IN (${tipos})
            `);
            const numsSet = new Set(numsUltimos.map(r => r.numero));
            for (let t = 0; t <= 45; t++) {
                const amp = amplitudes.find(a => a.numero === t);
                interferencia.push({
                    numero: t,
                    apareceEnUltimos20: numsSet.has(t),
                    fase: Math.round((t / 46) * 2 * Math.PI * 100) / 100,
                    amplitud: amp ? amp.amplitud : 0
                });
            }
        }

        res.json({
            juego,
            totalSorteos: total,
            amplitudes: amplitudes.slice(0, 20),
            paresEntrelazados: pares.slice(0, 30),
            matrizCorrelacion: matrizCorr,
            interferencia,
            nota: 'Análisis inspirado en principios cuánticos: superposición (amplitudes), entrelazamiento (correlaciones NPMI) e interferencia (ondas de probabilidad)'
        });
    } catch (e) {
        console.error('Error análisis cuántico:', e);
        res.status(500).json({ error: e.message });
    }
});

// ============= PREDICCIÓN CUÁNTICA (AMPLIFICACIÓN DE AMPLITUD) =============
app.get('/prediccion-cuantica/:juego', async (req, res) => {
    try {
        const juego = req.params.juego;
        const tablaSorteos = juego === 'quini' ? 'quini_sorteos' : 'loto_plus_sorteos';
        const tablaNumeros = juego === 'quini' ? 'quini_numeros' : 'loto_plus_numeros';
        const tipos = juego === 'quini'
            ? `'primer','segunda','revancha','siempre'`
            : `'tradicional','match','desquite','sale_o_sale'`;
        const maxNum = 45;

        // Obtener todos los sorteos con sus números
        const [sorteos] = await db.execute(`SELECT id, fecha FROM ${tablaSorteos} ORDER BY fecha ASC`);
        const total = sorteos.length;
        if (total < 10) return res.json({ error: 'Se necesitan al menos 10 sorteos', combinaciones: [] });

        const [allNums] = await db.execute(`
            SELECT s.id, s.fecha, n.numero
            FROM ${tablaSorteos} s
            INNER JOIN ${tablaNumeros} n ON s.id = n.sorteo_id
            WHERE n.tipo IN (${tipos})
            ORDER BY s.fecha ASC, n.numero ASC
        `);

        // Agrupar números por sorteo
        const numsPorSorteo = {};
        for (const r of allNums) {
            if (!numsPorSorteo[r.id]) numsPorSorteo[r.id] = [];
            numsPorSorteo[r.id].push(r.numero);
        }

        // Frecuencias
        const frecuencias = {};
        for (let i = 0; i <= maxNum; i++) frecuencias[i] = 0;
        for (const r of allNums) frecuencias[r.numero] = (frecuencias[r.numero] || 0) + 1;

        // Gaps
        const ultPos = {};
        for (let i = 0; i < sorteos.length; i++) {
            const nums = numsPorSorteo[sorteos[i].id] || [];
            for (const n of nums) ultPos[n] = i;
        }
        const gaps = {};
        for (let i = 0; i <= maxNum; i++) gaps[i] = total - (ultPos[i] !== undefined ? ultPos[i] : -1);

        // Entrelazamiento (pares)
        const cooc = {};
        for (const sid of Object.keys(numsPorSorteo)) {
            const nums = [...new Set(numsPorSorteo[sid])];
            for (let i = 0; i < nums.length; i++)
                for (let j = i + 1; j < nums.length; j++) {
                    const key = nums[i] < nums[j] ? `${nums[i]}_${nums[j]}` : `${nums[j]}_${nums[i]}`;
                    cooc[key] = (cooc[key] || 0) + 1;
                }
        }
        const paresParaNum = {};
        for (let i = 0; i <= maxNum; i++) paresParaNum[i] = [];
        for (const [key, count] of Object.entries(cooc)) {
            const [a, b] = key.split('_').map(Number);
            const fi = frecuencias[a] || 1;
            const fj = frecuencias[b] || 1;
            const pmi = Math.log((count / total) / ((fi / total) * (fj / total)));
            const npmi = pmi / (-Math.log(count / total) || 1);
            const fuerza = Math.max(0, Math.min(1, npmi));
            paresParaNum[a].push({ otro: b, fuerza });
            paresParaNum[b].push({ otro: a, fuerza });
        }

        // Amplitud cuántica para cada número
        const maxFreq = Math.max(...Object.values(frecuencias), 1);
        const amplitudes = {};
        for (let n = 0; n <= maxNum; n++) {
            const freq = frecuencias[n] || 0;
            const gap = gaps[n] || total;
            const freqRatio = freq / maxFreq;
            const gapRatio = gap / total;
            const entAngle = paresParaNum[n].reduce((s, p) => s + p.fuerza, 0) / Math.max(1, paresParaNum[n].length);
            const amp = Math.sqrt(freqRatio + 0.01) * Math.exp(-gapRatio * 0.5) * (1 + entAngle * 0.5);
            amplitudes[n] = Math.round(amp * 10000) / 100;
        }

        // Amplificación de amplitud (Grover-like): boostear números con alta amplitud
        const sorted = Object.entries(amplitudes)
            .map(([n, a]) => ({ numero: parseInt(n), amplitud: a, gap: gaps[parseInt(n)], frecuencia: frecuencias[parseInt(n)] }))
            .sort((a, b) => b.amplitud - a.amplitud);

        const topAmplitudes = sorted.slice(0, 15);

        // Generar combinaciones de 6 números con mínima energía (solo números con frecuencia > 0)
        const candidatosValidos = sorted.filter(s => s.frecuencia > 0);
        const topNums = candidatosValidos.slice(0, 22).map(s => s.numero);
        const topAmps = candidatosValidos.slice(0, 22).map(s => s.amplitud);
        const ampSum = topAmps.reduce((a, b) => a + b, 0.001);

        const combinaciones = [];
        const visitados = new Set();

        // Generar combinaciones candidatas de alta amplitud + baja energía
        for (let iter = 0; iter < 500 && combinaciones.length < 10; iter++) {
            const picks = new Set();
            // Weighted random selection por amplitud (mayor amplitud = más probable)
            while (picks.size < 6) {
                let r = Math.random() * ampSum;
                let idx = 0;
                for (let i = 0; i < topAmps.length; i++) {
                    r -= topAmps[i];
                    if (r <= 0) { idx = i; break; }
                }
                picks.add(topNums[idx]);
            }
            const combo = [...picks].sort((a, b) => a - b);
            const key = combo.join(',');
            if (visitados.has(key)) continue;
            visitados.add(key);

            let energia = 0;
            for (const n of combo) energia -= amplitudes[n] * 2;
            for (let i = 0; i < combo.length; i++)
                for (let j = i + 1; j < combo.length; j++) {
                    const ck = combo[i] < combo[j] ? `${combo[i]}_${combo[j]}` : `${combo[j]}_${combo[i]}`;
                    energia += Math.max(0, 0.5 - (cooc[ck] || 0) / total);
                }
            for (let i = 0; i < combo.length - 1; i++)
                if (combo[i + 1] - combo[i] === 1) energia += 1;

            combinaciones.push({
                numeros: combo,
                energia: Math.round(energia * 100) / 100,
                amplitudTotal: Math.round(combo.reduce((s, n) => s + amplitudes[n], 0) * 100) / 100
            });
        }
        combinaciones.sort((a, b) => a.energia - b.energia);

        res.json({
            juego,
            totalSorteos: total,
            amplitudes: topAmplitudes,
            combinaciones: combinaciones.slice(0, 6),
            nota: 'Predicción por amplificación de amplitud cuántica: los números con mayor amplitud (superposición) tienen mayor probabilidad de "colapsar" en el próximo sorteo. Las combinaciones minimizan la energía total del sistema.'
        });
    } catch (e) {
        console.error('Error predicción cuántica:', e);
        res.status(500).json({ error: e.message });
    }
});

// Página principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'simple-public', 'index.html'));
});

// ============= INICIO =============
async function start() {
    try {
        // Conectar DB
        db = await mysql.createConnection(dbConfig);
        console.log('✅ MySQL conectado');

        // Crear tablas de Quini 6 si no existen
        await db.execute(`
            CREATE TABLE IF NOT EXISTS quini_sorteos (
                id INT PRIMARY KEY,
                fecha DATE NOT NULL
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS quini_numeros (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sorteo_id INT NOT NULL,
                tipo ENUM('primer', 'segunda', 'revancha', 'siempre', 'premio_extra') NOT NULL,
                numero INT NOT NULL,
                FOREIGN KEY (sorteo_id) REFERENCES quini_sorteos(id) ON DELETE CASCADE
            )
        `);

        console.log('✅ Tablas Quini 6 verificadas');

        // Crear tablas de Loto Plus si no existen
        await db.execute(`
            CREATE TABLE IF NOT EXISTS loto_plus_sorteos (
                id INT PRIMARY KEY,
                fecha DATE NOT NULL
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS loto_plus_numeros (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sorteo_id INT NOT NULL,
                tipo ENUM('tradicional', 'match', 'desquite', 'sale_o_sale', 'jack') NOT NULL,
                numero INT NOT NULL
            )
        `);

        console.log('✅ Tablas Loto Plus verificadas');

        // Iniciar servidor
        app.listen(PORT, () => {
            console.log(`🚀 Servidor simple en http://localhost:${PORT}`);
            console.log('📊 Quini 6: /sorteo (POST), /sorteos (GET), /frecuencias (GET), /sorteo/actualizar (PUT)');
            console.log('📊 Loto Plus: /loto-plus (POST), /sorteos-loto-plus (GET), /frecuencias-loto-plus (GET), /loto-plus/actualizar (PUT)');
            console.log('⚛️ Cuántico: /api/analisis-cuantico/:juego (GET), /prediccion-cuantica/:juego (GET)');
            console.log('📈 Periodicidad: /periodicidad-quini (GET), /periodicidad-loto-plus (GET)');
        });

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

start();