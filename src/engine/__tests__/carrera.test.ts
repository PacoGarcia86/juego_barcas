// [B-3xx] [B-4xx] [B-7xx] El tick de regata, los carriles y el marcador que
// define el juego: cuántas veces te han adelantado.

import test from 'node:test';
import assert from 'node:assert/strict';
import { avanzar, crearRegata, HISTERESIS_ADELANTAMIENTO, ORDEN_DEL_TICK, PASO, resultadoDe, type ContextoConTraza } from '../carrera.ts';
import { clasificar, formatearDiferencia, formatearTiempo } from '../clasificacion.ts';
import { longitudTotal } from '../circuito.ts';
import { crearRng } from '../rng.ts';
import { huevosDe } from '../huevos.ts';
import type { EstadoRegata, Nave } from '../tipos.ts';
import { circuito, inscribir, mando, montar } from './ayudas.ts';

/** Corre una regata entera con un mando fijo. */
function correr(est: EstadoRegata, rng: ReturnType<typeof crearRng>, vueltas: number, m = mando()): EstadoRegata {
  let e = est;
  while (!e.terminada && e.reloj < 3600) {
    const jugador = e.naves.find((n) => n.jugador)!;
    e = avanzar(e, { mando: m, ultimaVuelta: jugador.vuelta >= vueltas - 1 }, rng);
  }
  return e;
}

test('[B-301] el tick ejecuta los ocho pasos, en orden y una sola vez', () => {
  const { est, rng } = montar('ria');
  const ctx: ContextoConTraza = { mando: mando(), ultimaVuelta: false, traza: [] };
  avanzar(est, ctx, rng);
  assert.deepEqual(ctx.traza, [...ORDEN_DEL_TICK]);
});

test('[B-301] `avanzar` no muta el estado que recibe', () => {
  const { est, rng } = montar('ria');
  const antes = JSON.stringify(est.naves.map((n) => ({ m: n.metros, v: n.velocidad })));
  avanzar(est, { mando: mando({ gas: 1 }), ultimaVuelta: false }, rng);
  assert.equal(JSON.stringify(est.naves.map((n) => ({ m: n.metros, v: n.velocidad }))), antes);
});

test('[B-302] una barca no se come a la de delante en su mismo carril', () => {
  const c = { ...circuito('ria'), vueltas: 1 };
  const rng = crearRng(4);
  // Dos barcas en el carril 0, la de atrás mucho más rápida.
  const inscritos = [
    inscribir('Lenta', { barca: 'chalana', tripulacion: [] }, false),
    inscribir('Rápida', { barca: 'galeota', tripulacion: ['timonel', 'remero', 'remero'] }, true),
  ];
  let est = crearRegata(c, inscritos, rng, huevosDe(c));
  est = {
    ...est,
    naves: est.naves.map((n, i) => ({ ...n, carril: 0, carrilDestino: 0, metros: i === 0 ? 40 : 0, velocidad: 3 })),
  };
  let minimo = Infinity;
  for (let t = 0; t < 600; t++) {
    est = avanzar(est, { mando: mando({ gas: 1, timon: 0 }), ultimaVuelta: true }, rng);
    const [a, b] = [est.naves[0]!, est.naves[1]!];
    if (a.tiempoMeta !== null || b.tiempoMeta !== null) break;
    if (a.carril === b.carril) minimo = Math.min(minimo, Math.abs(a.metros - b.metros));
  }
  assert.ok(minimo > 2.4, `llegaron a estar a ${minimo.toFixed(2)} m`);
});

test('[B-303] cambiar de carril cuesta agua', () => {
  // El jugador solo en el carril 0 de una recta ancha: nadie le estorba, así
  // que la única diferencia entre las dos carreras es el timón.
  const preparar = () => {
    const arranque = montar('ria', { barca: 'trainera', tripulacion: [] }, { semilla: 9, vueltas: 1 });
    const naves = arranque.est.naves.map((n) =>
      n.jugador ? { ...n, metros: 0, carril: 0, carrilDestino: 0 } : { ...n, metros: 600 },
    );
    return { ...arranque, est: { ...arranque.est, naves } };
  };
  const avance = (m: ReturnType<typeof mando>): number => {
    const arranque = preparar();
    let est = arranque.est;
    for (let t = 0; t < 100; t++) est = avanzar(est, { mando: m, ultimaVuelta: false }, arranque.rng);
    return est.naves.find((n) => n.jugador)!.metros;
  };
  const enLineaRecta = avance(mando({ gas: 1, timon: 0 }));
  const cambiando = avance(mando({ gas: 1, timon: 1 }));
  assert.ok(cambiando < enLineaRecta, `recto ${enLineaRecta.toFixed(2)} m, cambiando ${cambiando.toFixed(2)} m`);
});

