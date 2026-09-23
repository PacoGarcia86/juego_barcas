// [R-1xx] [R-2xx] Lo que del render SE PUEDE comprobar con números: el trazado
// y las olas. `trazado.ts` no importa `three` justamente para esto.
//
// Lo que un test no puede ver —si se ve bien— no está aquí. Los defectos DR1,
// DR2 y DR3 salieron de mirar capturas con todos los tests en verde.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  anchuraEn,
  construirTrazado,
  giroTotalDe,
  lateralDe,
  MIRA_ADELANTE,
  posicionEn,
  puntoDeMira,
  puntoEn,
  rumboEn,
} from '../../render/tresd/trazado.ts';
import { alturaDeOla, construirMallaDeAgua, inclinacionEn, TOPE_VERTICES, TRENES } from '../../render/tresd/agua.ts';
import { paletaDe } from '../../render/paleta.ts';
import { MeshStandardMaterial } from 'three';
import { caladoDe, geometriaDeCasco, pintarPorInstancia, TRIMA_MAXIMA, trimaDeProa } from '../../render/tresd/barca.ts';
import { MODELO } from '../../render/tresd/modelos.ts';
import { CIRCUITOS } from '../datos/circuitos.ts';
import { longitudDeVuelta } from '../circuito.ts';
import { circuito } from './ayudas.ts';

test('[R-101] el trazado cierra en los cuatro circuitos', () => {
  // Sin el reparto del error de cierre, quedaba un salto en la línea de meta.
  for (const c of CIRCUITOS) {
    const t = construirTrazado(c);
    const a = puntoEn(t, 0);
    const b = puntoEn(t, longitudDeVuelta(c) - 0.001);
    const hueco = Math.hypot(a.x - b.x, a.z - b.z);
    assert.ok(hueco < 1.5, `${c.id}: el trazado deja un hueco de ${hueco.toFixed(2)} m`);
  }
});

test('[R-102] el trazado NO acumula distancia: dar una vuelta vuelve al sitio', () => {
  // Regresión de DR5: acumulando su propia distancia, boyas y barcas divergían
  // once metros tras tres vueltas y las barcas pasaban por dentro de las boyas.
  for (const c of CIRCUITOS) {
    const t = construirTrazado(c);
    const vuelta = longitudDeVuelta(c);
    for (const m of [0, 137, 512, 900]) {
      const a = puntoEn(t, m);
      const b = puntoEn(t, m + vuelta * 3);
      assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 1e-6, `${c.id}: el metro ${m} no cae en el mismo sitio tres vueltas después`);
    }
  }
});

test('[R-105] un circuito cerrado gira una vuelta entera', () => {
  // Regresión de DR7: `faro` giraba −0,24 rad de los 6,28 que hacen falta. No
  // era un circuito, era un camino, y ninguna corrección de cierre podía
  // salvarlo sin deformarlo entero.
  const vuelta = 2 * Math.PI;
  for (const c of CIRCUITOS) {
    const giro = Math.abs(giroTotalDe(c));
    assert.ok(
      giro > vuelta * 0.9 && giro < vuelta * 1.1,
      `${c.id}: las curvas suman ${giro.toFixed(3)} rad en vez de ${vuelta.toFixed(3)}`,
    );
  }
});

test('[R-106] un metro del motor es un metro del mundo', () => {
  // Regresión de DR6. El test de cierre de `R-101` pasaba con `faro` dibujando
  // 1 037 m para los 1 380 que declara, y en pantalla eso era la cámara metida
  // dentro de la barca del jugador.
  for (const c of CIRCUITOS) {
    const t = construirTrazado(c);
    let perimetro = 0;
    for (let i = 0; i < t.puntos.length; i++) {
      const a = t.puntos[i]!;
      const b = t.puntos[(i + 1) % t.puntos.length]!;
      perimetro += Math.hypot(a.x - b.x, a.z - b.z);
    }
    const declarada = longitudDeVuelta(c);
    const desvio = Math.abs(perimetro / declarada - 1);
    assert.ok(desvio < 0.005, `${c.id}: la polilínea mide ${perimetro.toFixed(0)} m y la vuelta declara ${declarada} m`);
  }
});

test('[R-106] y la escala no se descuadra en ningún punto del trazado', () => {
  // El perímetro puede cuadrar de media y estar mal en cada sitio.
  for (const c of CIRCUITOS) {
    const t = construirTrazado(c);
    for (let m = 0; m < t.vuelta; m += 15) {
      const a = puntoEn(t, m);
      const b = puntoEn(t, m + 22);
      const real = Math.hypot(a.x - b.x, a.z - b.z);
      assert.ok(real > 15 && real < 30, `${c.id}: 22 m del motor son ${real.toFixed(1)} m en el metro ${m}`);
    }
  }
});

