// SPEC-006 — La regata arcade: timón, cámara, ritmo, salida, ceñida, sucesos,
// y que todo lo que se lanza tenga cuerpo.

import test from 'node:test';
import assert from 'node:assert/strict';
import { avanzar, CENIDA_NIVEL_1, CENIDA_NIVEL_2 } from '../carrera.ts';
import { boyasDe, carrilesEn, inicioDeTramo } from '../circuito.ts';
import { BARCAS } from '../datos/barcas.ts';
import { CIRCUITOS } from '../datos/circuitos.ts';
import { TIPOS, usarObjeto } from '../objetos.ts';
import { crearRng } from '../rng.ts';
import { calidadDeSalida, CUENTA_ATRAS, darSalida } from '../salida.ts';
import type { EstadoRegata, Nave, TipoEfecto } from '../tipos.ts';
import {
  anchuraEn,
  construirTrazado,
  derechaDePantalla,
  posicionEn,
  retrasoDeCamara,
} from '../../render/tresd/trazado.ts';
import { CUERPO_DE_EFECTO, CUERPO_DE_OBJETO, Efectos } from '../../render/tresd/efectos.ts';
import { paletaDe } from '../../render/paleta.ts';
import { MotorDeRegata } from '../../juego/motor.ts';
import { RITMO } from '../../juego/ritmo.ts';
import { SONIDO_DE, sucesosEntre } from '../../juego/sucesos.ts';
import { NOMBRES_SONIDO } from '../../sonido/sintetizador.ts';
import { circuito, inscribir, mando, montar } from './ayudas.ts';

// ---------------------------------------------------------------------------
// K-1xx · Control y cámara
// ---------------------------------------------------------------------------

test('[K-101] el carril +1 cae a la derecha de la pantalla, en los cuatro circuitos', () => {
  for (const c of CIRCUITOS) {
    const t = construirTrazado(c);
    for (let m = 0; m < t.vuelta; m += 25) {
      const n = Math.max(2, Math.floor(anchuraEn(t, m) / 4.5));
      const a = posicionEn(t, m, 0, n);
      const b = posicionEn(t, m, 1, n);
      const d = derechaDePantalla(t, m);
      assert.ok((b.x - a.x) * d.x + (b.z - a.z) * d.z > 0, `${c.id} metro ${m}: ▶ lleva a la izquierda`);
    }
  }
});

test('[K-101] el interior del motor es el interior dibujado en todas las boyas', () => {
  let boyas = 0;
  for (const c of CIRCUITOS) {
    const t = construirTrazado(c);
    for (const boya of boyasDe(c)) {
      const tramo = c.tramos[boya.indiceTramo]!;
      const n = carrilesEn(tramo);
      const interior = tramo.radio > 0 ? 0 : n - 1;
      const antes = posicionEn(t, boya.metros - 8, 0, n);
      const despues = posicionEn(t, boya.metros + 8, 0, n);
      const centro = posicionEn(t, boya.metros, 0, n);
      const dentro = posicionEn(t, boya.metros, interior, n);
      const fuera = posicionEn(t, boya.metros, n - 1 - interior, n);
      // La cuerda antes→después se dobla hacia el centro de giro.
      const haciaCentro = { x: (antes.x + despues.x) / 2 - centro.x, z: (antes.z + despues.z) / 2 - centro.z };
      const producto = (dentro.x - fuera.x) * haciaCentro.x + (dentro.z - fuera.z) * haciaCentro.z;
      assert.ok(producto > 0, `${c.id} boya del tramo ${boya.indiceTramo}: el carril que acorta se dibuja por fuera`);
      boyas++;
    }
  }
  assert.equal(boyas, 14);
});

test('[K-102] la cámara nunca cae dentro del casco, y va más cerca que antes', () => {
  for (const b of BARCAS) {
    const retraso = retrasoDeCamara(b.eslora);
    assert.ok(retraso > b.eslora / 2 + 3, `${b.id}: cámara a ${retraso.toFixed(1)} m con ${b.eslora} m de eslora`);
    // `DK2`: con 13 + 1,15·eslora cabía una barca entera entre la cámara y la tuya.
    assert.ok(retraso < 13 + 1.15 * b.eslora, `${b.id}: la cámara no se ha acercado`);
  }
});

// ---------------------------------------------------------------------------
// K-2xx · Ritmo y salida
// ---------------------------------------------------------------------------

