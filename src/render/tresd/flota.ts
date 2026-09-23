// [R-3xx] Las ocho barcas en escena, y su estela.
//
// [R-302] Una malla INSTANCIADA por tipo de casco, una para las velas, una
// para todos los remos, una para todos los remeros y una para la estela: seis
// llamadas de dibujo como mucho para la flota entera. La primera versión daba
// una malla propia a cada barca —casco, franja y dos mallas por remo— y se
// plantaba en 48 llamadas y 22 fps en gama media (`DR2`).
//
// [R-306] La franja y la cubierta NO son mallas aparte: el casco lleva una
// marca por vértice (`zona`) y el color de franja va por instancia. Así la
// barca tiene tres colores y la flota sigue en seis llamadas.

import {
  BufferAttribute,
  BufferGeometry,
  Color as ColorTres,
  DoubleSide,
  Euler,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector3,
} from 'three';
import type { Nave, TipoCasco } from '../../engine/tipos.ts';
import type { Paleta } from '../paleta.ts';
import { alturaDeOla, inclinacionEn } from './agua.ts';
import {
  asientoDe,
  BANCADAS,
  geometriaDeCasco,
  geometriaDeRemero,
  geometriaDeRemo,
  geometriaDeVela,
  PARTE,
  seccion,
  T_PALO,
  ZONA_BANCADA,
  ZONA_FRANJA,
} from './barca.ts';
import { anchuraEn, lateralDe, puntoEn, rumboEn, type Trazado } from './trazado.ts';

/** [R-209] Puntos de la tira de estela por barca. */
const PUNTOS_ESTELA = 34;
/** [R-209] Metros entre dos puntos de estela. Por distancia, no por fotograma. */
const PASO_ESTELA = 0.8;
/** Segundos que tarda la estela en deshacerse. */
const VIDA_ESTELA = 3;
/** Remos por costado, y remeros por barca: uno por bancada. */
const REMOS_POR_COSTADO = BANCADAS.length;
/**
 * [R-311] Hacia dónde sopla el viento, en el mismo ángulo que el rumbo. Uno
 * fijo basta: lo que se quiere es que cada vela vaya cazada a su banda según
 * su rumbo, no una meteorología.
 */
const VIENTO = 0.9;
/** [R-310] Metros a popa de la bancada donde va el tolete. */
const TOLETE_A_POPA = 0.3;

/**
 * [R-305] [R-309] Fracción del puntal que va bajo el agua. Crece con la masa:
 * una barca cargada va más metida. Es el MISMO número que hunde el casco y que
 * pinta la línea de flotación: si fueran dos cuentas, la patente saldría por
 * encima del agua.
 *
 * [R-308] Con tope en 0,44: la barca es ABIERTA y su plan va al 52 % del
 * puntal. Con el tope de antes (0,62) el agua quedaba por encima del plan y se
 * veía el mar dentro de la lancha, entre las bancadas.
 */
export function caladoDe(masa: number): number {
  return 0.26 + 0.18 * Math.min(1, Math.max(0, (masa - 450) / 1300));
}

interface Rastro {
  x: number;
  z: number;
  edad: number;
  fuerza: number;
}

/**
 * [R-306] [R-309] El material del casco: el color del casco por instancia (el
 * de serie de three), la franja por instancia (atributo propio), la madera de
 * dentro con tablas y veta, y la PATENTE por debajo del calado de cada barca,
 * con una línea de flotación clara encima.
 */
