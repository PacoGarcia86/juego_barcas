# SPEC-006 — Ritmo de kart

| Campo | Valor |
|---|---|
| **ID** | SPEC-006 |
| **Título** | Una regata dura tres minutos y pasa algo cada pocos segundos, sin romper el compromiso de los cascos |
| **Estado** | ✅ `COMPLETADA` (Fases K1, K2 y K3 · 2026-09-23) |
| **Autor** | — |
| **Creado** | 2026-09-23 |
| **Módulos afectados** | `src/engine/{carrera,huevos,ia,objetos}.ts`, `src/engine/datos/circuitos.ts`, `src/juego/motor.ts`, `src/render/tresd/vista.ts`, `src/components/{Tablero,Mando}.tsx`, `scripts/` |
| **Depende de** | SPEC-001 (reloj, estela, carriles, `B-702`), SPEC-002 (huevos `H-102`, turbo `H-201`), SPEC-004 (cámara `R-501`) |
| **Reemplaza** | La cadencia fija de huevos de `huevos.ts:52` (`H-102` se reescribió en la fase K1) y la saturación a 8 m/s del FOV de `vista.ts:215` |

---

## 0. Cómo se usa este documento

Se aplican las reglas de [`WORKFLOW.md`](WORKFLOW.md) sin cambios: ID estable por requisito,
comentario `// [ID]` en el código que lo cumple, test nombrado con el ID, y cambio de alcance → se
edita este fichero **antes** que el código.

**Prefijo de este documento: `K-`** (de *kart*). Defectos `DK`, objetivos `KG`, preguntas `KQ`.
Los requisitos de otras especificaciones se citan con su ID original.

---

## 1. Contexto y problema

La queja del jugador: **«las carreras son muy lentas y aburridas; debería ser igual de divertido
que Mario Kart»**. Hay que convertirla en cifras antes de tocar nada.

El motor está bien calibrado *como regata de remo*: la física de casco (`B-202`), la estela
(`B-201`) y la ruleta (`H-1xx`) hacen lo que prometen, y `npm run baseline` pasa su puerta. El
problema no es que algo esté roto, es **el ritmo**:

- **Una regata dura más de doce minutos.** Una carrera de kart dura unos dos. Tres vueltas a una
  ría de 1 060 m a 4,3 m/s son 12 min 20 s; al faro, 17 min.
- **La barca va a 16–20 km/h.** Es la velocidad real de un bote de remo y en pantalla se ve
  como tal.
- **Entre un acontecimiento y el siguiente pasan 45 s.** El único que llega a ritmo fijo es la
  fila de huevos, y está cada 180 m (`H-102`): a 4,3 m/s, una cada 42 s. Entre fila y fila solo se
  mantiene el carril.
- **No hay nada que hacer con las manos aparte de eso.** El mando tiene gas, timón de carril y
  objeto (`Mando.tsx`). No hay salida con cuenta atrás que premie el reflejo, ni una maniobra en la
  curva que premie la habilidad: en un kart, el derrape con miniturbo y el turbo de salida son lo
  que el jugador *hace* entre objeto y objeto.
- **La cámara nunca se lanza.** `vista.ts:215` abre el FOV entre 62° y 76° en función de
  `velocidad / 8`, y ninguna barca pasa de 5,7 m/s: el FOV no pasa de 72°.

Lo que **no** se quiere perder: que la eslora sea un compromiso (`B-202`), que el planeo cambie de
régimen (`B-203`), que los huevos no cuesten nada (`H-101`), que el objetivo sea que no te
adelanten (`B-702`) y que misma semilla dé la misma regata (`B-901`).

---

## 2. Objetivos y no-objetivos

Todas las cifras en **segundos reales de pantalla** salvo que se diga otra cosa, medidas por el
arnés de `K-001` con el piloto medio de `scripts/piloto.ts` sobre las 32 regatas del baseline
(4 circuitos × 8 semillas).

### 2.1 Objetivos

| # | Objetivo | Métrica de éxito |
|---|---|---|
| **KG1** | Una regata dura lo que una de kart | Duración de la regata del jugador: **mediana entre 2,5 y 4 min**, ningún circuito con mediana por encima de 5 min |
| **KG2** | Se va el doble de rápido en pantalla | Velocidad media de la flota, en metros de mundo por segundo real, **≥ 8 m/s** en los cuatro circuitos |
| **KG3** | Pasa algo cada pocos segundos | Hueco máximo sin acontecimiento para el jugador (huevo roto, objeto usado o recibido, turbo, cambio de posición consolidado): **mediana ≤ 12 s, percentil 90 ≤ 20 s** (era «peor ≤ 20 s»: ver «Lo que la medición cambió») |
| **KG4** | Hay pelea todo el rato | Adelantamientos consolidados con la histéresis de `B-702` —**ganados más sufridos**— **≥ 1,5 por minuto** de mediana |
| **KG5** | La habilidad se nota | Un piloto experto que usa la salida (`K-202`) y el miniturbo (`K-203`) gana al piloto medio con la misma barca por **entre 3 % y 10 %** del tiempo total en los cuatro circuitos |
| **KG6** | El astillero sigue teniendo sentido | La puerta del baseline sigue en verde: victoria más alta **< 45 %**, media de adelantamientos sufridos por regata en **`[3, 12]`** (`B-704`), peor 2.º **< 25 %** del tiempo del ganador |