test('[B-304] un cambio a un carril ocupado se rechaza y la barca no se teletransporta', () => {
  const { est, rng } = montar('ria', { barca: 'chalana', tripulacion: [] }, { semilla: 3 });
  // Se juntan todas las naves en el mismo metro para tapar todos los carriles.
  const apretadas: Nave[] = est.naves.map((n, i) => ({ ...n, metros: 100, carril: i % 4, carrilDestino: i % 4 }));
  const jugador = apretadas.find((n) => n.jugador)!;
  const carrilAntes = jugador.carril;
  const siguiente = avanzar({ ...est, naves: apretadas }, { mando: mando({ gas: 0, timon: 1 }), ultimaVuelta: false }, rng);
  const despues = siguiente.naves.find((n) => n.jugador)!;
  assert.equal(despues.carril, carrilAntes);
  assert.equal(despues.cambiando, 0, 'no ha empezado un cambio que no cabe');
});

test('[B-305] la meta se interpola dentro del tick', () => {
  // Dos barcas que cruzan en el mismo paso no pueden empatar a 50 ms: la
  // clasificación se decidiría por el orden del array.
  const { est, rng } = montar('ria', { barca: 'trainera', tripulacion: [] }, { semilla: 11, vueltas: 1 });
  const total = longitudTotal({ ...est.circuito, vueltas: 1 });
  const casi: Nave[] = est.naves.map((n, i) => ({ ...n, metros: total - 0.4 - i * 0.05, velocidad: 4 + i * 0.01 }));
  let fin = { ...est, naves: casi };
  for (let i = 0; i < 6; i++) fin = avanzar(fin, { mando: mando({ gas: 1 }), ultimaVuelta: true }, rng);
  const tiempos = fin.naves.map((n) => n.tiempoMeta).filter((t): t is number => t !== null);
  assert.ok(tiempos.length >= 2, 'no ha llegado nadie');
  assert.equal(new Set(tiempos).size, tiempos.length, 'hay tiempos de meta repetidos');
});

test('[B-401] el jugador nunca sale primero', () => {
  // Si sale primero no hay nadie a quien impedir que te adelante, y el contador
  // de `B-702` sale 0 por construcción y no por pilotar bien.
  const plazas = new Set<number>();
  for (let semilla = 0; semilla < 200; semilla++) {
    const { est } = montar('ria', { barca: 'chalana', tripulacion: [] }, { semilla });
    const jugador = est.naves.find((n) => n.jugador)!;
    const plaza = clasificar(est).indexOf(jugador.indice) + 1;
    assert.ok(plaza >= 4 && plaza <= 8, `salió ${plaza}.º con la semilla ${semilla}`);
    plazas.add(plaza);
  }
  assert.equal(plazas.size, 5, `solo salen las plazas ${[...plazas].sort().join(', ')}`);
});

test('[B-402] quien ya llegó va siempre por delante de quien no', () => {
  const { est } = montar('ria');
  const naves = est.naves.map((n, i) => ({ ...n, metros: 500 + i, tiempoMeta: i >= 6 ? 400 + i : null }));
  const orden = clasificar({ ...est, naves });
  assert.deepEqual(orden.slice(0, 2), [6, 7], 'los llegados no van delante');
});

test('[B-403] la diferencia se enseña con el ganador y con dos decimales', () => {
  assert.equal(formatearDiferencia(12.345), '+12,35');
  assert.equal(formatearDiferencia(0), '—');
  assert.equal(formatearTiempo(65.5), '1:05,50');
});

