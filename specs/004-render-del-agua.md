# SPEC-004 — El render del agua

| Campo | Valor |
|---|---|
| **ID** | SPEC-004 |
| **Título** | El agua se mueve, la barca cabecea sobre ella y la cámara mira por donde va el circuito |
| **Estado** | ✅ `COMPLETADA` (Fase R1) |
| **Autor** | — |
| **Creado** | 2026-09-16 |
| **Módulos afectados** | `src/render/**`, `src/juego/motor.ts`, `src/components/Lienzo.tsx` |
| **Depende de** | SPEC-001 (`B-105` posición, `B-1xx` circuito) |
| **Reemplaza** | nada |

---

## 0. Cómo se usa este documento

Reglas de [`WORKFLOW.md`](WORKFLOW.md) sin cambios. **Prefijo: `R-`** (de *render*).

---

## 1. Contexto y problema

### 1.1 Por qué el agua no es un plano azul con una normal map

La primera versión del agua fue lo que es siempre la primera versión del agua: un `PlaneGeometry`
con un color azul, una normal map que se desplaza y un `roughness` bajo. Se ve aceptable en una
captura fija y **se cae en cuanto la barca se mueve**, por una razón concreta: si la superficie es
plana, la barca no puede cabecear, porque no hay nada sobre lo que cabecear. Y sin cabeceo, una
barca a 4 m/s se lee como un icono deslizándose por un fondo.

El agua de este juego es una **malla desplazada por olas de Gerstner** (`R-201`): cuatro trenes de
onda con dirección, longitud y amplitud distintas, sumados en el vértice. Eso da tres cosas de
golpe: una superficie que se mueve, una **función `alturaDeOla(x, z, t)` que el render puede
consultar** para posar cada barca encima (`R-301`), y crestas reales donde poner espuma.

### 1.2 Por qué no se usa Unreal ni Unity

Porque el juego tiene que abrirse desde un enlace, en el móvil de cualquiera, sin instalar nada y
sin descargar cien megas. Eso es una página web, y en una página web el 3D es WebGL 2. three.js es
la capa fina sobre WebGL 2, y lo que este juego dibuja —agua, ocho cascos, una costa— cabe de
sobra. **No vuelvas a proponerlo sin traer una medición de tiempo de carga en 4G.**

---

## 2. Objetivos y no-objetivos

### 2.1 Objetivos

| # | Objetivo | Métrica de éxito |
|---|---|---|
| **RG1** | La barca se apoya en el agua, no encima de ella | La altura de cada barca sale de `alturaDeOla` en su `(x, z)`, con cabeceo y balanceo derivados de la pendiente de la ola |
| **RG2** | Va fluido en un móvil de gama media | ≥ 45 fps con las 8 barcas, el agua y la costa, medido con `?diagnostico=1` |
| **RG3** | El trazado es puro y comprobable con números | `trazado.ts` no importa `three` y tiene tests que no abren un navegador |
| **RG4** | Se ve por dónde va el circuito | La cámara mira al punto del trazado 45 m por delante, no al eje de la barca |

### 2.2 No-objetivos

- **El render no calcula regata.** Ni posiciones, ni colisiones, ni objetos. Lee `EstadoRegata`.
- **No hay reflejos de trazado de rayos ni refracción real.** Fresnel aproximado y color por
  profundidad.
- **No hay modelos importados.** Todas las mallas son procedurales: un `.glb` es un fichero que
  bajar, y `1.1` explica por qué eso importa.

---

## 3. Defectos medidos (auditoría 2026-09-16)

