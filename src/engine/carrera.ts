// [B-3xx] Un tick de regata. Es el fichero que orquesta: aquí no se calcula
// física ni se decide táctica, se llama en el orden correcto.
//
// [B-301] **El orden es este y no otro.** Está declarado en `ORDEN_DEL_TICK` y
// hay test que lo comprueba con una traza, porque un orden que solo vive en un
// comentario se rompe en cuanto alguien mete un paso en medio.
//
// [B-903] Sin E/S. El azar entra por el `Rng` que se recibe.

import type {
  Aviso,
  ContextoRegata,
  EstadoRegata,
  Circuito,
  Efecto,
  Huevo,
  Mando,
  Nave,
  ObjetoEnVuelo,
  Resultado,
} from './tipos.ts';
import type { Rng } from './rng.ts';
import {
  carrilesDisponiblesEn,
  corrienteEn,
  factorDeCarril,
  longitudDeVuelta,
  longitudTotal,
  oleajeEn,
  haciaDentro,
  puntoDe,
  radioEfectivo,
} from './circuito.ts';
import {
  aceleracion,
  empujeDisponible,
  energiaTras,
  factorEstela,
  velocidadDeViraje,
  type Entorno,
} from './fisica.ts';
import { carrilLibre, decidir, repartirPersonalidades, salidaDeRival, type Salida } from './ia.ts';
import { envejecerHuevos, huevoPisado, REAPARICION, tirarRuleta } from './huevos.ts';
import {
  avanzarObjetos,
  envejecerEfectos,
  factorDeEfectos,
  tieneEfecto,
  usarObjeto,
  VELOCIDAD_MINIMA,
} from './objetos.ts';
import { clasificar } from './clasificacion.ts';
import { RITMO } from './ritmo.ts';

/** [R-601] Paso fijo del motor, en segundos. El render interpola; el motor no. */
export const PASO = 0.05;

/** [B-301] El orden. Declarado, no comentado. */
export const ORDEN_DEL_TICK = [
  'decision',
  'objetos',
  'fuerzas',
  'carriles',
  'avance',
  'huevos',
  'adelantamientos',
  'meta',
] as const;

/** [B-302] Separación mínima entre dos barcas del mismo carril, m. */
const HUECO_MINIMO = 2.5;
/** [B-303] Lo que dura un cambio de carril, s. */
const DURACION_CAMBIO = 1.2;

// [K-202] [K-203] Todo lo que es un GESTO del jugador —la cuenta atrás, la
// ventana de salida, cuánto hay que ceñir— se declara en segundos REALES y se
// pasa a simulación con `RITMO` (`K-103`). Un medio segundo de reflejo es medio
// segundo de pantalla, vaya la regata al ritmo que vaya.

/** [K-202] Segundos reales de cuenta atrás que pide el juego. */
export const CUENTA_ATRAS = 3;
/** [K-202] Últimos segundos reales en los que pedir gas a tope da turbo. */
export const VENTANA_SALIDA = 0.5;
/** [K-202] Desde aquí, «gas a tope». */
const GAS_A_TOPE = 0.9;
/** [K-203] Segundos reales de ceñida para el miniturbo corto y el largo. */
export const CARGA_CORTA = 0.8;
export const CARGA_LARGA = 1.6;
/** [K-203] Mientras se ciñe, el límite de viraje baja esta fracción. */
const CASTIGO_CENIDA = 0.9;
/**
 * [K-203] Lo que empuja el miniturbo y el turbo de salida: ×6, no el ×1,65 de
 * la racha (`H-201`). Con ×1,65 el muro de la resistencia de ola (`B-202`) se
 * comía el turbo y el piloto experto le sacaba al medio un 0,8–2,3 %; con ×6 y
 * la duración doble de la escrita, un 3,1–8,2 % (SPEC-006, «Lo que la medición
 * cambió»).
 */
