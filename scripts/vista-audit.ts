// [SPEC-007 §7] La puerta de la Fase V1: que el timón y el dibujo estén de
// acuerdo con el motor y que tu barca sea la protagonista del encuadre,
// medido y no «parece que se ve mejor».
//
// Por circuito:
//   - tapada   fracción de ticks en los que una rival se mete entre la cámara
//              y el centro de tu barca [V-102]
//   - delante  fracción de ticks con alguna rival en PRIMER PLANO: más cerca
//              de la cámara que tu barca. Es lo que le quita el papel de
//              protagonista aunque no la tape del todo [V-102]
//   - timón    si el carril +1 (estribor) cae a la DERECHA de la pantalla y la
//              boya en el interior DIBUJADO de la curva [V-101]
//
// Sale con código ≠ 0 si alguna se sale de su umbral.

import { avanzar, crearRegata, CUENTA_ATRAS, type Inscripcion } from '../src/engine/carrera.ts';
import { boyasDe, carrilesEn } from '../src/engine/circuito.ts';
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
import { pilotoMedio } from './piloto.ts';

const UMBRALES = {
  /** VG2: tu barca tapada por una rival, como mucho. */
  tapada: 0.03,
  /**
   * VG2: rivales en primer plano, como mucho esta fracción de lo que había con
   * la cámara de antes. Es relativo a propósito: ir de lado con otra barca es
   * la regata, y un tope absoluto medía más el circuito que la cámara.
   */
  primerPlanoRelativo: 0.7,
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
  let est = crearRegata(circuito, inscritos, rng, huevosDe(circuito), { cuentaAtras: CUENTA_ATRAS });
  while (!est.terminada && est.reloj < 3600) {
    const jugador = est.naves.find((n) => n.jugador)!;
    est = avanzar(est, { mando: piloto(est, rng), ultimaVuelta: jugador.vuelta >= circuito.vueltas - 1 }, rng);
    alTick?.(est);
  }
  return est;
}

/** [V-101] Pantalla y dibujo de acuerdo con el motor. */
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
console.log('\n  circuito    tapada antes → ahora   1.er plano antes → ahora   timón  boyas');
for (const circuito of CIRCUITOS) {
  const t = construirTrazado(circuito);
  let ticks = 0;
  let antes = 0;
  let ahora = 0;
  let planoAntes = 0;
  let planoAhora = 0;
  for (const semilla of SEMILLAS) {
    correr(circuito, semilla, pilotoMedio, (est) => {
      const yo = est.naves.find((n) => n.jugador)!;
      if (yo.tiempoMeta !== null) return;
      ticks++;
      if (tapada(t, est, yo, CAMARA_ANTES)) antes++;
      if (tapada(t, est, yo, CAMARA_AHORA)) ahora++;
      if (enPrimerPlano(est, yo, CAMARA_ANTES)) planoAntes++;
      if (enPrimerPlano(est, yo, CAMARA_AHORA)) planoAhora++;
    });
  }
  const timon = timonCorrecto(circuito, t);
  const fAntes = antes / ticks;
  const fAhora = ahora / ticks;
  console.log(
    `  ${circuito.id.padEnd(10)} ${pc(fAntes)} → ${pc(fAhora)}      ${pc(planoAntes / ticks)} → ${pc(planoAhora / ticks)}   ` +
      `  ${timon.derecha ? '  ✓  ' : '  ✗  '}  ${timon.boyas ? '  ✓  ' : '  ✗  '}`,
  );
  if (fAhora > UMBRALES.tapada) bien = false;
  if (planoAhora > planoAntes * UMBRALES.primerPlanoRelativo) bien = false;
  if (!timon.derecha || !timon.boyas) bien = false;
}
console.log(
  `\n  umbrales: tapada ≤ ${UMBRALES.tapada * 100} % · primer plano ≤ ${UMBRALES.primerPlanoRelativo * 100} % del de antes · timón y boyas ✓`,
);
console.log(bien ? '\n  ✓ puerta superada\n' : '\n  ✗ puerta NO superada\n');
if (!bien) process.exitCode = 1;