function materialDeCasco(madera: ColorTres): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({ roughness: 0.42, metalness: 0.02 });
  mat.onBeforeCompile = (sombreador) => {
    sombreador.uniforms.colorMadera = { value: madera };
    sombreador.vertexShader = sombreador.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float zona;
        attribute vec3 colorFranja;
        attribute float calado;
        varying float vZona;
        varying vec3 vFranja;
        varying vec3 vLocal;
        varying float vFlotacion;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vZona = zona;
        vFranja = colorFranja;
        vLocal = position;
        // [R-309] El origen es la borda del centro y la quilla está en −1: el
        // agua corta el casco en y = −(1 − calado).
        vFlotacion = -(1.0 - calado);`,
      );
    sombreador.fragmentShader = sombreador.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 colorMadera;
        varying float vZona;
        varying vec3 vFranja;
        varying vec3 vLocal;
        varying float vFlotacion;
        float azarCasco(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float ruidoCasco(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(azarCasco(i), azarCasco(i + vec2(1.0, 0.0)), f.x),
                     mix(azarCasco(i + vec2(0.0, 1.0)), azarCasco(i + vec2(1.0, 1.0)), f.x), f.y);
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float rugosidadCasco = 0.42;
        if (vZona > 1.5) {
          // Tablas a lo largo de la eslora, con junta oscura y veta estirada.
          float tabla = fract((abs(vLocal.x) * 1.6 + vLocal.y) * 7.0);
          float junta = smoothstep(0.0, 0.08, tabla) * smoothstep(1.0, 0.92, tabla);
          float veta = ruidoCasco(vec2(vLocal.z * 9.0, (abs(vLocal.x) + vLocal.y) * 90.0));
          float claro = vZona > ${((ZONA_BANCADA + 2) / 2).toFixed(2)} ? 1.2 : 1.0;
          // Lo hondo de la barca, más oscuro: oclusión de pobre.
          float hondo = 0.7 + 0.3 * smoothstep(-0.65, -0.05, vLocal.y);
          diffuseColor.rgb = colorMadera * claro * hondo * (0.66 + 0.34 * junta) * (0.85 + 0.3 * veta);
          rugosidadCasco = 0.62;
        } else if (vZona > ${ZONA_FRANJA.toFixed(2)}) {
          diffuseColor.rgb = vFranja;
          rugosidadCasco = 0.3;
        } else if (vLocal.y < vFlotacion + 0.06) {
          // [R-309] Patente: el fondo pintado de rojo oscuro, mate.
          diffuseColor.rgb = vec3(0.24, 0.05, 0.04);
          rugosidadCasco = 0.8;
        } else if (vLocal.y < vFlotacion + 0.1) {
          // [R-309] La línea de flotación.
          diffuseColor.rgb = vec3(0.85, 0.84, 0.8);
          rugosidadCasco = 0.35;
        }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = rugosidadCasco;`,
      );
  };
  mat.customProgramCacheKey = () => 'casco-r309';
  return mat;
}

/**
 * [R-307] [R-310] El remero: camiseta del color de la franja (por instancia),
 * cara y brazos de la paleta, pantalón oscuro y gorra clara.
 */
function materialDeRemero(piel: ColorTres): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({ roughness: 0.8, flatShading: true });
  mat.onBeforeCompile = (sombreador) => {
    sombreador.uniforms.colorPiel = { value: piel };
    sombreador.vertexShader = sombreador.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float parte;\nvarying float vParte;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvParte = parte;');
    sombreador.fragmentShader = sombreador.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 colorPiel;\nvarying float vParte;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        if (vParte > ${(PARTE.gorra - 0.5).toFixed(1)}) diffuseColor.rgb = vec3(0.86, 0.85, 0.8);
        else if (vParte > ${(PARTE.pantalon - 0.5).toFixed(1)}) diffuseColor.rgb = vec3(0.07, 0.08, 0.11);
        else if (vParte > ${(PARTE.piel - 0.5).toFixed(1)}) diffuseColor.rgb = colorPiel;`,
      );
  };
  mat.customProgramCacheKey = () => 'remero-r310';
  return mat;
}

/** [R-310] El remo: caña de madera y la pala con el color de la franja (por instancia). */
function materialDeRemo(): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({ roughness: 0.5 });
  mat.onBeforeCompile = (sombreador) => {
    sombreador.vertexShader = sombreador.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float pala;\nvarying float vPala;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPala = pala;');
    sombreador.fragmentShader = sombreador.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vPala;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        diffuseColor.rgb = mix(diffuse, vColor.rgb, step(0.5, vPala));`,
      );
  };
  mat.customProgramCacheKey = () => 'remo-r310';
  return mat;
}

