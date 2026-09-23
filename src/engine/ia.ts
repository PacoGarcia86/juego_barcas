// [B-5xx] La táctica de las siete rivales.
//
// El defecto que más caro costó de toda la auditoría estaba aquí: las rivales
// empujaban al máximo siempre, reventaban de energía en la vuelta 1 y se
// descolgaban. El jugador terminaba con **0,0 adelantamientos sufridos de
// media** sobre veinte regatas, o sea que la promesa del juego —que no te
// adelanten— no se cumplía ni una vez (`DB5`). Una IA que no ataca no es una
// IA fácil: es un juego que no existe.
//
// Sin E/S, sin reloj: recibe estado y devuelve una decisión [B-903].

import type { EstadoRegata, Mando, Nave, Personalidad } from './tipos.ts';
import type { Rng } from './rng.ts';
import { barajar } from './rng.ts';
import { carrilesDisponiblesEn, haciaDentro, puntoDe, radioEfectivo } from './circuito.ts';
import { velocidadDeViraje } from './fisica.ts';
import { liderDe, tieneEfecto } from './objetos.ts';
import { RITMO } from './ritmo.ts';

const PERSONALIDADES: Personalidad[] = ['lanzada', 'rueda', 'sucia', 'regular'];

/**
 * [B-501] Reparte personalidades entre las rivales. Las cuatro salen siempre
 * al menos una vez mientras haya cuatro o más rivales: una parrilla de siete
 * `regular` es una parrilla sin regata.
 */
export function repartirPersonalidades(cuantas: number, rng: Rng): Personalidad[] {
  const salida: Personalidad[] = [];
  for (let i = 0; i < cuantas; i++) salida.push(PERSONALIDADES[i % PERSONALIDADES.length]!);
  return barajar(rng, salida);
}

/**
 * [B-504] Goma elástica ACOTADA y declarada: +6 % como mucho por detrás, −4 %
 * como mucho por delante, **y apagada en la última vuelta**.
 *
 * El borrador la escribió con ±10 % y los adelantamientos al jugador subieron
 * a 11–16 por regata: la última vuelta era una remontada garantizada y daba
 * igual cómo pilotaras. El apagado de la última vuelta no estaba en el
 * borrador; es lo que devolvió la cifra a su rango.
 */
export function factorGoma(diferenciaAlLider: number, ultimaVuelta: boolean): number {
  if (ultimaVuelta) return 1;
  if (diferenciaAlLider < -120) return 1.06;
  if (diferenciaAlLider > 120) return 0.96;
  if (diferenciaAlLider < 0) return 1 + 0.06 * (-diferenciaAlLider / 120);
  return 1 - 0.04 * (diferenciaAlLider / 120);
}

/** [K-202] Cómo sale una barca al acabar la cuenta atrás. */
export type Salida = 'turbo' | 'ahogo' | 'nada';

/**
 * [K-204] Proporción de salidas clavadas por personalidad. De las que no la
 * clavan, la mitad se ahoga y la otra mitad sale sin más.
 */
export const CLAVA_LA_SALIDA: Record<Personalidad, number> = {
  lanzada: 0.8,
  sucia: 0.6,
  rueda: 0.45,
  regular: 0.35,
};

/** [K-204] La salida de una rival, sorteada con el `rng` de la regata [B-901]. */
export function salidaDeRival(p: Personalidad, rng: Rng): Salida {
  if (rng.siguiente() < CLAVA_LA_SALIDA[p]) return 'turbo';
  return rng.siguiente() < 0.5 ? 'ahogo' : 'nada';
}

/**
 * [K-204] ¿Ciñe esta rival? La `lanzada` y la `sucia`, siempre; la `rueda`,
 * solo cuando saca todo al final; la `regular`, nunca.
 */
function cine(p: Personalidad, ultimaVuelta: boolean): boolean {
  return p === 'lanzada' || p === 'sucia' || (p === 'rueda' && ultimaVuelta);
}

/** [K-204] Segundos reales de curva que le quedan cuando una rival empieza a ceñir. */
const CENIR_DESDE = 2;

