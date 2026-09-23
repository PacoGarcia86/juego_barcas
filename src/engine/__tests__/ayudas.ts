// Utilidades compartidas por los tests. No es un test: no lleva `.test.ts`.

import type { Circuito, EstadoRegata, Mando, Oficio, Partida } from '../tipos.ts';
import { crearRegata, type Inscripcion } from '../carrera.ts';
import { circuitoPorId } from '../datos/circuitos.ts';
import { BARCAS, barcaPorId } from '../datos/barcas.ts';
import { barcaEfectiva } from '../barcas.ts';
import { huevosDe } from '../huevos.ts';
import { crearRng, type Rng } from '../rng.ts';
import { partidaNueva } from '../astillero.ts';

export function circuito(id: string): Circuito {
  const c = circuitoPorId(id);
  if (c === undefined) throw new Error(`no existe el circuito ${id}`);
  return c;
}

export interface Plantilla {
  barca: string;
  tripulacion: Oficio[];
}

/**
 * Monta una regata completa lista para simular en una línea.
 *
 * Por defecto: ocho barcas del catálogo, el jugador con la que se le diga, y
 * las rivales repartidas por el catálogo entero. Las vueltas se pueden recortar
 * para que un test no simule cuatro vueltas cuando le basta con una.
 */
export function montar(
  circuitoId: string,
  jugador: Plantilla = { barca: 'chalana', tripulacion: [] },
  opciones: { semilla?: number; rivales?: Plantilla[]; vueltas?: number; base?: Circuito; cuentaAtras?: number } = {},
): { est: EstadoRegata; rng: Rng; circuito: Circuito } {
  // `base` deja montar un circuito que no está en el catálogo: el arnés de
  // `K-001` lo usa para correr los circuitos de antes del recorte.
  const base = opciones.base ?? circuito(circuitoId);
  const c = opciones.vueltas === undefined ? base : { ...base, vueltas: opciones.vueltas };
  const rng = crearRng(opciones.semilla ?? 1234);
  // Siete rivales: el catálogo tiene seis barcas, así que se recorre en ciclo
  // y la séptima repite casco con otra dotación. Ocho en el agua, como declara
  // `B-401`.
  const dotaciones: Oficio[][] = [[], ['remero'], ['remero', 'timonel'], ['remero', 'remero'], ['contramaestre'], ['timonel'], ['remero', 'remero', 'timonel']];
  const rivales =
    opciones.rivales ??
    Array.from({ length: 7 }, (_, i) => {
      const b = BARCAS[i % BARCAS.length]!;
      return { barca: b.id, tripulacion: dotaciones[i]!.slice(0, b.plazas) };
    });

  // Las rivales se llaman como su barca: así el arnés y los fallos de test
  // dicen qué casco ganó, que es lo que se quiere saber.
  const vistas = new Map<string, number>();
  const inscritos: Inscripcion[] = [
    ...rivales.map((p) => {
      const barca = barcaPorId(p.barca);
      const nombre = barca?.nombre ?? p.barca;
      const repetida = (vistas.get(nombre) ?? 0) + 1;
      vistas.set(nombre, repetida);
      return inscribir(repetida === 1 ? nombre : `${nombre} ${repetida}`, p, false);
    }),
    inscribir('Tú', jugador, true),
  ];
  return { est: crearRegata(c, inscritos, rng, huevosDe(c), { cuentaAtras: opciones.cuentaAtras }), rng, circuito: c };
}

export function inscribir(nombre: string, plantilla: Plantilla, jugador: boolean): Inscripcion {
  const barca = barcaPorId(plantilla.barca);
  if (barca === undefined) throw new Error(`no existe la barca ${plantilla.barca}`);
  return { nombre, barca: barcaEfectiva(barca, plantilla.tripulacion), colores: barca.colores, jugador };
}

/** Un mando que no hace nada salvo lo que se le diga. */
export function mando(parcial: Partial<Mando> = {}): Mando {
  return { gas: 0.8, timon: 0, usar: false, ...parcial };
}

/** Una partida con los doblones que se pidan. */
export function partidaCon(doblones: number, extra: Partial<Partida> = {}): Partida {
  return { ...partidaNueva(), doblones, ...extra };
}

/** Un almacén en memoria para probar `progreso.ts` sin navegador. */
export function almacenFalso(): { get(k: string): string | null; set(k: string, v: string): void; borrar(k: string): void } {
  const mapa = new Map<string, string>();
  return {
    get: (k) => mapa.get(k) ?? null,
    set: (k, v) => void mapa.set(k, v),
    borrar: (k) => void mapa.delete(k),
  };
}

/** [P-104] Un almacén que lanza en todo, como Safari en privado. */
export function almacenQueLanza(): { get(k: string): string | null; set(k: string, v: string): void; borrar(k: string): void } {
  return {
    get() {
      throw new Error('SecurityError');
    },
    set() {
      throw new Error('QuotaExceededError');
    },
    borrar() {
      throw new Error('SecurityError');
    },
  };
}
