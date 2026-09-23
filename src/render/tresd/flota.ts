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
import { geometriaDeCasco, geometriaDeRemero, geometriaDeRemo, geometriaDeVela, ZONA_FRANJA } from './barca.ts';
import { anchuraEn, lateralDe, puntoEn, rumboEn, type Trazado } from './trazado.ts';

/** [R-209] Puntos de la tira de estela por barca. */
const PUNTOS_ESTELA = 34;
/** [R-209] Metros entre dos puntos de estela. Por distancia, no por fotograma. */
const PASO_ESTELA = 0.8;
/** Segundos que tarda la estela en deshacerse. */
const VIDA_ESTELA = 3;
/** Remos por costado, y remeros por barca: uno por bancada. */
const REMOS_POR_COSTADO = 3;

interface Rastro {
  x: number;
  z: number;
  edad: number;
  fuerza: number;
}

/**
 * [R-306] El material del casco: el color del casco por instancia (el de
 * serie de three), la franja por instancia (atributo propio) y la madera de la
 * cubierta, con tablas, de la paleta.
 */
function materialDeCasco(madera: ColorTres): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({ roughness: 0.45, metalness: 0.02 });
  mat.onBeforeCompile = (sombreador) => {
    sombreador.uniforms.colorMadera = { value: madera };
    sombreador.vertexShader = sombreador.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float zona;
        attribute vec3 colorFranja;
        varying float vZona;
        varying vec3 vFranja;
        varying vec3 vLocal;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vZona = zona;
        vFranja = colorFranja;
        vLocal = position;`,
      );
    sombreador.fragmentShader = sombreador.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 colorMadera;
        varying float vZona;
        varying vec3 vFranja;
        varying vec3 vLocal;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        if (vZona > 1.5) {
          float tabla = fract(vLocal.x * 9.0);
          float junta = smoothstep(0.0, 0.07, tabla) * smoothstep(1.0, 0.93, tabla);
          diffuseColor.rgb = colorMadera * (0.62 + 0.38 * junta);
        } else if (vZona > ${ZONA_FRANJA.toFixed(2)}) {
          diffuseColor.rgb = vFranja;
        }`,
      );
  };
  mat.customProgramCacheKey = () => 'casco-r306';
  return mat;
}