const FACTOR_MINITURBO = 6;
/** [B-702] Segundos que una rival tiene que aguantar delante para que cuente. */
export const HISTERESIS_ADELANTAMIENTO = 3;

export interface ContextoConTraza extends ContextoRegata {
  /** Solo para el test de `B-301`: se rellena con los pasos ejecutados. */
  traza?: string[];
}

// ---------------------------------------------------------------------------
// Montar la regata
// ---------------------------------------------------------------------------

/** Lo que hace falta para poner una barca en la parrilla. */
export interface Inscripcion {
  nombre: string;
  barca: Nave['barca'];
  colores: Nave['colores'];
  jugador: boolean;
}

/**
 * [B-401] La parrilla se sortea, pero **el jugador nunca sale primero**: sale
 * entre la 4.ª y la 8.ª plaza.
 *
 * El borrador sorteaba la parrilla entera. Con el jugador saliendo primero una
 * de cada ocho regatas, esas regatas no tenían juego: no había nadie a quien
 * impedir que te adelante, y el contador de `B-702` salía 0 por construcción
 * y no por pilotar bien.
 */
/**
 * [K-202] `cuentaAtras` en segundos REALES. El juego y los arneses la piden;
 * sin ella la regata empieza lanzada, como antes de SPEC-006.
 */
export function crearRegata(
  circuito: Circuito,
  inscritos: Inscripcion[],
  rng: Rng,
  huevos: Huevo[],
  opciones: { cuentaAtras?: number } = {},
): EstadoRegata {
  const rivales = inscritos.filter((i) => !i.jugador);
  const jugador = inscritos.find((i) => i.jugador);
  const total = inscritos.length;
  // Con menos de cuatro inscritas no hay cinco plazas que sortear: se acota al
  // final de la parrilla, que es donde hay a quién impedir que te adelante.
  // Sin el acotado, una regata de dos barcas dejaba plazas vacías y el array de
  // rivales se quedaba corto.
  const plazaJugador =
    jugador === undefined
      ? 0
      : Math.min(total - 1, 3 + Math.floor(rng.siguiente() * Math.min(5, Math.max(1, total - 3))));

  const orden: Inscripcion[] = [];
  let r = 0;
  for (let plaza = 0; plaza < total; plaza++) {
    if (jugador !== undefined && plaza === plazaJugador) orden.push(jugador);
    else orden.push(rivales[r++]!);
  }

  const personalidades = repartirPersonalidades(total, rng);
  const naves: Nave[] = orden.map((ins, plaza) => ({
    indice: plaza,
    nombre: ins.nombre,
    barca: ins.barca,
    colores: ins.colores,
    jugador: ins.jugador,
    personalidad: personalidades[plaza]!,
    // La parrilla se escalona: 7 m entre plazas y carriles alternos.
    metros: (total - 1 - plaza) * 7,
    velocidad: 0,
    carril: plaza % Math.max(2, carrilesDisponiblesEn(circuito, 0)),
    cambiando: 0,
    carrilDestino: 0,
    energia: 100,
    gas: 0,
    objeto: null,
    guardado: null,
    efectos: [],
    vuelta: 0,
    huevosRotos: 0,
    cargaMiniturbo: 0,
    arranque: null,
    tiempoMeta: null,
  }));
  naves.forEach((n) => (n.carrilDestino = n.carril));

  const indiceJugador = naves.findIndex((n) => n.jugador);
  // [B-702] Las que salen delante ya están «consolidadas»: no cuentan como
  // adelantamiento, porque no han adelantado a nadie.
  const delante = indiceJugador < 0 ? [] : naves.filter((n) => !n.jugador && n.metros > naves[indiceJugador]!.metros).map((n) => n.indice);
  // [K-303] Y en espejo, las que salen detrás: pasarlas no cuenta.
  const detras = indiceJugador < 0 ? [] : naves.filter((n) => !n.jugador && n.metros < naves[indiceJugador]!.metros).map((n) => n.indice);

  return {
    circuito,
    naves,
    huevos,
    objetos: [],
    reloj: 0,
    cuentaAtras: (opciones.cuentaAtras ?? 0) * RITMO,
    adelantamientosSufridos: 0,
    pendientes: [],
    delante,
    detras,
    pendientesDetras: [],
    avisos: [],
    terminada: false,
    proximoObjeto: 1,
  };
}

