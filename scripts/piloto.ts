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
import { puntoDe, radioEfectivo } from '../src/engine/circuito.ts';
import { velocidadDeViraje } from '../src/engine/fisica.ts';

export function pilotoMedio(est: EstadoRegata, rng: Rng): Mando {
  const yo = est.naves.find((n) => n.jugador);
  if (yo === undefined || yo.tiempoMeta !== null) return { gas: 0, timon: 0, usar: false };

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