### 2.2 No-objetivos

- **No se toca la física del casco.** `fisica.ts` no cambia: la eslora, el planeo, la
  resistencia y la estela se quedan exactamente como están (ver `K-101`).
- **No hay objetos nuevos ni se cambia qué hace cada uno** (`H-2xx`). Solo cambia cuántas veces
  se rompe un huevo.
- **Los huevos siguen sin costar nada** (`H-101`). Ninguna propuesta de este documento cobra un
  objeto.
- **Sin sonido.** Tiene su propia entrada en «Trabajo identificado y no realizado» de `index.md`.
- **Sin multijugador, sin nuevos circuitos, sin nuevos cascos.** Los cuatro circuitos se
  recortan; no se inventan otros.

---

## 3. Defectos medidos (auditoría 2026-09-23)

Medido con un arnés provisional (el que `K-001` convierte en orden del repositorio): chalana sin
tripulación, `pilotoMedio`, 4 circuitos × 8 semillas, **N = 32**. Cifras en tiempo de simulación,
que hoy es tiempo real.

| ID | Fichero | Defecto | Medición | Consecuencia |
|---|---|---|---|---|
| **DK1** | `datos/circuitos.ts` | La regata dura cinco veces lo que una de kart | Duración del jugador: **mediana 12,4 min**, rango 11,5–17,5 min. Faro, 17,4 min en las 8 semillas | Nadie juega una segunda regata |
| **DK2** | `fisica.ts:36` · `carrera.ts` | La barca va a velocidad de bote de remo | Velocidad media de la flota **4,07–4,75 m/s** (baseline); pico del jugador **4,4–5,7 m/s** | En pantalla, la costa pasa despacio y nada se siente rápido |
| **DK3** | `huevos.ts:52` (`H-102`) | El único acontecimiento con cadencia fija está a 42 s | Hueco máximo sin acontecimiento: **mediana 47 s**, rango 42–146 s. El mínimo coincide con una fila cada 180 m a 4,3 m/s | Medio minuto largo manteniendo el carril sin decidir nada |
| **DK4** | `huevos.ts` · `carrera.ts` | Pocos objetos | Objetos usados por el jugador: **mediana 1,39 por minuto** (rango 0,97–1,50), exactamente una por fila de huevos | El sistema de objetos, lo más «kart» del juego, aparece poco más de una vez por minuto |
| **DK5** | `baseline.ts` (`B-702`) | Poca pelea por minuto | Adelantamientos sufridos: **media 5,5 por regata** de 12,4 min = **0,44 por minuto**. Los ganados no los mide hoy ningún arnés | La posición se decide en la primera vuelta y se mantiene |
| **DK6** | `render/tresd/vista.ts:215` | El FOV satura a 8 m/s y ninguna barca llega | Pico del jugador **5,73 m/s** ⇒ FOV máximo **72°** de los 76° declarados | La cámara nunca transmite velocidad punta |

**Lección de la propia medición** (se anota para que no se repita): contar «cambios de posición»
tick a tick, sin histéresis, dio **28 por minuto** en `faro/8` y **0,08** en `ria/8`. Es el
defecto `DB6` otra vez —dos barcas en paralelo intercambian el orden cada tick—. KG4 se mide con
la histéresis de 3 s de `B-702` o no se mide.

---

## 4. Arquitectura objetivo

```
src/engine/
  carrera.ts        + cuenta atrás y salida (K-202), miniturbo por ceñir (K-203),
                      registro de acontecimientos del jugador (K-303)
  huevos.ts         cadencia de filas en tiempo, no en metros fijos (K-201 → reescribe H-102)
  ia.ts             las rivales también salen y ciñen (K-204)
  datos/circuitos.ts  vueltas y longitudes recortadas (K-102)
  ritmo.ts          NUEVO. RITMO: segundos de simulación por segundo real (K-101). Puro, un dato
src/juego/motor.ts  avanza RITMO·dt de simulación por dt real (K-101)
src/render/tresd/
  encuadre.ts       NUEVO. fovPara(): FOV por velocidad en pantalla. Puro, sin three (K-301)
  vista.ts          usa fovPara, no 8 m/s escrito a mano (K-301)
src/components/
  Tablero.tsx       cuenta atrás y avisos de adelantamiento (K-302, K-303)
  Mando.tsx         sin cambios de controles: el miniturbo usa el timón que ya existe (K-203)
scripts/
  diversion.ts      NUEVO. `npm run diversion`: el arnés de KG1–KG5 (K-001)
```

**Principio que sostiene todo el documento: el ritmo se cambia en el reloj, no en la física.**
El motor sigue simulando regatas de remo con pasos de `PASO` segundos de simulación; la costura
(`motor.ts`) decide cuántos pasos de simulación caben en un segundo real. Todo lo que el motor ya
mide y todas las puertas de SPEC-001/002/003 siguen en segundos de simulación y siguen siendo
válidas. Lo que ve el jugador va `RITMO` veces más rápido. Las capas no cambian: el motor no
sabe que existe un segundo real (`B-902`, `B-903`).

---

## 5. Requisitos

### K-0xx · Medir

