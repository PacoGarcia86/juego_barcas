// [SPEC-002 HG1] La ayuda de los objetos no puede prometer efectos que la
// ruleta no reparta, y ningún objeto puede quedarse en vuelo.
//
// Sale con código ≠ 0 si algo no cuadra: es puerta de integración continua.

import { avanzar, crearRegata } from '../src/engine/carrera.ts';
import { huevosDe, tirarRuleta } from '../src/engine/huevos.ts';
import { OBJETOS, pesosDePlaza, TIPOS } from '../src/engine/objetos.ts';
import { CIRCUITOS } from '../src/engine/datos/circuitos.ts';
import { BARCAS } from '../src/engine/datos/barcas.ts';
import { barcaEfectiva } from '../src/engine/barcas.ts';
import { crearRng } from '../src/engine/rng.ts';
import type { Oficio, TipoObjeto } from '../src/engine/tipos.ts';
import { pilotoMedio } from './piloto.ts';

/**
 * [HG3] Para medir la OPORTUNIDAD de romper huevos hace falta un piloto que no
 * lleve nunca las manos ocupadas: con un objeto en mano no se puede coger otro
 * (`H-103`), así que un piloto que guarda sus objetos mide su propia paciencia,
 * no el circuito. Este suelta lo que lleve en cuanto lo tiene.
 */
function pilotoManosLibres(est: Parameters<typeof pilotoMedio>[0], rng: Parameters<typeof pilotoMedio>[1]) {
  const base = pilotoMedio(est, rng);
  const yo = est.naves.find((n) => n.jugador);
  return { ...base, usar: yo !== undefined && yo.objeto !== null };
}

const TIRADAS = 100_000;
const fallos: string[] = [];

// -- 1. Todos los objetos de la ayuda salen de la ruleta [HG1] --------------
console.log('\n  reparto de la ruleta (%, por plaza)\n');
console.log('  objeto        ' + [1, 2, 3, 4, 5, 6, 7, 8].map((p) => `${p}.ª`.padStart(7)).join(''));

const cuenta: Record<string, number[]> = {};
for (const t of TIPOS) cuenta[t] = Array(8).fill(0);

for (let plaza = 1; plaza <= 8; plaza++) {
  const rng = crearRng(20260916 + plaza);
  for (let i = 0; i < TIRADAS; i++) {
    cuenta[tirarRuleta(plaza, 8, rng)]![plaza - 1]!++;
  }
}

for (const ficha of OBJETOS) {
  const fila = cuenta[ficha.tipo]!;
  console.log(
    `  ${ficha.nombre.padEnd(13)} ` + fila.map((c) => `${((100 * c) / TIRADAS).toFixed(1)}%`.padStart(7)).join(''),
  );
  if (fila.some((c) => c === 0)) {
    fallos.push(`HG1: «${ficha.nombre}» no sale nunca en alguna plaza, y la ayuda lo promete`);
  }
}

// -- 2. HG2: el último tiene opciones, el primero no las regala -------------
const krakenPrimera = cuenta['kraken']![0]! / TIRADAS;
const krakenUltima = cuenta['kraken']![7]! / TIRADAS;
const razon = krakenUltima / Math.max(1e-9, krakenPrimera);
const turboMax = Math.max(...cuenta['turbo']!) / TIRADAS;
console.log(`\n  kraken: ${(100 * krakenPrimera).toFixed(2)} % en la 1.ª contra ${(100 * krakenUltima).toFixed(2)} % en la 8.ª → ×${razon.toFixed(1)}   (umbral ×12)`);
console.log(`  turbo: como mucho ${(100 * turboMax).toFixed(1)} % en una plaza   (umbral < 30 %)`);
if (razon < 12) fallos.push(`HG2: el kraken solo sale ×${razon.toFixed(1)} más en la 8.ª que en la 1.ª`);
if (turboMax >= 0.3) fallos.push(`HG2: el turbo llega al ${(100 * turboMax).toFixed(1)} % en alguna plaza`);