test('[R-102] el rumbo interpola por el camino corto', () => {
  const t = construirTrazado(circuito('ria'));
  for (let m = 0; m < t.vuelta; m += 3) {
    const r = rumboEn(t, m);
    assert.ok(Number.isFinite(r), `rumbo no finito en el metro ${m}`);
  }
  // Dos metros contiguos no pueden dar un giro de más de un cuarto de vuelta.
  for (let m = 0; m < t.vuelta - 1; m += 1) {
    let d = rumboEn(t, m + 1) - rumboEn(t, m);
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    assert.ok(Math.abs(d) < Math.PI / 4, `salto de rumbo de ${d.toFixed(3)} rad en el metro ${m}`);
  }
});

test('[R-103] el desplazamiento de carril es simétrico y cabe en la anchura', () => {
  assert.equal(lateralDe(0, 1, 18), 0);
  const izquierda = lateralDe(0, 4, 18);
  const derecha = lateralDe(3, 4, 18);
  assert.ok(Math.abs(izquierda + derecha) < 1e-9, 'los carriles no están centrados');
  assert.ok(Math.abs(derecha) <= 9, 'el carril exterior se sale del agua navegable');
  // Y es monótono: el carril 2 va más a estribor que el 1.
  assert.ok(lateralDe(2, 4, 18) > lateralDe(1, 4, 18));
});

test('[R-103] la anchura que ve el render es la del tramo del motor', () => {
  for (const c of CIRCUITOS) {
    const t = construirTrazado(c);
    let acumulado = 0;
    for (const tramo of c.tramos) {
      assert.equal(anchuraEn(t, acumulado + tramo.longitud / 2), tramo.anchura, `${c.id}: anchura distinta en el tramo`);
      acumulado += tramo.longitud;
    }
  }
});

test('[R-501] el punto de mira va por delante y se queda dentro del circuito', () => {
  // Regresión de DR3: mirando al eje de la barca, en la curva se veía la
  // orilla y no se podía trazar.
  for (const c of CIRCUITOS) {
    const t = construirTrazado(c);
    let acumulado = 0;
    for (const tramo of c.tramos) {
      if (tramo.tipo === 'curva') {
        const metros = acumulado + tramo.longitud / 2;
        const mira = puntoDeMira(t, metros);
        const eje = puntoEn(t, metros + MIRA_ADELANTE);
        assert.ok(Math.hypot(mira.x - eje.x, mira.z - eje.z) < 1e-6, `${c.id}: el punto de mira no es el del trazado`);
        // Y está de verdad por delante, no al lado.
        const aqui = puntoEn(t, metros);
        assert.ok(Math.hypot(mira.x - aqui.x, mira.z - aqui.z) > 10, `${c.id}: el punto de mira está encima de la barca`);
      }
      acumulado += tramo.longitud;
    }
  }
});

test('[R-1xx] la posición de un carril está a la distancia que toca del eje', () => {
  const t = construirTrazado(circuito('faro'));
  const metros = 400;
  const eje = puntoEn(t, metros);
  const carriles = 4;
  for (let c = 0; c < carriles; c++) {
    const p = posicionEn(t, metros, c, carriles);
    const separacion = Math.hypot(p.x - eje.x, p.z - eje.z);
    const esperada = Math.abs(lateralDe(c, carriles, anchuraEn(t, metros)));
    assert.ok(Math.abs(separacion - esperada) < 1e-6, `carril ${c}: ${separacion.toFixed(3)} en vez de ${esperada.toFixed(3)}`);
  }
});

test('[R-203] con el mar en calma el agua está casi plana', () => {
  // La amplitud la fija el oleaje del circuito, no una constante del render.
  let maximo = 0;
  for (let x = -60; x < 60; x += 3) {
    for (let z = -60; z < 60; z += 3) maximo = Math.max(maximo, Math.abs(alturaDeOla(x, z, 4.2, 0)));
  }
  assert.ok(maximo < 0.12, `con oleaje 0 las olas llegan a ${maximo.toFixed(3)} m`);
});

test('[R-203] y con marejada se levanta de verdad', () => {
  let maximo = 0;
  for (let x = -60; x < 60; x += 3) {
    for (let z = -60; z < 60; z += 3) maximo = Math.max(maximo, Math.abs(alturaDeOla(x, z, 4.2, 1)));
  }
  assert.ok(maximo > 0.55, `con oleaje 1 las olas solo llegan a ${maximo.toFixed(3)} m`);
});

