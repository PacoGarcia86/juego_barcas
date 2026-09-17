// [R-1xx] El circuito, convertido en una polilínea en el mundo.
//
// **No importa `three`** [R-104] y por eso se prueba con números, sin abrir un
// navegador. Es la misma idea que `B-105`: la posición se calcula UNA vez, en
// el motor, y esto solo la coloca en el mundo. Cuando el render acumulaba su
// propia distancia, las boyas y las barcas divergían once metros tras tres
// vueltas y las barcas pasaban por dentro de las boyas (`DR5`).

import type { Circuito } from '../../engine/tipos.ts';

/** Metros entre dos puntos de la polilínea. */
const PASO = 4;
/** Metros de separación entre carriles. Coincide con `circuito.ts`. */
export const ANCHO_DE_CARRIL = 4.5;

export interface Trazado {
  /** Puntos del eje, cada `PASO` metros. */
  puntos: { x: number; z: number }[];
  /** Rumbo en radianes en cada punto. */
  rumbos: number[];
  /** Anchura navegable en cada punto, en metros. */
  anchuras: number[];
  /** Metros de una vuelta. */
  vuelta: number;
}

/**
 * [R-105] Giro total que dan las curvas de un circuito, en radianes.
 *
 * Un circuito cerrado tiene que girar una vuelta entera: `±2π`. Si no la da, no
 * es un circuito, es un camino — y no hay corrección de cierre que lo salve.
 */
export function giroTotalDe(circuito: Circuito): number {
  let total = 0;
  for (const tramo of circuito.tramos) {
    if (tramo.tipo === 'curva' && tramo.radio !== 0) total += tramo.longitud / tramo.radio;
  }
  return total;
}

/**
 * [R-101] Tramos → polilínea cerrada. Las curvas usan su radio; las rectas,
 * rumbo constante.
 *
 * **El cierre se arregla en el RUMBO, no en las posiciones.** La primera
 * versión repartía el error de cierre entre todos los puntos moviéndolos, y el
 * test de `R-101` pasaba —la polilínea cerraba con menos de metro y medio— con
 * el mundo **encogido un 25 %**: `faro` declaraba 1 380 m de vuelta y la
 * polilínea medía 1 037 m, y además desigualmente, 9 m en un sitio y 29 m en
 * otro para la misma distancia del motor. En pantalla eso era la cámara metida
 * dentro de la barca del jugador, que es como se vio.
 *
 * Ahora las curvaturas se escalan para que el giro sume exactamente `±2π` y el
 * rumbo cierre solo. Las longitudes de los tramos no se tocan, así que un metro
 * del motor es un metro del mundo. Lo que queda de error de posición es
 * pequeño y ese sí se reparte.
 */
export function construirTrazado(circuito: Circuito): Trazado {
  const crudos: { x: number; z: number; rumbo: number; anchura: number }[] = [];
  let x = 0;
  let z = 0;
  let rumbo = 0;

  // [R-105] Ajuste de cierre del rumbo. Si el dato ya da la vuelta entera, el
  // factor vale ~1 y no se nota; el test de datos exige que ande cerca.
  const giroTotal = giroTotalDe(circuito);
  const ajuste = Math.abs(giroTotal) < 0.5 ? 1 : (Math.sign(giroTotal) * 2 * Math.PI) / giroTotal;

  for (const tramo of circuito.tramos) {
    const pasos = Math.max(1, Math.round(tramo.longitud / PASO));
    const trozo = tramo.longitud / pasos;
    // En una curva, recorrer `trozo` metros de arco gira `trozo/radio` radianes.
    const giro = tramo.tipo === 'curva' && tramo.radio !== 0 ? (trozo / tramo.radio) * ajuste : 0;
    for (let i = 0; i < pasos; i++) {
      crudos.push({ x, z, rumbo, anchura: tramo.anchura });
      x += Math.sin(rumbo) * trozo;
      z += Math.cos(rumbo) * trozo;
      rumbo += giro;
    }
  }

  // [R-101] Lo que quede de error de posición se reparte, para no dejar un
  // salto en la línea de meta. Con el rumbo ya cerrado es un residuo pequeño y
  // no deforma las distancias.
  const n = crudos.length;
  const errorX = crudos[0]!.x - x;
  const errorZ = crudos[0]!.z - z;
  const puntos: { x: number; z: number }[] = [];
  const rumbos: number[] = [];
  const anchuras: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    puntos.push({ x: crudos[i]!.x + errorX * t, z: crudos[i]!.z + errorZ * t });
    rumbos.push(crudos[i]!.rumbo);
    anchuras.push(crudos[i]!.anchura);
  }
  let vuelta = 0;
  for (const tramo of circuito.tramos) vuelta += tramo.longitud;

  // [R-106] **Un metro del motor es un metro del mundo.** El reparto del error
  // de cierre encoge un poco la polilínea, así que al final se reescala para
  // que su perímetro sea exactamente la vuelta declarada. Sin esto, `faro`
  // dibujaba 1 037 m para los 1 380 m que declara —un 25 % menos— y la cámara,
  // que se coloca «veintidós metros por detrás», acababa dentro de la barca.
  let perimetro = 0;
  for (let i = 0; i < n; i++) {
    const a = puntos[i]!;
    const b = puntos[(i + 1) % n]!;
    perimetro += Math.hypot(a.x - b.x, a.z - b.z);
  }
  if (perimetro > 1) {
    const escala = vuelta / perimetro;
    for (const p of puntos) {
      p.x *= escala;
      p.z *= escala;
    }
  }

  // El rumbo se recalcula de la polilínea YA cerrada y YA reescalada: si se
  // dejara el rumbo acumulado, las barcas apuntarían a un sitio y navegarían a
  // otro.
  for (let i = 0; i < n; i++) {
    const a = puntos[i]!;
    const b = puntos[(i + 1) % n]!;
    rumbos[i] = Math.atan2(b.x - a.x, b.z - a.z);
  }

  return { puntos, rumbos, anchuras, vuelta };
}

