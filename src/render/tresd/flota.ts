// [R-3xx] Las ocho barcas en escena, y su estela.
//
// [R-302] Una malla INSTANCIADA por tipo de casco, una para las velas, una
// para todos los remos y una para la estela: cinco llamadas de dibujo para la
// flota entera. La primera versión daba una malla propia a cada barca —casco,
// franja y dos mallas por remo— y se plantaba en 48 llamadas y 22 fps en gama
// media (`DR2`).

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color as ColorTres,
  DoubleSide,
  Euler,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from 'three';
import type { Nave, TipoCasco } from '../../engine/tipos.ts';
import type { Paleta } from '../paleta.ts';
import { alturaDeOla, inclinacionEn } from './agua.ts';
import { geometriaDeCasco, geometriaDeRemo, geometriaDeVela } from './barca.ts';
import { anchuraEn, lateralDe, puntoEn, rumboEn, type Trazado } from './trazado.ts';

/** [R-204] Puntos de la tira de estela. */
const PUNTOS_ESTELA = 24;
/** Segundos que tarda la estela en deshacerse. */
const VIDA_ESTELA = 3;
/** Remos por costado. Los mismos para todas: lo que cambia es si se mueven. */
const REMOS_POR_COSTADO = 3;

interface Rastro {
  x: number;
  z: number;
  edad: number;
  fuerza: number;
}

export class Flota {
  readonly raiz = new Object3D();
  private readonly cascos = new Map<TipoCasco, { malla: InstancedMesh; indices: number[] }>();
  private readonly velas: InstancedMesh;
  private readonly remos: InstancedMesh;
  private readonly estela: Mesh;
  private readonly geoEstela: BufferGeometry;
  private readonly aDestruir: { dispose(): void }[] = [];
  private readonly rastros: Rastro[][] = [];
  private readonly fases: number[];

  constructor(naves: readonly Nave[], paleta: Paleta) {
    this.fases = naves.map(() => 0);
    for (const _ of naves) this.rastros.push([]);

    // -- Un casco instanciado por tipo [R-302] -----------------------------
    for (const tipo of ['desplazamiento', 'planeador'] as TipoCasco[]) {
      const indices = naves.map((n, i) => (n.barca.casco === tipo ? i : -1)).filter((i) => i >= 0);
      if (indices.length === 0) continue;
      const geo = geometriaDeCasco(tipo);
      const mat = new MeshStandardMaterial({ roughness: 0.52, metalness: 0.04, flatShading: true });
      const malla = new InstancedMesh(geo, mat, indices.length);
      malla.castShadow = true;
      malla.frustumCulled = false;
      const color = new ColorTres();
      indices.forEach((indiceNave, k) => malla.setColorAt(k, color.set(naves[indiceNave]!.colores.casco)));
      if (malla.instanceColor !== null) malla.instanceColor.needsUpdate = true;
      this.cascos.set(tipo, { malla, indices });
      this.raiz.add(malla);
      this.aDestruir.push(geo, mat);
    }

    // -- Velas: le dan silueta a la barca a cincuenta metros ---------------
    const geoVela = geometriaDeVela();
    const matVela = new MeshStandardMaterial({ roughness: 0.85, side: DoubleSide, flatShading: true });
    this.velas = new InstancedMesh(geoVela, matVela, naves.length);
    this.velas.frustumCulled = false;
    this.velas.castShadow = true;
    const color = new ColorTres();
    naves.forEach((n, i) => this.velas.setColorAt(i, color.set(n.colores.vela)));
    if (this.velas.instanceColor !== null) this.velas.instanceColor.needsUpdate = true;
    this.raiz.add(this.velas);
    this.aDestruir.push(geoVela, matVela);

    // -- Remos: todos los de todas las barcas en UNA malla -----------------
    const geoRemo = geometriaDeRemo();
    const matRemo = new MeshStandardMaterial({ color: new ColorTres(paleta.costa), roughness: 0.75, flatShading: true });
    this.remos = new InstancedMesh(geoRemo, matRemo, naves.length * REMOS_POR_COSTADO * 2);
    this.remos.frustumCulled = false;
    this.raiz.add(this.remos);
    this.aDestruir.push(geoRemo, matRemo);

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
    let remo = 0;

    for (const [, grupo] of this.cascos) {
      grupo.indices.forEach((i, k) => {
        const nave = naves[i];
        if (nave === undefined) return;
        const sitio3 = this.situar(nave, trazado, tiempo, oleaje);
        e.set(sitio3.cabeceo, sitio3.rumbo, sitio3.balanceo, 'YXZ');
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
            const largo = nave.barca.manga * 0.72;
            // El remo sale del costado hacia fuera y hacia abajo.
            e.set(boga * 0.5, sitio3.rumbo + (lado > 0 ? 0 : Math.PI), -0.35 + boga);
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
        }

        // [R-204] La estela: un punto por fotograma, y se envejecen.
        const rastro = this.rastros[i]!;
        rastro.unshift({ x: sitio3.x, z: sitio3.z, edad: 0, fuerza: Math.min(1, nave.velocidad / 5.5) });
        if (rastro.length > PUNTOS_ESTELA) rastro.length = PUNTOS_ESTELA;
        for (const r of rastro) r.edad += dt;
      });
      grupo.malla.instanceMatrix.needsUpdate = true;
    }
    // Los remos que sobren, fuera de la vista.
    m.makeScale(0, 0, 0);
    for (let i = remo; i < this.remos.count; i++) this.remos.setMatrixAt(i, m);
    this.velas.instanceMatrix.needsUpdate = true;
    this.remos.instanceMatrix.needsUpdate = true;
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
