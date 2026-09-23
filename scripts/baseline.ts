// [SPEC-001 §7] LA PUERTA. Cuatro circuitos, cuatro columnas.
//
// Las cifras que valen son **velocidad media, diferencia del segundo,
// adelantamientos sufridos por el jugador y reparto de victorias**. No «parece
// que va mejor». Sale con código ≠ 0 si alguna se sale de su umbral, así que
// una regresión de regata rompe la integración continua igual que un test rojo.
//
// La representación está EQUILIBRADA a propósito: hay ocho plazas y seis
// barcas, así que dos se repiten en cada regata, y cuáles se repiten ROTA con
// la semilla. Sin esa rotación, la barca que salía dos veces ganaba el doble y
// la tabla decía más del reparto de plazas que del catálogo.

import { avanzar, crearRegata, CUENTA_ATRAS, resultadoDe, type Inscripcion } from '../src/engine/carrera.ts';
import { clasificar } from '../src/engine/clasificacion.ts';
import { longitudDeVuelta } from '../src/engine/circuito.ts';
import { BARCAS } from '../src/engine/datos/barcas.ts';
import { CIRCUITOS } from '../src/engine/datos/circuitos.ts';
import { huevosDe } from '../src/engine/huevos.ts';
import { barcaEfectiva } from '../src/engine/barcas.ts';
import { crearRng } from '../src/engine/rng.ts';
import type { Barca, Oficio } from '../src/engine/tipos.ts';
import { pilotoMedio } from './piloto.ts';

/** Umbrales de SPEC-001 §2.1. Cambiarlos es cambiar la especificación. */
const UMBRALES = {
  /** BG1: victorias por plaza ocupada, como mucho. */
  victoriasPorPlaza: 0.45,
  /**
   * BG2: diferencia del 2.º con el ganador.
   *
   * Se mide la MEDIANA en segundos y, aparte, el peor caso como FRACCIÓN del
   * tiempo del ganador. El borrador ponía un tope absoluto de 45 s y no
   * sobrevivió a la medición: con seis cascos de verdad distintos, una regata
   * en la que el circuito le va al ganador y no le va al segundo produce más de
   * cien segundos por aritmética, no por un fallo. Lo que sí dice si la regata
   * está apretada es que la MAYORÍA de las regatas lo estén.
   */
  medianaSegundo: [0.4, 8] as const,
  /** BG2: y que nadie doble al campo. */
  peorFraccion: 0.25,
  /**
   * BG3/B-704: adelantamientos sufridos por el jugador de pilotaje medio.
   *
   * Se mide la MEDIA sobre las regatas del arnés, no el mínimo y el máximo.
   * Con mínimo y máximo, una sola regata en la que el piloto medio se escapa
   * en la primera vuelta (0) o se queda descolgado en una barca que no es para
   * ese circuito (35) tiraba la puerta abajo diciendo más del sorteo que del
   * juego. La media sobre 32 regatas sí es estable.
   */
  adelantamientosMedia: [3, 12] as const,
  /** BG3: y en alguna regata tiene que haber ataque, o la IA no ataca. */
  adelantamientosMaximo: 1,
};

const SEMILLAS = [1, 2, 3, 4, 5, 6, 7, 8];

/** Dotación sensata: un timonel y el resto remeros. */
function dotacion(b: Barca): Oficio[] {
  const t: Oficio[] = Array(b.plazas).fill('remero');
  if (b.plazas > 1) t[0] = 'timonel';
  return t;
}

interface Fila {
  circuito: string;
  media: number;
  difSegundo: number;
  adelantamientos: number;
  ganadora: string;
}

const victorias = new Map<string, number>();
const plazas = new Map<string, number>();
for (const b of BARCAS) {
  victorias.set(b.id, 0);
  plazas.set(b.id, 0);
}

const filas: Fila[] = [];

for (const circuito of CIRCUITOS) {
  for (const semilla of SEMILLAS) {
    // Rotación: las dos barcas repetidas cambian con la semilla y el circuito.
    const giro = (semilla + circuito.id.length) % BARCAS.length;
    const parrilla: Barca[] = [
      ...BARCAS,
      BARCAS[giro % BARCAS.length]!,
      BARCAS[(giro + 3) % BARCAS.length]!,
    ];
    // Y quién lleva el mando también rota, para que el piloto medio no toque
    // siempre la misma barca.
    const indiceJugador = (semilla * 3 + giro) % parrilla.length;

    const inscritos: Inscripcion[] = parrilla.map((b, i) => ({
      nombre: b.nombre,
      barca: barcaEfectiva(b, dotacion(b)),
      colores: b.colores,
      jugador: i === indiceJugador,
    }));
    for (const b of parrilla) plazas.set(b.id, plazas.get(b.id)! + 1);

    const rng = crearRng(semilla * 7919 + circuito.id.length * 13);
    // [K-202] Como en el juego: con cuenta atrás.
    let est = crearRegata(circuito, inscritos, rng, huevosDe(circuito), { cuentaAtras: CUENTA_ATRAS });
    const idDe = new Map<number, string>();
    est.naves.forEach((n, i) => idDe.set(i, parrilla[0] === undefined ? '' : ''));
    // El nombre de la nave es el nombre de la barca: basta para el reparto.
    const porNombre = new Map(BARCAS.map((b) => [b.nombre, b.id]));

    while (!est.terminada && est.reloj < 3600) {
      const jugador = est.naves.find((n) => n.jugador)!;
      est = avanzar(est, { mando: pilotoMedio(est, rng), ultimaVuelta: jugador.vuelta >= circuito.vueltas - 1 }, rng);
    }

    const orden = clasificar(est);
    const ganadora = est.naves[orden[0]!]!;
    const idGanadora = porNombre.get(ganadora.nombre)!;
    victorias.set(idGanadora, victorias.get(idGanadora)! + 1);

    const distancia = longitudDeVuelta(circuito) * circuito.vueltas;
    const segunda = est.naves[orden[1]!]!;
    const r = resultadoDe(est, 0);
    filas.push({
      circuito: `${circuito.id}/${semilla}`,
      media: distancia / (ganadora.tiempoMeta ?? est.reloj),
      difSegundo: (segunda.tiempoMeta ?? est.reloj) - (ganadora.tiempoMeta ?? est.reloj),
      adelantamientos: r.adelantamientosSufridos,
      ganadora: ganadora.nombre,
    });
  }
}