/**
 * [R-311] La vela: paños cosidos, una franja del color de la barca y el palo y
 * la botavara de madera. El color de la vela va por instancia.
 */
function materialDeVela(madera: ColorTres): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({ roughness: 0.85, side: DoubleSide });
  mat.onBeforeCompile = (sombreador) => {
    sombreador.uniforms.colorMadera = { value: madera };
    sombreador.vertexShader = sombreador.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float parte;\nattribute vec3 colorFranja;\nvarying float vParte;\nvarying vec3 vFranja;\nvarying vec3 vLocal;',
      )
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvParte = parte;\nvFranja = colorFranja;\nvLocal = position;');
    sombreador.fragmentShader = sombreador.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 colorMadera;\nvarying float vParte;\nvarying vec3 vFranja;\nvarying vec3 vLocal;',
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        if (vParte > 0.5) {
          diffuseColor.rgb = colorMadera * 0.8;
        } else {
          // Paños: costuras perpendiculares a la baluma.
          float pano = fract((vLocal.y - vLocal.z * 0.35) * 9.0);
          diffuseColor.rgb *= 0.9 + 0.1 * smoothstep(0.0, 0.06, pano);
          // Una franja en diagonal con el color de la barca.
          float franja = vLocal.y + vLocal.z * 0.55;
          diffuseColor.rgb = mix(diffuseColor.rgb, vFranja, step(0.46, franja) * step(franja, 0.53));
        }`,
      );
  };
  mat.customProgramCacheKey = () => 'vela-r311';
  return mat;
}

/**
 * [R-209] La estela: borde suave, espuma rota por ruido y la misma niebla que
 * la escena. La versión con `MeshBasicMaterial` aditivo quemaba el agua clara.
 */
function materialDeEstela(espuma: ColorTres): ShaderMaterial {
  return new ShaderMaterial({
    fog: true,
    transparent: true,
    depthWrite: false,
    uniforms: UniformsUtils.merge([UniformsLib.fog, { colorEspuma: { value: espuma }, tiempo: { value: 0 } }]),
    vertexShader: /* glsl */ `
      attribute float lado;
      attribute float vida;
      varying float vLado;
      varying float vVida;
      varying vec2 vPlano;
      #include <fog_pars_vertex>
      void main() {
        vLado = lado;
        vVida = vida;
        vPlano = position.xz;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 colorEspuma;
      uniform float tiempo;
      varying float vLado;
      varying float vVida;
      varying vec2 vPlano;
      #include <fog_pars_fragment>
      float azar(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      float ruido(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(azar(i), azar(i + vec2(1.0, 0.0)), f.x), mix(azar(i + vec2(0.0, 1.0)), azar(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      void main() {
        float borde = 1.0 - vLado * vLado;
        // Los brazos de la V, más blancos que el centro, que es agua batida.
        float brazos = mix(0.55, 1.0, smoothstep(0.35, 0.85, abs(vLado)));
        float n = ruido(vPlano * 1.6 + tiempo * 0.4) * 0.6 + ruido(vPlano * 4.1 - tiempo * 0.7) * 0.4;
        float alfa = vVida * smoothstep(0.0, 0.45, borde) * brazos * smoothstep(0.35, 0.8, n + vVida * 0.15);
        gl_FragColor = vec4(colorEspuma, alfa * 0.7);
        #include <fog_fragment>
      }
    `,
  });
}

export class Flota {
  readonly raiz = new Object3D();
  private readonly cascos = new Map<TipoCasco, { malla: InstancedMesh; indices: number[] }>();
  private readonly velas: InstancedMesh;
  private readonly remos: InstancedMesh;
  private readonly remeros: InstancedMesh;
  private readonly estela: Mesh;
  private readonly geoEstela: BufferGeometry;
  private readonly matEstela: ShaderMaterial;
  private readonly aDestruir: { dispose(): void }[] = [];
  private readonly rastros: Rastro[][] = [];
  private readonly fases: number[];
  /** [R-311] Ángulo de cada botavara con el plano de crujía, para los tests. */
  private readonly escotas: number[];
  private ultimaOla = { tiempo: 0, oleaje: 0 };

  constructor(naves: readonly Nave[], paleta: Paleta) {
    this.fases = naves.map(() => 0);
    this.escotas = naves.map(() => 0);
    for (const _ of naves) this.rastros.push([]);
    const color = new ColorTres();

    // -- Un casco instanciado por tipo [R-302] [R-306] ----------------------
    const matCasco = materialDeCasco(new ColorTres(paleta.madera));
    this.aDestruir.push(matCasco);
    for (const tipo of ['desplazamiento', 'planeador'] as TipoCasco[]) {
      const indices = naves.map((n, i) => (n.barca.casco === tipo ? i : -1)).filter((i) => i >= 0);
      if (indices.length === 0) continue;
      const geo = geometriaDeCasco(tipo);
      const franjas = new Float32Array(indices.length * 3);
      indices.forEach((indiceNave, k) => color.set(naves[indiceNave]!.colores.franja).toArray(franjas, k * 3));
      geo.setAttribute('colorFranja', new InstancedBufferAttribute(franjas, 3));
      // [R-309] El calado de cada barca, para pintar la patente donde toca.
      const calados = new Float32Array(indices.map((i) => caladoDe(naves[i]!.barca.masa)));
      geo.setAttribute('calado', new InstancedBufferAttribute(calados, 1));
      const malla = new InstancedMesh(geo, matCasco, indices.length);
      malla.castShadow = true;
      malla.receiveShadow = true;
      malla.frustumCulled = false;
      indices.forEach((indiceNave, k) => malla.setColorAt(k, color.set(naves[indiceNave]!.colores.casco)));
      if (malla.instanceColor !== null) malla.instanceColor.needsUpdate = true;
      this.cascos.set(tipo, { malla, indices });
      this.raiz.add(malla);
      this.aDestruir.push(geo);
    }

    // -- [R-311] Velas con su palo: le dan silueta a la barca a cincuenta metros
    const geoVela = geometriaDeVela();
    const franjasVela = new Float32Array(naves.length * 3);
    naves.forEach((n, i) => color.set(n.colores.franja).toArray(franjasVela, i * 3));
    geoVela.setAttribute('colorFranja', new InstancedBufferAttribute(franjasVela, 3));
    const matVela = materialDeVela(new ColorTres(paleta.madera));
    this.velas = new InstancedMesh(geoVela, matVela, naves.length);
    this.velas.frustumCulled = false;
    this.velas.castShadow = true;
    naves.forEach((n, i) => this.velas.setColorAt(i, color.set(n.colores.vela)));
    if (this.velas.instanceColor !== null) this.velas.instanceColor.needsUpdate = true;
    this.raiz.add(this.velas);
    this.aDestruir.push(geoVela, matVela);

    // -- Remos: todos los de todas las barcas en UNA malla -----------------
    const geoRemo = geometriaDeRemo();
    const matRemo = materialDeRemo();
    matRemo.color.set(paleta.madera);
    this.remos = new InstancedMesh(geoRemo, matRemo, naves.length * REMOS_POR_COSTADO * 2);
    this.remos.frustumCulled = false;
    this.remos.castShadow = true;
    // [R-310] La pala, del color de la franja: se sabe de quién es cada remo.
    naves.forEach((n, i) => {
      for (let k = 0; k < REMOS_POR_COSTADO * 2; k++) this.remos.setColorAt(i * REMOS_POR_COSTADO * 2 + k, color.set(n.colores.franja));
    });
    if (this.remos.instanceColor !== null) this.remos.instanceColor.needsUpdate = true;
    this.raiz.add(this.remos);
    this.aDestruir.push(geoRemo, matRemo);

    // -- [R-307] Remeros: todos en UNA malla, con la camiseta de la franja --
    const geoRemero = geometriaDeRemero();
    const matRemero = materialDeRemero(new ColorTres(paleta.piel));
    this.remeros = new InstancedMesh(geoRemero, matRemero, naves.length * REMOS_POR_COSTADO);
    this.remeros.frustumCulled = false;
    this.remeros.castShadow = true;
    this.remeros.receiveShadow = true;
    naves.forEach((n, i) => {
      for (let p = 0; p < REMOS_POR_COSTADO; p++) {
        this.remeros.setColorAt(i * REMOS_POR_COSTADO + p, color.set(n.colores.franja));
      }
    });
    if (this.remeros.instanceColor !== null) this.remeros.instanceColor.needsUpdate = true;
    this.raiz.add(this.remeros);
    this.aDestruir.push(geoRemero, matRemero);

    // -- [R-209] Toda la estela en una malla -------------------------------
    this.geoEstela = new BufferGeometry();
    const vertices = naves.length * PUNTOS_ESTELA * 2;
    this.geoEstela.setAttribute('position', new BufferAttribute(new Float32Array(vertices * 3), 3));
    this.geoEstela.setAttribute('vida', new BufferAttribute(new Float32Array(vertices), 1));
    const lados = new Float32Array(vertices);
    for (let v = 0; v < vertices; v++) lados[v] = v % 2 === 0 ? 1 : -1;
    this.geoEstela.setAttribute('lado', new BufferAttribute(lados, 1));
    const indices: number[] = [];
    for (let b = 0; b < naves.length; b++) {
      const base = b * PUNTOS_ESTELA * 2;
      for (let i = 0; i < PUNTOS_ESTELA - 1; i++) {
        const a = base + i * 2;
        indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
      }
    }
    this.geoEstela.setIndex(indices);
    this.matEstela = materialDeEstela(new ColorTres(paleta.espuma));
    this.estela = new Mesh(this.geoEstela, this.matEstela);
    this.estela.frustumCulled = false;
    this.estela.renderOrder = 1;
    this.raiz.add(this.estela);
    this.aDestruir.push(this.geoEstela, this.matEstela);
  }

  /**
   * [R-301] Coloca las ocho barcas SOBRE el agua, con el cabeceo y el balanceo
   * sacados de la pendiente de la ola. Con un agua plana el cabeceo era 0,0° y
   * la barca se leía como un icono deslizándose por un fondo (`DR1`).
   */
  actualizar(
    naves: readonly Nave[],
    trazado: Trazado,
    tiempo: number,
    oleaje: number,
    dt: number,
  ): void {
    const m = new Matrix4();
    const mCasco = new Matrix4();
    const q = new Quaternion();
    const qCasco = new Quaternion();
    const qInclina = new Quaternion();
    const e = new Euler();
    const sitio = new Vector3();
    const punto = new Vector3();
    const escala = new Vector3();
    const uno = new Vector3(1, 1, 1);
    const ejeX = new Vector3(1, 0, 0);
    const ejeY = new Vector3(0, 1, 0);
    let remo = 0;
    this.ultimaOla = { tiempo, oleaje };

    for (const [, grupo] of this.cascos) {
      grupo.indices.forEach((i, k) => {
        const nave = naves[i];
        if (nave === undefined) return;
        const sitio3 = this.situar(nave, trazado, tiempo, oleaje);
        // Un giro POSITIVO en X baja la proa (+Z), y `cabeceo` es positivo con
        // la proa ARRIBA: por eso va con el signo cambiado. Con el signo de
        // serie las barcas cabeceaban al revés que la ola que tenían debajo.
        e.set(-sitio3.cabeceo, sitio3.rumbo, sitio3.balanceo, 'YXZ');
        qCasco.setFromEuler(e);
        // [R-305] El calado sube con el desplazamiento: una barca cargada va
        // más metida en el agua, y se ve.
        //
        // El casco unitario tiene la QUILLA en y = −1 y la BORDA en y = 0, así
        // que el origen del objeto es la borda. Para que la línea de flotación
        // corte el casco a la altura que toca hay que SUBIRLO
        // `puntal·(1 − calado)`, no bajarlo `puntal·calado`: bajándolo, la
        // cubierta quedaba por debajo del agua y de las ocho barcas solo se
        // veían las velas y los remos, como aletas saliendo del mar.
        const casco = nave.barca.casco;
        const puntal = nave.barca.manga * 0.55;
        const calado = caladoDe(nave.barca.masa);
        sitio.set(sitio3.x, sitio3.y + puntal * (1 - calado), sitio3.z);
        escala.set(nave.barca.manga, puntal, nave.barca.eslora);
        mCasco.compose(sitio, qCasco, escala);
        grupo.malla.setMatrixAt(k, mCasco);
        // Un punto del casco unitario, llevado al mundo con la barca: así el
        // remero se sienta en SU bancada y el palo sale de SU sitio aunque la
        // ola la cabecee.
        const aMundo = (x: number, y: number, z: number): Vector3 => punto.set(x, y, z).applyMatrix4(mCasco);

        // [R-311] El palo, plantado en crujía, y la vela cazada a sotavento: se
        // abre del plano de crujía, así que también se ve desde popa.
        const relativo = sitio3.rumbo - VIENTO;
        const banda = Math.sin(relativo) >= 0 ? 1 : -1;
        const escota = banda * (0.32 + 0.38 * (0.5 + 0.5 * Math.cos(relativo)));
        this.escotas[i] = escota;
        const alto = Math.max(2, nave.barca.eslora * 0.3);
        const palo = seccion(casco, T_PALO);
        aMundo(0, palo.borda, T_PALO - 0.5);
        q.setFromAxisAngle(ejeY, escota).premultiply(qCasco);
        // La panza va a sotavento: si la botavara sale a babor, la vela se
        // refleja. El material es de dos caras, así que la luz no se entera.
        escala.set(escota > 0 ? -alto : alto, alto, alto);
        m.compose(punto, q, escala);
        this.velas.setMatrixAt(i, m);

        // [R-304] Los remos van con el empuje pedido, no con el reloj: a gas 0
        // se quedan quietos.
        const gas = Math.min(1, nave.gas);
        this.fases[i] = (this.fases[i] ?? 0) + dt * (2.4 + nave.velocidad * 0.9) * gas;
        const largo = nave.barca.manga * 0.85 + 1.3;
        for (let p = 0; p < REMOS_POR_COSTADO; p++) {
          // [R-310] La palada: de `fase` 0 a π la pala barre de proa a popa
          // DENTRO del agua; de π a 2π vuelve por el aire, de plano.
          const fase = this.fases[i]! + p * 0.35;
          const barrido = -Math.cos(fase) * 0.5 * gas;
          const enAgua = Math.min(1, Math.max(0, Math.sin(fase) * 3 + 0.6));
          const tTolete = BANCADAS[p]! - TOLETE_A_POPA / nave.barca.eslora;
          const tolete = seccion(casco, tTolete);
          for (const lado of [-1, 1]) {
            const pivote = aMundo(lado * tolete.semi, tolete.borda, tTolete - 0.5);
            // [R-310] Lo justo para que la pala entre en el agua: se mide la
            // altura del tolete sobre la ola, no se supone.
            const sobreAgua = pivote.y - alturaDeOla(pivote.x, pivote.z, tiempo, oleaje);
            const hundir = Math.asin(Math.min(0.95, Math.max(0.05, (sobreAgua + 0.08) / (largo * 0.86))));
            e.set(
              (Math.PI / 2) * (1 - enAgua),
              (lado > 0 ? 0 : Math.PI) + lado * barrido,
              -(hundir - 0.2 * (1 - enAgua)),
              'YZX',
            );
            q.setFromEuler(e).premultiply(qCasco);
            escala.set(largo, 1, 1);
            m.compose(pivote, q, escala);
            this.remos.setMatrixAt(remo++, m);
          }

          // [R-307] [R-310] El remero, sentado en su bancada, mirando a popa
          // como se rema: se echa hacia delante al meter la pala y atrás al
          // sacarla.
          const asiento = asientoDe(casco, p);
          q.setFromAxisAngle(ejeY, Math.PI).premultiply(qCasco);
          qInclina.setFromAxisAngle(ejeX, 0.32 * Math.cos(fase) * gas);
          q.multiply(qInclina);
          m.compose(aMundo(0, asiento.y, asiento.z), q, uno);
          this.remeros.setMatrixAt(i * REMOS_POR_COSTADO + p, m);
        }

        // [R-209] La estela va por DISTANCIA: la cabeza sigue a la barca y se
        // planta un punto nuevo cada `PASO_ESTELA` metros. Por fotograma, a
        // 60 fps los 24 puntos de antes eran 0,4 s de estela.
        const rastro = this.rastros[i]!;
        const fuerza = Math.min(1, nave.velocidad / 5.5);
        for (const r of rastro) r.edad += dt;
        const cabeza = rastro[0];
        const segundo = rastro[1];
        if (cabeza === undefined || segundo === undefined || Math.hypot(cabeza.x - segundo.x, cabeza.z - segundo.z) >= PASO_ESTELA) {
          rastro.unshift({ x: sitio3.x, z: sitio3.z, edad: 0, fuerza });
        } else {
          cabeza.x = sitio3.x;
          cabeza.z = sitio3.z;
          cabeza.edad = 0;
          cabeza.fuerza = fuerza;
        }
        if (rastro.length > PUNTOS_ESTELA) rastro.length = PUNTOS_ESTELA;
      });
      grupo.malla.instanceMatrix.needsUpdate = true;
    }
    // Los remos que sobren, fuera de la vista.
    m.makeScale(0, 0, 0);
    for (let i = remo; i < this.remos.count; i++) this.remos.setMatrixAt(i, m);
    this.velas.instanceMatrix.needsUpdate = true;
    this.remos.instanceMatrix.needsUpdate = true;
    this.remeros.instanceMatrix.needsUpdate = true;
    this.matEstela.uniforms.tiempo!.value = tiempo;
    this.reconstruirEstela(naves, tiempo, oleaje);
  }

  /** Dónde está una barca en el mundo, y cómo la inclina la ola. */
  private situar(
    nave: Nave,
    trazado: Trazado,
    tiempo: number,
    oleaje: number,
  ): { x: number; y: number; z: number; rumbo: number; cabeceo: number; balanceo: number } {
    const p = puntoEn(trazado, nave.metros);
    const rumbo = rumboEn(trazado, nave.metros);
    const anchura = anchuraEn(trazado, nave.metros);
    const carriles = Math.max(2, Math.floor(anchura / 4.5));
    // [B-303] El cambio de carril dura 1,2 s: se interpola, o la barca se
    // teletransportaría de lado.
    const avance = nave.cambiando > 0 ? 1 - nave.cambiando / 1.2 : 1;
    const carril = nave.cambiando > 0 ? nave.carril + (nave.carrilDestino - nave.carril) * avance : nave.carril;
    const lateral = lateralDe(carril, carriles, anchura);
    const x = p.x + Math.cos(rumbo) * lateral;
    const z = p.z - Math.sin(rumbo) * lateral;
    const y = alturaDeOla(x, z, tiempo, oleaje);
    const { cabeceo, balanceo } = inclinacionEn(x, z, rumbo, nave.barca.eslora, nave.barca.manga, tiempo, oleaje);
    return { x, y, z, rumbo, cabeceo: cabeceo * 0.85, balanceo: balanceo * 0.7 };
  }

  private reconstruirEstela(naves: readonly Nave[], tiempo: number, oleaje: number): void {
    const pos = this.geoEstela.getAttribute('position') as BufferAttribute;
    const vida = this.geoEstela.getAttribute('vida') as BufferAttribute;
    for (let b = 0; b < this.rastros.length; b++) {
      const rastro = this.rastros[b]!;
      const manga = naves[b]?.barca.manga ?? 2;
      // [R-209] El último punto bueno. Un punto sin rastro se PLIEGA sobre él
      // con vida 0: triángulo de área nula, invisible. Antes se mandaba a
      // y = −9999 y la tira lo unía con los buenos: un triángulo blanco
      // cruzando media pantalla (`DR8`).
      let ultimoX = rastro[0]?.x ?? 0;
      let ultimoZ = rastro[0]?.z ?? 0;
      let ultimoY = alturaDeOla(ultimoX, ultimoZ, tiempo, oleaje);
      for (let i = 0; i < PUNTOS_ESTELA; i++) {
        const r = rastro[i];
        const base = (b * PUNTOS_ESTELA + i) * 2;
        if (r === undefined || r.edad > VIDA_ESTELA) {
          pos.setXYZ(base, ultimoX, ultimoY, ultimoZ);
          pos.setXYZ(base + 1, ultimoX, ultimoY, ultimoZ);
          vida.setX(base, 0);
          vida.setX(base + 1, 0);
          continue;
        }
        const siguiente = rastro[i + 1] ?? r;
        const anterior = rastro[Math.max(0, i - 1)]!;
        const dx = anterior.x - siguiente.x;
        const dz = anterior.z - siguiente.z;
        const largo = Math.hypot(dx, dz) || 1;
        // Se abre con la edad —una V, no una línea—, pero con tope: sin él, a
        // tres segundos la estela medía quince metros de ancho y tapaba la regata.
        const ancho = Math.min(manga * 1.1, manga * (0.3 + r.edad * 0.35)) * Math.max(0.15, r.fuerza);
        const nx = (-dz / largo) * ancho;
        const nz = (dx / largo) * ancho;
        const y = alturaDeOla(r.x, r.z, tiempo, oleaje) + 0.06;
        pos.setXYZ(base, r.x + nx, y, r.z + nz);
        pos.setXYZ(base + 1, r.x - nx, y, r.z - nz);
        const brillo = Math.max(0, 1 - r.edad / VIDA_ESTELA) * r.fuerza;
        vida.setX(base, brillo);
        vida.setX(base + 1, brillo);
        ultimoX = r.x;
        ultimoZ = r.z;
        ultimoY = y;
      }
    }
    pos.needsUpdate = true;
    vida.needsUpdate = true;
  }

  /** [R-209] Para los tests: las posiciones de la tira de estela. */
  verticesDeEstela(): Float32Array {
    return (this.geoEstela.getAttribute('position') as BufferAttribute).array as Float32Array;
  }

  /** [R-311] Para los tests: el ángulo de cada vela con el plano de crujía. */
  angulosDeEscota(): readonly number[] {
    return this.escotas;
  }

  /**
   * [R-310] Para los tests: cuánto está cada pala por DEBAJO de la ola que
   * tiene encima, en metros (negativo: en el aire).
   */
  hundimientoDePalas(): number[] {
    const m = new Matrix4();
    const p = new Vector3();
    const fuera: number[] = [];
    for (let i = 0; i < this.remos.count; i++) {
      this.remos.getMatrixAt(i, m);
      p.set(0.86, 0, 0).applyMatrix4(m);
      fuera.push(alturaDeOla(p.x, p.z, this.ultimaOla.tiempo, this.ultimaOla.oleaje) - p.y);
    }
    return fuera;
  }

  /** [R-302] Para los tests y el diagnóstico: cuántas mallas dibuja la flota. */
  mallas(): number {
    let n = 0;
    this.raiz.traverse((o) => {
      if ((o as Mesh).isMesh === true) n++;
    });
    return n;
  }

  /** [R-603] Con el equipo justo, la estela es lo primero que sobra. */
  apagarEstela(): void {
    this.estela.visible = false;
  }

  destruir(): void {
    for (const cosa of this.aDestruir) cosa.dispose();
  }
}
