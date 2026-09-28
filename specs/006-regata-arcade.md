# SPEC-006 — Regata arcade: que se vea, que suene y que se juegue

| Campo | Valor |
|---|---|
| **ID** | SPEC-006 |
| **Título** | El timón va hacia donde se pulsa, tu barca es la protagonista, lo que se lanza se ve, y la regata tiene salida, ruleta, avisos y sonido |
| **Estado** | ✅ `COMPLETADA` (Fase K1) |
| **Autor** | — |
| **Creado** | 2026-09-28 |
| **Módulos afectados** | `src/engine/salida.ts` (nuevo) · `src/engine/carrera.ts` · `src/engine/tipos.ts` · `src/juego/` · `src/render/tresd/trazado.ts` · `src/render/tresd/efectos.ts` (nuevo) · `src/render/tresd/vista.ts` · `src/render/tresd/flota.ts` · `src/render/tresd/agua.ts` · `src/sonido/` (nuevo) · `src/components/` · `src/modes/RegataMode.tsx` |
| **Depende de** | SPEC-001 (el tick, los efectos), SPEC-002 (objetos en vuelo, efectos), SPEC-004 (trazado, flota, vista) |
| **Reemplaza** | Las cifras de cámara de `R-501` (`vista.ts:40-54`) y el vector «a estribor» de `trazado.ts:186`, `flota.ts:587`, `vista.ts:208`, `agua.ts:85-88` |

---

## 0. Cómo se usa este documento

Se aplican las reglas de [`WORKFLOW.md`](WORKFLOW.md) sin cambios: ID estable por requisito,
comentario `// [ID]` en el código que lo cumple, test nombrado con el ID, y cambio de alcance → se
edita este fichero **antes** que el código.

**Prefijo de este documento: `K-`.**

---

## 1. Contexto y problema

La regata tiene el motor de un juego serio (SPEC-001) y el agua de un juego de 2026 (SPEC-004),
pero **no se juega como un arcade**. La referencia declarada es el kart de Nintendo: una carrera
corta, una salida con cuenta atrás y premio al que la clava, una ruleta que gira al coger un
objeto, lo que se lanza vuela por la pista y se ve, y cada cosa que pasa suena y se anuncia.

La auditoría de §3 encontró, además, dos defectos que no son de «gusto» sino de **juego roto**:
el timón va al revés en la pantalla y la barca propia pasa buena parte de la regata detrás de una
rival en primer plano.

---

## 2. Objetivos y no-objetivos

### 2.1 Objetivos

| # | Objetivo | Métrica de éxito |
|---|---|---|
| **KG1** | El timón y el dibujo están de acuerdo con el motor | `npm run arcade-audit`: carril +1 a la derecha de la pantalla en los 4 circuitos, y el carril interior del motor del lado hacia el que gira el dibujo en todas las boyas |
| **KG2** | Tu barca es la protagonista del encuadre | Barca tapada ≤ 3 % de los ticks, y rivales en primer plano ≤ 70 % de lo que había con la cámara de antes, en los 4 circuitos (8 semillas) |
| **KG3** | Una regata dura lo que una carrera de kart | El ganador llega en 2,5–5,5 minutos de juego en los 4 circuitos. Antes: 9,8–14,8 |
| **KG4** | Todo lo que se lanza y todo lo que te pasa se ve | 3 de 3 objetos en vuelo y 5 de 5 efectos con cuerpo en la escena (test exhaustivo por tipo) |
| **KG5** | Hay salida | Cuenta atrás de 3 s antes del primer tick; salida perfecta y calada, con test |
| **KG6** | Hay una habilidad de pilotaje que premia | Un piloto que ciñe las boyas gana ≥ 1 s por vuelta al piloto medio, en los 4 circuitos. **Y la puerta de SPEC-001 no se mueve**: la IA no ciñe y `npm run baseline` da las mismas cifras |
| **KG7** | Cada suceso se oye | 12 sonidos por suceso y un ambiente, todos sintetizados: 0 ficheros de audio |

### 2.2 No-objetivos

