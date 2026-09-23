// [R-401] Hora del día y estado del mar → todos los colores del render.
//
// Es la ÚNICA fuente de color de `src/render/`: hay test estático que prohíbe
// un color literal en cualquier otro fichero. No es una regla de estilo: un
// color suelto en el fichero de las boyas es el color que no cambia cuando el
// circuito pasa a ser de noche.

import type { Circuito } from '../engine/tipos.ts';

export interface Paleta {
  cielo: string;
  horizonte: string;
  sol: string;
  aguaHonda: string;
  aguaSomera: string;
  espuma: string;
  niebla: string;
  costa: string;
  vegetacion: string;
  roca: string;
  boya: string;
  huevo: string;
  /** [R-406] Color de las nubes, del lado que da el sol. */
  nubes: string;
  /** [R-407] Playa de las islas. */
  arena: string;
  /** [R-306] [R-307] Cubierta, remos y bancadas. */
  madera: string;
  /** [R-307] La cara y los brazos de los remeros. */
  piel: string;
  /** [R-408] La luz del tope de las boyas. */
  luzBoya: string;
  /** [R-406] 0–1: cuánto cielo tapan las nubes. */
  nubosidad: number;
  /** [R-406] 0–1: cuántas estrellas se ven. Solo de noche. */
  estrellas: number;
  /** Intensidad de la luz direccional. */
  luz: number;
  /** Intensidad de la luz ambiente. */
  ambiente: number;
  /** Altura del sol sobre el horizonte, en radianes. */
  altura: number;
  /** Densidad de la niebla exponencial al cuadrado (`FogExp2`): la de la escena y la del agua [R-207]. */
  densidadNiebla: number;
}

const HORAS: Record<Circuito['hora'], Paleta> = {
  amanecer: {
    cielo: '#1d3a5c',
    horizonte: '#f0a868',
    sol: '#ffd9a0',
    aguaHonda: '#0a2036',
    aguaSomera: '#2a6b8a',
    espuma: '#ffe8d0',
    niebla: '#d6b59c',
    costa: '#6e7a5e',
    vegetacion: '#3d5a3a',
    roca: '#5a5450',
    boya: '#ff7a3d',
    huevo: '#fff2cc',
    nubes: '#ffc9a8',
    arena: '#d9c29a',
    madera: '#9a6a42',
    piel: '#d9a07a',
    luzBoya: '#ffd27a',
    nubosidad: 0.45,
    estrellas: 0.0,
    luz: 1.5,
    ambiente: 0.55,
    altura: 0.18,
    densidadNiebla: 0.0042,
  },
  mediodia: {
    cielo: '#3f8fd0',
    horizonte: '#b9dcf2',
    sol: '#fffaf0',
    aguaHonda: '#07344f',
    aguaSomera: '#2f97b8',
    espuma: '#ffffff',
    niebla: '#c8dced',
    costa: '#8a8a6a',
    vegetacion: '#4a7040',
    roca: '#77706a',
    boya: '#ff4d2e',
    huevo: '#fff8e0',
    nubes: '#ffffff',
    arena: '#e8d9b0',
    madera: '#a8744a',
    piel: '#e0aa84',
    luzBoya: '#ffe08a',
    nubosidad: 0.35,
    estrellas: 0.0,
    luz: 2.4,
    ambiente: 0.8,
    altura: 1.05,
    densidadNiebla: 0.0016,
  },
  tarde: {
    cielo: '#2c5f86',
    horizonte: '#e9b07a',
    sol: '#ffcf8a',
    aguaHonda: '#0b2a3d',
    aguaSomera: '#2b7a92',
    espuma: '#ffeedd',
    niebla: '#d8bca0',
    costa: '#7a7358',
    vegetacion: '#42603c',
    roca: '#6a625c',
    boya: '#ff6a2e',
    huevo: '#fff4d4',
    nubes: '#ffd0a0',
    arena: '#dcc49a',
    madera: '#9c6c44',
    piel: '#d8a07c',
    luzBoya: '#ffd27a',
    nubosidad: 0.5,
    estrellas: 0.0,
    luz: 1.8,
    ambiente: 0.62,
    altura: 0.42,
    densidadNiebla: 0.0028,
  },
  noche: {
    cielo: '#060d1c',
    horizonte: '#16304e',
    sol: '#b9c9e8',
    aguaHonda: '#03101d',
    aguaSomera: '#0e3550',
    espuma: '#b9d4e8',
    niebla: '#1b2c42',
    costa: '#2a2f33',
    vegetacion: '#1e2d24',
    roca: '#31312f',
    boya: '#ff9a3d',
    huevo: '#e8e4c8',
    nubes: '#3a4a66',
    arena: '#6a6a60',
    madera: '#5a4a3a',
    piel: '#8a7060',
    luzBoya: '#ffb04a',
    nubosidad: 0.4,
    estrellas: 1.0,
    luz: 1.0,
    ambiente: 0.95,
    altura: 0.26,
    densidadNiebla: 0.0048,
  },
};

/**
 * [R-401] La paleta de un circuito. El mar de fondo oscurece el agua y espesa
 * la niebla: con marejada se ve menos, y eso lo dice el color, no un aviso.
 */
export function paletaDe(circuito: Circuito): Paleta {
  const base = HORAS[circuito.hora];
  const mar = Math.min(1, Math.max(0, circuito.oleajeBase));
  return {
    ...base,
    densidadNiebla: base.densidadNiebla * (1 + mar * 1.4),
    ambiente: base.ambiente * (1 - mar * 0.15),
    // [R-406] Con marejada el cielo se cierra.
    nubosidad: Math.min(0.85, base.nubosidad + mar * 0.45),
  };
}

/**
 * [R-406] [R-506] Dirección HACIA el sol, normalizada. La usan la luz, el disco
 * del cielo y el brillo del agua: una sola cuenta, o el reflejo del sol cae en
 * un sitio y el sol en otro.
 */
export function direccionDelSol(paleta: Paleta): { x: number; y: number; z: number } {
  const x = Math.cos(paleta.altura) * 0.84;
  const y = Math.sin(paleta.altura);
  const z = Math.cos(paleta.altura) * 0.55;
  const n = Math.hypot(x, y, z);
  return { x: x / n, y: y / n, z: z / n };
}

/** Color del maillot… del casco. Lo declara la barca, y aquí solo se valida. */
export function colorDeCasco(colores: { casco: string; franja: string; vela: string }): {
  casco: string;
  franja: string;
  vela: string;
} {
  return colores;
}