| ID | Fichero | Defecto | Medición | Consecuencia |
|---|---|---|---|---|
| **DR1** | `agua.ts` | Plano con normal map | La barca no cabeceaba: **0,0°** de variación de cabeceo en 30 s | Parecía un icono deslizándose |
| **DR2** | `flota.ts` | Cada barca era una malla propia con su material | **48 llamadas de dibujo** solo para la flota | 22 fps en gama media |
| **DR3** | `vista.ts` | La cámara miraba al eje de la barca | En la curva del tramo 4 de `ria` se veía **la orilla**, no el circuito | No se podía trazar la curva |
| **DR4** | `agua.ts` | La malla del agua era uniforme a 1 m | 640 000 vértices, **2,1 GB** de memoria de vídeo en el móvil de prueba | El navegador mataba la pestaña |
| **DR5** | `trazado.ts` | El render acumulaba su propia distancia recorrida | Boyas y barcas divergían **hasta 11 m** tras 3 vueltas | Las barcas pasaban por dentro de las boyas |
| **DR6** | `trazado.ts` | El error de cierre se repartía MOVIENDO los puntos | `faro` declara 1 380 m de vuelta y la polilínea medía **1 037 m**: el mundo encogido un 25 %, y desigualmente —22 m del motor eran 9,2 m en un sitio y 28,9 m en otro | La cámara se coloca «22 m por detrás» y acababa **dentro** de la barca del jugador. El test de `R-101` estaba en verde: la polilínea cerraba con menos de metro y medio |
| **DR7** | `datos/circuitos.ts` | Las curvas de un circuito no sumaban una vuelta | `faro`: giro total **−0,24 rad** de los 6,28 que hacen falta. `ria`: 3,07 | Ningún arreglo de cierre podía salvarlos: no eran circuitos, eran caminos |

---

## 4. Arquitectura objetivo

```
src/render/
  paleta.ts          NUEVO  Hora y mar → todos los colores            [R-401]
  tresd/
    trazado.ts       NUEVO  Circuito → eje en el mundo. PURO          [R-1xx]
    agua.ts          NUEVO  Gerstner, espuma, estela                  [R-2xx]
    barca.ts         NUEVO  Malla procedural de casco y remos         [R-3xx]
    flota.ts         NUEVO  Las 8 barcas en pocas llamadas            [R-302]
    mundo.ts         NUEVO  Cielo, costa, islas, boyas, huevos        [R-4xx]
    vista.ts         NUEVO  Renderizador y cámara. Lo único que toca GL [R-5xx]
src/juego/motor.ts   NUEVO  Costura motor ↔ React                     [R-6xx]
```

**`trazado.ts` no importa `three`** y por eso se prueba con números (`RG3`). Es la misma lección
que `B-105`: la posición se calcula una vez, en el motor; el trazado solo la coloca en el mundo.

---

## 5. Requisitos

### R-1xx · El trazado

| ID | Requisito | Aceptación |
|---|---|---|
| **R-101** | `construirTrazado(circuito)` convierte los tramos en una polilínea cerrada de puntos `(x, z)` con rumbo acumulado. Las curvas usan su `radio`; las rectas, rumbo constante | La polilínea cierra: distancia entre el primer y el último punto < 1,5 m sobre los 4 circuitos |
| **R-102** | `puntoEn(trazado, metros)` y `rumboEn(trazado, metros)` interpolan. Reciben los metros **del motor** (`B-105`), no los acumulan (`DR5`) | Test: `puntoEn(t, longitudDeVuelta)` ≈ `puntoEn(t, 0)` con error < 1,5 m |
| **R-103** | `lateralDe(carril, carriles, anchura)` da el desplazamiento perpendicular en metros. Es la misma cuenta para barcas, boyas y huevos | Carril 0 de 4 en 18 m de anchura da −6,75 m; carril 3, +6,75 m |
| **R-104** | `trazado.ts` **no importa `three`** | Test estático |
| **R-105** | **Un circuito cerrado gira una vuelta entera.** `giroTotalDe(c) = Σ longitud/radio` sobre las curvas tiene que valer `±2π ± 10 %`. El trazado escala las curvaturas para que cierre exacto, pero si el dato anda lejos, la corrección deforma el circuito | Test sobre los cuatro circuitos: `|giroTotal| ∈ [0,9·2π; 1,1·2π]`. El factor de ajuste queda entre 0,9 y 1,1 |
| **R-106** | **Un metro del motor es un metro del mundo.** El perímetro de la polilínea es la longitud de vuelta declarada, ± 0,5 % | Test sobre los cuatro circuitos. Y 22 m del motor miden entre 15 y 30 m en el mundo en todo el trazado |

