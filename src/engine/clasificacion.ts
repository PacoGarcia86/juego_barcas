// [B-4xx] Clasificación y tiempos. PURO: sin azar, sin reloj propio, sin E/S.

import type { EstadoRegata, Nave } from './tipos.ts';

/**
 * [B-402] Orden de la regata. Devuelve los índices de las naves, de primera a
 * última.
 *
 * En carrera se ordena por metros; en meta, por tiempo. Una barca que ya llegó
 * va SIEMPRE por delante de una que no: sus metros están topados a la longitud
 * total y sin esta regla, dos barcas ya llegadas y una a punto empataban.
 */
export function clasificar(est: EstadoRegata): number[] {
  return est.naves
    .slice()
    .sort((a, b) => {
      if (a.tiempoMeta !== null && b.tiempoMeta !== null) return a.tiempoMeta - b.tiempoMeta;
      if (a.tiempoMeta !== null) return -1;
      if (b.tiempoMeta !== null) return 1;
      return b.metros - a.metros;
    })
    .map((n) => n.indice);
}

/** Plaza (1..n) de una nave. */
export function plazaDe(est: EstadoRegata, indice: number): number {
  return clasificar(est).indexOf(indice) + 1;
}

/**
 * [B-403] La diferencia se da **con el ganador**, nunca con el de delante: un
 * marcador que va sumando diferencias parciales no dice en qué regata estás.
 */
export function formatearDiferencia(segundos: number): string {
  if (segundos <= 0) return '—';
  return `+${segundos.toFixed(2).replace('.', ',')}`;
}

/** Tiempo de regata en `m:ss,cc`. */
export function formatearTiempo(segundos: number): string {
  const min = Math.floor(segundos / 60);
  const seg = segundos - min * 60;
  return `${min}:${seg < 10 ? '0' : ''}${seg.toFixed(2).replace('.', ',')}`;
}

/** Metros que le saca `a` a `b`. Negativo si va por detrás. */
export function ventajaEntre(a: Nave, b: Nave): number {
  return a.metros - b.metros;
}
