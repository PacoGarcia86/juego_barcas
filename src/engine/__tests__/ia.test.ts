// [B-5xx] La táctica de las rivales. El defecto más caro de la auditoría
// estaba aquí: una IA que no ataca no es una IA fácil, es un juego que no
// existe.

import test from 'node:test';
import assert from 'node:assert/strict';
import { carrilLibre, decidir, factorGoma, repartirPersonalidades } from '../ia.ts';
import { avanzar, PASO } from '../carrera.ts';
import { crearRng } from '../rng.ts';
import type { EstadoRegata, Personalidad } from '../tipos.ts';
import { mando, montar } from './ayudas.ts';

test('[B-501] las cuatro personalidades salen todas', () => {
  const vistas = new Set<Personalidad>();
  for (let s = 0; s < 50; s++) {
    for (const p of repartirPersonalidades(7, crearRng(s))) vistas.add(p);
  }
  assert.deepEqual(vistas, new Set<Personalidad>(['lanzada', 'rueda', 'sucia', 'regular']));
  assert.equal(repartirPersonalidades(7, crearRng(1)).length, 7);
});

test('[B-501] el reparto es reproducible con la semilla', () => {
  assert.deepEqual(repartirPersonalidades(7, crearRng(99)), repartirPersonalidades(7, crearRng(99)));
});

test('[B-502] una rival se cambia al carril del que va delante para coger su estela', () => {
  const { est, rng } = montar('ria');
  // Una rival sola, con alguien 14 m por delante en otro carril.
  const naves = est.naves.map((n, i) => {
    if (i === 0) return { ...n, jugador: false, metros: 100, carril: 0, carrilDestino: 0, velocidad: 4, personalidad: 'regular' as Personalidad };
    if (i === 1) return { ...n, jugador: false, metros: 114, carril: 1, carrilDestino: 1, velocidad: 4 };
    return { ...n, metros: 900 };
  });
  let e: EstadoRegata = { ...est, naves };
  let cambiado = false;
  for (let t = 0; t < Math.round(4 / PASO); t++) {
    e = avanzar(e, { mando: mando({ gas: 0 }), ultimaVuelta: false }, rng);
    // Se congela al de delante para que la situación se mantenga.
    e = { ...e, naves: e.naves.map((n, i) => (i === 1 ? { ...n, metros: e.naves[0]!.metros + 14 } : n)) };
    if (e.naves[0]!.carril === 1 || e.naves[0]!.carrilDestino === 1) cambiado = true;
  }
  assert.ok(cambiado, 'la rival no ha ido a buscar la estela');
});

test('[B-503] una rival adelanta al jugador en dos vueltas de la ría', () => {
  // Regresión de DB5: con las rivales empujando al máximo siempre, reventaban
  // en la vuelta 1 y el jugador terminaba con 0,0 adelantamientos de media.
  const { est, rng, circuito: c } = montar('ria', { barca: 'chalana', tripulacion: [] }, { semilla: 12, vueltas: 2 });
  let e = est;
  while (!e.terminada && e.reloj < 2400) {
    const jugador = e.naves.find((n) => n.jugador)!;
    // El jugador rueda a crucero: la IA tiene que venir a por él.
    e = avanzar(e, { mando: mando({ gas: 0.62, timon: 0 }), ultimaVuelta: jugador.vuelta >= c.vueltas - 1 }, rng);
  }
  assert.ok(e.adelantamientosSufridos > 0, 'nadie adelantó al jugador en dos vueltas');
});

test('[B-504] la goma elástica está acotada a [0,96; 1,06]', () => {
  // El borrador la escribió con ±10 % y los adelantamientos subieron a 11–16
  // por regata: la última vuelta era una remontada garantizada.
  for (let d = -2000; d <= 2000; d += 5) {
    const f = factorGoma(d, false);
    assert.ok(f >= 0.96 - 1e-9 && f <= 1.06 + 1e-9, `con ${d} m da ${f}`);
  }
  assert.ok(factorGoma(-500, false) > 1, 'por detrás tiene que ayudar');
  assert.ok(factorGoma(500, false) < 1, 'por delante tiene que frenar');
  assert.equal(factorGoma(0, false), 1);
});

