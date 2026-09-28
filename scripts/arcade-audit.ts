// [SPEC-006 §7] La puerta de la Fase K1: lo que hace que la regata se vea y
// se juegue como un arcade, medido y no «parece que va mejor».
//
// Cuatro cifras por circuito:
//   - tapada   fracción de ticks en los que una rival se mete entre la cámara
//              y el centro de tu barca [K-102]
//   - delante  fracción de ticks con alguna rival en PRIMER PLANO: más cerca
//              de la cámara que tu barca. Es lo que le quita el papel de
//              protagonista aunque no la tape del todo [K-102]
//   - timón    si el carril +1 (estribor) cae a la DERECHA de la pantalla y la
//              boya en el interior DIBUJADO de la curva [K-101]
//   - minutos  lo que dura la regata del ganador en tiempo de juego [K-201]
//   - ceñida   segundos que gana un piloto que ciñe las boyas [K-204]
//
// Sale con código ≠ 0 si alguna se sale de su umbral.

import { avanzar, crearRegata, type Inscripcion } from '../src/engine/carrera.ts';
import { clasificar } from '../src/engine/clasificacion.ts';
import { boyasDe, carrilesEn, puntoDe } from '../src/engine/circuito.ts';
import { BARCAS } from '../src/engine/datos/barcas.ts';
import { CIRCUITOS } from '../src/engine/datos/circuitos.ts';
import { huevosDe } from '../src/engine/huevos.ts';
import { barcaEfectiva } from '../src/engine/barcas.ts';
import { crearRng } from '../src/engine/rng.ts';
import type { Barca, Circuito, EstadoRegata, Mando, Nave, Oficio } from '../src/engine/tipos.ts';
import {
  alturaDeCamara,
  anchuraEn,
  construirTrazado,
  derechaDePantalla,
  posicionEn,
  retrasoDeCamara,
  type Trazado,
} from '../src/render/tresd/trazado.ts';
import { RITMO } from '../src/juego/ritmo.ts';
import { pilotoMedio } from './piloto.ts';

const UMBRALES = {
  /** KG2: tu barca tapada por una rival, como mucho. */
  tapada: 0.03,
  /**
   * KG2: rivales en primer plano, como mucho esta fracción de lo que había con
   * la cámara de antes. Es relativo a propósito: ir de lado con otra barca es
   * la regata, y un tope absoluto medía más el circuito que la cámara.
   */
  primerPlanoRelativo: 0.7,
  /** KG3: minutos de juego del ganador. */
  minutos: [2.5, 5.5] as const,
  /** KG6: segundos de regata que gana quien ciñe, al menos, por vuelta. */
  cenidaPorVuelta: 1,
};

const SEMILLAS = [1, 2, 3, 4, 5, 6, 7, 8];

/** [R-501] La cámara de antes de SPEC-006, para la columna «antes». */
const CAMARA_ANTES = {
  retraso: (eslora: number) => 13 + 1.15 * eslora,
  altura: (_eslora: number) => 5.8,
};
const CAMARA_AHORA = { retraso: retrasoDeCamara, altura: alturaDeCamara };

function dotacion(b: Barca): Oficio[] {
  const t: Oficio[] = Array(b.plazas).fill('remero');
  if (b.plazas > 1) t[0] = 'timonel';
  return t;
}

function carrilesDe(t: Trazado, metros: number): number {
  return Math.max(2, Math.floor(anchuraEn(t, metros) / 4.5));
}

/**
 * ¿Hay una rival entre la cámara y el centro de la barca seguida? Se mira la
 * línea de la cámara al centro de la cubierta: si pasa por encima del casco o
 * de la vela de otra, la barca propia está tapada.
 */
