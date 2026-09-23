# Créditos — la lancha

Las barcas del juego parten de **«Lancha low poly»** de **JuanSimon**
(<https://sketchfab.com/JuanSimon>), publicado en Sketchfab
(<https://sketchfab.com/3d-models/lancha-low-poly-fcfd6b9a12f3402b8edd867a0d4af9e7>) bajo licencia
**CC BY 4.0** (<http://creativecommons.org/licenses/by/4.0/>).

## Qué se cambió

`lancha_low_poly.glb` es el original, sin tocar. `modelar.py` hace lo siguiente con él:

- Del modelo original se reutilizan **el motor fueraborda y el timón**, reescalados y recoloreados.
- El **casco se remodela** desde secciones con las proporciones del original: bandas de pintura
  (fondo, costado, franja, defensa, regala), bañera con suelo, cubierta de proa.
- Se **quita el toldo** (T-top) y se añaden consola, parabrisas, asiento del patrón y banco de popa.
- `exportar.py` lo convierte en la geometría unitaria de `src/render/tresd/modelos.ts`.

## Cómo se regenera

```
blender -b --python arte/barcas/modelar.py
blender -b arte/barcas/barcas.blend --python arte/barcas/exportar.py
```
