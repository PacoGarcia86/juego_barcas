// [R-5xx] La vista: el renderizador, la cámara y el fotograma.
//
// Es el ÚNICO fichero de `render/` que toca WebGL [R-504]. Lo demás calcula.
//
// La lección que costó una captura: **la cámara mira al punto del trazado 45 m
// por delante, no al eje de la barca** [R-501]. Mirando a la barca, en la curva
// del tramo 4 de `ria` se veía la orilla y no se podía trazar la curva (`DR3`).

import {
  ACESFilmicToneMapping,
  Color as ColorTres,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { Circuito, EstadoRegata } from '../../engine/tipos.ts';
import { paletaDe, type Paleta } from '../paleta.ts';
import { Agua } from './agua.ts';
import { Flota } from './flota.ts';
import { Mundo } from './mundo.ts';
import { construirTrazado, lateralDe, puntoDeMira, puntoEn, rumboEn, type Trazado } from './trazado.ts';

/**
 * [R-501] Metros por detrás de la barca seguida.
 *
 * Son 26 y no 14. Con 14 la cámara se metía DENTRO de la barca: una galeota
 * mide 14,5 m de eslora, así que el retraso era menor que la propia barca y lo
 * único que se veía era su propia cubierta llenando la pantalla.
 */
const RETRASO_BASE = 13;
/**
 * [R-501] El retraso CRECE con la eslora. Una galeota mide 14,5 m: con un
 * retraso fijo de 14 m la cámara se metía dentro de la barca y llenaba la
 * pantalla con su propia cubierta, y con uno fijo de 26 m una chalana de 6 m
 * quedaba tan lejos que no se distinguía de las rivales.
 */
const RETRASO_POR_ESLORA = 1.15;
/** [R-501] Altura de la cámara sobre el agua. A ras de agua no se ve el circuito. */
const ALTURA = 5.8;
/** [R-503] Campo de visión parado y lanzado, en grados. */
const FOV_PARADO = 62;
const FOV_LANZADO = 76;
/** [R-603] Milisegundos por fotograma por encima de los cuales se simplifica. */
const PRESUPUESTO = 30;
/** Fotogramas seguidos malos antes de bajar la calidad. */
const PACIENCIA = 60;

export interface Diagnostico {
  fps: number;
  llamadas: number;
  triangulos: number;
  simplificado: boolean;
}

export class Vista {
  private readonly renderizador: WebGLRenderer;
  private readonly escena = new Scene();
  private readonly camara: PerspectiveCamera;
  private readonly agua: Agua;
  private readonly mundo: Mundo;
  private readonly flota: Flota;
  private readonly trazado: Trazado;
  private readonly paleta: Paleta;
  private readonly circuito: Circuito;

  /** [R-502] El suavizado va en TIEMPO DE REGATA, no de reloj. */
  private metrosCamara = 0;
  private lateralCamara = 0;
  private fovActual = FOV_PARADO;
  /** [K-101] Segundos REALES desde que se abrió la vista. El mar va con este. */
  private tiempoMar = 0;
  private malos = 0;
  private simplificado = false;
  private ultimoFps = 60;

  constructor(lienzo: HTMLCanvasElement, est: EstadoRegata) {
    this.circuito = est.circuito;
    this.paleta = paletaDe(est.circuito);
    this.trazado = construirTrazado(est.circuito);

    this.renderizador = new WebGLRenderer({ canvas: lienzo, antialias: true, powerPreference: 'high-performance' });
    this.renderizador.setPixelRatio(Math.min(2, globalThis.devicePixelRatio ?? 1));
    this.renderizador.outputColorSpace = SRGBColorSpace;
    this.renderizador.toneMapping = ACESFilmicToneMapping;
    this.renderizador.toneMappingExposure = 1.05;
    this.renderizador.shadowMap.enabled = true;
    this.renderizador.shadowMap.type = PCFSoftShadowMap;
    this.escena.background = new ColorTres(this.paleta.cielo);

    this.camara = new PerspectiveCamera(FOV_PARADO, 1, 0.5, 1800);
    this.agua = new Agua({
      colorHondo: this.paleta.aguaHonda,
      colorSomero: this.paleta.aguaSomera,
      colorEspuma: this.paleta.espuma,
      colorCielo: this.paleta.horizonte,
      radio: 420,
      anillos: 110,
      sectores: 128,
    });
    this.escena.add(this.agua.malla);
    this.mundo = new Mundo(this.escena, est.circuito, this.trazado, this.paleta, est.huevos);
    this.flota = new Flota(est.naves, this.paleta);
    this.escena.add(this.flota.raiz);

    const jugador = est.naves.find((n) => n.jugador) ?? est.naves[0]!;
    this.metrosCamara = jugador.metros - RETRASO_BASE - jugador.barca.eslora * RETRASO_POR_ESLORA;
  }

  redimensionar(ancho: number, alto: number): void {
    this.renderizador.setSize(ancho, alto, false);
    this.camara.aspect = ancho / Math.max(1, alto);
    this.camara.updateProjectionMatrix();
  }

  /**
   * [R-601] Un fotograma. `dt` es tiempo REAL; el estado viene del motor, que va
   * a paso fijo. Un fotograma lento no cambia la regata.
   */
  dibujar(est: EstadoRegata, dt: number, seguido: number): void {
    const arranque = performance.now();
    const nave = est.naves[seguido] ?? est.naves[0]!;
    const oleaje = Math.min(1, Math.max(0, this.circuito.oleajeBase + 0.15));

    // [R-502] El suavizado se hace contra la distancia recorrida, no contra el
    // reloj: así el encuadre es el mismo a cualquier velocidad de simulación.
    const retraso = RETRASO_BASE + nave.barca.eslora * RETRASO_POR_ESLORA;
    const objetivo = nave.metros - retraso;
    const mezcla = 1 - Math.pow(0.0008, dt);
    this.metrosCamara += (objetivo - this.metrosCamara) * mezcla;
    this.lateralCamara += (nave.carril - this.lateralCamara) * mezcla;

    const p = puntoEn(this.trazado, this.metrosCamara);
    const rumbo = rumboEn(this.trazado, this.metrosCamara);
    const carriles = Math.max(2, Math.floor(this.anchuraDe(this.metrosCamara) / 4.5));
    const lateral = lateralDe(this.lateralCamara, carriles, this.anchuraDe(this.metrosCamara));
    this.camara.position.set(p.x + Math.cos(rumbo) * lateral, ALTURA, p.z - Math.sin(rumbo) * lateral);

    // [R-501] Se mira al TRAZADO por delante, no a la barca.
    const mira = puntoDeMira(this.trazado, nave.metros);
    this.camara.lookAt(new Vector3(mira.x, 0.6, mira.z));

    // [R-503] La velocidad abre el encuadre.
    const fovQuiere = FOV_PARADO + (FOV_LANZADO - FOV_PARADO) * Math.min(1, nave.velocidad / 8);
    this.fovActual += (fovQuiere - this.fovActual) * Math.min(1, dt * 3);
    this.camara.fov = this.fovActual;
    this.camara.updateProjectionMatrix();

    // [K-101] El mar va con el reloj REAL, acumulado aquí con el `dt` de
    // pantalla: la regata corre a `RITMO`, pero un mar acelerado se ve de
    // dibujos animados. Barcas, huevos y boyas flotan sobre la misma ola, así
    // que todos leen este mismo tiempo.
    this.tiempoMar += dt;
    const tiempoMar = this.tiempoMar;
    this.agua.actualizar(this.camara, tiempoMar, oleaje);
    this.mundo.actualizarHuevos(est.huevos, tiempoMar, oleaje);
    this.mundo.actualizarBoyas(tiempoMar, oleaje);
    this.flota.actualizar(est.naves, this.trazado, tiempoMar, oleaje, dt);

    this.renderizador.render(this.escena, this.camara);

    // [R-603] Si el equipo no da, se simplifica. Y se declara: quien llama lo
    // enseña en el diagnóstico, no se hace en silencio.
    const coste = performance.now() - arranque;
    this.ultimoFps = this.ultimoFps * 0.9 + (1 / Math.max(1e-3, dt)) * 0.1;
    if (!this.simplificado) {
      this.malos = coste > PRESUPUESTO ? this.malos + 1 : 0;
      if (this.malos > PACIENCIA) {
        this.flota.apagarEstela();
        this.agua.simplificar();
        this.renderizador.shadowMap.enabled = false;
        this.simplificado = true;
      }
    }
  }

  private anchuraDe(metros: number): number {
    let resto = ((metros % this.trazado.vuelta) + this.trazado.vuelta) % this.trazado.vuelta;
    for (const tramo of this.circuito.tramos) {
      if (resto < tramo.longitud) return tramo.anchura;
      resto -= tramo.longitud;
    }
    return this.circuito.tramos[this.circuito.tramos.length - 1]!.anchura;
  }

  /** [R-602] `?diagnostico=1`. */
  diagnostico(): Diagnostico {
    const info = this.renderizador.info.render;
    return {
      fps: Math.round(this.ultimoFps),
      llamadas: info.calls,
      triangulos: info.triangles,
      simplificado: this.simplificado,
    };
  }

  destruir(): void {
    this.flota.destruir();
    this.mundo.destruir();
    this.agua.destruir();
    this.renderizador.dispose();
  }
}
