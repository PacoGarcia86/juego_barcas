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
//
// [R-308] La primera versión era un tubo de 13 secciones con una tapa plana a
// la altura de la borda: 286 triángulos y, de cerca, una vaina de guisante
// (`DR13`). Ahora el casco tiene arrufo, roda, espejo, quilla, tracas y es una
// barca ABIERTA, con bancadas donde se sientan los remeros.

import { BufferAttribute, BufferGeometry } from 'three';
import type { TipoCasco } from '../../engine/tipos.ts';

/** Secciones a lo largo de la eslora. */
const SECCIONES = 30;
/** [R-308] Tracas del tingladillo: cada una deja un escalón de luz. */
const TRACAS = 6;
/** Puntos por traca: canto de abajo (saliente) y canto de arriba. Una tabla es plana. */
const PUNTOS_TRACA = 2;
/** [R-308] Grueso de la regala y del forro, en unidades de manga. */
const GRUESO = 0.045;
/** [R-308] El plan (el suelo) va a este fondo del puntal, bajo la borda. */
const FONDO_PLAN = 0.52;
/** [R-308] Dónde está el codillo del planeador en el perfil (0 quilla, 1 borda). */
const CODILLO = 0.55;
/** [R-308] [R-310] La bancada va a este fondo del puntal, bajo la borda. */
const FONDO_BANCADA = 0.3;

/** [R-306] Valor de `zona` de la cubierta. Por encima de 1,5 es madera. */
export const ZONA_CUBIERTA = 2;
/** [R-308] Valor de `zona` de las bancadas: madera más clara. */
export const ZONA_BANCADA = 2.5;
/** [R-306] Desde qué altura del costado empieza la franja de la borda. */
export const ZONA_FRANJA = 0.8;

/**
 * [R-308] [R-310] Dónde van las bancadas, en fracción de eslora desde popa
 * (0 popa, 1 proa). Una por remero: `flota.ts` sienta a cada uno en la suya.
 */
export const BANCADAS: readonly number[] = [0.64, 0.49, 0.34];
/** [R-311] Dónde se planta el palo, en fracción de eslora desde popa. */
export const T_PALO = 0.8;

interface Forma {
  /** Media manga del espejo, en fracción de la media manga máxima. */
  espejo: number;
  /** Dónde está la manga máxima, desde popa. */
  maxima: number;
  /** Exponente de la entrada de proa: más alto, más fina. */
  entrada: number;
  /** [R-308] Arrufo: cuánto sube la borda en proa y en popa. */
  arrufoProa: number;
  arrufoPopa: number;
  /** Desde dónde levanta la quilla hacia la roda. */
  pie: number;
  /** Cuánto sube la quilla en el espejo. */
  quillaPopa: number;
  /** Dónde empiezan la cubierta de proa y la de popa. */
  cubiertaProa: number;
  cubiertaPopa: number;
}

const FORMAS: Record<TipoCasco, Forma> = {
  desplazamiento: {
    espejo: 0.36,
    maxima: 0.46,
    entrada: 1.25,
    arrufoProa: 0.3,
    arrufoPopa: 0.1,
    pie: 0.7,
    quillaPopa: 0.22,
    cubiertaProa: 0.86,
    cubiertaPopa: 0.08,
  },
  planeador: {
    espejo: 0.84,
    maxima: 0.4,
    entrada: 0.85,
    arrufoProa: 0.22,
    arrufoPopa: 0.03,
    pie: 0.58,
    quillaPopa: 0,
    cubiertaProa: 0.78,
    cubiertaPopa: 0.1,
  },
};