test('[B-504] y se apaga en la última vuelta', () => {
  // El apagado no estaba en el borrador: es lo que devolvió los
  // adelantamientos a su rango.
  for (const d of [-2000, -200, 0, 200, 2000]) assert.equal(factorGoma(d, true), 1);
});

test('[B-304] `carrilLibre` dice que no cuando hay alguien al lado', () => {
  const { est } = montar('ria');
  const naves = est.naves.map((n, i) => ({ ...n, metros: 100, carril: i % 2, carrilDestino: i % 2 }));
  const e: EstadoRegata = { ...est, naves };
  assert.equal(carrilLibre(e, naves[0]!, 1), false, 'el carril de al lado está ocupado');
  assert.equal(carrilLibre(e, naves[0]!, -1), false, 'no existe el carril −1');
  assert.equal(carrilLibre(e, naves[0]!, 99), false, 'no existe el carril 99');
});

test('[B-505] una rival solo usa objetos que lleva en la mano', () => {
  const { est } = montar('ria');
  const sinObjeto = { ...est.naves[0]!, objeto: null, jugador: false };
  assert.equal(decidir(sinObjeto, est, false).usar, false);
  const conObjeto = { ...sinObjeto, objeto: 'turbo' as const };
  const juntas: EstadoRegata = { ...est, naves: est.naves.map((n) => ({ ...n, metros: 100 })) };
  assert.equal(typeof decidir(conObjeto, juntas, false).usar, 'boolean');
});

test('[B-505] en una regata entera, todo objeto usado salió de un huevo roto', () => {
  const { est, rng, circuito: c } = montar('faro', { barca: 'patin', tripulacion: ['timonel'] }, { semilla: 21, vueltas: 1 });
  let e = est;
  const huevosPorNave = new Map<number, number>();
  let objetosVistos = 0;
  while (!e.terminada && e.reloj < 2400) {
    const jugador = e.naves.find((n) => n.jugador)!;
    const antes = e.naves.map((n) => n.objeto);
    e = avanzar(e, { mando: mando({ gas: 0.9 }), ultimaVuelta: jugador.vuelta >= c.vueltas - 1 }, rng);
    e.naves.forEach((n, i) => {
      if (antes[i] === null && n.objeto !== null) objetosVistos++;
      huevosPorNave.set(i, n.huevosRotos);
    });
  }
  const huevosTotales = [...huevosPorNave.values()].reduce((a, b) => a + b, 0);
  assert.ok(objetosVistos > 0, 'nadie cogió ningún objeto');
  assert.ok(objetosVistos <= huevosTotales, `${objetosVistos} objetos de ${huevosTotales} huevos rotos`);
});

test('[B-5xx] una rival cegada por la niebla no busca estela', () => {
  const { est } = montar('ria');
  const base = est.naves.map((n, i) => {
    if (i === 0) return { ...n, jugador: false, metros: 100, carril: 0, carrilDestino: 0, velocidad: 4 };
    if (i === 1) return { ...n, jugador: false, metros: 114, carril: 1, carrilDestino: 1, velocidad: 4 };
    return { ...n, metros: 900 };
  });
  const viendo = decidir(base[0]!, { ...est, naves: base }, false);
  const cegada = { ...base[0]!, efectos: [{ tipo: 'ciego' as const, restante: 3, factor: 1 }] };
  const aCiegas = decidir(cegada, { ...est, naves: [cegada, ...base.slice(1)] }, false);
  assert.notEqual(viendo.timon, 0, 'viendo tendría que ir a por la estela');
  assert.equal(aCiegas.timon, 0, 'cegada no puede ver a quién seguir');
});
