// [B-104] Los cuatro circuitos. Dato declarativo: cambiar el oleaje de uno es
// cambiar una línea, nunca tocar lógica.
//
// **Todos declaran `procedencia: 'ficticio'`** y la pantalla lo enseña. No hay
// circuitos reales en el juego: un dato aproximado sin etiqueta se convierte en
// un dato falso.
//
// [B-102] Ningún tramo pasa del 30 % de la vuelta. Hay test estático.
//
// [R-105] **Los cuatro son CIRCUITOS: sus curvas suman una vuelta entera.**
// `Σ longitud/radio = ±2π`. Un circuito cuyas curvas no la suman no se puede
// cerrar sin deformarlo, y los cuatro empezaron así: `faro` giraba −0,24 rad de
// los 6,28 que hacen falta (`DR7`).
//
// Y los tramos rectos entre curva y curva miden **lo mismo**. El rumbo puede
// cerrar y la vuelta seguir sin cerrar en posición: con los rectos desiguales,
// la polilínea de `faro` medía 1 037 m para los 1 380 declarados y el mundo
// salía encogido un 25 % (`DR6`).

import type { Circuito } from '../tipos.ts';

export const CIRCUITOS: Circuito[] = [
  {
    id: 'ria',
    nombre: 'La Ría',
    procedencia: 'ficticio',
    vueltas: 3,
    oleajeBase: 0.05,
    hora: 'amanecer',
    descripcion: 'Agua quieta, corriente de río y una serpiente de curvas de radio 30. Se gana con el timón, no con la recta.',
    // Cinco curvas de radio 30, tres de ellas contra las otras dos. Las
    // CONTRACURVAS son el truco: una vuelta cerrada solo puede girar 2π en
    // total, así que meter mucha curva Y que sea cerrada exige que parte de
    // ella gire al revés. Sin contracurvas, con 200 m de arco los radios se
    // iban a 32 m de media y la barca larga ganaba el 70 % de las regatas.
    tramos: [
      { tipo: 'recta', longitud: 102, anchura: 20, radio: 0, corriente: 0.5, oleaje: 0 },
      { tipo: 'curva', longitud: 120, anchura: 18, radio: 30, corriente: 0.3, oleaje: 0 },
      { tipo: 'estrecho', longitud: 102, anchura: 10, radio: 0, corriente: 1.1, oleaje: 0.05 },
      { tipo: 'curva', longitud: 100, anchura: 16, radio: -30, corriente: 0, oleaje: 0 },
      { tipo: 'recta', longitud: 102, anchura: 22, radio: 0, corriente: -0.4, oleaje: 0.05 },
      { tipo: 'curva', longitud: 110, anchura: 18, radio: 30, corriente: 0, oleaje: 0 },
      { tipo: 'estrecho', longitud: 102, anchura: 11, radio: 0, corriente: 0.8, oleaje: 0 },
      { tipo: 'curva', longitud: 80, anchura: 16, radio: -30, corriente: -0.6, oleaje: 0 },
      { tipo: 'recta', longitud: 102, anchura: 20, radio: 0, corriente: 0, oleaje: 0 },
      { tipo: 'curva', longitud: 140, anchura: 18, radio: 30, corriente: 0.2, oleaje: 0 },
    ],
  },
  {
    id: 'faro',
    nombre: 'El Faro',
    procedencia: 'ficticio',
    vueltas: 3,
    oleajeBase: 0.45,
    hora: 'tarde',
    descripcion: 'Mar abierto, marejada y dos curvones. Aquí manda la eslora, y el aguante.',
    // 2 curvas de radio 57 y dos rectos de 510 m: un óvalo de mar abierto.
    tramos: [
      { tipo: 'recta', longitud: 320, anchura: 28, radio: 0, corriente: 0, oleaje: 0.1 },
      { tipo: 'oleaje', longitud: 190, anchura: 26, radio: 0, corriente: -0.3, oleaje: 0.4 },
      { tipo: 'curva', longitud: 190, anchura: 22, radio: 57, corriente: 0, oleaje: 0.15 },
      { tipo: 'recta', longitud: 300, anchura: 24, radio: 0, corriente: 0.4, oleaje: 0.1 },
      { tipo: 'oleaje', longitud: 210, anchura: 26, radio: 0, corriente: 0.2, oleaje: 0.35 },
      { tipo: 'curva', longitud: 170, anchura: 20, radio: 57, corriente: 0, oleaje: 0.2 },
    ],
  },
  {
    id: 'canal',
    nombre: 'El Canal',
    procedencia: 'ficticio',
    vueltas: 3,
    oleajeBase: 0,
    hora: 'mediodia',
    descripcion: 'Agua de espejo, paredes cerca y codos de radio 26 encadenados. Aquí no se adelanta: se aprovecha un error.',
    tramos: [
      { tipo: 'recta', longitud: 105, anchura: 16, radio: 0, corriente: 0, oleaje: 0 },
      { tipo: 'curva', longitud: 100, anchura: 14, radio: 26, corriente: 0, oleaje: 0 },
      { tipo: 'estrecho', longitud: 105, anchura: 9, radio: 0, corriente: 0.2, oleaje: 0 },
      { tipo: 'curva', longitud: 90, anchura: 14, radio: -26, corriente: 0, oleaje: 0 },
      { tipo: 'recta', longitud: 105, anchura: 18, radio: 0, corriente: 0, oleaje: 0 },
      { tipo: 'curva', longitud: 95, anchura: 14, radio: 26, corriente: 0, oleaje: 0 },
      { tipo: 'estrecho', longitud: 105, anchura: 9, radio: 0, corriente: -0.2, oleaje: 0 },
      { tipo: 'curva', longitud: 70, anchura: 15, radio: -26, corriente: 0, oleaje: 0 },
      { tipo: 'recta', longitud: 107, anchura: 16, radio: 0, corriente: 0, oleaje: 0 },
      { tipo: 'curva', longitud: 128, anchura: 14, radio: 26, corriente: 0, oleaje: 0 },
    ],
  },
  {
    id: 'tormenta',
    nombre: 'Punta Tormenta',
    procedencia: 'ficticio',
    vueltas: 2,
    oleajeBase: 0.6,
    hora: 'noche',
    descripcion: 'De noche y con mar de fondo. La barca inestable aquí no termina.',
    // 2 curvas de radio 65 y dos rectos de 480 m.
    tramos: [
      { tipo: 'oleaje', longitud: 260, anchura: 30, radio: 0, corriente: -0.5, oleaje: 0.35 },
      { tipo: 'recta', longitud: 220, anchura: 26, radio: 0, corriente: 0.7, oleaje: 0.1 },
      { tipo: 'curva', longitud: 210, anchura: 24, radio: 65, corriente: 0, oleaje: 0.2 },
      { tipo: 'estrecho', longitud: 190, anchura: 11, radio: 0, corriente: 1.2, oleaje: 0 },
      { tipo: 'oleaje', longitud: 290, anchura: 28, radio: 0, corriente: -0.3, oleaje: 0.4 },
      { tipo: 'curva', longitud: 200, anchura: 22, radio: 65, corriente: 0, oleaje: 0.25 },
    ],
  },
];

export function circuitoPorId(id: string): Circuito | undefined {
  return CIRCUITOS.find((c) => c.id === id);
}