| ID | Requisito | Aceptación |
|---|---|---|
| **K-001** | `npm run diversion` corre las 32 regatas del baseline y, por circuito y en total, imprime: duración real, velocidad media de la flota en m/s reales, hueco máximo sin acontecimiento, adelantamientos ganados y sufridos por minuto (histéresis `B-702`), objetos por minuto, y —desde K2— la ventaja del piloto experto sobre el medio. `--fase K1` exige solo los objetivos de esa fase (KG1, KG2); sin `--fase`, todos los que ya se pueden medir. Sale con código ≠ 0 si incumple alguno. `--original` corre con `RITMO` 1 y la copia de los circuitos de antes del recorte (`scripts/circuitos-originales.ts`), **con los huevos de hoy** | `--original` reproducía §3 (±5 %) hasta `K-201`; ver «Lo que la medición cambió». Test `[K-001]` sobre una regata corta: el hueco máximo es ≥ 0 y ≤ la duración |

### K-1xx · Ritmo

| ID | Requisito | Aceptación |
|---|---|---|
| **K-101** | `RITMO` (valor inicial **2,0**; **3** tras la medición de K1, ver «Lo que la medición cambió»; dato en `ritmo.ts`) es cuántos segundos de simulación avanza la costura por segundo real. `fisica.ts` no cambia; el agua de Gerstner y el cielo siguen en tiempo real para que el mar no se vea acelerado | Test `[K-101]`: con la misma semilla, la secuencia de estados del motor es **idéntica** con cualquier `RITMO` (el ritmo solo cambia cuántos pasos por fotograma). `git diff` de la fase no toca `fisica.ts`. `realismo.test.ts` sigue en verde sin tocarlo |
| **K-102** | **Se recortan las vueltas, no la geometría.** Los cuatro circuitos se corren a **2 vueltas** y sus tramos no cambian ni un metro. La primera versión escalaba longitud y radio, y la medición la tumbó: con las curvas más cerradas o las rectas más cortas, `B-202` se rompe (ver «Lo que la medición cambió») | Test `[K-102]`: los cuatro circuitos declaran 2 vueltas y sus tramos son idénticos, uno a uno, a los de `scripts/circuitos-originales.ts`. `npm run diversion`: KG1. `npm run baseline`: KG6 |
| **K-103** | Los tiempos que el jugador tiene que *leer* —cuenta atrás, avisos, el indicador del objeto— van en segundos reales, no de simulación Test `[K-103]`: `segundosReales(s)` de `ritmo.ts` vale `s / RITMO`; los tiempos que enseñan hoy la pantalla —lo que le queda a un efecto (`Aliento.tsx`) y el tiempo final (`RegataMode.tsx`)— pasan por ella. La cuenta atrás de `K-202` se prueba con el mismo criterio en K2 |

### K-2xx · Acción

| ID | Requisito | Aceptación |
|---|---|---|
| **K-201** | **Reescribe `H-102`** (SPEC-002, editado en la fase K1): una fila de huevos cada **~110 m** en vez de cada 180. A la velocidad media del baseline (4,1–4,75 m/s) y `RITMO` 3, es una fila cada **7,7–8,9 s reales**. La fila sigue saliendo del circuito, no de una lista a mano, y sigue sin costar nada (`H-101`). **Se adelanta a K1**: con 2 vueltas (`K-102`) la regata trae menos filas y `HG3` (≥ 12 huevos por regata, puerta de `objetos-audit` en CI) caía a 10 | Test `[K-201]`: para cada circuito, `longitudDeVuelta / filas` cae en `[100, 120]` m y, dividido por 4,4 m/s y por `RITMO`, en `[7, 10]` s reales. `npm run objetos-audit` en verde. `npm run diversion`: KG3 (en K2) |
| **K-202** | **Salida con cuenta atrás.** `crearRegata` acepta `cuentaAtras` (el juego y los arneses la piden; los tests que no, empiezan lanzados como hoy). Durante la cuenta atrás nadie avanza y el `reloj` de la regata no corre. Cuenta, ventana y ahogo son gestos del jugador y van en **segundos reales** (`K-103`): el motor los multiplica por `RITMO`. Lo que cuenta es la **primera vez** que se pide gas a tope (≥ 0,9): en los últimos **0,5 s** da un turbo de salida (×6 durante 1,5 s reales, el factor de `K-203`); antes, un ahogo (`frenado` ×0,5 durante 1 s real); sin pedirlo, nada | Tests `[K-202]`: gas a tope a −0,3 s ⇒ la nave sale con efecto `turbo`; a −1,5 s ⇒ con `frenado`; sin tocar ⇒ sin efecto. El reloj sigue en 0 hasta que acaba la cuenta. Misma semilla ⇒ mismo resultado (`B-901`) |
| **K-203** | **Ceñir la boya con miniturbo.** En un tramo `curva`, mantener el timón hacia el interior estando ya en el carril interior (el de radio efectivo menor, `B-306`) carga un medidor; hoy ese gesto no hace nada. **Soltar el timón o salir de la curva** descarga el medidor: con ≥ 0,8 s reales de carga da un turbo corto (**1,2 s reales**); con ≥ 1,6 s, uno largo (**2,4 s**). El miniturbo empuja **×6**, no ×1,65 como la racha de `H-201`: con ×1,65 el muro de la resistencia de ola (`B-202`) se lo comía y el piloto experto ganaba un 0,8–2,3 % (ver «Lo que la medición cambió»). Salir de la curva cuenta como soltar porque un turbo dentro de la curva no sirve de nada: `B-209` recorta la velocidad a la de viraje. Mientras carga, el límite de viraje de `B-209` baja un 10 %: arriesgar cuesta | Tests `[K-203]`: carga de 1,0 s ⇒ turbo de 1,2 s; de 2,0 s ⇒ de 2,4 s; de 0,5 s ⇒ nada; fuera de curva o fuera del carril interior ⇒ el medidor no sube; salir de la curva con carga ⇒ turbo. KG5 con el piloto experto |
| **K-204** | Las rivales también salen con turbo y ciñen, según su personalidad (`B-501`). **Salida**, sorteada con el `rng` de la regata al acabar la cuenta: clavan la salida `lanzada` 80 %, `sucia` 60 %, `rueda` 45 %, `regular` 35 %; de las que no la clavan, la mitad se ahoga. **Ceñida**: `lanzada` y `sucia` ciñen cada curva en la que van por el carril interior, `rueda` solo en la última vuelta, `regular` nunca, y **ninguna ciñe si va por delante del jugador**: el miniturbo es para cazarle (`B-503`), no para escaparse. Ciñendo también por delante, el grupo se estiraba y KG4 caía a 1,09. Empiezan a cargar cuando lo que les queda de curva son 2 s reales o menos. Sin esto, el miniturbo es una ventaja que solo tiene el jugador y KG4 baja | `npm run baseline` en verde (KG6). Test `[K-204]`: sobre 40 salidas con semillas fijas, cada personalidad clava la salida en la proporción declarada ± 15 puntos. Test: una `lanzada` detrás del jugador, en el carril interior y a menos de 2 s del final de la curva, pide timón hacia dentro; una `regular`, no; la misma `lanzada` por delante del jugador, tampoco |