- **Tocar la física, la IA o los objetos.** El ritmo de juego (`K-201`) acelera el reloj con el
  que se llama al motor, no el motor. La ceñida (`K-204`) y la salida (`K-203`) solo añaden
  efectos `turbo`/`frenado` que ya existen (`H-201`).
- Música. Hay sonidos de suceso y ambiente; una banda sonora es otro trabajo.
- Guardar la preferencia de silencio: el progreso guarda la partida (`P-101`) y nada más.
- Personajes, pilotos con cara, derrapes con cambio de carril libre. Los carriles se quedan.

---

## 3. Defectos medidos (auditoría 2026-09-28)

Medido con `npm run arcade-audit` (nuevo, 4 circuitos × 8 semillas, piloto medio de `B-704`) y con
capturas a 1280×720 del juego en marcha.

| ID | Fichero | Defecto | Medición | Consecuencia |
|---|---|---|---|---|
| **DK1** | `trazado.ts:186` · `flota.ts:587` · `vista.ts:208` | **El timón va al revés en la pantalla.** El vector «a estribor» es `(cos r, −sin r)`, que mirando por el rumbo con Y arriba es **babor**. `◀` (`timon −1`) lleva la barca a la DERECHA | 4 de 4 circuitos con el carril +1 a la izquierda de la pantalla. Captura: pulsar ◀ 4 s desplaza la cámara a la derecha | El control básico del juego está invertido |
| **DK1b** | `mundo.ts:234` | Por el mismo vector, **la boya se dibuja por FUERA** de la curva, y el carril interior del motor (`factorDeCarril`, el que acorta) queda por fuera en el dibujo | 0 de 14 boyas en el interior dibujado | Ceñir la boya —lo que el motor premia— se ve como abrirse |
| **DK2** | `vista.ts:40-54` | La cámara va `13 + 1,15·eslora` m por detrás (20 m con una chalana). Cabe una barca entera entre la cámara y la tuya | Rival en primer plano: 23,2 % (`ria`) · 47,3 % (`faro`) · 22,1 % (`canal`) · 42,5 % (`tormenta`) de los ticks. Tapada del todo: 3,0–8,8 % | En la captura de salida no se ve la barca propia: la pantalla la llenan la trainera y la galeota de detrás |
| **DK3** | `render/` | **Nada de lo que se lanza se dibuja.** Ningún fichero de `render/` lee `est.objetos` ni `nave.efectos` | 0 de 3 objetos en vuelo y 0 de 5 efectos con cuerpo | Tiras una ola y no pasa nada en pantalla; te frena un ancla que nunca has visto |
| **DK4** | `motor.ts` | Una regata dura doce minutos | Ganador: 12,2–12,3 min (`ria`) · 14,5–14,8 (`faro`) · 12,2–12,4 (`canal`) · 9,8–10,0 (`tormenta`) | Tres o cuatro veces una carrera de kart |
| **DK5** | `RegataMode.tsx` | La regata arranca al montar el componente. Ni cuenta atrás, ni ruleta, ni aviso de vuelta, de última vuelta, de adelantamiento ni de meta | 0 de 6 avisos | No hay momento de tensión; el marcador cambia sin que nadie se entere |
| **DK6** | — | No hay sonido | 0 sonidos | — |
| **DK7** | `Tablero.tsx` | El botón «dejarlo» se monta encima de la casilla del objeto | Captura a 1280×720 | Lo que llevas en la mano no se ve |

**Lo que no es defecto:** la barca propia completamente tapada (3,0–8,8 %) es menos de lo que las
capturas sugerían. Lo que las capturas enseñaban era la rival de **primer plano**, que roba el
encuadre aunque no tape del todo: por eso `KG2` mide las dos cosas.

---

## 4. Arquitectura objetivo