### R-2xx · El agua

| ID | Requisito | Aceptación |
|---|---|---|
| **R-201** | **Olas de Gerstner**: 4 trenes con dirección, longitud de onda, amplitud y velocidad distintas, sumados en el vértice del `ShaderMaterial`. La misma suma existe en CPU como `alturaDeOla(x, z, t)` para posar las barcas (`R-301`) | La versión CPU y la GPU usan las mismas constantes, declaradas una sola vez y exportadas |
| **R-202** | **Malla de resolución decreciente** (`DR4`): 1 m cerca de la cámara, hasta 12 m a 400 m. Se centra en la cámara y se mueve con ella | La malla no pasa de **90 000 vértices** |
| **R-203** | La amplitud de las olas la fija `oleajeEn` del circuito (`B-107`), no una constante del render: con `oleaje 0` el agua está casi plana | Con `oleaje 0` la amplitud total < 0,12 m; con `oleaje 1`, > 0,55 m |
| **R-204** | **Espuma en las crestas** y **estela detrás de cada barca**: una tira de geometría que se alarga con la velocidad y se desvanece en 3 s | Parado, la estela mide < 2 m; a 5 m/s, > 14 m |
| **R-205** | El color del agua va por profundidad aproximada y Fresnel contra el cielo, no por un color plano | — |

### R-3xx · Las barcas

| ID | Requisito | Aceptación |
|---|---|---|
| **R-301** | **Cada barca se posa sobre el agua**: su altura es `alturaDeOla` en su `(x, z)`, y su cabeceo y balanceo salen de la pendiente de la ola en dos puntos separados por la eslora y la manga (`DR1`) | El cabeceo varía más de 2° en 30 s con `oleaje ≥ 0,4` |
| **R-302** | **Las 8 barcas van en pocas llamadas de dibujo** (`DR2`): una geometría por tipo de casco, instanciada, con el color por instancia | ≤ **6 llamadas de dibujo** para la flota entera, comprobable en `?diagnostico=1` |
| **R-303** | La malla del casco es procedural y sale de la `eslora`, la `manga` y el `casco` de la barca: una traiñera de 14 m se ve larga y estrecha; una neumática, corta y ancha | La relación eslora/manga de la malla coincide con la del dato ± 5 % |
| **R-304** | Los remos se mueven con la fracción de empuje, no con el reloj: a empuje 0 están quietos | — |
| **R-305** | El casco se hunde con el desplazamiento: una barca con 5 tripulantes va más metida en el agua | El calado de la malla crece con `masa` |

### R-4xx · El mundo

| ID | Requisito | Aceptación |
|---|---|---|
| **R-401** | `paleta.ts` traduce **hora del día y tipo de mar** a todos los colores: cielo, agua, niebla, luz. Es la única fuente de color del render | Test estático: ningún otro fichero de `render/` declara un color literal salvo `paleta.ts` |
| **R-402** | Boyas en cada curva (`B-306`), **colocadas con `puntoEn` y `lateralDe`**, no con coordenadas escritas a mano (`DR5`) | Test: la boya del tramo N está a menos de 2 m del punto del trazado de ese tramo |
| **R-403** | Los huevos se dibujan flotando y bobean con el agua; un huevo roto (`H-105`) no se dibuja | El número de huevos dibujados coincide con los no rotos del estado |
| **R-404** | Costa e islas con volumen, colocadas a partir de la semilla del circuito (`B-901`): mismo circuito ⇒ misma costa | Dos construcciones del mismo circuito dan las mismas posiciones |
| **R-405** | La niebla del objeto `niebla` (`H-206`) empaña la pantalla del jugador mientras dura el efecto, leyéndolo del estado | — |

