// [R-3xx] La malla de una barca. Procedural: sale de la eslora, la manga y el
// tipo de casco, no de un fichero que haya que descargar.
//
// [R-302] La geometría es UNITARIA —un metro de eslora, un metro de manga— y
// cada barca la escala con sus números. Así las ocho barcas caben en una malla
// instanciada por tipo de casco en vez de en ocho mallas propias: la primera
// versión gastaba 48 llamadas de dibujo solo en la flota y bajaba a 22 fps en
// gama media (`DR2`).
//
// [R-303] Escalar una geometría unitaria mantiene la relación eslora/manga del
// dato, que es lo que hace que una traiñera se vea larga y estrecha y una
// neumática corta y ancha.

import { BufferAttribute, BufferGeometry } from 'three';
import type { TipoCasco } from '../../engine/tipos.ts';

/** Secciones a lo largo de la eslora. Más no se nota y cuesta vértices. */
const SECCIONES = 13;
/** Puntos por sección de media manga. */
const PUNTOS = 5;

/**
 * [R-303] Casco unitario: 1 de eslora (en Z), 1 de manga (en X), 1 de puntal
 * (en Y, hacia abajo). Quien lo use lo escala.
 *
 * La proa se afila, la popa se abre, y un casco planeador lleva el pantoque
 * plano —es lo que le deja subirse encima del agua— mientras que uno de
 * desplazamiento es redondo por debajo.
 */
export function geometriaDeCasco(casco: TipoCasco): BufferGeometry {
  const planeador = casco === 'planeador';
  const posiciones: number[] = [];
  const indices: number[] = [];

  for (let s = 0; s <= SECCIONES; s++) {
    const t = s / SECCIONES; // 0 = popa, 1 = proa
    const z = t - 0.5;
    const afilado = Math.sin(Math.PI * Math.pow(t, planeador ? 0.72 : 0.88));
    const semiManga = 0.5 * Math.max(0.06, afilado);
    // Lanzamiento de roda: la proa levanta.
    const levante = Math.pow(Math.max(0, t - 0.62) / 0.38, 2) * (planeador ? 0.55 : 0.34);

    for (let p = 0; p <= PUNTOS; p++) {
      const u = p / PUNTOS; // 0 = quilla, 1 = borda
      const forma = planeador ? Math.pow(u, 0.42) : Math.sin((u * Math.PI) / 2);
      posiciones.push(semiManga * forma, -(1 - u) * (planeador ? 0.6 : 1) + levante, z);
    }
  }

  const porSeccion = PUNTOS + 1;
  for (let s = 0; s < SECCIONES; s++) {
    for (let p = 0; p < PUNTOS; p++) {
      const a = s * porSeccion + p;
      const b = a + porSeccion;
      indices.push(a, b, b + 1, a, b + 1, a + 1);
    }
  }

  // El costado de babor, en espejo.
  const mitad = posiciones.length / 3;
  for (let i = 0; i < mitad; i++) {
    posiciones.push(-posiciones[i * 3]!, posiciones[i * 3 + 1]!, posiciones[i * 3 + 2]!);
  }
  const cuantos = indices.length;
  for (let i = 0; i < cuantos; i += 3) {
    indices.push(mitad + indices[i + 2]!, mitad + indices[i + 1]!, mitad + indices[i]!);
  }

  // Y una cubierta plana que cierra la borda: sin ella se ve el interior hueco
  // desde la cámara, que va por detrás y por encima.
  const base = posiciones.length / 3;
  for (let s = 0; s <= SECCIONES; s++) {
    const t = s / SECCIONES;
    const afilado = Math.sin(Math.PI * Math.pow(t, planeador ? 0.72 : 0.88));
    const semiManga = 0.5 * Math.max(0.06, afilado);
    const levante = Math.pow(Math.max(0, t - 0.62) / 0.38, 2) * (planeador ? 0.55 : 0.34);
    posiciones.push(semiManga, levante, t - 0.5);
    posiciones.push(-semiManga, levante, t - 0.5);
  }
  for (let s = 0; s < SECCIONES; s++) {
    const a = base + s * 2;
    indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(posiciones), 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Una vela triangular unitaria, en el plano XY, con el pie en el origen. */
export function geometriaDeVela(): BufferGeometry {
  const geo = new BufferGeometry();
  geo.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([0, 0, 0, 0, 1, 0, 0, 0.12, -0.72]), 3),
  );
  geo.setIndex([0, 1, 2, 0, 2, 1]);
  geo.computeVertexNormals();
  return geo;
}

/** Un remo unitario: una pala larga de 1 de largo tumbada sobre el eje X. */
export function geometriaDeRemo(): BufferGeometry {
  const geo = new BufferGeometry();
  // Un prisma finito: cuatro caras bastan a la distancia a la que se ven.
  const a = 0.022;
  const posiciones = [
    0, -a, -a, 1, -a, -a, 1, a, -a, 0, a, -a,
    0, -a, a, 1, -a, a, 1, a, a, 0, a, a,
  ];
  geo.setAttribute('position', new BufferAttribute(new Float32Array(posiciones), 3));
  geo.setIndex([
    0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2,
  ]);
  geo.computeVertexNormals();
  return geo;
}