/** [R-307] El remero: camiseta del color de la franja (por instancia) y cara de la paleta. */
function materialDeRemero(piel: ColorTres): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({ roughness: 0.8, flatShading: true });
  mat.onBeforeCompile = (sombreador) => {
    sombreador.uniforms.colorPiel = { value: piel };
    sombreador.vertexShader = sombreador.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float piel;\nvarying float vPiel;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPiel = piel;');
    sombreador.fragmentShader = sombreador.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 colorPiel;\nvarying float vPiel;')
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, colorPiel, step(0.5, vPiel));',
      );
  };
  mat.customProgramCacheKey = () => 'remero-r307';
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

  constructor(naves: readonly Nave[], paleta: Paleta) {
    this.fases = naves.map(() => 0);
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

    // -- Velas: le dan silueta a la barca a cincuenta metros ---------------
    const geoVela = geometriaDeVela();
    const matVela = new MeshStandardMaterial({ roughness: 0.9, side: DoubleSide });
    this.velas = new InstancedMesh(geoVela, matVela, naves.length);
    this.velas.frustumCulled = false;
    this.velas.castShadow = true;
    naves.forEach((n, i) => this.velas.setColorAt(i, color.set(n.colores.vela)));
    if (this.velas.instanceColor !== null) this.velas.instanceColor.needsUpdate = true;
    this.raiz.add(this.velas);
    this.aDestruir.push(geoVela, matVela);

    // -- Remos: todos los de todas las barcas en UNA malla -----------------
    const geoRemo = geometriaDeRemo();
    const matRemo = new MeshStandardMaterial({ color: new ColorTres(paleta.madera), roughness: 0.6 });
    this.remos = new InstancedMesh(geoRemo, matRemo, naves.length * REMOS_POR_COSTADO * 2);
    this.remos.frustumCulled = false;
    this.remos.castShadow = true;
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
    const q = new Quaternion();
    const e = new Euler();
    const sitio = new Vector3();
    const escala = new Vector3();
    const uno = new Vector3(1, 1, 1);
    let remo = 0;

    for (const [, grupo] of this.cascos) {
      grupo.indices.forEach((i, k) => {
        const nave = naves[i];
        if (nave === undefined) return;
        const sitio3 = this.situar(nave, trazado, tiempo, oleaje);
        // Un giro POSITIVO en X baja la proa (+Z), y `cabeceo` es positivo con
        // la proa ARRIBA: por eso va con el signo cambiado. Con el signo de
        // serie las barcas cabeceaban al revés que la ola que tenían debajo.
        e.set(-sitio3.cabeceo, sitio3.rumbo, sitio3.balanceo, 'YXZ');
        q.setFromEuler(e);
        // [R-305] El calado sube con el desplazamiento: una barca cargada va
        // más metida en el agua, y se ve.
        //
        // El casco unitario tiene la QUILLA en y = −1 y la CUBIERTA en y = 0,
        // así que el origen del objeto es la cubierta. Para que la línea de
        // flotación corte el casco a la altura que toca hay que SUBIRLO
        // `puntal·(1 − calado)`, no bajarlo `puntal·calado`: bajándolo, la
        // cubierta quedaba por debajo del agua y de las ocho barcas solo se
        // veían las velas y los remos, como aletas saliendo del mar.
        const puntal = nave.barca.manga * 0.55;
        const calado = 0.3 + Math.min(0.32, (nave.barca.masa - 500) / 3200);
        sitio.set(sitio3.x, sitio3.y + puntal * (1 - calado), sitio3.z);
        escala.set(nave.barca.manga, puntal, nave.barca.eslora);
        m.compose(sitio, q, escala);
        grupo.malla.setMatrixAt(k, m);

        // La vela, plantada un poco por delante del centro.
        const alto = Math.max(1.6, nave.barca.eslora * 0.26);
        const cubierta = sitio3.y + puntal * (1 - calado);
        sitio.set(
          sitio3.x + Math.sin(sitio3.rumbo) * nave.barca.eslora * 0.1,
          cubierta,
          sitio3.z + Math.cos(sitio3.rumbo) * nave.barca.eslora * 0.1,
        );
        escala.set(1, alto, alto);
        m.compose(sitio, q, escala);
        this.velas.setMatrixAt(i, m);

        // [R-304] Los remos van con el empuje pedido, no con el reloj: a gas 0
        // se quedan quietos.
        this.fases[i] = (this.fases[i] ?? 0) + dt * (2.4 + nave.velocidad * 0.9) * Math.min(1, nave.gas);
        const fase = this.fases[i]!;
        for (let p = 0; p < REMOS_POR_COSTADO; p++) {
          const z = nave.barca.eslora * (0.22 - (p / REMOS_POR_COSTADO) * 0.42);
          const boga = Math.sin(fase + p * 0.5) * 0.45 * Math.min(1, nave.gas);
          for (const lado of [-1, 1]) {
            const largo = nave.barca.manga * 0.72 + 0.6;
            // El remo sale del costado hacia fuera y hacia abajo.
            e.set(boga * 0.5, sitio3.rumbo + (lado > 0 ? 0 : Math.PI), -0.35 + boga, 'YXZ');
            q.setFromEuler(e);
            const costado = nave.barca.manga * 0.45 * lado;
            sitio.set(
              sitio3.x + Math.cos(sitio3.rumbo) * costado + Math.sin(sitio3.rumbo) * z,
              cubierta + 0.12,
              sitio3.z - Math.sin(sitio3.rumbo) * costado + Math.cos(sitio3.rumbo) * z,
            );
            escala.set(largo, 1, 1);
            m.compose(sitio, q, escala);
            this.remos.setMatrixAt(remo++, m);
          }

          // [R-307] El remero de esa bancada, mirando a popa como se rema, y
          // echándose atrás con la boga.
          e.set(sitio3.cabeceo - boga * 0.9, sitio3.rumbo + Math.PI, -sitio3.balanceo, 'YXZ');
          q.setFromEuler(e);
          sitio.set(
            sitio3.x + Math.sin(sitio3.rumbo) * (z - 0.35),
            cubierta - 0.12,
            sitio3.z + Math.cos(sitio3.rumbo) * (z - 0.35),
          );
          m.compose(sitio, q, uno);
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