// ---------------------------------------------------------------------------
// El tick
// ---------------------------------------------------------------------------

/**
 * [B-301] Un paso de `PASO` segundos. Devuelve un estado NUEVO: no muta el que
 * recibe, que es lo que permite que el render interpole entre dos estados sin
 * que el de atrás cambie bajo sus pies.
 */
export function avanzar(est: EstadoRegata, ctx: ContextoConTraza, rng: Rng): EstadoRegata {
  if (est.cuentaAtras > 0) return contarAtras(est, ctx, rng);
  const dt = PASO;
  const traza = ctx.traza;
  const naves = est.naves.map((n) => ({ ...n, efectos: n.efectos.slice() }));
  const total = longitudTotal(est.circuito);
  const vueltaLarga = longitudDeVuelta(est.circuito);
  // [K-303] Lo que le pasa al jugador en este tick.
  const avisos: Aviso[] = [];

  // -- 1. Decisión ---------------------------------------------------------
  traza?.push('decision');
  const mandos: Mando[] = naves.map((n) =>
    n.jugador ? ctx.mando : decidir(n, { ...est, naves }, ctx.ultimaVuelta),
  );

  // -- 2. Objetos en vuelo [H-209] ----------------------------------------
  traza?.push('objetos');
  let objetos: ObjetoEnVuelo[] = est.objetos;
  let proximoObjeto = est.proximoObjeto;
  {
    const paso = avanzarObjetos({ ...est, naves }, dt);
    objetos = paso.objetos;
    for (const i of paso.burbujasGastadas) {
      naves[i]!.efectos = naves[i]!.efectos.filter((e) => e.tipo !== 'burbuja');
    }
    for (const [i, impacto] of paso.impactos) {
      const nave = naves[i]!;
      if (nave.jugador) avisos.push({ tipo: 'golpe' });
      nave.velocidad = Math.max(VELOCIDAD_MINIMA, nave.velocidad * impacto.factor);
      for (const efecto of impacto.efectos) nave.efectos.push(acortar(efecto, nave));
    }
    // Usar el objeto que se lleva en la mano.
    naves.forEach((nave, i) => {
      if (!mandos[i]!.usar || nave.objeto === null || nave.tiempoMeta !== null) return;
      const lanzamiento = usarObjeto(nave.objeto, i, { ...est, naves, objetos });
      if (nave.jugador) avisos.push({ tipo: 'usas', objeto: nave.objeto });
      for (const o of lanzamiento.objetos) objetos = [...objetos, { ...o, id: proximoObjeto++ }];
      for (const { indice, efecto } of lanzamiento.efectos) {
        naves[indice]!.efectos.push(acortar(efecto, naves[indice]!));
        // [K-303] La racha propia es un turbo; lo que te echa otra, un golpe.
        if (naves[indice]!.jugador) avisos.push(indice === i && efecto.tipo === 'turbo' ? { tipo: 'turbo', origen: 'objeto' } : { tipo: 'golpe' });
      }
      for (const { indice, factor } of lanzamiento.golpes) {
        naves[indice]!.velocidad = Math.max(VELOCIDAD_MINIMA, naves[indice]!.velocidad * factor);
      }
      // [H-103] Se saca el guardado si lo hay.
      nave.objeto = nave.guardado;
      nave.guardado = null;
    });
    for (const nave of naves) nave.efectos = envejecerEfectos(nave.efectos, dt);
  }

  // -- 3. Fuerzas y nueva velocidad ---------------------------------------
  traza?.push('fuerzas');
  for (let i = 0; i < naves.length; i++) {
    const nave = naves[i]!;
    if (nave.tiempoMeta !== null) continue;
    const mando = mandos[i]!;
    const entorno = entornoDe(est, naves, nave);
    const conTurbo = tieneEfecto(nave.efectos, 'turbo');

    nave.gas = Math.max(0, Math.min(1, mando.gas));
    const empuje = nave.gas * empujeDisponible(nave.barca, nave.energia) * factorDeEfectos(nave.efectos);

    // [H-201] El turbo no cansa a nadie: se salta el desgaste.
    if (!conTurbo) {
      nave.energia = energiaTras(nave.energia, empuje, nave.barca.empujeCrucero, dt);
    }

    const a = aceleracion(empuje, nave.barca, nave.velocidad, entorno);
    nave.velocidad = Math.max(0, nave.velocidad + a * dt);

    // [B-209] Entrar pasado en la curva cuesta velocidad, no descalifica.
    const punto = puntoDe(est.circuito, nave.metros);
    if (punto.tramo.tipo === 'curva') {
      // [K-203] Ciñendo, el límite baja: arriesgar cuesta.
      const castigo = nave.cargaMiniturbo > 0 ? CASTIGO_CENIDA : 1;
      const vMax = castigo * velocidadDeViraje(radioEfectivo(punto.tramo, nave.carril), nave.barca.maniobra, nave.barca.eslora);
      if (nave.velocidad > vMax) {
        nave.velocidad = Math.max(vMax, nave.velocidad - (nave.velocidad - vMax) * 3 * dt);
      }
    }

    // [B-303] Mientras se cambia de carril se va de lado y se pierde agua.
    if (nave.cambiando > 0) nave.velocidad *= 1 - 0.05 * dt;
  }

  // -- 4. Bloqueo y carriles ----------------------------------------------
  traza?.push('carriles');
  for (let i = 0; i < naves.length; i++) {
    const nave = naves[i]!;
    if (nave.tiempoMeta !== null) continue;

    // [K-203] Ceñir la boya: timón hacia dentro, ya en el carril interior de
    // una curva. Soltar —o salir de la curva— descarga el medidor.
    {
      const tramo = puntoDe(est.circuito, nave.metros).tramo;
      const dentro = tramo.tipo === 'curva' ? haciaDentro(tramo, carrilesDisponiblesEn(est.circuito, nave.metros)) : null;
      const cine =
        dentro !== null &&
        nave.cambiando === 0 &&
        nave.carril === dentro.carril &&
        Math.sign(mandos[i]!.timon) === dentro.sentido &&
        !tieneEfecto(nave.efectos, 'giro');
      if (cine) nave.cargaMiniturbo += dt;
      else if (nave.cargaMiniturbo > 0) {
        const turbo = miniturbo(nave.cargaMiniturbo);
        if (turbo !== null && !tieneEfecto(nave.efectos, 'turbo')) {
          nave.efectos.push(turbo);
          if (nave.jugador) avisos.push({ tipo: 'turbo', origen: 'cenir' });
        }
        nave.cargaMiniturbo = 0;
      }
    }

    if (nave.cambiando > 0) {
      nave.cambiando = Math.max(0, nave.cambiando - dt);
      if (nave.cambiando === 0) nave.carril = nave.carrilDestino;
    } else {
      // [B-304] Un cambio rechazado no se pierde: se reintenta al tick
      // siguiente. Y una barca cegada o mareada no cambia de carril [H-205].
      const timon = mandos[i]!.timon;
      if (timon !== 0 && !tieneEfecto(nave.efectos, 'giro')) {
        const destino = nave.carril + Math.sign(timon);
        if (carrilLibre({ ...est, naves }, nave, destino)) {
          nave.carrilDestino = destino;
          nave.cambiando = DURACION_CAMBIO;
        }
      }
    }
    // El carril puede dejar de existir al entrar en un estrecho.
    const carriles = carrilesDisponiblesEn(est.circuito, nave.metros);
    if (nave.carril >= carriles) nave.carril = carriles - 1;
    if (nave.carrilDestino >= carriles) nave.carrilDestino = carriles - 1;

    // [B-302] No se puede ocupar el metro de otra en el mismo carril.
    const delante = masCercanaDelante(naves, nave);
    if (delante !== null && delante.hueco < HUECO_MINIMO) {
      nave.velocidad = Math.min(nave.velocidad, Math.max(0, delante.nave.velocidad - 0.1));
    }
  }

  // -- 5. Avance y vuelta --------------------------------------------------
  traza?.push('avance');
  const antes = naves.map((n) => n.metros);
  for (const nave of naves) {
    if (nave.tiempoMeta !== null) continue;
    const punto = puntoDe(est.circuito, nave.metros);
    // [B-106] La resistencia se paga sobre el agua; el avance es sobre el fondo.
    const vFondo = Math.max(0, nave.velocidad + corrienteEn(est.circuito, nave.metros));
    // [B-306] Por fuera de la boya se recorre más agua para el mismo progreso.
    nave.metros += (vFondo * dt) / factorDeCarril(punto.tramo, nave.carril);
    nave.vuelta = Math.floor(nave.metros / vueltaLarga);
  }

  // -- 6. Huevos rotos [H-101] --------------------------------------------
  traza?.push('huevos');
  let huevos = envejecerHuevos(est.huevos, dt);
  {
    const orden = clasificar({ ...est, naves });
    naves.forEach((nave, i) => {
      if (nave.tiempoMeta !== null) return;
      // [H-103] Un objeto a la vez; con vigía, uno guardado.
      const lleno = nave.objeto !== null && (!nave.barca.vigia || nave.guardado !== null);
      if (lleno) return;
      const indice = huevoPisado(huevos, est.circuito, antes[i]!, nave.metros, nave.carril);
      if (indice < 0) return;
      // [H-101] Romperlo no cuesta nada. No se descuenta ni se cobra nada aquí.
      huevos = huevos.map((h, k) => (k === indice ? { ...h, reaparece: REAPARICION } : h));
      const plaza = orden.indexOf(nave.indice) + 1;
      const objeto = tirarRuleta(plaza, naves.length, rng, nave.barca.vigia);
      if (nave.objeto === null) nave.objeto = objeto;
      else nave.guardado = objeto;
      nave.huevosRotos++;
      if (nave.jugador) avisos.push({ tipo: 'huevo' });
    });
  }

  // -- 7. Adelantamientos [B-702] -----------------------------------------
  traza?.push('adelantamientos');
  let { adelantamientosSufridos, pendientes, delante, detras, pendientesDetras } = est;
  const jugador = naves.find((n) => n.jugador);
  if (jugador !== undefined) {
    const reloj = est.reloj + dt;
    const nuevasPendientes: { indice: number; desde: number }[] = [];
    const nuevoDelante: number[] = [];
    for (const rival of naves) {
      if (rival.jugador) continue;
      const porDelante = metrosDe(rival) > metrosDe(jugador);
      if (!porDelante) continue; // caer detrás la saca de las dos listas
      if (delante.includes(rival.indice)) {
        nuevoDelante.push(rival.indice);
        continue;
      }
      const pendiente = pendientes.find((p) => p.indice === rival.indice);
      if (pendiente === undefined) {
        nuevasPendientes.push({ indice: rival.indice, desde: reloj });
      } else if (reloj - pendiente.desde >= HISTERESIS_ADELANTAMIENTO) {
        // Ha aguantado delante: ahora sí, es un adelantamiento.
        adelantamientosSufridos++;
        avisos.push({ tipo: 'teAdelantan', quien: rival.indice });
        nuevoDelante.push(rival.indice);
      } else {
        nuevasPendientes.push(pendiente);
      }
    }
    pendientes = nuevasPendientes;
    delante = nuevoDelante;

    // [K-303] Los GANADOS, en espejo y con la misma histéresis: una rival que
    // se queda detrás 3 s seguidos. Sin histéresis, dos barcas en paralelo se
    // pasan cada tick (`DB6`).
    const nuevasDetras: { indice: number; desde: number }[] = [];
    const nuevoDetras: number[] = [];
    for (const rival of naves) {
      if (rival.jugador || rival.tiempoMeta !== null || jugador.tiempoMeta !== null) continue;
      if (metrosDe(rival) >= metrosDe(jugador)) continue;
      if (detras.includes(rival.indice)) {
        nuevoDetras.push(rival.indice);
        continue;
      }
      const pendiente = pendientesDetras.find((p) => p.indice === rival.indice);
      if (pendiente === undefined) nuevasDetras.push({ indice: rival.indice, desde: reloj });
      else if (reloj - pendiente.desde >= HISTERESIS_ADELANTAMIENTO) {
        avisos.push({ tipo: 'adelantas', quien: rival.indice });
        nuevoDetras.push(rival.indice);
      } else nuevasDetras.push(pendiente);
    }
    pendientesDetras = nuevasDetras;
    detras = nuevoDetras;
  }

  // -- 8. Meta [B-305] -----------------------------------------------------
  traza?.push('meta');
  const reloj = est.reloj + dt;
  for (const nave of naves) {
    if (nave.tiempoMeta !== null || nave.metros < total) continue;
    // Se interpola dentro del tick: si no, dos barcas que cruzan en el mismo
    // paso empatan a 50 ms y la clasificación se decide por el orden del array.
    const vFondo = Math.max(0.01, nave.velocidad + corrienteEn(est.circuito, total));
    nave.tiempoMeta = reloj - (nave.metros - total) / vFondo;
    nave.metros = total;
    nave.velocidad = Math.min(nave.velocidad, 1);
  }

  return {
    ...est,
    naves,
    huevos,
    objetos,
    reloj,
    adelantamientosSufridos,
    pendientes,
    delante,
    detras,
    pendientesDetras,
    avisos,
    proximoObjeto,
    terminada: naves.every((n) => n.tiempoMeta !== null),
  };
}

