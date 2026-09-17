// [B-901] Toda la aleatoriedad del juego pasa por aquí.
//
// `Math.random` está prohibido en `src/engine/`, `src/render/` y `src/modes/`:
// una regata tiene que poder repetirse exactamente para poder depurarla, para
// que el arnés de `scripts/` mida lo mismo dos veces, y para que la ruleta de
// objetos (`H-106`) reparta lo mismo con la misma semilla. Un test estático lo
// vigila.

/** Estado de un generador. Se serializa en el guardado sin perder nada. */
export interface Rng {
  /** Devuelve un flotante en [0, 1). */
  siguiente(): number;
  /** Semilla actual. Guardarla y restaurarla reproduce la secuencia. */
  estado(): number;
}

/**
 * mulberry32: 32 bits de estado, distribución buena de sobra para lo que decide
 * aquí (parrilla, ruleta, personalidades) y trivial de serializar.
 */
export function crearRng(semilla: number): Rng {
  let s = semilla >>> 0;
  return {
    siguiente() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    estado() {
      return s;
    },
  };
}

/** Entero en [min, max] ambos incluidos. */
export function entero(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng.siguiente() * (max - min + 1));
}

/** Flotante en [min, max). */
export function rango(rng: Rng, min: number, max: number): number {
  return min + rng.siguiente() * (max - min);
}

/**
 * Normal(0,1) por Box-Muller. La usan la forma del día de las rivales y la
 * dispersión de la parrilla: con uniformes, los extremos salían demasiado a
 * menudo y todas las regatas acababan igual.
 */
export function normal(rng: Rng): number {
  const u = Math.max(rng.siguiente(), 1e-12);
  const v = rng.siguiente();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Elige un elemento. Lanza si la lista está vacía: elegir de la nada es un fallo. */
export function elegir<T>(rng: Rng, lista: readonly T[]): T {
  if (lista.length === 0) throw new Error('elegir() sobre una lista vacía');
  return lista[Math.floor(rng.siguiente() * lista.length)]!;
}

/** Baraja Fisher-Yates sobre una copia. No muta la entrada. */
export function barajar<T>(rng: Rng, lista: readonly T[]): T[] {
  const copia = lista.slice();
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rng.siguiente() * (i + 1));
    [copia[i], copia[j]] = [copia[j]!, copia[i]!];
  }
  return copia;
}

/**
 * [H-104] Elige de una lista de pesos. Devuelve el índice.
 * Los pesos negativos se tratan como 0: un peso negativo es un fallo del dato,
 * no una forma de excluir un objeto.
 */
export function elegirPonderado(rng: Rng, pesos: readonly number[]): number {
  let total = 0;
  for (const p of pesos) total += Math.max(0, p);
  if (total <= 0) throw new Error('elegirPonderado() sin peso positivo');
  let u = rng.siguiente() * total;
  for (let i = 0; i < pesos.length; i++) {
    u -= Math.max(0, pesos[i]!);
    if (u < 0) return i;
  }
  return pesos.length - 1;
}

/** Semilla estable a partir de un texto: mismo circuito ⇒ misma costa. */
export function semillaDeTexto(texto: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