```
src/engine/
  salida.ts        NUEVO  Cuenta atrás, calidad de la salida, efecto de salida   [K-202][K-203]
  carrera.ts       MOD    La ceñida: carga en el paso de carriles, suelta turbo  [K-204]
  tipos.ts         MOD    `Nave.cenida`                                          [K-204]
src/juego/
  ritmo.ts         NUEVO  RITMO = 3                                              [K-201]
  motor.ts         MOD    Cuenta atrás y ritmo                                   [K-201][K-202]
  sucesos.ts       NUEVO  Sucesos entre dos estados. PURO                        [K-404]
src/render/tresd/
  trazado.ts       MOD    Vector a estribor, cámara de persecución              [K-101][K-102]
  efectos.ts       NUEVO  Objetos en vuelo, efectos, partículas                 [K-3xx]
  vista.ts         MOD    Cámara, sacudida, líneas de velocidad                  [K-102][K-103][K-305]
  flota.ts         MOD    La barca gira con `giro`                               [K-302]
src/sonido/
  sintetizador.ts  NUEVO  Web Audio. Sin React, sin render. Azar por `rng.ts`    [K-5xx]
src/components/
  CuentaAtras · Ruleta · Avisos · Clasificacion                                  [K-4xx]
```

- **El motor sigue sin reloj.** El ritmo y la cuenta atrás viven en `juego/`, que es la costura
  (`R-6xx`). `salida.ts` es puro: recibe cuándo se pulsó y devuelve la calidad.
- **`sonido/` es una capa hoja**: puede importar `engine/rng.ts` y nada de `render/`, `components/`,
  `modes/` ni React. Entra en la lista de `B-901`.

---

## 5. Requisitos

### K-1xx · Control y cámara

| ID | Requisito | Aceptación |
|---|---|---|
| **K-101** | **El timón va hacia donde se pulsa.** «A estribor» en el mundo es `(−cos r, +sin r)`: `rumbo × arriba`. Carril +1 cae a la derecha de la pantalla, y el carril interior del motor (`factorDeCarril`) cae del lado hacia el que dobla el dibujo. `lateralDe` no cambia (`R-103`): cambia hacia dónde se aplica | Test: en los 4 circuitos, cada 25 m, `posicionEn(c+1) − posicionEn(c)` tiene producto positivo con `derechaDePantalla`; y en cada boya el carril interior del motor está del lado del centro de giro |
| **K-102** | **Cámara de persecución.** Va `4,5 + 0,7·eslora` m por detrás del centro de la barca y a `3,2 + 0,18·eslora` m de altura. Nunca dentro del casco: el retraso supera `eslora/2 + 3` en todo el catálogo | Test de `retrasoDeCamara`; arnés: `KG2` |
| **K-103** | **La cámara reacciona.** El campo de visión sale de la velocidad **que se ve** (`velocidad·RITMO`), +10° con `turbo`, y un golpe recibido sacude la cámara 0,35 s con ≤ 0,3 m de amplitud | — (captura) |

### K-2xx · Ritmo y salida

| ID | Requisito | Aceptación |
|---|---|---|
| **K-201** | **Ritmo de juego ×3.** `juego/motor.ts` avanza el motor `RITMO` segundos de regata por segundo real. **El motor no cambia**: pasos de `PASO` y misma semilla ⇒ misma regata (`B-901`). El agua, el cielo y los huevos se animan con reloj real, no con el de la regata. El tiempo que ve el patrón es el de juego: `tiempo / RITMO` | Arnés: `KG3`. `npm run baseline` idéntico antes y después |
| **K-202** | **Cuenta atrás.** 3 s reales de «3, 2, 1, ¡ya!» antes del primer tick. Durante la cuenta nadie se mueve | Test de `MotorDeRegata`: tras 2,9 s de `tictac` el `reloj` es 0 |
| **K-203** | **Salida perfecta y calada.** Se mira cuándo se pidió «a tope» por última vez antes del ¡ya! y si se sostuvo: en el último segundo (`≤ 1 s` antes) → **perfecta**: `turbo` de 3 s de regata a ×1,65 (una racha, `H-201`). Sostenido desde antes de los 2 s → **calada**: `frenado` de 3 s a ×0,3. Si no, normal | Test de `calidadDeSalida` en los tres casos y de `darSalida` |
| **K-204** | **Ceñir la boya.** En un tramo `curva`, en el carril interior, sin estar cambiando de carril, a más de 1,5 m/s y **apretando el timón hacia dentro**, `nave.cenida` suma segundos. Al soltar el timón o salir de la curva: `≥ 2,5 s` → `turbo` de 3 s; `≥ 5 s` → de 6 s; los dos a ×1,65, como la racha (`H-201`). Con `giro` o `ciego` se pierde la carga. La IA no aprieta contra el borde (`carrilLibre` le dice que no hay carril), así que no ciñe y la puerta de SPEC-001 no se mueve | Tests: carga y suelta en los dos niveles; no carga fuera de curva ni por fuera. Arnés: `KG6` |

