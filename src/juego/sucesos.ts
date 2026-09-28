// [V-304] Lo que el motor no avisa y la pantalla sí quiere anunciar: vuelta
// nueva, última vuelta, objeto que sale de un huevo y la meta. PURO: dos
// estados entran, una lista sale.
//
// Los adelantamientos, golpes, turbos y la salida ya los dice el motor en
// `est.avisos` (`K-303`): no se vuelven a deducir aquí, para que no haya dos
// sitios que decidan qué es «te han pasado».

import { clasificar } from '../engine/clasificacion.ts';
import type { Aviso, EstadoRegata, TipoObjeto } from '../engine/tipos.ts';
import type { NombreSonido } from '../sonido/sintetizador.ts';

export type Suceso =
  | { tipo: 'vuelta'; vuelta: number }
  | { tipo: 'ultimaVuelta' }
  | { tipo: 'objeto'; objeto: TipoObjeto }
  | { tipo: 'meta'; plaza: number };

/** [V-304] Sucesos entre dos estados, para el jugador de índice `jugador`. */
export function sucesosEntre(antes: EstadoRegata, despues: EstadoRegata, jugador: number): Suceso[] {
  const a = antes.naves[jugador];
  const d = despues.naves[jugador];
  if (a === undefined || d === undefined || antes === despues) return [];
  if (d.tiempoMeta !== null && a.tiempoMeta === null) {
    return [{ tipo: 'meta', plaza: clasificar(despues).indexOf(jugador) + 1 }];
  }
  const sucesos: Suceso[] = [];
  const vueltas = despues.circuito.vueltas;
  if (d.vuelta > a.vuelta && d.vuelta < vueltas) {
    sucesos.push(d.vuelta === vueltas - 1 ? { tipo: 'ultimaVuelta' } : { tipo: 'vuelta', vuelta: d.vuelta + 1 });
  }
  // Un objeto nuevo en la mano (o en la reserva del vigía) solo sale de un huevo.
  if (d.huevosRotos > a.huevosRotos) {
    const sale = d.objeto !== a.objeto && d.objeto !== null ? d.objeto : d.guardado !== a.guardado ? d.guardado : null;
    if (sale !== null) sucesos.push({ tipo: 'objeto', objeto: sale });
  }
  return sucesos;
}

/** [V-402] El sonido de cada suceso. `Record` exhaustivo: uno nuevo sin sonido no compila. */
export const SONIDO_DE_SUCESO: Record<Suceso['tipo'], NombreSonido> = {
  vuelta: 'vuelta',
  ultimaVuelta: 'ultimaVuelta',
  objeto: 'objeto',
  meta: 'meta',
};

/** [V-402] El sonido de cada aviso del motor (`K-303`). */
export function sonidoDeAviso(aviso: Aviso): NombreSonido {
  switch (aviso.tipo) {
    case 'teAdelantan':
      return 'tePasan';
    case 'adelantas':
      return 'adelantas';
    case 'huevo':
      return 'huevo';
    case 'usas':
      return 'lanzas';
    case 'golpe':
      return 'golpe';
    case 'ahogo':
      return 'calada';
    case 'turbo':
      return aviso.origen === 'salida' ? 'perfecta' : aviso.origen === 'cenir' ? 'cenida' : 'racha';
  }
}
