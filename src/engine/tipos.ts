// Contratos de datos del motor. Sin lógica: solo tipos.
//
// Regla de capas [B-902]: `engine/` no conoce a `render/`, `components/` ni
// `modes/`. Ninguna capa inferior conoce a la superior.

// ---------------------------------------------------------------------------
// Barcas y tripulación
// ---------------------------------------------------------------------------

/**
 * [B-203] El casco decide el RÉGIMEN, no un coeficiente. Un `planeador` se sube
 * encima del agua por encima de su velocidad de casco y deja de pagar la
 * barrera de ola; uno de `desplazamiento` la paga entera, siempre.
 */
export type TipoCasco = 'desplazamiento' | 'planeador';

/** [A-101] Una barca del catálogo. Dato declarativo: `datos/barcas.ts`. */
export interface Barca {
  id: string;
  nombre: string;
  /** Eslora en metros. Fija la velocidad de casco: `1,25·√eslora` [B-202]. */
  eslora: number;
  /** Manga en metros. El render la usa para la malla [R-303]; la física, para el balanceo. */
  manga: number;
  /** Empuje máximo del casco vacío, en newtons. La tripulación suma [A-105]. */
  empuje: number;
  /** 40–99. Cuánto aguanta una curva sin perder velocidad [B-209]. */
  maniobra: number;
  /** 40–99. Cuánto le afecta el oleaje [B-207]. */
  estabilidad: number;
  /** Cuántos tripulantes caben [A-203]. */
  plazas: number;
  casco: TipoCasco;
  /** Masa del casco vacío, en kilos. */
  masa: number;
  /**
   * Coeficiente de la barrera de ola [B-202]. Un casco fino la paga menos que
   * uno rechoncho a la misma eslora: es lo que separa a la traiñera de la
   * gabarra sin tocar la eslora.
   */
  coefOla: number;
  /**
   * [A-107] Fracción del empuje máximo que la barca sostiene sin cansar a nadie.
   *
   * Es la sexta característica y la que salva a la `trainera` de ser una
   * `galeota` pequeña: un casco largo y muy fino se rema toda la tarde, y una
   * lancha con el motor a tope se queda sin gente antes de la última vuelta.
   */
  crucero: number;
  /** Doblones. La `chalana` vale 0 [A-103]. */
  precio: number;
  /** Colores del casco. Los pinta el render [R-302]. */
  colores: { casco: string; franja: string; vela: string };
  descripcion: string;
}

/** [A-201] Los cinco oficios que se pueden comprar. */
export type Oficio = 'remero' | 'timonel' | 'vigia' | 'mecanico' | 'contramaestre';

/** [A-201] Lo que aporta un oficio. Dato declarativo: `datos/tripulantes.ts`. */
export interface Tripulante {
  oficio: Oficio;
  nombre: string;
  /** [A-202] Kilos. Entra en la masa y por tanto en las dos resistencias. */
  peso: number;
  /** Newtons que suma al empuje máximo. */
  empuje: number;
  /** Puntos de maniobra que suma, antes del tope de 99. */
  maniobra: number;
  /** Puntos de estabilidad que suma, antes del tope de 99. */
  estabilidad: number;
  /** Fracción que suma al empuje de crucero (0,08 = +8 %). */
  crucero: number;
  /** Segundos que recorta a los efectos de objeto recibidos [A-201]. */
  reparacion: number;
  precio: number;
  descripcion: string;
}

/**
 * [A-105] Lo ÚNICO que ve `fisica.ts`. No sabe qué es un remero: sabe que hay
 * un empuje máximo y una masa. Es `B-902` aplicado dentro del propio motor.
 */
export interface BarcaEfectiva {
  eslora: number;
  manga: number;
  empujeMax: number;
  /** [B-208] Empuje que se puede sostener sin gastar energía. */
  empujeCrucero: number;
  maniobra: number;
  estabilidad: number;
  masa: number;
  casco: TipoCasco;
  coefOla: number;
  /** [A-205] Con vigía a bordo: mejor ruleta y un objeto guardado. */
  vigia: boolean;
  /** [A-201] Segundos que el mecánico recorta a los efectos recibidos. */
  reparacion: number;
}

// ---------------------------------------------------------------------------
// Circuito
// ---------------------------------------------------------------------------

export type TipoTramo = 'recta' | 'curva' | 'estrecho' | 'oleaje';

