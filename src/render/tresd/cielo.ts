// [R-406] El cielo: degradado, sol, nubes y estrellas en un sombreador.
//
// La función `colorDeCielo` se declara UNA vez, aquí, y la incluyen dos
// sombreadores: el de la cúpula y el del agua, que la usa para su reflejo
// [R-206]. Si fueran dos cuentas, el agua reflejaría un cielo que no es el que
// se ve, y el ojo lo nota antes que cualquier test.
//
// Los colores entran EN LINEAL (`Color.set` convierte desde sRGB): el mapeo de
// tonos y el paso a sRGB los hace el compositor al final, una sola vez [R-505].

import { BackSide, Color as ColorTres, Mesh, ShaderMaterial, SphereGeometry, Vector3, type Camera } from 'three';
import { direccionDelSol, type Paleta } from '../paleta.ts';

/** Uniformes del cielo. Los mismos OBJETOS los comparte el agua [R-206]. */
export interface UniformesCielo {
  [clave: string]: { value: unknown };
  cieloAlto: { value: ColorTres };
  cieloHorizonte: { value: ColorTres };
  cieloNiebla: { value: ColorTres };
  colorSol: { value: ColorTres };
  colorNubes: { value: ColorTres };
  direccionSol: { value: Vector3 };
  nubosidad: { value: number };
  estrellas: { value: number };
  tiempoCielo: { value: number };
}

export function uniformesDeCielo(paleta: Paleta): UniformesCielo {
  const d = direccionDelSol(paleta);
  return {
    cieloAlto: { value: new ColorTres(paleta.cielo) },
    cieloHorizonte: { value: new ColorTres(paleta.horizonte) },
    // [R-207] El pie del cielo es la niebla: así el borde del agua y las islas
    // lejanas se funden con él y no hay raya en el horizonte (`DR10`).
    cieloNiebla: { value: new ColorTres(paleta.niebla) },
    colorSol: { value: new ColorTres(paleta.sol) },
    colorNubes: { value: new ColorTres(paleta.nubes) },
    direccionSol: { value: new Vector3(d.x, d.y, d.z) },
    nubosidad: { value: paleta.nubosidad },
    estrellas: { value: paleta.estrellas },
    tiempoCielo: { value: 0 },
  };
}

/** [R-406] El trozo de GLSL del cielo. Declarado una vez; lo incluyen el cielo y el agua. */
export const GLSL_CIELO = /* glsl */ `
  uniform vec3 cieloAlto;
  uniform vec3 cieloHorizonte;
  uniform vec3 cieloNiebla;
  uniform vec3 colorSol;
  uniform vec3 colorNubes;
  uniform vec3 direccionSol;
  uniform float nubosidad;
  uniform float estrellas;
  uniform float tiempoCielo;

  float azarC(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float ruidoC(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(azarC(i), azarC(i + vec2(1.0, 0.0)), f.x),
               mix(azarC(i + vec2(0.0, 1.0)), azarC(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbmC(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * ruidoC(p);
      p = p * 2.03 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }

  // Cuánto tapan las nubes en una dirección. 0 = cielo limpio.
  float nubesEn(vec3 dir) {
    if (dir.y <= 0.0) return 0.0;
    vec2 uv = dir.xz / (dir.y + 0.12) * 0.55 + vec2(tiempoCielo * 0.006, tiempoCielo * 0.0022);
    float n = fbmC(uv);
    float corte = 1.0 - nubosidad;
    return smoothstep(corte, corte + 0.28, n) * smoothstep(0.0, 0.16, dir.y);
  }

  // Color del cielo en una dirección, en lineal y en HDR: el disco del sol pasa
  // de 1 para que el resplandor lo recoja [R-505].
  vec3 colorDeCielo(vec3 dir) {
    float y = dir.y;
    float alto = clamp(y, 0.0, 1.0);
    vec3 c = mix(cieloHorizonte, cieloAlto, pow(alto, 0.5));
    // Bruma baja: a ras de horizonte el cielo ES la niebla [R-207].
    c = mix(c, cieloNiebla, pow(1.0 - clamp(y * 7.0, 0.0, 1.0), 2.2));

    float s = max(dot(dir, direccionSol), 0.0);
    c += colorSol * (pow(s, 6.0) * 0.22 + pow(s, 90.0) * 0.8);

    // Estrellas: celdas en la esfera, redondas y con un parpadeo lento.
    if (estrellas > 0.0 && y > 0.0) {
      vec3 q = dir * 260.0;
      vec3 celda = floor(q);
      float h = fract(sin(dot(celda, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      float punto = 1.0 - smoothstep(0.08, 0.32, length(fract(q) - 0.5));
      float brillo = step(0.985, h) * punto * (0.6 + 0.4 * sin(tiempoCielo * 2.0 + h * 90.0));
      c += vec3(brillo * estrellas * 2.2 * smoothstep(0.02, 0.25, y));
    }

    // El sol, con borde suave. Por detrás de las nubes.
    float disco = smoothstep(0.99955, 0.99975, s);
    c += colorSol * disco * 24.0;

    // Nubes: iluminadas del lado del sol, en sombra por debajo.
    float n = nubesEn(dir);
    if (n > 0.0) {
      vec3 sombra = mix(cieloNiebla, colorNubes, 0.45) * 0.72;
      vec3 luz = colorNubes * (1.05 + pow(s, 8.0) * 1.6);
      vec3 nube = mix(sombra, luz, clamp(0.35 + fbmC(dir.xz * 4.0 / (y + 0.1)) * 0.8, 0.0, 1.0));
      c = mix(c, nube, n * 0.92);
    }
    return c;
  }
`;

/** La cúpula del cielo. Se mueve con la cámara: nunca se llega a su borde. */
export class Cielo {
  readonly malla: Mesh;
  private readonly material: ShaderMaterial;

  constructor(uniformes: UniformesCielo) {
    this.material = new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      uniforms: uniformes,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = position;
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }
      `,
      fragmentShader: /* glsl */ `
        ${GLSL_CIELO}
        varying vec3 vDir;
        void main() {
          gl_FragColor = vec4(colorDeCielo(normalize(vDir)), 1.0);
        }
      `,
    });
    this.malla = new Mesh(new SphereGeometry(1000, 32, 20), this.material);
    this.malla.frustumCulled = false;
    this.malla.renderOrder = -2;
  }

  actualizar(camara: Camera): void {
    this.malla.position.copy(camara.position);
  }

  destruir(): void {
    this.malla.geometry.dispose();
    this.material.dispose();
  }
}
