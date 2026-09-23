// [R-5xx] La vista: el renderizador, la cámara y el fotograma.
//
// Es el ÚNICO fichero de `render/` que toca WebGL [R-504]. Lo demás calcula.
//
// La lección que costó una captura: **la cámara mira al punto del trazado 45 m
// por delante, no al eje de la barca** [R-501]. Mirando a la barca, en la curva
// del tramo 4 de `ria` se veía la orilla y no se podía trazar la curva (`DR3`).

import {
  ACESFilmicToneMapping,
  HalfFloatType,
  PCFShadowMap,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { Circuito, EstadoRegata } from '../../engine/tipos.ts';
import { paletaDe, type Paleta } from '../paleta.ts';
import { Agua } from './agua.ts';
import { Cielo, uniformesDeCielo, type UniformesCielo } from './cielo.ts';
import { Flota } from './flota.ts';
import { Mundo } from './mundo.ts';
import { FOV_PARADO, fovPara } from './encuadre.ts';
import { construirTrazado, lateralDe, posicionEn, puntoDeMira, puntoEn, rumboEn, type Trazado } from './trazado.ts';

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
/** [R-603] Milisegundos por fotograma por encima de los cuales se simplifica. */
const PRESUPUESTO = 30;
/** Fotogramas seguidos malos antes de bajar la calidad. */
const PACIENCIA = 60;
/** [R-505] Resplandor: fuerza, radio y umbral (en lineal, HDR). */
const RESPLANDOR = { fuerza: 0.42, radio: 0.55, umbral: 0.92 };

/**
 * [R-505] Viñeta y un toque de contraste, en lineal y ANTES del mapeo de
 * tonos. Oscurece las esquinas para que la vista vaya al centro, que es donde
 * está la regata.
 */
const VINETA = {
  uniforms: { tDiffuse: { value: null }, fuerza: { value: 0.32 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float fuerza;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5;
      float v = 1.0 - fuerza * smoothstep(0.25, 0.85, dot(d, d) * 2.2);
      float luma = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      vec3 color = mix(vec3(luma), c.rgb, 1.08);
      gl_FragColor = vec4(color * v, c.a);
    }
  `,
};

export interface Diagnostico {
  fps: number;
  llamadas: number;
  triangulos: number;
  simplificado: boolean;
  /** [K-301] FOV del fotograma, en grados: la puerta de K3 se comprueba en una captura. */
  fov: number;
}

export class Vista {
  private readonly renderizador: WebGLRenderer;
  private readonly compositor: EffectComposer;
  private readonly resplandor: UnrealBloomPass;
  private readonly escena = new Scene();
  private readonly cielo: Cielo;
  private readonly uniformesCielo: UniformesCielo;
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

  /**
   * [K-301] `encuadre` llega de arriba porque el render solo importa TIPOS del
   * motor (`H-209`): el ritmo y la velocidad de casco de la barca seguida los
   * calcula quien sí puede. Sin él, el encuadre de antes (8 m/s, ritmo 1).
   */
  private readonly encuadre: { ritmo: number; vCasco: number };

  constructor(lienzo: HTMLCanvasElement, est: EstadoRegata, encuadre: { ritmo: number; vCasco: number } = { ritmo: 1, vCasco: 8 }) {
    this.encuadre = encuadre;
    this.circuito = est.circuito;
    this.paleta = paletaDe(est.circuito);
    this.trazado = construirTrazado(est.circuito);

    // Sin `antialias` en el lienzo: se dibuja a un objetivo intermedio y el
    // suavizado lo hace su MSAA [R-505].
    this.renderizador = new WebGLRenderer({ canvas: lienzo, antialias: false, powerPreference: 'high-performance' });
    this.renderizador.setPixelRatio(Math.min(2, globalThis.devicePixelRatio ?? 1));
    this.renderizador.outputColorSpace = SRGBColorSpace;
    this.renderizador.toneMapping = ACESFilmicToneMapping;
    this.renderizador.toneMappingExposure = 1.0;
    this.renderizador.shadowMap.enabled = true;
    // [R-602] Con el compositor hay varios `render` por fotograma: el contador
    // se pone a cero a mano, o el diagnóstico solo vería el último pase.
    this.renderizador.info.autoReset = false;
    // `PCFSoftShadowMap` ya no existe en three 0.186: pedirlo solo dejaba un
    // aviso en la consola y el suave de serie (`DR11`).
    this.renderizador.shadowMap.type = PCFShadowMap;

    this.camara = new PerspectiveCamera(FOV_PARADO, 1, 0.5, 1800);

    // [R-406] El cielo, y sus uniformes, que comparte el agua [R-206].
    this.uniformesCielo = uniformesDeCielo(this.paleta);
    this.cielo = new Cielo(this.uniformesCielo);
    this.escena.add(this.cielo.malla);

    this.agua = new Agua({
      colorHondo: this.paleta.aguaHonda,
      colorSomero: this.paleta.aguaSomera,
      colorEspuma: this.paleta.espuma,
      // [R-207] La misma niebla que la escena: el mismo campo de la paleta.
      colorNiebla: this.paleta.niebla,
      densidadNiebla: this.paleta.densidadNiebla,
      cielo: this.uniformesCielo,
      radio: 420,
      anillos: 110,
      sectores: 128,
    });
    this.escena.add(this.agua.malla);
    this.mundo = new Mundo(this.escena, est.circuito, this.trazado, this.paleta, est.huevos);
    this.flota = new Flota(est.naves, this.paleta);
    this.escena.add(this.flota.raiz);

    // [R-505] HDR en coma flotante y con MSAA; el mapeo de tonos y el sRGB, al
    // final y una sola vez (`OutputPass`).
    const objetivo = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
    this.compositor = new EffectComposer(this.renderizador, objetivo);
    this.compositor.addPass(new RenderPass(this.escena, this.camara));
    this.resplandor = new UnrealBloomPass(new Vector2(256, 256), RESPLANDOR.fuerza, RESPLANDOR.radio, RESPLANDOR.umbral);
    this.compositor.addPass(this.resplandor);
    this.compositor.addPass(new ShaderPass(VINETA));
    this.compositor.addPass(new OutputPass());

    const jugador = est.naves.find((n) => n.jugador) ?? est.naves[0]!;
    this.metrosCamara = jugador.metros - RETRASO_BASE - jugador.barca.eslora * RETRASO_POR_ESLORA;
  }

  redimensionar(ancho: number, alto: number): void {
    this.renderizador.setSize(ancho, alto, false);
    this.compositor.setPixelRatio(this.renderizador.getPixelRatio());
    this.compositor.setSize(ancho, alto);
    this.camara.aspect = ancho / Math.max(1, alto);
    this.camara.updateProjectionMatrix();
  }

  /**
   * [R-601] Un fotograma. `dt` es tiempo REAL; el estado viene del motor, que va
   * a paso fijo. Un fotograma lento no cambia la regata.
   */
  dibujar(est: EstadoRegata, dt: number, seguido: number): void {
    const arranque = performance.now();
    this.renderizador.info.reset();
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

    // [R-503] [K-301] La velocidad EN PANTALLA abre el encuadre, y el turbo más.
    const { ritmo, vCasco } = this.encuadre;
    const fovQuiere = fovPara(nave.velocidad * ritmo, vCasco * ritmo, nave.efectos.some((e) => e.tipo === 'turbo'));
    this.fovActual += (fovQuiere - this.fovActual) * Math.min(1, dt * 3);
    this.camara.fov = this.fovActual;
    this.camara.updateProjectionMatrix();

    // [K-101] El mar y el cielo van con el reloj REAL, acumulado aquí con el
    // `dt` de pantalla: la regata corre a `RITMO`, pero un mar acelerado se ve
    // de dibujos animados. Barcas, huevos y boyas flotan sobre la misma ola, así
    // que todos leen este mismo tiempo.
    this.tiempoMar += dt;
    const tiempoMar = this.tiempoMar;
    this.cielo.actualizar(this.camara);
    this.uniformesCielo.tiempoCielo.value = tiempoMar;
    this.agua.actualizar(this.camara, tiempoMar, oleaje);
    // [R-506] Las sombras van con la barca seguida.
    const seguida = posicionEn(this.trazado, nave.metros, nave.carril, Math.max(2, Math.floor(this.anchuraDe(nave.metros) / 4.5)));
    this.mundo.seguirSombra(seguida.x, seguida.z);
    this.mundo.actualizarHuevos(est.huevos, tiempoMar, oleaje);
    this.mundo.actualizarBoyas(tiempoMar, oleaje);
    this.flota.actualizar(est.naves, this.trazado, tiempoMar, oleaje, dt);

    this.compositor.render(dt);

    // [R-603] Si el equipo no da, se simplifica. Y se declara: quien llama lo
    // enseña en el diagnóstico, no se hace en silencio.
    const coste = performance.now() - arranque;
    this.ultimoFps = this.ultimoFps * 0.9 + (1 / Math.max(1e-3, dt)) * 0.1;
    if (!this.simplificado) {
      this.malos = coste > PRESUPUESTO ? this.malos + 1 : 0;
      if (this.malos > PACIENCIA) {
        this.flota.apagarEstela();
        this.agua.simplificar();
        // [R-603] [R-505] [R-506] El resplandor y las sombras, fuera.
        this.resplandor.enabled = false;
        this.mundo.apagarSombras();
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
      fov: Math.round(this.fovActual),
    };
  }

  destruir(): void {
    this.flota.destruir();
    this.mundo.destruir();
    this.agua.destruir();
    this.cielo.destruir();
    this.compositor.dispose();
    this.renderizador.dispose();
  }
}
