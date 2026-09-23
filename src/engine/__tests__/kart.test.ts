// SPEC-006 · Ritmo de kart. Fase K2: la salida, la ceñida y las rivales que las usan.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { avanzar, CARGA_CORTA, CARGA_LARGA, CUENTA_ATRAS, miniturbo, PASO } from '../carrera.ts';
import { CLAVA_LA_SALIDA, decidir, salidaDeRival } from '../ia.ts';
import { RITMO } from '../ritmo.ts';
import { crearRng } from '../rng.ts';
import type { EstadoRegata, Mando, Nave, Personalidad } from '../tipos.ts';
import { mando, montar } from './ayudas.ts';

/** La ría: el tramo 1 es una curva de radio +30 entre los metros 102 y 222. Dentro = carril 0. */
const CURVA = { desde: 102, hasta: 222 };

function jugadorDe(est: EstadoRegata): Nave {
  return est.naves.find((n) => n.jugador)!;
}

/** Corre la cuenta atrás pidiendo gas a tope a partir de `pisarA` segundos REALES del final. */
function salir(pisarA: number | null, semilla = 4): EstadoRegata {
  const { est, rng } = montar('ria', { barca: 'chalana', tripulacion: [] }, { semilla, vueltas: 1, cuentaAtras: CUENTA_ATRAS });
  let e = est;
  while (e.cuentaAtras > 0) {
    assert.equal(e.reloj, 0, 'el reloj corre durante la cuenta atrás');
    const pisa = pisarA !== null && e.cuentaAtras <= pisarA * RITMO + 1e-9;
    e = avanzar(e, { mando: mando({ gas: pisa ? 1 : 0 }), ultimaVuelta: false }, rng);
  }
  return e;
}

test('[K-202] pisar en el último medio segundo da turbo de salida', () => {
  const e = salir(0.3);
  assert.ok(jugadorDe(e).efectos.some((x) => x.tipo === 'turbo'), 'sin turbo');
  assert.equal(e.reloj, 0);
});

test('[K-202] pisar antes de tiempo ahoga', () => {
  const efectos = jugadorDe(salir(1.5)).efectos;
  assert.ok(efectos.some((x) => x.tipo === 'frenado'), 'sin ahogo');
  assert.ok(!efectos.some((x) => x.tipo === 'turbo'), 'turbo tras pisar antes de tiempo');
});

test('[K-202] sin tocar el gas se sale sin nada', () => {
  assert.deepEqual(jugadorDe(salir(null)).efectos, []);
});

test('[K-202] misma semilla, misma salida', () => {
  assert.deepEqual(salir(0.3, 9), salir(0.3, 9));
});

test('[K-202] durante la cuenta atrás nadie avanza', () => {
  const { est, rng } = montar('canal', { barca: 'chalana', tripulacion: [] }, { semilla: 2, vueltas: 1, cuentaAtras: CUENTA_ATRAS });
  const metros = est.naves.map((n) => n.metros);
  let e = est;
  for (let i = 0; i < 20; i++) e = avanzar(e, { mando: mando({ gas: 1 }), ultimaVuelta: false }, rng);
  assert.deepEqual(e.naves.map((n) => n.metros), metros);
});

test('[K-203] el miniturbo depende de cuánto se ciñe', () => {
  assert.equal(miniturbo(0.5 * RITMO), null);
  assert.deepEqual(miniturbo(1.0 * RITMO), { tipo: 'turbo', restante: 1.2 * RITMO, factor: 6 });
  assert.deepEqual(miniturbo(2.0 * RITMO), { tipo: 'turbo', restante: 2.4 * RITMO, factor: 6 });
  assert.ok(CARGA_CORTA < CARGA_LARGA);
});

/** El jugador solo en la ría, colocado donde se diga. */
function soloEn(metros: number, carril: number, cargaMiniturbo = 0): { est: EstadoRegata; rng: ReturnType<typeof crearRng> } {
  const { est, rng } = montar('ria', { barca: 'chalana', tripulacion: [] }, { semilla: 1, vueltas: 1, rivales: [] });
  const naves = est.naves.map((n) => ({ ...n, metros, carril, carrilDestino: carril, velocidad: 3, cargaMiniturbo }));
  return { est: { ...est, naves, delante: [] }, rng };
}