// ---------------------------------------------------------------------------
// Ayudantes
// ---------------------------------------------------------------------------

/**
 * [K-202] Un tick de cuenta atrás: nadie avanza y el reloj no corre. Se apunta
 * la primera vez que el jugador pide gas a tope, y al llegar a cero cada barca
 * sale con lo que le toque. Las rivales lo sortean con el `rng` de la regata
 * [K-204] [B-901].
 */
function contarAtras(est: EstadoRegata, ctx: ContextoRegata, rng: Rng): EstadoRegata {
  // Medio paso de tolerancia: 9 − 180·0,05 no da cero exacto en coma flotante.
  const cuentaAtras = est.cuentaAtras - PASO < PASO / 2 ? 0 : est.cuentaAtras - PASO;
  const naves = est.naves.map((n) => ({ ...n, efectos: n.efectos.slice() }));
  const avisos: Aviso[] = [];
  for (const nave of naves) {
    if (nave.jugador && nave.arranque === null && ctx.mando.gas >= GAS_A_TOPE) nave.arranque = est.cuentaAtras;
  }
  if (cuentaAtras === 0) {
    // En el orden de la parrilla, siempre el mismo: misma semilla, misma salida.
    for (const nave of naves) {
      const salida = nave.jugador ? salidaDelJugador(nave.arranque) : salidaDeRival(nave.personalidad, rng);
      const efecto = efectoDeSalida(salida);
      if (efecto !== null) nave.efectos.push(efecto);
      // [K-302] [K-303] Lo que el tablero celebra o lamenta.
      if (nave.jugador && salida === 'turbo') avisos.push({ tipo: 'turbo', origen: 'salida' });
      if (nave.jugador && salida === 'ahogo') avisos.push({ tipo: 'ahogo' });
    }
  }
  return { ...est, naves, cuentaAtras, avisos };
}

