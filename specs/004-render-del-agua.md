# SPEC-004 — El render del agua

| Campo | Valor |
|---|---|
| **ID** | SPEC-004 |
| **Título** | El agua se mueve, la barca cabecea sobre ella y la cámara mira por donde va el circuito |
| **Estado** | ✅ `COMPLETADA` (Fases R1, R2 y R3) |
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

**Auditoría visual 2026-09-23** (capturas de los cuatro circuitos a 1280×720, 7 s de regata):

| ID | Fichero | Defecto | Medición | Consecuencia |
|---|---|---|---|---|
| **DR8** | `flota.ts` | Los puntos de estela sin usar se mandaban a `y = −9999` y la tira los seguía uniendo con los buenos | Un triángulo blanco de **~150 px** cruzando la esquina inferior en `ria`, desde el primer segundo | Parecía un fallo de la tarjeta gráfica, no espuma |
| **DR9** | `agua.ts` | La espuma salía de la altura de la ola, sin más | Manchas blancas de **20–40 m** en `tormenta` y `faro`, lisas y con borde de degradado | Se leía como nieve flotando, no como crestas rompiendo |
| **DR10** | `agua.ts` | El agua no llevaba niebla y el borde de la malla cortaba contra el cielo | Una raya dura en el horizonte en los 4 circuitos; las islas, sí con niebla, salían **más claras que el agua** que tenían delante | El mundo se acababa a 420 m y se notaba |
| **DR11** | `mundo.ts` | La cámara de sombras era la de serie (±5 m alrededor del origen) y `PCFSoftShadowMap` ya no existe en three 0.186 | **0** barcas con sombra fuera del origen; un aviso en la consola en cada regata | Las sombras costaban un pase de dibujo y no se veían |
| **DR12** | `mundo.ts` | Islas = dos icosaedros (roca y un capuchón verde) | Siluetas de globo; con la niebla lineal a **219 m** en `faro`, todas del mismo azul claro | No se leía costa, se leían manchas |

**Auditoría visual de las barcas 2026-09-23** (capturas de cerca, a 5–8 m de cada casco, en `ria`):

| ID | Fichero | Defecto | Medición | Consecuencia |
|---|---|---|---|---|
| **DR13** | `barca.ts` | El casco era un tubo de 13 secciones con una tapa plana a la altura de la borda | **286 triángulos** por casco; borda recta, sin espejo de popa, sin interior | De cerca se leía como una vaina de guisante con tapa, no como una barca |
| **DR14** | `barca.ts` | El remero era una caja con un octaedro encima, sentado **sobre la tapa** | **20 triángulos**; sin brazos ni piernas | Se leían como fichas de parchís, no como gente remando |
| **DR15** | `flota.ts` | El remo giraba sobre su propio eje en vez de barrer, y era corto | La pala quedaba **0,1–0,3 m por encima del agua** en toda la palada; los remos de una chalana se cruzaban | Remos que aletean en el aire: la barca no parecía moverse por ellos |
| **DR16** | `flota.ts` | La vela iba en el plano de crujía, sin palo ni botavara | **0°** de escota; ningún palo | Un triángulo flotando; la del jugador, de canto e invisible (ver `index.md`) |

---

## 4. Arquitectura objetivo

