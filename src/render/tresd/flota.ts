// [R-3xx] Las ocho barcas en escena, y su estela.
//
// [R-302] Las ocho lanchas en UNA malla instanciada y la estela en otra: dos
// llamadas de dibujo para la flota entera. La primera versión daba una malla
// propia a cada barca —casco, franja y dos mallas por remo— y se plantaba en
// 48 llamadas y 22 fps en gama media (`DR2`).

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color as ColorTres,
  Euler,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from 'three';
import type { Nave } from '../../engine/tipos.ts';
import type { Paleta } from '../paleta.ts';
import { alturaDeOla, inclinacionEn } from './agua.ts';
import { caladoDe, geometriaDeCasco, pintarPorInstancia, trimaDeProa } from './barca.ts';
import { MODELO, PUNTAL_POR_MANGA } from './modelos.ts';
import { anchuraEn, lateralDe, puntoEn, rumboEn, type Trazado } from './trazado.ts';

/** [R-204] Puntos de la tira de estela. */
const PUNTOS_ESTELA = 24;
/** Segundos que tarda la estela en deshacerse. */
const VIDA_ESTELA = 3;

interface Rastro {
  x: number;
  z: number;
  edad: number;
  fuerza: number;
}

export class Flota {
  readonly raiz = new Object3D();
  private readonly lanchas: InstancedMesh;
  private readonly estela: Mesh;
  private readonly geoEstela: BufferGeometry;
  private readonly aDestruir: { dispose(): void }[] = [];
  private readonly rastros: Rastro[][] = [];

