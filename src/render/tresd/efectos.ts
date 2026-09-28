// [K-3xx] Lo que se lanza y lo que te pasa, en la escena.
//
// Hasta SPEC-006 el render no leía ni `est.objetos` ni `nave.efectos` (`DK3`):
// una ola lanzada no existía en pantalla, y un ancla te paraba sin haberla
// visto nunca. Aquí cada objeto en vuelo tiene cuerpo [K-301], cada efecto se
// ve en su barca [K-302], y los golpes, las rachas, las ceñidas y los huevos
// rotos sueltan partículas [K-303] [K-304].
//
// [K-306] Cinco mallas instanciadas y UN sistema de partículas: seis llamadas
// de dibujo para todo, las haya o no en el agua.
//
// [B-901] El azar de las partículas sale de un PRNG con semilla fija, como el
// de las islas de `mundo.ts`: el render no importa valores del motor (`H-209`),
// así que los umbrales de la ceñida y de los huevos le llegan por parámetro.

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color as ColorTres,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  NormalBlending,
  Points,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { EstadoRegata, Nave, TipoEfecto, TipoObjeto } from '../../engine/tipos.ts';
import { ARCADE, type Paleta } from '../paleta.ts';
import { alturaDeOla } from './agua.ts';
import { anchuraEn, posicionEn, type Trazado } from './trazado.ts';

/**
 * [K-301] El cuerpo de cada objeto que puede quedar en el agua. `tresOlas`
 * suelta tres `ola`; `turbo`, `burbuja`, `remolino` y `niebla` no dejan nada
 * en vuelo: se resuelven al usarse y se ven como efecto [K-302].
 */
export const CUERPO_DE_OBJETO: Partial<Record<TipoObjeto, string>> = {
  ola: 'cresta de espuma que rueda',
  ancla: 'boyarín rojo con su cadena',
  kraken: 'tentáculos que asoman y persiguen',
};

/** [K-302] Cómo se ve cada efecto en la barca que lo lleva. Exhaustivo. */
export const CUERPO_DE_EFECTO: Record<TipoEfecto, string> = {
  turbo: 'chorro de espuma brillante a popa',
  burbuja: 'esfera irisada alrededor',
  giro: 'la barca da una vuelta sobre sí misma',
  ciego: 'una nube encima',
  frenado: 'espuma en la proa',
};

const MAX_OLAS = 24;
const MAX_ANCLAS = 16;
const MAX_KRAKEN = 4;
const TENTACULOS = 6;
const MAX_PARTICULAS = 900;

/**
 * [R-401] Los colores salen de `paleta.ts`; aquí solo se pasan de 1 —en
 * lineal— para que el resplandor los recoja [R-505].
 */
const brillante = (hex: string, fuerza: number): ColorTres => new ColorTres(hex).multiplyScalar(fuerza);
const CHISPA_AZUL = brillante(ARCADE.chispaNivel1, 2.6);
const CHISPA_NARANJA = brillante(ARCADE.chispaNivel2, 2.6);
const CHISPA_BLANCA = brillante(ARCADE.chispaCarga, 1.1);
const RACHA = brillante(ARCADE.racha, 1.4);
const ORO = brillante(ARCADE.cascara, 2.2);

/** Lo que el render necesita saber del motor y no puede importar (`H-209`). */
export interface UmbralesDeEfectos {
  /** [K-204] Segundos de ceñida del primer y segundo nivel. */
  cenida: readonly [number, number];
  /** [H-105] Segundos que tarda un huevo en reaparecer. */
  reaparicion: number;
}

