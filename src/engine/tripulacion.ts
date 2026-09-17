// [A-2xx] La tripulación: oficios, peso y plazas.
//
// Puro. No sabe nada de física: produce números que `barcas.ts` mete en una
// `BarcaEfectiva`, que es lo único que `fisica.ts` llega a ver [A-204].

import type { Barca, Oficio } from './tipos.ts';
import { tripulantePorOficio } from './datos/tripulantes.ts';

/** Lo que aporta una tripulación entera, ya sumado. */
export interface AporteTripulacion {
  peso: number;
  empuje: number;
  maniobra: number;
  estabilidad: number;
  /** Fracción añadida al empuje de crucero. */
  crucero: number;
  reparacion: number;
  /** [A-205] */
  vigia: boolean;
}

/** [A-202] Suma de lo que aporta cada tripulante. El peso también se suma. */
export function aporteDe(tripulacion: readonly Oficio[]): AporteTripulacion {
  const total: AporteTripulacion = {
    peso: 0,
    empuje: 0,
    maniobra: 0,
    estabilidad: 0,
    crucero: 0,
    reparacion: 0,
    vigia: false,
  };
  for (const oficio of tripulacion) {
    const t = tripulantePorOficio(oficio);
    total.peso += t.peso;
    total.empuje += t.empuje;
    total.maniobra += t.maniobra;
    total.estabilidad += t.estabilidad;
    total.crucero += t.crucero;
    total.reparacion += t.reparacion;
    if (oficio === 'vigia') total.vigia = true;
  }
  return total;
}

/** [A-203] Cuántos caben todavía. */
export function plazasLibres(barca: Barca, embarcados: readonly Oficio[]): number {
  return Math.max(0, barca.plazas - embarcados.length);
}

/**
 * [A-203] Embarcar. Devuelve la lista sin tocar y un motivo si no cabe: las
 * plazas de la barca limitan, y comprar un tripulante no lo sube a bordo.
 */
export function embarcar(
  barca: Barca,
  embarcados: readonly Oficio[],
  oficio: Oficio,
): { embarcados: Oficio[]; motivo: string | null } {
  if (plazasLibres(barca, embarcados) <= 0) {
    return { embarcados: embarcados.slice(), motivo: 'plazas' };
  }
  return { embarcados: [...embarcados, oficio], motivo: null };
}

/** Desembarcar el primero de ese oficio. Si no hay, no pasa nada. */
export function desembarcar(embarcados: readonly Oficio[], oficio: Oficio): Oficio[] {
  const i = embarcados.indexOf(oficio);
  if (i < 0) return embarcados.slice();
  return [...embarcados.slice(0, i), ...embarcados.slice(i + 1)];
}