/** [R-308] La sección de un casco a una fracción `t` de eslora (0 popa, 1 proa). */
export function seccion(casco: TipoCasco, t: number): { semi: number; borda: number; quilla: number } {
  const f = FORMAS[casco];
  let ancho: number;
  if (t >= f.maxima) {
    const a = (t - f.maxima) / (1 - f.maxima);
    ancho = Math.pow(Math.max(0, Math.cos((a * Math.PI) / 2)), f.entrada);
  } else {
    const a = t / f.maxima;
    ancho = f.espejo + (1 - f.espejo) * Math.pow(Math.sin((a * Math.PI) / 2), 0.7);
  }
  const semi = 0.5 * Math.max(0.012, ancho);
  // [R-308] Arrufo: la borda sube a proa, y algo a popa.
  const borda =
    f.arrufoProa * Math.pow(Math.max(0, (t - 0.45) / 0.55), 2.2) +
    f.arrufoPopa * Math.pow(Math.max(0, (0.45 - t) / 0.45), 2);
  // La quilla levanta hacia la roda —el pie de roda— y un poco en el espejo.
  const pie = Math.pow(Math.max(0, (t - f.pie) / (1 - f.pie)), casco === 'planeador' ? 1.6 : 2);
  const popa = f.quillaPopa * Math.pow(Math.max(0, (0.16 - t) / 0.16), 1.5);
  const quilla = -1 + (1 + borda - 0.03) * pie + popa;
  return { semi, borda, quilla };
}

/**
 * Perfil de media sección, de la quilla (`u = 0`) a la borda (`u = 1`), sin
 * tracas. Un casco de desplazamiento es redondo; el planeador lleva fondo en V
 * y un codillo vivo al 55 %.
 */
function perfil(casco: TipoCasco, t: number, u: number): { x: number; y: number } {
  const { semi, borda, quilla } = seccion(casco, t);
  const puntal = borda - quilla;
  if (casco === 'planeador') {
    if (u <= CODILLO) {
      const a = u / CODILLO;
      return { x: semi * 0.9 * a, y: quilla + puntal * 0.2 * a };
    }
    const a = (u - CODILLO) / (1 - CODILLO);
    return { x: semi * (0.9 + 0.1 * Math.sqrt(a)), y: quilla + puntal * (0.2 + 0.8 * a) };
  }
  const th = (u * Math.PI) / 2;
  return { x: semi * Math.pow(Math.sin(th), 0.8), y: quilla + puntal * (1 - Math.cos(th)) };
}

/** Semimanga del casco a la altura `y`, buscada en el perfil. Para el forro. */
function semiA(casco: TipoCasco, t: number, y: number): number {
  let previo = perfil(casco, t, 0);
  for (let k = 1; k <= 40; k++) {
    const p = perfil(casco, t, k / 40);
    if (p.y >= y) {
      const a = (y - previo.y) / Math.max(1e-6, p.y - previo.y);
      return previo.x + (p.x - previo.x) * a;
    }
    previo = p;
  }
  return previo.x;
}

/** [R-308] [R-310] Punto unitario donde se sienta el remero `i`: encima de su bancada. */
export function asientoDe(casco: TipoCasco, i: number): { y: number; z: number } {
  const t = BANCADAS[i] ?? 0.5;
  const s = seccion(casco, t);
  return { y: s.borda - (s.borda - s.quilla) * FONDO_BANCADA + 0.03, z: t - 0.5 };
}

/** Acumula triángulos y vértices con su zona. */
class Malla {
  readonly pos: number[] = [];
  readonly zona: number[] = [];
  readonly idx: number[] = [];

  punto(x: number, y: number, z: number, zona: number): number {
    this.pos.push(x, y, z);
    this.zona.push(zona);
    return this.zona.length - 1;
  }

  /** Una rejilla de `filas × columnas` puntos ya añadidos desde `base`. */
  rejilla(base: number, filas: number, columnas: number, girar: boolean): void {
    for (let f = 0; f < filas - 1; f++) {
      for (let c = 0; c < columnas - 1; c++) {
        const a = base + f * columnas + c;
        const b = a + columnas;
        if (girar) this.idx.push(a, b + 1, b, a, a + 1, b + 1);
        else this.idx.push(a, b, b + 1, a, b + 1, a + 1);
      }
    }
  }

