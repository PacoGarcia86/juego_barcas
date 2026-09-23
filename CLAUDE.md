# regata-2026 — instrucciones para agentes

Juego de carreras de barcas al estilo del kart: pilotas una barca, **intentas que no te adelanten**
y ganas la regata. Por el agua flotan **huevos** que se rompen pasando por encima —no cuestan
nada, se cogen cuando quieras— y sueltan objetos. Con los doblones que ganas compras **barcas
distintas** y **tripulantes** que reman, gobiernan y vigilan por ti. React + Vite + TypeScript, sin
servidor.

El valor del proyecto está en `src/engine/`: la física del casco, la táctica de los rivales y la
ruleta de objetos. `src/render/` dibuja la regata en 3D real sobre WebGL 2 (three.js): agua de
Gerstner, luz direccional y estela.

## Regla 1 — este proyecto es spec-driven

**Antes de tocar código, lee [`specs/index.md`](specs/index.md)** y carga **solo la sección** a la
que te enrute. Las especificaciones son largas: cargarlas enteras es un error, no una precaución.

El flujo completo está en [`specs/WORKFLOW.md`](specs/WORKFLOW.md). Órdenes disponibles:
`/nueva-spec`, `/implementar-fase`, `/cerrar-fase`.

Tres reglas que no se negocian:

1. **Cada requisito tiene un ID estable** (`B-` SPEC-001, `H-` SPEC-002, `A-` SPEC-003,
   `R-` SPEC-004, `P-` SPEC-005). El código que lo cumple lleva `// [B-xxx]`; el test que lo prueba
   se llama `[B-xxx] …`.
2. **Un cambio de alcance se escribe en la especificación ANTES que en el código**, nunca después.
3. **Ninguna afirmación sobre la regata sin medirla.** Si tocas la física, la IA, los objetos o el
   circuito, `npm run baseline` es obligatorio y las cifras que valen son **velocidad media,
   diferencia del segundo, adelantamientos sufridos por el jugador y reparto de victorias**.

   Los seis defectos de SPEC-001 §3 salieron todos de esa tabla y **ninguno era deducible leyendo
   el código**. El más caro: con la resistencia de ola mal puesta, la barca más larga ganaba el
   100 % de las regatas y el astillero entero sobraba (`B-202`).

## Invariantes

Cada uno tiene test estático en [`higiene.test.ts`](src/engine/__tests__/higiene.test.ts). No los
rompas «temporalmente».

| ID | Invariante |
|---|---|
| `[B-901]` | **Todo el azar pasa por `rng.ts`.** `Math.random` está prohibido en `engine/`, `render/`, `modes/`, `components/` y `juego/`. Misma semilla ⇒ misma regata, metro a metro. |
| `[B-902]` | **Ninguna capa inferior conoce a la superior.** El motor no importa de `render/`, `components/`, `modes/` ni `react`. El render no importa React. |
| `[B-903]` | **El motor no hace E/S.** Nada de `fetch`, `localStorage`, `document` ni `window`. [`progreso.ts`](src/engine/progreso.ts) es la única excepción declarada, y recibe el almacén por parámetro. |
| `[B-904]` | **Restricciones del borrado de tipos.** `import type` para tipos, extensión `.ts` explícita, sin `enum` ni `namespace`. |
| — | **Pureza.** `fisica.ts`, `circuito.ts`, `clasificacion.ts`, `objetos.ts`, `economia.ts` y `render/tresd/trazado.ts` son funciones puras: sin React, sin reloj, sin azar propio. `trazado.ts` tampoco importa `three`, y por eso se prueba con números. |
| `[H-3xx]` | **La interfaz no habla en newtons.** «N», «newtons» y «empuje» son unidades internas del motor. Al patrón se le dice qué pasa en el agua. Hay test que lo prohíbe. |

## Restricciones del runner de tests

Los tests corren con `node --test` sobre `.ts` crudo (borrado de tipos nativo de Node ≥ 22.18).
Al escribir cualquier fichero nuevo en `src/engine/` o `src/render/`:

- Importaciones de solo tipos con **`import type`**.
- Especificadores **con extensión `.ts` explícita** (`from '../rng.ts'`).
- **Sin `enum` ni `namespace`** (sintaxis no borrable).

## Órdenes

| Orden | Qué hace |
|---|---|
| `npm run dev` | Vite en local. |
| `npm run lint` | `tsc --noEmit`. Debe quedar limpio. |
| `npm test` | Suite completa (`node --test`). |
| `npm run build` | `vite build` + service worker. |
| `npm run baseline` | **Puerta obligatoria** de todo cambio de regata. Cuatro circuitos, cuatro columnas. |
| `npm run regata-humo <circuito> <vueltas>` | Una regata con detalle: velocidades, estela, objetos, adelantamientos. |
| `npm run objetos-audit` | Comprueba que la ruleta reparte lo que la ayuda promete y que ningún objeto se queda en vuelo. |
| `npm run diversion` | Duración, velocidad de pantalla, huecos sin acontecimiento y pelea por minuto (SPEC-006). `--fase K1`, `--original`. |
| `npm run icons` | Regenera los iconos de la aplicación instalable. |

