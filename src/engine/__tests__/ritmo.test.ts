// SPEC-006 · Ritmo de kart. Fase K1: el arnés, el reloj, las vueltas y los huevos.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PASO } from '../carrera.ts';
import { longitudDeVuelta } from '../circuito.ts';
import { CIRCUITOS } from '../datos/circuitos.ts';
import { huevosDe, PASO_ENTRE_FILAS } from '../huevos.ts';
import { RITMO, segundosReales } from '../ritmo.ts';
import { MotorDeRegata } from '../../juego/motor.ts';
import { CIRCUITOS_ORIGINALES } from '../../../scripts/circuitos-originales.ts';
import { medirRegata } from '../../../scripts/medida-diversion.ts';
import { pilotoMedio } from '../../../scripts/piloto.ts';
import { circuito, inscribir, mando, montar } from './ayudas.ts';

test('[K-001] el arnés de diversión mide una regata con cifras que caben en ella', () => {
  const { est, rng } = montar('canal', { barca: 'chalana', tripulacion: [] }, { semilla: 3, vueltas: 1 });
  const m = medirRegata(est, rng, pilotoMedio, RITMO);
  const segundos = m.minutos * 60;
  assert.ok(segundos > 0, 'la regata no dura nada');
  assert.ok(m.huecoMaximo >= 0 && m.huecoMaximo <= segundos, `hueco de ${m.huecoMaximo} s en una regata de ${segundos} s`);
  assert.ok(Math.abs(m.tiempo - segundos) < 1e-9, 'el tiempo y los minutos no cuadran');
  // En segundos REALES: la misma regata a ritmo 1 dura RITMO veces más.
  const lenta = montar('canal', { barca: 'chalana', tripulacion: [] }, { semilla: 3, vueltas: 1 });
  const m1 = medirRegata(lenta.est, lenta.rng, pilotoMedio, 1);
  assert.ok(Math.abs(m1.tiempo - m.tiempo * RITMO) < 1e-6, `${m1.tiempo} s a ritmo 1 contra ${m.tiempo} s a ritmo ${RITMO}`);
});

test('[K-101] el ritmo no cambia la regata: solo cuántos pasos caben en un fotograma', () => {
  const c = { ...circuito('ria'), vueltas: 1 };
  const inscritos = () => [
    inscribir('Trainera', { barca: 'trainera', tripulacion: ['remero'] }, false),
    inscribir('Patín', { barca: 'patin', tripulacion: [] }, false),
    inscribir('Tú', { barca: 'chalana', tripulacion: [] }, true),
  ];
  const lento = new MotorDeRegata(c, inscritos(), 77, 1);
  const rapido = new MotorDeRegata(c, inscritos(), 77, 3);
  const m = mando({ gas: 0.9 });
  // 60 s de simulación: 1 200 fotogramas a ritmo 1, 400 a ritmo 3.
  for (let i = 0; i < 1200; i++) lento.tictac(PASO, m);
  for (let i = 0; i < 400; i++) rapido.tictac(PASO, m);
  assert.ok(Math.abs(lento.est.reloj - 60) < 1e-6, `reloj ${lento.est.reloj}`);
  assert.deepEqual(rapido.est, lento.est);
});

test('[K-101] un fotograma a ritmo 3 avanza el triple de simulación', () => {
  const c = { ...circuito('canal'), vueltas: 1 };
  const motor = new MotorDeRegata(c, [inscribir('Tú', { barca: 'chalana', tripulacion: [] }, true)], 5, 3);
  motor.tictac(0.1, mando());
  assert.ok(Math.abs(motor.est.reloj - 0.3) < 1e-9, `reloj ${motor.est.reloj}`);
});

test('[K-102] se recortan las vueltas, no la geometría', () => {
  assert.equal(CIRCUITOS.length, CIRCUITOS_ORIGINALES.length);
  for (const c of CIRCUITOS) {
    assert.equal(c.vueltas, 2, `${c.id} se corre a ${c.vueltas} vueltas`);
    const original = CIRCUITOS_ORIGINALES.find((o) => o.id === c.id);
    assert.ok(original !== undefined, `${c.id} no está en la copia de antes`);
    // Uno a uno: escalar radios o rectas rompía `B-202` (SPEC-006, «Lo que la
    // medición cambió»).
    assert.deepEqual(c.tramos, original.tramos, `${c.id}: los tramos han cambiado`);
  }
});

test('[K-103] lo que el jugador lee va en segundos reales', () => {
  assert.equal(segundosReales(30), 30 / RITMO);
  assert.equal(segundosReales(30, 1), 30);
  assert.equal(segundosReales(3, 3), 1);
});

test('[K-201] una fila de huevos cada ~110 m: unos ocho segundos de pantalla', () => {
  assert.ok(PASO_ENTRE_FILAS <= 120);
  for (const c of CIRCUITOS) {
    const filas = new Set(huevosDe(c).map((h) => h.metros)).size;
    const paso = longitudDeVuelta(c) / filas;
    assert.ok(paso >= 100 && paso <= 120, `${c.id}: una fila cada ${paso.toFixed(1)} m`);
    // A la velocidad media del baseline (4,1–4,75 m/s; se toma 4,4).
    const segundos = paso / 4.4 / RITMO;
    assert.ok(segundos >= 7 && segundos <= 10, `${c.id}: una fila cada ${segundos.toFixed(1)} s reales`);
  }
});
