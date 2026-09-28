# SPEC-007 — Que se vea y que suene

| Campo | Valor |
|---|---|
| **ID** | SPEC-007 |
| **Título** | El timón va hacia donde se pulsa, tu barca es la protagonista, lo que se lanza se ve, y la regata tiene ruleta, anuncios y sonido |
| **Estado** | ✅ `COMPLETADA` (Fase V1) |
| **Autor** | — |
| **Creado** | 2026-09-28 |
| **Módulos afectados** | `src/render/tresd/trazado.ts` · `efectos.ts` (nuevo) · `vista.ts` · `flota.ts` · `agua.ts` · `mundo.ts` · `src/render/paleta.ts` · `src/juego/motor.ts` · `src/juego/sucesos.ts` (nuevo) · `src/sonido/` (nuevo) · `src/components/` · `src/modes/RegataMode.tsx` |
| **Depende de** | SPEC-004 (trazado, flota, vista), SPEC-006 (ritmo, cuenta atrás, miniturbo, avisos `K-303`) |
| **Reemplaza** | Las cifras de cámara de `R-501` y el vector «a estribor» de `trazado.ts`, `flota.ts`, `vista.ts` y `agua.ts` |

---

## 0. Cómo se usa este documento

Reglas de [`WORKFLOW.md`](WORKFLOW.md) sin cambios. **Prefijo: `V-`.**

**Nota de origen.** Esta especificación nació en paralelo con SPEC-006 («Ritmo de kart»), en
otra rama, con el mismo prefijo `K-`. SPEC-006 llegó antes a `main` con el ritmo ×3, las dos
vueltas, la cuenta atrás, el miniturbo al ceñir y los avisos del motor. Aquí queda **solo lo que
SPEC-006 no hace**, renumerado a `V-`, y montado encima de su mecánica: no se reescribe ninguna de
sus piezas.

---

## 1. Contexto y problema

Con SPEC-006 la regata tiene ritmo de kart, pero una auditoría de capturas y de números encontró
dos defectos de **juego roto** —el timón va al revés en pantalla y tu barca pasa buena parte de la
regata detrás de una rival en primer plano— y que nada de lo que se lanza existe en la escena.
Tampoco hay ruleta, ni anuncio de vuelta, ni sonido.

---

## 2. Objetivos

| # | Objetivo | Métrica de éxito |
|---|---|---|
| **VG1** | El timón y el dibujo están de acuerdo con el motor | `npm run vista-audit`: carril +1 a la derecha de la pantalla en los 4 circuitos, y el carril interior del motor del lado hacia el que dobla el dibujo en las 14 boyas |
| **VG2** | Tu barca es la protagonista del encuadre | Barca tapada ≤ 3 % de los ticks, y rival en primer plano ≤ 70 % de lo que había con la cámara de antes, en los 4 circuitos (8 semillas, piloto medio de `B-704`) |
| **VG3** | Todo lo que se lanza y todo lo que te pasa se ve | 3 de 3 objetos en vuelo y 5 de 5 efectos con cuerpo en la escena |
| **VG4** | Cada suceso se oye | Un sonido por aviso del motor (`K-303`) y por suceso de pantalla, todo sintetizado: 0 ficheros de audio |
| **VG5** | La regata del motor no se mueve | `npm run baseline` idéntico byte a byte al de `main` |

**No-objetivos:** tocar física, IA, objetos, ritmo, cuenta atrás o miniturbo (SPEC-006); música;
guardar la preferencia de silencio (el progreso guarda la partida, `P-101`, y nada más).

---

## 3. Defectos medidos (auditoría 2026-09-28)

| ID | Fichero | Defecto | Medición | Consecuencia |
|---|---|---|---|---|
| **DV1** | `trazado.ts:186` · `flota.ts:587` · `vista.ts` | **El timón va al revés en pantalla.** El vector «a estribor» era `(cos r, −sin r)`, que mirando por el rumbo con Y arriba es **babor**. `◀` (`timon −1`) llevaba la barca a la DERECHA | 4 de 4 circuitos con el carril +1 a la izquierda de la pantalla. Captura: pulsar ◀ 4 s desplaza la cámara a la derecha | El control básico del juego está invertido |
| **DV1b** | `mundo.ts:234` | Por el mismo vector, **la boya se dibuja por FUERA** de la curva, y el carril interior del motor (el que acorta, y desde el que se ciñe para el miniturbo `K-203`) queda por fuera en el dibujo | 0 de 14 boyas en el interior dibujado | Ceñir la boya se ve como abrirse |
| **DV2** | `vista.ts` | La cámara iba `13 + 1,15·eslora` m por detrás (20 m con una chalana) | Con la mecánica de SPEC-006: rival en primer plano 26,7 % (`ria`) · 37,2 % (`faro`) · 32,7 % (`canal`) · 45,2 % (`tormenta`); barca tapada 3,3–5,8 % | En la captura de salida no se ve la barca propia |
| **DV3** | `render/` | Ningún fichero de `render/` leía `est.objetos` ni los efectos de las naves | 0 de 3 objetos en vuelo y 0 de 5 efectos con cuerpo | Tiras una ola y no pasa nada en pantalla |
| **DV4** | `RegataMode.tsx` | Ni ruleta, ni anuncio de vuelta, de última vuelta o de meta; la tarjeta de meta espera a la última barca | 0 de 4 | El marcador cambia sin que nadie se entere |
| **DV5** | — | No hay sonido | 0 sonidos | — |
| **DV6** | `RegataMode.tsx` | «dejarlo» se monta encima de la casilla del objeto | Captura a 1280×720 | Lo que llevas en la mano no se ve |

