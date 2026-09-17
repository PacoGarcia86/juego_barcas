// [R-6xx] La costura entre el motor y React.
//
// El motor va a **paso fijo** y el navegador dibuja cuando puede: aquí vive el
// acumulador que los separa [R-601]. Un fotograma lento no cambia la regata,
// que es lo que hace que `B-901` —misma semilla, misma regata— siga siendo
// cierto en un móvil que se atasca.

import { avanzar, crearRegata, PASO, resultadoDe, type Inscripcion } from '../engine/carrera.ts';
import { clasificar } from '../engine/clasificacion.ts';
import { doblonesDe } from '../engine/economia.ts';
import { huevosDe } from '../engine/huevos.ts';
import { crearRng, type Rng } from '../engine/rng.ts';
import type { Circuito, EstadoRegata, Mando, Resultado } from '../engine/tipos.ts';

/** Tope de pasos por fotograma: si la pestaña vuelve de segundo plano tras un
 *  minuto, no se simulan mil segundos de golpe y se cuelga el navegador. */
const TOPE_PASOS = 6;

export class MotorDeRegata {
  private estado: EstadoRegata;
  private readonly rng: Rng;
  private acumulado = 0;
  private resultado: Resultado | null = null;

  constructor(circuito: Circuito, inscritos: Inscripcion[], semilla: number) {
    this.rng = crearRng(semilla);
    this.estado = crearRegata(circuito, inscritos, this.rng, huevosDe(circuito));
  }

  get est(): EstadoRegata {
    return this.estado;
  }

  get terminada(): boolean {
    return this.estado.terminada;
  }

  /** Índice de la barca del jugador. */
  get jugador(): number {
    return this.estado.naves.findIndex((n) => n.jugador);
  }

  /** [R-601] Avanza el tiempo real `dt` en pasos fijos de `PASO`. */
  tictac(dt: number, mando: Mando): void {
    if (this.estado.terminada) return;
    this.acumulado += Math.min(dt, TOPE_PASOS * PASO);
    let pasos = 0;
    while (this.acumulado >= PASO && pasos < TOPE_PASOS && !this.estado.terminada) {
      const jugador = this.estado.naves[this.jugador];
      const ultimaVuelta = jugador !== undefined && jugador.vuelta >= this.estado.circuito.vueltas - 1;
      this.estado = avanzar(this.estado, { mando, ultimaVuelta }, this.rng);
      this.acumulado -= PASO;
      pasos++;
    }
    if (this.estado.terminada && this.resultado === null) {
      const r = resultadoDe(this.estado, 0);
      this.resultado = { ...r, doblones: doblonesDe(r) };
    }
  }

  /** [B-701] El resultado, una vez bajada la bandera. */
  get final(): Resultado | null {
    return this.resultado;
  }

  /** Clasificación en vivo: índices de primera a última. */
  get orden(): number[] {
    return clasificar(this.estado);
  }

  /** Plaza del jugador, 1..n. */
  get plaza(): number {
    return this.orden.indexOf(this.jugador) + 1;
  }
}