/** Gas de crucero de cada personalidad, en fracción del empuje disponible. */
function gasBase(p: Personalidad, energia: number, ultimaVuelta: boolean): number {
  switch (p) {
    case 'lanzada':
      // Empuja siempre. Revienta, y con la caída al 55 % de `B-208` sigue en
      // la regata en vez de perderse por el horizonte.
      return 1;
    case 'rueda':
      // Ahorra a rueda y saca todo al final.
      return ultimaVuelta ? 1 : 0.74;
    case 'sucia':
      return 0.9;
    case 'regular':
      // Gestiona: aprieta si le sobra energía, levanta si le falta.
      return energia > 60 ? 0.9 : energia > 30 ? 0.78 : 0.68;
  }
}

/** Distancia longitudinal con signo: positivo = la otra va por delante. */
function delta(a: Nave, b: Nave): number {
  return b.metros - a.metros;
}

/** ¿Hay sitio en ese carril para meterse? [B-304] */
export function carrilLibre(est: EstadoRegata, quien: Nave, carril: number): boolean {
  const carriles = carrilesDisponiblesEn(est.circuito, quien.metros);
  if (carril < 0 || carril >= carriles) return false;
  for (const otra of est.naves) {
    if (otra.indice === quien.indice || otra.tiempoMeta !== null) continue;
    if (otra.carril !== carril && otra.carrilDestino !== carril) continue;
    if (Math.abs(delta(quien, otra)) < 6) return false;
  }
  return true;
}

/**
 * [B-5xx] Una decisión de una rival. El jugador no pasa por aquí: su `Mando` lo
 * pone la capa de arriba.
 */
