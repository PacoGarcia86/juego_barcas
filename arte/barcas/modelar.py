# [R-303] Construye `barcas.blend`: la lancha, que es TODAS las barcas del juego.
#
#   blender -b --python arte/barcas/modelar.py
#
# El casco se loftea desde secciones (bandas limpias para pintar fondo, costado,
# franja, defensa, regala e interior) con las proporciones de
# `lancha_low_poly.glb`, del que se reutilizan tal cual el MOTOR fueraborda y el
# TIMÓN. La malla original no sirve de casco: 170 caras trianguladas sin un
# corte donde poner una franja.
#
# Se modela en metros. `exportar.py` normaliza a la geometría unitaria del
# juego (`R-302`), así que las medidas de aquí solo fijan PROPORCIONES.
#
# Nombres de material = pintura:
#   pintura:casco:<luz>   el color de casco de cada barca, por instancia
#   pintura:franja:<luz>  el color de franja de cada barca, por instancia
#   cualquier otro        color fijo (el color base del material)

import math
import os

import bmesh
import bpy
from mathutils import Vector

AQUI = os.path.dirname(os.path.abspath(__file__))
GLB = os.path.join(AQUI, 'lancha_low_poly.glb')
BLEND = os.path.join(AQUI, 'barcas.blend')

# -- Materiales -------------------------------------------------------------

def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4) for v in c) + (1.0,)

# El color de muestra de las pinturas es el de la lancha: solo sirve para verlo en Blender.
MATERIALES = {
    'fondo': ('pintura:casco:0.55', '#651018'),
    'casco': ('pintura:casco:1', '#b8112a'),
    'franja': ('pintura:franja:1', '#f2f2f2'),
    'defensa': ('defensa', '#23262b'),
    'regala': ('pintura:franja:0.92', '#dedede'),
    'fibra': ('fibra', '#e6e0d0'),
    'suelo': ('suelo', '#b7b09f'),
    'tablero': ('tablero', '#2b2f36'),
    'cristal': ('cristal', '#3f5d70'),
    'motor': ('motor', '#2a2d33'),
    'motor_tapa': ('motor_tapa', '#dfe3e8'),
    'cojin': ('pintura:franja:0.8', '#c8c8c8'),
}


def material(clave):
    nombre, color = MATERIALES[clave]
    m = bpy.data.materials.get(nombre)
    if m is None:
        m = bpy.data.materials.new(nombre)
        m.diffuse_color = srgb(color)
        if m.node_tree is not None:
            bsdf = m.node_tree.nodes.get('Principled BSDF')
            if bsdf is not None:
                bsdf.inputs['Base Color'].default_value = srgb(color)
                bsdf.inputs['Roughness'].default_value = 0.55
    return m


class Constructor:
    """Una malla con materiales por cara, montada a mano sobre bmesh."""

    def __init__(self, nombre):
        self.nombre = nombre
        self.bm = bmesh.new()
        self.slots = []

    def slot(self, clave):
        if clave not in self.slots:
            self.slots.append(clave)
        return self.slots.index(clave)

    def cara(self, vs, clave):
        try:
            f = self.bm.faces.new(vs)
        except ValueError:
            return None
        f.material_index = self.slot(clave)
        return f

    def caja(self, centro, medidas, clave, deformar=None):
        """Caja orientada a ejes. `deformar(v)` retoca vértices (co local ±0,5)."""
        res = bmesh.ops.create_cube(self.bm, size=1.0)
        for v in res['verts']:
            if deformar is not None:
                deformar(v)
            v.co = Vector((v.co.x * medidas[0], v.co.y * medidas[1], v.co.z * medidas[2])) + Vector(centro)
        for f in {f for v in res['verts'] for f in v.link_faces}:
            f.material_index = self.slot(clave)

    def importar(self, bm_origen, clave_de_cara):
        mapa = {}
        for v in bm_origen.verts:
            mapa[v] = self.bm.verts.new(v.co)
        for f in bm_origen.faces:
            clave = clave_de_cara(f)
            self.cara([mapa[v] for v in f.verts], clave)

    def objeto(self, props):
        me = bpy.data.meshes.new(self.nombre)
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=0.0005)
        self.bm.to_mesh(me)
        self.bm.free()
        for clave in self.slots:
            me.materials.append(material(clave))
        ob = bpy.data.objects.new(self.nombre, me)
        for k, v in props.items():
            ob[k] = v
        bpy.context.scene.collection.objects.link(ob)
        return ob