/** [K-202] Lo que saca el jugador de su salida, según cuándo pisó. */
export function salidaDelJugador(arranque: number | null): Salida {
  if (arranque === null) return 'nada';
  return arranque <= VENTANA_SALIDA * RITMO + 1e-9 ? 'turbo' : 'ahogo';
}

/** [K-202] El efecto de una salida. Duraciones en segundos reales pasadas a simulación. */
export function efectoDeSalida(salida: Salida): Efecto | null {
  if (salida === 'turbo') return { tipo: 'turbo', restante: 1.5 * RITMO, factor: FACTOR_MINITURBO };
  if (salida === 'ahogo') return { tipo: 'frenado', restante: 1 * RITMO, factor: 0.5 };
  return null;
}

/** [K-203] El turbo que da una carga, o nada si no llegó al corto. */
export function miniturbo(carga: number): Efecto | null {
  if (carga >= CARGA_LARGA * RITMO) return { tipo: 'turbo', restante: 2.4 * RITMO, factor: FACTOR_MINITURBO };
  if (carga >= CARGA_CORTA * RITMO) return { tipo: 'turbo', restante: 1.2 * RITMO, factor: FACTOR_MINITURBO };
  return null;
}

/** Una barca que ya llegó cuenta como si estuviera en la meta. */
function metrosDe(nave: Nave): number {
  return nave.metros;
}