### K-3xx · Lo que se ve

| ID | Requisito | Aceptación |
|---|---|---|
| **K-301** | **Cada objeto en vuelo tiene cuerpo.** `ola`: una cresta de espuma que rueda. `ancla`: un boyarín rojo con cadena. `kraken`: tentáculos que asoman y persiguen. Se colocan con `posicionEn` (`R-103`) | Test: la tabla de cuerpos cubre todos los `TipoObjeto` que pueden quedar en vuelo |
| **K-302** | **Cada efecto se ve en la barca.** `turbo`: chorro de espuma brillante a popa. `burbuja`: esfera irisada. `giro`: la barca da una vuelta sobre sí misma. `ciego`: una nube sobre ella. `frenado`: espuma en la proa | Test: la tabla cubre los 5 `TipoEfecto` |
| **K-303** | **Un golpe estalla.** Un efecto `giro`, `frenado` o `ciego` nuevo en una barca suelta un chorro de partículas | — (captura) |
| **K-304** | **La ceñida se ve**: chispas azules al cargar el primer nivel y naranjas al segundo | — (captura) |
| **K-305** | **Líneas de velocidad y color de arcade.** Con `turbo` en la barca seguida, el post-proceso (`R-505`) pinta rayas radiales. La saturación sube de ×1,08 a ×1,22 | — (captura) |
| **K-307** | **Los huevos se leen como cajas de objeto**: un 30 % más grandes, pintados con franjas y cada uno de un color del arcoíris. El color va por instancia: siguen siendo una sola llamada de dibujo (`R-403`) | — (captura) |
| **K-306** | Todo lo de `K-30x` en **≤ 8 llamadas de dibujo** y un solo sistema de partículas | Test: `Efectos.mallas() ≤ 8` |

### K-4xx · La interfaz

| ID | Requisito | Aceptación |
|---|---|---|
| **K-401** | Cuenta atrás en grande, y «¡Salida perfecta!» o «¡Calada!» al ¡ya! | — |
| **K-402** | **Ruleta.** Al romper un huevo la casilla del objeto gira 1 s antes de parar en lo que ha salido; mientras gira, no se puede usar | — |
| **K-403** | Plaza en grande que late al cambiar, y tira de clasificación con el color de las ocho barcas. «dejarlo» no tapa la casilla del objeto (`DK7`) | — |
| **K-404** | **Avisos** por suceso: vuelta nueva, última vuelta, te han pasado, adelantas, te han dado, objeto, meta. Los calcula `sucesosEntre(antes, después, jugador)`, puro, sin mirar la pantalla | Test de `sucesosEntre` por suceso |
| **K-405** | Un golpe recibido tiñe de rojo el borde de la pantalla 0,4 s | — |
| **K-406** | **La meta es la del jugador.** El resultado se fija cuando cruza él —su plaza ya no puede cambiar (`B-402`) y nadie le adelanta en la meta—; «¡META!» sale entonces y la tarjeta 2,5 s después, mientras las rivales terminan en el agua. Antes había que esperar a la última | Test: el resultado de `MotorDeRegata` existe en cuanto el jugador tiene `tiempoMeta`, y coincide con el de la regata terminada |
| **K-407** | El tiempo que se enseña es el de juego (`K-201`): `tiempo / RITMO` | — |

### K-5xx · El sonido

