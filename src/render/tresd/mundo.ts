// [R-4xx] El mundo alrededor del agua: cielo, costa, islas, boyas y huevos.
//
// Todo se coloca con `puntoEn` y `lateralDe` del trazado [R-402]: nada de
// coordenadas escritas a mano. Y todo el color sale de la paleta [R-401].

import {
  AmbientLight,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color as ColorTres,
  ConeGeometry,
  DirectionalLight,
  Fog,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Scene,
  SphereGeometry,
  Quaternion,
  Vector3,
} from 'three';
import type { Circuito, Huevo } from '../../engine/tipos.ts';
import type { Paleta } from '../paleta.ts';
import { anchuraEn, lateralDe, puntoEn, type Trazado } from './trazado.ts';
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

export class Mundo {
  readonly raiz = new Object3D();
  private readonly huevos: InstancedMesh;
  private readonly boyas: Object3D[] = [];
  private readonly aDestruir: { dispose(): void }[] = [];
  private readonly circuito: Circuito;
  private readonly trazado: Trazado;

  constructor(escena: Scene, circuito: Circuito, trazado: Trazado, paleta: Paleta, huevos: readonly Huevo[]) {
    this.circuito = circuito;
    this.trazado = trazado;

    // -- Cielo: una esfera por dentro con degradado ------------------------
    // El material va en BLANCO a propósito: con `vertexColors`, three
    // MULTIPLICA el color del material por el del vértice, así que poner aquí
    // el color del cielo lo elevaba al cuadrado y el cielo del amanecer salía
    // negro. El degradado lo pone el atributo de color, y solo él.
    const cielo = new Mesh(
      new SphereGeometry(1600, 24, 16),
      new MeshBasicMaterial({ side: BackSide, fog: false }),
    );
    const geoCielo = cielo.geometry;
    const pos = geoCielo.getAttribute('position');
    const colores = new Float32Array(pos.count * 3);
    const arriba = new ColorTres(paleta.cielo);
    const abajo = new ColorTres(paleta.horizonte);
    const mezcla = new ColorTres();
    for (let i = 0; i < pos.count; i++) {
      const t = Math.max(0, Math.min(1, pos.getY(i) / 1600 + 0.12));
      mezcla.copy(abajo).lerp(arriba, Math.pow(t, 0.55));
      colores[i * 3] = mezcla.r;
      colores[i * 3 + 1] = mezcla.g;
      colores[i * 3 + 2] = mezcla.b;
    }
    geoCielo.setAttribute('color', new BufferAttribute(colores, 3));
    (cielo.material as MeshBasicMaterial).vertexColors = true;
    this.raiz.add(cielo);
    this.aDestruir.push(geoCielo, cielo.material as MeshBasicMaterial);

    // -- Luz y niebla -------------------------------------------------------
    escena.fog = new Fog(new ColorTres(paleta.niebla).getHex(), 60, 1 / paleta.densidadNiebla);
    const sol = new DirectionalLight(new ColorTres(paleta.sol), paleta.luz);
    sol.position.set(Math.cos(paleta.altura) * 400, Math.sin(paleta.altura) * 400 + 40, 260);
    sol.castShadow = true;
    sol.shadow.mapSize.set(1024, 1024);
    sol.shadow.camera.far = 900;
    this.raiz.add(sol);
    this.raiz.add(new AmbientLight(new ColorTres(paleta.horizonte), paleta.ambiente));

    // -- Costa e islas [R-404] ---------------------------------------------
    this.raiz.add(this.construirCosta(paleta));

    // -- Boyas [R-402] ------------------------------------------------------
    const geoBoya = new ConeGeometry(1.1, 3.2, 8);
    const matBoya = new MeshStandardMaterial({ color: new ColorTres(paleta.boya), roughness: 0.6, emissive: new ColorTres(paleta.boya), emissiveIntensity: 0.25 });
    this.aDestruir.push(geoBoya, matBoya);
    let acumulado = 0;
    for (const tramo of circuito.tramos) {
      if (tramo.tipo === 'curva') {
        const metros = acumulado + tramo.longitud / 2;
        const boya = new Mesh(geoBoya, matBoya);
        const p = puntoEn(trazado, metros);
        // La boya va en el borde interior de la curva, que es lo que se rodea.
        const carriles = Math.max(2, Math.floor(tramo.anchura / 4.5));
        const lado = tramo.radio > 0 ? -1 : carriles;
        const lateral = lateralDe(lado, carriles, anchuraEn(trazado, metros));
        const rumbo = Math.atan2(p.x, p.z);
        boya.position.set(p.x + Math.cos(rumbo) * lateral, 0, p.z - Math.sin(rumbo) * lateral);
        boya.userData.metros = metros;
        this.raiz.add(boya);
        this.boyas.push(boya);
      }
      acumulado += tramo.longitud;
    }

    // -- Huevos [R-403] -----------------------------------------------------
    const geoHuevo = new IcosahedronGeometry(0.62, 1);
    const matHuevo = new MeshStandardMaterial({
      color: new ColorTres(paleta.huevo),
      roughness: 0.35,
      emissive: new ColorTres(paleta.huevo),
      emissiveIntensity: 0.4,
    });
    this.aDestruir.push(geoHuevo, matHuevo);
    this.huevos = new InstancedMesh(geoHuevo, matHuevo, Math.max(1, huevos.length));
    this.huevos.frustumCulled = false;
    this.raiz.add(this.huevos);

    escena.add(this.raiz);
  }