function motorDe(cuenta = CUENTA_ATRAS): MotorDeRegata {
  const c = { ...circuito('ria'), vueltas: 1 };
  const inscritos = [
    inscribir('Tú', { barca: 'chalana', tripulacion: [] }, true),
    ...['patin', 'lancha', 'trainera'].map((b) => inscribir(b, { barca: b, tripulacion: [] }, false)),
  ];
  return new MotorDeRegata(c, inscritos, 99, cuenta);
}

test('[K-202] durante la cuenta atrás nadie se mueve', () => {
  const motor = motorDe();
  for (let i = 0; i < 29; i++) motor.tictac(0.1, mando({ gas: 1 }));
  assert.equal(motor.est.reloj, 0);
  assert.ok(motor.est.naves.every((n) => n.velocidad === 0));
  for (let i = 0; i < 4; i++) motor.tictac(0.1, mando());
  assert.ok(motor.est.reloj > 0, 'tras la cuenta la regata arranca');
});

test('[K-201] cada segundo real son RITMO segundos de regata', () => {
  const motor = motorDe(0);
  for (let i = 0; i < 20; i++) motor.tictac(0.05, mando());
  assert.ok(Math.abs(motor.est.reloj - RITMO) < 0.051, `reloj ${motor.est.reloj}`);
});

test('[K-203] salida perfecta, normal y calada', () => {
  assert.equal(calidadDeSalida(0.5), 'perfecta');
  assert.equal(calidadDeSalida(1), 'perfecta');
  assert.equal(calidadDeSalida(1.5), 'normal');
  assert.equal(calidadDeSalida(null), 'normal');
  assert.equal(calidadDeSalida(2.5), 'calada');

  const { est } = montar('ria');
  const yo = est.naves.findIndex((n) => n.jugador);
  assert.equal(darSalida(est, yo, 'normal'), est);
  const perfecta = darSalida(est, yo, 'perfecta');
  assert.ok(perfecta.naves[yo]!.efectos.some((e) => e.tipo === 'turbo'));
  assert.equal(est.naves[yo]!.efectos.length, 0, 'darSalida no muta');
  const calada = darSalida(est, yo, 'calada');
  assert.ok(calada.naves[yo]!.efectos.some((e) => e.tipo === 'frenado' && e.factor < 0.5));
});

test('[K-203] la costura mide la salida: a tope desde el principio es calarse', () => {
  const calado = motorDe();
  for (let i = 0; i < 32; i++) calado.tictac(0.1, mando({ gas: 1 }));
  assert.equal(calado.salida, 'calada');

  const perfecto = motorDe();
  for (let i = 0; i < 32; i++) perfecto.tictac(0.1, mando({ gas: i >= 23 ? 1 : 0.72 }));
  assert.equal(perfecto.salida, 'perfecta');
});

/** Una regata con el jugador metido en la primera curva de `ria`, por dentro. */
function enLaCurva(carril: number): { est: EstadoRegata; yo: number; dentro: number } {
  const { est } = montar('ria', { barca: 'chalana', tripulacion: [] }, { vueltas: 1 });
  const c = est.circuito;
  const i = c.tramos.findIndex((t) => t.tipo === 'curva');
  const tramo = c.tramos[i]!;
  const yo = est.naves.findIndex((n) => n.jugador);
  const naves: Nave[] = est.naves.map((n) =>
    n.jugador
      ? { ...n, metros: inicioDeTramo(c, i) + 4, carril, carrilDestino: carril, velocidad: 3 }
      : { ...n, metros: 0, velocidad: 0 },
  );
  return { est: { ...est, naves }, yo, dentro: tramo.radio > 0 ? -1 : 1 };
}

function correr(est: EstadoRegata, segundos: number, timon: number): EstadoRegata {
  const rng = crearRng(1);
  let e = est;
  for (let k = 0; k < Math.round(segundos / 0.05); k++) {
    e = avanzar(e, { mando: mando({ gas: 0.8, timon }), ultimaVuelta: false }, rng);
  }
  return e;
}

test('[K-204] ceñir la boya carga, y al soltar da una racha de primer nivel', () => {
  const { est, yo, dentro } = enLaCurva(0);
  const interior = est.circuito.tramos.find((t) => t.tipo === 'curva')!.radio > 0 ? 0 : 3;
  const base = { ...est, naves: est.naves.map((n) => (n.indice === yo ? { ...n, carril: interior, carrilDestino: interior } : n)) };
  const cargado = correr(base, CENIDA_NIVEL_1 + 0.3, dentro);
  assert.ok(cargado.naves[yo]!.cenida >= CENIDA_NIVEL_1, `carga ${cargado.naves[yo]!.cenida}`);
  assert.ok(!cargado.naves[yo]!.efectos.some((e) => e.tipo === 'turbo'), 'aún no ha soltado');
  const suelto = correr(cargado, 0.05, 0);
  const turbo = suelto.naves[yo]!.efectos.find((e) => e.tipo === 'turbo');
  assert.ok(turbo !== undefined, 'al soltar no hay racha');
  assert.ok(turbo.restante <= 3 && turbo.restante > 2.8);
  assert.equal(suelto.naves[yo]!.cenida, 0);
});

