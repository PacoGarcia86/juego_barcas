// [H-2xx] Los ocho objetos: qué pesan en la ruleta y qué hacen.
//
// PURO [H-209]: recibe estado y devuelve estado. Sin reloj, sin azar, sin
// navegador. El azar de la ruleta vive en `huevos.ts`, que sí recibe `Rng`.
//
// [H-210] **Cota de terminación.** Todo objeto en vuelo lleva `restante` en
// segundos, y todo efecto lleva su duración. Las dos SOLO decrecen: no hay
// ningún «mientras siga habiendo alguien cerca». Un remolino se quedó girando
// a una barca 41 s porque el efecto se renovaba solo (`DH4`), y la lección es
// que el bucle se elimina, no se le pone un contador.

import type { Efecto, EstadoRegata, Nave, ObjetoEnVuelo, TipoObjeto } from './tipos.ts';

/** [H-211] Ningún objeto deja a una barca por debajo de esto, m/s. */
export const VELOCIDAD_MINIMA = 0.8;

/** Metros de separación lateral por carril. Coincide con `circuito.ts`. */
const ANCHO_DE_CARRIL = 4.5;

export interface FichaObjeto {
  tipo: TipoObjeto;
  nombre: string;
  icono: string;
  /** Lo que se le dice al patrón. Sin newtons [H-302]. */
  descripcion: string;
}

export const OBJETOS: FichaObjeto[] = [
  { tipo: 'turbo', nombre: 'Racha', icono: '💨', descripcion: 'Tres segundos de empuje de sobra, y sin cansar a nadie.' },
  { tipo: 'ancla', nombre: 'Ancla', icono: '⚓', descripcion: 'Se suelta donde estás. El que la pisa se para en seco.' },
  { tipo: 'ola', nombre: 'Ola', icono: '🌊', descripcion: 'Sale rodando hacia delante. Se deshace a los 220 m.' },
  { tipo: 'kraken', nombre: 'Kraken', icono: '🦑', descripcion: 'Va a por el primero, esté donde esté. Solo a por él.' },
  { tipo: 'remolino', nombre: 'Remolino', icono: '🌀', descripcion: 'Marea a todo el que tengas a veinte metros, delante o detrás.' },
  { tipo: 'niebla', nombre: 'Niebla', icono: '🌫️', descripcion: 'Ciega a los que van por delante. No verán ni la boya.' },
  { tipo: 'burbuja', nombre: 'Burbuja', icono: '🫧', descripcion: 'Seis segundos a prueba de todo. Aguanta un golpe y se va.' },
  { tipo: 'tresOlas', nombre: 'Tres olas', icono: '🌊', descripcion: 'Tres seguidas. Alguna entra.' },
];

export function fichaDe(tipo: TipoObjeto): FichaObjeto {
  const f = OBJETOS.find((o) => o.tipo === tipo);
  if (f === undefined) throw new Error(`objeto desconocido: ${tipo}`);
  return f;
}

/**
 * [H-104] Peso de cada objeto según la plaza, como función de `t`: 0 = vas
 * primero, 1 = vas último.
 *
 * El `kraken` y la `niebla` son del que va atrás; el `ancla` y la `ola`, del
 * que va delante. Con ruleta uniforme, el líder sacaba `kraken` —que va contra
 * el líder, o sea contra sí mismo— en el 12,4 % de las tiradas (`DH1`).
 */
export function pesoDe(tipo: TipoObjeto, t: number): number {
  const x = Math.min(1, Math.max(0, t));
  switch (tipo) {
    case 'turbo':
      return 0.9 + 1.4 * x;
    case 'ancla':
      return 2.2 - 1.4 * x;
    case 'ola':
      return 2.0 - 0.9 * x;
    case 'kraken':
      return 0.02 + 2.6 * Math.pow(x, 2.2);
    case 'remolino':
      return 0.6 + 0.9 * x;
    case 'niebla':
      return 0.25 + 1.8 * x;
    case 'burbuja':
      return 1.3 - 0.3 * x;
    case 'tresOlas':
      return 0.15 + 1.1 * x;
  }
}

/** Los ocho tipos, en el orden en el que se pesan. */
export const TIPOS: TipoObjeto[] = OBJETOS.map((o) => o.tipo);

/** [H-104] Pesos de una plaza. `plaza` es 1..`total`. */
export function pesosDePlaza(plaza: number, total: number): number[] {
  const t = total <= 1 ? 0 : (plaza - 1) / (total - 1);
  return TIPOS.map((tipo) => pesoDe(tipo, t));
}

// ---------------------------------------------------------------------------
// Lanzar
// ---------------------------------------------------------------------------

/** Lo que produce usar un objeto: cosas en el agua y efectos inmediatos. */
export interface Lanzamiento {
  objetos: ObjetoEnVuelo[];
  /** Efectos que se aplican ya, sin pasar por el agua. */
  efectos: { indice: number; efecto: Efecto }[];
  /** Golpes instantáneos de velocidad: `factor` multiplica la velocidad. */
  golpes: { indice: number; factor: number }[];
}

