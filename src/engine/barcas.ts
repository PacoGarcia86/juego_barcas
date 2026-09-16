// [A-1xx] De una barca del catálogo y una tripulación a lo único que la física
// llega a ver.
//
// `fisica.ts` no sabe qué es un remero: sabe que hay un empuje máximo y una
// masa [A-105]. Eso es la regla de capas aplicada dentro del propio motor, y
// es lo que impide que la tripulación acabe siendo un multiplicador de
// velocidad pegado en `carrera.ts` [A-204].

import type { Barca, BarcaEfectiva, Oficio } from './tipos.ts';
import { MASA_PATRON, velocidadDeCasco } from './fisica.ts';
import { aporteDe } from './tripulacion.ts';

/**
 * [A-206] Exponente del castigo de maniobra por peso embarcado.
 *
 * Una barca cargada tiene más inercia y tarda más en cambiar de rumbo. No es
 * una tasa de equilibrado: es la razón por la que llenar de remeros una barca
 * de seis plazas no es la jugada obvia. Sin este término, el frente de Pareto
 * de `A-102` seguía siendo correcto —ninguna barca dominaba a otra— y aun así
 * el catálogo estaba roto: con las ocho a dotación completa, la `trainera`
 * ganaba el 79 % de las regatas, porque las plazas eran la única
 * característica que llegaba a importar (`DA5`).
 */
const INERCIA = 0.9;

/**
 * [A-105] La conversión. La masa es casco + patrón + tripulantes [B-206].
 *
 * `maniobra` y `estabilidad` se topan en 99: un timonel no convierte una
 * galeota en una chalana, y sin el tope la suma de tres timoneles rompía el
 * frente de Pareto por la puerta de atrás.
 */
export function barcaEfectiva(barca: Barca, tripulacion: readonly Oficio[]): BarcaEfectiva {
  const aporte = aporteDe(tripulacion);
  const empujeMax = barca.empuje + aporte.empuje;
  const masaVacia = barca.masa + MASA_PATRON;
  const masa = masaVacia + aporte.peso;
  // [A-206] La inercia del peso embarcado se paga en el timón.
  const maniobra = Math.min(99, barca.maniobra + aporte.maniobra) * Math.pow(masaVacia / masa, INERCIA);
  return {
    eslora: barca.eslora,
    manga: barca.manga,
    empujeMax,
    // [A-107] El crucero lo declara la barca; el contramaestre lo sube.
    empujeCrucero: empujeMax * Math.min(0.95, barca.crucero + aporte.crucero),
    maniobra,
    estabilidad: Math.min(99, barca.estabilidad + aporte.estabilidad),
    masa,
    casco: barca.casco,
    coefOla: barca.coefOla,
    vigia: aporte.vigia,
    reparacion: aporte.reparacion,
  };
}

/**
 * [A-402] La velocidad de casco de una barca, para la ficha. En m/s, que es
 * lo que entiende el patrón: la interfaz no habla en newtons [H-302].
 */
export function velocidadDeCascoDe(barca: Barca): number {
  return velocidadDeCasco(barca.eslora);
}

/**
 * [A-102] ¿`a` domina a `b`? Domina si es mayor o igual en las cinco
 * características y estrictamente mayor en alguna. El catálogo no puede tener
 * ninguna pareja así, y hay test.
 */
export function domina(a: Barca, b: Barca): boolean {
  const campos: (keyof Barca)[] = ['eslora', 'empuje', 'maniobra', 'estabilidad', 'plazas'];
  let alguna = false;
  for (const c of campos) {
    const va = a[c] as number;
    const vb = b[c] as number;
    if (va < vb) return false;
    if (va > vb) alguna = true;
  }
  return alguna;
}
