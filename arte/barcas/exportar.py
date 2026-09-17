# [R-303] [R-306] `barcas.blend` → `src/render/tresd/modelos.ts`.
#
#   blender -b arte/barcas/barcas.blend --python arte/barcas/exportar.py
#
# Sale DATO, no un .glb: la flota no espera a ninguna descarga, los tests lo
# leen con `node --test` y las ocho barcas son UNA geometría instanciada.
#
# Ejes: Blender (x, y proa, z arriba) → juego (−x, z arriba, y proa). Negar x
# mantiene el giro de las caras. Unidades: 1 de eslora, 1 de manga, y la altura
# en «puntales» (`PUNTAL_POR_MANGA · manga`), que es como la escala `flota.ts`.

import os

import bmesh
import bpy

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.path.join(AQUI, '..', '..', 'src', 'render', 'tresd', 'modelos.ts')
PUNTAL_POR_MANGA = 0.55
OBJETO = 'lancha'


def pintura_de(mat):
    partes = mat.name.split(':')
    if partes[0] == 'pintura':
        return "{ pintura: '%s', luz: %s }" % (partes[1], float(partes[2]))
    # [R-401] El color fijo lo pone `paleta.ts`: aquí solo viaja el nombre.
    return "{ fijo: '%s' }" % mat.name


def islas(bm):
    vistas, res = set(), []
    for f in bm.faces:
        if f in vistas:
            continue
        pila, isla = [f], []
        vistas.add(f)
        while pila:
            g = pila.pop()
            isla.append(g)
            for v in g.verts:
                for h in v.link_faces:
                    if h not in vistas:
                        vistas.add(h)
                        pila.append(h)
        res.append(isla)
    return res


def volumen(caras):
    """Volumen con signo de una pieza triangulada: negativo = caras hacia dentro."""
    total = 0.0
    for f in caras:
        a, b, c = (v.co for v in f.verts)
        total += a.dot(b.cross(c))
    return total / 6


def exportar(ob):
    eslora, manga = ob['eslora'], ob['manga']
    puntal = PUNTAL_POR_MANGA * manga
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method='BEAUTY', ngon_method='EAR_CLIP')
    # Cada pieza cerrada, con las caras hacia fuera.
    for isla in islas(bm):
        if volumen(isla) < 0:
            bmesh.ops.reverse_faces(bm, faces=isla)

    pinturas = [pintura_de(m) for m in ob.data.materials]
    indice, posiciones, pintura, indices = {}, [], [], []
    quilla = 0.0
    for f in bm.faces:
        if len(f.verts) != 3 or f.calc_area() < 1e-7:
            continue
        m = f.material_index
        es_casco = ob.data.materials[m].name.startswith('pintura:casco')
        for v in f.verts:
            p = (round(-v.co.x / manga, 4), round(v.co.z / puntal, 4), round(v.co.y / eslora, 4))
            if es_casco:
                quilla = min(quilla, p[1])
            clave = (p, m)
            if clave not in indice:
                indice[clave] = len(pintura)
                posiciones.extend(p)
                pintura.append(m)
            indices.append(indice[clave])
    bm.free()
    num = lambda xs: ','.join(('%g' % x) for x in xs)
    texto = (
        "{\n  pinturas: [%s],\n  quilla: %g,\n  posiciones: [%s],\n  pintura: [%s],\n  indices: [%s],\n}"
        % (', '.join(pinturas), round(quilla, 4), num(posiciones), num(pintura), num(indices))
    )
    return texto, '%d vértices, %d triángulos' % (len(pintura), len(indices) // 3)


def main():
    cuerpo, resumen = exportar(bpy.data.objects[OBJETO])
    with open(SALIDA, 'w', encoding='utf-8', newline='\n') as f:
        f.write(
            "// GENERADO por arte/barcas/exportar.py desde barcas.blend. NO SE EDITA A MANO:\n"
            "// se cambia el modelo en Blender y se vuelve a exportar.\n"
            "//\n"
            "// Basado en «Lancha low poly» de JuanSimon (https://sketchfab.com/JuanSimon),\n"
            "// CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/). Casco remodelado;\n"
            "// motor y timón reutilizados. Detalle en arte/barcas/CREDITOS.md.\n"
            "//\n"
            "// [R-303] La lancha, que es todas las barcas. Geometría unitaria: x manga\n"
            "// (−0,5…0,5), z eslora (proa +0,5), y en puntales con la regala a 0 y la\n"
            "// quilla en `quilla`.\n"
            "// [R-306] `pintura[v]` indexa `pinturas`: las de casco y franja toman el\n"
            "// color de la barca por instancia; las fijas nombran un material de `paleta.ts`.\n"
            "// %s\n\n"
            "import type { MaterialDeBarca } from '../paleta.ts';\n\n"
            "export type Pintura = { readonly pintura: 'casco' | 'franja'; readonly luz: number } | { readonly fijo: MaterialDeBarca };\n\n"
            "export interface Modelo {\n"
            "  readonly pinturas: readonly Pintura[];\n"
            "  /** Altura de la quilla, en puntales (negativa). */\n"
            "  readonly quilla: number;\n"
            "  readonly posiciones: readonly number[];\n"
            "  readonly pintura: readonly number[];\n"
            "  readonly indices: readonly number[];\n"
            "}\n\n"
            "/** El puntal con el que se exportó: `flota.ts` escala la altura con él. */\n"
            "export const PUNTAL_POR_MANGA = %g;\n\n"
            "export const MODELO: Modelo = %s;\n"
            % (resumen, PUNTAL_POR_MANGA, cuerpo)
        )
    print('EXPORTADO', SALIDA, resumen)


main()
