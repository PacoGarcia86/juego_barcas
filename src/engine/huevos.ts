// [H-1xx] Los huevos: dónde flotan, cuándo vuelven y qué sale de ellos.
//
// [H-101] **LOS HUEVOS NO CUESTAN NADA.** Ni doblones, ni puntos, ni un recurso
// del jugador. Flotan en el circuito como las boyas y se rompen pasando por
// encima, tantas veces como quieras. Es la regla que define el sistema de
// objetos y es lo que pidió el usuario con todas las letras. Cualquier
// propuesta de «gastar N doblones por un objeto» contradice la especificación
// y se rechaza sin discutir; hay test estático que impide que este fichero
// importe la economía.

import type { Circuito, Huevo, TipoObjeto } from './tipos.ts';
import type { Rng } from './rng.ts';
import { elegirPonderado } from './rng.ts';
import { carrilesEn, longitudDeVuelta, puntoDe } from './circuito.ts';
import { pesosDePlaza, TIPOS } from './objetos.ts';

/** [H-102] Metros entre una fila de huevos y la siguiente. */
const PASO_ENTRE_FILAS = 180;
/**
 * [H-102] Huevos por fila, como mucho.
 *
 * Son SEIS, que es el máximo de carriles que tiene ningún tramo del juego, y
 * no cinco: con cinco, una barca que navegase por el carril exterior de un
 * tramo de seis carriles no encontraba un huevo en toda la regata. Se midió
 * en `faro` y `tormenta`, que son los anchos: 3 y 4 huevos rotos en una regata
 * entera contra los 17–20 de los circuitos estrechos.
 */
const POR_FILA = 6;
/**
 * [H-105] Segundos que tarda un huevo roto en volver.
 *
 * Son DOS, no los ocho del borrador. Los ocho venían de `DH2` —«una barca
 * parada sobre un huevo sacaba 19 objetos en 10 s»—, pero ese defecto no lo
 * arregla el reloj: lo arregla `huevoPisado`, que mira si el huevo cae DENTRO
 * del tramo recorrido en el tick. Una barca que no avanza no vuelve a cruzarlo,
 * y una que avanza lo cruza una vez por vuelta.
 *
 * Lo que sí hacían los ocho segundos era vaciar el circuito para todo el que no
 * fuese primero: ocho segundos a 4,5 m/s son treinta y seis metros, y una
 * regata va más apretada que eso. Medido sobre seis semillas de `ria`, el
 * jugador rompía **16, 17, 1, 18, 1 y 3** huevos según le tocara ir delante o
 * detrás de alguien. Con dos segundos —nueve metros— son **17, 18, 17, 18, 17 y
 * 18**. La ruleta de `H-104` le da los mejores objetos al que va último; de
 * poco sirve si el que va último no llega a coger ninguno.
 */
export const REAPARICION = 2;

/**
 * [H-102] Los huevos salen del circuito, no de una lista escrita a mano: si
 * mañana un tramo cambia de longitud, las filas se recolocan solas.
 *
 * Una fila cada 180 m, con un huevo por carril hasta cinco. En un estrecho de
 * dos carriles hay dos huevos, no cinco flotando sobre la orilla.
 */
export function huevosDe(circuito: Circuito): Huevo[] {
  const vuelta = longitudDeVuelta(circuito);
  const filas = Math.max(1, Math.round(vuelta / PASO_ENTRE_FILAS));
  const huevos: Huevo[] = [];
  for (let i = 0; i < filas; i++) {
    // Se desplaza media fila para no poner una justo en la línea de meta.
    const metros = ((i + 0.5) * vuelta) / filas;
    const carriles = Math.min(POR_FILA, carrilesEn(puntoDe(circuito, metros).tramo));
    for (let c = 0; c < carriles; c++) {
      huevos.push({ metros, carril: c, reaparece: 0 });
    }
  }
  return huevos;
}

/**
 * [H-104] [H-106] La ruleta. `plaza` es 1..`total`.
 *
 * El azar entra por aquí y solo por aquí: misma semilla ⇒ mismos objetos.
 *
 * [A-205] Con vigía a bordo, el peso del objeto más útil para esa plaza sube un
 * 15 % relativo. El vigía **no inventa objetos**: el conjunto posible es el
 * mismo, solo cambia el reparto.
 */
export function tirarRuleta(plaza: number, total: number, rng: Rng, vigia = false): TipoObjeto {
  const pesos = pesosDePlaza(plaza, total);
  if (vigia) {
    let mejor = 0;
    for (let i = 1; i < pesos.length; i++) if (pesos[i]! > pesos[mejor]!) mejor = i;
    pesos[mejor] = pesos[mejor]! * 1.15;
  }
  return TIPOS[elegirPonderado(rng, pesos)]!;
}

/** [H-105] Envejece los huevos rotos. Un huevo con `reaparece` 0 está entero. */
export function envejecerHuevos(huevos: readonly Huevo[], dt: number): Huevo[] {
  return huevos.map((h) => (h.reaparece <= 0 ? h : { ...h, reaparece: Math.max(0, h.reaparece - dt) }));
}

/**
 * [H-101] ¿Pasa esta barca por encima de un huevo entero?
 *
 * Devuelve el índice del huevo o −1. No cobra nada, no descuenta nada y no
 * recibe doblones: romper un huevo es gratis.
 */
export function huevoPisado(
  huevos: readonly Huevo[],
  circuito: Circuito,
  metrosAntes: number,
  metrosAhora: number,
  carril: number,
): number {
  const vuelta = longitudDeVuelta(circuito);
  const desde = metrosAntes % vuelta;
  const hasta = metrosAhora % vuelta;
  for (let i = 0; i < huevos.length; i++) {
    const h = huevos[i]!;
    if (h.reaparece > 0 || h.carril !== carril) continue;
    // El tramo recorrido en este tick puede dar la vuelta al circuito.
    const dentro = desde <= hasta ? h.metros > desde && h.metros <= hasta : h.metros > desde || h.metros <= hasta;
    if (dentro) return i;
  }
  return -1;
}
