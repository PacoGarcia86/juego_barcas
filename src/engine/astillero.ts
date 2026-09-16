// [A-3xx] Comprar barcas y tripulantes.
//
// [A-304] **No se compra sin fondos.** Devuelven el estado sin tocar y un
// motivo. Sin esa comprobación, dos compras dejaron el saldo en −900 doblones y
// el progreso dejó de significar nada (`DA4`).
//
// Sin E/S: quien guarda es `progreso.ts`.

import type { Oficio, Partida } from './tipos.ts';
import { barcaPorId, BARCAS } from './datos/barcas.ts';
import { tripulantePorOficio } from './datos/tripulantes.ts';
import { desembarcar, embarcar, plazasLibres } from './tripulacion.ts';

/** Qué ha impedido una operación. `null` = se hizo. */
export type Motivo = 'fondos' | 'repetida' | 'desconocida' | 'plazas' | 'no-la-tienes' | null;

export interface Resultado {
  partida: Partida;
  motivo: Motivo;
}

/** [A-2xx] Lo que se recupera al vender un tripulante. */
const REVENTA = 0.6;

/** [A-304] Comprar una barca. */
export function comprarBarca(partida: Partida, id: string): Resultado {
  const barca = barcaPorId(id);
  if (barca === undefined) return { partida, motivo: 'desconocida' };
  if (partida.barcasCompradas.includes(id)) return { partida, motivo: 'repetida' };
  if (partida.doblones < barca.precio) return { partida, motivo: 'fondos' };
  return {
    partida: {
      ...partida,
      doblones: partida.doblones - barca.precio,
      barcasCompradas: [...partida.barcasCompradas, id],
    },
    motivo: null,
  };
}

/** Equipar una barca que ya se tiene. Al cambiar de barca, se desembarca a todos. */
export function equiparBarca(partida: Partida, id: string): Resultado {
  if (!partida.barcasCompradas.includes(id)) return { partida, motivo: 'no-la-tienes' };
  if (partida.barcaEquipada === id) return { partida, motivo: null };
  const barca = barcaPorId(id);
  if (barca === undefined) return { partida, motivo: 'desconocida' };
  // [A-203] La barca nueva puede tener menos plazas: se recorta la dotación en
  // vez de dejar gente a bordo de una barca donde no cabe.
  return {
    partida: { ...partida, barcaEquipada: id, embarcados: partida.embarcados.slice(0, barca.plazas) },
    motivo: null,
  };
}

/** [A-304] Comprar un tripulante. Comprarlo NO lo embarca [A-203]. */
export function comprarTripulante(partida: Partida, oficio: Oficio): Resultado {
  const t = tripulantePorOficio(oficio);
  if (partida.doblones < t.precio) return { partida, motivo: 'fondos' };
  return {
    partida: {
      ...partida,
      doblones: partida.doblones - t.precio,
      tripulantes: [...partida.tripulantes, oficio],
    },
    motivo: null,
  };
}

/** [AQ2] Vender un tripulante al 60 %: una compra mala no bloquea la partida. */
export function venderTripulante(partida: Partida, oficio: Oficio): Resultado {
  const i = partida.tripulantes.indexOf(oficio);
  if (i < 0) return { partida, motivo: 'no-la-tienes' };
  const t = tripulantePorOficio(oficio);
  return {
    partida: {
      ...partida,
      doblones: partida.doblones + Math.round(t.precio * REVENTA),
      tripulantes: [...partida.tripulantes.slice(0, i), ...partida.tripulantes.slice(i + 1)],
      embarcados: desembarcar(partida.embarcados, oficio),
    },
    motivo: null,
  };
}

/** [A-203] Subir a bordo. Las plazas de la barca mandan. */
export function subirABordo(partida: Partida, oficio: Oficio): Resultado {
  const barca = barcaPorId(partida.barcaEquipada);
  if (barca === undefined) return { partida, motivo: 'desconocida' };
  const enTierra = cuentaEnTierra(partida, oficio);
  if (enTierra <= 0) return { partida, motivo: 'no-la-tienes' };
  const { embarcados, motivo } = embarcar(barca, partida.embarcados, oficio);
  if (motivo !== null) return { partida, motivo: 'plazas' };
  return { partida: { ...partida, embarcados }, motivo: null };
}

/** Bajar a tierra. */
export function bajarATierra(partida: Partida, oficio: Oficio): Resultado {
  return { partida: { ...partida, embarcados: desembarcar(partida.embarcados, oficio) }, motivo: null };
}

/** Cuántos de ese oficio están comprados pero no embarcados. */
export function cuentaEnTierra(partida: Partida, oficio: Oficio): number {
  const tiene = partida.tripulantes.filter((o) => o === oficio).length;
  const abordo = partida.embarcados.filter((o) => o === oficio).length;
  return tiene - abordo;
}

/** [A-403] Plazas libres de la barca equipada. */
export function plazasLibresDe(partida: Partida): number {
  const barca = barcaPorId(partida.barcaEquipada);
  if (barca === undefined) return 0;
  return plazasLibres(barca, partida.embarcados);
}

/** [A-103] La partida con la que se empieza: la chalana, gratis y sin nadie a bordo. */
export function partidaNueva(): Partida {
  return {
    version: 1,
    doblones: 0,
    barcasCompradas: ['chalana'],
    barcaEquipada: 'chalana',
    tripulantes: [],
    embarcados: [],
    regatasCorridas: 0,
    victorias: 0,
    regatasLimpias: 0,
  };
}

/** Las barcas que todavía no se tienen, de más barata a más cara. */
export function enVenta(partida: Partida) {
  return BARCAS.filter((b) => !partida.barcasCompradas.includes(b.id)).sort((a, b) => a.precio - b.precio);
}
