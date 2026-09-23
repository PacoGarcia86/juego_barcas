// [R-3xx] La malla de una barca: la lancha.
//
// [R-303] Todas las barcas son la misma lancha, modelada en Blender
// (`arte/barcas/`) y llegada aquí como dato en `modelos.ts`: nada que descargar
// en marcha. Sin vela ni remos, que una lancha con motor no lleva. El tipo de
// casco manda en la física (`B-203`), no en la malla.
//
// [R-302] La geometría es UNITARIA —un metro de eslora, un metro de manga— y
// cada barca la escala con sus números. Así las ocho barcas caben en UNA malla
// instanciada en vez de en ocho mallas propias: la primera versión gastaba 48
// llamadas de dibujo solo en la flota y bajaba a 22 fps en gama media (`DR2`).
//
// [R-303] Escalar una geometría unitaria mantiene la relación eslora/manga del
// dato, que es lo que hace que una traiñera se vea larga y estrecha y una
// neumática corta y ancha.

import { BufferAttribute, BufferGeometry, Color as ColorTres } from 'three';
import type { Material } from 'three';
import { MATERIALES_DE_BARCA } from '../paleta.ts';
import { MODELO } from './modelos.ts';

/** [R-304] Trima máxima: 4°. Más y la lancha parece que va a despegar. */
export const TRIMA_MAXIMA = (4 * Math.PI) / 180;

/**
 * [R-303] [R-306] La lancha unitaria: 1 de eslora (en Z, proa hacia +Z), 1 de
 * manga (en X), y en Y la regala a 0 y la quilla en `MODELO.quilla` puntales.
 * Quien la use la escala.
 *
 * Cada vértice lleva `color` (el fijo del modelo) y `pintura`, los pesos
 * (fijo, casco, franja) con los que `pintarPorInstancia` mezcla en el shader.
 */
export function geometriaDeCasco(): BufferGeometry {
  const cuantos = MODELO.pintura.length;
  const colores = new Float32Array(cuantos * 3);
  const pesos = new Float32Array(cuantos * 3);
  const c = new ColorTres();
  const porPintura = MODELO.pinturas.map((p) =>
    'fijo' in p
      ? { color: c.set(MATERIALES_DE_BARCA[p.fijo]).toArray(), pesos: [1, 0, 0] }
      : { color: [0, 0, 0], pesos: p.pintura === 'casco' ? [0, p.luz, 0] : [0, 0, p.luz] },
  );
  for (let v = 0; v < cuantos; v++) {
    const p = porPintura[MODELO.pintura[v]!]!;
    colores.set(p.color, v * 3);
    pesos.set(p.pesos, v * 3);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(MODELO.posiciones), 3));
  geo.setAttribute('color', new BufferAttribute(colores, 3));
  geo.setAttribute('pintura', new BufferAttribute(pesos, 3));
  geo.setIndex(Array.from(MODELO.indices));
  geo.computeVertexNormals();
  return geo;
}

/**
 * [R-306] El color de casco va en `instanceColor` y el de franja en el atributo
 * instanciado `franja`: una sola llamada de dibujo pinta barcas de colores
 * distintos. Sin esto, `instanceColor` teñía también el cristal y el motor.
 */
export function pintarPorInstancia(material: Material): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <color_pars_vertex>', '#include <color_pars_vertex>\nattribute vec3 pintura;\nattribute vec3 franja;')
      .replace(
        '#include <color_vertex>',
        [
          'vColor = vec4( color * pintura.x + franja * pintura.z, 1.0 );',
          '#ifdef USE_INSTANCING_COLOR',
          '  vColor.rgb += instanceColor.rgb * pintura.y;',
          '#endif',
        ].join('\n'),
      );
  };
}

/**
 * [R-305] Fracción de la profundidad de quilla que va bajo el agua. Crece con
 * la masa, con tope. El tope NO es libre: la flotación tiene que quedar por
 * debajo del suelo de la bañera. Con 0,4–0,72 el agua se dibujaba por encima
 * del suelo de las barcas cargadas y de la lancha solo asomaban la regala y la
 * consola, como un casco hundido.
 */
export function caladoDe(masa: number): number {
  return 0.25 + Math.min(0.2, (masa - 500) / 3200);
}

/**
 * [R-304] Cuánto levanta la proa la lancha, en radianes (positivo = proa
 * arriba). Va con el gas pedido y con la velocidad, no con el reloj: a gas 0 va
 * plana, y parada tampoco encabuza aunque se pida todo.
 */
export function trimaDeProa(gas: number, velocidad: number): number {
  const pedido = Math.min(1, Math.max(0, gas));
  const marcha = Math.min(1, Math.max(0, velocidad) / 4);
  return TRIMA_MAXIMA * pedido * marcha;
}
