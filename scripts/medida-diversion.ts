// [K-001] Lo que mide `npm run diversion` en UNA regata. Separado de la orden
// para que un test pueda correrlo sobre una regata corta.
//
// Todo sale en SEGUNDOS REALES: los de simulación divididos por el ritmo con el
// que se juega (`K-101`). Con `ritmo` 1 son los mismos, que es como se midió
// SPEC-006 §3.
//
// Los adelantamientos se cuentan con la histéresis de `B-702` o no se cuentan:
// tick a tick, dos barcas en paralelo intercambian el orden cada paso y la
// cifra dice 28 por minuto en una regata y 0,08 en otra (SPEC-006 §3).

import { avanzar, HISTERESIS_ADELANTAMIENTO } from '../src/engine/carrera.ts';
import type { Rng } from '../src/engine/rng.ts';
import type { EstadoRegata, Mando } from '../src/engine/tipos.ts';

export type Piloto = (est: EstadoRegata, rng: Rng) => Mando;

export interface Medida {
  /** Minutos reales hasta que el jugador cruza la meta. */
  minutos: number;
  /** Velocidad media de las barcas que terminan, en m/s reales. */
  velocidadFlota: number;
  /** [KG3] Segundos reales del hueco más largo sin acontecimiento. */
  huecoMaximo: number;
  /** [KG4] Por minuto real, con histéresis. */
  ganadosPorMinuto: number;
  sufridosPorMinuto: number;
  /** Objetos que el jugador suelta, por minuto real. */
  objetosPorMinuto: number;
  /** Segundos reales del jugador en meta. */
  tiempo: number;
}

/** Corre la regata hasta que el jugador cruza la meta y la mide. */
export function medirRegata(inicial: EstadoRegata, rng: Rng, piloto: Piloto, ritmo: number, topeSim = 3600): Medida {
  let est = inicial;
  const yo0 = est.naves.find((n) => n.jugador)!;
  // [B-702] en espejo: las que salen DETRÁS ya están consolidadas detrás.
  let detras = new Set(est.naves.filter((n) => !n.jugador && n.metros < yo0.metros).map((n) => n.indice));
  let pendientes = new Map<number, number>();
  let ganados = 0;
  let usados = 0;
  let ultimo = 0;
  let hueco = 0;
  let huevosAntes = 0;
  let efectosAntes = 0;
  let objetoAntes = yo0.objeto;
  let sufridosAntes = 0;

  while (!est.terminada && est.reloj < topeSim) {
    const yo = est.naves.find((n) => n.jugador)!;
    if (yo.tiempoMeta !== null) break;
    est = avanzar(est, { mando: piloto(est, rng), ultimaVuelta: yo.vuelta >= est.circuito.vueltas - 1 }, rng);
    const j = est.naves.find((n) => n.jugador)!;
    if (j.tiempoMeta !== null) break;

    // Adelantamientos GANADOS: una rival que se queda detrás 3 s seguidos.
    const nuevasPendientes = new Map<number, number>();
    const nuevoDetras = new Set<number>();
    let gana = false;
    for (const r of est.naves) {
      if (r.jugador || r.tiempoMeta !== null || r.metros >= j.metros) continue;
      if (detras.has(r.indice)) {
        nuevoDetras.add(r.indice);
        continue;
      }
      const desde = pendientes.get(r.indice) ?? est.reloj;
      if (est.reloj - desde >= HISTERESIS_ADELANTAMIENTO) {
        ganados++;
        gana = true;
        nuevoDetras.add(r.indice);
      } else nuevasPendientes.set(r.indice, desde);
    }
    detras = nuevoDetras;
    pendientes = nuevasPendientes;

    let pasa = gana || est.adelantamientosSufridos !== sufridosAntes || j.huevosRotos !== huevosAntes || j.efectos.length > efectosAntes;
    if (objetoAntes !== null && j.objeto === null) {
      usados++;
      pasa = true;
    }
    sufridosAntes = est.adelantamientosSufridos;
    huevosAntes = j.huevosRotos;
    efectosAntes = j.efectos.length;
    objetoAntes = j.objeto;
    if (pasa) {
      hueco = Math.max(hueco, est.reloj - ultimo);
      ultimo = est.reloj;
    }
  }

  const yo = est.naves.find((n) => n.jugador)!;
  const tiempoSim = yo.tiempoMeta ?? est.reloj;
  const minutos = tiempoSim / ritmo / 60;
  const distancia = est.circuito.tramos.reduce((a, t) => a + t.longitud, 0) * est.circuito.vueltas;
  // Las que no llegan cuentan con lo que llevan: si no, la flota «va rápida»
  // porque solo se miden las rápidas.
  const velocidades = est.naves.map((n) => (n.tiempoMeta !== null ? distancia / n.tiempoMeta : n.metros / Math.max(1, est.reloj)));
  return {
    minutos,
    velocidadFlota: (ritmo * velocidades.reduce((a, v) => a + v, 0)) / velocidades.length,
    huecoMaximo: hueco / ritmo,
    ganadosPorMinuto: ganados / minutos,
    sufridosPorMinuto: est.adelantamientosSufridos / minutos,
    objetosPorMinuto: usados / minutos,
    tiempo: tiempoSim / ritmo,
  };
}