/** PRNG con semilla (mulberry32): mismas partículas en cada partida. */
function azarCon(semilla: number): { siguiente(): number } {
  let h = semilla >>> 0;
  return {
    siguiente() {
      h = (h + 0x6d2b79f5) >>> 0;
      let t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

function carrilesDe(t: Trazado, metros: number): number {
  return Math.max(2, Math.floor(anchuraEn(t, metros) / 4.5));
}

/** La cresta: media caña curvada, más alta en el medio, de 4 m de ancho. */
function geometriaDeOla(): BufferGeometry {
  const g = new CylinderGeometry(0.9, 0.9, 4, 14, 6, true, Math.PI * 0.05, Math.PI * 0.9);
  g.rotateZ(Math.PI / 2);
  const pos = g.getAttribute('position') as BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    // Más alta en el centro, caída en las puntas.
    pos.setY(i, pos.getY(i) * (1 - 0.55 * Math.pow(Math.abs(x) / 2, 2)));
    pos.setZ(i, pos.getZ(i) + 0.25 * Math.pow(x / 2, 2));
  }
  g.computeVertexNormals();
  return g;
}

/** El boyarín: flotador rojo con franja blanca, asta y un eslabón de cadena. */
function geometriaDeAncla(): BufferGeometry {
  const pintar = (g: BufferGeometry, c: ColorTres): BufferGeometry => {
    const n = (g.getAttribute('position') as BufferAttribute).count;
    const colores = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colores.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new BufferAttribute(colores, 3));
    return g.index === null ? g : g.toNonIndexed();
  };
  const rojo = new ColorTres(ARCADE.anclaFlotador);
  const hierro = new ColorTres(ARCADE.anclaHierro);
  const flotador = pintar(new SphereGeometry(0.7, 16, 10), rojo);
  const franja = pintar(new CylinderGeometry(0.72, 0.72, 0.18, 16), new ColorTres(ARCADE.anclaFranja));
  const asta = pintar(new CylinderGeometry(0.06, 0.06, 1.6, 6).translate(0, 0.9, 0), hierro);
  const tope = pintar(new ConeGeometry(0.22, 0.4, 8).translate(0, 1.85, 0), rojo);
  const cadena = pintar(new TorusGeometry(0.28, 0.07, 6, 12).rotateY(Math.PI / 2).translate(0, -0.75, 0), hierro);
  const g = mergeGeometries([flotador, franja, asta, tope, cadena]);
  if (g === null) throw new Error('no se pudo montar el ancla');
  return g;
}

/** Un tentáculo: cono curvado y afilado, con la punta enroscada. */
function geometriaDeTentaculo(): BufferGeometry {
  const g = new ConeGeometry(0.42, 3.4, 8, 12, true);
  g.translate(0, 1.7, 0);
  const pos = g.getAttribute('position') as BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 3.4;
    pos.setX(i, pos.getX(i) + Math.pow(y, 2) * 1.1);
    pos.setZ(i, pos.getZ(i) + Math.sin(y * Math.PI) * 0.3);
  }
  g.computeVertexNormals();
  return g;
}