/** [B-101] Un tramo del circuito. Los circuitos son listas de estos. */
export interface Tramo {
  tipo: TipoTramo;
  /** Metros. */
  longitud: number;
  /** Metros de ancho navegable. Fija los carriles [B-103]. */
  anchura: number;
  /** Radio de la curva en metros. Positivo = a estribor. 0 en las rectas. */
  radio: number;
  /** [B-106] m/s con signo: positivo empuja en el sentido de la marcha. */
  corriente: number;
  /** [B-107] 0–1. Se suma al `oleajeBase` del circuito. */
  oleaje: number;
}

export interface Circuito {
  id: string;
  nombre: string;
  /** [B-104] `ficticio` siempre: no hay circuitos reales y se declara. */
  procedencia: 'ficticio';
  tramos: Tramo[];
  vueltas: number;
  /** [B-107] 0–1. Estado del mar de base. */
  oleajeBase: number;
  /** Hora del día. La usa la paleta del render [R-401]. */
  hora: 'amanecer' | 'mediodia' | 'tarde' | 'noche';
  descripcion: string;
}

/** [B-105] La única conversión de distancia a posición del proyecto. */
export interface Punto {
  vuelta: number;
  metrosEnVuelta: number;
  indiceTramo: number;
  tramo: Tramo;
  /** 0–1 dentro del tramo. */
  fraccion: number;
}

// ---------------------------------------------------------------------------
// Huevos y objetos
// ---------------------------------------------------------------------------

export type TipoObjeto =
  | 'turbo'
  | 'ancla'
  | 'ola'
  | 'kraken'
  | 'remolino'
  | 'niebla'
  | 'burbuja'
  | 'tresOlas';

/** [H-102] Un huevo flotando. Sale del circuito, no de una lista a mano. */
export interface Huevo {
  /** Metros dentro de la vuelta. */
  metros: number;
  carril: number;
  /** [H-105] Segundos que le quedan para reaparecer. 0 = entero. */
  reaparece: number;
}

/** [H-2xx] Un objeto suelto en el agua o en vuelo. */
export interface ObjetoEnVuelo {
  id: number;
  tipo: TipoObjeto;
  /** Quién lo lanzó. Índice de barca. */
  duenyo: number;
  /** Metros globales. Un ancla no se mueve; una ola avanza. */
  metros: number;
  carril: number;
  /** [H-210] Segundos que le quedan. SOLO decrece. */
  restante: number;
  /** [H-203] Metros que le quedan de alcance. Solo los proyectiles. */
  alcance: number;
}

export type TipoEfecto = 'turbo' | 'frenado' | 'giro' | 'ciego' | 'burbuja';

/** [H-210] Un efecto activo sobre una barca. Duración fija, nunca se renueva. */
export interface Efecto {
  tipo: TipoEfecto;
  /** Segundos que quedan. SOLO decrece. */
  restante: number;
  /** Factor multiplicativo sobre velocidad o empuje, según el tipo. */
  factor: number;
}

// ---------------------------------------------------------------------------
// Regata
// ---------------------------------------------------------------------------

/** [B-501] Cómo corre una rival. Se reparten por sorteo. */
export type Personalidad = 'lanzada' | 'rueda' | 'sucia' | 'regular';

/** El estado de una barca dentro de la regata. */
export interface Nave {
  indice: number;
  nombre: string;
  barca: BarcaEfectiva;
  colores: { casco: string; franja: string; vela: string };
  /** `true` para la barca del usuario. Solo hay una. */
  jugador: boolean;
  personalidad: Personalidad;

  /** [B-105] Metros globales recorridos: vuelta·longitud + metrosEnVuelta. */
  metros: number;
  /** Velocidad sobre el AGUA, m/s. La del fondo sale de sumarle la corriente [B-106]. */
  velocidad: number;
  carril: number;
  /** [B-303] Segundos que quedan de cambio de carril. 0 = no está cambiando. */
  cambiando: number;
  /** Carril de destino mientras dura el cambio. */
  carrilDestino: number;
  /** [B-208] 0–100. */
  energia: number;
  /** Fracción de empuje pedida este tick, 0–1,3. */
  gas: number;

  objeto: TipoObjeto | null;
  /** [H-103] Solo con vigía a bordo. */
  guardado: TipoObjeto | null;
  efectos: Efecto[];

