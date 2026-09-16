// Regatas enteras. Es el test que se rompe cuando algo cambia cómo se corre,
// aunque todos los de unidad sigan en verde.
//
// El arnés de la puerta de fase es `npm run baseline`; esto es su versión
// corta, la que corre en cada `npm test`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { avanzar, PASO, resultadoDe } from '../carrera.ts';
import { crearRng } from '../rng.ts';
import { clasificar } from '../clasificacion.ts';
import { longitudDeVuelta } from '../circuito.ts';
import { doblonesDe } from '../economia.ts';
import { CIRCUITOS } from '../datos/circuitos.ts';
import type { EstadoRegata, Mando, Oficio } from '../tipos.ts';
import { montar } from './ayudas.ts';

/** Un piloto simple: gas alto, levanta cuando se queda sin energía. */
function pilotar(est: EstadoRegata): Mando {
  const yo = est.naves.find((n) => n.jugador)!;
  return {
    gas: yo.energia > 40 ? 0.95 : 0.75,
    timon: 0,
    usar: yo.objeto !== null && est.naves.some((n) => n.indice !== yo.indice && Math.abs(n.metros - yo.metros) < 55),
  };
}

function regata(circuitoId: string, barca: string, tripulacion: Oficio[], semilla: number) {
  const { est, rng, circuito: c } = montar(circuitoId, { barca, tripulacion }, { semilla });
  let e = est;
  while (!e.terminada && e.reloj < 3600) {
    const jugador = e.naves.find((n) => n.jugador)!;
    e = avanzar(e, { mando: pilotar(e), ultimaVuelta: jugador.vuelta >= c.vueltas - 1 }, rng);
  }
  return { est: e, circuito: c };
}

test('[realismo] las ocho barcas terminan los cuatro circuitos', () => {
  for (const c of CIRCUITOS) {
    const { est } = regata(c.id, 'trainera', ['timonel', 'remero'], 5);
    assert.ok(est.terminada, `${c.id}: la regata no terminó en una hora de simulación`);
    for (const n of est.naves) assert.ok(n.tiempoMeta !== null, `${c.id}: ${n.nombre} no llegó a meta`);
  }
});

test('[realismo] la velocidad media de una regata es de barca, no de lancha motora', () => {
  for (const c of CIRCUITOS) {
    const { est } = regata(c.id, 'patin', ['timonel'], 3);
    const distancia = longitudDeVuelta(c) * c.vueltas;
    const ganador = est.naves[clasificar(est)[0]!]!;
    const media = distancia / ganador.tiempoMeta!;
    assert.ok(media > 3 && media < 7, `${c.id}: media de ${media.toFixed(2)} m/s`);
  }
});

test('[realismo] la regata llega apretada: el segundo no se pierde de vista', () => {
  // Regresión de la estela binaria y de la IA que reventaba en la vuelta 1: las
  // dos daban regatas rotas, una por pegadas y la otra por deshilachadas.
  // La diferencia se mide en FRACCIÓN del tiempo del ganador, no en segundos.
  // El borrador ponía un tope absoluto de 45 s y no sobrevivió a la medición:
  // una regata de tres vueltas dura unos doce minutos, y ahí 45 s es un 6 %.
  // El mismo tope en una regata corta sería una eternidad y en una larga, nada.
  // Es el mismo criterio que usa `npm run baseline`.
  for (const semilla of [1, 2, 3, 4]) {
    const { est } = regata('ria', 'trainera', ['timonel', 'remero'], semilla);
    const orden = clasificar(est);
    const primero = est.naves[orden[0]!]!.tiempoMeta!;
    const segundo = est.naves[orden[1]!]!.tiempoMeta!;
    const fraccion = (segundo - primero) / primero;
    assert.ok(fraccion < 0.12, `el 2.º llegó a ${(segundo - primero).toFixed(1)} s, un ${(100 * fraccion).toFixed(1)} % del ganador`);
    assert.ok(segundo > primero, 'el 2.º no puede empatar con el ganador');
  }
});

test('[realismo] nadie termina con la energía intacta', () => {
  // Si se puede correr una regata entera sin gastar, la energía no existe.
  const { est } = regata('faro', 'galeota', ['timonel', 'remero', 'remero'], 7);
  const jugador = est.naves.find((n) => n.jugador)!;
  assert.ok(jugador.energia < 100, 'el jugador terminó con la energía a tope');
});

test('[realismo] el jugador rompe huevos y gana doblones en cualquier circuito', () => {
  for (const c of CIRCUITOS) {
    const { est } = regata(c.id, 'chalana', ['timonel'], 9);
    const r = resultadoDe(est, 0);
    assert.ok(r.huevos > 0, `${c.id}: el jugador no rompió ningún huevo`);
    assert.ok(doblonesDe(r) > 0, `${c.id}: correr no pagó nada`);
  }
});

test('[H-210] nada de lo que queda en el agua sobrevive a su propio reloj', () => {
  // Al bajar la bandera puede quedar algo flotando, y debe: un ancla soltada
  // veinte segundos antes todavía tiene cuerda. Lo que `H-210` promete es que
  // NADA se renueva solo, así que treinta segundos después no puede quedar ni
  // un objeto ni un efecto.
  for (const c of CIRCUITOS) {
    const { est } = regata(c.id, 'neumatica', ['timonel', 'remero'], 4);
    let e = est;
    for (let t = 0; t < Math.round(30 / PASO); t++) {
      e = avanzar(e, { mando: { gas: 0, timon: 0, usar: false }, ultimaVuelta: true }, crearRng(1));
    }
    assert.equal(e.objetos.length, 0, `${c.id}: quedan ${e.objetos.length} objetos treinta segundos después`);
    for (const n of e.naves) assert.equal(n.efectos.length, 0, `${c.id}: ${n.nombre} sigue con efectos treinta segundos después`);
  }
});

test('[realismo] cada circuito premia a una barca distinta', () => {
  // Si el mismo casco gana en los cuatro, el astillero no sirve para nada.
  const ganadores = new Set<string>();
  for (const c of CIRCUITOS) {
    const { est } = regata(c.id, 'chalana', ['timonel'], 6);
    ganadores.add(est.naves[clasificar(est)[0]!]!.nombre);
  }
  assert.ok(ganadores.size >= 2, `gana siempre la misma barca: ${[...ganadores].join(', ')}`);
});