---

## 5. Requisitos

### V-1xx · Control y cámara

| ID | Requisito | Aceptación |
|---|---|---|
| **V-101** | **El timón va hacia donde se pulsa.** «A estribor» en el mundo es `(−cos r, +sin r)`: `rumbo × arriba`. Carril +1 cae a la derecha de la pantalla, y el carril interior del motor (`factorDeCarril`) cae del lado hacia el que dobla el dibujo. `lateralDe` no cambia (`R-103`): cambia hacia dónde se aplica. El comentario de `Tramo.radio` decía «positivo = a estribor» y contradecía a `Mando.timon` y a `factorDeCarril`: es **a babor** | Test: en los 4 circuitos, cada 25 m, el carril +1 tiene producto positivo con `derechaDePantalla`; y en cada boya el carril interior del motor está del lado del centro de giro |
| **V-102** | **Cámara de persecución.** `4,5 + 0,7·eslora` m por detrás del centro de la barca y `3,2 + 0,18·eslora` m de altura. Nunca dentro del casco: el retraso supera `eslora/2 + 3` en todo el catálogo. El campo de visión sigue siendo el de `K-301` | Test de `retrasoDeCamara`; arnés: `VG2` |
| **V-103** | Un golpe recibido sacude la cámara 0,35 s con ≤ 0,3 m de amplitud | — (captura) |

### V-2xx · Lo que se ve

| ID | Requisito | Aceptación |
|---|---|---|
| **V-201** | **Cada objeto en vuelo tiene cuerpo.** `ola`: una cresta de espuma que rueda. `ancla`: un boyarín rojo con cadena. `kraken`: tentáculos que asoman y persiguen. Se colocan con `posicionEn` (`R-103`) | Test: la tabla de cuerpos cubre todos los tipos que `usarObjeto` deja en vuelo |
| **V-202** | **Cada efecto se ve en la barca.** `turbo`: chorro de espuma a popa. `burbuja`: esfera irisada. `giro`: la barca da vueltas sobre sí misma. `ciego`: una nube encima. `frenado`: espuma en la proa | Test: la tabla cubre los 5 `TipoEfecto` |
| **V-203** | Un efecto `giro`, `frenado` o `ciego` nuevo en una barca suelta un estallido de espuma | Test: un `giro` nuevo cuenta como golpe; una `burbuja`, no |
| **V-204** | La carga del miniturbo (`K-203`) se ve: chispas blancas cargando, azules al primer nivel y naranjas al segundo. Los umbrales llegan por parámetro: el render no importa valores del motor (`H-209`) | — (captura) |
| **V-205** | Con `turbo` en la barca seguida, el post-proceso (`R-505`) pinta líneas de velocidad en el borde. La saturación sube de ×1,08 a ×1,22 | — (captura) |
| **V-206** | Todo lo de `V-20x` en **≤ 8 llamadas de dibujo** y un solo sistema de partículas. Los colores, en `paleta.ts` (`R-401`) | Test: `Efectos.mallas() ≤ 8` |
| **V-207** | **Los huevos se leen como cajas de objeto**: un 30 % más grandes, a franjas y cada uno de un color del arcoíris, por instancia: siguen siendo una llamada de dibujo (`R-403`) | — (captura) |

### V-3xx · La interfaz

| ID | Requisito | Aceptación |
|---|---|---|
| **V-302** | **Ruleta.** Al romper un huevo la casilla del objeto gira 1 s antes de parar; mientras gira, no se puede usar | — |
| **V-303** | Plaza en grande que late al cambiar, casilla del objeto arriba en el centro, tira de clasificación con el color de las ocho barcas, y «dejarlo» debajo del marcador (`DV6`) | — (captura) |
| **V-304** | **Anuncios** de vuelta nueva, última vuelta y meta, y el objeto que sale de un huevo para la ruleta. Los calcula `sucesosEntre(antes, después, jugador)`, puro. Adelantamientos, golpes, turbos y salida NO: esos los dice el motor (`K-303`) | Test por suceso |
| **V-305** | Un golpe recibido tiñe de rojo el borde de la pantalla | — (captura) |
| **V-306** | **La meta es la del jugador.** El resultado se fija cuando cruza él —su plaza ya no puede cambiar (`B-402`)—; «¡META!» sale entonces y la tarjeta 2,5 s después, mientras las rivales terminan en el agua | Test: el resultado existe en cuanto el jugador tiene `tiempoMeta` y coincide con el de la regata terminada |
| **V-307** | El reloj del tablero es el de pantalla (`K-103`) | — |

