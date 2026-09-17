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
  /** Intensidad de la luz direccional. */
  luz: number;
  /** Intensidad de la luz ambiente. */
  ambiente: number;
  /** Altura del sol sobre el horizonte, en radianes. */
  altura: number;
  /** Densidad de la niebla. */
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
    niebla: '#9ab4c8',
    costa: '#6e7a5e',
    vegetacion: '#3d5a3a',
    roca: '#5a5450',
    boya: '#ff7a3d',
    huevo: '#fff2cc',
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
    niebla: '#a9bccd',
    costa: '#7a7358',
    vegetacion: '#42603c',
    roca: '#6a625c',
    boya: '#ff6a2e',
    huevo: '#fff4d4',
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
    luz: 0.55,
    ambiente: 0.34,
    altura: 0.26,
    densidadNiebla: 0.0062,
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
  };
}

/** Color del maillot… del casco. Lo declara la barca, y aquí solo se valida. */
export function colorDeCasco(colores: { casco: string; franja: string; vela: string }): {
  casco: string;
  franja: string;
  vela: string;
} {
  return colores;
}