/** [A-201] El mecánico recorta lo que te echan encima. Nunca por debajo de 0,3 s. */
function acortar(efecto: Efecto, nave: Nave): Efecto {
  if (efecto.tipo === 'turbo' || efecto.tipo === 'burbuja') return efecto;
  return { ...efecto, restante: Math.max(0.3, efecto.restante - nave.barca.reparacion) };
}

function masCercanaDelante(naves: readonly Nave[], nave: Nave): { nave: Nave; hueco: number } | null {
  let mejor: { nave: Nave; hueco: number } | null = null;
  for (const otra of naves) {
    if (otra.indice === nave.indice || otra.tiempoMeta !== null) continue;
    if (otra.carril !== nave.carril) continue;
    const hueco = otra.metros - nave.metros;
    if (hueco <= 0) continue;
    if (mejor === null || hueco < mejor.hueco) mejor = { nave: otra, hueco };
  }
  return mejor;
}

/** [B-201] El entorno de una barca: corriente, oleaje y la estela de quien va delante. */
export function entornoDe(est: EstadoRegata, naves: readonly Nave[], nave: Nave): Entorno {
  let estela = 1;
  for (const otra of naves) {
    if (otra.indice === nave.indice || otra.tiempoMeta !== null) continue;
    const hueco = otra.metros - nave.metros;
    if (hueco <= 0 || hueco >= 26) continue;
    const lateral = (otra.carril - nave.carril) * 4.5;
    estela = Math.min(estela, factorEstela(hueco, lateral));
  }
  return {
    corriente: corrienteEn(est.circuito, nave.metros),
    oleaje: oleajeEn(est.circuito, nave.metros),
    estela,
  };
}

/** [B-701] [B-703] Lo que queda de la regata para el jugador. */
export function resultadoDe(est: EstadoRegata, doblones: number): Resultado {
  const orden = clasificar(est);
  const jugador = est.naves.find((n) => n.jugador);
  if (jugador === undefined) throw new Error('regata sin jugador');
  const posicion = orden.indexOf(jugador.indice) + 1;
  const ganador = est.naves[orden[0]!]!;
  return {
    circuitoId: est.circuito.id,
    posicion,
    ganada: posicion === 1,
    adelantamientosSufridos: est.adelantamientosSufridos,
    limpia: est.adelantamientosSufridos === 0,
    huevos: jugador.huevosRotos,
    tiempo: jugador.tiempoMeta ?? est.reloj,
    diferencia: (jugador.tiempoMeta ?? est.reloj) - (ganador.tiempoMeta ?? est.reloj),
    doblones,
  };
}
