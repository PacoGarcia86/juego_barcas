// [R-308] – [R-311] Fase R3: la barca se lee como barca. Lo que se puede
// comprobar con números; lo demás —si el remero parece una persona— se mira en
// las capturas (§6.3), que es de donde salieron `DR13` a `DR16`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { avanzar } from '../carrera.ts';
import { caladoDe, Flota } from '../../render/tresd/flota.ts';
import { BANCADAS, geometriaDeCasco, seccion, ZONA_BANCADA } from '../../render/tresd/barca.ts';
import { construirTrazado } from '../../render/tresd/trazado.ts';
import { paletaDe } from '../../render/paleta.ts';
import { mando, montar } from './ayudas.ts';

const TIPOS = ['desplazamiento', 'planeador'] as const;

test('[R-308] el casco tiene arrufo, bancadas y tope de triángulos', () => {
  for (const tipo of TIPOS) {
    // Arrufo: la borda sube a proa. La primera versión la tenía recta (DR13).
    const centro = seccion(tipo, 0.5).borda;
    const proa = seccion(tipo, 1).borda;
    assert.ok(proa - centro >= 0.15, `${tipo}: la proa sube ${(proa - centro).toFixed(2)}`);

    const geo = geometriaDeCasco(tipo);
    const zona = Array.from(geo.getAttribute('zona').array as Float32Array);
    // Una caja por bancada: ocho vértices cada una.
    const bancada = zona.filter((z) => z === ZONA_BANCADA).length;
    assert.ok(bancada >= BANCADAS.length * 8, `${tipo}: ${bancada} vértices de bancada`);

    const triangulos = (geo.getIndex()?.count ?? 0) / 3;
    assert.ok(triangulos <= 4000, `${tipo}: ${triangulos} triángulos`);
    assert.ok(triangulos > 1000, `${tipo}: ${triangulos} triángulos, ¿se ha vuelto a la vaina?`);
  }
});

test('[R-303] [R-308] la malla sigue siendo de un metro de eslora y uno de manga', () => {
  // Si una pieza nueva (el timón, la regala) sale de la caja unitaria, la
  // relación eslora/manga de la barca en pantalla deja de ser la del dato.
  for (const tipo of TIPOS) {
    const geo = geometriaDeCasco(tipo);
    geo.computeBoundingBox();
    const caja = geo.boundingBox!;
    const manga = caja.max.x - caja.min.x;
    const eslora = caja.max.z - caja.min.z;
    assert.ok(Math.abs(manga - 1) <= 0.05, `${tipo}: manga ${manga.toFixed(3)}`);
    assert.ok(Math.abs(eslora - 1) <= 0.05, `${tipo}: eslora ${eslora.toFixed(3)}`);
  }
});

test('[R-305] [R-309] el calado que pinta la patente es el que hunde la barca', () => {
  assert.ok(caladoDe(1400) > caladoDe(600), 'el calado no crece con la masa');
  const { est, circuito } = montar('ria');
  const flota = new Flota(est.naves, paletaDe(circuito));
  let vistos = 0;
  flota.raiz.traverse((o) => {
    const calado = (o as { geometry?: { getAttribute(n: string): { array: ArrayLike<number> } | undefined } }).geometry?.getAttribute('calado');
    if (calado === undefined) return;
    for (const c of Array.from(calado.array)) {
      vistos++;
      assert.ok(c > 0 && c < 0.5, `calado ${c}`);
      // Tiene que ser el de alguna barca de la regata.
      assert.ok(est.naves.some((n) => Math.abs(caladoDe(n.barca.masa) - c) < 1e-6), `calado ${c} sin barca`);
    }
  });
  assert.equal(vistos, est.naves.length);
});

test('[R-310] la pala entra en el agua en la palada', () => {
  // Regresión de DR15: los remos aleteaban 0,1–0,3 m por encima del agua.
  const { est: inicio, rng, circuito } = montar('faro', undefined, { vueltas: 1 });
  const trazado = construirTrazado(circuito);
  const flota = new Flota(inicio.naves, paletaDe(circuito));
  const oleaje = circuito.oleajeBase;
  let est = inicio;
  let hondo: number[] = [];
  for (let f = 0; f < 240; f++) {
    if (f % 3 === 0) est = avanzar(est, { mando: mando({ gas: 1 }), ultimaVuelta: false }, rng);
    flota.actualizar(est.naves, trazado, est.reloj, oleaje, 1 / 60);
    const ahora = flota.hundimientoDePalas();
    hondo = hondo.length === 0 ? ahora : hondo.map((h, i) => Math.max(h, ahora[i]!));
  }
  // En cuatro segundos de boga, cada pala ha estado dentro del agua.
  const secas = hondo.filter((h) => h <= 0).length;
  assert.equal(secas, 0, `${secas} de ${hondo.length} palas no han tocado el agua`);
  // Y no se entierran: la pala entra, no el remo entero.
  assert.ok(Math.max(...hondo) < 0.6, `una pala baja ${Math.max(...hondo).toFixed(2)} m`);
});

test('[R-311] la vela va cazada, fuera de crujía', () => {
  // Regresión de DR16: la vela iba en el plano de crujía y la del jugador, que
  // se mira desde popa, se veía de canto.
  const { est, rng, circuito } = montar('ria');
  const trazado = construirTrazado(circuito);
  const flota = new Flota(est.naves, paletaDe(circuito));
  let e = est;
  for (let f = 0; f < 600; f++) {
    if (f % 3 === 0) e = avanzar(e, { mando: mando({ gas: 1 }), ultimaVuelta: false }, rng);
    flota.actualizar(e.naves, trazado, e.reloj, 0.3, 1 / 60);
    for (const a of flota.angulosDeEscota()) assert.ok(Math.abs(a) >= 0.25, `escota a ${a.toFixed(2)} rad`);
  }
});