function tapada(t: Trazado, est: EstadoRegata, yo: Nave, camara: typeof CAMARA_AHORA): boolean {
  const mc = yo.metros - camara.retraso(yo.barca.eslora);
  const c = posicionEn(t, mc, yo.carril, carrilesDe(t, mc));
  const cy = camara.altura(yo.barca.eslora);
  const p = posicionEn(t, yo.metros, yo.carril, carrilesDe(t, yo.metros));
  const py = 0.8;
  const dx = p.x - c.x;
  const dz = p.z - c.z;
  const largo2 = dx * dx + dz * dz;
  for (const otra of est.naves) {
    if (otra.indice === yo.indice || otra.tiempoMeta !== null) continue;
    if (otra.metros < mc || otra.metros > yo.metros) continue;
    const o = posicionEn(t, otra.metros, otra.carril, carrilesDe(t, otra.metros));
    const f = ((o.x - c.x) * dx + (o.z - c.z) * dz) / largo2;
    if (f <= 0 || f >= 1) continue;
    const lado = Math.hypot(c.x + dx * f - o.x, c.z + dz * f - o.z);
    // Media manga de la otra, y la vela, que es lo que más tapa.
    if (lado > otra.barca.manga / 2 + 0.4) continue;
    const alturaLinea = cy + (py - cy) * f;
    const techo = 0.5 + Math.max(2, otra.barca.eslora * 0.3);
    if (alturaLinea < techo) return true;
  }
  return false;
}

/** ¿Alguna rival entre la cámara y tu barca, en cualquier carril? */
function enPrimerPlano(est: EstadoRegata, yo: Nave, camara: typeof CAMARA_AHORA): boolean {
  const mc = yo.metros - camara.retraso(yo.barca.eslora);
  return est.naves.some(
    (o) => o.indice !== yo.indice && o.tiempoMeta === null && o.metros > mc + o.barca.eslora / 2 && o.metros < yo.metros,
  );
}

/** [K-204] El piloto medio, y el mismo piloto que además ciñe las boyas. */
function pilotoQueCine(est: EstadoRegata, rng: ReturnType<typeof crearRng>): Mando {
  const base = pilotoMedio(est, rng);
  const yo = est.naves.find((n) => n.jugador);
  if (yo === undefined || yo.tiempoMeta !== null) return base;
  const tramo = puntoDe(est.circuito, yo.metros).tramo;
  if (tramo.tipo !== 'curva') return base;
  // Hacia dentro: el interior de una curva de radio positivo es el carril 0.
  const dentro = tramo.radio > 0 ? -1 : 1;
  const interior = tramo.radio > 0 ? 0 : carrilesEn(tramo) - 1;
  // Se va al carril de dentro y, una vez allí, sigue apretando hacia dentro.
  return { ...base, timon: yo.carril === interior || yo.cambiando === 0 ? dentro : base.timon };
}

function correr(
  circuito: Circuito,
  semilla: number,
  piloto: (e: EstadoRegata, r: ReturnType<typeof crearRng>) => Mando,
  alTick?: (e: EstadoRegata) => void,
): EstadoRegata {
  const giro = (semilla + circuito.id.length) % BARCAS.length;
  const parrilla: Barca[] = [...BARCAS, BARCAS[giro % BARCAS.length]!, BARCAS[(giro + 3) % BARCAS.length]!];
  const indiceJugador = (semilla * 3 + giro) % parrilla.length;
  const inscritos: Inscripcion[] = parrilla.map((b, i) => ({
    nombre: b.nombre,
    barca: barcaEfectiva(b, dotacion(b)),
    colores: b.colores,
    jugador: i === indiceJugador,
  }));
  const rng = crearRng(semilla * 7919 + circuito.id.length * 13);
  let est = crearRegata(circuito, inscritos, rng, huevosDe(circuito));
  while (!est.terminada && est.reloj < 3600) {
    const jugador = est.naves.find((n) => n.jugador)!;
    est = avanzar(est, { mando: piloto(est, rng), ultimaVuelta: jugador.vuelta >= circuito.vueltas - 1 }, rng);
    alTick?.(est);
  }
  return est;
}

/** [K-101] Pantalla y dibujo de acuerdo con el motor. */
function timonCorrecto(circuito: Circuito, t: Trazado): { derecha: boolean; boyas: boolean } {
  let derecha = true;
  for (let m = 0; m < t.vuelta; m += 25) {
    const n = carrilesDe(t, m);
    const a = posicionEn(t, m, 0, n);
    const b = posicionEn(t, m, 1, n);
    const d = derechaDePantalla(t, m);
    if ((b.x - a.x) * d.x + (b.z - a.z) * d.z <= 0) derecha = false;
  }
  let boyas = true;
  for (const boya of boyasDe(circuito)) {
    const tramo = circuito.tramos[boya.indiceTramo]!;
    const n = carrilesEn(tramo);
    // El carril interior del MOTOR (`factorDeCarril`) tiene que caer del lado
    // hacia el que gira el dibujo.
    const interior = tramo.radio > 0 ? 0 : n - 1;
    const exterior = n - 1 - interior;
    const antes = posicionEn(t, boya.metros - 8, 0, n);
    const despues = posicionEn(t, boya.metros + 8, 0, n);
    const centro = posicionEn(t, boya.metros, 0, n);
    const pDentro = posicionEn(t, boya.metros, interior, n);
    const pFuera = posicionEn(t, boya.metros, exterior, n);
    // El centro de giro está hacia donde se dobla la cuerda antes→después.
    const medio = { x: (antes.x + despues.x) / 2 - centro.x, z: (antes.z + despues.z) / 2 - centro.z };
    const haciaDentro = (pDentro.x - pFuera.x) * medio.x + (pDentro.z - pFuera.z) * medio.z;
    if (haciaDentro <= 0) boyas = false;
  }
  return { derecha, boyas };
}