/** [K-302] La burbuja y la nube: el mismo sombreador de borde, dos colores. */
function materialDeHalo(color: ColorTres, aditivo: boolean, opacidad: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { color: { value: color }, tiempo: { value: 0 }, opacidad: { value: opacidad } },
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: aditivo ? AdditiveBlending : NormalBlending,
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vVista;
      varying vec3 vLocal;
      void main() {
        vLocal = position;
        vec4 mundo = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        vVista = normalize(cameraPosition - mundo.xyz);
        gl_Position = projectionMatrix * viewMatrix * mundo;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      uniform float tiempo;
      uniform float opacidad;
      varying vec3 vNormal;
      varying vec3 vVista;
      varying vec3 vLocal;
      void main() {
        float borde = 1.0 - abs(dot(normalize(vNormal), vVista));
        float irisado = 0.5 + 0.5 * sin(vLocal.y * 6.0 + tiempo * 3.0 + borde * 8.0);
        vec3 c = mix(color, color.bgr, irisado * 0.6);
        float a = opacidad * (0.15 + pow(borde, 2.2));
        gl_FragColor = vec4(c, a);
      }
    `,
  });
}

interface Particula {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  vida: number;
  total: number;
  tamano: number;
  color: ColorTres;
}

export class Efectos {
  readonly raiz = new Group();
  private readonly olas: InstancedMesh;
  private readonly anclas: InstancedMesh;
  private readonly kraken: InstancedMesh;
  private readonly burbujas: InstancedMesh;
  private readonly nubes: InstancedMesh;
  private readonly puntos: Points;
  private readonly geoPuntos: BufferGeometry;
  private readonly matBurbuja: ShaderMaterial;
  private readonly matNube: ShaderMaterial;
  private readonly particulas: Particula[] = [];
  private readonly rng = azarCon(0xb0a7);
  private readonly umbrales: UmbralesDeEfectos;
  private readonly aDestruir: { dispose(): void }[] = [];
  /** Estado del fotograma anterior, para ver qué es NUEVO en este. */
  private anterior: EstadoRegata | null = null;
  private golpes = new Set<number>();
  private tope = MAX_PARTICULAS;

  constructor(paleta: Paleta, naves: number, umbrales: UmbralesDeEfectos) {
    this.umbrales = umbrales;
    const geoOla = geometriaDeOla();
    const matOla = new MeshStandardMaterial({
      color: new ColorTres(paleta.espuma),
      emissive: new ColorTres(ARCADE.ola),
      emissiveIntensity: 0.55,
      roughness: 0.3,
      transparent: true,
      opacity: 0.92,
      side: DoubleSide,
    });
    this.olas = new InstancedMesh(geoOla, matOla, MAX_OLAS);

    const geoAncla = geometriaDeAncla();
    const matAncla = new MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1 });
    this.anclas = new InstancedMesh(geoAncla, matAncla, MAX_ANCLAS);

    const geoTentaculo = geometriaDeTentaculo();
    const matTentaculo = new MeshStandardMaterial({
      color: new ColorTres(ARCADE.kraken),
      emissive: new ColorTres(ARCADE.kraken),
      emissiveIntensity: 0.5,
      roughness: 0.35,
    });
    this.kraken = new InstancedMesh(geoTentaculo, matTentaculo, MAX_KRAKEN * TENTACULOS);

    const geoEsfera = new IcosahedronGeometry(1, 3);
    this.matBurbuja = materialDeHalo(brillante(ARCADE.burbuja, 1.6), true, 0.9);
    this.burbujas = new InstancedMesh(geoEsfera, this.matBurbuja, naves);
    this.matNube = materialDeHalo(new ColorTres(ARCADE.nube), false, 1.6);
    this.nubes = new InstancedMesh(geoEsfera, this.matNube, naves);

    for (const malla of [this.olas, this.anclas, this.kraken, this.burbujas, this.nubes]) {
      malla.frustumCulled = false;
      malla.count = 0;
    }
    this.olas.castShadow = true;
    this.anclas.castShadow = true;
    this.kraken.castShadow = true;

    // [K-306] Un solo sistema de partículas para todo.
    this.geoPuntos = new BufferGeometry();
    this.geoPuntos.setAttribute('position', new BufferAttribute(new Float32Array(MAX_PARTICULAS * 3), 3));
    this.geoPuntos.setAttribute('color', new BufferAttribute(new Float32Array(MAX_PARTICULAS * 3), 3));
    this.geoPuntos.setAttribute('tamano', new BufferAttribute(new Float32Array(MAX_PARTICULAS), 1));
    this.geoPuntos.setAttribute('vida', new BufferAttribute(new Float32Array(MAX_PARTICULAS), 1));
    const matPuntos = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec3 color;
        attribute float tamano;
        attribute float vida;
        varying vec3 vColor;
        varying float vVida;
        void main() {
          vColor = color;
          vVida = vida;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = tamano * 420.0 / max(1.0, -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vVida;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float r = dot(d, d) * 4.0;
          if (r > 1.0) discard;
          gl_FragColor = vec4(vColor * vVida * (1.0 - r), 1.0);
        }
      `,
    });
    this.puntos = new Points(this.geoPuntos, matPuntos);
    this.puntos.frustumCulled = false;

    this.raiz.add(this.olas, this.anclas, this.kraken, this.burbujas, this.nubes, this.puntos);
    this.aDestruir.push(geoOla, matOla, geoAncla, matAncla, geoTentaculo, matTentaculo, geoEsfera);
    this.aDestruir.push(this.matBurbuja, this.matNube, this.geoPuntos, matPuntos);
  }

  /**
   * Un fotograma. `tiempo` es el reloj VISUAL (el del agua, `K-201`); `dt`,
   * segundos reales; `ritmo`, segundos de regata por segundo real.
   */
  actualizar(est: EstadoRegata, t: Trazado, tiempo: number, oleaje: number, dt: number, ritmo: number): void {
    const m = new Matrix4();
    const q = new Quaternion();
    const sitio = new Vector3();
    const escala = new Vector3();
    const arriba = new Vector3(0, 1, 0);
    const donde = (metros: number, carril: number): { x: number; y: number; z: number; rumbo: number } => {
      const p = posicionEn(t, metros, carril, carrilesDe(t, metros));
      return { ...p, y: alturaDeOla(p.x, p.z, tiempo, oleaje) };
    };

    // -- [K-301] Objetos en vuelo -------------------------------------------
    let olas = 0;
    let anclas = 0;
    let tentaculos = 0;
    for (const o of est.objetos) {
      const p = donde(o.metros, o.carril);
      if (o.tipo === 'ola' && olas < MAX_OLAS) {
        const vida = Math.min(1, o.alcance / 30, (220 - o.alcance) / 12 + 0.2);
        q.setFromAxisAngle(arriba, p.rumbo);
        sitio.set(p.x, p.y - 0.15, p.z);
        const s = 0.9 + 0.7 * vida;
        escala.set(1.05, s * (1 + 0.08 * Math.sin(tiempo * 9 + o.id)), s);
        m.compose(sitio, q, escala);
        this.olas.setMatrixAt(olas++, m);
        // Espuma que salta de la cresta.
        if (this.rng.siguiente() < dt * 40) {
          const lado = (this.rng.siguiente() - 0.5) * 3.6;
          this.soltar(p.x - Math.cos(p.rumbo) * lado, p.y + 1.2, p.z + Math.sin(p.rumbo) * lado, 0, 2.5, 0, 0.7, 0.35, CHISPA_BLANCA);
        }
      } else if (o.tipo === 'ancla' && anclas < MAX_ANCLAS) {
        q.setFromAxisAngle(arriba, tiempo * 0.4 + o.id);
        const cabeceo = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.sin(tiempo * 1.8 + o.id) * 0.18);
        q.multiply(cabeceo);
        sitio.set(p.x, p.y + 0.25, p.z);
        m.compose(sitio, q, escala.set(1.4, 1.4, 1.4));
        this.anclas.setMatrixAt(anclas++, m);
      } else if (o.tipo === 'kraken' && tentaculos + TENTACULOS <= MAX_KRAKEN * TENTACULOS) {
        for (let k = 0; k < TENTACULOS; k++) {
          const a = (k / TENTACULOS) * Math.PI * 2 + tiempo * 0.8;
          const sube = 0.55 + 0.45 * Math.sin(tiempo * 5 + k * 1.7 + o.id);
          sitio.set(p.x + Math.cos(a) * 2.2, p.y - 1.2, p.z + Math.sin(a) * 2.2);
          q.setFromAxisAngle(arriba, -a);
          m.compose(sitio, q, escala.set(1.4, sube * 1.7, 1.4));
          this.kraken.setMatrixAt(tentaculos++, m);
        }
        if (this.rng.siguiente() < dt * 30) this.salpicar(p.x, p.y, p.z, 3, 2.2, CHISPA_BLANCA);
      }
    }
    this.olas.count = olas;
    this.anclas.count = anclas;
    this.kraken.count = tentaculos;
    this.olas.instanceMatrix.needsUpdate = true;
    this.anclas.instanceMatrix.needsUpdate = true;
    this.kraken.instanceMatrix.needsUpdate = true;

    // -- [K-302] [K-303] [K-304] Lo que les pasa a las barcas -----------------
    this.golpes = new Set();
    let burbujas = 0;
    let nubes = 0;
    const antes = this.anterior;
    for (const nave of est.naves) {
      if (nave.tiempoMeta !== null) continue;
      const cambio = nave.cambiando > 0 ? 1 - nave.cambiando / 1.2 : 1;
      const carril = nave.cambiando > 0 ? nave.carril + (nave.carrilDestino - nave.carril) * cambio : nave.carril;
      const p = donde(nave.metros, carril);
      const proa = { x: Math.sin(p.rumbo), z: Math.cos(p.rumbo) };
      const medio = nave.barca.eslora / 2;
      const previa = antes?.naves[nave.indice];

      for (const e of nave.efectos) {
        if (e.tipo === 'burbuja') {
          const r = Math.max(nave.barca.eslora * 0.62, 3);
          q.setFromAxisAngle(arriba, p.rumbo);
          m.compose(sitio.set(p.x, p.y + 0.6, p.z), q, escala.set(r * 0.62, r * 0.55, r));
          this.burbujas.setMatrixAt(burbujas++, m);
        } else if (e.tipo === 'ciego') {
          const r = Math.max(nave.barca.eslora * 0.5, 3);
          const s = 1 + 0.06 * Math.sin(tiempo * 2 + nave.indice);
          m.compose(sitio.set(p.x, p.y + 1.6, p.z), q.identity(), escala.set(r * s, r * 0.55 * s, r * 1.1 * s));
          this.nubes.setMatrixAt(nubes++, m);
        } else if (e.tipo === 'turbo') {
          // Chorro a popa, hacia atrás y un poco arriba.
          const n = Math.ceil(dt * 50);
          for (let k = 0; k < n; k++) {
            const abre = (this.rng.siguiente() - 0.5) * nave.barca.manga * 0.8;
            this.soltar(
              p.x - proa.x * medio - proa.z * abre,
              p.y + 0.35,
              p.z - proa.z * medio + proa.x * abre,
              -proa.x * 6 * ritmo * 0.4,
              1.5 + this.rng.siguiente() * 2,
              -proa.z * 6 * ritmo * 0.4,
              0.4,
              0.22,
              this.rng.siguiente() < 0.5 ? CHISPA_BLANCA : RACHA,
            );
          }
        } else if (e.tipo === 'frenado' && this.rng.siguiente() < dt * 25) {
          this.salpicar(p.x + proa.x * medio, p.y + 0.3, p.z + proa.z * medio, 2, 1.6, CHISPA_BLANCA);
        }
      }

      // [K-303] Golpe nuevo: estallido de espuma.
      if (previa !== undefined && golpeNuevo(previa, nave)) {
        this.golpes.add(nave.indice);
        this.salpicar(p.x, p.y + 0.4, p.z, 45, 5, CHISPA_BLANCA);
      }

      // [K-304] Chispas de la ceñida, del costado de dentro de la proa.
      if (nave.cenida > 0) {
        const [nivel1, nivel2] = this.umbrales.cenida;
        const color = nave.cenida >= nivel2 ? CHISPA_NARANJA : nave.cenida >= nivel1 ? CHISPA_AZUL : CHISPA_BLANCA;
        const tramo = puntoDeTramo(est, nave.metros);
        const dentro = tramo > 0 ? 1 : -1;
        const n = Math.ceil(dt * (nave.cenida >= nivel1 ? 70 : 25));
        for (let k = 0; k < n; k++) {
          // «Dentro» en el mundo: el carril 0 queda a babor [K-101].
          const lx = Math.cos(p.rumbo) * dentro * nave.barca.manga * 0.5;
          const lz = -Math.sin(p.rumbo) * dentro * nave.barca.manga * 0.5;
          this.soltar(
            p.x + proa.x * medio * 0.6 + lx,
            p.y + 0.2,
            p.z + proa.z * medio * 0.6 + lz,
            lx * 2 + (this.rng.siguiente() - 0.5) * 2,
            2 + this.rng.siguiente() * 2.5,
            lz * 2 + (this.rng.siguiente() - 0.5) * 2,
            0.35,
            nave.cenida >= nivel1 ? 0.3 : 0.18,
            color,
          );
        }
      }
    }
    this.burbujas.count = burbujas;
    this.nubes.count = nubes;
    this.burbujas.instanceMatrix.needsUpdate = true;
    this.nubes.instanceMatrix.needsUpdate = true;
    this.matBurbuja.uniforms.tiempo!.value = tiempo;
    this.matNube.uniforms.tiempo!.value = tiempo * 0.3;

    // Un huevo que se rompe: cáscara dorada al aire.
    if (antes !== null) {
      est.huevos.forEach((h, i) => {
        const a = antes.huevos[i];
        if (a === undefined || !(a.reaparece <= 0 && h.reaparece > this.umbrales.reaparicion * 0.5)) return;
        const p = donde(h.metros, h.carril);
        this.salpicar(p.x, p.y + 0.6, p.z, 30, 4, ORO);
      });
    }

    this.anterior = est;
    this.moverParticulas(dt);
  }

  /** [K-103] ¿Recibió esta barca un golpe en este fotograma? Sacude la cámara. */
  golpeEn(indice: number): boolean {
    return this.golpes.has(indice);
  }

  /** [K-306] Para los tests: cuántas llamadas de dibujo son como mucho. */
  mallas(): number {
    let n = 0;
    this.raiz.traverse((o) => {
      if ((o as Mesh).isMesh === true || (o as Points).isPoints === true) n++;
    });
    return n;
  }

  /** [R-603] Con el equipo justo, un tercio de las partículas. */
  simplificar(): void {
    this.tope = Math.floor(MAX_PARTICULAS / 3);
  }

  destruir(): void {
    for (const cosa of this.aDestruir) cosa.dispose();
  }

  private salpicar(x: number, y: number, z: number, n: number, fuerza: number, color: ColorTres): void {
    for (let k = 0; k < n; k++) {
      const a = this.rng.siguiente() * Math.PI * 2;
      const h = this.rng.siguiente() * fuerza;
      this.soltar(x, y, z, Math.cos(a) * h, fuerza * (0.6 + this.rng.siguiente()), Math.sin(a) * h, 0.5 + this.rng.siguiente() * 0.5, 0.35, color);
    }
  }

  private soltar(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    vida: number,
    tamano: number,
    color: ColorTres,
  ): void {
    if (this.particulas.length >= this.tope) this.particulas.shift();
    this.particulas.push({ x, y, z, vx, vy, vz, vida, total: vida, tamano, color });
  }

  private moverParticulas(dt: number): void {
    const pos = this.geoPuntos.getAttribute('position') as BufferAttribute;
    const col = this.geoPuntos.getAttribute('color') as BufferAttribute;
    const tam = this.geoPuntos.getAttribute('tamano') as BufferAttribute;
    const vid = this.geoPuntos.getAttribute('vida') as BufferAttribute;
    let n = 0;
    for (const p of this.particulas) {
      p.vida -= dt;
      if (p.vida <= 0) continue;
      p.vy -= 9.8 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      this.particulas[n++] = p;
    }
    this.particulas.length = n;
    for (let i = 0; i < MAX_PARTICULAS; i++) {
      const p = this.particulas[i];
      if (p === undefined) {
        vid.setX(i, 0);
        tam.setX(i, 0);
        continue;
      }
      pos.setXYZ(i, p.x, p.y, p.z);
      col.setXYZ(i, p.color.r, p.color.g, p.color.b);
      tam.setX(i, p.tamano);
      vid.setX(i, p.vida / p.total);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    tam.needsUpdate = true;
    vid.needsUpdate = true;
    this.geoPuntos.setDrawRange(0, Math.max(1, n));
  }
}

/** Radio del tramo en esos metros; 0 fuera de una curva. */
function puntoDeTramo(est: EstadoRegata, metros: number): number {
  const vuelta = est.circuito.tramos.reduce((s, t) => s + t.longitud, 0);
  let resto = ((metros % vuelta) + vuelta) % vuelta;
  for (const tramo of est.circuito.tramos) {
    if (resto < tramo.longitud) return tramo.tipo === 'curva' ? tramo.radio : 0;
    resto -= tramo.longitud;
  }
  return 0;
}

/** [K-303] Un efecto de golpe que antes no estaba (los efectos SOLO decrecen, `H-210`). */
export function golpeNuevo(antes: Nave, ahora: Nave): boolean {
  for (const tipo of ['giro', 'frenado', 'ciego'] as const) {
    const a = antes.efectos.filter((e) => e.tipo === tipo);
    const d = ahora.efectos.filter((e) => e.tipo === tipo);
    if (d.length > a.length) return true;
    const maxA = Math.max(0, ...a.map((e) => e.restante));
    if (d.some((e) => e.restante > maxA + 1e-6)) return true;
  }
  return false;
}