# -- El lofteado ------------------------------------------------------------

def suave(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def mezcla(a, b, k):
    return a + (b - a) * k


# Bandas entre puntos consecutivos de media sección (P0 quilla … P10 eje del suelo).
BANDAS = ['fondo', 'fondo', 'casco', 'franja', 'casco', 'defensa', 'defensa', 'regala', 'fibra', 'suelo']


def seccion(x_manga, z_quilla, x_pantoque, z_pantoque, z_regala, x_suelo, z_suelo, grosor):
    """Once puntos de media sección, de la quilla al eje del suelo, x ≥ 0."""
    hb = x_manga
    xc, zc = x_pantoque, z_pantoque
    p1 = (xc * 0.5, z_quilla + (zc - z_quilla) * 0.44)  # pantoque vivo, astilla muerta recta

    def costado(f):
        return (xc + (hb - xc) * f, zc + (z_regala - zc) * f)

    z_suelo = max(z_suelo, zc + 0.03)  # nunca por debajo del pantoque: asomaría por fuera
    tapa = min(grosor, hb * 0.45)
    lip = min(0.045, hb * 0.2)
    x_int = hb - tapa
    xf = min(x_suelo, x_int, xc * 0.97)
    return [
        (0.0, z_quilla),
        p1,
        (xc, zc),
        costado(0.60),
        costado(0.72),
        costado(0.90),
        (hb + lip, z_regala - 0.075),
        (hb + lip, z_regala),
        (x_int, z_regala),
        (xf, z_suelo),
        (0.0, z_suelo),
    ]


def loft(c, eslora, estaciones, forma):
    anillos = []
    for t in estaciones:
        media = forma(t)
        anillo = media + [(-x, z) for (x, z) in reversed(media[1:-1])]
        y = (t - 0.5) * eslora
        anillos.append([c.bm.verts.new((x, y, z)) for (x, z) in anillo])
    n = len(anillos[0])
    for s in range(len(anillos) - 1):
        a, b = anillos[s], anillos[s + 1]
        for k in range(n):
            k1 = (k + 1) % n
            banda = BANDAS[k] if k < 10 else BANDAS[19 - k]
            c.cara([a[k], b[k], b[k1], a[k1]], banda)
    # Espejo de popa y roda. La popa lleva el color del casco.
    c.cara(list(anillos[0]), 'casco')
    c.cara(list(reversed(anillos[-1])), 'casco')


ESTACIONES = [0.0, 0.018, 0.07, 0.15, 0.25, 0.35, 0.45, 0.55, 0.64, 0.72, 0.79, 0.85, 0.9, 0.945, 0.978, 1.0]


# -- Piezas del GLB ---------------------------------------------------------

def piezas_de_la_lancha():
    """Motor y timón del GLB, en metros, con la proa hacia +Y."""
    bpy.ops.import_scene.gltf(filepath=GLB)
    esc = 8.2 / 440.0  # 440 unidades de casco = 8,2 m de lancha

    def malla(nombre):
        ob = bpy.data.objects[nombre]
        me = ob.data.copy()
        me.transform(ob.matrix_world)
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.01)
        # Proa del GLB en −Y → girar 180° en Z; centrar la eslora; quilla a −0,85 m.
        for v in bm.verts:
            v.co = Vector((-v.co.x * esc, (-v.co.y - 26.0) * esc, (v.co.z - 14.6) * esc))
        return bm

    motor = malla('lancha_L4_0')
    timon = malla('lancha_L3_0')
    # El L3 trae timón y toldo (T-top) juntos. El toldo se deja fuera: la
    # cámara va por detrás y por encima, y así la consola se lee entera.
    borrar = [f for f in timon.faces if abs(f.calc_center_median().x) > 0.3 or f.calc_center_median().z > 0.8]
    bmesh.ops.delete(timon, geom=borrar, context='FACES')
    bmesh.ops.delete(timon, geom=[v for v in timon.verts if not v.link_faces], context='VERTS')
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob)
    return motor, timon


def trasladar(bm, destino_min, ancla):
    """Mueve `bm` para que el punto `ancla(bbox)` quede en `destino_min`."""
    mn = Vector([min(v.co[i] for v in bm.verts) for i in range(3)])
    mx = Vector([max(v.co[i] for v in bm.verts) for i in range(3)])
    d = Vector(destino_min) - ancla(mn, mx)
    for v in bm.verts:
        v.co += d


