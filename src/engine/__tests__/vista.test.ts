// SPEC-007 — Que se vea y que suene: timón al derecho, cámara de persecución,
// objetos y efectos con cuerpo, sucesos de pantalla y sonido.

import test from 'node:test';
import assert from 'node:assert/strict';
import { CARGA_CORTA, CARGA_LARGA } from '../carrera.ts';
import { boyasDe, carrilesEn } from '../circuito.ts';
import { BARCAS } from '../datos/barcas.ts';
import { CIRCUITOS } from '../datos/circuitos.ts';
import { TIPOS, usarObjeto } from '../objetos.ts';
import { RITMO } from '../ritmo.ts';
import type { Aviso, EstadoRegata, Nave, TipoEfecto } from '../tipos.ts';
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
import { SONIDO_DE_SUCESO, sonidoDeAviso, sucesosEntre } from '../../juego/sucesos.ts';
import { NOMBRES_SONIDO } from '../../sonido/sintetizador.ts';
import { circuito, inscribir, mando, montar } from './ayudas.ts';

const UMBRALES = { cenida: [CARGA_CORTA * RITMO, CARGA_LARGA * RITMO] as const, reaparicion: 2 };

// ---------------------------------------------------------------------------
// V-1xx · Control y cámara
// ---------------------------------------------------------------------------

test('[V-101] el carril +1 cae a la derecha de la pantalla, en los cuatro circuitos', () => {
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

test('[V-101] el interior del motor es el interior dibujado en todas las boyas', () => {
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

test('[V-102] la cámara nunca cae dentro del casco, y va más cerca que antes', () => {
  for (const b of BARCAS) {
    const retraso = retrasoDeCamara(b.eslora);
    assert.ok(retraso > b.eslora / 2 + 3, `${b.id}: cámara a ${retraso.toFixed(1)} m con ${b.eslora} m de eslora`);
    // `DV2`: con 13 + 1,15·eslora cabía una barca entera entre la cámara y la tuya.
    assert.ok(retraso < 13 + 1.15 * b.eslora, `${b.id}: la cámara no se ha acercado`);
  }
});

// ---------------------------------------------------------------------------
// V-2xx · Lo que se ve
// ---------------------------------------------------------------------------

test('[V-201] todo objeto que puede quedar en el agua tiene cuerpo', () => {
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

test('[V-202] los cinco efectos se ven', () => {
  const todos: TipoEfecto[] = ['turbo', 'frenado', 'giro', 'ciego', 'burbuja'];
  assert.deepEqual(Object.keys(CUERPO_DE_EFECTO).sort(), todos.slice().sort());
});

test('[V-206] los efectos caben en ocho llamadas de dibujo, y un golpe nuevo se detecta', () => {
  const efectos = new Efectos(paletaDe(circuito('ria')), 8, UMBRALES);
  assert.ok(efectos.mallas() <= 8, `${efectos.mallas()} mallas`);
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
      cargaMiniturbo: i === 0 ? UMBRALES.cenida[1] : 0,
      efectos: [{ tipo: (['turbo', 'burbuja', 'giro', 'ciego', 'frenado'] as const)[i % 5]!, restante: 1, factor: 1 }],
    })),
  };
  efectos.actualizar(est, t, 0, 0.1, 1 / 60, RITMO);
  efectos.actualizar(lleno, t, 1 / 60, 0.1, 1 / 60, RITMO);
  assert.ok(efectos.golpeEn(2), 'la barca con `giro` nuevo no cuenta como golpeada');
  assert.ok(!efectos.golpeEn(1), 'una burbuja no es un golpe');
  efectos.destruir();
});

// ---------------------------------------------------------------------------
// V-3xx · La interfaz
// ---------------------------------------------------------------------------

function conJugador(est: EstadoRegata, cambio: Partial<Nave>): EstadoRegata {
  return { ...est, naves: est.naves.map((n) => (n.jugador ? { ...n, ...cambio } : n)) };
}

test('[V-304] sucesos: vuelta, última vuelta y meta', () => {
  const { est } = montar('ria', undefined, { vueltas: 3 });
  const yo = est.naves.findIndex((n) => n.jugador);
  assert.deepEqual(sucesosEntre(est, conJugador(est, { vuelta: 1 }), yo), [{ tipo: 'vuelta', vuelta: 2 }]);
  const penultima = conJugador(est, { vuelta: 1 });
  assert.deepEqual(sucesosEntre(penultima, conJugador(est, { vuelta: 2 }), yo), [{ tipo: 'ultimaVuelta' }]);
  assert.equal(sucesosEntre(est, conJugador(est, { tiempoMeta: 100 }), yo)[0]?.tipo, 'meta');
});

test('[V-304] sucesos: el objeto sale al romper un huevo, no al usarlo', () => {
  const { est } = montar('ria');
  const yo = est.naves.findIndex((n) => n.jugador);
  assert.deepEqual(sucesosEntre(est, conJugador(est, { huevosRotos: 1, objeto: 'ola' }), yo), [{ tipo: 'objeto', objeto: 'ola' }]);
  const conOla = conJugador(est, { objeto: 'ola' });
  assert.deepEqual(sucesosEntre(conOla, conJugador(est, { objeto: null }), yo), []);
});

function motorDe(): MotorDeRegata {
  const c = { ...circuito('ria'), vueltas: 1 };
  const inscritos = [
    inscribir('Tú', { barca: 'chalana', tripulacion: [] }, true),
    ...['patin', 'lancha', 'trainera'].map((b) => inscribir(b, { barca: b, tripulacion: [] }, false)),
  ];
  return new MotorDeRegata(c, inscritos, 99);
}

test('[V-306] el resultado se fija al cruzar el jugador y no cambia al terminar las demás', () => {
  const motor = motorDe();
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
// V-4xx · El sonido
// ---------------------------------------------------------------------------

test('[V-402] cada suceso y cada aviso del motor suenan, con un sonido que existe', () => {
  const existe = (s: string): boolean => (NOMBRES_SONIDO as readonly string[]).includes(s);
  for (const [suceso, sonido] of Object.entries(SONIDO_DE_SUCESO)) assert.ok(existe(sonido), `${suceso} → ${sonido}`);
  const avisos: Aviso[] = [
    { tipo: 'teAdelantan', quien: 0 },
    { tipo: 'adelantas', quien: 0 },
    { tipo: 'huevo' },
    { tipo: 'usas', objeto: 'ola' },
    { tipo: 'golpe' },
    { tipo: 'ahogo' },
    { tipo: 'turbo', origen: 'salida' },
    { tipo: 'turbo', origen: 'cenir' },
    { tipo: 'turbo', origen: 'objeto' },
  ];
  for (const a of avisos) assert.ok(existe(sonidoDeAviso(a)), `${a.tipo} → ${sonidoDeAviso(a)}`);
  for (const s of ['cuenta', 'salida', 'ruleta']) assert.ok(existe(s), `falta ${s}`);
});

test('[V-402] la costura entrega cada aviso del motor una sola vez', () => {
  const motor = motorDe();
  let total = 0;
  for (let i = 0; i < 2000; i++) {
    motor.tictac(0.05, mando({ gas: 1, usar: i % 40 === 0 }));
    total += motor.sacarAvisosNuevos().length;
  }
  assert.equal(motor.sacarAvisosNuevos().length, 0);
  assert.ok(total > 0, 'en 100 s de regata no ha pasado nada');
});