| ID | Requisito | Aceptación |
|---|---|---|
| **K-501** | **Todo sintetizado** con Web Audio: osciladores y ruido. 0 ficheros de audio. El ruido sale de `rng.ts` (`B-901`) | Test estático: `sonido/` sin `Math.random`, sin `fetch` ni ficheros de audio |
| **K-502** | Un sonido por suceso: pitido de cuenta, bocina de salida, tic de ruleta, objeto, racha, golpe, te pasan, adelantas, vuelta, última vuelta, meta, ceñida cargada | Test: la tabla cubre los sucesos de `K-404` y los de la salida |
| **K-503** | Ambiente: agua que sube con la velocidad y la palada al ritmo del gas | — |
| **K-504** | Se puede silenciar. El audio arranca con el primer gesto del patrón (política de reproducción automática) | — |
| **K-505** | `sonido/` no conoce la interfaz ni el render | Test estático en `higiene.test.ts` |

---

## 6. Plan de pruebas

**Runner:** `node --test` sobre `.ts` crudo, con las restricciones de siempre (`import type`,
extensión `.ts`, sin `enum` ni `namespace`).

### 6.1 Invariantes

- `K-101` para los 4 circuitos, cada 25 m y en cada boya.
- `K-201`: `npm run baseline` da **la misma tabla** antes y después.
- `K-501`/`K-505` en `higiene.test.ts`.

### 6.2 Posiciones doradas

- `DK1`: `posicionEn(t, m, 1, n) − posicionEn(t, m, 0, n)` apunta a la derecha de la pantalla.
- `DK2`: `retrasoDeCamara(14,5) > 14,5/2 + 3` (la galeota).
- Salida: pulsar a 0,5 s del ¡ya! → perfecta; sostener desde 2,5 s → calada; a 1,5 s → normal.

### 6.3 Lo que un test no puede ver

Capturas antes/después a 1280×720 en `ria` y `tormenta`: la barca propia en el tercio inferior, una
ola lanzada que se ve rodar, la cuenta atrás y la ruleta.

---

## 7. Fases y puertas de salida

### Fase K1 — Regata arcade · ✅ **CERRADA 2026-09-28**
**Alcance:** `K-101` – `K-505` (con `K-307`, `K-406` y `K-407`)
**Puerta:** `npm run lint` · `npm test` · `npm run build` limpios; `npm run arcade-audit` superado
(`KG1`, `KG2`, `KG3`, `KG6`); `npm run baseline` con la misma tabla que antes; capturas de §6.3.
**Resultado:** 183 tests en verde (19 nuevos de `K-`: 18 en `arcade.test.ts` y `[K-501]` en higiene) · `tsc --noEmit` limpio ·
`vite build` correcto · `npm run baseline` **idéntico byte a byte** al de antes · `objetos-audit` superado.

| Comprobación | Resultado |
|---|---|
| `K-101` · carril +1 a la derecha de la pantalla | 4 de 4 circuitos (antes 0 de 4) |
| `K-101` · carril interior del motor en el interior dibujado | 14 de 14 boyas (antes 0 de 14) |
| `K-102` · barca propia tapada | `ria` 3,9 → 2,5 % · `faro` 3,6 → 0,9 % · `canal` 3,0 → 1,5 % · `tormenta` 8,8 → 2,2 % |
| `K-102` · rival en primer plano | `ria` 23,2 → 8,2 % · `faro` 47,3 → 18,8 % · `canal` 22,1 → 14,4 % · `tormenta` 42,5 → 20,3 % |
| `K-201` · minutos de juego del ganador | `ria` 4,1 · `faro` 4,8–4,9 · `canal` 4,1 · `tormenta` 3,3 (antes 9,8–14,8) |
| `K-204` · lo que gana quien ciñe, por vuelta | `ria` +15,2 s · `faro` +5,7 · `canal` +3,7 · `tormenta` +3,6 |
| `K-204` · la IA no ciñe | `npm run baseline` idéntico: 4,07–4,75 m/s · 2.º a 1,36 s de mediana · 5,5 adelantamientos de media · victoria más alta 19 % |
| `K-306` · llamadas de dibujo de los efectos | 6 (≤ 8) |
| `K-301`/`K-302` · cuerpos en escena | 3 de 3 objetos en vuelo y 5 de 5 efectos, vistos en captura de una escena sintética |