### R-5xx · La vista

| ID | Requisito | Aceptación |
|---|---|---|
| **R-501** | **La cámara mira al punto del trazado 45 m por delante de la barca**, no al eje de la barca (`DR3`). Va 14 m por detrás y 4,5 m por encima | Test de `trazado.ts`: en la curva del tramo 4 de `ria`, el punto de mira está dentro del circuito |
| **R-502** | El suavizado de la cámara va en **tiempo de regata**, no de reloj: a cámara lenta o acelerada el encuadre es el mismo | — |
| **R-503** | La velocidad abre el campo de visión: de 62° parado a 76° a 8 m/s | — |
| **R-504** | `vista.ts` es el único fichero que toca el `WebGLRenderer` y el lienzo | Test estático |

### R-6xx · El bucle

| ID | Requisito | Aceptación |
|---|---|---|
| **R-601** | El motor avanza a **paso fijo de 0,05 s** con acumulador; el render dibuja a la frecuencia del navegador e interpola. Un fotograma lento no cambia la regata (`B-901`) | Test: 100 ticks de 0,05 s dan el mismo estado que un `avanzar` llamado con dt variables que sumen lo mismo |
| **R-602** | `?diagnostico=1` enseña fps, llamadas de dibujo, vértices y triángulos | — |
| **R-603** | Si el fotograma medio pasa de 30 ms durante 60 fotogramas, se baja la resolución de la malla del agua y se apaga la espuma. **Se declara en pantalla**, no en silencio | — |

---

## 6. Plan de pruebas

### 6.1 Invariantes

- `trazado.ts` no importa `three` (`R-104`).
- El trazado cierra con error < 1,5 m en los 4 circuitos (`R-101`).
- `alturaDeOla` con `oleaje 0` está acotada a ±0,06 m (`R-203`).

### 6.2 Posiciones doradas

| Defecto | Test |
|---|---|
| DR1 | `[R-301]` el cabeceo varía con la ola |
| DR3 | `[R-501]` el punto de mira en la curva está dentro del circuito |
| DR4 | `[R-202]` la malla del agua no pasa de 90 000 vértices |
| DR5 | `[R-102]` el trazado cierra y no acumula distancia propia |

### 6.3 Lo que un test no puede ver

**El render no tiene test de «se ve bien».** `DR1`, `DR2` y `DR3` salieron de mirar capturas con
todos los tests en verde. Antes de cerrar una fase que toque `render/`, abre el juego y mira.

---

## Lo que la medición cambió respecto a lo escrito

| Requisito | Lo que decía la especificación | Lo que dijo la medición |
|---|---|---|
| `R-101` | «El trazado cierra: distancia entre el primer y el último punto < 1,5 m». Y así se implementó: repartiendo el error de cierre entre todos los puntos | **El criterio era insuficiente y estaba en verde con el mundo roto.** Una polilínea puede cerrar perfectamente y medir un 25 % menos de lo que declara, que es justo lo que pasaba en `faro`. Faltaba la otra mitad del contrato: que el PERÍMETRO sea la vuelta (`R-106`). El defecto no se vio en ningún test — se vio en una captura, con la cámara metida dentro de la barca del jugador |
| `R-101` | Daba por hecho que cualquier lista de tramos se podía cerrar | Un circuito cuyas curvas no suman una vuelta entera no es un circuito. Los cuatro estaban mal: `faro` giraba **−0,24 rad** de los 6,28 necesarios. Se arreglaron los datos y se añadió `R-105` para que no vuelva a colarse |

---

## 7. Fases y puertas de salida

### Fase R1 — Agua, flota, mundo y cámara · ✅ **CERRADA 2026-09-16**
**Alcance:** `R-1xx` – `R-6xx`
**Puerta:** `trazado.ts` sin `three` y con tests numéricos; malla ≤ 90 000 vértices; flota ≤ 6
llamadas de dibujo; el juego abre en un navegador de verdad y se ve el circuito.
**Resultado:** 149 tests en verde · `tsc --noEmit` limpio · `vite build` correcto · los cuatro
circuitos abiertos en Chromium, sin un solo error de consola.

