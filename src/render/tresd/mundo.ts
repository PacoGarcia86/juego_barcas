// [R-4xx] El mundo alrededor del agua: luz, niebla, costa, islas, boyas y huevos.
//
// Todo se coloca con `posicionEn` del trazado [R-402]: nada de coordenadas
// escritas a mano. Y todo el color sale de la paleta [R-401].
//
// El cielo ya no vive aquí: es un sombreador propio (`cielo.ts`) porque el
// agua tiene que reflejar el mismo [R-406].

import {
  BufferAttribute,
  BufferGeometry,
  Color as ColorTres,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
} from 'three';
import type { Circuito, Huevo } from '../../engine/tipos.ts';
import { direccionDelSol, type Paleta } from '../paleta.ts';
import { anchuraEn, posicionEn, puntoEn, rumboEn, type Trazado } from './trazado.ts';
import { alturaDeOla } from './agua.ts';

/** Semilla de la costa: mismo circuito ⇒ misma costa [R-404]. */
function semillaDe(texto: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** [R-506] Media caja de la cámara de sombras, en metros alrededor de la barca seguida. */
const CAJA_SOMBRA = 45;
/** Islas por circuito. */
const ISLAS = 90;
/** [R-407] Radio máximo de una isla unitaria con su ruido y su falda: 1,1 · (1 + 0,215). */
export const RADIO_ISLA = 1.35;
/** [R-407] Pinos como mucho por isla. */
const PINOS_POR_ISLA = 7;

/**
 * [R-407] Perfil de una isla unitaria (radio 1, altura 1): playa casi plana en
 * el borde y un monte en el centro. Lo usan la malla Y los pinos, que se
 * plantan a la altura que da este perfil.
 */
export function perfilDeIsla(r: number): number {
  const monte = Math.pow(Math.max(0, 1 - Math.pow(r / 0.8, 2)), 1.3);
  return 0.04 * Math.max(0, 1 - r) + 0.96 * monte;
}

/**
 * [R-407] La malla de una isla: un montículo polar con ruido, coloreado por
 * altura —playa, verde, roca— con los colores de la paleta. Una sola geometría;
 * la variedad la dan la escala y el giro de cada instancia.
 */
function geometriaDeIsla(paleta: Paleta, azar: () => number): BufferGeometry {
  const anillos = 12;
  const sectores = 30;
  const fases = Array.from({ length: 4 }, () => azar() * Math.PI * 2);
  const ruido = (ang: number, r: number): number =>
    Math.sin(ang * 3 + fases[0]!) * 0.1 +
    Math.sin(ang * 5 + fases[1]! + r * 4) * 0.06 +
    Math.sin(ang * 9 + fases[2]!) * 0.035 +
    Math.sin(ang * 14 + fases[3]! - r * 7) * 0.02;

  const arena = new ColorTres(paleta.arena);
  const verde = new ColorTres(paleta.vegetacion);
  const roca = new ColorTres(paleta.roca);
  const c = new ColorTres();
  const pos: number[] = [0, 1 + ruido(0, 0) * 0.5, 0];
  const col: number[] = [];
  const colorPorAltura = (h: number, variacion: number): ColorTres => {
    if (h < 0.07) return c.copy(arena);
    if (h < 0.12) return c.copy(arena).lerp(verde, (h - 0.07) / 0.05);
    if (h < 0.55 + variacion * 0.2) return c.copy(verde).multiplyScalar(0.85 + variacion * 0.3);
    return c.copy(verde).lerp(roca, Math.min(1, (h - 0.55) / 0.15));
  };
  colorPorAltura(1, 0).toArray(col, 0);

  for (let a = 1; a <= anillos + 1; a++) {
    // El último anillo, por debajo del agua: la playa entra en el mar.
    const r = a <= anillos ? a / anillos : 1.1;
    for (let s = 0; s < sectores; s++) {
      const ang = (s / sectores) * Math.PI * 2;
      const n = ruido(ang, r);
      const radio = r * (1 + n);
      const h = a <= anillos ? perfilDeIsla(r) * (1 + n * 0.8) : -0.06;
      pos.push(Math.cos(ang) * radio, h, Math.sin(ang) * radio);
      colorPorAltura(h, (Math.sin(ang * 7 + r * 11) + 1) * 0.5).toArray(col, col.length);
    }
  }
  const indices: number[] = [];
  for (let s = 0; s < sectores; s++) indices.push(0, 1 + ((s + 1) % sectores), 1 + s);
  for (let a = 0; a < anillos; a++) {
    for (let s = 0; s < sectores; s++) {
      const s2 = (s + 1) % sectores;
      const i0 = 1 + a * sectores;
      const i1 = 1 + (a + 1) * sectores;
      indices.push(i0 + s, i0 + s2, i1 + s2, i0 + s, i1 + s2, i1 + s);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  geo.setIndex(indices);
  const plana = geo.toNonIndexed();
  plana.computeVertexNormals();
  geo.dispose();
  return plana;
}

/** [R-407] Un pino de 1 m: tronco de madera y tres pisos de copa. Color por vértice. */
function geometriaDePino(paleta: Paleta): BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const tronco = new ColorTres(paleta.madera).multiplyScalar(0.6);
  const copa = new ColorTres(paleta.vegetacion).multiplyScalar(0.7);
  const cono = (y0: number, y1: number, r: number, color: ColorTres): void => {
    const lados = 7;
    for (let k = 0; k < lados; k++) {
      const a0 = (k / lados) * Math.PI * 2;
      const a1 = ((k + 1) / lados) * Math.PI * 2;
      pos.push(Math.cos(a0) * r, y0, Math.sin(a0) * r, 0, y1, 0, Math.cos(a1) * r, y0, Math.sin(a1) * r);
      for (let v = 0; v < 3; v++) color.toArray(col, col.length);
    }
  };
  cono(0, 0.35, 0.05, tronco);
  cono(0.18, 0.62, 0.3, copa);
  cono(0.4, 0.84, 0.23, copa);
  cono(0.6, 1, 0.15, copa);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  geo.computeVertexNormals();
  return geo;
}

/** [R-408] Una boya de 3,2 m de torno, con franjas blancas pintadas por vértice. */
function geometriaDeBoya(paleta: Paleta): BufferGeometry {
  const perfil = [
    [0, -1.2], [0.9, -1.2], [1.15, -0.6], [1.15, 0.2], [0.85, 0.9], [0.55, 1.5], [0.12, 2], [0, 2],
  ].map(([x, y]) => new Vector2(x, y));
  const geo = new LatheGeometry(perfil, 14);
  const pos = geo.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const naranja = new ColorTres(paleta.boya);
  const blanco = new ColorTres(paleta.espuma);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    (y > 0.35 && y < 0.95 ? blanco : naranja).toArray(col, i * 3);
  }
  geo.setAttribute('color', new BufferAttribute(col, 3));
  return geo;
}

export class Mundo {
  readonly raiz = new Object3D();
  private readonly huevos: InstancedMesh;
  private islas: InstancedMesh | null = null;
  private readonly boyas: InstancedMesh;
  private readonly lucesBoya: InstancedMesh;
  private readonly sitiosBoya: { x: number; z: number }[] = [];
  private readonly sol: DirectionalLight;
  private readonly haciaSol: Vector3;
  private readonly aDestruir: { dispose(): void }[] = [];
  private readonly circuito: Circuito;
  private readonly trazado: Trazado;

  constructor(escena: Scene, circuito: Circuito, trazado: Trazado, paleta: Paleta, huevos: readonly Huevo[]) {
    this.circuito = circuito;
    this.trazado = trazado;

    // -- Luz y niebla -------------------------------------------------------
    // [R-207] Niebla exponencial con el color y la densidad de la paleta: la
    // MISMA que lleva el agua y el pie del cielo. Con la lineal de antes, a
    // 219 m en `faro` todas las islas salían del mismo azul claro (`DR12`).
    escena.fog = new FogExp2(new ColorTres(paleta.niebla).getHex(), paleta.densidadNiebla);
    const d = direccionDelSol(paleta);
    this.haciaSol = new Vector3(d.x, d.y, d.z);
    this.sol = new DirectionalLight(new ColorTres(paleta.sol), paleta.luz);
    // [R-506] Una caja de sombras ajustada que se mueve con la barca seguida.
    // La de serie cubría ±5 m alrededor del ORIGEN: ninguna barca tenía sombra
    // salvo en la salida (`DR11`).
    this.sol.castShadow = true;
    this.sol.shadow.mapSize.set(2048, 2048);
    this.sol.shadow.camera.left = -CAJA_SOMBRA;
    this.sol.shadow.camera.right = CAJA_SOMBRA;
    this.sol.shadow.camera.top = CAJA_SOMBRA;
    this.sol.shadow.camera.bottom = -CAJA_SOMBRA;
    this.sol.shadow.camera.near = 1;
    this.sol.shadow.camera.far = 400;
    this.sol.shadow.bias = -0.0004;
    this.sol.shadow.normalBias = 0.04;
    this.raiz.add(this.sol, this.sol.target);
    // Luz de cielo y de agua, no una ambiente plana: lo de arriba de la barca
    // recibe cielo y lo de abajo, el reflejo del mar.
    this.raiz.add(
      new HemisphereLight(new ColorTres(paleta.horizonte), new ColorTres(paleta.aguaHonda), paleta.ambiente * 1.6),
    );

    // -- Costa e islas [R-404] [R-407] -------------------------------------
    this.raiz.add(this.construirCosta(paleta));

    // -- Boyas [R-402] [R-408] ---------------------------------------------
    const geoBoya = geometriaDeBoya(paleta);
    const matBoya = new MeshStandardMaterial({ vertexColors: true, roughness: 0.5 });
    const geoLuz = new SphereGeometry(0.22, 10, 8);
    // Pasa de 1 a propósito: es lo que el resplandor recoge [R-505].
    const matLuz = new MeshBasicMaterial({ color: new ColorTres(paleta.luzBoya).multiplyScalar(6) });
    this.aDestruir.push(geoBoya, matBoya, geoLuz, matLuz);
    let acumulado = 0;
    for (const tramo of circuito.tramos) {
      if (tramo.tipo === 'curva') {
        const metros = acumulado + tramo.longitud / 2;
        // La boya va en el borde interior de la curva, que es lo que se rodea.
        const carriles = Math.max(2, Math.floor(tramo.anchura / 4.5));
        const lado = tramo.radio > 0 ? -1 : carriles;
        this.sitiosBoya.push(posicionEn(trazado, metros, lado, carriles));
      }
      acumulado += tramo.longitud;
    }
    this.boyas = new InstancedMesh(geoBoya, matBoya, Math.max(1, this.sitiosBoya.length));
    this.boyas.castShadow = true;
    this.boyas.frustumCulled = false;
    this.lucesBoya = new InstancedMesh(geoLuz, matLuz, Math.max(1, this.sitiosBoya.length));
    this.lucesBoya.frustumCulled = false;
    this.raiz.add(this.boyas, this.lucesBoya);

    // -- Huevos [R-403] [R-408] --------------------------------------------
    const geoHuevo = new SphereGeometry(0.55, 20, 14);
    geoHuevo.scale(1, 1.32, 1);
    const matHuevo = new MeshStandardMaterial({
      color: new ColorTres(paleta.huevo),
      roughness: 0.25,
      emissive: new ColorTres(paleta.huevo),
      emissiveIntensity: 0.9,
    });
    this.aDestruir.push(geoHuevo, matHuevo);
    this.huevos = new InstancedMesh(geoHuevo, matHuevo, Math.max(1, huevos.length));
    this.huevos.frustumCulled = false;
    this.huevos.castShadow = true;
    this.raiz.add(this.huevos);

    escena.add(this.raiz);
  }

  /**
   * [R-404] [R-407] Costa e islas a partir de la semilla del circuito. Una
   * malla instanciada para las islas y otra para los pinos.
   */
  private construirCosta(paleta: Paleta): Object3D {
    const grupo = new Object3D();
    const azar = semillaDe(this.circuito.id);
    const geoIsla = geometriaDeIsla(paleta, azar);
    const geoPino = geometriaDePino(paleta);
    const matIsla = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
    const matPino = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
    this.aDestruir.push(geoIsla, geoPino, matIsla, matPino);

    const islas = new InstancedMesh(geoIsla, matIsla, ISLAS);
    const pinos = new InstancedMesh(geoPino, matPino, ISLAS * PINOS_POR_ISLA);
    const m = new Matrix4();
    const q = new Quaternion();
    const escala = new Vector3();
    const sitio = new Vector3();
    const arriba = new Vector3(0, 1, 0);
    let pino = 0;

    for (let i = 0; i < ISLAS; i++) {
      // Se plantan a lo largo del trazado, fuera del agua navegable, hacia el
      // costado que marca el RUMBO. Antes se usaba el ángulo del punto visto
      // desde el origen, que no es ninguna perpendicular del circuito.
      const metros = azar() * this.trazado.vuelta;
      const p = puntoEn(this.trazado, metros);
      const rumbo = rumboEn(this.trazado, metros);
      const lado = azar() < 0.5 ? -1 : 1;
      const alto = 6 + Math.pow(azar(), 1.6) * 44;
      const ancho = alto * (1.6 + azar() * 1.6);
      const fuera = anchuraEn(this.trazado, metros) / 2 + ancho * RADIO_ISLA + 25 + azar() * 260;
      sitio.set(p.x + Math.cos(rumbo) * fuera * lado, -0.6, p.z - Math.sin(rumbo) * fuera * lado);
      // Si el circuito vuelve por ahí, la isla estaría en medio de la regata:
      // no se dibuja. Escala CERO en los tres ejes: aplastarla solo en altura
      // dejaba un disco oscuro que asomaba en el seno de cada ola.
      const libre = this.trazado.puntos.every((t) => Math.hypot(t.x - sitio.x, t.z - sitio.z) > ancho * RADIO_ISLA + 20);
      const giro = azar() * Math.PI * 2;
      q.setFromAxisAngle(arriba, giro);
      escala.set(ancho, alto, ancho).multiplyScalar(libre ? 1 : 0);
      m.compose(sitio, q, escala);
      islas.setMatrixAt(i, m);

      // [R-407] Pinos en el verde, a la altura que da el perfil.
      const cuantos = libre && alto > 10 ? 2 + Math.floor(azar() * (PINOS_POR_ISLA - 1)) : 0;
      for (let k = 0; k < PINOS_POR_ISLA; k++) {
        const r = 0.18 + azar() * 0.42;
        const ang = azar() * Math.PI * 2;
        const talla = 3 + azar() * 5;
        if (k >= cuantos) continue;
        const y = sitio.y + perfilDeIsla(r) * alto * 0.86 - 0.4;
        const pinoSitio = new Vector3(sitio.x + Math.cos(ang) * r * ancho, y, sitio.z + Math.sin(ang) * r * ancho);
        m.compose(pinoSitio, q, escala.set(talla, talla * 1.5, talla));
        pinos.setMatrixAt(pino++, m);
      }
    }
    pinos.count = pino;
    islas.instanceMatrix.needsUpdate = true;
    pinos.instanceMatrix.needsUpdate = true;
    // Reciben sombra pero no la echan: casi nunca caen en la caja de ±45 m de
    // la barca seguida, y echándola se volvían a dibujar enteras en el pase de
    // sombras.
    islas.receiveShadow = true;
    grupo.add(islas, pinos);
    this.islas = islas;
    return grupo;
  }

  /**
   * [R-506] La luz del sol va con la barca seguida, en la dirección del sol de
   * la paleta: así la caja de sombras siempre cubre la regata que se ve.
   */
  seguirSombra(x: number, z: number): void {
    this.sol.target.position.set(x, 0, z);
    this.sol.position.set(x + this.haciaSol.x * 200, this.haciaSol.y * 200, z + this.haciaSol.z * 200);
    this.sol.target.updateMatrixWorld();
  }

  /** [R-603] Con el equipo justo, las sombras sobran. */
  apagarSombras(): void {
    this.sol.castShadow = false;
  }

  /** [R-404] Para los tests: las matrices de las islas, en orden. */
  matricesDeIslas(): number[] {
    return this.islas === null ? [] : Array.from(this.islas.instanceMatrix.array);
  }

  /**
   * [R-403] Los huevos bobean con el agua, y un huevo roto no se dibuja: se
   * manda fuera de la escena en vez de reconstruir la malla instanciada.
   */
  actualizarHuevos(huevos: readonly Huevo[], tiempo: number, oleaje: number): void {
    const m = new Matrix4();
    const q = new Quaternion();
    const uno = new Vector3(1, 1, 1);
    const sitio = new Vector3();
    const eje = new Vector3(0, 1, 0);
    for (let i = 0; i < this.huevos.count; i++) {
      const h = huevos[i];
      if (h === undefined || h.reaparece > 0) {
        m.makeScale(0, 0, 0);
        this.huevos.setMatrixAt(i, m);
        continue;
      }
      // [R-402] La misma cuenta que las barcas: si el huevo se colocara con
      // otra, se vería en un carril y se rompería en otro.
      const carriles = Math.max(2, Math.floor(anchuraEn(this.trazado, h.metros) / 4.5));
      const { x, z } = posicionEn(this.trazado, h.metros, h.carril, carriles);
      sitio.set(x, alturaDeOla(x, z, tiempo, oleaje) + 0.5 + Math.sin(tiempo * 2.2 + i) * 0.12, z);
      q.setFromAxisAngle(eje, tiempo * 1.3 + i);
      m.compose(sitio, q, uno);
      this.huevos.setMatrixAt(i, m);
    }
    this.huevos.instanceMatrix.needsUpdate = true;
  }

  /** Las boyas también flotan, y se mecen. */
  actualizarBoyas(tiempo: number, oleaje: number): void {
    const m = new Matrix4();
    const q = new Quaternion();
    const uno = new Vector3(1, 1, 1);
    const sitio = new Vector3();
    const eje = new Vector3(0, 0, 1);
    this.sitiosBoya.forEach((b, i) => {
      const y = alturaDeOla(b.x, b.z, tiempo, oleaje) + 0.4;
      q.setFromAxisAngle(eje, Math.sin(tiempo * 1.7 + b.x) * 0.12);
      m.compose(sitio.set(b.x, y, b.z), q, uno);
      this.boyas.setMatrixAt(i, m);
      // La luz, en el tope, con el mismo vaivén.
      const tope = new Vector3(0, 2.1, 0).applyQuaternion(q);
      m.compose(sitio.set(b.x + tope.x, y + tope.y, b.z + tope.z), q, uno);
      this.lucesBoya.setMatrixAt(i, m);
    });
    this.boyas.instanceMatrix.needsUpdate = true;
    this.lucesBoya.instanceMatrix.needsUpdate = true;
  }

  destruir(): void {
    for (const cosa of this.aDestruir) cosa.dispose();
    this.raiz.removeFromParent();
  }
}