```
src/render/
  paleta.ts          NUEVO  Hora y mar → todos los colores            [R-401]
  tresd/
    trazado.ts       NUEVO  Circuito → eje en el mundo. PURO          [R-1xx]
    agua.ts          NUEVO  Gerstner, espuma, estela                  [R-2xx]
    barca.ts         NUEVO  Malla procedural de casco y remos         [R-3xx]
                     (Fase R3: forma, interior, remero y aparejo  [R-308]–[R-311])
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
| **R-206** | **Detalle y reflejo por píxel.** Encima de la malla de Gerstner, el sombreador de fragmentos suma rizos pequeños procedurales (sin textura que descargar) a la normal, refleja **el mismo cielo que se dibuja** (`R-406`) con Fresnel de Schlick y pone el brillo del sol con la dirección de la luz de la paleta, no una constante | Test estático: el sombreador del agua recibe `direccionSol` como uniforme y no declara una dirección de luz propia |
| **R-207** | **El agua lleva niebla** y funde con el horizonte del cielo (`DR10`): el color de la niebla del agua, la de la escena y el pie del cielo es el mismo de la paleta | Test: la niebla de la escena y el uniforme de niebla del agua salen del mismo campo de la paleta |
| **R-208** | **La espuma se rompe** (`DR9`): sale de la altura de la cresta **multiplicada por un ruido** que se mueve con el agua, no de un umbral liso de altura | — (se mira en la captura: §6.3) |
| **R-209** | **La estela no se estira al vacío** (`DR8`): un punto sin rastro se pliega sobre el último punto bueno de su barca; la tira tiene borde suave y ruido de espuma | Test: tras 3 s de regata ningún vértice de la estela está a más de 30 m de su barca ni por debajo de −3 m |

### R-3xx · Las barcas

| ID | Requisito | Aceptación |
|---|---|---|
| **R-301** | **Cada barca se posa sobre el agua**: su altura es `alturaDeOla` en su `(x, z)`, y su cabeceo y balanceo salen de la pendiente de la ola en dos puntos separados por la eslora y la manga (`DR1`) | El cabeceo varía más de 2° en 30 s con `oleaje ≥ 0,4` |
| **R-302** | **Las 8 barcas van en pocas llamadas de dibujo** (`DR2`): una geometría por tipo de casco, instanciada, con el color por instancia | ≤ **6 llamadas de dibujo** para la flota entera, comprobable en `?diagnostico=1` |
| **R-303** | La malla del casco es procedural y sale de la `eslora`, la `manga` y el `casco` de la barca: una traiñera de 14 m se ve larga y estrecha; una neumática, corta y ancha | La relación eslora/manga de la malla coincide con la del dato ± 5 % |
| **R-304** | Los remos se mueven con la fracción de empuje, no con el reloj: a empuje 0 están quietos | — |
| **R-305** | El casco se hunde con el desplazamiento: una barca con 5 tripulantes va más metida en el agua | El calado de la malla crece con `masa` |
| **R-306** | **El casco tiene tres zonas de color**: obra viva con el color del casco, una **franja** en la borda con el color `franja` de la barca y la **cubierta de madera**. Sin mallas nuevas: una marca por vértice y el color de franja por instancia | Test: la geometría del casco marca borda y cubierta, y la flota sigue en ≤ 6 llamadas (`R-302`) |
| **R-307** | **Se ve quién rema**: un remero por bancada con la camiseta del color `franja`, que se inclina con la boga (`R-304`), y remos con **pala**. Todos los remeros de las ocho barcas van en una sola malla instanciada | La flota entera sigue en **≤ 6 llamadas de dibujo** (`R-302`) |
| **R-308** | **El casco tiene forma de barca** (`DR13`): **arrufo** —la borda sube hacia proa y algo hacia popa—, roda, **espejo de popa**, quilla y, el de desplazamiento, **tingladillo** (tracas solapadas que dan escalón de luz); el planeador, **codillo** vivo entre fondo en V y costado. Y es una barca **abierta**: forro interior, plan, **bancadas** donde se sientan los remeros, regala y cubiertas de proa y popa. Sigue siendo UNA geometría unitaria por tipo de casco (`R-302`) | Test: la borda en proa ≥ 0,15 más alta que en el centro; hay bancadas; ≤ **4 000 triángulos** por casco; la relación eslora/manga sigue en ± 5 % (`R-303`) |
| **R-309** | **La flotación se ve**: por debajo del calado de cada barca el casco lleva **patente** (pintura de fondo) y encima una **línea de flotación** clara. El calado va por instancia y es el MISMO número que hunde la barca (`R-305`) | Test: el atributo de calado por instancia es el de `caladoDe(masa)` y crece con la masa |
| **R-310** | **Remeros con cuerpo y remos que reman** (`DR14`, `DR15`): cabeza redonda con gorra, brazos hasta el guion, piernas; sentados en SU bancada y girando con el casco. El remo pivota en el tolete, **barre** a proa y popa, **la pala entra en el agua** en la palada y sale de plano en la recogida. La pala lleva el color de la franja | Test: en la palada, la pala de cada remo llega por debajo de la superficie de la ola |
| **R-311** | **La vela tiene palo y botavara y va cazada a sotavento** (`DR16`): se abre del plano de crujía según el rumbo contra un viento fijo del circuito, así que **la del jugador se ve desde popa**. Lleva paños y una franja del color de la barca | Test: ninguna vela va a menos de 0,25 rad del plano de crujía |

### R-4xx · El mundo

| ID | Requisito | Aceptación |
|---|---|---|
| **R-401** | `paleta.ts` traduce **hora del día y tipo de mar** a todos los colores: cielo, agua, niebla, luz. Es la única fuente de color del render | Test estático: ningún otro fichero de `render/` declara un color literal salvo `paleta.ts` |
| **R-402** | Boyas en cada curva (`B-306`), **colocadas con `puntoEn` y `lateralDe`**, no con coordenadas escritas a mano (`DR5`) | Test: la boya del tramo N está a menos de 2 m del punto del trazado de ese tramo |
| **R-403** | Los huevos se dibujan flotando y bobean con el agua; un huevo roto (`H-105`) no se dibuja | El número de huevos dibujados coincide con los no rotos del estado |
| **R-404** | Costa e islas con volumen, colocadas a partir de la semilla del circuito (`B-901`): mismo circuito ⇒ misma costa | Dos construcciones del mismo circuito dan las mismas posiciones |
| **R-405** | La niebla del objeto `niebla` (`H-206`) empaña la pantalla del jugador mientras dura el efecto, leyéndolo del estado | — |
| **R-406** | **El cielo es un sombreador**, no una esfera con color por vértice: degradado de la paleta, **disco y halo del sol** en la dirección de la luz, **nubes** procedurales que se mueven y **estrellas** de noche. La función de cielo es una sola y la usa también el reflejo del agua (`R-206`) | Test: el trozo de GLSL del cielo se declara una vez y lo incluyen el cielo y el agua |
| **R-407** | **Costa con relieve** (`DR12`): cada isla es un montículo con ruido, con **playa, verde y roca** por altura, y **pinos** encima. Sigue saliendo de la semilla del circuito (`R-404`) y en pocas llamadas: una malla instanciada para las islas y otra para los pinos | Dos construcciones del mismo circuito dan las mismas matrices (`R-404`) |
| **R-408** | Las boyas llevan **franjas** y una **luz** en el tope que se ve de noche; los huevos son **ovoides** y brillan | — |

### R-5xx · La vista

| ID | Requisito | Aceptación |
|---|---|---|
| **R-501** | **La cámara mira al punto del trazado 45 m por delante de la barca**, no al eje de la barca (`DR3`). Va 14 m por detrás y 4,5 m por encima | Test de `trazado.ts`: en la curva del tramo 4 de `ria`, el punto de mira está dentro del circuito |
| **R-502** | El suavizado de la cámara va en **tiempo de regata**, no de reloj: a cámara lenta o acelerada el encuadre es el mismo | — |
| **R-503** | La velocidad abre el campo de visión: de 62° parado a 76° a **la velocidad de casco de la barca seguida**, y hasta 82° con turbo (**era «a 8 m/s»**: ninguna barca llegaba y el FOV no pasaba de 72°; lo reescribió SPEC-006 `K-301`) | `[K-301]` sobre `fovPara` |
| **R-504** | `vista.ts` es el único fichero que toca el `WebGLRenderer` y el lienzo | Test estático |
| **R-505** | **Post-proceso en HDR**: se dibuja a un objetivo de coma flotante con MSAA, **resplandor** (*bloom*) sobre lo que pasa de 1 —el sol, sus brillos en el agua, los huevos y las luces de las boyas—, viñeta, y el mapeo de tonos y el paso a sRGB **al final, una sola vez**. Por eso los colores de la paleta entran en los sombreadores **en lineal** | Test estático: `vista.ts` monta el compositor y `simplificar` lo apaga (`R-603`) |
| **R-506** | **Las sombras siguen a la barca seguida** (`DR11`): la cámara de sombras es una caja de ±45 m centrada en ella y la luz se mueve con ella en la dirección del sol | — (se mira en la captura) |

### R-6xx · El bucle

| ID | Requisito | Aceptación |
|---|---|---|
| **R-601** | El motor avanza a **paso fijo de 0,05 s** con acumulador; el render dibuja a la frecuencia del navegador e interpola. Un fotograma lento no cambia la regata (`B-901`) | Test: 100 ticks de 0,05 s dan el mismo estado que un `avanzar` llamado con dt variables que sumen lo mismo |
| **R-602** | `?diagnostico=1` enseña fps, llamadas de dibujo, vértices y triángulos | — |
| **R-603** | Si el fotograma medio pasa de 30 ms durante 60 fotogramas, se baja la resolución de la malla del agua y se apaga la espuma. **Se declara en pantalla**, no en silencio. Desde la Fase R2 también se apagan el resplandor (`R-505`) y las sombras (`R-506`) | — |

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

### Fase R2 — Que se vea como un juego de 2026 · ✅ **CERRADA 2026-09-23**
**Alcance:** `R-206` – `R-209`, `R-306`, `R-307`, `R-406` – `R-408`, `R-505`, `R-506`; y `R-603` ampliado
**Puerta:** los tests de siempre en verde más los nuevos; la flota **sigue en ≤ 6 llamadas**; la malla
del agua **sigue en ≤ 90 000 vértices**; los cuatro circuitos abiertos en Chromium sin errores ni
avisos de consola, y **las capturas antes/después miradas** (`§6.3`): ni triángulo de estela, ni
manchas de espuma, ni raya en el horizonte.
**Resultado:** 159 tests en verde (10 nuevos en `render-aspecto.test.ts`) · `tsc --noEmit` limpio ·
`vite build` correcto · los cuatro circuitos abiertos en Chromium sin un error ni un aviso de consola.

| Comprobación | Resultado |
|---|---|
| `R-302` · mallas de la flota, con remeros | **6** (umbral ≤ 6) |
| `R-202` · vértices de la malla del agua | **14 081**, sin cambio (tope 90 000) |
| `R-209` · vértices de estela lejos de su barca tras 3 s | **0** (antes: la mitad de la tira a y = −9999) |
| `R-209` · largo de la estela a más de 2,5 m/s | **> 14 m** (antes: 0,4 s de estela, unos 2 m) |
| `R-407` · islas dentro del agua navegable, 4 circuitos | **0** |
| Llamadas de dibujo, escena completa | **35** (antes 15): el resplandor son ~10 pases a pantalla completa y la sombra, uno más. La flota sigue en 6 |
| Triángulos por fotograma | **134 k – 156 k** (antes 57 k – 59 k): el pase de sombras y las islas con relieve. Las islas no echan sombra, que costaba 70 k más |
| Paquete de la aplicación | **233,9 KB** comprimido (antes 225,2): +8,7 KB. Ni una textura ni un modelo que descargar (`§1.2`) |
| `DR8` – `DR12` en captura | Sin triángulo de estela, sin manchas de espuma, sin raya en el horizonte, sombras en la flota, islas con playa, verde, roca y pinos |

**Lo que la medición cambió:** la primera espuma nueva (umbral de cresta + ruido) **seguía haciendo
manchas** en `faro` y `tormenta`: con la cresta alta, el ruido pasaba el umbral en todas partes. Lo
que funcionó fue lo contrario: que la cresta BAJE el umbral del ruido, y que sin cresta no haya
espuma. La estela también salió demasiado ancha la primera vez (hasta 1,8 mangas por lado: una
chalana dejaba una mancha de 7 m); se quedó en 1,1. Y al mirar las capturas salieron dos defectos que
ningún test veía: **las barcas cabeceaban al revés que la ola** (el giro en X baja la proa y
`cabeceo` es positivo con la proa arriba) y **los huevos y las boyas se colocaban con el ángulo del
punto visto desde el origen**, no con el rumbo del circuito: ahora usan `posicionEn`, la misma cuenta
que las barcas (`R-402`).

---

### Fase R3 — Barcas que se leen como barcas · ✅ **CERRADA 2026-09-23**
**Alcance:** `R-308` – `R-311`
**Puerta:** los tests de siempre en verde más los nuevos; la flota **sigue en ≤ 6 llamadas** (`R-302`);
cada casco en **≤ 4 000 triángulos**; los cuatro circuitos abiertos en Chromium sin errores ni avisos
de consola, y **las capturas antes/después miradas** (`§6.3`), de cerca y en la vista de juego.
**Resultado:** 164 tests en verde (5 nuevos en `render-barcas.test.ts`) · `tsc --noEmit` limpio ·
`vite build` correcto · los cuatro circuitos abiertos en Chromium sin un error ni un aviso de consola.

| Comprobación | Resultado |
|---|---|
| `R-302` · mallas de la flota | **6**, sin cambio (umbral ≤ 6) |
| `R-308` · triángulos por casco | **2 264** desplazamiento · **2 034** planeador (antes 286; tope 4 000) |
| `R-310` · triángulos por remero | **468** (antes 20) |
| `R-310` · hondura de la pala | **0,08 – 0,29 m** bajo la ola en la palada; **0,38 – 0,86 m** fuera en la recogida (antes, siempre fuera) |
| `R-311` · escota | **≥ 0,32 rad** del plano de crujía en todas las barcas, todo el rato |
| Llamadas de dibujo, escena completa | **35**, sin cambio |
| Triángulos por fotograma, mismo arnés y mismo instante | **190 k – 212 k** (antes 138 k – 156 k): +55 k, la mitad es el pase de sombras |
| Paquete de la aplicación | **237,5 KB** comprimido (antes 233,9): +3,6 KB. Ni una textura ni un modelo |

**Lo que la medición cambió:** la primera versión tenía **el mar dentro de la lancha**: con el calado
de antes (hasta 0,62 del puntal) la línea de flotación de una barca cargada quedaba por encima del
plan, y en la captura se veía agua entre las bancadas. El calado se quedó en 0,26 – 0,44 (`caladoDe`),
que sigue creciendo con la masa (`R-305`). Además: **el remo no barría**, giraba sobre su propio eje
—el giro en X de antes era el de la caña, no el de la palada—, y el espejo de popa salió con las
caras al revés y se veía el interior por detrás. Con 34 secciones y tres puntos por traca el casco
llegaba a 3 356 triángulos; con dos puntos por traca (una tabla es plana) y 30 secciones no se nota
y baja a 2 264.

### Fase «lanchas de Blender» (rama `main`, PR #3) · 🗄️ **RETIRADA 2026-09-23**

Se cerró el 2026-09-17 en `main` mientras R2 y R3 se hacían en otra rama
(`claude/boat-racing-game-w47dng`), y las dos historias se separaron. Esta fase **sustituía todas
las barcas por una sola lancha de consola modelada en Blender** (`arte/barcas/`: `modelar.py` →
`barcas.blend` → `exportar.py` → `src/render/tresd/modelos.ts`, casco a partir de
`lancha_low_poly.glb` de JuanSimon, CC BY 4.0), sin vela ni remos, con trima de proa según el gas
y las ocho barcas en una `InstancedMesh`.

**Se retira por decisión del usuario (2026-09-23)**: el juego vuelve a las seis barcas de R2 y R3,
distintas entre sí, con remeros, remos y vela. Con una sola lancha, las barcas del astillero se
veían iguales aunque navegasen distinto, y el astillero vende remeros que no se veían a bordo.

**Qué se retira:** `src/render/tresd/modelos.ts`, la `barca.ts` y la `flota.ts` de esa fase y sus
tests (`[R-303]` lancha unitaria, `[R-304]` trima, `[R-306]` pintura por instancia, `[R-305]`
holgura de la bañera). **Qué se conserva:** los ficheros fuente de `arte/barcas/` (el modelo, los
guiones de Blender y `CREDITOS.md`), que ya no se usan en el juego, por si se quiere recuperar la
lancha.

**Choque de IDs.** Aquella fase reescribió `R-302`–`R-306` y usó `DR8` para «el agua tapaba la
bañera de la lancha». En este documento esos IDs conservan el significado de R1, R2 y R3 (`DR8` es
«los puntos de estela sin usar se iban a `y = −9999` y pintaban un triángulo al vacío»). Lo que la fase de Blender midió queda aquí con su nombre propio
para que un `grep` no los cruce:

| ID | Lo que midió aquella fase |
|---|---|
| **DRB1** (era su `DR8`) | Con la quilla de la lancha en −0,552 puntales, la flotación de la galeota cargada quedaba a −0,155 y el suelo de la bañera a −0,325: el agua tapaba la bañera. Con 153 tests en verde, solo se vio en una captura |
| **DRB2** | Llamadas de dibujo de la escena: **10–11** con la lancha instanciada, contra **16** con el mismo arnés antes de esa fase. La flota, en 2 |

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
| DR8 · triángulo de estela al vacío | `R-209` | R2 | ✅ | `[R-209] la estela no se estira al vacío` |
| DR9 · espuma en manchas | `R-208` | R2 | ✅ | captura (§6.3) |
| DR10 · raya en el horizonte | `R-207` | R2 | ✅ | `[R-207] el agua, la escena y el cielo comparten niebla` |
| DR11 · sombras en el origen | `R-506` | R2 | ✅ | captura (§6.3) |
| DR12 · islas de globo | `R-407` | R2 | ✅ | `[R-404] mismo circuito, misma costa` |
| DR13 · casco de vaina con tapa | `R-308` | R3 | ✅ | `[R-308] el casco tiene arrufo, bancadas y tope de triángulos` |
| DR14 · remeros de parchís | `R-310` | R3 | ✅ | captura (§6.3) |
| DR15 · remos que no tocan el agua | `R-310` | R3 | ✅ | `[R-310] la pala entra en el agua en la palada` |
| DR16 · vela de canto sin palo | `R-311` | R3 | ✅ | `[R-311] la vela va cazada, fuera de crujía` |