  /** [R-404] Costa e islas a partir de la semilla del circuito. */
  private construirCosta(paleta: Paleta): Object3D {
    const grupo = new Object3D();
    const azar = semillaDe(this.circuito.id);
    const geoIsla = new IcosahedronGeometry(1, 1);
    const matRoca = new MeshStandardMaterial({ color: new ColorTres(paleta.roca), roughness: 0.95, flatShading: true });
    const matVerde = new MeshStandardMaterial({ color: new ColorTres(paleta.vegetacion), roughness: 0.9, flatShading: true });
    this.aDestruir.push(geoIsla, matRoca, matVerde);

    const cuantas = 90;
    const rocas = new InstancedMesh(geoIsla, matRoca, cuantas);
    const verdes = new InstancedMesh(geoIsla, matVerde, cuantas);
    const m = new Matrix4();
    const q = new Quaternion();
    const escala = new Vector3();
    const sitio = new Vector3();

    for (let i = 0; i < cuantas; i++) {
      // Se plantan a lo largo del trazado, fuera del agua navegable.
      const metros = azar() * this.trazado.vuelta;
      const p = puntoEn(this.trazado, metros);
      const lado = azar() < 0.5 ? -1 : 1;
      const fuera = anchuraEn(this.trazado, metros) / 2 + 80 + azar() * 320;
      const ang = Math.atan2(p.x, p.z);
      sitio.set(p.x + Math.cos(ang) * fuera * lado, 0, p.z - Math.sin(ang) * fuera * lado);
      // Más altas que anchas y medio hundidas: una isla redonda y apoyada en
      // el plano del agua se lee como un globo atado a un palo, no como tierra.
      const alto = 8 + azar() * 34;
      const ancho = alto * (0.55 + azar() * 0.5);
      escala.set(ancho, alto, ancho);
      // Se hunde media altura: una isla que se apoya en el plano del agua
      // parece un globo atado a un palo.
      sitio.y = -alto * 0.42;
      q.setFromAxisAngle(new Vector3(0, 1, 0), azar() * Math.PI * 2);
      m.compose(sitio, q, escala);
      rocas.setMatrixAt(i, m);
      // Un capuchón de vegetación encima, más pequeño.
      escala.multiplyScalar(0.58);
      sitio.y += alto * 0.34;
      m.compose(sitio, q, escala);
      verdes.setMatrixAt(i, m);
    }
    rocas.instanceMatrix.needsUpdate = true;
    verdes.instanceMatrix.needsUpdate = true;
    rocas.castShadow = true;
    grupo.add(rocas, verdes);
    return grupo;
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
    for (let i = 0; i < this.huevos.count; i++) {
      const h = huevos[i];
      if (h === undefined || h.reaparece > 0) {
        m.makeScale(0, 0, 0);
        this.huevos.setMatrixAt(i, m);
        continue;
      }
      const p = puntoEn(this.trazado, h.metros);
      const carriles = Math.max(2, Math.floor(anchuraEn(this.trazado, h.metros) / 4.5));
      const lateral = lateralDe(h.carril, carriles, anchuraEn(this.trazado, h.metros));
      const ang = Math.atan2(p.x, p.z);
      const x = p.x + Math.cos(ang) * lateral;
      const z = p.z - Math.sin(ang) * lateral;
      sitio.set(x, alturaDeOla(x, z, tiempo, oleaje) + 0.35, z);
      q.setFromAxisAngle(new Vector3(0, 1, 0), tiempo * 1.3 + i);
      m.compose(sitio, q, uno);
      this.huevos.setMatrixAt(i, m);
    }
    this.huevos.instanceMatrix.needsUpdate = true;
  }

  /** Las boyas también flotan. */
  actualizarBoyas(tiempo: number, oleaje: number): void {
    for (const boya of this.boyas) {
      boya.position.y = alturaDeOla(boya.position.x, boya.position.z, tiempo, oleaje) + 1.5;
      boya.rotation.z = Math.sin(tiempo * 1.7 + boya.position.x) * 0.12;
    }
  }

  destruir(): void {
    for (const cosa of this.aDestruir) cosa.dispose();
    this.raiz.removeFromParent();
  }
}
