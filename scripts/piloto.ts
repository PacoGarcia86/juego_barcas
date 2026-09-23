// El piloto de referencia del arnés: un jugador de pilotaje MEDIO.
//
// [B-704] El rango declarado de adelantamientos sufridos —`[1, 9]`— se mide
// contra este piloto y no contra otro. Un piloto perfecto saldría de rango por
// abajo y uno que no toca el mando, por arriba, y las dos cosas dirían más del
// piloto que del juego.
//
// No es la IA de las rivales: es deliberadamente más simple y no ataca a nadie.

import type { EstadoRegata, Mando } from '../src/engine/tipos.ts';
import type { Rng } from '../src/engine/rng.ts';
import { PASO } from '../src/engine/carrera.ts';
import { carrilesDisponiblesEn, haciaDentro, puntoDe, radioEfectivo } from '../src/engine/circuito.ts';
import { velocidadDeViraje } from '../src/engine/fisica.ts';
import { RITMO } from '../src/engine/ritmo.ts';

/**
 * [K-202] Probabilidad por tick de pisar en el último segundo y pico de la
 * cuenta atrás: la mitad de las veces pisa antes de los 0,7 s finales. Con eso
 * unas veces clava la salida, otras se ahoga y alguna llega tarde, que es lo
 * que hace alguien que no ha ensayado.
 */
const PISAR = 1 - Math.pow(0.5, PASO / (0.7 * RITMO));

export function pilotoMedio(est: EstadoRegata, rng: Rng): Mando {
  const yo = est.naves.find((n) => n.jugador);
  if (yo === undefined || yo.tiempoMeta !== null) return { gas: 0, timon: 0, usar: false };
  if (est.cuentaAtras > 0) {
    // Pisa en un momento sorteado del último segundo y pico. Lo que cuenta es la
    // PRIMERA vez que pide gas a tope, así que lo que haga después da igual.
    const pisa = est.cuentaAtras <= 1.2 * RITMO && rng.siguiente() < PISAR;
    return { gas: pisa ? 1 : 0, timon: 0, usar: false };
  }

  // Empuja fuerte mientras le quede energía, y levanta cuando se hunde.
  let gas = yo.energia > 45 ? 0.95 : yo.energia > 20 ? 0.8 : 0.7;

  // Levanta antes de la boya, pero se pasa de frenada un poco: es medio.
  const punto = puntoDe(est.circuito, yo.metros + yo.velocidad * 1.4);
  if (punto.tramo.tipo === 'curva') {
    const vMax = velocidadDeViraje(radioEfectivo(punto.tramo, yo.carril), yo.barca.maniobra, yo.barca.eslora);
    if (yo.velocidad > vMax * 1.06) gas = Math.min(gas, 0.4);
  }

  // Se cambia de carril si tiene a alguien pegado delante, con un tiempo de
  // reacción que no es inmediato.
  let timon = 0;
  const delante = est.naves.find(
    (n) => n.indice !== yo.indice && n.tiempoMeta === null && n.carril === yo.carril && n.metros > yo.metros && n.metros - yo.metros < 9,
  );
  if (delante !== undefined && rng.siguiente() < 0.08) timon = rng.siguiente() < 0.5 ? -1 : 1;

  // Suelta lo que lleve en cuanto tiene a alguien a tiro.
  const usar =
    yo.objeto !== null &&
    est.naves.some((n) => n.indice !== yo.indice && n.tiempoMeta === null && Math.abs(n.metros - yo.metros) < 55);

  return { gas, timon, usar };
}

/**
 * [KG5] El piloto experto: el medio, más las dos cosas que se aprenden. Clava
 * la salida y ciñe cada boya en la que va por dentro, cargando en los últimos
 * dos segundos de curva para soltar el miniturbo justo a la recta. Y, si entra
 * en una curva por fuera, busca el carril de dentro.
 */
export function pilotoExperto(est: EstadoRegata, rng: Rng): Mando {
  const yo = est.naves.find((n) => n.jugador);
  if (yo === undefined || yo.tiempoMeta !== null) return { gas: 0, timon: 0, usar: false };
  if (est.cuentaAtras > 0) return { gas: est.cuentaAtras <= 0.3 * RITMO ? 1 : 0, timon: 0, usar: false };

  const base = pilotoMedio(est, rng);
  const aqui = puntoDe(est.circuito, yo.metros);
  const dentro = haciaDentro(aqui.tramo, carrilesDisponiblesEn(est.circuito, yo.metros));
  if (dentro === null || base.timon !== 0) return base;
  if (yo.carril !== dentro.carril) return { ...base, timon: dentro.sentido };
  const quedan = ((1 - aqui.fraccion) * aqui.tramo.longitud) / Math.max(0.5, yo.velocidad);
  return quedan <= 2 * RITMO ? { ...base, timon: dentro.sentido } : base;
}