  /**
   * [K-203] Segundos de SIMULACIÓN que lleva ciñendo la boya: timón hacia
   * dentro, ya en el carril interior de una curva. Soltar descarga.
   */
  cargaMiniturbo: number;
  /**
   * [K-202] Cuenta atrás que quedaba (s de simulación) cuando pidió gas a tope
   * por primera vez. `null` = todavía no lo ha pedido.
   */
  arranque: number | null;

  vuelta: number;
  huevosRotos: number;
  /** Segundos de regata al cruzar la meta. `null` si no ha llegado. */
  tiempoMeta: number | null;
}

/**
 * [K-303] Algo que le ha pasado al jugador en un tick. `quien` es índice de nave.
 * `golpe` no dice qué objeto fue: el impacto no lo sabe.
 */
export type Aviso =
  | { tipo: 'teAdelantan'; quien: number }
  | { tipo: 'adelantas'; quien: number }
  | { tipo: 'huevo' }
  | { tipo: 'usas'; objeto: TipoObjeto }
  | { tipo: 'golpe' }
  | { tipo: 'ahogo' }
  | { tipo: 'turbo'; origen: 'salida' | 'cenir' | 'objeto' };

export interface EstadoRegata {
  circuito: Circuito;
  naves: Nave[];
  huevos: Huevo[];
  objetos: ObjetoEnVuelo[];
  /** Segundos de regata transcurridos. No corre durante la cuenta atrás [K-202]. */
  reloj: number;
  /** [K-202] Segundos de simulación de cuenta atrás que quedan. 0 = en carrera. SOLO decrece. */
  cuentaAtras: number;
  /** [B-702] Adelantamientos sufridos por el jugador, ya consolidados. */
  adelantamientosSufridos: number;
  /**
   * [B-702] Candidatas a adelantamiento: han cruzado por delante del jugador y
   * se está esperando a ver si aguantan. La histéresis de 3 s vive aquí: sin
   * ella, un cruce lateral contaba catorce veces (`DB6`).
   */
  pendientes: { indice: number; desde: number }[];
  /**
   * [B-702] Rivales que YA están consolidadas por delante: las que salieron
   * delante y las que ya han adelantado. Volver a caer detrás las saca de aquí,
   * y entonces pueden volver a adelantar y volver a contar.
   */
  delante: number[];
  /** [K-303] En espejo de `delante`: rivales ya consolidadas DETRÁS del jugador. */
  detras: number[];
  /** [K-303] Candidatas a adelantamiento ganado, con la misma histéresis de `B-702`. */
  pendientesDetras: { indice: number; desde: number }[];
  /** [K-303] Lo que le ha pasado al jugador en el ÚLTIMO tick. La costura los acumula. */
  avisos: Aviso[];
  terminada: boolean;
  proximoObjeto: number;
}

/** Lo que el jugador pide este tick. Lo traduce el mando, no el motor. */
export interface Mando {
  /** 0–1. Fracción de empuje máximo. La interfaz no habla en newtons [H-302]. */
  gas: number;
  /** −1 (babor), 0, +1 (estribor). Intención de cambiar de carril. */
  timon: number;
  /** `true` el tick en el que se pulsa usar objeto. */
  usar: boolean;
}

export interface ContextoRegata {
  /** El mando del jugador. Lo pone la capa de arriba en cada tick. */
  mando: Mando;
  /** [B-504] Se apaga en la última vuelta. */
  ultimaVuelta: boolean;
}

/** [B-701] Lo que queda de una regata terminada. */
export interface Resultado {
  circuitoId: string;
  posicion: number;
  ganada: boolean;
  /** [B-702] */
  adelantamientosSufridos: number;
  /** [B-703] */
  limpia: boolean;
  huevos: number;
  tiempo: number;
  /** Diferencia con el ganador en segundos. 0 si ganó. */
  diferencia: number;
  doblones: number;
}

// ---------------------------------------------------------------------------
// Progreso
// ---------------------------------------------------------------------------

/** [P-101] Lo único que se guarda. */
export interface Partida {
  /** [P-102] Sin esto, un cambio del catálogo deja partidas irrecuperables. */
  version: number;
  doblones: number;
  barcasCompradas: string[];
  barcaEquipada: string;
  /** Tripulantes comprados, por oficio. Pueden estar en tierra. */
  tripulantes: Oficio[];
  /** [A-203] Los que van a bordo. Subconjunto de `tripulantes`, limitado por plazas. */
  embarcados: Oficio[];
  regatasCorridas: number;
  victorias: number;
  regatasLimpias: number;
}