### K-3xx · Que se note

| ID | Requisito | Aceptación |
|---|---|---|
| **K-301** | El FOV se abre en función de la velocidad **en pantalla** (`velocidad · RITMO`) relativa a la velocidad de casco de la barca del jugador, no a 8 m/s escritos a mano. A velocidad de casco llega al FOV lanzado; con turbo lo supera hasta 82° La función vive en `render/tresd/encuadre.ts`, pura y sin `three`; la vista recibe `ritmo` y la velocidad de casco del jugador desde arriba (`Lienzo`), porque el render solo importa **tipos** del motor (`H-209`). **Reescribe `R-503`** de SPEC-004 («76° a 8 m/s»). El panel `?diagnostico=1` (`R-602`) enseña el FOV del fotograma, para que la puerta de K3 se pueda comprobar en una captura | Test `[K-301]` sobre una función pura `fovPara(vPantalla, vCascoPantalla, turbo)`: devuelve 62° parado, 76° a velocidad de casco, 82° con turbo, y es monótona. `R-501` no se toca |
| **K-302** | El tablero muestra la cuenta atrás (3 · 2 · 1 · ¡Ya!) y, si la salida fue buena, «¡Salida perfecta!»; si se ahogó, que se ahogó. Sin unidades del motor (`H-3xx`) | Test `[K-302]` en el patrón de `higiene.test.ts`: los textos nuevos no contienen «N», «newtons» ni «empuje» |
| **K-303** | El motor registra, por tick, los acontecimientos del jugador en `est.avisos` (adelantamiento ganado o sufrido ya consolidado —los ganados con la misma histéresis de `B-702`—, huevo roto, objeto soltado, golpe recibido, turbo y de dónde viene, ahogo en la salida). La costura (`juego/motor.ts`) los acumula con la hora de la regata, porque React no pinta cada tick; el tablero enseña los recientes durante 2 s reales («¡Te pasa Lancha!», «¡Pasas a Trainera!»). El mismo registro alimenta el hueco máximo de `K-001` | Test `[K-303]`: en una regata con semilla fija, el número de avisos de adelantamiento sufrido es igual a `adelantamientosSufridos`, y el de huevos, a `huevosRotos` |

---

## 6. Plan de pruebas

**Runner:** `node --test` sobre `.ts` crudo. Restricciones que impone el borrado de tipos de Node:
`import type` para importaciones de solo tipos, extensión `.ts` explícita, sin `enum` ni
`namespace`. Las comprueba [`higiene.test.ts`](../src/engine/__tests__/higiene.test.ts).
`ritmo.ts` y `fovPara` son puros: se prueban con números.

### 6.1 Invariantes

- **El ritmo no cambia la regata** (`K-101`): misma semilla, cualquier `RITMO` ⇒ mismos estados.
- **Todo sigue pasando por `rng.ts`** (`B-901`): la salida y el miniturbo de las rivales sortean
  con el `rng` de la regata.
- **Los circuitos cierran** (`R-105`) después del recorte.

### 6.2 Posiciones doradas

- Salida: gas en `−0,3 s` ⇒ turbo; en `−1,5 s` ⇒ ahogo; sin gas ⇒ nada.
- Miniturbo: cargas de 0,5 / 1,0 / 2,0 s ⇒ nada / corto / largo.
- Regresión de §3: con `RITMO = 1` y los circuitos originales, `npm run diversion` reproduce
  DK1–DK5 (±5 %). Se deja como opción del arnés (`--original`) para que la comparación siempre
  se pueda repetir.

