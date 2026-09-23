// [K-101] El ritmo de kart se cambia en el RELOJ, no en la física.
//
// El motor sigue simulando regatas de remo con pasos de `PASO` segundos de
// simulación: la eslora, el planeo y la estela (`B-202`, `B-203`, `B-201`) no se
// enteran. Lo que cambia es cuántos segundos de simulación caben en un segundo
// de pantalla, y eso lo decide la costura (`juego/motor.ts`), no el motor.
//
// Reescalar la física para que las barcas fueran de verdad a 9 m/s obligaba a
// reescribir `B-202` y `B-203` y buena parte de `realismo.test.ts` (SPEC-006
// `KQ1`). El reloj no toca nada de eso: todas las puertas de SPEC-001/002/003
// siguen en segundos de simulación y siguen valiendo.

/** [K-101] Segundos de simulación por segundo real. */
export const RITMO = 3;

/** [K-103] Lo que el jugador tiene que LEER va en segundos reales. */
export function segundosReales(segundosDeSimulacion: number, ritmo: number = RITMO): number {
  return segundosDeSimulacion / ritmo;
}
