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
import { Efectos, type UmbralesDeEfectos } from './efectos.ts';
import { Flota } from './flota.ts';
import { Mundo } from './mundo.ts';
import {
  alturaDeCamara,
  construirTrazado,
  posicionEn,
  puntoDeMira,
  retrasoDeCamara,
  type Trazado,
} from './trazado.ts';

/**
 * [R-501] [K-102] El retraso y la altura de la cámara salen de la eslora, en
 * `trazado.ts` (`retrasoDeCamara`, `alturaDeCamara`), que se prueba con
 * números. Con los 13 + 1,15·eslora m de antes cabía una barca entera entre la
 * cámara y la tuya, y había rival en primer plano hasta el 47 % de la regata.
 */
/** [R-503] [K-103] Campo de visión parado y lanzado, en grados, y lo que suma la racha. */
const FOV_PARADO = 62;
const FOV_LANZADO = 76;
const FOV_RACHA = 10;
/** [R-503] Velocidad que se VE a la que el encuadre ya está abierto del todo, m/s. */
const V_LANZADO = 14;
/** [K-103] Lo que dura y lo que mueve la sacudida de un golpe. */
const SACUDIDA = { duracion: 0.35, amplitud: 0.3 };
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
  uniforms: { tDiffuse: { value: null }, fuerza: { value: 0.32 }, rayas: { value: 0 }, tiempo: { value: 0 }, golpe: { value: 0 } },
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
    uniform float rayas;
    uniform float tiempo;
    uniform float golpe;
    varying vec2 vUv;
    float azar(float x) { return fract(sin(x * 127.1) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5;
      float r2 = dot(d, d);
      float v = 1.0 - fuerza * smoothstep(0.25, 0.85, r2 * 2.2);
      float luma = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      // [K-305] Color de arcade: más saturado que el ×1,08 de R-505.
      vec3 color = mix(vec3(luma), c.rgb, 1.22);
      // [K-305] Líneas de velocidad: rayas radiales que corren hacia fuera,
      // solo en el borde, para no tapar la regata.
      if (rayas > 0.0) {
        float angulo = atan(d.y, d.x);
        float sector = floor(angulo * 36.0);
        float fase = fract(sqrt(r2) * 3.0 - tiempo * 2.5 - azar(sector) * 3.0);
        float raya = step(0.8, azar(sector + 0.5)) * smoothstep(0.0, 0.2, fase) * (1.0 - smoothstep(0.2, 0.6, fase));
        float borde = smoothstep(0.1, 0.3, r2);
        color += vec3(0.9, 0.95, 1.0) * raya * borde * rayas * 0.4;
      }
      // [K-405] Un golpe tiñe el borde de rojo.
      color = mix(color, vec3(0.9, 0.05, 0.02), golpe * smoothstep(0.08, 0.3, r2) * 0.7);
      gl_FragColor = vec4(color * v, c.a);
    }
  `,
};

export interface Diagnostico {
  fps: number;
  llamadas: number;
  triangulos: number;
  simplificado: boolean;
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
  private readonly efectos: Efectos;
  private readonly vineta: ShaderPass;
  /** [K-201] Segundos de regata por segundo real. */
  private readonly ritmo: number;
  /** [K-201] Reloj VISUAL: el del agua, el cielo y los huevos. Va con el real. */
  private tiempoVisual = 0;
  /** [K-103] Segundos que le quedan a la sacudida. */
  private sacudida = 0;
  private rayas = 0;
  private readonly trazado: Trazado;
  private readonly paleta: Paleta;
  private readonly circuito: Circuito;

  /** [R-502] El suavizado va en TIEMPO DE REGATA, no de reloj. */
  private metrosCamara = 0;
  private lateralCamara = 0;
  private fovActual = FOV_PARADO;
  private malos = 0;
  private simplificado = false;
  private ultimoFps = 60;

  constructor(
    lienzo: HTMLCanvasElement,
    est: EstadoRegata,
    ritmo = 1,
    umbrales: UmbralesDeEfectos = { cenida: [Infinity, Infinity], reaparicion: 2 },
  ) {
    this.ritmo = ritmo;
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
    this.efectos = new Efectos(this.paleta, est.naves.length, umbrales);
    this.escena.add(this.efectos.raiz);

    // [R-505] HDR en coma flotante y con MSAA; el mapeo de tonos y el sRGB, al
    // final y una sola vez (`OutputPass`).
    const objetivo = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
    this.compositor = new EffectComposer(this.renderizador, objetivo);
    this.compositor.addPass(new RenderPass(this.escena, this.camara));
    this.resplandor = new UnrealBloomPass(new Vector2(256, 256), RESPLANDOR.fuerza, RESPLANDOR.radio, RESPLANDOR.umbral);
    this.compositor.addPass(this.resplandor);
    this.vineta = new ShaderPass(VINETA);
    this.compositor.addPass(this.vineta);
    this.compositor.addPass(new OutputPass());

    const jugador = est.naves.find((n) => n.jugador) ?? est.naves[0]!;
    this.metrosCamara = jugador.metros - retrasoDeCamara(jugador.barca.eslora);
    this.lateralCamara = jugador.carril;
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

    // [K-201] El agua, el cielo y los huevos van con el reloj real: a ×3 las
    // olas correrían como en una película acelerada.
    this.tiempoVisual += dt;
    const tiempo = this.tiempoVisual;

    // [R-502] El suavizado se hace contra la distancia recorrida, no contra el
    // reloj: así el encuadre es el mismo a cualquier velocidad de simulación.
    const objetivo = nave.metros - retrasoDeCamara(nave.barca.eslora);
    const mezcla = 1 - Math.pow(0.0008, dt);
    this.metrosCamara += (objetivo - this.metrosCamara) * mezcla;
    // [B-303] El carril de la cámara sigue al de la barca MIENTRAS cambia, no
    // al llegar: con el ritmo de juego el cambio dura 0,4 s y un salto se nota.
    const avance = nave.cambiando > 0 ? 1 - nave.cambiando / 1.2 : 1;
    const carrilVisto = nave.cambiando > 0 ? nave.carril + (nave.carrilDestino - nave.carril) * avance : nave.carril;
    this.lateralCamara += (carrilVisto - this.lateralCamara) * (1 - Math.pow(0.02, dt));

    // [K-102] Cámara de persecución: la misma cuenta de carril que las barcas.
    const carriles = Math.max(2, Math.floor(this.anchuraDe(this.metrosCamara) / 4.5));
    const c = posicionEn(this.trazado, this.metrosCamara, this.lateralCamara, carriles);
    let altura = alturaDeCamara(nave.barca.eslora);

    // [K-103] Un golpe recibido sacude la cámara.
    if (this.efectos.golpeEn(seguido)) this.sacudida = SACUDIDA.duracion;
    let sx = 0;
    let sz = 0;
    if (this.sacudida > 0) {
      this.sacudida = Math.max(0, this.sacudida - dt);
      const a = SACUDIDA.amplitud * (this.sacudida / SACUDIDA.duracion);
      sx = Math.sin(tiempo * 71) * a;
      sz = Math.cos(tiempo * 53) * a;
      altura += Math.sin(tiempo * 89) * a * 0.6;
    }
    this.camara.position.set(c.x + sx, altura, c.z + sz);

    // [R-501] Se mira al TRAZADO por delante, no a la barca.
    const mira = puntoDeMira(this.trazado, nave.metros);
    this.camara.lookAt(new Vector3(mira.x, 0.6, mira.z));

    // [R-503] [K-103] Abre el encuadre la velocidad que se VE, y la racha más.
    const racha = nave.efectos.some((e) => e.tipo === 'turbo');
    const visible = nave.velocidad * this.ritmo;
    const fovQuiere =
      FOV_PARADO + (FOV_LANZADO - FOV_PARADO) * Math.min(1, visible / V_LANZADO) + (racha ? FOV_RACHA : 0);
    this.fovActual += (fovQuiere - this.fovActual) * Math.min(1, dt * 3);
    this.camara.fov = this.fovActual;
    this.camara.updateProjectionMatrix();

    // [K-305] [K-405] Rayas con la racha; borde rojo con el golpe.
    this.rayas += ((racha ? 1 : 0) - this.rayas) * Math.min(1, dt * 6);
    const u = this.vineta.uniforms as Record<string, { value: number }>;
    u.rayas!.value = this.rayas;
    u.tiempo!.value = tiempo;
    u.golpe!.value = this.sacudida > 0 ? Math.min(1, (this.sacudida / SACUDIDA.duracion) * 1.4) : 0;

    this.cielo.actualizar(this.camara);
    this.uniformesCielo.tiempoCielo.value = tiempo;
    this.agua.actualizar(this.camara, tiempo, oleaje);
    // [R-506] Las sombras van con la barca seguida.
    const seguida = posicionEn(this.trazado, nave.metros, nave.carril, Math.max(2, Math.floor(this.anchuraDe(nave.metros) / 4.5)));
    this.mundo.seguirSombra(seguida.x, seguida.z);
    this.mundo.actualizarHuevos(est.huevos, tiempo, oleaje);
    this.mundo.actualizarBoyas(tiempo, oleaje);
    this.flota.actualizar(est.naves, this.trazado, tiempo, oleaje, dt);
    this.efectos.actualizar(est, this.trazado, tiempo, oleaje, dt, this.ritmo);

    this.compositor.render(dt);

    // [R-603] Si el equipo no da, se simplifica. Y se declara: quien llama lo
    // enseña en el diagnóstico, no se hace en silencio.
    const coste = performance.now() - arranque;
    this.ultimoFps = this.ultimoFps * 0.9 + (1 / Math.max(1e-3, dt)) * 0.1;
    if (!this.simplificado) {
      this.malos = coste > PRESUPUESTO ? this.malos + 1 : 0;
      if (this.malos > PACIENCIA) {
        this.flota.apagarEstela();
        this.efectos.simplificar();
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
    };
  }

  destruir(): void {
    this.flota.destruir();
    this.efectos.destruir();
    this.mundo.destruir();
    this.agua.destruir();
    this.cielo.destruir();
    this.compositor.dispose();
    this.renderizador.dispose();
  }
}