  constructor(naves: readonly Nave[], paleta: Paleta) {
    for (const _ of naves) this.rastros.push([]);

    // -- [R-302] [R-303] Las ocho lanchas, instanciadas --------------------
    const geo = geometriaDeCasco();
    // [R-306] Casco en `instanceColor`, franja en un atributo instanciado.
    const franjas = new InstancedBufferAttribute(new Float32Array(naves.length * 3), 3);
    geo.setAttribute('franja', franjas);
    const mat = new MeshStandardMaterial({ roughness: 0.52, metalness: 0.04, flatShading: true, vertexColors: true });
    pintarPorInstancia(mat);
    this.lanchas = new InstancedMesh(geo, mat, naves.length);
    this.lanchas.castShadow = true;
    this.lanchas.frustumCulled = false;
    const color = new ColorTres();
    naves.forEach((n, i) => {
      this.lanchas.setColorAt(i, color.set(n.colores.casco));
      color.set(n.colores.franja);
      franjas.setXYZ(i, color.r, color.g, color.b);
    });
    if (this.lanchas.instanceColor !== null) this.lanchas.instanceColor.needsUpdate = true;
    this.raiz.add(this.lanchas);
    this.aDestruir.push(geo, mat);

    // -- [R-204] Toda la estela en una malla -------------------------------
    this.geoEstela = new BufferGeometry();
    const vertices = naves.length * PUNTOS_ESTELA * 2;
    this.geoEstela.setAttribute('position', new BufferAttribute(new Float32Array(vertices * 3), 3));
    this.geoEstela.setAttribute('color', new BufferAttribute(new Float32Array(vertices * 3), 3));
    const indices: number[] = [];
    for (let b = 0; b < naves.length; b++) {
      const base = b * PUNTOS_ESTELA * 2;
      for (let i = 0; i < PUNTOS_ESTELA - 1; i++) {
        const a = base + i * 2;
        indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
      }
    }
    this.geoEstela.setIndex(indices);
    const matEstela = new MeshBasicMaterial({
      color: new ColorTres(paleta.espuma),
      vertexColors: true,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.estela = new Mesh(this.geoEstela, matEstela);
    this.estela.frustumCulled = false;
    this.raiz.add(this.estela);
    this.aDestruir.push(this.geoEstela, matEstela);
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

    naves.forEach((nave, i) => {
      const sitio3 = this.situar(nave, trazado, tiempo, oleaje);
      // [R-304] La trima levanta la proa. Girar en X con ángulo positivo baja
      // el +Z (la proa), así que se resta.
      e.set(sitio3.cabeceo - trimaDeProa(nave.gas, nave.velocidad), sitio3.rumbo, sitio3.balanceo, 'YXZ');
      q.setFromEuler(e);
      // [R-305] El calado sube con el desplazamiento: una barca cargada va
      // más metida en el agua, y se ve.
      //
      // La lancha unitaria tiene la QUILLA en y = `quilla` y la REGALA en
      // y = 0, así que el origen del objeto es la regala. Para que la línea de
      // flotación corte el casco a la altura que toca hay que SUBIRLA
      // `puntal·|quilla|·(1 − calado)`, no bajarla `puntal·calado`: bajándola,
      // la cubierta quedaba por debajo del agua. [R-303] La quilla es la del
      // modelo, no una constante: con −1 fijo, la lancha iba volando por
      // encima del agua.
      const puntal = nave.barca.manga * PUNTAL_POR_MANGA;
      const alzado = puntal * -MODELO.quilla * (1 - caladoDe(nave.barca.masa));
      sitio.set(sitio3.x, sitio3.y + alzado, sitio3.z);
      escala.set(nave.barca.manga, puntal, nave.barca.eslora);
      m.compose(sitio, q, escala);
      this.lanchas.setMatrixAt(i, m);

      // [R-204] La estela: un punto por fotograma, y se envejecen.
      const rastro = this.rastros[i]!;
      rastro.unshift({ x: sitio3.x, z: sitio3.z, edad: 0, fuerza: Math.min(1, nave.velocidad / 5.5) });
      if (rastro.length > PUNTOS_ESTELA) rastro.length = PUNTOS_ESTELA;
      for (const r of rastro) r.edad += dt;
    });
    this.lanchas.instanceMatrix.needsUpdate = true;
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
    const col = this.geoEstela.getAttribute('color') as BufferAttribute;
    for (let b = 0; b < this.rastros.length; b++) {
      const rastro = this.rastros[b]!;
      const manga = naves[b]?.barca.manga ?? 2;
      for (let i = 0; i < PUNTOS_ESTELA; i++) {
        const r = rastro[i];
        const base = (b * PUNTOS_ESTELA + i) * 2;
        if (r === undefined || r.edad > VIDA_ESTELA) {
          pos.setXYZ(base, 0, -9999, 0);
          pos.setXYZ(base + 1, 0, -9999, 0);
          continue;
        }
        const anterior = rastro[Math.max(0, i - 1)]!;
        const dx = r.x - anterior.x;
        const dz = r.z - anterior.z;
        const largo = Math.hypot(dx, dz) || 1;
        // La estela se abre con la edad: una V, no una línea.
        // Se abre con la edad, pero con tope: sin él, a tres segundos la
        // estela medía quince metros de ancho y tapaba la regata.
        const ancho = Math.min(manga * 1.6, manga * (0.3 + r.edad * 0.45)) * r.fuerza;
        const nx = (-dz / largo) * ancho;
        const nz = (dx / largo) * ancho;
        const y = alturaDeOla(r.x, r.z, tiempo, oleaje) + 0.07;
        pos.setXYZ(base, r.x + nx, y, r.z + nz);
        pos.setXYZ(base + 1, r.x - nx, y, r.z - nz);
        const brillo = Math.max(0, 1 - r.edad / VIDA_ESTELA) * r.fuerza;
        col.setXYZ(base, brillo, brillo, brillo);
        col.setXYZ(base + 1, brillo, brillo, brillo);
      }
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }

  /** [R-603] Con el equipo justo, la estela es lo primero que sobra. */
  apagarEstela(): void {
    this.estela.visible = false;
  }

  destruir(): void {
    for (const cosa of this.aDestruir) cosa.dispose();
  }
}
