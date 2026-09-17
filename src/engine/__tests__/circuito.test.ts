// [B-1xx] El circuito. La única conversión de distancia a posición del juego.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  boyasDe,
  carrilesEn,
  corrienteEn,
  factorDeCarril,
  inicioDeTramo,
  longitudDeVuelta,
  longitudTotal,
  oleajeEn,
  puntoDe,
  radioEfectivo,
} from '../circuito.ts';
import { CIRCUITOS, circuitoPorId } from '../datos/circuitos.ts';
import { circuito } from './ayudas.ts';

test('[B-101] el circuito es cerrado: el final del último tramo enlaza con el primero', () => {
  for (const c of CIRCUITOS) {
    const vuelta = longitudDeVuelta(c);
    assert.equal(puntoDe(c, vuelta).indiceTramo, puntoDe(c, 0).indiceTramo);
    assert.equal(puntoDe(c, vuelta).vuelta, 1);
    assert.ok(puntoDe(c, vuelta).metrosEnVuelta < 1e-9);
  }
});

test('[B-102] ningún tramo pasa del 30 % de la vuelta', () => {
  // Un tramo que se come el circuito lo convierte en una línea recta con dos
  // curvas de adorno.
  for (const c of CIRCUITOS) {
    const vuelta = longitudDeVuelta(c);
    for (const tramo of c.tramos) {
      const fraccion = tramo.longitud / vuelta;
      assert.ok(fraccion < 0.3, `${c.id}: un tramo ocupa el ${(100 * fraccion).toFixed(1)} % de la vuelta`);
    }
  }
});

test('[B-103] la anchura del tramo fija los carriles, con mínimo de dos', () => {
  assert.equal(carrilesEn({ tipo: 'recta', longitud: 100, anchura: 9, radio: 0, corriente: 0, oleaje: 0 }), 2);
  assert.equal(carrilesEn({ tipo: 'recta', longitud: 100, anchura: 22, radio: 0, corriente: 0, oleaje: 0 }), 4);
  // Siempre se puede adelantar: nunca se baja de dos.
  assert.equal(carrilesEn({ tipo: 'estrecho', longitud: 100, anchura: 3, radio: 0, corriente: 0, oleaje: 0 }), 2);
});

test('[B-104] los cuatro circuitos declaran que son ficticios', () => {
  // No hay circuitos reales en el juego. Un dato aproximado sin etiqueta se
  // convierte en un dato falso.
  assert.equal(CIRCUITOS.length, 4);
  for (const c of CIRCUITOS) assert.equal(c.procedencia, 'ficticio');
});

test('[B-105] `puntoDe` normaliza a la vuelta', () => {
  const c = circuito('ria');
  const vuelta = longitudDeVuelta(c);
  const p = puntoDe(c, vuelta * 2 + 300);
  assert.equal(p.vuelta, 2);
  assert.ok(Math.abs(p.metrosEnVuelta - 300) < 1e-9);
  assert.equal(longitudTotal(c), vuelta * c.vueltas);
});

test('[B-105] el tramo devuelto es el que contiene esos metros', () => {
  const c = circuito('ria');
  let acumulado = 0;
  c.tramos.forEach((tramo, i) => {
    assert.equal(inicioDeTramo(c, i), acumulado);
    assert.equal(puntoDe(c, acumulado + tramo.longitud / 2).indiceTramo, i);
    acumulado += tramo.longitud;
  });
});

test('[B-106] la corriente sale del tramo, con su signo', () => {
  const c = circuito('ria');
  const conCorriente = c.tramos.findIndex((t) => t.corriente > 0);
  const enContra = c.tramos.findIndex((t) => t.corriente < 0);
  assert.ok(corrienteEn(c, inicioDeTramo(c, conCorriente) + 10) > 0);
  assert.ok(corrienteEn(c, inicioDeTramo(c, enContra) + 10) < 0);
});

test('[B-107] el oleaje efectivo nunca se sale de [0, 1]', () => {
  // El acotado no es cosmético: la resistencia de oleaje multiplica por la masa
  // entera, y un 1,4 suelto convertía el mar abierto en un muro.
  for (const c of CIRCUITOS) {
    for (let m = 0; m < longitudDeVuelta(c); m += 7) {
      const o = oleajeEn(c, m);
      assert.ok(o >= 0 && o <= 1, `${c.id} da oleaje ${o} en el metro ${m}`);
    }
  }
});

test('[B-306] hay una boya en cada curva y en ninguna recta', () => {
  for (const c of CIRCUITOS) {
    const boyas = boyasDe(c);
    assert.equal(boyas.length, c.tramos.filter((t) => t.tipo === 'curva').length);
    for (const b of boyas) assert.equal(c.tramos[b.indiceTramo]!.tipo, 'curva');
  }
});

test('[B-306] por fuera de la boya se recorre más agua; por dentro, menos', () => {
  const c = circuito('ria');
  const curva = c.tramos.find((t) => t.tipo === 'curva' && t.radio > 0)!;
  const carriles = carrilesEn(curva);
  assert.ok(factorDeCarril(curva, carriles - 1) > factorDeCarril(curva, 0), 'el exterior alarga');
  assert.ok(factorDeCarril(curva, 0) < 1, 'el interior acorta');
  // Y por dentro se vira más cerrado: el radio efectivo es menor.
  assert.ok(radioEfectivo(curva, 0) < radioEfectivo(curva, carriles - 1));
});

test('[B-306] en una recta el carril no alarga nada', () => {
  const recta = circuito('ria').tramos.find((t) => t.tipo === 'recta')!;
  for (let c = 0; c < carrilesEn(recta); c++) assert.equal(factorDeCarril(recta, c), 1);
});

test('[B-1xx] los cuatro circuitos existen por su identificador', () => {
  for (const c of CIRCUITOS) assert.equal(circuitoPorId(c.id)?.id, c.id);
  assert.equal(circuitoPorId('no-existe'), undefined);
});