  /** Una caja entre dos esquinas, con sus seis caras. */
  caja(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, zona: number): void {
    const b = this.zona.length;
    const esquinas = [
      [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
      [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
    ];
    for (const [x, y, z] of esquinas) this.punto(x!, y!, z!, zona);
    for (const i of [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 6, 2, 3, 7, 6, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5]) {
      this.idx.push(b + i);
    }
  }

  /** Copia en espejo (x → −x) de los vértices desde `desde`, con las caras dadas la vuelta. */
  espejo(desde: number, desdeIdx: number): void {
    const n = this.zona.length;
    for (let i = desde; i < n; i++) this.punto(-this.pos[i * 3]!, this.pos[i * 3 + 1]!, this.pos[i * 3 + 2]!, this.zona[i]!);
    const hasta = this.idx.length;
    for (let i = desdeIdx; i < hasta; i += 3) {
      this.idx.push(this.idx[i + 2]! - desde + n, this.idx[i + 1]! - desde + n, this.idx[i]! - desde + n);
    }
  }

  geometria(): BufferGeometry {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    geo.setAttribute('zona', new BufferAttribute(new Float32Array(this.zona), 1));
    geo.setIndex(this.idx);
    geo.computeVertexNormals();
    return geo;
  }
}

/**
 * [R-303] [R-308] Casco unitario: 1 de eslora (en Z, proa hacia +Z), 1 de
 * manga (en X), y la quilla en y = −1 con la borda del centro en y = 0. Quien
 * lo use lo escala.
 *
 * `zona` marca cada vértice [R-306]: de 0 (quilla) a 1 (borda) en el costado,
 * `ZONA_CUBIERTA` en la madera de dentro y `ZONA_BANCADA` en las bancadas.
 */
export function geometriaDeCasco(casco: TipoCasco): BufferGeometry {
  const f = FORMAS[casco];
  const m = new Malla();
  const madera = ZONA_CUBIERTA;
  const lapas = casco === 'desplazamiento';

  // -- Costado de estribor, con tracas [R-308] ------------------------------
  // El canto de abajo de cada traca sale hacia fuera y el de arriba queda
  // enrasado, así que entre dos tracas hay un escalón que la luz marca. El
  // planeador es liso —fibra, no madera— y lleva el codillo DOS veces en el
  // mismo sitio: con vértices propios a cada lado, la arista queda viva.
  const perfilU: { u: number; saliente: number }[] = [];
  if (lapas) {
    for (let k = 0; k < TRACAS; k++) {
      for (let p = 0; p < PUNTOS_TRACA; p++) {
        const a = p / (PUNTOS_TRACA - 1);
        perfilU.push({ u: (k + a) / TRACAS, saliente: (1 - a) * 0.014 });
      }
    }
  } else {
    for (const u of [0, 0.14, 0.28, 0.42, CODILLO, CODILLO, 0.66, 0.78, ZONA_FRANJA + 0.01, 0.9, 1]) perfilU.push({ u, saliente: 0 });
  }
  // Normal del perfil en 2D, hacia fuera, para sacar el canto de la traca.
  const costado = (t: number, u: number, saliente: number): { x: number; y: number } => {
    const p = perfil(casco, t, u);
    const q = perfil(casco, t, Math.min(1, u + 0.01));
    const r = perfil(casco, t, Math.max(0, u - 0.01));
    const dx = q.x - r.x;
    const dy = q.y - r.y;
    const l = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dy / l) * saliente, y: p.y - (dx / l) * saliente };
  };
  const baseCostado = m.zona.length;
  const inicioIdx = m.idx.length;
  for (let s = 0; s <= SECCIONES; s++) {
    const t = s / SECCIONES;
    for (const { u, saliente } of perfilU) {
      const p = costado(t, u, saliente);
      m.punto(p.x, p.y, t - 0.5, u);
    }
  }
  m.rejilla(baseCostado, SECCIONES + 1, perfilU.length, false);

  // -- Regala: el canto de la borda, del color de la franja [R-306] ---------
  const baseRegala = m.zona.length;
  for (let s = 0; s <= SECCIONES; s++) {
    const t = s / SECCIONES;
    const { semi, borda } = seccion(casco, t);
    m.punto(semi, borda, t - 0.5, 1);
    m.punto(Math.max(0, semi - GRUESO), borda, t - 0.5, 1);
  }
  m.rejilla(baseRegala, SECCIONES + 1, 2, true);

