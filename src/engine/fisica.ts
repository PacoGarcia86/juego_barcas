// [B-2xx] La física del casco.
//
// Aquí no hay «la barca cara va más rápido»: hay empuje, desplazamiento,
// rozamiento y la ola que la propia barca levanta. Que una traiñera de 14 m
// ruede más que una chalana de 6 m sale solo de la raíz de la eslora, y que
// llenar las plazas de remeros NO sea la jugada sale solo de que cada remero
// añade 82 kg al desplazamiento y el desplazamiento entra en las dos
// resistencias.
//
// Funciones puras. Sin React, sin reloj, sin aleatoriedad: el azar entra en
// `carrera.ts`, aquí no [B-903].

import type { BarcaEfectiva, TipoCasco } from './tipos.ts';

/** Densidad del agua de mar, kg/m³. */
const RHO_AGUA = 1025;
/** Gravedad, m/s². */
const G = 9.81;
/** Coeficiente de fricción con factor de forma incluido. */
const CF = 0.0045;
/** Masa del patrón, kg. Va siempre a bordo. */
export const MASA_PATRON = 80;
/**
 * [B-206] Masa añadida hidrodinámica: el agua que la barca arrastra consigo.
 * Solo afecta a la aceleración, no a la resistencia.
 */
const MASA_ANYADIDA = 0.22;

/**
 * [B-202] Velocidad de casco: la velocidad a la que la propia ola de proa
 * alcanza a la ola de popa y el casco se queda atrapado en su propio hoyo.
 *
 * `1,25·√L` en el SI equivale al clásico `1,34·√(Lwl en pies)` en nudos.
 * Una chalana de 6 m: 3,06 m/s. Una traiñera de 14 m: 4,68 m/s.
 */
export function velocidadDeCasco(eslora: number): number {
  return 1.25 * Math.sqrt(Math.max(0.5, eslora));
}

/**
 * [B-205] Resistencia de rozamiento: `½·ρ·Cf·S·v²`.
 *
 * La superficie mojada se aproxima con `S ≈ 2,6·√(∇·L)`, donde `∇ = m/1025` es
 * el volumen desplazado. No es una constante del casco: una barca con cinco
 * tripulantes va más metida en el agua y moja más superficie.
 */
export function resistenciaDeRozamiento(masa: number, eslora: number, vAgua: number): number {
  const volumen = masa / RHO_AGUA;
  const superficie = 2.6 * Math.sqrt(Math.max(1e-6, volumen * eslora));
  return 0.5 * RHO_AGUA * CF * superficie * vAgua * vAgua;
}

/**
 * [B-202] La barrera de ola. Es el corazón del juego y lo que hace que el
 * astillero tenga sentido.
 *
 *   R_ola = m·g·coefOla·ratio³ / max(1 − 0,85·ratio⁴ ; 0,06)
 *
 * El denominador se cierra al acercarse `ratio` a 1: a media velocidad de casco
 * la ola no se nota (`ratio³ = 0,125` sobre un denominador de 0,95), y en la
 * velocidad de casco el término se ha multiplicado por más de cuarenta. El
 * suelo de 0,06 lo mantiene finito —se puede pasar de la velocidad de casco—
 * pero carísimo, que es exactamente lo que le pasa a un casco de
 * desplazamiento de verdad.
 *
 * Cuando esto estaba puesto como un término lineal más, la eslora salía gratis
 * y la barca de 12 m ganó 20 de 20 regatas del arnés: el catálogo entero
 * sobraba (`DB1`).
 */
export function resistenciaDeOla(masa: number, eslora: number, vAgua: number, coefOla: number): number {
  const ratio = Math.max(0, vAgua) / velocidadDeCasco(eslora);
  const denominador = Math.max(1 - 0.85 * ratio * ratio * ratio * ratio, 0.06);
  return masa * G * coefOla * (ratio * ratio * ratio) / denominador;
}

