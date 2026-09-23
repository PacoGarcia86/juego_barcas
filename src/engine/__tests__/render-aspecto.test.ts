// [R-2xx] [R-3xx] [R-4xx] [R-5xx] Fase R2: lo del aspecto que SÍ se puede
// comprobar con números o leyendo el código.
//
// Lo demás —si la espuma se lee como espuma, si el horizonte corta— no está
// aquí: `DR8` a `DR12` salieron de mirar capturas, y así se cierran (§6.3).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Scene } from 'three';
import { avanzar } from '../carrera.ts';
import { Flota } from '../../render/tresd/flota.ts';
import { Mundo, RADIO_ISLA } from '../../render/tresd/mundo.ts';
import { geometriaDeCasco, ZONA_CUBIERTA, ZONA_FRANJA } from '../../render/tresd/barca.ts';
import { construirTrazado, posicionEn, anchuraEn } from '../../render/tresd/trazado.ts';
import { paletaDe } from '../../render/paleta.ts';
import { mando, montar } from './ayudas.ts';

const RAIZ = path.resolve(import.meta.dirname, '../../..');
const leer = (relativo: string): string => fs.readFileSync(path.join(RAIZ, relativo), 'utf8');

test('[R-209] la estela no se estira al vacío', () => {
  // Regresión de DR8: los puntos sin rastro iban a y = −9999 y la tira los
  // unía con los buenos, un triángulo blanco cruzando media pantalla.
  const { est: inicio, rng, circuito } = montar('faro', undefined, { vueltas: 1 });
  const trazado = construirTrazado(circuito);
  const flota = new Flota(inicio.naves, paletaDe(circuito));
  const oleaje = circuito.oleajeBase;
  let est = inicio;
  // Tres segundos a 60 fps, con el motor a su paso fijo de 0,05 s.
  for (let f = 0; f < 180; f++) {
    if (f % 3 === 0) est = avanzar(est, { mando: mando({ gas: 1 }), ultimaVuelta: false }, rng);
    flota.actualizar(est.naves, trazado, est.reloj, oleaje, 1 / 60);
  }
  const barcas = est.naves.map((n) => {
    const carriles = Math.max(2, Math.floor(anchuraEn(trazado, n.metros) / 4.5));
    return posicionEn(trazado, n.metros, n.carril, carriles);
  });
  const v = flota.verticesDeEstela();
  for (let i = 0; i < v.length; i += 3) {
    const x = v[i]!;
    const y = v[i + 1]!;
    const z = v[i + 2]!;
    assert.ok(y > -3, `vértice de estela a y = ${y.toFixed(1)}`);
    const cerca = Math.min(...barcas.map((b) => Math.hypot(b.x - x, b.z - z)));
    assert.ok(cerca < 30, `vértice de estela a ${cerca.toFixed(1)} m de la barca más cercana`);
  }
});

test('[R-209] la estela se alarga con la velocidad', () => {
  // [R-204] Por distancia, no por fotograma: a 60 fps los 24 puntos por
  // fotograma de antes eran 0,4 s de estela.
  const { est: inicio, rng, circuito } = montar('canal', undefined, { vueltas: 1 });
  const trazado = construirTrazado(circuito);
  const flota = new Flota(inicio.naves, paletaDe(circuito));
  let est = inicio;
  for (let f = 0; f < 600; f++) {
    if (f % 3 === 0) est = avanzar(est, { mando: mando({ gas: 1 }), ultimaVuelta: false }, rng);
    flota.actualizar(est.naves, trazado, est.reloj, 0, 1 / 60);
  }
  const v = flota.verticesDeEstela();
  const puntos = v.length / 3 / est.naves.length;
  // La estela de la primera barca: del primer par de vértices al último distinto.
  let largo = 0;
  for (let i = 2; i < puntos; i += 2) {
    const a = (i - 2) * 3;
    const b = i * 3;
    largo += Math.hypot(v[b]! - v[a]!, v[b + 2]! - v[a + 2]!);
  }
  assert.ok(est.naves[0]!.velocidad > 2.5, `la barca va a ${est.naves[0]!.velocidad.toFixed(1)} m/s`);
  assert.ok(largo > 14, `la estela mide ${largo.toFixed(1)} m`);
});

test('[R-302] [R-307] la flota entera, remeros incluidos, sigue en seis mallas', () => {
  const { est, circuito } = montar('ria');
  const flota = new Flota(est.naves, paletaDe(circuito));
  assert.ok(flota.mallas() <= 6, `la flota dibuja ${flota.mallas()} mallas`);
});