  // -- Forro interior y plan: la barca es ABIERTA [R-308] -------------------
  // Entre la cubierta de popa y la de proa. De la borda baja el forro hasta el
  // plan, y el plan llega a crujía.
  const sInicio = Math.round(f.cubiertaPopa * SECCIONES);
  const sFin = Math.round(f.cubiertaProa * SECCIONES);
  const PASOS_FORRO = 5;
  const baseForro = m.zona.length;
  for (let s = sInicio; s <= sFin; s++) {
    const t = s / SECCIONES;
    const { borda, quilla } = seccion(casco, t);
    const plan = borda - (borda - quilla) * FONDO_PLAN;
    for (let k = 0; k <= PASOS_FORRO; k++) {
      const y = borda - (borda - plan) * (k / PASOS_FORRO);
      m.punto(Math.max(0.01, semiA(casco, t, y) - GRUESO), y, t - 0.5, madera);
    }
    m.punto(0, plan, t - 0.5, madera);
  }
  m.rejilla(baseForro, sFin - sInicio + 1, PASOS_FORRO + 2, true);

  // Mamparos: cierran el hueco contra las cubiertas de proa y de popa.
  for (const [s, girar] of [[sInicio, false], [sFin, true]] as const) {
    const t = s / SECCIONES;
    const { borda, quilla } = seccion(casco, t);
    const plan = borda - (borda - quilla) * FONDO_PLAN;
    const b = m.zona.length;
    for (let k = 0; k <= PASOS_FORRO; k++) {
      const y = borda - (borda - plan) * (k / PASOS_FORRO);
      m.punto(Math.max(0.01, semiA(casco, t, y) - GRUESO), y, t - 0.5, madera);
      m.punto(0, y, t - 0.5, madera);
    }
    m.rejilla(b, PASOS_FORRO + 1, 2, girar);
  }

  // -- Cubiertas de proa y de popa, a ras de borda --------------------------
  for (const [desde, hasta] of [[0, sInicio], [sFin, SECCIONES]] as const) {
    const b = m.zona.length;
    for (let s = desde; s <= hasta; s++) {
      const t = s / SECCIONES;
      const { semi, borda } = seccion(casco, t);
      m.punto(Math.max(0.005, semi - GRUESO), borda - 0.005, t - 0.5, madera);
      m.punto(0, borda + 0.01, t - 0.5, madera);
    }
    m.rejilla(b, hasta - desde + 1, 2, false);
  }

  // -- Espejo de popa: cierra el casco por detrás -------------------------
  {
    const { borda, quilla } = seccion(casco, 0);
    const centro = m.punto(0, (borda + quilla) / 2, -0.5, 0.5);
    const b = m.zona.length;
    // El borde, con los MISMOS puntos que el costado: si no, las tracas le
    // dejaban dientes.
    for (const { u, saliente } of perfilU) {
      const p = costado(0, u, saliente);
      m.punto(p.x, p.y, -0.5, u);
    }
    for (let k = 0; k < perfilU.length - 1; k++) m.idx.push(centro, b + k + 1, b + k);
    // Y el canto de arriba del espejo, hasta la cubierta de popa.
    const { semi } = seccion(casco, 0);
    const c = m.zona.length;
    m.punto(semi, borda, -0.5, 1);
    m.punto(0, borda + 0.01, -0.5, 1);
    m.idx.push(centro, c + 1, c);
  }