/**
 * [B-203] El planeo es un CAMBIO DE RÉGIMEN, no un coeficiente.
 *
 * Por debajo de 1,05 veces la velocidad de casco, un planeador paga la barrera
 * entera igual que cualquiera. A partir de ahí se sube encima del agua y deja
 * de arrastrar su propia ola: el factor cae suavemente hasta 0,18 en 1,60 y ahí
 * se queda.
 *
 * Modelado como «un 30 % menos de resistencia, siempre», el planeador era más
 * lento que el casco de desplazamiento en los cuatro circuitos y nadie tenía
 * motivo para comprarlo (`DB2`): sin el salto de régimen no hay momento en el
 * que la barca se sube al agua, que es justamente lo que se compra.
 *
 * El suelo es 0,30 y no el 0,18 que decía el borrador: con 0,18 los dos cascos
 * planeadores rodaban a 6,4 y 6,8 m/s contra los 4,3–5,2 de los de
 * desplazamiento, un 30 % de ventaja que se llevaba por delante `BG1`. Está
 * anotado en SPEC-001 §«Lo que la medición cambió respecto a lo escrito».
 */
export const SUELO_PLANEO = 0.3;

export function factorPlaneo(casco: TipoCasco, ratio: number): number {
  if (casco !== 'planeador') return 1;
  if (ratio <= 1.05) return 1;
  if (ratio >= 1.6) return SUELO_PLANEO;
  // Coseno alzado entre 1,05 y 1,60: continuo y con derivada nula en los bordes.
  const t = (ratio - 1.05) / 0.55;
  return 1 - (1 - SUELO_PLANEO) * (0.5 - 0.5 * Math.cos(Math.PI * t));
}

/**
 * [B-207] Oleaje. Lo que manda es la ESTABILIDAD, no la masa.
 *
 * La penalización escala con el desplazamiento —una ola mueve más agua contra
 * un casco grande— pero el término de estabilidad va a la potencia 1,5 y eso lo
 * domina: entre `estabilidad 40` y `estabilidad 95` hay un factor de cuarenta.
 *
 * La primera versión era `(2 − estabilidad/100)`, que solo daba un factor de
 * 1,6 entre los extremos, y la masa se comía la diferencia: la `galeota`
 * —`estabilidad 88`, la barca de mar del catálogo— pagaba **más** oleaje que la
 * `chalana` de 62, porque pesa el triple. La barca estable era peor con mar de
 * fondo, que es exactamente lo contrario de para lo que se compra.
 *
 * El coeficiente es 0,08 y no 0,01. Con 0,01, la corrección de la
 * vulnerabilidad dejaba el término en 12–35 N sobre unos 2 000 N de
 * resistencia: la estabilidad pasó de estar al revés a no existir, y
 * `tormenta` la ganaban las mismas barcas que `faro`. El circuito de mar de
 * fondo tiene que premiar al casco estable o no es un circuito distinto.
 */
export const COEF_OLEAJE = 0.08;

export function resistenciaDeOleaje(masa: number, oleaje: number, estabilidad: number): number {
  const vulnerabilidad = Math.pow(Math.max(0, 1 - estabilidad / 100), 1.5) * 2.6;
  return masa * G * COEF_OLEAJE * Math.max(0, oleaje) * vulnerabilidad;
}

/** El entorno de un punto del circuito. Lo arma `carrera.ts` desde `circuito.ts`. */
export interface Entorno {
  /** [B-106] m/s con signo. Positivo empuja en el sentido de la marcha. */
  corriente: number;
  /** [B-107] 0–1. */
  oleaje: number;
  /** [B-201] Fracción de resistencia que se sigue pagando. 1 = sin estela. */
  estela: number;
}

/**
 * Resistencia total a una velocidad SOBRE EL AGUA dada. Es lo que hay que
 * vencer con el empuje.
 *
 * Ojo: la resistencia se paga sobre el agua, no sobre el fondo [B-106]. Una
 * barca que baja un río a favor va rápida sobre la orilla y despacio sobre el
 * agua, y es la segunda la que le cuesta dinero.
 */
