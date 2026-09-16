// [A-101] El catálogo. Dato declarativo: cambiar el precio de una barca es
// cambiar una línea, nunca tocar lógica.
//
// [A-102] **NINGUNA BARCA DOMINA A OTRA** en las cinco características
// (`eslora`, `empuje`, `maniobra`, `estabilidad`, `plazas`). Es un frente de
// Pareto, es lo que hace que comprar sea decidir en vez de esperar a tener el
// dinero, y hay test estático sobre las quince parejas. Antes de «equilibrar»
// un número, mira qué pareja rompes: la auditoría encontró dos barcas
// dominadas y no tenían ninguna razón para existir (`DA1`).
//
// `coefOla` NO está en el frente de Pareto y no es un número libre: mide lo
// fina que es la carena. Los dos cascos planeadores son romos y levantan mucha
// más ola POR DEBAJO del planeo (0,0072–0,0078) que una traiñera (0,0030). Es
// lo que les pone la joroba delante, y lo que hace que la `lancha` necesite
// tripulación para subirse encima del agua.

import type { Barca } from '../tipos.ts';

export const BARCAS: Barca[] = [
  {
    id: 'chalana',
    nombre: 'Chalana',
    // [A-103] Gratis, la peor en eslora y empuje — y la MEJOR en maniobra.
    eslora: 6.0,
    manga: 1.9,
    empuje: 1800,
    maniobra: 92,
    estabilidad: 62,
    plazas: 2,
    casco: 'desplazamiento',
    masa: 420,
    coefOla: 0.0055,
    crucero: 0.7,
    precio: 0,
    colores: { casco: '#9a6b3f', franja: '#e6d3a3', vela: '#f2ead8' },
    descripcion: 'Corta, ligera y obediente. Vira donde no cabe nadie y se queda sin agua en la recta.',
  },
  {
    id: 'neumatica',
    nombre: 'Neumática',
    eslora: 5.4,
    manga: 2.4,
    empuje: 1780,
    maniobra: 85,
    estabilidad: 55,
    plazas: 3,
    casco: 'planeador',
    masa: 380,
    coefOla: 0.0078,
    crucero: 0.64,
    precio: 1400,
    colores: { casco: '#1f2a36', franja: '#ff6b35', vela: '#d9e2ec' },
    descripcion: 'Se sube encima del agua y deja de arrastrar su ola. Gasta como nadie y con marejada va donde quiere, no donde tú digas.',
  },
  {
    id: 'patin',
    nombre: 'Patín',
    eslora: 7.0,
    manga: 2.6,
    empuje: 1950,
    maniobra: 88,
    estabilidad: 95,
    plazas: 2,
    casco: 'desplazamiento',
    masa: 480,
    coefOla: 0.005,
    crucero: 0.63,
    precio: 2100,
    colores: { casco: '#f4f1e8', franja: '#2f6f8f', vela: '#ffffff' },
    descripcion: 'Dos cascos: el mar de fondo no la despeina. Poca gente cabe y poco empuje lleva.',
  },
  {
    id: 'trainera',
    nombre: 'Trainera',
    eslora: 12.0,
    manga: 1.8,
    empuje: 1350,
    maniobra: 58,
    estabilidad: 70,
    plazas: 5,
    casco: 'desplazamiento',
    masa: 900,
    coefOla: 0.0034,
    crucero: 0.69,
    precio: 2600,
    colores: { casco: '#123b2e', franja: '#d8b45a', vela: '#efe6cf' },
    descripcion: 'Larga y fina: rueda sola, casi no levanta ola y se rema toda la tarde sin cansarse. Para virarla hay que pedírselo antes.',
  },
  {
    id: 'lancha',
    nombre: 'Lancha',
    eslora: 8.2,
    manga: 2.8,
    empuje: 2150,
    maniobra: 74,
    estabilidad: 72,
    plazas: 4,
    casco: 'planeador',
    masa: 760,
    coefOla: 0.0072,
    crucero: 0.72,
    precio: 3800,
    colores: { casco: '#b8112a', franja: '#f2f2f2', vela: '#e8e8e8' },
    descripcion: 'Empuje de sobra para subirse encima del agua y quedarse ahí, pero a tope se queda sin gente enseguida. En curvas cerradas, un armario con motor.',
  },
  {
    id: 'galeota',
    nombre: 'Galeota',
    eslora: 14.5,
    manga: 3.2,
    empuje: 1450,
    maniobra: 45,
    estabilidad: 88,
    plazas: 6,
    casco: 'desplazamiento',
    masa: 1250,
    coefOla: 0.0028,
    crucero: 0.66,
    precio: 4600,
    colores: { casco: '#2b2f4a', franja: '#c9a227', vela: '#e3dcc8' },
    descripcion: 'Seis plazas, velocidad de casco de 4,76 m/s y el mar de fondo le da igual. En un canal estrecho es un armario.',
  },
];

export function barcaPorId(id: string): Barca | undefined {
  return BARCAS.find((b) => b.id === id);
}