# -- La lancha: todas las barcas del juego ----------------------------------

def lancha(motor, timon):
    L, B = 8.2, 2.8
    c = Constructor('lancha')

    def hb(t):
        if t < 0.45:
            return B / 2 * (0.86 + 0.14 * math.sin(math.pi / 2 * t / 0.45))
        u = (t - 0.45) / 0.55
        return max(0.006, B / 2 * (1 - u ** 2.1) ** 0.62)

    def regala(t):
        return -0.07 + 0.07 * t + 0.52 * max(0.0, (t - 0.5) / 0.5) ** 2.1

    def forma(t):
        h = hb(t)
        zs = regala(t)
        zk = -0.85 + 0.8 * max(0.0, (t - 0.6) / 0.4) ** 1.7
        zc = -0.56 + 0.5 * max(0.0, (t - 0.62) / 0.38) ** 1.5
        zc = max(zc, zk + 0.01)
        k = suave(0.74, 0.84, t)  # cubierta de proa
        popa = 1.0 if t < 0.03 else 0.0  # espejo con grosor
        # Suelo autovaciante: por encima de la flotación de la barca más cargada.
        z_suelo = mezcla(-0.38, zs - 0.03, max(k, popa))
        x_suelo = mezcla(h * 0.8, h - 0.13, max(k, popa))
        return seccion(h, zk, h * 0.83, zc, zs, x_suelo, z_suelo, 0.13)

    loft(c, L, ESTACIONES, forma)

    # Consola de gobierno, algo por detrás del centro.
    yc = (0.33 - 0.5) * L
    def consola(v):
        if v.co.z > 0 and v.co.y > 0:  # la cara de proa cae hacia delante
            v.co.z -= 0.28
    c.caja((0, yc, -0.07), (0.86, 0.72, 0.86), 'fibra', consola)
    c.caja((0, yc - 0.02, 0.37), (0.8, 0.5, 0.03), 'tablero', lambda v: setattr(v.co, 'z', v.co.z - 0.28 * (v.co.y + 0.5)))
    # Parabrisas: un cristal inclinado sobre el borde de proa de la consola.
    def parabrisas(v):
        v.co.y += (v.co.z + 0.5) * -0.9
    c.caja((0, yc + 0.47, 0.34), (0.92, 0.03, 0.34), 'cristal', parabrisas)

    # Timón del GLB, delante del patrón, sobre el tablero.
    for v in timon.verts:
        v.co *= 0.62
    trasladar(timon, (0, yc - 0.2, 0.32), lambda mn, mx: Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z)))
    c.importar(timon, lambda f: 'tablero')

    # Asiento del patrón con respaldo.
    ya = (0.2 - 0.5) * L
    c.caja((0, ya, -0.27), (1.1, 0.5, 0.46), 'fibra')
    c.caja((0, ya, -0.0), (1.1, 0.52, 0.1), 'cojin')
    c.caja((0, ya - 0.24, 0.26), (1.1, 0.1, 0.5), 'cojin', lambda v: setattr(v.co, 'y', v.co.y - 0.4 * (v.co.z + 0.5)))
    # Banco corrido de popa.
    c.caja((0, -L / 2 + 0.45, -0.2), (B * 0.72, 0.5, 0.5), 'fibra')
    c.caja((0, -L / 2 + 0.45, 0.07), (B * 0.72, 0.52, 0.08), 'cojin')

    # Motor del GLB, colgado del espejo. La tapa, clara: se lee desde la cámara de popa.
    mz = [v.co.z for v in motor.verts]
    alto = max(mz) - min(mz)
    trasladar(motor, (0, -L / 2 + 0.32, regala(0) + 0.62),
              lambda mn, mx: Vector(((mn.x + mx.x) / 2, mx.y, mx.z)))
    z_tapa = max(v.co.z for v in motor.verts) - alto * 0.16
    c.importar(motor, lambda f: 'motor_tapa' if f.calc_center_median().z > z_tapa and f.normal.z > -0.2 else 'motor')

    return c.objeto({'eslora': L, 'manga': B})


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    motor, timon = piezas_de_la_lancha()
    lancha(motor, timon)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print('GUARDADO', BLEND)


main()