`main` despliega a Firebase Hosting en cada push
([`deploy.yml`](.github/workflows/deploy.yml)). **No se commitea en `main`:** rama `feature/<kebab>`
y PR.

## Mapa del proyecto

```
src/engine/
  rng.ts             PRNG con semilla. Única fuente de azar        [B-901]
  ritmo.ts           Segundos de simulación por segundo real       [K-101]
  tipos.ts           Contratos de datos. Sin lógica
  fisica.ts          Empuje → velocidad. Puro, sin azar            [B-2xx]
  circuito.ts        Tramos, boyas, vueltas, corriente             [B-1xx]
  carrera.ts         Un tick de regata. Orquesta todo              [B-3xx]
  ia.ts              Táctica de las siete barcas rivales           [B-5xx]
  huevos.ts          Dónde flotan y qué sale de ellos              [H-1xx]
  objetos.ts         Efecto de cada objeto. PURO                   [H-2xx]
  clasificacion.ts   Posiciones, vueltas, tiempos                  [B-4xx]
  barcas.ts          Características efectivas con tripulación     [A-1xx]
  tripulacion.ts     Oficios, peso, plazas                         [A-2xx]
  astillero.ts       Comprar barca y tripulante                    [A-3xx]
  economia.ts        Qué paga cada resultado                       [A-3xx]
  progreso.ts        Guardar. ÚNICA excepción a «sin E/S»          [P-1xx]
  datos/             barcas.ts · tripulantes.ts · circuitos.ts

src/render/          3D real sobre WebGL 2 (three.js)
  paleta.ts          Hora y mar → todos los colores                [R-401]
  tresd/
    trazado.ts       Circuito → eje en el mundo. PURO, sin three   [R-1xx]
    agua.ts          Malla de Gerstner, espuma y estela            [R-2xx]
    barca.ts         La lancha (de modelos.ts), trima de proa      [R-3xx]
    modelos.ts       GENERADO desde arte/barcas/ (Blender). No editar [R-303]
    mundo.ts         Cielo, costa, islas, boyas, niebla            [R-4xx]
    flota.ts         Las ocho lanchas en una llamada de dibujo     [R-3xx]
    vista.ts         Renderizador y cámara. Lo único que toca GL   [R-5xx]

src/juego/motor.ts   Costura entre el motor y React                [R-6xx]
src/components/      Lienzo · Tablero · Mando · FichaBarca
src/modes/           Inicio · Regata · Astillero · Resultado
```

**Los datos viven en `src/engine/datos/`** y son declarativos: cambiar el precio de una barca o el
oleaje de un circuito es cambiar una línea, nunca tocar lógica.

## Cinco cosas que parecen obvias y no lo son

- **La eslora larga no es «mejor», es un compromiso** (`B-202`). La velocidad de casco vale
  `1,25·√eslora`: una barca de 12 m alcanza 4,33 m/s antes de que la resistencia de ola se dispare,
  y una de 6 m, 3,06. Pero la de 12 m vira como un camión. Cuando la resistencia de ola estaba
  puesta como un término lineal más, la eslora era gratis y la barca más larga ganaba el 100 % de
  las regatas medidas: el astillero entero sobraba.
- **Un casco planeador cambia de régimen, no de coeficiente** (`B-203`). Por debajo del umbral de
  planeo paga la barrera de ola entera; por encima, deja de pagarla. Modelarlo como «un poco menos
  de resistencia» borraba el momento en el que la barca se sube encima del agua, que es la única
  razón para comprar un casco planeador.
- **Los huevos NO se compran ni cuestan puntos** (`H-101`). Flotan en el circuito y se rompen
  pasando por encima, todas las veces que quieras. Es la regla que define el sistema de objetos:
  cualquier propuesta de «gastar N doblones por un objeto» contradice la especificación y se
  rechaza sin discutir.
- **Que no te adelanten es un marcador, no una sensación** (`B-702`). `carrera.ts` cuenta cada vez
  que una rival cruza por delante del jugador, y la economía paga por regata limpia (`A-302`). Si
  tocas los carriles o el bloqueo, esa cifra es la que hay que mirar en el arnés, no la posición
  final.
- **Más tripulantes no es siempre más rápido** (`A-202`). Un remero suma empuje y suma 82 kg de
  desplazamiento, y el desplazamiento entra en la resistencia. Llenar las cinco plazas de remeros
  es más lento que cuatro remeros y un timonel en todos los circuitos con curvas. Está medido en
  SPEC-003 §3 `DA3`.
