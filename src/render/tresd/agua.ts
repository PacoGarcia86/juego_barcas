// [R-2xx] El agua: olas de Gerstner, espuma y estela.
//
// No es un plano azul con una normal map. Si la superficie es plana, la barca
// no puede cabecear —no hay nada sobre lo que cabecear— y una barca a 4 m/s se
// lee como un icono deslizándose por un fondo (`DR1`).
//
// [R-201] Las constantes de los cuatro trenes se declaran UNA vez y las usan
// las dos versiones: la del vértice (GPU) y la de CPU con la que se posan las
// barcas. Si se separan, las barcas flotan sobre un agua que no es la que se
// ve.

import {
  BufferAttribute,
  BufferGeometry,
  Color as ColorTres,
  DoubleSide,
  Mesh,
  ShaderMaterial,
  Vector3,
  type Camera,
} from 'three';
import { GLSL_CIELO, type UniformesCielo } from './cielo.ts';

export interface Tren {
  /** Dirección de avance, normalizada. */
  dx: number;
  dz: number;
  /** Longitud de onda en metros. */
  longitud: number;
  /** Amplitud en metros, a oleaje 1. */
  amplitud: number;
  /** Velocidad de fase en m/s. */
  velocidad: number;
}

/** [R-201] Los cuatro trenes. Declarados una vez, usados en CPU y en GPU. */
export const TRENES: readonly Tren[] = [
  { dx: 1, dz: 0.18, longitud: 34, amplitud: 0.46, velocidad: 4.2 },
  { dx: 0.42, dz: 0.9, longitud: 19, amplitud: 0.24, velocidad: 3.1 },
  { dx: -0.72, dz: 0.68, longitud: 11, amplitud: 0.12, velocidad: 2.4 },
  { dx: 0.9, dz: -0.42, longitud: 6.5, amplitud: 0.055, velocidad: 1.7 },
];

/**
 * [R-201] [R-203] Altura del agua en un punto. La MISMA suma que hace el
 * sombreador de vértices.
 *
 * `oleaje` viene de `oleajeEn` del circuito [B-107], no de una constante del
 * render: con mar en calma el agua está casi plana y con marejada no.
 */
export function alturaDeOla(x: number, z: number, t: number, oleaje: number): number {
  let y = 0;
  for (const tren of TRENES) {
    const k = (2 * Math.PI) / tren.longitud;
    const fase = (x * tren.dx + z * tren.dz) * k + t * tren.velocidad * k;
    y += Math.sin(fase) * tren.amplitud * escalaDe(oleaje);
  }
  return y;
}

/** Con `oleaje` 0 queda una ondulación mínima: el agua nunca es un espejo. */
function escalaDe(oleaje: number): number {
  return 0.08 + 0.92 * Math.max(0, Math.min(1, oleaje));
}

/**
 * [R-301] Pendiente de la ola, para el cabeceo y el balanceo. Se saca de dos
 * puntos separados por la eslora y la manga, no de una derivada analítica: así
 * una barca larga promedia varias olas y una corta las sigue todas, que es lo
 * que pasa de verdad.
 */
export function inclinacionEn(
  x: number,
  z: number,
  rumbo: number,
  eslora: number,
  manga: number,
  t: number,
  oleaje: number,
): { cabeceo: number; balanceo: number } {
  const proaX = x + Math.sin(rumbo) * (eslora / 2);
  const proaZ = z + Math.cos(rumbo) * (eslora / 2);
  const popaX = x - Math.sin(rumbo) * (eslora / 2);
  const popaZ = z - Math.cos(rumbo) * (eslora / 2);
  const estriborX = x + Math.cos(rumbo) * (manga / 2);
  const estriborZ = z - Math.sin(rumbo) * (manga / 2);
  const baborX = x - Math.cos(rumbo) * (manga / 2);
  const baborZ = z + Math.sin(rumbo) * (manga / 2);

  const proa = alturaDeOla(proaX, proaZ, t, oleaje);
  const popa = alturaDeOla(popaX, popaZ, t, oleaje);
  const estribor = alturaDeOla(estriborX, estriborZ, t, oleaje);
  const babor = alturaDeOla(baborX, baborZ, t, oleaje);

  return {
    cabeceo: Math.atan2(proa - popa, eslora),
    balanceo: Math.atan2(estribor - babor, manga),
  };
}

// ---------------------------------------------------------------------------
// La malla
// ---------------------------------------------------------------------------

/** [R-202] Tope de vértices. La primera malla tenía 640 000 y 2,1 GB (`DR4`). */
export const TOPE_VERTICES = 90_000;

/**
 * [R-202] Malla de resolución decreciente: fina cerca de la cámara y basta
 * lejos. Se construye en coordenadas polares alrededor del origen y se mueve
 * con la cámara, así que siempre hay detalle donde se está mirando.
 */