test('[R-306] el casco marca la franja de la borda y la cubierta', () => {
  for (const tipo of ['desplazamiento', 'planeador'] as const) {
    const zona = geometriaDeCasco(tipo).getAttribute('zona');
    assert.ok(zona !== undefined, `el casco ${tipo} no lleva zona`);
    const valores = Array.from(zona.array as Float32Array);
    assert.ok(valores.some((z) => z === ZONA_CUBIERTA), 'no hay cubierta');
    assert.ok(valores.some((z) => z > ZONA_FRANJA && z <= 1), 'no hay franja');
    assert.ok(valores.some((z) => z < ZONA_FRANJA), 'no hay obra viva');
  }
});

test('[R-404] [R-407] mismo circuito, misma costa', () => {
  const { est, circuito } = montar('faro');
  const trazado = construirTrazado(circuito);
  const a = new Mundo(new Scene(), circuito, trazado, paletaDe(circuito), est.huevos).matricesDeIslas();
  const b = new Mundo(new Scene(), circuito, trazado, paletaDe(circuito), est.huevos).matricesDeIslas();
  assert.ok(a.length > 0);
  assert.deepEqual(a, b);
});

test('[R-407] ninguna isla cae dentro del agua navegable', () => {
  for (const id of ['ria', 'faro', 'canal', 'tormenta']) {
    const { est, circuito } = montar(id);
    const trazado = construirTrazado(circuito);
    const m = new Mundo(new Scene(), circuito, trazado, paletaDe(circuito), est.huevos).matricesDeIslas();
    for (let i = 0; i < m.length; i += 16) {
      const ancho = Math.hypot(m[i]!, m[i + 1]!, m[i + 2]!);
      if (ancho === 0) continue;
      const x = m[i + 12]!;
      const z = m[i + 14]!;
      const cerca = Math.min(...trazado.puntos.map((p) => Math.hypot(p.x - x, p.z - z)));
      // Con la falda y el ruido, una isla llega a RADIO_ISLA veces su escala;
      // y el agua navegable no pasa de 10 m a cada lado del eje.
      assert.ok(cerca > ancho * RADIO_ISLA + 10, `${id}: una isla de ${ancho.toFixed(0)} m a ${cerca.toFixed(0)} m del eje`);
    }
  }
});

test('[R-206] el agua brilla con el sol de la paleta, no con una luz propia', () => {
  const agua = leer('src/render/tresd/agua.ts');
  assert.ok(agua.includes('GLSL_CIELO'), 'el agua no incluye el cielo');
  assert.ok(agua.includes('direccionSol'), 'el agua no usa la dirección del sol');
  assert.ok(!/vec3 luz = normalize\(vec3\(/.test(agua), 'el agua declara una luz propia');
});

test('[R-406] la función del cielo se declara una sola vez', () => {
  const ficheros = ['agua.ts', 'cielo.ts', 'flota.ts', 'mundo.ts', 'vista.ts', 'barca.ts'];
  const declaraciones = ficheros.filter((f) => leer(`src/render/tresd/${f}`).includes('vec3 colorDeCielo('));
  assert.deepEqual(declaraciones, ['cielo.ts']);
});

test('[R-207] el agua, la escena y el cielo comparten niebla', () => {
  const vista = leer('src/render/tresd/vista.ts');
  const mundo = leer('src/render/tresd/mundo.ts');
  const cielo = leer('src/render/tresd/cielo.ts');
  assert.match(vista, /colorNiebla: this\.paleta\.niebla/);
  assert.match(vista, /densidadNiebla: this\.paleta\.densidadNiebla/);
  assert.match(mundo, /new FogExp2\(new ColorTres\(paleta\.niebla\)\.getHex\(\), paleta\.densidadNiebla\)/);
  assert.match(cielo, /cieloNiebla: \{ value: new ColorTres\(paleta\.niebla\) \}/);
});

test('[R-505] [R-603] hay post-proceso, y se apaga cuando el equipo no da', () => {
  const vista = leer('src/render/tresd/vista.ts');
  for (const pase of ['EffectComposer', 'RenderPass', 'UnrealBloomPass', 'OutputPass']) {
    assert.ok(vista.includes(`new ${pase}(`), `falta ${pase}`);
  }
  assert.match(vista, /this\.resplandor\.enabled = false/);
  assert.match(vista, /this\.mundo\.apagarSombras\(\)/);
});