test('[R-201] las olas se mueven', () => {
  // Se mira en varios puntos: en uno suelto los cuatro trenes se pueden
  // cancelar entre sí y el test diría que el agua está parada cuando no lo
  // está.
  let mayor = 0;
  for (let x = 0; x < 40; x += 7) {
    for (let z = 0; z < 40; z += 7) {
      mayor = Math.max(mayor, Math.abs(alturaDeOla(x, z, 0, 0.6) - alturaDeOla(x, z, 2.5, 0.6)));
    }
  }
  assert.ok(mayor > 0.1, `el agua solo se mueve ${mayor.toFixed(3)} m en dos segundos y medio`);
  assert.equal(TRENES.length, 4);
});

test('[R-301] la barca cabecea y se balancea con la ola', () => {
  // Regresión de DR1: con un plano, el cabeceo era 0,0° y la barca parecía un
  // icono deslizándose.
  let variacion = 0;
  let minimo = Infinity;
  let maximo = -Infinity;
  for (let t = 0; t < 30; t += 0.2) {
    const { cabeceo } = inclinacionEn(50 + t * 4, 20, 0.6, 9, 2, t, 0.5);
    minimo = Math.min(minimo, cabeceo);
    maximo = Math.max(maximo, cabeceo);
  }
  variacion = ((maximo - minimo) * 180) / Math.PI;
  assert.ok(variacion > 2, `el cabeceo solo varía ${variacion.toFixed(2)}°`);
});

test('[R-301] una barca larga cabecea menos que una corta en la misma ola', () => {
  // Promedia varias olas, que es lo que pasa de verdad.
  const rango = (eslora: number): number => {
    let min = Infinity;
    let max = -Infinity;
    for (let t = 0; t < 40; t += 0.1) {
      const { cabeceo } = inclinacionEn(30, 12, 0, eslora, 2, t, 0.8);
      min = Math.min(min, cabeceo);
      max = Math.max(max, cabeceo);
    }
    return max - min;
  };
  assert.ok(rango(14.5) < rango(6), 'la galeota cabecea igual que la chalana');
});

test('[R-202] la malla del agua no pasa del tope de vértices', () => {
  // La primera tenía 640 000 vértices y 2,1 GB de memoria de vídeo: el
  // navegador mataba la pestaña.
  const geo = construirMallaDeAgua(420, 110, 128);
  const vertices = geo.getAttribute('position').count;
  assert.ok(vertices <= TOPE_VERTICES, `la malla pide ${vertices} vértices`);
  assert.throws(() => construirMallaDeAgua(420, 400, 400), /tope/);
});