  // -- Quilla, y en el de desplazamiento, un timón bajo el espejo -----------
  if (casco === 'desplazamiento') {
    const b = m.zona.length;
    for (let s = 2; s <= SECCIONES - 3; s++) {
      const t = s / SECCIONES;
      const { quilla } = seccion(casco, t);
      m.punto(0.008, quilla + 0.02, t - 0.5, 0);
      m.punto(0.008, quilla - 0.07, t - 0.5, 0);
    }
    m.rejilla(b, SECCIONES - 4, 2, true);
    const q0 = seccion(casco, 0).quilla;
    m.caja(0, 0.008, q0 - 0.32, q0 + 0.12, -0.5, -0.47, 0);
  } else {
    // [R-308] El planeador lleva un par de cantoneras: le dan el codillo de lado.
    const b = m.zona.length;
    for (let s = 0; s <= SECCIONES - 6; s++) {
      const t = s / SECCIONES;
      const p = perfil(casco, t, CODILLO);
      m.punto(p.x, p.y, t - 0.5, CODILLO);
      m.punto(p.x + 0.035, p.y + 0.02, t - 0.5, CODILLO);
    }
    m.rejilla(b, SECCIONES - 5, 2, false);
  }

  // Todo lo de arriba es el costado de estribor; lo que pasa por crujía se
  // refleja sobre sí mismo sin estorbar.
  m.espejo(baseCostado, inicioIdx);
  // -- [R-308] [R-310] Bancadas, de costado a costado: aquí se sientan --------
  for (let i = 0; i < BANCADAS.length; i++) {
    const t = BANCADAS[i]!;
    const { y } = asientoDe(casco, i);
    const ancho = semiA(casco, t, y) - GRUESO * 0.5;
    m.caja(-ancho, ancho, y - 0.06, y - 0.03, t - 0.5 - 0.022, t - 0.5 + 0.022, ZONA_BANCADA);
  }

  return m.geometria();
}

/**
 * [R-311] Aparejo unitario: palo, botavara y una vela con PANZA. La vela va en
 * el plano YZ, amurada al palo (en el origen) y con el puño de escota hacia
 * popa (−Z). `parte` vale 1 en el palo y la botavara, que son de madera.
 *
 * Una vela plana se lee como un cartel; una con bolsa, como viento.
 */