### V-4xx · El sonido

| ID | Requisito | Aceptación |
|---|---|---|
| **V-401** | **Todo sintetizado** con Web Audio: osciladores y ruido. 0 ficheros de audio. El ruido sale del PRNG con semilla de `rng.ts` (`B-901`) | Test estático |
| **V-402** | Un sonido por aviso del motor (`K-303`) y por suceso de `V-304`, más la cuenta atrás, la bocina de salida y el tic de la ruleta. La costura entrega cada aviso una sola vez (`sacarAvisosNuevos`) | Tests |
| **V-403** | Ambiente: agua que sube con la velocidad de pantalla y la palada al ritmo del gas | — |
| **V-404** | Se puede silenciar. El audio arranca con el primer gesto del patrón | — |
| **V-405** | `sonido/` es una capa hoja: no conoce la interfaz, el render ni React | Test estático |

---

## 7. Fases y puertas de salida

### Fase V1 — Que se vea y que suene · ✅ **CERRADA 2026-09-28**
**Alcance:** `V-101` – `V-405`
**Puerta:** `npm run lint` · `npm test` · `npm run build` limpios; `npm run vista-audit` superado;
`npm run baseline` idéntico al de `main`; capturas.
**Resultado:** 199 tests en verde (13 nuevos en `vista.test.ts` y `[V-401]` en higiene) ·
`tsc --noEmit` limpio · `vite build` correcto · `npm run baseline` **idéntico byte a byte** al de
`main` (4,07–4,76 m/s · 2.º a 1,23 s de mediana · 5,0 adelantamientos de media · victoria más alta
31 %).

| Comprobación | Resultado |
|---|---|
| `V-101` · carril +1 a la derecha de la pantalla | 4 de 4 circuitos (antes 0 de 4) |
| `V-101` · carril interior del motor en el interior dibujado | 14 de 14 boyas (antes 0 de 14) |
| `V-102` · barca propia tapada | `ria` 3,3 → 1,6 % · `faro` 3,3 → 0,6 % · `canal` 5,8 → 2,6 % · `tormenta` 4,1 → 1,8 % |
| `V-102` · rival en primer plano | `ria` 26,7 → 12,5 % · `faro` 37,2 → 15,4 % · `canal` 32,7 → 14,3 % · `tormenta` 45,2 → 23,8 % |
| `V-206` · llamadas de dibujo de los efectos | 6 (≤ 8) |
| `V-201`/`V-202` · cuerpos en escena | 3 de 3 objetos y 5 de 5 efectos, vistos en captura de una escena sintética |

**Capturas.** La barca propia queda centrada en el tercio inferior. Olas, ancla, kraken,
burbujas, nube, racha y líneas de velocidad se miraron en una escena sintética montada con `Vista`:
el navegador del arnés dibuja por software a ~11 fps (`RG2` de SPEC-004) y en una regata real no
llega a romper un huevo en un tiempo razonable. **El sonido no se ha escuchado** en el arnés.

## Lo que la medición cambió respecto a lo escrito

| Requisito | Lo que decía la especificación | Lo que dijo la medición |
|---|---|---|
| `R-103` | «`lateralDe` da el desplazamiento perpendicular»: el test comprobaba el número y no hacia dónde se aplicaba | **El vector «a estribor» era babor.** El timón iba al revés en pantalla y las 14 boyas se dibujaban por fuera de su curva. Ningún test lo veía porque todos medían distancias, que son simétricas |
| `DV2` | Las capturas hacían pensar que la barca propia pasaba tapada buena parte de la regata | Tapada del todo, solo el 3,3–5,8 %. Lo que robaba el encuadre era la rival de **primer plano** (27–45 %), y por eso el arnés mide las dos cosas |
| `VG2` | Medido primero sin cuenta atrás, en la rama de antes de SPEC-006, la barca tapada salía 2,5–3,2 % con la cámara nueva | Con la salida desde parado de `K-202` y las rivales que ciñen (`K-204`), la misma cámara la deja en 0,6–2,6 %: el arnés tiene que correr la regata que se juega, cuenta atrás incluida |

## Preguntas abiertas

| # | Pregunta | Bloquea |
|---|---|---|
| **VQ1** | ¿Música de regata que acelere en la última vuelta? | — |