test('[K-204] la ceñida larga da la racha de segundo nivel', () => {
  const { est, yo, dentro } = enLaCurva(0);
  const cargado = correr(est, CENIDA_NIVEL_2 + 0.2, dentro);
  assert.ok(cargado.naves[yo]!.cenida >= CENIDA_NIVEL_2);
  const turbo = correr(cargado, 0.05, 0).naves[yo]!.efectos.find((e) => e.tipo === 'turbo');
  assert.ok(turbo !== undefined && turbo.restante > 5.8);
});

test('[K-204] por fuera o en recta no se ciñe', () => {
  // Por fuera, apretar hacia dentro es cambiar de carril, no ceñir.
  const { est, yo, dentro } = enLaCurva(3);
  const fuera = correr(est, 1, dentro);
  assert.equal(fuera.naves[yo]!.cenida, 0);
  // En la recta de salida no hay boya que ceñir.
  const { est: recta } = montar('ria', { barca: 'chalana', tripulacion: [] }, { vueltas: 1 });
  const j = recta.naves.findIndex((n) => n.jugador);
  const r = correr({ ...recta, naves: recta.naves.map((n) => (n.jugador ? { ...n, carril: 0, carrilDestino: 0, velocidad: 3 } : n)) }, 1, -1);
  assert.equal(r.naves[j]!.cenida, 0);
});

test('[K-406] el resultado se fija al cruzar el jugador y no cambia al terminar las demás', () => {
  const motor = motorDe(0);
  let fijado = null;
  for (let i = 0; i < 40000 && !motor.terminada; i++) {
    motor.tictac(0.05, mando({ gas: 0.9 }));
    if (fijado === null && motor.final !== null) {
      fijado = motor.final;
      assert.ok(motor.est.naves[motor.jugador]!.tiempoMeta !== null);
    }
  }
  assert.ok(fijado !== null && motor.terminada);
  assert.deepEqual(motor.final, fijado);
});

// ---------------------------------------------------------------------------
// K-3xx · Lo que se ve
// ---------------------------------------------------------------------------

test('[K-301] todo objeto que puede quedar en el agua tiene cuerpo', () => {
  const { est } = montar('ria');
  // Un líder distinto de quien lanza, para que el kraken salga.
  const naves = est.naves.map((n, i) => ({ ...n, metros: i === 0 ? 400 : n.metros }));
  const e = { ...est, naves };
  const quien = e.naves.length - 1;
  const enVuelo = new Set<string>();
  for (const tipo of TIPOS) for (const o of usarObjeto(tipo, quien, e).objetos) enVuelo.add(o.tipo);
  assert.deepEqual([...enVuelo].sort(), ['ancla', 'kraken', 'ola']);
  for (const tipo of enVuelo) assert.ok(CUERPO_DE_OBJETO[tipo as keyof typeof CUERPO_DE_OBJETO], `${tipo} no tiene cuerpo`);
});

test('[K-302] los cinco efectos se ven', () => {
  const todos: TipoEfecto[] = ['turbo', 'frenado', 'giro', 'ciego', 'burbuja'];
  assert.deepEqual(Object.keys(CUERPO_DE_EFECTO).sort(), todos.slice().sort());
});