export function geometriaDeVela(): BufferGeometry {
  const pasos = 8;
  const posiciones: number[] = [];
  const partes: number[] = [];
  const indices: number[] = [];
  const pie = 0.3;
  const fila = (i: number): number => (i * (i + 1)) / 2;
  // Triángulo subdividido: del puño de driza (i = 0) al pujamen (i = pasos).
  for (let i = 0; i <= pasos; i++) {
    for (let j = 0; j <= i; j++) {
      const a = i / pasos; // 0 en el puño de driza, 1 en el pie
      const b = i === 0 ? 0 : j / i; // 0 en el grátil, 1 en la baluma
      const y = 1 - a * (1 - pie) + a * b * 0.05;
      const z = -0.72 * a * b;
      const panza = 0.075 * Math.sin(Math.PI * b) * Math.sin(Math.PI * Math.min(1, a * 1.05));
      posiciones.push(panza, y, z);
      partes.push(0);
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
  // Palo y botavara, de madera.
  barra(posiciones, indices, [0, -0.12, 0.012], [0, 1.04, 0.012], 0.015, 0.011);
  barra(posiciones, indices, [0, pie - 0.02, 0.01], [0, pie - 0.02, -0.76], 0.011, 0.009);
  while (partes.length < posiciones.length / 3) partes.push(1);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(posiciones), 3));
  geo.setAttribute('parte', new BufferAttribute(new Float32Array(partes), 1));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Un prisma de seis caras entre dos puntos, con un radio en cada punta. Para
 * remos y remeros: con cajas los brazos eran palos de fósforo.
 */
function barra(
  posiciones: number[],
  indices: number[],
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  ra: number,
  rb: number,
  lados = 6,
): void {
  const base = posiciones.length / 3;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const l = Math.hypot(dx, dy, dz) || 1;
  const [ex, ey, ez] = Math.abs(dy / l) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  let px = ey * dz - ez * dy;
  let py = ez * dx - ex * dz;
  let pz = ex * dy - ey * dx;
  const lp = Math.hypot(px, py, pz) || 1;
  px /= lp;
  py /= lp;
  pz /= lp;
  const qx = (dy * pz - dz * py) / l;
  const qy = (dz * px - dx * pz) / l;
  const qz = (dx * py - dy * px) / l;
  for (const [c, r] of [[a, ra], [b, rb]] as const) {
    for (let k = 0; k < lados; k++) {
      const g = (k / lados) * Math.PI * 2;
      const co = Math.cos(g) * r;
      const si = Math.sin(g) * r;
      posiciones.push(c[0] + px * co + qx * si, c[1] + py * co + qy * si, c[2] + pz * co + qz * si);
    }
  }
  for (let k = 0; k < lados; k++) {
    const p = base + k;
    const q = base + ((k + 1) % lados);
    indices.push(p, q, q + lados, p, q + lados, p + lados);
  }
  // Tapas.
  for (let k = 1; k < lados - 1; k++) {
    indices.push(base, base + k + 1, base + k);
    indices.push(base + lados, base + lados + k, base + lados + k + 1);
  }
}

/**
 * Una esfera baja de polígonos centrada en `c`. Con `hastaLat` < 6 se corta:
 * con 3, media esfera.
 */
function bola(
  posiciones: number[],
  indices: number[],
  c: readonly [number, number, number],
  r: readonly [number, number, number],
  hastaLat = 6,
): void {
  const LAT = 6;
  const LON = 8;
  const base = posiciones.length / 3;
  for (let i = 0; i <= hastaLat; i++) {
    const th = (i / LAT) * Math.PI;
    for (let j = 0; j < LON; j++) {
      const ph = (j / LON) * Math.PI * 2;
      posiciones.push(
        c[0] + Math.sin(th) * Math.cos(ph) * r[0],
        c[1] + Math.cos(th) * r[1],
        c[2] + Math.sin(th) * Math.sin(ph) * r[2],
      );
    }
  }
  for (let i = 0; i < hastaLat; i++) {
    for (let j = 0; j < LON; j++) {
      const a = base + i * LON + j;
      const b = base + i * LON + ((j + 1) % LON);
      indices.push(a, b, b + LON, a, b + LON, a + LON);
    }
  }
}

/** Fracción del remo, desde el tolete, que queda DENTRO de la barca (el guion). */
export const GUION = 0.26;

/**
 * [R-307] [R-310] Un remo unitario sobre el eje X con el TOLETE en el origen:
 * el guion va de −`GUION` a 0 (dentro de la barca) y la pala, VERTICAL, del
 * 0,72 al 1. Sin pala, a cincuenta metros un remo era una pata de araña. El
 * atributo `pala` vale 1 en la pala: se pinta con el color de la franja.
 */
export function geometriaDeRemo(): BufferGeometry {
  const posiciones: number[] = [];
  const indices: number[] = [];
  barra(posiciones, indices, [-GUION, 0, 0], [0.74, 0, 0], 0.022, 0.017);
  const finCana = posiciones.length / 3;
  // Pala de cuchara: ancha en vertical, fina de canto, un poco curvada.
  const xs = [0.7, 0.76, 0.84, 0.93, 1];
  const altos = [0.018, 0.06, 0.085, 0.085, 0.06];
  const base = posiciones.length / 3;
  for (let i = 0; i < xs.length; i++) {
    const cuchara = 0.018 * Math.sin((i / (xs.length - 1)) * Math.PI);
    for (const [y, z] of [[-altos[i]!, 0.007], [altos[i]!, 0.007], [altos[i]!, -0.007], [-altos[i]!, -0.007]]) {
      posiciones.push(xs[i]!, y!, z! + cuchara * (1 - (y! / altos[i]!) ** 2));
    }
  }
  for (let i = 0; i < xs.length - 1; i++) {
    for (let k = 0; k < 4; k++) {
      const a = base + i * 4 + k;
      const b = base + i * 4 + ((k + 1) % 4);
      indices.push(a, a + 4, b + 4, a, b + 4, b);
    }
  }
  const punta = base + (xs.length - 1) * 4;
  indices.push(punta, punta + 1, punta + 2, punta, punta + 2, punta + 3);
  const pala = new Float32Array(posiciones.length / 3);
  pala.fill(1, finCana);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(posiciones), 3));
  geo.setAttribute('pala', new BufferAttribute(pala, 1));
  geo.setIndex(indices);
  const plana = geo.toNonIndexed();
  plana.computeVertexNormals();
  return plana;
}