**Capturas (§6.3).** La barca propia queda centrada en el tercio inferior; la cuenta atrás, la
tira de clasificación y la casilla del objeto se ven en la regata real. Olas, ancla, kraken,
burbujas, nube, racha y líneas de velocidad se miraron en una escena sintética montada con
`Vista`: el navegador del arnés dibuja por software a ~11 fps (`RG2` de SPEC-004) y en una regata
real no llega a romper un huevo en un tiempo razonable.

## Lo que la medición cambió respecto a lo escrito

| Requisito | Lo que decía la especificación | Lo que dijo la medición |
|---|---|---|
| `K-204` | La ceñida soltaba 2 s / 4 s de racha a ×1,4 | Con eso el piloto que ciñe ganaba solo +0,5 s por vuelta en `canal`: por encima de la velocidad de casco la barrera de ola (`B-202`) se come casi todo el empuje de más. Con 3 s / 6 s a ×1,65 —el mismo factor que la racha— gana 3,6–15,2 s por vuelta |
| `KG2` | «Rival en primer plano ≤ 60 % de lo de antes» | `canal` se quedó en el 65 %: tres carriles estrechos y codos seguidos hacen que ir de lado con otra barca sea la regata. Se aceptó 70 % y se anota; lo que sí baja a menos de la mitad en los cuatro circuitos es la barca **tapada** |
| `DK2` | Las capturas hacían pensar que la barca propia pasaba tapada buena parte de la regata | Tapada del todo, solo el 3,0–8,8 %. Lo que robaba el encuadre era la rival de **primer plano** (22–47 %), y por eso el arnés mide las dos cosas |
| `K-406` | No estaba escrito: se daba por hecho que la tarjeta de meta salía al terminar la regata | Salía al terminar **la última barca**: con el ritmo ×3 eran hasta un minuto de espera mirando el agua. Se añadió `K-406` |

---

## 8. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| El ritmo ×3 acorta en pantalla los efectos: una racha de 3 s de regata dura 1 s real | Objetos que se notan menos | Es lo que dura un champiñón. Si no basta, se cambia la duración en `objetos.ts` con la puerta de SPEC-002, no el ritmo |
| La ceñida desequilibra a favor del jugador | Adelantamientos sufridos por debajo de `B-704` para un piloto bueno | `B-704` se mide con el piloto MEDIO, que no ciñe. Se anota la ganancia en `KG6` |
| El sonido en móviles no arranca | Silencio | `K-504`: se arranca con el primer gesto |

---

## 9. Preguntas abiertas

| # | Pregunta | Bloquea |
|---|---|---|
| **KQ1** | ¿Merece la IA ceñir también, como las rivales del kart derrapan? Movería la puerta de SPEC-001 y habría que volver a pasarla | — |
| **KQ2** | ¿Música de regata que acelere en la última vuelta? | — |

---

## Anexo B — Mapa de trazabilidad defecto → requisito → fase

| Defecto | Requisito | Fase | Estado | Test de regresión |
|---|---|---|---|---|
| DK1 · timón invertido | K-101 | K1 | ✅ | `[K-101] el carril +1 cae a la derecha de la pantalla` |
| DK1b · boya por fuera | K-101 | K1 | ✅ | `[K-101] el interior del motor es el interior dibujado` |
| DK2 · rival en primer plano | K-102 | K1 | ✅ | `[K-102] la cámara nunca cae dentro del casco…` + arnés |
| DK3 · objetos invisibles | K-301 · K-302 | K1 | ✅ | `[K-301]` · `[K-302]` |
| DK4 · doce minutos | K-201 | K1 | ✅ | arnés |
| DK5 · sin salida ni avisos | K-202 · K-203 · K-4xx | K1 | ✅ | `[K-202]` · `[K-203]` · `[K-404]` |
| DK6 · sin sonido | K-5xx | K1 | ✅ | `[K-501]` · `[K-502]` |
| DK7 · «dejarlo» encima del objeto | K-403 | K1 | ✅ | captura |