/** Velocidad de un proyectil `ola`, m/s. */
const V_OLA = 9;
/** [H-203] Alcance máximo de la ola, m. Sin él, un proyectil siguió 1 400 m (`DH3`). */
export const ALCANCE_OLA = 220;

/**
 * [H-209] Usar un objeto. PURO: no muta `est`, no tira dados, no mira el reloj.
 * El `id` de los objetos creados lo pone quien llama, desde `est.proximoObjeto`.
 */
export function usarObjeto(tipo: TipoObjeto, quien: number, est: EstadoRegata): Lanzamiento {
  const nave = est.naves[quien];
  if (nave === undefined) return { objetos: [], efectos: [], golpes: [] };
  const base = { duenyo: quien, metros: nave.metros, carril: nave.carril };

  switch (tipo) {
    case 'turbo':
      // [H-201] Empuje de sobra y sin gastar energía: lo aplica `carrera.ts`,
      // que salta el desgaste mientras hay un efecto `turbo`.
      return { objetos: [], efectos: [{ indice: quien, efecto: { tipo: 'turbo', restante: 3, factor: 1.65 } }], golpes: [] };

    case 'burbuja':
      return { objetos: [], efectos: [{ indice: quien, efecto: { tipo: 'burbuja', restante: 6, factor: 1 } }], golpes: [] };

    case 'ancla':
      // [H-202] Se queda donde se suelta, 25 s. `alcance` infinito porque un
      // ancla no recorre nada: lo que la retira es el reloj, no la distancia.
      // Con `alcance: 0` la barría el filtro de `avanzarObjetos` en el primer
      // tick y el ancla no llegaba a existir.
      return { objetos: [{ id: 0, tipo: 'ancla', ...base, restante: 25, alcance: Infinity }], efectos: [], golpes: [] };

    case 'ola':
      return { objetos: [{ id: 0, tipo: 'ola', ...base, restante: ALCANCE_OLA / V_OLA, alcance: ALCANCE_OLA }], efectos: [], golpes: [] };

    case 'tresOlas':
      // [H-208] Tres exactamente. La separación de 0,4 s se traduce en 3,6 m de
      // hueco en el agua: el motor no tiene cola de disparos, y una cola sería
      // otro sitio donde algo puede quedarse vivo (`H-210`).
      return {
        objetos: [0, 1, 2].map((i) => ({
          id: 0,
          tipo: 'ola' as TipoObjeto,
          duenyo: quien,
          metros: nave.metros + i * 3.6,
          carril: nave.carril,
          restante: ALCANCE_OLA / V_OLA,
          alcance: ALCANCE_OLA,
        })),
        efectos: [],
        golpes: [],
      };

    case 'kraken': {
      // [H-204] Va a por el primero. Si el primero es quien lo tira, no pasa
      // nada: no se puede uno krakenear a sí mismo.
      const lider = liderDe(est);
      if (lider === null || lider === quien) return { objetos: [], efectos: [], golpes: [] };
      return {
        objetos: [{ id: 0, tipo: 'kraken', duenyo: quien, metros: nave.metros, carril: nave.carril, restante: 20, alcance: Infinity }],
        efectos: [],
        golpes: [],
      };
    }

    case 'remolino': {
      // [H-205] Duración FIJA de 2 s, y se resuelve aquí: no queda nada en el
      // agua que pueda renovarse solo.
      const efectos: { indice: number; efecto: Efecto }[] = [];
      const golpes: { indice: number; factor: number }[] = [];
      for (const otra of est.naves) {
        if (otra.indice === quien || otra.tiempoMeta !== null) continue;
        if (Math.abs(otra.metros - nave.metros) > 22) continue;
        if (tieneBurbuja(otra)) continue;
        efectos.push({ indice: otra.indice, efecto: { tipo: 'giro', restante: 2, factor: 1 } });
        golpes.push({ indice: otra.indice, factor: 0.75 });
      }
      return { objetos: [], efectos, golpes };
    }

    case 'niebla': {
      // [H-206] Ciega a los de delante. No quita velocidad: quita criterio.
      const efectos: { indice: number; efecto: Efecto }[] = [];
      for (const otra of est.naves) {
        if (otra.indice === quien || otra.tiempoMeta !== null) continue;
        if (otra.metros <= nave.metros) continue;
        if (tieneBurbuja(otra)) continue;
        efectos.push({ indice: otra.indice, efecto: { tipo: 'ciego', restante: 3.5, factor: 1 } });
      }
      return { objetos: [], efectos, golpes: [] };
    }
  }
}

