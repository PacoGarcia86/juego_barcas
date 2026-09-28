// [K-404] Lo que ha pasado entre dos estados de la regata, visto desde el
// jugador. PURO: dos estados entran, una lista de sucesos sale. Los avisos de
// pantalla y los sonidos (`K-502`) cuelgan de aquí, y así no hay dos sitios
// que decidan por su cuenta qué es «te han pasado».

import { CENIDA_NIVEL_1, CENIDA_NIVEL_2 } from '../engine/carrera.ts';
import { clasificar } from '../engine/clasificacion.ts';
import type { EstadoRegata, TipoEfecto, TipoObjeto } from '../engine/tipos.ts';
import type { NombreSonido } from '../sonido/sintetizador.ts';

export type Suceso =
  | { tipo: 'vuelta'; vuelta: number }
  | { tipo: 'ultimaVuelta' }
  | { tipo: 'tePasan' }
  | { tipo: 'adelantas'; plaza: number }
  | { tipo: 'golpe'; efecto: TipoEfecto }
  | { tipo: 'aciertas' }
  | { tipo: 'objeto'; objeto: TipoObjeto }
  | { tipo: 'lanzas'; objeto: TipoObjeto }
  | { tipo: 'racha' }
  | { tipo: 'cenida'; nivel: 1 | 2 }
  | { tipo: 'huevo' }
  | { tipo: 'meta'; plaza: number };

export type TipoSuceso = Suceso['tipo'];

/** Los efectos que son un golpe recibido, no algo que uno se da. */
const GOLPES: readonly TipoEfecto[] = ['giro', 'frenado', 'ciego'];

/** ¿Hay en `despues` un efecto de este tipo que no venía de `antes`? */
function nuevo(antes: { tipo: TipoEfecto; restante: number }[], despues: { tipo: TipoEfecto; restante: number }[], tipo: TipoEfecto): boolean {
  const a = antes.filter((e) => e.tipo === tipo);
  const d = despues.filter((e) => e.tipo === tipo);
  if (d.length > a.length) return true;
  // Mismo número, pero uno ha vuelto a empezar: los efectos SOLO decrecen
  // (`H-210`), así que un `restante` mayor es un efecto nuevo.
  const maxA = Math.max(0, ...a.map((e) => e.restante));
  const maxD = Math.max(0, ...d.map((e) => e.restante));
  return d.length > 0 && maxD > maxA + 1e-6;
}

/** [K-404] Sucesos entre dos estados, para el jugador de índice `jugador`. */
export function sucesosEntre(antes: EstadoRegata, despues: EstadoRegata, jugador: number): Suceso[] {
  const a = antes.naves[jugador];
  const d = despues.naves[jugador];
  if (a === undefined || d === undefined || antes === despues) return [];
  const sucesos: Suceso[] = [];
  const vueltas = despues.circuito.vueltas;

  if (d.tiempoMeta !== null && a.tiempoMeta === null) {
    sucesos.push({ tipo: 'meta', plaza: clasificar(despues).indexOf(jugador) + 1 });
    return sucesos;
  }
  if (d.vuelta > a.vuelta && d.vuelta < vueltas) {
    sucesos.push(d.vuelta === vueltas - 1 ? { tipo: 'ultimaVuelta' } : { tipo: 'vuelta', vuelta: d.vuelta + 1 });
  }
  if (despues.adelantamientosSufridos > antes.adelantamientosSufridos) sucesos.push({ tipo: 'tePasan' });

  const plazaA = clasificar(antes).indexOf(jugador) + 1;
  const plazaD = clasificar(despues).indexOf(jugador) + 1;
  if (plazaD < plazaA) sucesos.push({ tipo: 'adelantas', plaza: plazaD });

  for (const tipo of GOLPES) {
    if (nuevo(a.efectos, d.efectos, tipo)) {
      sucesos.push({ tipo: 'golpe', efecto: tipo });
      break;
    }
  }
  if (nuevo(a.efectos, d.efectos, 'turbo')) sucesos.push({ tipo: 'racha' });

  if (d.huevosRotos > a.huevosRotos) {
    sucesos.push({ tipo: 'huevo' });
    const sale = d.objeto !== a.objeto && d.objeto !== null ? d.objeto : d.guardado !== a.guardado ? d.guardado : null;
    if (sale !== null) sucesos.push({ tipo: 'objeto', objeto: sale });
  } else if (a.objeto !== null && d.objeto !== a.objeto) {
    // El objeto de la mano solo cambia sin romper huevo si se ha usado.
    sucesos.push({ tipo: 'lanzas', objeto: a.objeto });
  }

  // ¿Le ha dado a alguien algo nuestro? Un objeto propio que desaparece sin
  // agotarse cerca de una rival que acaba de recibir un golpe, o un remolino
  // o una niebla que se acaban de soltar.
  const usado = a.objeto !== null && d.objeto !== a.objeto && d.huevosRotos === a.huevosRotos ? a.objeto : null;
  const golpeadas = despues.naves.filter(
    (n) => n.indice !== jugador && GOLPES.some((t) => nuevo(antes.naves[n.indice]?.efectos ?? [], n.efectos, t)),
  );
  if (golpeadas.length > 0) {
    const vivos = new Set(despues.objetos.map((o) => o.id));
    const perdidos = antes.objetos.filter((o) => o.duenyo === jugador && !vivos.has(o.id) && o.restante > 0.1 && o.alcance > 0.1);
    const cerca = perdidos.some((o) => golpeadas.some((n) => Math.abs(n.metros - o.metros) < 12));
    if (cerca || usado === 'remolino' || usado === 'niebla') sucesos.push({ tipo: 'aciertas' });
  }

  if (a.cenida < CENIDA_NIVEL_1 && d.cenida >= CENIDA_NIVEL_1) sucesos.push({ tipo: 'cenida', nivel: 1 });
  if (a.cenida < CENIDA_NIVEL_2 && d.cenida >= CENIDA_NIVEL_2) sucesos.push({ tipo: 'cenida', nivel: 2 });

  return sucesos;
}

/** [K-502] El sonido de cada suceso. `Record` exhaustivo: un suceso nuevo sin sonido no compila. */
export const SONIDO_DE: Record<TipoSuceso, NombreSonido> = {
  vuelta: 'vuelta',
  ultimaVuelta: 'ultimaVuelta',
  tePasan: 'tePasan',
  adelantas: 'adelantas',
  golpe: 'golpe',
  aciertas: 'aciertas',
  objeto: 'objeto',
  lanzas: 'lanzas',
  racha: 'racha',
  cenida: 'cenida',
  huevo: 'huevo',
  meta: 'meta',
};