test('[R-401] la paleta da todos los colores, y el mar de fondo espesa la niebla', () => {
  for (const c of CIRCUITOS) {
    const p = paletaDe(c);
    for (const campo of ['cielo', 'horizonte', 'aguaHonda', 'aguaSomera', 'espuma', 'boya', 'huevo'] as const) {
      assert.match(p[campo], /^#[0-9a-f]{6}$/i, `${c.id}: falta el color ${campo}`);
    }
    assert.ok(p.luz > 0 && p.ambiente > 0);
  }
  const calma = paletaDe({ ...CIRCUITOS[0]!, oleajeBase: 0 });
  const bravo = paletaDe({ ...CIRCUITOS[0]!, oleajeBase: 1 });
  assert.ok(bravo.densidadNiebla > calma.densidadNiebla, 'con marejada se tiene que ver menos');
});

test('[R-303] la lancha de Blender es unitaria y la quilla es la del modelo', () => {
  // La relación eslora/manga del dato solo se conserva si el casco pintado mide
  // 1 × 1: el motor y la defensa pueden asomar, el casco no.
  const geo = geometriaDeCasco();
  const pos = geo.getAttribute('position');
  const pesos = geo.getAttribute('pintura');
  let xMin = Infinity, xMax = -Infinity, zMin = Infinity, zMax = -Infinity, yMin = Infinity;
  for (let v = 0; v < pos.count; v++) {
    if (pesos.getY(v) === 0) continue; // solo las caras con pintura de casco
    xMin = Math.min(xMin, pos.getX(v));
    xMax = Math.max(xMax, pos.getX(v));
    zMin = Math.min(zMin, pos.getZ(v));
    zMax = Math.max(zMax, pos.getZ(v));
    yMin = Math.min(yMin, pos.getY(v));
  }
  assert.ok(Math.abs(xMax - xMin - 1) < 0.05, `la manga del casco mide ${(xMax - xMin).toFixed(3)}`);
  assert.ok(Math.abs(zMax - zMin - 1) < 0.05, `la eslora del casco mide ${(zMax - zMin).toFixed(3)}`);
  assert.ok(zMax > 0.45, 'la proa no mira a +Z');
  assert.ok(Math.abs(yMin - MODELO.quilla) < 1e-3, `quilla declarada ${MODELO.quilla}, medida ${yMin}`);
  assert.ok(MODELO.quilla < -0.2, 'el casco no tiene calado');
  for (const i of MODELO.indices) assert.ok(i >= 0 && i < pos.count, `índice ${i} fuera de la malla`);
});

test('[R-304] la lancha levanta la proa con el gas, no con el reloj', () => {
  assert.equal(trimaDeProa(0, 5), 0, 'a gas 0 tiene que ir plana');
  assert.equal(trimaDeProa(1, 0), 0, 'parada no encabuza aunque se pida todo');
  assert.ok(trimaDeProa(0.5, 4) < trimaDeProa(1, 4), 'más gas, más trima');
  assert.ok(trimaDeProa(1, 2) < trimaDeProa(1, 4), 'más velocidad, más trima');
  assert.ok(trimaDeProa(3, 20) <= TRIMA_MAXIMA + 1e-12, 'la trima tiene tope');
  assert.ok(Math.abs((TRIMA_MAXIMA * 180) / Math.PI - 4) < 1e-9);
});

test('[R-306] casco y franja se pintan por instancia; lo demás, color fijo', () => {
  const usadas = [...new Set(MODELO.pintura)].map((i) => MODELO.pinturas[i]!);
  assert.ok(usadas.some((p) => 'pintura' in p && p.pintura === 'casco'), 'nada toma el color de casco');
  assert.ok(usadas.some((p) => 'pintura' in p && p.pintura === 'franja'), 'nada toma el color de franja');
  assert.ok(usadas.some((p) => 'fijo' in p), 'todo el modelo se tiñe con la barca');
  // Cada vértice pinta de UNA fuente: fija, casco o franja.
  const pesos = geometriaDeCasco().getAttribute('pintura');
  for (let v = 0; v < pesos.count; v++) {
    const fuentes = [pesos.getX(v), pesos.getY(v), pesos.getZ(v)].filter((w) => w > 0).length;
    assert.equal(fuentes, 1, `el vértice ${v} mezcla ${fuentes} pinturas`);
  }
  // El shader sustituye el color por instancia, no lo multiplica.
  const material = new MeshStandardMaterial({ vertexColors: true });
  pintarPorInstancia(material);
  const shader = { vertexShader: '#include <color_pars_vertex>\n#include <color_vertex>', fragmentShader: '', uniforms: {} };
  material.onBeforeCompile(shader as never, undefined as never);
  assert.doesNotMatch(shader.vertexShader, /#include <color_vertex>/);
  assert.match(shader.vertexShader, /attribute vec3 franja/);
  assert.match(shader.vertexShader, /instanceColor\.rgb \* pintura\.y/);
});

test('[R-305] la flotación nunca pasa por encima del suelo de la bañera', () => {
  // Con el calado anterior (0,4–0,72) el agua se dibujaba sobre el suelo de
  // las barcas cargadas: solo asomaban la regala y la consola.
  const suelo = MODELO.pinturas.findIndex((p) => 'fijo' in p && p.fijo === 'suelo');
  assert.ok(suelo >= 0, 'el modelo no tiene suelo');
  let alturaSuelo = Infinity;
  MODELO.pintura.forEach((p, v) => {
    if (p === suelo) alturaSuelo = Math.min(alturaSuelo, MODELO.posiciones[v * 3 + 1]!);
  });
  let anterior = -Infinity;
  for (let masa = 300; masa <= 3000; masa += 50) {
    const calado = caladoDe(masa);
    assert.ok(calado >= anterior, `el calado baja al pasar a ${masa} kg`);
    anterior = calado;
    const flotacion = MODELO.quilla * (1 - calado);
    // Margen de 0,04 puntales: la ola inclina la barca y el agua no es plana.
    assert.ok(flotacion < alturaSuelo - 0.04, `${masa} kg: flotación ${flotacion.toFixed(3)} contra suelo ${alturaSuelo.toFixed(3)}`);
  }
  assert.ok(caladoDe(1800) > caladoDe(400), 'una barca cargada tiene que ir más metida');
});