### 6.3 Cotas de terminación

La cuenta atrás es un tiempo fijo decreciente, como `restante` de `H-210`. La carga del miniturbo
está acotada a 1,6 s (lo que pase de ahí no da más). Ningún bucle nuevo.

### 6.4 No-regresión

La suite completa sigue en verde. `npm run baseline` sigue pasando su puerta en cada fase.

---

## 7. Fases y puertas de salida

### Fase K1 — Arnés y ritmo · ✅ **CERRADA 2026-09-23**
**Alcance:** `K-001`, `K-101`, `K-102`, `K-103`, `K-201` (adelantado de K2, y la reescritura de
`H-102` en SPEC-002 antes de tocar `huevos.ts`)
**Puerta:** `npm run diversion` reproduce §3 con `--original` y, con el ritmo nuevo, cumple
**KG1** y **KG2**. `npm run baseline` en verde (**KG6**). `npm run objetos-audit` en verde. Lint,
tests y build limpios.
**Resultado:** 170 tests en verde (6 nuevos en `ritmo.test.ts`) · `tsc --noEmit` limpio ·
`vite build` correcto · `baseline`, `objetos-audit` y `diversion --fase K1` superados.

| Comprobación | Resultado |
|---|---|
| `K-001` · `diversion --original` contra §3 | **12,4 min · 47 s de hueco (peor 146) · 1,39 objetos/min**: idéntico a §3. **Corrección (K3):** medido *antes* de aplicar `K-201`; con los huevos de ahora, `--original` ya no lo reproduce (ver «Lo que la medición cambió») |
| `KG1` · duración de la regata | **3,7 min** de mediana (antes 12,4); peor circuito **3,9** (faro y tormenta). Umbral 2,5–4, peor ≤ 5 |
| `KG2` · velocidad de la flota en pantalla | **12,05–12,99 m/s** (antes 4,0–4,4). Umbral ≥ 8 |
| `KG3` · hueco sin acontecimiento (no exigido en K1) | **10 s** de mediana, peor **16 s** (antes 47 y 146). Ya dentro del umbral de K2 |
| `KG4` · pelea (no exigido en K1) | **1,10** adelantamientos/min (antes 0,29). Umbral de K2: 1,5 |
| `KG6` · baseline, velocidad media | **4,06–4,72 m/s** de simulación (antes 4,07–4,75) |
| `KG6` · baseline, diferencia del 2.º | mediana **0,96 s**, peor **1,1 %** del ganador (umbral 0,4–8 s, < 25 %) |
| `KG6` · baseline, adelantamientos sufridos | media **5,3**, rango 0–31 (umbral 3–12) |
| `KG6` · baseline, reparto de victorias | patín **21 %**, trainera 21 %, galeota 12 %, neumática 12 %, lancha 7 %, chalana 2 % (umbral < 45 %; las cinco de pago ganan alguna) |
| `HG3` · huevos del jugador, mínimo en `objetos-audit` | **13** (umbral ≥ 12; con 2 vueltas y filas de 180 m eran 10) |
| `K-101` · misma regata a ritmo 1 y 3 | estados **idénticos** tras 60 s (`deepEqual`) |
| `K-102` · tramos contra la copia de antes | **idénticos** en los 4 circuitos; `R-105`/`R-106` en verde sin tocarlos |
| `K-201` · paso real entre filas | **101–106 m** (ceil de vuelta/110) |

### Fase K2 — Acción · ✅ **CERRADA 2026-09-23**
**Alcance:** `K-202`, `K-203`, `K-204`, y `H-105` de SPEC-002 (reaparición a 1 s: lo pidió la
medición, ver «Lo que la medición cambió»). El piloto medio del arnés (`scripts/piloto.ts`) aprende a
salir: pisa el gas en un momento sorteado del último segundo y pico, así que a veces clava la
salida y a veces se ahoga. Sin eso se ahogaría en todas, porque hoy pide gas desde el primer tick.
El piloto experto de KG5 clava la salida y ciñe cada curva en la que puede.
**Puerta:** **KG3**, **KG4** y **KG5** en `npm run diversion`; **KG6** en `npm run baseline`;
`npm run objetos-audit` en verde.
**Resultado:** 183 tests en verde (13 nuevos en `kart.test.ts`) · `tsc --noEmit` limpio ·
`vite build` correcto · `diversion` (KG1–KG5), `baseline` y `objetos-audit` superados.