test('[K-306] los efectos caben en ocho llamadas de dibujo', () => {
  const efectos = new Efectos(paletaDe(circuito('ria')), 8, { cenida: [CENIDA_NIVEL_1, CENIDA_NIVEL_2], reaparicion: 2 });
  assert.ok(efectos.mallas() <= 8, `${efectos.mallas()} mallas`);
  // Y un fotograma con todo en el agua no revienta.
  const { est } = montar('ria');
  const t = construirTrazado(est.circuito);
  const lleno: EstadoRegata = {
    ...est,
    objetos: [
      { id: 1, tipo: 'ola', duenyo: 0, metros: 40, carril: 1, restante: 10, alcance: 100 },
      { id: 2, tipo: 'ancla', duenyo: 0, metros: 50, carril: 0, restante: 10, alcance: Infinity },
      { id: 3, tipo: 'kraken', duenyo: 0, metros: 60, carril: 2, restante: 10, alcance: Infinity },
    ],
    naves: est.naves.map((n, i) => ({
      ...n,
      cenida: i === 0 ? CENIDA_NIVEL_2 : 0,
      efectos: [{ tipo: (['turbo', 'burbuja', 'giro', 'ciego', 'frenado'] as const)[i % 5]!, restante: 1, factor: 1 }],
    })),
  };
  efectos.actualizar(est, t, 0, 0.1, 1 / 60, RITMO);
  efectos.actualizar(lleno, t, 1 / 60, 0.1, 1 / 60, RITMO);
  // La barca con `giro` nuevo ha recibido un golpe en este fotograma.
  assert.ok(efectos.golpeEn(2));
  efectos.destruir();
});

// ---------------------------------------------------------------------------
// K-4xx · Sucesos
// ---------------------------------------------------------------------------

function conJugador(est: EstadoRegata, cambio: Partial<Nave>): EstadoRegata {
  return { ...est, naves: est.naves.map((n) => (n.jugador ? { ...n, ...cambio } : n)) };
}

test('[K-404] sucesos: vuelta, última vuelta y meta', () => {
  const { est } = montar('ria');
  const yo = est.naves.findIndex((n) => n.jugador);
  assert.deepEqual(sucesosEntre(est, conJugador(est, { vuelta: 1 }), yo), [{ tipo: 'vuelta', vuelta: 2 }]);
  const penultima = conJugador(est, { vuelta: 1 });
  assert.deepEqual(sucesosEntre(penultima, conJugador(est, { vuelta: 2 }), yo), [{ tipo: 'ultimaVuelta' }]);
  const meta = sucesosEntre(est, conJugador(est, { tiempoMeta: 100 }), yo);
  assert.equal(meta[0]?.tipo, 'meta');
});

test('[K-404] sucesos: te pasan, adelantas, golpe, racha y ceñida', () => {
  const { est } = montar('ria');
  const yo = est.naves.findIndex((n) => n.jugador);
  const tipos = (d: EstadoRegata): string[] => sucesosEntre(est, d, yo).map((s) => s.tipo);
  assert.ok(tipos({ ...est, adelantamientosSufridos: 1 }).includes('tePasan'));
  assert.ok(tipos(conJugador(est, { metros: 10_000 })).includes('adelantas'));
  assert.ok(tipos(conJugador(est, { efectos: [{ tipo: 'giro', restante: 1, factor: 1 }] })).includes('golpe'));
  assert.ok(tipos(conJugador(est, { efectos: [{ tipo: 'turbo', restante: 3, factor: 1.65 }] })).includes('racha'));
  assert.ok(tipos(conJugador(est, { cenida: CENIDA_NIVEL_1 + 0.01 })).includes('cenida'));
  // Un efecto que solo decrece no es un golpe nuevo.
  const golpeado = conJugador(est, { efectos: [{ tipo: 'giro', restante: 1, factor: 1 }] });
  assert.ok(!sucesosEntre(golpeado, conJugador(est, { efectos: [{ tipo: 'giro', restante: 0.9, factor: 1 }] }), yo).some((s) => s.tipo === 'golpe'));
});

test('[K-404] sucesos: huevo y objeto al romperlo, lanzas al usarlo', () => {
  const { est } = montar('ria');
  const yo = est.naves.findIndex((n) => n.jugador);
  const roto = sucesosEntre(est, conJugador(est, { huevosRotos: 1, objeto: 'ola' }), yo);
  assert.deepEqual(roto, [{ tipo: 'huevo' }, { tipo: 'objeto', objeto: 'ola' }]);
  const conOla = conJugador(est, { objeto: 'ola' });
  assert.deepEqual(sucesosEntre(conOla, conJugador(est, { objeto: null }), yo), [{ tipo: 'lanzas', objeto: 'ola' }]);
});

test('[K-502] cada suceso suena, y con un sonido que existe', () => {
  for (const [suceso, sonido] of Object.entries(SONIDO_DE)) {
    assert.ok((NOMBRES_SONIDO as readonly string[]).includes(sonido), `${suceso} → ${sonido} no existe`);
  }
  for (const salida of ['cuenta', 'salida', 'perfecta', 'calada', 'ruleta']) {
    assert.ok((NOMBRES_SONIDO as readonly string[]).includes(salida), `falta el sonido ${salida}`);
  }
});