/** Índice y peso de interpolación de unos metros dentro de la vuelta. */
function indiceDe(t: Trazado, metros: number): { i: number; j: number; f: number } {
  const n = t.puntos.length;
  const dentro = ((metros % t.vuelta) + t.vuelta) % t.vuelta;
  const exacto = (dentro / t.vuelta) * n;
  const i = Math.floor(exacto) % n;
  return { i, j: (i + 1) % n, f: exacto - Math.floor(exacto) };
}

/** [R-102] Punto del eje. Recibe los metros DEL MOTOR: no los acumula. */
export function puntoEn(t: Trazado, metros: number): { x: number; z: number } {
  const { i, j, f } = indiceDe(t, metros);
  const a = t.puntos[i]!;
  const b = t.puntos[j]!;
  return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f };
}

/** [R-102] Rumbo en radianes. Interpola por el camino corto. */
export function rumboEn(t: Trazado, metros: number): number {
  const { i, j, f } = indiceDe(t, metros);
  const a = t.rumbos[i]!;
  let d = t.rumbos[j]! - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * f;
}

/** Anchura navegable en esos metros. */
export function anchuraEn(t: Trazado, metros: number): number {
  return t.anchuras[indiceDe(t, metros).i]!;
}

/**
 * [R-103] Desplazamiento perpendicular de un carril, en metros. Es la MISMA
 * cuenta para barcas, boyas y huevos: si cada uno usara la suya, dejarían de
 * coincidir.
 */
export function lateralDe(carril: number, carriles: number, anchura: number): number {
  if (carriles <= 1) return 0;
  const util = Math.min(anchura, carriles * ANCHO_DE_CARRIL);
  const paso = util / carriles;
  return (carril - (carriles - 1) / 2) * paso;
}

/** Posición en el mundo de una barca: eje + desplazamiento de carril. */
export function posicionEn(
  t: Trazado,
  metros: number,
  carril: number,
  carriles: number,
): { x: number; z: number; rumbo: number } {
  const p = puntoEn(t, metros);
  const rumbo = rumboEn(t, metros);
  const lateral = lateralDe(carril, carriles, anchuraEn(t, metros));
  // Perpendicular al rumbo, a estribor.
  return { x: p.x + Math.cos(rumbo) * lateral, z: p.z - Math.sin(rumbo) * lateral, rumbo };
}

/**
 * [R-501] El punto al que mira la cámara: el trazado por DELANTE de la barca,
 * no el eje de la barca. En una curva, esa es la diferencia entre ver la regata
 * y ver la orilla (`DR3`).
 */
export const MIRA_ADELANTE = 34;

export function puntoDeMira(t: Trazado, metros: number): { x: number; z: number } {
  return puntoEn(t, metros + MIRA_ADELANTE);
}
