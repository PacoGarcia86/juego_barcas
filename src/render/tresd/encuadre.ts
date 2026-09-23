// [K-301] El campo de visión, en función de lo rápido que va la barca EN
// PANTALLA. Puro y sin `three`: por eso se prueba con números, como `trazado.ts`.
//
// Antes se abría de 62° a 76° a 8 m/s escritos a mano, y ninguna barca pasaba
// de 5,7 m/s: el FOV no llegaba de 72° y la cámara nunca transmitía velocidad
// punta (SPEC-006 `DK6`). Ahora el tope es la velocidad de casco de la barca
// seguida, así que cada casco llega a «lanzado» a su propia velocidad, y el
// turbo lo pasa.

export const FOV_PARADO = 62;
export const FOV_LANZADO = 76;
export const FOV_TURBO = 82;

/**
 * [K-301] `vPantalla` y `vCascoPantalla` en las mismas unidades (m/s de
 * pantalla: la velocidad del motor por `RITMO`). Monótona en `vPantalla`.
 */
export function fovPara(vPantalla: number, vCascoPantalla: number, turbo: boolean): number {
  const fraccion = Math.min(1, Math.max(0, vPantalla / Math.max(0.01, vCascoPantalla)));
  const base = FOV_PARADO + (FOV_LANZADO - FOV_PARADO) * fraccion;
  // Con turbo se añade lo que falta hasta 82° en la misma proporción: parado
  // con turbo no se lanza nada, y a velocidad de casco con turbo, 82°.
  return turbo ? base + (FOV_TURBO - FOV_LANZADO) * fraccion : base;
}
