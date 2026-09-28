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
import { calidadDeSalida, CUENTA_ATRAS, darSalida, type CalidadDeSalida } from '../engine/salida.ts';
import type { Circuito, EstadoRegata, Mando, Resultado } from '../engine/tipos.ts';
import { RITMO } from './ritmo.ts';

/** Tope de pasos por fotograma: si la pestaña vuelve de segundo plano tras un
 *  minuto, no se simulan mil segundos de golpe y se cuelga el navegador. */
const TOPE_PASOS = 6 * RITMO;

export class MotorDeRegata {
  private estado: EstadoRegata;
  private readonly rng: Rng;
  private acumulado = 0;
  private resultado: Resultado | null = null;
  /** [K-202] Segundos reales que faltan para el ¡ya! */
  private queda: number;
  /** [K-203] Cuándo se pidió «a tope» (segundos antes del ¡ya!), si se sostiene. */
  private pedidoA: number | null = null;
  private calidad: CalidadDeSalida | null = null;

  constructor(circuito: Circuito, inscritos: Inscripcion[], semilla: number, cuentaAtras = CUENTA_ATRAS) {
    this.rng = crearRng(semilla);
    this.estado = crearRegata(circuito, inscritos, this.rng, huevosDe(circuito));
    this.queda = cuentaAtras;
  }

  /** [K-202] Segundos reales que faltan para la salida. 0 = ya se corre. */
  get cuenta(): number {
    return this.queda;
  }

  /** [K-203] Cómo fue la salida del jugador. `null` hasta el ¡ya! */
  get salida(): CalidadDeSalida | null {
    return this.calidad;
  }

  get est(): EstadoRegata {
    return this.estado;
  }

  get terminada(): boolean {
    return this.estado.terminada;
  }

  /** El jugador ha cruzado la meta. Las demás pueden seguir en el agua. */
  get enMeta(): boolean {
    return this.resultado !== null;
  }

  /** Índice de la barca del jugador. */
  get jugador(): number {
    return this.estado.naves.findIndex((n) => n.jugador);
  }

  /**
   * [R-601] Avanza el tiempo real `dt` en pasos fijos de `PASO`.
   *
   * [K-201] Cada segundo real son `RITMO` segundos de regata. [K-202] Mientras
   * dura la cuenta atrás no se da ni un tick: solo se mira cuándo se pide «a
   * tope», que es lo que decide la salida [K-203].
   */
  tictac(dt: number, mando: Mando): void {
    if (this.estado.terminada) return;
    if (this.queda > 0) {
      const aTope = mando.gas > 0.9;
      if (!aTope) this.pedidoA = null;
      else if (this.pedidoA === null) this.pedidoA = this.queda;
      this.queda = Math.max(0, this.queda - dt);
      if (this.queda > 0) return;
      this.calidad = calidadDeSalida(this.pedidoA);
      this.estado = darSalida(this.estado, this.jugador, this.calidad);
      return;
    }
    this.acumulado += Math.min(dt * RITMO, TOPE_PASOS * PASO);
    let pasos = 0;
    while (this.acumulado >= PASO && pasos < TOPE_PASOS && !this.estado.terminada) {
      const jugador = this.estado.naves[this.jugador];
      const ultimaVuelta = jugador !== undefined && jugador.vuelta >= this.estado.circuito.vueltas - 1;
      this.estado = avanzar(this.estado, { mando, ultimaVuelta }, this.rng);
      this.acumulado -= PASO;
      pasos++;
    }
    // [B-701] El resultado se fija al cruzar el JUGADOR, no al cruzar la
    // última: su plaza ya no cambia (una llegada va siempre delante, `B-402`)
    // y nadie puede adelantarle en la meta. Así la pantalla de meta sale al
    // llegar, como en el kart, y las rivales terminan detrás, en el agua.
    if (this.resultado === null && this.estado.naves[this.jugador]?.tiempoMeta != null) {
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
