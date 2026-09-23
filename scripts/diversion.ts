// [K-001] LA PUERTA DE SPEC-006. ¿Es una regata de kart o una de remo?
//
//   npm run diversion                   todos los objetivos que ya se pueden medir
//   npm run diversion -- --fase K1      solo los de esa fase
//   npm run diversion -- --original     RITMO 1 y los circuitos de antes: SPEC-006 §3
//
// Mismo muestreo que SPEC-006 §3: chalana sin tripulación con el piloto medio,
// cuatro circuitos por ocho semillas. Todas las cifras en segundos y minutos
// REALES de pantalla. Sale con código ≠ 0 si algún objetivo exigido se incumple.

import { montar } from '../src/engine/__tests__/ayudas.ts';
import { CIRCUITOS } from '../src/engine/datos/circuitos.ts';
import { RITMO } from '../src/engine/ritmo.ts';
import type { Circuito } from '../src/engine/tipos.ts';
import { CIRCUITOS_ORIGINALES } from './circuitos-originales.ts';
import { medirRegata, type Medida } from './medida-diversion.ts';
import { pilotoMedio } from './piloto.ts';

const args = process.argv.slice(2);
const original = args.includes('--original');
const iFase = args.indexOf('--fase');
const fase = iFase >= 0 ? args[iFase + 1] : undefined;

/** Objetivos de SPEC-006 §2.1 por fase. Cambiarlos es cambiar la especificación. */
const OBJETIVOS_DE_FASE: Record<string, string[]> = {
  K1: ['KG1', 'KG2'],
  K2: ['KG1', 'KG2', 'KG3', 'KG4'],
};
/** KG5 necesita al piloto experto de K2; hasta entonces no se puede medir. */
const exigidos = new Set(fase === undefined ? OBJETIVOS_DE_FASE.K2 : (OBJETIVOS_DE_FASE[fase] ?? []));
const UMBRALES = {
  KG1: { mediana: [2.5, 4] as const, peorCircuito: 5 },
  KG2: 8,
  KG3: { mediana: 12, peor: 20 },
  KG4: 1.5,
};

const circuitos: Circuito[] = original ? CIRCUITOS_ORIGINALES : CIRCUITOS;
const ritmo = original ? 1 : RITMO;
const SEMILLAS = [1, 2, 3, 4, 5, 6, 7, 8];

const mediana = (xs: number[]): number => {
  const o = xs.slice().sort((a, b) => a - b);
  return o[Math.floor(o.length / 2)]!;
};
const f = (x: number, d = 2): string => x.toFixed(d).replace('.', ',');

const todas: Medida[] = [];
const porCircuito = new Map<string, Medida[]>();
for (const c of circuitos) {
  const medidas: Medida[] = [];
  for (const semilla of SEMILLAS) {
    const { est, rng } = montar(c.id, { barca: 'chalana', tripulacion: [] }, { semilla, base: c });
    medidas.push(medirRegata(est, rng, pilotoMedio, ritmo));
  }
  porCircuito.set(c.id, medidas);
  todas.push(...medidas);
}

console.log(`\n  ${original ? 'ORIGINAL · RITMO 1 · circuitos de antes de K-102' : `RITMO ${ritmo}`}\n`);
console.log('  circuito    vueltas×m    duración   flota     hueco máx   ganados/min  sufridos/min  objetos/min');
for (const c of circuitos) {
  const ms = porCircuito.get(c.id)!;
  const vuelta = c.tramos.reduce((a, t) => a + t.longitud, 0);
  console.log(
    `  ${c.id.padEnd(10)} ${`${c.vueltas}×${vuelta}`.padStart(9)}   ${f(mediana(ms.map((m) => m.minutos)), 1).padStart(5)} min` +
      `  ${f(mediana(ms.map((m) => m.velocidadFlota))).padStart(5)} m/s  ${f(mediana(ms.map((m) => m.huecoMaximo)), 0).padStart(5)} s` +
      `   ${f(mediana(ms.map((m) => m.ganadosPorMinuto))).padStart(8)}   ${f(mediana(ms.map((m) => m.sufridosPorMinuto))).padStart(10)}` +
      `   ${f(mediana(ms.map((m) => m.objetosPorMinuto))).padStart(9)}`,
  );
}

const durMed = mediana(todas.map((m) => m.minutos));
const peorCircuito = Math.max(...circuitos.map((c) => mediana(porCircuito.get(c.id)!.map((m) => m.minutos))));
const flotaPeor = Math.min(...circuitos.map((c) => mediana(porCircuito.get(c.id)!.map((m) => m.velocidadFlota))));
const huecoMed = mediana(todas.map((m) => m.huecoMaximo));
const huecoPeor = Math.max(...todas.map((m) => m.huecoMaximo));
const pelea = mediana(todas.map((m) => m.ganadosPorMinuto + m.sufridosPorMinuto));
const objetos = mediana(todas.map((m) => m.objetosPorMinuto));

const marca = (id: string): string => (exigidos.has(id) ? '' : '   (no se exige en esta fase)');
console.log(`\n  KG1 duración            mediana ${f(durMed, 1)} min, peor circuito ${f(peorCircuito, 1)} min   (umbral ${UMBRALES.KG1.mediana.join('–')}, peor ≤ ${UMBRALES.KG1.peorCircuito})${marca('KG1')}`);
console.log(`  KG2 velocidad de flota  peor circuito ${f(flotaPeor)} m/s   (umbral ≥ ${UMBRALES.KG2})${marca('KG2')}`);
console.log(`  KG3 hueco sin nada      mediana ${f(huecoMed, 0)} s, peor ${f(huecoPeor, 0)} s   (umbral ≤ ${UMBRALES.KG3.mediana}, peor ≤ ${UMBRALES.KG3.peor})${marca('KG3')}`);
console.log(`  KG4 pelea               mediana ${f(pelea)} adelantamientos/min   (umbral ≥ ${UMBRALES.KG4})${marca('KG4')}`);
console.log(`  KG5 habilidad           sin medir: el piloto experto llega con K-202/K-203`);
console.log(`      objetos             mediana ${f(objetos)} por minuto`);

const fallos: string[] = [];
if (exigidos.has('KG1') && (durMed < UMBRALES.KG1.mediana[0] || durMed > UMBRALES.KG1.mediana[1] || peorCircuito > UMBRALES.KG1.peorCircuito))
  fallos.push(`KG1: la regata dura ${f(durMed, 1)} min de mediana, ${f(peorCircuito, 1)} en el peor circuito`);
if (exigidos.has('KG2') && flotaPeor < UMBRALES.KG2) fallos.push(`KG2: la flota va a ${f(flotaPeor)} m/s en el circuito más lento`);
if (exigidos.has('KG3') && (huecoMed > UMBRALES.KG3.mediana || huecoPeor > UMBRALES.KG3.peor))
  fallos.push(`KG3: ${f(huecoMed, 0)} s sin que pase nada de mediana, ${f(huecoPeor, 0)} en el peor caso`);
if (exigidos.has('KG4') && pelea < UMBRALES.KG4) fallos.push(`KG4: ${f(pelea)} adelantamientos por minuto`);

if (original) {
  // La foto de antes no tiene que pasar ninguna puerta: es la referencia.
  console.log('\n  (referencia de SPEC-006 §3: no se exige nada)\n');
} else if (fallos.length > 0) {
  console.log('\n  ✗ PUERTA NO SUPERADA');
  for (const x of fallos) console.log(`    · ${x}`);
  console.log();
  process.exit(1);
} else console.log(`\n  ✓ puerta superada${fase === undefined ? '' : ` (fase ${fase})`}\n`);