export function resistenciaTotal(barca: BarcaEfectiva, vAgua: number, entorno: Entorno): number {
  const v = Math.max(0, vAgua);
  const ratio = v / velocidadDeCasco(barca.eslora);
  const ola = resistenciaDeOla(barca.masa, barca.eslora, v, barca.coefOla) * factorPlaneo(barca.casco, ratio);
  const roce = resistenciaDeRozamiento(barca.masa, barca.eslora, v);
  const olas = resistenciaDeOleaje(barca.masa, entorno.oleaje, barca.estabilidad);
  // La estela ahorra resistencia hidrodinámica; el oleaje del mar se sufre
  // igual yendo a rueda, que es lo que hace que ir a rueda no sea gratis.
  return (ola + roce) * entorno.estela + olas;
}

/**
 * [B-201] Estela. Es lo que hace que se pueda cazar a quien va delante, y lo
 * que convierte una regata en una regata y no en ocho cronómetros.
 *
 * Devuelve la fracción de resistencia que SIGUE pagando quien va detrás:
 * 1 = ninguna ayuda, 0,70 = ahorro máximo del 30 %.
 *
 *  - Por debajo de 2 m no hay ayuda: es el agua revuelta de la popa, y además
 *    ahí ya está el bloqueo de `B-302`.
 *  - Entre 6 y 10 m, el máximo.
 *  - A partir de 26 m, nada.
 *
 * Cuando era binaria —«detrás de alguien ⇒ −25 %»— las ocho barcas llegaban a
 * meta en 2,1 s pegadas en fila india: no había regata, había un tren (`DB3`).
 */
export function factorEstela(distancia: number, separacionLateral: number): number {
  const d = Math.abs(distancia);
  if (d >= 26 || d < 2) return 1;
  let ahorro: number;
  if (d < 6) {
    // Entrada suave desde el agua revuelta: de 0 en 2 m a 0,30 en 6 m.
    ahorro = 0.3 * ((d - 2) / 4);
  } else if (d <= 10) {
    ahorro = 0.3;
  } else {
    // Cola larga: de 0,30 en 10 m a 0 en 26 m, con forma de coseno alzado para
    // que no haya escalón en ningún metro [B-201].
    const t = (d - 10) / 16;
    ahorro = 0.3 * (0.5 + 0.5 * Math.cos(Math.PI * t));
  }
  // Salirse de la estela por el lado la deshace: a 4,5 m (un carril) queda poco.
  const lateral = Math.max(0, 1 - Math.abs(separacionLateral) / 5.5);
  return 1 - ahorro * lateral;
}

/** Pasos del barrido de `velocidadDeEquilibrio`. Constante: el coste no lo fija la suerte. */
const PASOS_BARRIDO = 280;
/** Techo del modelo, m/s. ≈ 27 nudos, muy por encima de lo que rinde el catálogo. */
const V_TECHO = 14;

/**
 * [B-204] Velocidad de equilibrio para un empuje dado: BARRIDO + BISECCIÓN.
 *
 * No por Newton-Raphson. Con corriente en contra el arrastre deja de ser
 * monótono en el entorno del arranque: Newton, que arrancaba en 3 m/s, saltaba
 * a valores negativos, se topaba con el suelo de 0,5 m/s y se quedaba ahí. La
 * IA creía que no podía avanzar y dejaba de empujar (`DB4`).
 *
 * Y tampoco por bisección a secas. El borrador daba por hecho que
 * `f(v) = resistenciaTotal(v) − empuje` tenía UNA sola raíz positiva porque
 * vale −empuje en el origen y crece sin límite. **Es falso para un casco
 * planeador**: su curva sube hasta la joroba —la `lancha`, 1 905 N a 4,6 m/s—
 * y luego BAJA al subirse encima del agua, así que puede haber tres raíces. Una
 * bisección clásica converge a una cualquiera de las tres.
 *
 * La que vale es **la primera**: una barca arranca parada y sube por su curva
 * hasta que la resistencia la alcanza. Si su empuje no llega a la joroba, se
 * queda atascada debajo, y eso no es un fallo del método — es lo que le pasa a
 * una lancha sin gente a bordo, que se queda en 4,43 m/s hasta que dos remeros
 * la cruzan y pasa a 6,03.
 *
 * Se resuelve en velocidad SOBRE EL FONDO, que es la que le importa a quien
 * corre, y la resistencia se evalúa sobre el AGUA [B-106]. Ahí está la segunda
 * razón para no usar Newton: con corriente a favor, toda velocidad sobre el
 * fondo por debajo de la corriente da velocidad sobre el agua nula, la
 * resistencia es cero en todo ese intervalo y la derivada también. Newton
 * arrancaba justo ahí y dividía por cero.
 *
 * Con corriente EN CONTRA suficientemente fuerte no hay raíz: la barca no gana
 * agua y se devuelve 0. Eso no es un fallo del método, es el río.
 *
 * Coste fijo: `PASOS_BARRIDO` evaluaciones más 40 de bisección. No «hasta
 * converger» [§6.3].
 */