export function construirMallaDeAgua(radio: number, anillos: number, sectores: number): BufferGeometry {
  const vertices = anillos * sectores + 1;
  if (vertices > TOPE_VERTICES) {
    throw new Error(`la malla del agua pide ${vertices} vértices y el tope es ${TOPE_VERTICES}`);
  }
  const posiciones = new Float32Array(vertices * 3);
  const indices: number[] = [];
  // Centro.
  posiciones[0] = 0;
  posiciones[1] = 0;
  posiciones[2] = 0;

  for (let a = 0; a < anillos; a++) {
    // Progresión cuadrática: 1 m cerca, hasta 12 m en el borde [R-202].
    const t = (a + 1) / anillos;
    const r = radio * t * t;
    for (let s = 0; s < sectores; s++) {
      const ang = (s / sectores) * Math.PI * 2;
      const i = 1 + a * sectores + s;
      posiciones[i * 3] = Math.cos(ang) * r;
      posiciones[i * 3 + 1] = 0;
      posiciones[i * 3 + 2] = Math.sin(ang) * r;
    }
  }

  for (let s = 0; s < sectores; s++) {
    indices.push(0, 1 + s, 1 + ((s + 1) % sectores));
  }
  for (let a = 0; a < anillos - 1; a++) {
    for (let s = 0; s < sectores; s++) {
      const s2 = (s + 1) % sectores;
      const a0 = 1 + a * sectores;
      const a1 = 1 + (a + 1) * sectores;
      indices.push(a0 + s, a1 + s, a1 + s2);
      indices.push(a0 + s, a1 + s2, a0 + s2);
    }
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(posiciones, 3));
  geo.setIndex(indices);
  return geo;
}

/** Trozo de GLSL con la misma suma de Gerstner que `alturaDeOla` [R-201]. */
function glslDeTrenes(): string {
  const lineas = TRENES.map(
    (t) =>
      `  k = 6.2831853 / ${t.longitud.toFixed(4)};\n` +
      `  fase = (p.x * ${t.dx.toFixed(4)} + p.z * ${t.dz.toFixed(4)}) * k + tiempo * ${t.velocidad.toFixed(4)} * k;\n` +
      `  y += sin(fase) * ${t.amplitud.toFixed(4)} * escala;\n` +
      `  pend += cos(fase) * ${t.amplitud.toFixed(4)} * escala * k * vec2(${t.dx.toFixed(4)}, ${t.dz.toFixed(4)});`,
  );
  return lineas.join('\n');
}

export interface OpcionesAgua {
  colorHondo: string;
  colorSomero: string;
  colorEspuma: string;
  /** [R-207] La MISMA niebla que la escena: color y densidad de la paleta. */
  colorNiebla: string;
  densidadNiebla: number;
  /** [R-206] Los uniformes del cielo, compartidos: el agua refleja ESE cielo. */
  cielo: UniformesCielo;
  radio: number;
  anillos: number;
  sectores: number;
}

/** El agua, lista para meter en la escena. */
export class Agua {
  readonly malla: Mesh;
  private readonly material: ShaderMaterial;