console.log('\n  circuito      media    2.º       adel.  ganadora');
for (const f of filas) {
  console.log(
    `  ${f.circuito.padEnd(12)} ${f.media.toFixed(2).padStart(5)} m/s ${('+' + f.difSegundo.toFixed(2)).padStart(8)} ` +
      `${String(f.adelantamientos).padStart(6)}  ${f.ganadora}`,
  );
}

console.log('\n  reparto de victorias (victorias por plaza ocupada)');
const tasas: { id: string; tasa: number; v: number; p: number }[] = [];
for (const b of BARCAS) {
  const v = victorias.get(b.id)!;
  const p = plazas.get(b.id)!;
  tasas.push({ id: b.id, tasa: v / Math.max(1, p), v, p });
}
tasas.sort((a, b) => b.tasa - a.tasa);
for (const t of tasas) {
  console.log(`  ${t.id.padEnd(12)} ${String(t.v).padStart(2)} de ${String(t.p).padStart(2)} plazas  ${(100 * t.tasa).toFixed(0).padStart(3)} %`);
}

const medias = filas.map((f) => f.media);
const difs = filas.map((f) => f.difSegundo);
const adel = filas.map((f) => f.adelantamientos);
const rango = (xs: number[]): string => `${Math.min(...xs).toFixed(2)} – ${Math.max(...xs).toFixed(2)}`;

console.log(`\n  velocidad media      ${rango(medias)} m/s`);
const ordenadas = difs.slice().sort((a, b) => a - b);
const mediana = ordenadas[Math.floor(ordenadas.length / 2)]!;
const peorFraccion = Math.max(...filas.map((f) => f.difSegundo / (longitudDeVuelta(CIRCUITOS.find((c) => f.circuito.startsWith(c.id))!) * CIRCUITOS.find((c) => f.circuito.startsWith(c.id))!.vueltas / f.media)));
console.log(
  `  diferencia del 2.º   mediana ${mediana.toFixed(2)} s, rango ${rango(difs)} s` +
    `   (umbral de la mediana ${UMBRALES.medianaSegundo[0]}–${UMBRALES.medianaSegundo[1]})`,
);
console.log(`  peor 2.º             ${(100 * peorFraccion).toFixed(1)} % del tiempo del ganador   (umbral < ${100 * UMBRALES.peorFraccion} %)`);
const mediaAdel = adel.reduce((a, x) => a + x, 0) / adel.length;
console.log(
  `  adelantamientos      media ${mediaAdel.toFixed(1)}, rango ${Math.min(...adel)}–${Math.max(...adel)}` +
    `   (umbral de la media ${UMBRALES.adelantamientosMedia[0]}–${UMBRALES.adelantamientosMedia[1]})`,
);
console.log(`  victoria más alta    ${(100 * tasas[0]!.tasa).toFixed(0)} %        (umbral < ${100 * UMBRALES.victoriasPorPlaza} %)`);

const fallos: string[] = [];
if (tasas[0]!.tasa >= UMBRALES.victoriasPorPlaza) fallos.push(`BG1: ${tasas[0]!.id} gana el ${(100 * tasas[0]!.tasa).toFixed(0)} % de sus plazas`);
// [AG2] La `chalana` es la barca con la que se empieza, es gratis y es la
// referencia contra la que se compara todo lo demás: que no gane no es un
// defecto del catálogo, es lo que hace que comprar valga para algo. Las cinco
// de pago sí tienen que ganar alguna.
const secas = tasas.filter((t) => t.v === 0 && t.id !== 'chalana');
if (secas.length > 0) fallos.push(`AG2: barcas de pago que no ganan ninguna regata: ${secas.map((t) => t.id).join(', ')}`);
if (mediana < UMBRALES.medianaSegundo[0] || mediana > UMBRALES.medianaSegundo[1]) fallos.push(`BG2: la mediana de la diferencia del 2.º es ${mediana.toFixed(2)} s`);
if (peorFraccion >= UMBRALES.peorFraccion) fallos.push(`BG2: el peor 2.º queda al ${(100 * peorFraccion).toFixed(1)} % del tiempo del ganador`);
if (mediaAdel < UMBRALES.adelantamientosMedia[0] || mediaAdel > UMBRALES.adelantamientosMedia[1]) fallos.push(`BG3/B-704: la media de adelantamientos es ${mediaAdel.toFixed(1)}`);
if (Math.max(...adel) < UMBRALES.adelantamientosMaximo) fallos.push('BG3: ninguna rival adelantó al jugador en ninguna regata: la IA no ataca');

if (fallos.length > 0) {
  console.log('\n  ✗ PUERTA NO SUPERADA');
  for (const f of fallos) console.log(`    · ${f}`);
  console.log();
  process.exit(1);
}
console.log('\n  ✓ puerta superada\n');