/** Índice de quien va primero entre las que siguen navegando. `null` si no queda nadie. */
export function liderDe(est: EstadoRegata): number | null {
  let mejor: Nave | null = null;
  for (const n of est.naves) {
    if (n.tiempoMeta !== null) continue;
    if (mejor === null || n.metros > mejor.metros) mejor = n;
  }
  return mejor === null ? null : mejor.indice;
}

export function tieneBurbuja(nave: Nave): boolean {
  return nave.efectos.some((e) => e.tipo === 'burbuja');
}

// ---------------------------------------------------------------------------
// Avanzar lo que hay en el agua
// ---------------------------------------------------------------------------

/** Lo que un impacto le hace a quien lo recibe. */
interface Impacto {
  /** Multiplica la velocidad en el acto. */
  factor: number;
  efectos: Efecto[];
}

/** [H-2xx] Tabla de impactos. Todas las duraciones son fijas. */
function impactoDe(tipo: TipoObjeto): Impacto {
  switch (tipo) {
    case 'ancla':
      return { factor: 0.55, efectos: [{ tipo: 'giro', restante: 1.5, factor: 1 }, { tipo: 'frenado', restante: 1.5, factor: 0.75 }] };
    case 'kraken':
      return { factor: 0.5, efectos: [{ tipo: 'frenado', restante: 4, factor: 0.4 }] };
    default:
      // `ola` y lo que llegue por el agua.
      return { factor: 0.6, efectos: [{ tipo: 'giro', restante: 1, factor: 1 }] };
  }
}

/** Resultado de un tick de objetos. `est` no se muta. */
export interface PasoObjetos {
  objetos: ObjetoEnVuelo[];
  /** Por índice de nave: factor de velocidad y efectos a añadir. */
  impactos: Map<number, Impacto>;
  /** Índices que han gastado su burbuja parando un golpe. */
  burbujasGastadas: number[];
}

/**
 * [H-209] [H-210] Un tick de los objetos que hay en el agua.
 *
 * Cada objeto decrece su `restante` y su `alcance`, y se borra en cuanto
 * cualquiera de los dos llega a cero. Nada los renueva.
 */
export function avanzarObjetos(est: EstadoRegata, dt: number): PasoObjetos {
  const vivos: ObjetoEnVuelo[] = [];
  const impactos = new Map<number, Impacto>();
  const burbujasGastadas: number[] = [];
  const lider = liderDe(est);

  for (const objeto of est.objetos) {
    let { metros, restante, alcance } = objeto;
    restante -= dt;

    if (objeto.tipo === 'ola') {
      const paso = V_OLA * dt;
      metros += paso;
      alcance -= paso;
    } else if (objeto.tipo === 'kraken' && lider !== null) {
      // [H-204] Persigue al primero a 22 m/s. Si lo alcanza, se resuelve.
      const objetivo = est.naves[lider]!;
      const delta = objetivo.metros - metros;
      const paso = Math.sign(delta) * Math.min(Math.abs(delta), 22 * dt);
      metros += paso;
    }

    if (restante <= 0 || alcance <= 0) continue;

    // ¿Golpea a alguien?
    let golpeado = false;
    for (const nave of est.naves) {
      if (nave.tiempoMeta !== null) continue;
      if (objeto.tipo === 'kraken') {
        if (nave.indice !== lider) continue;
        if (Math.abs(nave.metros - metros) > 6) continue;
      } else {
        // [H-202] El ancla no se come a quien la suelta.
        if (nave.indice === objeto.duenyo) continue;
        if (Math.abs(nave.metros - metros) > 3) continue;
        if (Math.abs(nave.carril - objeto.carril) * ANCHO_DE_CARRIL > 2.6) continue;
      }
      golpeado = true;
      if (tieneBurbuja(nave)) {
        // [H-207] La burbuja para el primer golpe y se consume.
        burbujasGastadas.push(nave.indice);
      } else {
        impactos.set(nave.indice, impactoDe(objeto.tipo));
      }
      break;
    }
    if (golpeado) continue;

    vivos.push({ ...objeto, metros, restante, alcance });
  }

  return { objetos: vivos, impactos, burbujasGastadas };
}

/** Efectos tras `dt` segundos. Los agotados desaparecen [H-210]. */
export function envejecerEfectos(efectos: readonly Efecto[], dt: number): Efecto[] {
  const vivos: Efecto[] = [];
  for (const e of efectos) {
    const restante = e.restante - dt;
    if (restante > 0) vivos.push({ ...e, restante });
  }
  return vivos;
}

/** Factor que los efectos activos aplican al empuje disponible. */
export function factorDeEfectos(efectos: readonly Efecto[]): number {
  let factor = 1;
  for (const e of efectos) {
    if (e.tipo === 'turbo' || e.tipo === 'frenado') factor *= e.factor;
  }
  return factor;
}

export function tieneEfecto(efectos: readonly Efecto[], tipo: Efecto['tipo']): boolean {
  return efectos.some((e) => e.tipo === tipo);
}