  constructor(opciones: OpcionesAgua) {
    const geo = construirMallaDeAgua(opciones.radio, opciones.anillos, opciones.sectores);
    this.material = new ShaderMaterial({
      // `DoubleSide` a propósito: la malla se teje en anillos y el sentido de
      // giro de los triángulos cambia de signo según de qué lado del centro
      // caiga el anillo. Con `FrontSide`, media agua quedaba de espaldas a la
      // cámara y en la captura no se veía agua NINGUNA: solo el cielo y las
      // barcas flotando en negro.
      side: DoubleSide,
      uniforms: {
        ...opciones.cielo,
        tiempo: { value: 0 },
        oleaje: { value: 0.3 },
        espumaActiva: { value: 1 },
        centro: { value: new Vector3() },
        radio: { value: opciones.radio },
        // [R-505] En lineal: el compositor pasa a sRGB al final.
        colorHondo: { value: new ColorTres(opciones.colorHondo) },
        colorSomero: { value: new ColorTres(opciones.colorSomero) },
        colorEspuma: { value: new ColorTres(opciones.colorEspuma) },
        colorNiebla: { value: new ColorTres(opciones.colorNiebla) },
        densidadNiebla: { value: opciones.densidadNiebla },
      },
      vertexShader: /* glsl */ `
        uniform float tiempo;
        uniform float oleaje;
        uniform vec3 centro;
        varying float vAltura;
        varying float vEscala;
        varying vec3 vNormal;
        varying vec3 vMundo;
        varying float vBorde;

        void main() {
          vec3 p = position + centro;
          float escala = 0.08 + 0.92 * clamp(oleaje, 0.0, 1.0);
          float y = 0.0;
          float k;
          float fase;
          vec2 pend = vec2(0.0);
${glslDeTrenes()}
          p.y = y;
          vAltura = y;
          vEscala = escala;
          vNormal = normalize(vec3(-pend.x, 1.0, -pend.y));
          vMundo = p;
          vBorde = length(position.xz);
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        ${GLSL_CIELO}
        uniform vec3 colorHondo;
        uniform vec3 colorSomero;
        uniform vec3 colorEspuma;
        uniform vec3 colorNiebla;
        uniform float densidadNiebla;
        uniform float oleaje;
        uniform float tiempo;
        uniform float radio;
        uniform float espumaActiva;
        varying float vAltura;
        varying float vEscala;
        varying vec3 vNormal;
        varying vec3 vMundo;
        varying float vBorde;

        // [R-206] Rizos: ruido que se desplaza en dos direcciones. Su gradiente
        // se suma a la normal de Gerstner. Sin textura que descargar.
        float rizo(vec2 p) {
          return fbmC(p + vec2(tiempo * 0.35, tiempo * 0.12)) * 0.6
               + fbmC(p * 1.7 - vec2(tiempo * 0.18, -tiempo * 0.31)) * 0.4;
        }

        void main() {
          vec3 haciaCamara = cameraPosition - vMundo;
          float distancia = length(haciaCamara);
          vec3 V = haciaCamara / distancia;

          // Detalle por píxel, que se apaga con la distancia para no hacer
          // ruido de aliasing en el horizonte.
          vec2 q = vMundo.xz * 0.55;
          float e = 0.08;
          float r0 = rizo(q);
          vec2 grad = vec2(rizo(q + vec2(e, 0.0)) - r0, rizo(q + vec2(0.0, e)) - r0) / e;
          float detalle = (0.22 + 0.25 * oleaje) / (1.0 + distancia * 0.025);
          vec3 N = normalize(vNormal + vec3(-grad.x, 0.0, -grad.y) * detalle);

          vec3 L = normalize(direccionSol);
          vec3 R = reflect(-V, N);
          R.y = abs(R.y);

          // [R-205] Cuerpo del agua: honda en el seno, somera en la cresta.
          float relativa = clamp(vAltura / (0.875 * vEscala), -1.0, 1.0);
          vec3 cuerpo = mix(colorHondo, colorSomero, 0.35 + 0.35 * relativa);
          float difusa = max(dot(N, L), 0.0);
          cuerpo *= 0.55 + 0.45 * difusa;

          // Luz que atraviesa la cresta cuando se mira hacia el sol.
          float trasluz = pow(max(dot(-V, L), 0.0), 3.0) * max(relativa, 0.0);
          cuerpo += colorSomero * colorSol * trasluz * 0.9;

          // [R-206] Reflejo del MISMO cielo que se dibuja, con Fresnel de Schlick.
          vec3 reflejo = colorDeCielo(normalize(R));
          float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
          vec3 color = mix(cuerpo, reflejo, clamp(fresnel, 0.0, 1.0) * 0.9);

          // El sol en el agua: un camino de destellos. Pasa de 1 a propósito
          // para que el resplandor lo recoja [R-505].
          float brillo = pow(max(dot(R, L), 0.0), 420.0) * 9.0 + pow(max(dot(R, L), 0.0), 40.0) * 0.18;
          color += colorSol * brillo * (1.0 - nubesEn(normalize(R)) * 0.85);

          // [R-208] Espuma: crestas ROTAS por ruido que viaja con el agua. La
          // versión por umbral de altura hacía manchas lisas de 30 m (DR9).
          // El umbral BAJA con la cresta: sin cresta no hay espuma, y con ella
          // solo aparecen las vetas del ruido, nunca una mancha llena.
          float cresta = smoothstep(0.45, 1.0, relativa) * smoothstep(0.1, 0.5, oleaje + 0.1);
          float ruido = fbmC(vMundo.xz * 1.1 + vec2(tiempo * 0.5, tiempo * 0.2));
          float umbral = 1.0 - cresta * 0.42;
          float espuma = smoothstep(umbral, umbral + 0.07, ruido) * espumaActiva;
          color = mix(color, colorEspuma * (0.6 + 0.5 * difusa), espuma * 0.8);

          // [R-207] Niebla exponencial, la misma que la escena; y en el borde de
          // la malla, niebla entera: así se funde con el pie del cielo (DR10).
          float niebla = 1.0 - exp(-pow(densidadNiebla * distancia, 2.0));
          niebla = max(niebla, smoothstep(radio * 0.7, radio * 0.97, vBorde));
          color = mix(color, colorNiebla, niebla);

          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
    this.malla = new Mesh(geo, this.material);
    this.malla.frustumCulled = false;
    this.malla.renderOrder = -1;
  }

  /** Mueve el agua con la cámara y avanza el reloj de las olas. */
  actualizar(camara: Camera, tiempo: number, oleaje: number): void {
    const p = camara.position;
    this.malla.position.set(p.x, 0, p.z);
    (this.material.uniforms.centro!.value as Vector3).set(p.x, 0, p.z);
    this.material.uniforms.tiempo!.value = tiempo;
    this.material.uniforms.oleaje!.value = oleaje;
  }

  /**
   * [R-603] Cuando el equipo no da, se apaga la espuma. La altura de las olas
   * NO se toca: la antigua versión la bajaba en la GPU y las barcas, que se
   * posan con `alturaDeOla` en la CPU, quedaban flotando sobre otra agua [R-201].
   */
  simplificar(): void {
    this.material.uniforms.espumaActiva!.value = 0;
  }

  destruir(): void {
    this.malla.geometry.dispose();
    this.material.dispose();
  }
}
