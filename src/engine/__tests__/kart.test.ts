// SPEC-006 · Ritmo de kart. Fase K2: la salida, la ceñida y las rivales que las usan.
// Fase K3: el encuadre, la cuenta atrás y los avisos.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { avanzar, CARGA_CORTA, CARGA_LARGA, CUENTA_ATRAS, miniturbo, PASO } from '../carrera.ts';
import { CLAVA_LA_SALIDA, decidir, salidaDeRival } from '../ia.ts';
import { RITMO } from '../ritmo.ts';
import { crearRng } from '../rng.ts';
import type { EstadoRegata, Mando, Nave, Personalidad } from '../tipos.ts';
import { fovPara } from '../../render/tresd/encuadre.ts';
import { MotorDeRegata } from '../../juego/motor.ts';
import { circuito, inscribir, mando, montar } from './ayudas.ts';

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

// ---------------------------------------------------------------------------
// Fase K3: que se note
// ---------------------------------------------------------------------------

test('[K-301] el FOV se abre con la velocidad de pantalla y el turbo lo pasa', () => {
  assert.equal(fovPara(0, 13, false), 62);
  assert.equal(fovPara(13, 13, false), 76);
  assert.equal(fovPara(13, 13, true), 82);
  assert.equal(fovPara(20, 13, false), 76, 'por encima de la velocidad de casco no se abre más sin turbo');
  let anterior = -Infinity;
  for (let v = 0; v <= 20; v += 0.5) {
    for (const turbo of [false, true]) {
      const fov = fovPara(v, 13, turbo);
      assert.ok(fov >= 62 && fov <= 82, `${fov}° a ${v} m/s`);
    }
    const fov = fovPara(v, 13, false);
    assert.ok(fov >= anterior, `no es monótona a ${v} m/s`);
    anterior = fov;
  }
});

test('[K-302] la cuenta atrás y los avisos no hablan en newtons', () => {
  const prohibidos = [/\bnewtons?\b/i, /\bempuje\b/i, /\bN\b/];
  for (const f of ['src/components/Cuenta.tsx', 'src/components/Avisos.tsx']) {
    // Sin comentarios: lo que queda son las cadenas y el JSX que se enseñan.
    const codigo = readFileSync(new URL(`../../../${f}`, import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/[^\n]*/g, ' ');
    const textos = [...codigo.matchAll(/'([^']*)'|`([^`]*)`|>([^<>{}]+)</g)].map((m) => m[1] ?? m[2] ?? m[3] ?? '').join(' ');
    for (const p of prohibidos) assert.ok(!p.test(textos), `${f} enseña «${textos.match(p)?.[0]}»`);
  }
});

test('[K-303] los avisos cuentan lo mismo que el marcador', () => {
  const { est, rng, circuito: c } = montar('canal', { barca: 'chalana', tripulacion: [] }, { semilla: 5, cuentaAtras: CUENTA_ATRAS });
  const cuenta = new Map<string, number>();
  let e = est;
  while (!e.terminada && e.reloj < 3600) {
    const j = jugadorDe(e);
    e = avanzar(e, { mando: mando({ gas: 0.95, usar: j.objeto !== null }), ultimaVuelta: j.vuelta >= c.vueltas - 1 }, rng);
    for (const a of e.avisos) cuenta.set(a.tipo, (cuenta.get(a.tipo) ?? 0) + 1);
  }
  assert.ok(e.adelantamientosSufridos > 0, 'la regata de prueba no tiene adelantamientos: no prueba nada');
  assert.equal(cuenta.get('teAdelantan') ?? 0, e.adelantamientosSufridos);
  assert.equal(cuenta.get('huevo') ?? 0, jugadorDe(e).huevosRotos);
  assert.ok((cuenta.get('usas') ?? 0) > 0, 'el jugador no soltó ningún objeto');
});

test('[K-303] la costura acumula los avisos: React no pinta cada tick', () => {
  const c = { ...circuito('canal'), vueltas: 1 };
  const motor = new MotorDeRegata(c, [inscribir('Tú', { barca: 'chalana', tripulacion: [] }, true)], 3, RITMO);
  // Pisa a tope en el último instante de la cuenta atrás: salida perfecta.
  while (motor.est.cuentaAtras > 0) motor.tictac(PASO, mando({ gas: motor.est.cuentaAtras <= 0.3 * RITMO ? 1 : 0 }));
  const recientes = motor.avisosRecientes(2);
  assert.ok(recientes.some((a) => a.aviso.tipo === 'turbo' && a.aviso.origen === 'salida'), JSON.stringify(recientes));
  // Diez segundos reales después ya no es reciente.
  for (let i = 0; i < 10 / PASO; i++) motor.tictac(PASO, mando({ gas: 0 }));
  assert.ok(!motor.avisosRecientes(2).some((a) => a.aviso.tipo === 'turbo' && a.aviso.origen === 'salida'));
});