| Comprobación | Resultado |
|---|---|
| `KG1` · duración | **3,8 min** de mediana, peor circuito **3,9** |
| `KG2` · flota en pantalla | **12,17–13,08 m/s** |
| `KG3` · hueco sin acontecimiento | mediana **10 s**, percentil 90 **11 s**, máximo 25 s (umbral ≤ 12 y p90 ≤ 20) |
| `KG4` · pelea | **2,16** adelantamientos/min (antes de SPEC-006 0,29; tras K1 1,10). Umbral ≥ 1,5 |
| `KG5` · experto contra medio | ria **8,2 %** · faro **3,1 %** · canal **7,1 %** · tormenta **3,4 %** (umbral 3–10 % en los cuatro) |
| `KG6` · baseline, velocidad media | **4,07–4,76 m/s** de simulación |
| `KG6` · baseline, diferencia del 2.º | mediana **1,23 s**, peor **1,8 %** del ganador |
| `KG6` · baseline, adelantamientos sufridos | media **5,0**, rango 0–14 (umbral 3–12) |
| `KG6` · baseline, reparto | patín **31 %**, galeota 19 %, trainera 12 %, neumática 7 %, lancha 7 %, chalana 0 % (umbral < 45 %; las cinco de pago ganan alguna) |
| `HG3` · huevos del jugador, mínimo | **17** (umbral ≥ 12) |
| `K-202` · salida a −0,3 / −1,5 s / sin tocar | turbo / ahogo / nada; reloj en 0 durante la cuenta |
| `K-203` · carga 0,5 / 1,0 / 2,0 s | nada / turbo ×6 de 1,2 s / de 2,4 s; salir de la curva lo dispara |
| `K-204` · salidas clavadas en 40 sorteos | dentro de ±15 puntos de 80 / 60 / 45 / 35 % |

### Fase K3 — Que se note · ✅ **CERRADA 2026-09-23**
**Alcance:** `K-301`, `K-302`, `K-303`, y `R-503` de SPEC-004 (reescrito por `K-301`)
**Puerta:** tests de los tres requisitos; captura del arnés de render a velocidad de casco con el
FOV en 76° y con turbo en 82°.
**Resultado:** 187 tests en verde (4 nuevos de K3 en `kart.test.ts`) · `tsc --noEmit` limpio ·
`vite build` correcto · `baseline`, `objetos-audit` y `diversion` superados con **las mismas cifras
que tras K2**: los avisos no cambian la regata.

| Comprobación | Resultado |
|---|---|
| `K-301` · `fovPara` | **62°** parado, **76°** a velocidad de casco, **82°** con turbo, monótona |
| `K-301` · en el juego (Chromium, render por software, 10–17 fps, `?diagnostico=1`) | **76°** navegando a tope; **82°** con el miniturbo al salir de una curva ciñendo, y **79–80°** con la racha |
| `K-302` · cuenta atrás en pantalla | «3 · 2 · 1 · ¡Ya!» con la pista «Pisa a tope justo antes de la salida»; sin «N», «newtons» ni «empuje» (test estático) |
| `K-303` · avisos contra marcador (canal, semilla 5) | avisos «te adelantan» = `adelantamientosSufridos`; avisos de huevo = `huevosRotos` |
| `K-303` · en el juego | «¡Galeota te pasa!», «¡Pasas a Trainera!», «¡Miniturbo!», «¡Te han dado!», «Te has ahogado en la salida», «¡Racha de viento!» |
| `K-001` · el arnés lee `est.avisos` | KG1–KG5 **idénticos** a los de su cuenta propia de K2 |

---

## 8. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| A `RITMO` 2 el jugador tiene la mitad de tiempo real para reaccionar en un estrecho | Frustración en `ria` y `canal` | El piloto medio del arnés juega con reacción por tick de simulación; si KG6 se rompe, se baja `RITMO` antes que tocar la IA |
| Las remadas a doble cadencia se ven de dibujos animados | Estético | Es un juego de kart. Si molesta, `R-3xx` puede animar los remos con el reloj real sin tocar el motor |
| Recortar los circuitos acerca las boyas y las curvas cerradas castigan más a las esloras largas | Se rompe `B-202`: la trainera deja de ganar nunca | Se escalan longitud **y** radio por el mismo factor, y el reparto de victorias es la puerta (KG6), no una impresión |
| El miniturbo es tan bueno que ceñir siempre gana | La barca más maniobrable gana todo | KG5 tiene techo (10 %) y KG6 vigila el reparto |
| Con más huevos, la goma elástica de la ruleta (`H-104`) aprieta demasiado | Nadie se escapa, el 2.º siempre a 0 s | La mediana del 2.º sigue con su umbral del baseline (0,4–8 s de simulación) |

---

## 9. Preguntas abiertas

| # | Pregunta | Bloquea |
|---|---|---|
| ~~**KQ1**~~ | **Resuelta 2026-09-23: acelerar el reloj (`K-101`).** ¿Acelerar el reloj (`K-101`, lo propuesto) o reescalar la física para que las barcas vayan de verdad a 9 m/s? Reescalar obliga a reescribir `B-202`, `B-203` y buena parte de `realismo.test.ts`, y los números de CLAUDE.md («una barca de 12 m alcanza 4,33 m/s») dejarían de ser ciertos. El reloj no toca nada de eso | K1 |
| ~~**KQ2**~~ | **Resuelta 2026-09-23: tres vueltas cortas, también en Punta Tormenta (hoy 2).** ¿Tres vueltas cortas o dos largas? El kart usa tres; con tres, cada vuelta de la ría se queda en unos 500 m | K1 |
| ~~**KQ3**~~ | **Cerrada 2026-09-23 sin hacer: queda en «Trabajo identificado y no realizado».** K3 transmite la velocidad con el FOV y los avisos. ¿Mostrar la velocidad en el tablero (nudos o km/h)? Ayuda a sentirla, pero sería la velocidad de pantalla, no la del motor | — |