const pc = (f: number): string => `${(f * 100).toFixed(1).padStart(5)} %`;

let bien = true;
console.log('\n  circuito    tapada antes → ahora   1.er plano antes → ahora   timón  boyas   min. ganador  ceñida/vuelta');
for (const circuito of CIRCUITOS) {
  const t = construirTrazado(circuito);
  let ticks = 0;
  let antes = 0;
  let ahora = 0;
  let planoAntes = 0;
  let planoAhora = 0;
  const minutos: number[] = [];
  let ganancia = 0;
  for (const semilla of SEMILLAS) {
    const fin = correr(circuito, semilla, pilotoMedio, (est) => {
      const yo = est.naves.find((n) => n.jugador)!;
      if (yo.tiempoMeta !== null) return;
      ticks++;
      if (tapada(t, est, yo, CAMARA_ANTES)) antes++;
      if (tapada(t, est, yo, CAMARA_AHORA)) ahora++;
      if (enPrimerPlano(est, yo, CAMARA_ANTES)) planoAntes++;
      if (enPrimerPlano(est, yo, CAMARA_AHORA)) planoAhora++;
    });
    const ganador = fin.naves[clasificar(fin)[0]!]!;
    minutos.push((ganador.tiempoMeta ?? fin.reloj) / RITMO / 60);
    const cine = correr(circuito, semilla, pilotoQueCine);
    const tMedio = fin.naves.find((n) => n.jugador)!.tiempoMeta ?? fin.reloj;
    const tCine = cine.naves.find((n) => n.jugador)!.tiempoMeta ?? cine.reloj;
    ganancia += (tMedio - tCine) / circuito.vueltas;
  }
  const timon = timonCorrecto(circuito, t);
  const fAntes = antes / ticks;
  const fAhora = ahora / ticks;
  const minMin = Math.min(...minutos);
  const minMax = Math.max(...minutos);
  const cenida = ganancia / SEMILLAS.length;
  console.log(
    `  ${circuito.id.padEnd(10)} ${pc(fAntes)} → ${pc(fAhora)}      ${pc(planoAntes / ticks)} → ${pc(planoAhora / ticks)}   ` +
      `  ${timon.derecha ? '  ✓  ' : '  ✗  '}  ${timon.boyas ? '  ✓  ' : '  ✗  '}  ${minMin.toFixed(1)}–${minMax.toFixed(1)}` +
      `       ${cenida >= 0 ? '+' : ''}${cenida.toFixed(1)} s`,
  );
  if (fAhora > UMBRALES.tapada) bien = false;
  if (planoAhora > planoAntes * UMBRALES.primerPlanoRelativo) bien = false;
  if (!timon.derecha || !timon.boyas) bien = false;
  if (minMin < UMBRALES.minutos[0] || minMax > UMBRALES.minutos[1]) bien = false;
  if (cenida < UMBRALES.cenidaPorVuelta) bien = false;
}
console.log(
  `\n  umbrales: tapada ≤ ${UMBRALES.tapada * 100} % · primer plano ≤ ${UMBRALES.primerPlanoRelativo * 100} % del de antes · timón y boyas ✓ · ganador en ${UMBRALES.minutos[0]}–${UMBRALES.minutos[1]} min` +
    ` · ceñida ≥ ${UMBRALES.cenidaPorVuelta} s por vuelta · ritmo ×${RITMO}`,
);
console.log(bien ? '\n  ✓ puerta superada\n' : '\n  ✗ puerta NO superada\n');
if (!bien) process.exitCode = 1;