/** [R-310] Partes del remero: qué color lleva cada vértice. */
export const PARTE = { camiseta: 0, piel: 1, pantalon: 2, gorra: 3 } as const;

/**
 * [R-307] [R-310] Un remero sentado, en METROS (no se escala con la barca),
 * con el origen en el asiento y mirando a +Z. Cabeza redonda con gorra,
 * tronco, brazos hasta el guion y piernas hacia los pies. La primera versión
 * era una caja con un octaedro encima: una ficha de parchís (`DR14`).
 *
 * El atributo `parte` dice de qué color es cada vértice (`PARTE`): la camiseta
 * con la franja de la barca, la piel de la paleta, pantalón oscuro, gorra clara.
 */
export function geometriaDeRemero(): BufferGeometry {
  const posiciones: number[] = [];
  const indices: number[] = [];
  const partes: number[] = [];
  const marcar = (parte: number): void => {
    while (partes.length < posiciones.length / 3) partes.push(parte);
  };

  // Piernas: muslo hacia delante y espinilla hacia el suelo.
  for (const x of [-0.1, 0.1]) {
    barra(posiciones, indices, [x, 0.07, 0], [x * 1.1, 0.13, 0.42], 0.075, 0.06);
    barra(posiciones, indices, [x * 1.1, 0.13, 0.42], [x * 1.1, -0.3, 0.5], 0.055, 0.045);
    barra(posiciones, indices, [x * 1.1, -0.32, 0.46], [x * 1.1, -0.32, 0.62], 0.045, 0.04, 4);
  }
  barra(posiciones, indices, [0, 0, -0.02], [0, 0.14, -0.02], 0.17, 0.16, 8);
  marcar(PARTE.pantalon);

  // Tronco: de la cintura a los hombros, más ancho arriba. Ovalado: se
  // escala en Z tras hacerlo redondo.
  const inicioTronco = posiciones.length / 3;
  barra(posiciones, indices, [0, 0.12, -0.02], [0, 0.4, 0], 0.16, 0.19, 8);
  barra(posiciones, indices, [0, 0.4, 0], [0, 0.58, 0.01], 0.19, 0.13, 8);
  for (let i = inicioTronco; i < posiciones.length / 3; i++) posiciones[i * 3 + 2]! *= 0.68;
  // Brazos: hombro, codo y manos en el guion, delante y abajo.
  for (const x of [-1, 1]) {
    barra(posiciones, indices, [x * 0.19, 0.53, 0], [x * 0.2, 0.36, 0.2], 0.052, 0.045);
  }
  marcar(PARTE.camiseta);
  for (const x of [-1, 1]) {
    barra(posiciones, indices, [x * 0.2, 0.36, 0.2], [x * 0.14, 0.33, 0.46], 0.04, 0.034);
    barra(posiciones, indices, [x * 0.14, 0.33, 0.46], [x * 0.13, 0.33, 0.54], 0.042, 0.036, 4);
  }
  // Cuello y cabeza.
  barra(posiciones, indices, [0, 0.57, 0.01], [0, 0.66, 0.02], 0.055, 0.052);
  bola(posiciones, indices, [0, 0.76, 0.02], [0.1, 0.115, 0.105]);
  marcar(PARTE.piel);
  // Gorra: media esfera encima de la cabeza y una visera hacia delante.
  bola(posiciones, indices, [0, 0.79, 0.015], [0.108, 0.1, 0.113], 3);
  barra(posiciones, indices, [0, 0.8, 0.08], [0, 0.79, 0.19], 0.07, 0.06, 4);
  marcar(PARTE.gorra);

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(posiciones), 3));
  geo.setAttribute('parte', new BufferAttribute(new Float32Array(partes), 1));
  geo.setIndex(indices);
  const plana = geo.toNonIndexed();
  plana.computeVertexNormals();
  return plana;
}