export function velocidadDeEquilibrio(empuje: number, barca: BarcaEfectiva, entorno: Entorno): number {
  const f = (vFondo: number): number =>
    resistenciaTotal(barca, Math.max(0, vFondo - entorno.corriente), entorno) - empuje;
  // Sin empuje que venza a la corriente en contra, no se avanza.
  if (f(0) >= 0) return 0;
  const paso = V_TECHO / PASOS_BARRIDO;
  let anterior = f(0);
  for (let i = 1; i <= PASOS_BARRIDO; i++) {
    const v = i * paso;
    const actual = f(v);
    if (anterior < 0 && actual >= 0) {
      let lo = v - paso;
      let hi = v;
      for (let k = 0; k < 40; k++) {
        const medio = (lo + hi) / 2;
        if (f(medio) < 0) lo = medio;
        else hi = medio;
      }
      return (lo + hi) / 2;
    }
    anterior = actual;
  }
  return V_TECHO;
}

/**
 * Aceleración instantánea. Es lo que usa el tick: una sola evaluación de la
 * resistencia por barca y por tick, y además la aceleración importa —salir de
 * una curva es parte del juego.
 */
export function aceleracion(empuje: number, barca: BarcaEfectiva, vAgua: number, entorno: Entorno): number {
  const neta = empuje - resistenciaTotal(barca, vAgua, entorno);
  return neta / (barca.masa * (1 + MASA_ANYADIDA));
}

/**
 * [B-209] Velocidad a la que se puede tomar una curva sin que la barca derrape.
 *
 * Una barca no agarra: desliza. Por eso el coeficiente es bajo comparado con el
 * de un vehículo con ruedas, y por eso la eslora penaliza —un casco largo tarda
 * más en cambiar de rumbo que uno corto.
 */
export const COEF_VIRAJE = 0.072;

export function velocidadDeViraje(radio: number, maniobra: number, eslora: number): number {
  const r = Math.abs(radio);
  if (r < 1) return Infinity;
  const coef = COEF_VIRAJE * Math.pow(maniobra / 100, 1.2) * Math.sqrt(8 / Math.max(2, eslora));
  return Math.sqrt(r * G * coef);
}

/**
 * [B-208] Energía de la tripulación tras `dt` segundos a un empuje dado.
 *
 * Empujar por encima del crucero la baja; por debajo, la sube. A energía 0 el
 * empuje máximo cae al 55 % (`empujeDisponible`) y no más: reventar es caro,
 * pero no es abandonar. Con la caída al 30 % que decía el borrador, una rival
 * `lanzada` que reventaba en la vuelta 1 quedaba a más de 300 m y ya no volvía:
 * se perdían tres rivales de siete.
 */
export function energiaTras(energia: number, empuje: number, crucero: number, dt: number): number {
  const exceso = (empuje - crucero) / Math.max(1, crucero);
  // Gastar cuesta el triple de lo que recuperar da: una regata no se corre al
  // máximo de principio a fin.
  const ritmo = exceso > 0 ? -exceso * 9 : -exceso * 3;
  return Math.min(100, Math.max(0, energia + ritmo * dt));
}

/** [B-208] Empuje máximo realmente disponible con la energía que queda. */
export function empujeDisponible(barca: BarcaEfectiva, energia: number): number {
  return barca.empujeMax * (0.55 + 0.45 * (energia / 100));
}