---

## Resumen de cierre — 2026-09-23

| Objetivo | Umbral | Resultado |
|---|---|---|
| **KG1** · duración | mediana 2,5–4 min, peor circuito ≤ 5 | **3,8 min**, peor **3,9** (antes 12,4 y 17,4) |
| **KG2** · velocidad en pantalla | ≥ 8 m/s en los cuatro | **12,17–13,08 m/s** (antes 4,0–4,4) |
| **KG3** · hueco sin acontecimiento | mediana ≤ 12 s, p90 ≤ 20 s | **10 s**, p90 **11 s** (antes 47 s de mediana) |
| **KG4** · pelea | ≥ 1,5 adelantamientos/min | **2,16** (antes 0,29) |
| **KG5** · la habilidad se nota | 3–10 % en los cuatro | **3,1–8,2 %** |
| **KG6** · el astillero sigue teniendo sentido | baseline en verde | victoria más alta **31 %**, 2.º a **1,23 s**, **5,0** adelantamientos sufridos |

**Defectos corregidos: 6 de 6** (`DK1`–`DK6`). Tres especificaciones cerradas se tocaron por el
camino, con su cambio escrito antes que el código: `H-102` y `H-105` de SPEC-002 y `R-503` de
SPEC-004.

## Lo que la medición cambió respecto a lo escrito

Se escribe según se mide, no al cerrar: el texto de `K-101` y `K-102` ya remite aquí.

| Requisito | Lo que decía la especificación | Lo que dijo la medición (2026-09-23, `npm run baseline` + `npm run diversion`) |
|---|---|---|
| `K-102` | «Se escalan longitud y radio del mismo tramo por el mismo factor, para que el reparto se mantenga» | **Falso: el radio decide `B-202`.** Con los cuatro circuitos escalados (0,53–0,66) y 3 vueltas, el **patín gana el 55–62 %** de sus plazas y **la trainera y la galeota, el 0 %**. Recortando solo las rectas y dejando las curvas, patín 40 % y **lancha y galeota a 0 %**: son barcas de recta y de planeo, y la recta es su terreno. Aislado con dos pruebas: la geometría original a **1 vuelta** mantiene el reparto (máx. 21 %), la geometría escalada a 0,6 con **5 vueltas** (misma distancia) lo rompe. **La duración de la regata no desequilibra; la forma del circuito sí.** Se recortan las vueltas y no se toca un tramo |
| `KQ2` | Resuelta: «tres vueltas cortas» | **No se puede cumplir sin romper el astillero.** Con la geometría intacta y 3 vueltas, KG1 pide `RITMO` 4 y aun así da **4,3 min** de mediana (falla) a 60 km/h de pantalla. Con **2 vueltas y `RITMO` 3**: 3,7 min, 12–13 m/s de pantalla, victoria más alta 21 %. Se corren 2 vueltas |
| `K-101` | `RITMO` inicial 2,0 | **3.** Con 2 vueltas de la geometría original, `RITMO` 2 deja la regata en 5,6 min de mediana (aritmética, no estimación: la regata es idéntica a cualquier ritmo, `K-101`, así que son los 3,7 min × 3/2) |
| `K-201` | Fase K2 | **Se adelanta a K1.** Con 2 vueltas, `HG3` (≥ 12 huevos por regata, puerta de CI) caía a **10**. Con filas cada 110 m: **13** en `objetos-audit`, y el hueco sin acontecimiento baja de 47 s a **10 s** de mediana, con lo que KG3 ya se cumple en K1 |
| `K-203` | Miniturbo con el factor de la racha (×1,65), 0,6 / 1,2 s | **El muro de ola se come el turbo.** El experto ganaba al medio un **0,8–2,3 %** (umbral 3–10 %). Decompuesto: la salida aporta 0,1–1,7 % y la ceñida 0,6–1,7 %. Doblar la duración: 1,0–3,8 %. Un empujón de velocidad al soltar (×1,1 y ×1,2): nada, la resistencia de ola lo drena en dos segundos. Barrido del factor (8 semillas × 4 circuitos): ×2,5 → 1,0–3,7 %; ×4 → 1,9–4,5 %; ×4 con duración doble → 2,6–6,3 %; **×6 con duración doble → 3,8–8,5 %**; ×6 con triple → 4,6–12,7 % (se pasa). Con K2 entero (rivales cazando y reaparición a 1 s), ×6 con duración doble queda en **3,1–8,2 %**: faro, 3,1 %, es el margen más justo. Faro y tormenta, con dos curvas por vuelta, son siempre los que menos premian la ceñida. **Decisión del usuario (2026-09-23): turbo mucho más fuerte antes que rebajar KG5** |
| `K-204` | `lanzada` y `sucia` ciñen todas sus curvas | Con el miniturbo ×6, las que ciñen se escapan: la mediana del 2.º pasa de 0,7 a **4,2 s** y KG4 cae a **1,09**. Que ciñan todas: **1,08**. Que no ciña ninguna: **1,58**. **Que ciñan solo por detrás del jugador: 1,80**, con el 2.º a 1,28 s y la victoria más alta en el 21 % |
| `H-105` | No se tocaba | Se toca: con el grupo más apretado de K2, `HG3` cayó a **10 huevos** en `canal/1`. La reaparición pasa de 2 s a **1 s** de simulación (SPEC-002, «Lo que la medición cambió»): mínimo **17** |
| `KG3` | «Peor ≤ 20 s» sobre las 32 regatas | **El máximo mide el sorteo.** Durante el ajuste de K2, 31 regatas quedaban en 8–21 s y una, `ria/3`, daba **27 s**: el piloto medio lleva un kraken en la mano al final de la regata, sin nadie a 55 m, así que ni lo suelta ni puede coger huevo (`H-103`). Es la lección de `B-704` y de `HG3` otra vez: se exige el **percentil 90**. Con K2 entero (incluida la reaparición de `H-105` a 1 s): mediana **10 s**, percentil 90 **11 s**, máximo **25 s** |
| `K-001` | «`--original` reproduce las cifras de §3» | **Solo mientras los huevos eran los de antes.** `--original` restaura los circuitos y el `RITMO` 1, pero los huevos salen de las reglas de hoy: filas cada 110 m (`K-201`) y reaparición a 1 s (`H-105`). Medido en K3: 12,3 min, hueco de **30 s** (no 47) y **2,28** objetos/min (no 1,39). La reproducción exacta de §3 del cierre de K1 se midió antes de aplicar `K-201`, y el bloque de resultados no lo decía. Se deja así —los huevos de antes no tienen sentido en el juego de ahora— y `--original` queda como «circuitos y ritmo de antes» |
| `DK5` | 0,44 adelantamientos sufridos por minuto | Es la cifra del baseline (parrilla rotada). Con el muestreo de `K-001` (chalana sin tripulación) son **0,08 sufridos + 0,21 ganados = 0,29 por minuto**. KG4 se mide con este último |

