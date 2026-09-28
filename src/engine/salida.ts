// [K-202] [K-203] La salida: la cuenta atrás y lo que vale clavarla.
//
// PURO. El motor no tiene reloj de pared: quien lleva la cuenta atrás es la
// costura (`juego/motor.ts`), que le pasa aquí CUÁNDO se pidió «a tope» y le
// pide a `darSalida` el efecto. El motor, entretanto, no ha dado ni un tick.

import type { EstadoRegata } from './tipos.ts';

/** [K-202] Segundos REALES de «3, 2, 1, ¡ya!». */
export const CUENTA_ATRAS = 3;
/** [K-203] Pedir «a tope» en este último tramo de la cuenta es una salida perfecta. */
export const VENTANA_PERFECTA = 1;
/** [K-203] Sostener «a tope» desde antes de esto es calarse. */
export const LIMITE_CALADA = 2;

export type CalidadDeSalida = 'perfecta' | 'normal' | 'calada';

/**
 * [K-203] `pedidoA`: segundos que faltaban para el ¡ya! cuando se pidió «a
 * tope» por última vez y se sostuvo hasta el final. `null` si al ¡ya! no se
 * iba a tope.
 */
export function calidadDeSalida(pedidoA: number | null): CalidadDeSalida {
  if (pedidoA === null) return 'normal';
  if (pedidoA > LIMITE_CALADA) return 'calada';
  if (pedidoA <= VENTANA_PERFECTA) return 'perfecta';
  return 'normal';
}

/**
 * [K-203] La salida sobre el estado de arranque. Una perfecta es una racha
 * (`H-201`): 3 s de regata a ×1,65. Una calada, 3 s a ×0,3. No muta `est`.
 */
export function darSalida(est: EstadoRegata, indice: number, calidad: CalidadDeSalida): EstadoRegata {
  if (calidad === 'normal') return est;
  const naves = est.naves.map((n) => {
    if (n.indice !== indice) return n;
    const efecto =
      calidad === 'perfecta'
        ? { tipo: 'turbo' as const, restante: 3, factor: 1.65 }
        : { tipo: 'frenado' as const, restante: 3, factor: 0.3 };
    return { ...n, efectos: [...n.efectos, efecto] };
  });
  return { ...est, naves };
}