function ticks(est: EstadoRegata, rng: ReturnType<typeof crearRng>, m: Mando, n: number): EstadoRegata {
  let e = est;
  for (let i = 0; i < n; i++) e = avanzar(e, { mando: m, ultimaVuelta: false }, rng);
  return e;
}

test('[K-203] ciñendo por dentro de la curva, el medidor sube', () => {
  const { est, rng } = soloEn(CURVA.desde + 10, 0);
  const e = ticks(est, rng, mando({ timon: -1 }), 20);
  assert.ok(Math.abs(jugadorDe(e).cargaMiniturbo - 20 * PASO) < 1e-9, `carga ${jugadorDe(e).cargaMiniturbo}`);
});

test('[K-203] fuera de la curva o fuera del carril interior, el medidor no sube', () => {
  const recta = soloEn(10, 0);
  assert.equal(jugadorDe(ticks(recta.est, recta.rng, mando({ timon: -1 }), 20)).cargaMiniturbo, 0);
  const fuera = soloEn(CURVA.desde + 10, 2);
  assert.equal(jugadorDe(ticks(fuera.est, fuera.rng, mando({ timon: -1 }), 1)).cargaMiniturbo, 0);
});

test('[K-203] soltar el timón con carga da el miniturbo', () => {
  const { est, rng } = soloEn(CURVA.desde + 10, 0, 1.0 * RITMO);
  const nave = jugadorDe(ticks(est, rng, mando({ timon: 0 }), 1));
  assert.equal(nave.cargaMiniturbo, 0);
  assert.ok(nave.efectos.some((x) => x.tipo === 'turbo' && x.factor === 6), 'sin miniturbo');
});

test('[K-203] salir de la curva ciñendo cuenta como soltar', () => {
  const { est, rng } = soloEn(CURVA.hasta - 1, 0, 2.0 * RITMO);
  let e = est;
  while (jugadorDe(e).metros < CURVA.hasta + 1) e = ticks(e, rng, mando({ timon: -1, gas: 1 }), 1);
  e = ticks(e, rng, mando({ timon: -1, gas: 1 }), 1);
  const nave = jugadorDe(e);
  assert.equal(nave.cargaMiniturbo, 0);
  assert.ok(nave.efectos.some((x) => x.tipo === 'turbo' && x.restante > 2 * RITMO), `efectos ${JSON.stringify(nave.efectos)}`);
});

test('[K-204] cada personalidad clava la salida en su proporción', () => {
  for (const p of Object.keys(CLAVA_LA_SALIDA) as Personalidad[]) {
    let clavadas = 0;
    for (let semilla = 1; semilla <= 40; semilla++) if (salidaDeRival(p, crearRng(semilla * 31 + p.length)) === 'turbo') clavadas++;
    const proporcion = clavadas / 40;
    assert.ok(Math.abs(proporcion - CLAVA_LA_SALIDA[p]) <= 0.15, `${p}: ${proporcion} contra ${CLAVA_LA_SALIDA[p]}`);
  }
});

/** Una rival en el carril interior a 7 m del final de la curva, y el jugador donde se diga. */
function rivalCinendo(personalidad: Personalidad, metrosJugador: number): Mando {
  const { est } = montar('ria', { barca: 'chalana', tripulacion: [] }, {
    semilla: 1,
    vueltas: 1,
    rivales: [{ barca: 'patin', tripulacion: [] }],
  });
  const naves = est.naves.map((n) =>
    n.jugador
      ? { ...n, metros: metrosJugador, carril: 2, carrilDestino: 2 }
      : { ...n, personalidad, metros: CURVA.hasta - 7, carril: 0, carrilDestino: 0, velocidad: 3 },
  );
  const e = { ...est, naves };
  return decidir(naves.find((n) => !n.jugador)!, e, false);
}

test('[K-204] la lanzada ciñe al final de la curva cuando caza al jugador', () => {
  assert.equal(rivalCinendo('lanzada', CURVA.hasta + 60).timon, -1);
});

test('[K-204] la regular no ciñe, y nadie ciñe por delante del jugador', () => {
  assert.equal(rivalCinendo('regular', CURVA.hasta + 60).timon, 0);
  assert.equal(rivalCinendo('lanzada', 20).timon, 0);
});