---

## Trabajo identificado y no realizado

Se replica en la tabla de [`index.md`](index.md).

| Qué | De dónde sale | Por qué no está hecho |
|---|---|---|
| Tres vueltas por regata | `KQ2` | Solo caben recortando la geometría, y eso rompe `B-202`. Habría que rediseñar los circuitos |
| Que la ceñida premie la habilidad en mar abierto | `KG5` | Faro y tormenta: 3,1–3,4 %, justo por encima del umbral |
| Indicador de carga del miniturbo | `K-203` | No lo pedía ningún requisito. En un móvil no se ve que se está cargando hasta que salta |
| La barra de aliento llama «racha de viento» también al miniturbo y al turbo de salida | `H-303` · `K-203` | `Aliento.tsx` nombra el efecto, no su origen |
| La velocidad en el tablero | `KQ3` | Cerrada sin hacer |
| El panel `?diagnostico=1` queda tapado por los botones en un móvil | `R-602` | Ya pasaba antes de SPEC-006 |

---

## Anexo A — Contratos de datos propuestos

```ts
// src/engine/ritmo.ts — [K-101]
export const RITMO = 2;

// src/engine/tipos.ts
export interface Nave {
  // …
  /** [K-203] Segundos de SIMULACIÓN de carga del miniturbo. */
  cargaMiniturbo: number;
  /** [K-202] Cuenta atrás que quedaba cuando pidió gas a tope por primera vez. `null` = no lo ha pedido. */
  arranque: number | null;
}
export interface EstadoRegata {
  // …
  /** [K-202] Segundos de cuenta atrás que quedan. 0 = en carrera. SOLO decrece. */
  cuentaAtras: number;
  /** [K-303] Acontecimientos del jugador en el último tick. */
  avisos: Aviso[];
}
export type Aviso =
  | { tipo: 'teAdelantan'; quien: number }
  | { tipo: 'adelantas'; quien: number }
  | { tipo: 'huevo' }
  | { tipo: 'usas'; objeto: TipoObjeto }
  | { tipo: 'golpe' }            // el impacto no sabe qué objeto lo causó
  | { tipo: 'ahogo' }
  | { tipo: 'turbo'; origen: 'salida' | 'cenir' | 'objeto' };

// src/render/tresd/vista.ts (o trazado.ts si se quiere probar sin three) — [K-301]
export function fovPara(vPantalla: number, vCascoPantalla: number, turbo: boolean): number;
```

---

## Anexo B — Mapa de trazabilidad defecto → requisito → fase

| Defecto | Requisito | Fase | Estado | Test de regresión |
|---|---|---|---|---|
| DK1 · 12,4 min por regata | K-101, K-102 | K1 | ✅ 3,7 min | `[K-102]` · `npm run diversion` |
| DK2 · 4,1–4,8 m/s | K-101 | K1 | ✅ 12,1–13,0 m/s | `[K-101]` · `npm run diversion` |
| DK3 · 47 s sin que pase nada | K-201, K-202, K-203 | K1/K2 | ✅ 10 s (p90 11) | `[K-201]` · `npm run diversion` |
| DK4 · 1,39 objetos/min | K-201 | K1 | ✅ 6,78/min | `[K-201]` · `npm run objetos-audit` |
| DK5 · 0,44 adelantamientos/min | K-203, K-204, K-303 | K2/K3 | ✅ 2,16/min | `npm run diversion` |
| DK6 · FOV nunca pasa de 72° | K-301 | K3 | ✅ 76° / 82° | `[K-301]` |
