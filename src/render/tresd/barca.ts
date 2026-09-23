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
  // [R-306] Zona de cada vértice: de 0 (quilla) a 1 (borda) en el costado, y
  // 2 en la cubierta. El sombreador corta la franja en 0,8 y pinta madera en
  // la cubierta: tres colores sin una malla más.
  const zonas: number[] = [];

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
      zonas.push(u);
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
    zonas.push(zonas[i]!);
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
    zonas.push(ZONA_CUBIERTA, ZONA_CUBIERTA);
  }
  for (let s = 0; s < SECCIONES; s++) {
    const a = base + s * 2;
    indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(posiciones), 3));
  geo.setAttribute('zona', new BufferAttribute(new Float32Array(zonas), 1));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** [R-306] Valor de `zona` de la cubierta. Por encima de 1,5 es madera. */
export const ZONA_CUBIERTA = 2;
/** [R-306] Desde qué altura del costado empieza la franja de la borda. */
export const ZONA_FRANJA = 0.8;

/**
 * Una vela triangular unitaria, en el plano YZ, con el pie en el origen. Lleva
 * PANZA: una vela plana se lee como un cartel, una con bolsa, como viento.
 */
export function geometriaDeVela(): BufferGeometry {
  const pasos = 6;
  const posiciones: number[] = [];
  const indices: number[] = [];
  const fila = (i: number): number => (i * (i + 1)) / 2;
  // Triángulo subdividido: de la baluma (i = 0, arriba) al pujamen (i = pasos).
  for (let i = 0; i <= pasos; i++) {
    for (let j = 0; j <= i; j++) {
      const a = i / pasos; // 0 en el puño de driza, 1 en el pie
      const b = i === 0 ? 0 : j / i; // 0 en el grátil, 1 en la baluma
      // El pie va de (y 0, z 0) en el grátil a (y 0,12, z −0,72) en el puño
      // de escota, como la vela plana de antes.
      const y = 1 - a + a * b * 0.12;
      const z = -0.72 * a * b;
      const panza = 0.09 * Math.sin(Math.PI * b) * Math.sin(Math.PI * Math.min(1, a * 1.1));
      posiciones.push(panza, y, z);
    }
  }
  for (let i = 0; i < pasos; i++) {
    for (let j = 0; j <= i; j++) {
      const a = fila(i) + j;
      const b = fila(i + 1) + j;
      indices.push(a, b, b + 1);
      if (j < i) indices.push(a, b + 1, a + 1);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(posiciones), 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Un prisma de caja entre dos puntos de X, para remos y remeros. */
function caja(
  posiciones: number[],
  indices: number[],
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
): void {
  const b = posiciones.length / 3;
  posiciones.push(
    x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0,
    x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1,
  );
  indices.push(
    ...[0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 6, 2, 3, 7, 6, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5].map(
      (i) => b + i,
    ),
  );
}

/**
 * [R-307] Un remo unitario de 1 de largo sobre el eje X: guion fino y una PALA
 * al final. Sin pala, a cincuenta metros un remo era una pata de araña.
 */
export function geometriaDeRemo(): BufferGeometry {
  const posiciones: number[] = [];
  const indices: number[] = [];
  const a = 0.018;
  caja(posiciones, indices, 0, 0.74, -a, a, -a, a);
  caja(posiciones, indices, 0.72, 1, -0.012, 0.012, -0.07, 0.07);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(posiciones), 3));
  geo.setIndex(indices);
  const plana = geo.toNonIndexed();
  plana.computeVertexNormals();
  return plana;
}

/**
 * [R-307] Un remero sentado, en METROS (no se escala con la barca): tronco con
 * la camiseta y cabeza. El atributo `piel` vale 1 en la cabeza: el sombreador
 * la pinta con el color de piel de la paleta y el tronco con la franja.
 */
export function geometriaDeRemero(): BufferGeometry {
  const posiciones: number[] = [];
  const indices: number[] = [];
  // Tronco: un poco más ancho de hombros que de cintura.
  caja(posiciones, indices, -0.2, 0.2, 0, 0.55, -0.12, 0.12);
  const finTronco = posiciones.length / 3;
  // Cabeza: un octaedro estirado basta a la distancia de la cámara.
  const c = { y: 0.72, r: 0.13 };
  const b = finTronco;
  posiciones.push(
    0, c.y + c.r * 1.15, 0,
    c.r, c.y, 0, 0, c.y, c.r, -c.r, c.y, 0, 0, c.y, -c.r,
    0, c.y - c.r, 0,
  );
  for (let k = 0; k < 4; k++) {
    const p = b + 1 + k;
    const q = b + 1 + ((k + 1) % 4);
    indices.push(b, q, p, b + 5, p, q);
  }
  const piel = new Float32Array(posiciones.length / 3);
  piel.fill(1, finTronco);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(posiciones), 3));
  geo.setAttribute('piel', new BufferAttribute(piel, 1));
  geo.setIndex(indices);
  const plana = geo.toNonIndexed();
  plana.computeVertexNormals();
  return plana;
}
