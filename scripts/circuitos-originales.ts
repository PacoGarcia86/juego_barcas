// [K-001] Los cuatro circuitos TAL COMO ERAN antes del recorte de `K-102`.
//
// No los usa el juego: solo `npm run diversion -- --original`, para que la
// medición de SPEC-006 §3 (12,4 min por regata, 47 s sin que pase nada) se
// pueda repetir siempre y la comparación antes/después no dependa de la
// memoria de nadie. No se editan.

import type { Circuito } from '../src/engine/tipos.ts';

export const CIRCUITOS_ORIGINALES: Circuito[] = [
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
