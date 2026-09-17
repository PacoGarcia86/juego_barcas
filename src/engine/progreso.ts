// [P-1xx] Guardar la partida.
//
// **Única excepción declarada a «el motor no hace E/S»** [B-903], y lo es a
// medias: recibe el almacén por parámetro y solo usa `localStorage` como valor
// por defecto. Así se prueba sin navegador, que es lo que permite comprobar de
// verdad el caso que se olvida siempre: **`localStorage` puede lanzar**. En
// navegación privada de iOS y con las cookies de terceros bloqueadas, el mero
// acceso tira una excepción, y el juego no arrancaba (`DP1`).

import type { Oficio, Partida } from './tipos.ts';
import { barcaPorId } from './datos/barcas.ts';
import { TRIPULANTES } from './datos/tripulantes.ts';
import { partidaNueva } from './astillero.ts';

const CLAVE = 'regata-2026';
/** [P-102] Sin esto, un cambio del catálogo deja partidas irrecuperables. */
export const VERSION = 1;

/** [P-105] El almacén se recibe: el motor no sabe qué es un navegador. */
export interface Almacen {
  get(clave: string): string | null;
  set(clave: string, valor: string): void;
  borrar(clave: string): void;
}

/** [P-104] Todo acceso en `try/catch`: el almacén puede lanzar en el `get`. */
const ALMACEN_NAVEGADOR: Almacen = {
  get(clave) {
    try {
      return globalThis.localStorage?.getItem(clave) ?? null;
    } catch {
      return null;
    }
  },
  set(clave, valor) {
    try {
      globalThis.localStorage?.setItem(clave, valor);
    } catch {
      /* almacenamiento bloqueado: el juego sigue, la partida no se guarda */
    }
  },
  borrar(clave) {
    try {
      globalThis.localStorage?.removeItem(clave);
    } catch {
      /* ídem */
    }
  },
};

const OFICIOS: Oficio[] = TRIPULANTES.map((t) => t.oficio);

/**
 * [P-102] Una partida de otra versión —o de un catálogo que ya no existe— sale
 * jugable o no sale.
 *
 * Un cambio del catálogo dejó partidas con `barcaEquipada` inexistente y el
 * juego entraba en regata con `undefined` (`DP2`). Aquí se descarta lo que ya
 * no existe en vez de confiar en que el dato guardado siga siendo válido.
 */
export function migrar(bruto: unknown): Partida | null {
  if (typeof bruto !== 'object' || bruto === null) return null;
  const d = bruto as Record<string, unknown>;
  const base = partidaNueva();

  const compradas = Array.isArray(d.barcasCompradas)
    ? d.barcasCompradas.filter((id): id is string => typeof id === 'string' && barcaPorId(id) !== undefined)
    : [];
  // La chalana no se puede perder: es la barca con la que se empieza [A-103].
  if (!compradas.includes('chalana')) compradas.unshift('chalana');

  const equipada = typeof d.barcaEquipada === 'string' && compradas.includes(d.barcaEquipada) ? d.barcaEquipada : 'chalana';

  const tripulantes = Array.isArray(d.tripulantes)
    ? d.tripulantes.filter((o): o is Oficio => typeof o === 'string' && OFICIOS.includes(o as Oficio))
    : [];

  // [A-203] Lo embarcado no puede pasar de las plazas de la barca ni de lo que
  // se tiene comprado.
  const plazas = barcaPorId(equipada)?.plazas ?? 0;
  const disponibles = tripulantes.slice();
  const embarcados: Oficio[] = [];
  if (Array.isArray(d.embarcados)) {
    for (const o of d.embarcados) {
      if (embarcados.length >= plazas) break;
      const i = disponibles.indexOf(o as Oficio);
      if (i < 0) continue;
      disponibles.splice(i, 1);
      embarcados.push(o as Oficio);
    }
  }

  return {
    version: VERSION,
    doblones: numero(d.doblones, base.doblones),
    barcasCompradas: compradas,
    barcaEquipada: equipada,
    tripulantes,
    embarcados,
    regatasCorridas: numero(d.regatasCorridas, 0),
    victorias: numero(d.victorias, 0),
    regatasLimpias: numero(d.regatasLimpias, 0),
  };
}

function numero(valor: unknown, porDefecto: number): number {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : porDefecto;
}

/** [P-104] Nunca lanza. Devuelve `null` si no hay nada o no se puede leer. */
export function cargar(almacen: Almacen = ALMACEN_NAVEGADOR): Partida | null {
  try {
    const bruto = almacen.get(CLAVE);
    if (bruto === null) return null;
    return migrar(JSON.parse(bruto));
  } catch {
    return null;
  }
}

/** [P-103] [P-104] Nunca lanza. Devuelve si pudo guardar. */
export function guardar(partida: Partida, almacen: Almacen = ALMACEN_NAVEGADOR): boolean {
  try {
    almacen.set(CLAVE, JSON.stringify({ ...partida, version: VERSION }));
    return almacen.get(CLAVE) !== null;
  } catch {
    return false;
  }
}

export function borrar(almacen: Almacen = ALMACEN_NAVEGADOR): void {
  // El `try/catch` va aquí y no solo en `ALMACEN_NAVEGADOR`: `P-104` promete
  // que NINGUNA de estas tres funciones lanza, con el almacén que sea, y un
  // almacén de pega que lanza en `borrar` hacía que reventara.
  try {
    almacen.borrar(CLAVE);
  } catch {
    /* almacenamiento bloqueado */
  }
}