test('[B-702] un cruce corto no cuenta como adelantamiento', () => {
  // Regresión de DB6: comparando posiciones entre ticks, un cruce lateral
  // contaba hasta 14 adelantamientos en 0,4 s.
  const { est, rng } = montar('ria', { barca: 'chalana', tripulacion: [] }, { semilla: 5 });
  const jugador = est.naves.find((n) => n.jugador)!;
  // Una rival que va justo detrás, pasa un segundo y vuelve a caer.
  let e: EstadoRegata = {
    ...est,
    naves: est.naves.map((n) => ({ ...n, metros: n.jugador ? 100 : 50, velocidad: 0 })),
    delante: [],
    pendientes: [],
    adelantamientosSufridos: 0,
  };
  const rival = e.naves.find((n) => !n.jugador)!.indice;
  const mover = (metrosRival: number, segundos: number): void => {
    const pasos = Math.round(segundos / PASO);
    for (let i = 0; i < pasos; i++) {
      e = { ...e, naves: e.naves.map((n) => (n.indice === rival ? { ...n, metros: metrosRival } : n)) };
      e = avanzar(e, { mando: mando({ gas: 0 }), ultimaVuelta: false }, rng);
    }
  };
  mover(120, 1); // delante, pero solo un segundo
  mover(50, 1); // vuelve a caer
  assert.equal(e.adelantamientosSufridos, 0, 'un cruce de un segundo no es un adelantamiento');
  void jugador;
});

test('[B-702] aguantar delante más de tres segundos cuenta exactamente uno', () => {
  const { est, rng } = montar('ria', { barca: 'chalana', tripulacion: [] }, { semilla: 5 });
  let e: EstadoRegata = {
    ...est,
    naves: est.naves.map((n) => ({ ...n, metros: n.jugador ? 100 : 50, velocidad: 0 })),
    delante: [],
    pendientes: [],
    adelantamientosSufridos: 0,
  };
  const rival = e.naves.find((n) => !n.jugador)!.indice;
  const pasos = Math.round((HISTERESIS_ADELANTAMIENTO + 1) / PASO);
  for (let i = 0; i < pasos; i++) {
    e = { ...e, naves: e.naves.map((n) => (n.indice === rival ? { ...n, metros: 120 } : n)) };
    e = avanzar(e, { mando: mando({ gas: 0 }), ultimaVuelta: false }, rng);
  }
  assert.equal(e.adelantamientosSufridos, 1, 'tiene que contar una vez, ni cero ni varias');
});

test('[B-702] quien sale por delante no cuenta como adelantamiento', () => {
  const { est, rng } = montar('ria', { barca: 'chalana', tripulacion: [] }, { semilla: 2 });
  const jugador = est.naves.find((n) => n.jugador)!;
  const delanteAlSalir = est.naves.filter((n) => !n.jugador && n.metros > jugador.metros).length;
  assert.ok(delanteAlSalir > 0, 'la parrilla de prueba no tiene a nadie delante');
  let e = est;
  // Nadie se mueve: si los de delante contasen, contarían aquí.
  for (let i = 0; i < Math.round(6 / PASO); i++) {
    e = avanzar(e, { mando: mando({ gas: 0 }), ultimaVuelta: false }, rng);
  }
  assert.equal(e.adelantamientosSufridos, 0);
});

test('[B-701] [B-703] el resultado trae posición, regata limpia y huevos', () => {
  const { est, rng, circuito: c } = montar('ria', { barca: 'galeota', tripulacion: ['timonel', 'remero'] }, { semilla: 8, vueltas: 1 });
  const fin = correr(est, rng, c.vueltas, mando({ gas: 0.9 }));
  const r = resultadoDe(fin, 0);
  assert.ok(r.posicion >= 1 && r.posicion <= 8);
  assert.equal(r.ganada, r.posicion === 1);
  assert.equal(r.limpia, r.adelantamientosSufridos === 0);
  assert.ok(r.huevos >= 0);
  assert.equal(r.circuitoId, 'ria');
});

test('[BG4] misma semilla, misma regata, al milisegundo', () => {
  const huella = (): string => {
    const { est, rng, circuito: c } = montar('canal', { barca: 'patin', tripulacion: ['timonel'] }, { semilla: 42 });
    const fin = correr(est, rng, c.vueltas, mando({ gas: 0.92, timon: 0 }));
    return clasificar(fin).map((i) => `${i}:${fin.naves[i]!.tiempoMeta?.toFixed(6) ?? '-'}`).join('|');
  };
  const primera = huella();
  for (let i = 0; i < 5; i++) assert.equal(huella(), primera);
});
