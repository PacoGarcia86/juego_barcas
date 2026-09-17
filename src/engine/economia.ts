// [A-3xx] Qué paga cada resultado. PURO: recibe el recuento, no el circuito.
//
// [A-305] **No importa `huevos.ts` ni `objetos.ts`**, y hay test estático que
// lo impide. Es la otra cara de `H-101`: los huevos no cuestan doblones y los
// doblones no compran objetos. Las dos economías no se tocan.

/** [A-301] Premio por posición, en doblones. Correr siempre paga algo. */
const PREMIOS = [320, 220, 160, 120, 90, 70, 55, 45];

/** [A-302] Lo que paga terminar sin que te adelante nadie. Es el objetivo del juego. */
export const PREMIO_REGATA_LIMPIA = 150;

/** [A-303] Doblones por huevo roto. */
export const POR_HUEVO = 4;

/** [A-301] Premio de una posición. Fuera de la tabla, lo mínimo. */
export function premio(posicion: number): number {
  return PREMIOS[posicion - 1] ?? PREMIOS[PREMIOS.length - 1]!;
}

/**
 * [A-3xx] Lo que se lleva el jugador de una regata.
 *
 * Con el premio plano de 100 doblones de la auditoría, la segunda barca
 * (1 400 doblones) exigía catorce regatas ganando el cien por cien: el
 * astillero no se llegaba a ver (`DA2`).
 */
export function doblonesDe(r: { posicion: number; limpia: boolean; huevos: number }): number {
  return premio(r.posicion) + (r.limpia ? PREMIO_REGATA_LIMPIA : 0) + r.huevos * POR_HUEVO;
}
