// [A-201] Los cinco oficios. Dato declarativo.
//
// [A-202] **Todos pesan, y el peso entra en la física** (`B-206`): un remero
// suma 320 N de empuje y 82 kg de desplazamiento, y el desplazamiento está en
// las dos resistencias. Cuando los tripulantes no pesaban y el efecto era un
// multiplicador suelto, «cinco remeros» ganó 20 de 20 regatas del arnés y no
// había nada que decidir (`DA3`).

import type { Oficio, Tripulante } from '../tipos.ts';

export const TRIPULANTES: Tripulante[] = [
  {
    oficio: 'remero',
    nombre: 'Remero',
    peso: 82,
    empuje: 240,
    maniobra: 0,
    estabilidad: 0,
    crucero: 0.02,
    reparacion: 0,
    precio: 450,
    descripcion: '+240 N de empuje y 82 kg de desplazamiento. Los kilos también reman: en contra.',
  },
  {
    oficio: 'timonel',
    nombre: 'Timonel',
    peso: 78,
    empuje: 40,
    maniobra: 12,
    estabilidad: 3,
    crucero: 0,
    reparacion: 0,
    precio: 520,
    descripcion: '+12 de maniobra. En un circuito de curvas vale más que un remero.',
  },
  {
    oficio: 'vigia',
    nombre: 'Vigía',
    peso: 74,
    empuje: 0,
    maniobra: 2,
    estabilidad: 0,
    crucero: 0,
    reparacion: 0,
    precio: 700,
    descripcion: 'Ve venir el huevo bueno: mejora la ruleta y te deja guardar un segundo objeto.',
  },
  {
    oficio: 'mecanico',
    nombre: 'Mecánico',
    peso: 86,
    empuje: 60,
    maniobra: 0,
    estabilidad: 4,
    crucero: 0,
    reparacion: 0.8,
    precio: 640,
    descripcion: 'Recorta 0,8 s a todo lo que te echen encima. El más pesado de los cinco.',
  },
  {
    oficio: 'contramaestre',
    nombre: 'Contramaestre',
    peso: 80,
    empuje: 120,
    maniobra: 4,
    estabilidad: 2,
    crucero: 0.16,
    reparacion: 0,
    precio: 760,
    descripcion: '+16 % de empuje de crucero: marca el ritmo y la tripulación aguanta la regata entera.',
  },
];

export function tripulantePorOficio(oficio: Oficio): Tripulante {
  const t = TRIPULANTES.find((x) => x.oficio === oficio);
  if (t === undefined) throw new Error(`oficio desconocido: ${oficio}`);
  return t;
}
