// [B-1xx] El circuito: tramos, vueltas, carriles, corriente y oleaje.
//
// Este fichero es la ÚNICA conversión de distancia a posición del proyecto
// [B-105]. Si el render se pone a acumular su propia distancia, las boyas y las
// barcas dejan de coincidir: pasó, y divergían hasta once metros tras tres
// vueltas (`DR5`).
//
// Puro: sin azar, sin reloj, sin E/S.

import type { Circuito, Punto, Tramo } from './tipos.ts';

/** Metros de agua que necesita una barca para tener carril propio [B-103]. */
const ANCHO_DE_CARRIL = 4.5;

/** Longitud de una vuelta en metros. */
export function longitudDeVuelta(circuito: Circuito): number {
  let total = 0;
  for (const t of circuito.tramos) total += t.longitud;
  return total;
}

/** Longitud total de la regata: vuelta × vueltas. */
export function longitudTotal(circuito: Circuito): number {
  return longitudDeVuelta(circuito) * circuito.vueltas;
}

/** [B-103] Carriles utilizables en un tramo. Mínimo 2: siempre se puede adelantar. */
export function carrilesEn(tramo: Tramo): number {
  return Math.max(2, Math.floor(tramo.anchura / ANCHO_DE_CARRIL));
}

/**
 * [B-105] La conversión. `metrosGlobales` puede ser cualquier real: se
 * normaliza a la vuelta.
 */
export function puntoDe(circuito: Circuito, metrosGlobales: number): Punto {
  const vueltaLarga = longitudDeVuelta(circuito);
  const m = metrosGlobales < 0 ? 0 : metrosGlobales;
  const vuelta = Math.floor(m / vueltaLarga);
  let resto = m - vuelta * vueltaLarga;
  for (let i = 0; i < circuito.tramos.length; i++) {
    const tramo = circuito.tramos[i]!;
    if (resto < tramo.longitud || i === circuito.tramos.length - 1) {
      return {
        vuelta,
        metrosEnVuelta: m - vuelta * vueltaLarga,
        indiceTramo: i,
        tramo,
        fraccion: Math.min(1, resto / tramo.longitud),
      };
    }
    resto -= tramo.longitud;
  }
  // Inalcanzable: el bucle siempre devuelve en el último tramo.
  throw new Error('circuito sin tramos');
}

/** Metros a los que empieza un tramo dentro de la vuelta. */
export function inicioDeTramo(circuito: Circuito, indice: number): number {
  let m = 0;
  for (let i = 0; i < indice; i++) m += circuito.tramos[i]!.longitud;
  return m;
}

/** [B-106] Corriente en un punto, m/s con signo. */
export function corrienteEn(circuito: Circuito, metrosGlobales: number): number {
  return puntoDe(circuito, metrosGlobales).tramo.corriente;
}

/**
 * [B-107] Oleaje efectivo: el del circuito más el del tramo, acotado a [0, 1].
 * El acotado no es cosmético: `resistenciaDeOleaje` lo multiplica por la masa
 * entera, y un 1,4 suelto convertía el tramo de mar abierto en un muro.
 */
export function oleajeEn(circuito: Circuito, metrosGlobales: number): number {
  const p = puntoDe(circuito, metrosGlobales);
  return Math.min(1, Math.max(0, circuito.oleajeBase + p.tramo.oleaje));
}

/** [B-103] Carriles disponibles en un punto. */
export function carrilesDisponiblesEn(circuito: Circuito, metrosGlobales: number): number {
  return carrilesEn(puntoDe(circuito, metrosGlobales).tramo);
}

/**
 * [B-306] Metros de la vuelta en los que hay boya: una por cada tramo `curva`,
 * en su punto medio. Las coloca el render con `puntoEn` [R-402], no con
 * coordenadas escritas a mano.
 */
export function boyasDe(circuito: Circuito): { metros: number; radio: number; indiceTramo: number }[] {
  const boyas: { metros: number; radio: number; indiceTramo: number }[] = [];
  circuito.tramos.forEach((tramo, i) => {
    if (tramo.tipo !== 'curva') return;
    boyas.push({ metros: inicioDeTramo(circuito, i) + tramo.longitud / 2, radio: tramo.radio, indiceTramo: i });
  });
  return boyas;
}

/**
 * [B-306] Factor de longitud del recorrido según el carril en una curva.
 *
 * Por fuera se recorre más agua; por dentro, menos. El carril interior de una
 * curva a estribor (`radio > 0`) es el 0. Fuera de una curva, todos los
 * carriles recorren lo mismo: en una recta el carril no alarga nada.
 */
export function factorDeCarril(tramo: Tramo, carril: number): number {
  if (tramo.tipo !== 'curva') return 1;
  const carriles = carrilesEn(tramo);
  if (carriles <= 1) return 1;
  // 0 = interior, 1 = exterior.
  const fuera = tramo.radio > 0 ? carril / (carriles - 1) : 1 - carril / (carriles - 1);
  return 0.98 + 0.06 * fuera;
}

/**
 * [B-306] Penalización de viraje por ir pegado a la boya. Por dentro se recorta
 * agua pero se vira más cerrado: el radio efectivo es menor.
 */
export function radioEfectivo(tramo: Tramo, carril: number): number {
  if (tramo.tipo !== 'curva') return 0;
  const carriles = carrilesEn(tramo);
  const fuera = carriles <= 1 ? 1 : tramo.radio > 0 ? carril / (carriles - 1) : 1 - carril / (carriles - 1);
  return Math.abs(tramo.radio) * (0.88 + 0.24 * fuera);
}

/**
 * [K-203] El carril interior de una curva y hacia dónde queda. Con radio
 * positivo el de dentro es el 0 (el de radio efectivo menor, `radioEfectivo`),
 * y con radio negativo, el último. Fuera de una curva no hay «dentro».
 */
export function haciaDentro(tramo: Tramo, carriles: number): { carril: number; sentido: -1 | 1 } | null {
  if (tramo.tipo !== 'curva') return null;
  return tramo.radio > 0 ? { carril: 0, sentido: -1 } : { carril: carriles - 1, sentido: 1 };
}