export function decidir(nave: Nave, est: EstadoRegata, ultimaVuelta: boolean): Mando {
  const lider = liderDe(est);
  const metrosLider = lider === null ? nave.metros : est.naves[lider]!.metros;
  const goma = factorGoma(nave.metros - metrosLider, ultimaVuelta);

  let gas = gasBase(nave.personalidad, nave.energia, ultimaVuelta) * goma;
  let timon = 0;

  // ------------------------------------------------------------------
  // [B-503] Atacar al jugador. Es lo que hace que el juego exista.
  // ------------------------------------------------------------------
  const jugador = est.naves.find((n) => n.jugador);
  const cegada = tieneEfecto(nave.efectos, 'ciego');
  if (jugador !== undefined && jugador.tiempoMeta === null && nave.tiempoMeta === null) {
    const d = delta(nave, jugador);
    if (d > 0 && d < 12 && nave.energia > 35) {
      gas = Math.max(gas, 1);
      // Sacar el morro por el carril libre. A la rival `sucia` le da igual
      // meterse por dentro de la boya.
      if (!cegada) {
        const preferido = nave.personalidad === 'sucia' ? -1 : 1;
        if (carrilLibre(est, nave, nave.carril + preferido)) timon = preferido;
        else if (carrilLibre(est, nave, nave.carril - preferido)) timon = -preferido;
      }
    }
  }

  // ------------------------------------------------------------------
  // [B-506] Salir de detrás de quien te tapa.
  //
  // Va ANTES que buscar la estela, y no es un detalle de orden: la regla de la
  // estela mira si hay alguien delante en el mismo carril y, si lo hay, se da
  // por satisfecha —«ya voy a rueda»— y no toca el timón. Con eso, en los dos
  // circuitos anchos las ocho barcas se ponían en fila india y llegaban a meta
  // en cuatro segundos y medio, todas a la misma velocidad y cinco de ellas sin
  // romper un solo huevo (`DB7`). Ir a rueda está bien hasta que el de delante
  // es más lento que tú.
  // ------------------------------------------------------------------
  if (timon === 0 && !cegada && nave.tiempoMeta === null) {
    const tapando = est.naves.find(
      (otra) =>
        otra.indice !== nave.indice &&
        otra.tiempoMeta === null &&
        otra.carril === nave.carril &&
        delta(nave, otra) > 0 &&
        delta(nave, otra) < 7,
    );
    if (tapando !== undefined) {
      for (const paso of [1, -1]) {
        if (carrilLibre(est, nave, nave.carril + paso)) {
          timon = paso;
          break;
        }
      }
    }
  }

  // ------------------------------------------------------------------
  // [B-502] Buscar la estela. Una rival cegada por la niebla pierde esta
  // referencia y sigue recto: eso es lo que hace la niebla [H-206].
  // ------------------------------------------------------------------
  if (timon === 0 && !cegada) {
    let mejor: Nave | null = null;
    for (const otra of est.naves) {
      if (otra.indice === nave.indice || otra.tiempoMeta !== null) continue;
      const d = delta(nave, otra);
      if (d < 6 || d > 20) continue;
      if (otra.carril === nave.carril) {
        mejor = null;
        break; // ya va en su estela
      }
      if (mejor === null || d < delta(nave, mejor)) mejor = otra;
    }
    if (mejor !== null) {
      const paso = Math.sign(mejor.carril - nave.carril);
      if (paso !== 0 && carrilLibre(est, nave, nave.carril + paso)) timon = paso;
    }
  }

  // ------------------------------------------------------------------
  // [K-204] Ceñir la boya al final de la curva, si va por dentro. Cargar
  // desde la entrada costaría toda la curva al límite de viraje rebajado; al
  // final, el miniturbo sale justo a la recta.
  //
  // Y SOLO por detrás del jugador: el miniturbo es para cazarle, no para
  // escaparse. Ciñendo también por delante, las que ciñen se iban, el grupo se
  // estiraba y los adelantamientos por minuto caían de 1,58 a 1,09 (SPEC-006).
  // ------------------------------------------------------------------
  const detras = jugador !== undefined && jugador.metros > nave.metros;
  if (timon === 0 && nave.tiempoMeta === null && detras && cine(nave.personalidad, ultimaVuelta)) {
    const aqui = puntoDe(est.circuito, nave.metros);
    const dentro = haciaDentro(aqui.tramo, carrilesDisponiblesEn(est.circuito, nave.metros));
    if (dentro !== null && nave.carril === dentro.carril && nave.cambiando === 0) {
      const quedan = ((1 - aqui.fraccion) * aqui.tramo.longitud) / Math.max(0.5, nave.velocidad);
      if (quedan <= CENIR_DESDE * RITMO) timon = dentro.sentido;
    }
  }

  // ------------------------------------------------------------------
  // Levantar el pie antes de la boya. Una rival que entra pasada en la curva
  // derrapa y pierde más de lo que ganó en la recta [B-209].
  // ------------------------------------------------------------------
  const punto = puntoDe(est.circuito, nave.metros + nave.velocidad * 1.5);
  if (punto.tramo.tipo === 'curva') {
    const vMax = velocidadDeViraje(radioEfectivo(punto.tramo, nave.carril), nave.barca.maniobra, nave.barca.eslora);
    if (nave.velocidad > vMax * 1.02) gas = Math.min(gas, 0.35);
  }

  // ------------------------------------------------------------------
  // [B-505] Los objetos. Salen de un huevo roto como los del jugador: aquí no
  // se inventa ninguno.
  // ------------------------------------------------------------------
  const usar = nave.objeto !== null && quiereUsar(nave, est, ultimaVuelta);

  return { gas: Math.max(0, Math.min(1, gas)), timon, usar };
}

/** Cuándo suelta una rival lo que lleva. */
function quiereUsar(nave: Nave, est: EstadoRegata, ultimaVuelta: boolean): boolean {
  if (nave.personalidad === 'sucia') return true; // en cuanto lo tiene
  switch (nave.objeto) {
    case 'turbo':
      // Merece la pena en recta, no entrando en una curva.
      return puntoDe(est.circuito, nave.metros + 40).tramo.tipo !== 'curva';
    case 'burbuja':
      // Solo si hay algo cerca de lo que protegerse.
      return est.objetos.some((o) => Math.abs(o.metros - nave.metros) < 60);
    case 'kraken':
      return ultimaVuelta || est.naves.some((n) => n.metros > nave.metros + 60);
    case 'ancla':
      return est.naves.some((n) => n.tiempoMeta === null && n.metros < nave.metros && nave.metros - n.metros < 30);
    case 'niebla':
      return est.naves.some((n) => n.tiempoMeta === null && n.metros > nave.metros);
    default:
      // `ola`, `tresOlas`, `remolino`: cuando hay alguien al alcance.
      return est.naves.some((n) => n.indice !== nave.indice && n.tiempoMeta === null && Math.abs(n.metros - nave.metros) < 60);
  }
}