| Comprobación | Resultado |
|---|---|
| `R-104` · `trazado.ts` importa `three` | **no** |
| `R-105` · giro total de los 4 circuitos | **6,27 – 6,33 rad** (2π = 6,283) |
| `R-106` · perímetro contra vuelta declarada | **exacto en los 4** |
| `R-106` · 22 m del motor, medidos en el mundo | **18,1 – 25,6 m** en los 4 circuitos (umbral 15–30) |
| `R-202` · vértices de la malla del agua | **14 081** (tope 90 000) |
| `R-302` · llamadas de dibujo, escena completa | **15**, de las cuales 5 son la flota entera (umbral de flota ≤ 6) |
| `R-602` · el diagnóstico responde | fps, llamadas y triángulos, con `?diagnostico=1` |

**Las cifras de fotogramas de la captura no valen como medida de `RG2`**: el navegador del arnés
dibuja por software (SwiftShader), no con la tarjeta gráfica. Lo que sí vale de ahí son las
llamadas de dibujo, los triángulos y —sobre todo— lo que se ve.

---

## 8. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| El `ShaderMaterial` del agua y la versión CPU se separan | Alto | Las constantes de Gerstner se declaran **una vez** y las usan las dos (`R-201`) |
| La malla del agua se come la memoria de un móvil | Alto | Resolución decreciente con tope de vértices comprobado en test (`R-202`) |
| El render se pone a calcular posiciones «porque es más cómodo» | Alto | `DR5` costó 11 m de desviación. `R-102` lo prohíbe y hay test |

---

## 9. Preguntas abiertas

| # | Pregunta | Bloquea | Decisión |
|---|---|---|---|
| **RQ1** | ¿Pantalla partida para dos jugadores? | — | Anotado en `index.md` como trabajo no realizado |
| **RQ2** | ¿Las olas de Gerstner deberían empujar de verdad a la barca? | — | Hoy el oleaje del motor (`B-207`) y el del render (`R-201`) son dos cuentas distintas. Anotado |

---

## Anexo A — Contratos de datos propuestos

```ts
// [R-104] PURO, sin three. Se prueba con números.
export function construirTrazado(circuito: Circuito): Trazado;
export function puntoEn(t: Trazado, metros: number): { x: number; z: number };
export function rumboEn(t: Trazado, metros: number): number;
export function lateralDe(carril: number, carriles: number, anchura: number): number;

// [R-201] La MISMA suma en CPU y en GPU. Constantes declaradas una vez.
export const TRENES: readonly Tren[];
export function alturaDeOla(x: number, z: number, t: number, oleaje: number): number;
```

---

## Anexo B — Mapa de trazabilidad

| Defecto | Requisito | Fase | Estado | Test de regresión |
|---|---|---|---|---|
| DR1 · barca sin cabeceo | `R-301` | R1 | ✅ | `[R-301] la barca se posa sobre la ola` |
| DR2 · 48 llamadas de dibujo | `R-302` | R1 | ✅ | `[R-302] la flota va instanciada` |
| DR3 · cámara a la orilla | `R-501` | R1 | ✅ | `[R-501] el punto de mira va por delante` |
| DR4 · malla de 640 000 vértices | `R-202` | R1 | ✅ | `[R-202] la malla del agua tiene tope` |
| DR5 · distancia duplicada | `R-102` | R1 | ✅ | `[R-102] el trazado cierra` |
| DR6 · mundo encogido un 25 % | `R-106` | R1 | ✅ | `[R-106] un metro del motor es un metro del mundo` |
| DR7 · circuitos que no giran una vuelta | `R-105` | R1 | ✅ | `[R-105] un circuito cerrado gira una vuelta entera` |