// -- 3. Los pesos están declarados y son positivos --------------------------
for (let plaza = 1; plaza <= 8; plaza++) {
  const pesos = pesosDePlaza(plaza, 8);
  if (pesos.some((p) => p < 0)) fallos.push(`HG1: peso negativo en la plaza ${plaza}`);
  if (pesos.reduce((a, b) => a + b, 0) <= 0) fallos.push(`HG1: la plaza ${plaza} no tiene ningún peso positivo`);
}

// -- 4. HG3 y HG4 sobre regatas de verdad -----------------------------------
console.log('\n  regatas simuladas: huevos rotos por el jugador y objetos en vuelo al terminar\n');
const dotacion = (plazas: number): Oficio[] => {
  const t: Oficio[] = Array(plazas).fill('remero');
  if (plazas > 1) t[0] = 'timonel';
  return t;
};
let minHuevos = Infinity;
let vistos = new Set<TipoObjeto>();

for (const circuito of CIRCUITOS) {
  for (const semilla of [1, 2, 3, 4, 5]) {
    const inscritos = [...BARCAS, BARCAS[0]!, BARCAS[3]!].map((b, i) => ({
      nombre: b.nombre,
      barca: barcaEfectiva(b, dotacion(b.plazas)),
      colores: b.colores,
      jugador: i === semilla % 8,
    }));
    const rng = crearRng(semilla * 31 + circuito.id.length);
    let est = crearRegata(circuito, inscritos, rng, huevosDe(circuito));
    while (!est.terminada && est.reloj < 3600) {
      const jugador = est.naves.find((n) => n.jugador)!;
      for (const o of est.objetos) vistos.add(o.tipo);
      for (const n of est.naves) if (n.objeto !== null) vistos.add(n.objeto);
      est = avanzar(est, { mando: pilotoManosLibres(est, rng), ultimaVuelta: jugador.vuelta >= circuito.vueltas - 1 }, rng);
    }
    const jugador = est.naves.find((n) => n.jugador)!;
    minHuevos = Math.min(minHuevos, jugador.huevosRotos);
    // [HG4] [H-210] Al bajar la bandera puede quedar algo flotando —un ancla
    // soltada hace veinte segundos todavía tiene cuerda—, así que lo que se
    // comprueba es que NADA se renueva solo: treinta segundos después, cero.
    let despues = est;
    for (let t = 0; t < 600; t++) {
      despues = avanzar(despues, { mando: { gas: 0, timon: 0, usar: false }, ultimaVuelta: true }, rng);
    }
    if (despues.objetos.length > 0) {
      fallos.push(`HG4: ${circuito.id}/${semilla} sigue con ${despues.objetos.length} objetos treinta segundos después de la bandera`);
    }
    const efectosVivos = despues.naves.reduce((n, x) => n + x.efectos.length, 0);
    if (efectosVivos > 0) fallos.push(`HG4: ${circuito.id}/${semilla} sigue con ${efectosVivos} efectos vivos`);
    console.log(
      `  ${circuito.id}/${semilla}`.padEnd(14) +
        `huevos del jugador ${String(jugador.huevosRotos).padStart(3)}   en el agua al bajar la bandera ${String(est.objetos.length).padStart(2)}   y treinta segundos después ${despues.objetos.length}/${efectosVivos}`,
    );
  }
}

console.log(`\n  huevos rotos por el jugador, mínimo sobre las 20 regatas: ${minHuevos}   (umbral ≥ 12)`);
if (minHuevos < 12) fallos.push(`HG3: en alguna regata el jugador solo rompió ${minHuevos} huevos`);

const noVistos = TIPOS.filter((t) => !vistos.has(t));
console.log(`  tipos de objeto vistos en regata: ${vistos.size} de ${TIPOS.length}${noVistos.length > 0 ? ' — faltan ' + noVistos.join(', ') : ''}`);

if (fallos.length > 0) {
  console.log('\n  ✗ AUDITORÍA NO SUPERADA');
  for (const f of fallos) console.log(`    · ${f}`);
  console.log();
  process.exit(1);
}
console.log('\n  ✓ auditoría superada\n');
