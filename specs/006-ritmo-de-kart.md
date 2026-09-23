# SPEC-006 — Ritmo de kart

| Campo | Valor |
|---|---|
| **ID** | SPEC-006 |
| **Título** | Una regata dura tres minutos y pasa algo cada pocos segundos, sin romper el compromiso de los cascos |
| **Estado** | 📋 `BORRADOR` |
| **Autor** | — |
| **Creado** | 2026-09-23 |
| **Módulos afectados** | `src/engine/{carrera,huevos,ia,objetos}.ts`, `src/engine/datos/circuitos.ts`, `src/juego/motor.ts`, `src/render/tresd/vista.ts`, `src/components/{Tablero,Mando}.tsx`, `scripts/` |
| **Depende de** | SPEC-001 (reloj, estela, carriles, `B-702`), SPEC-002 (huevos `H-102`, turbo `H-201`), SPEC-004 (cámara `R-501`) |
| **Reemplaza** | La cadencia fija de huevos de `huevos.ts:52` (`H-102` se reescribe en la fase K2) y la saturación a 8 m/s del FOV de `vista.ts:215` |

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
| **KG3** | Pasa algo cada pocos segundos | Hueco máximo sin acontecimiento para el jugador (huevo roto, objeto usado o recibido, turbo, cambio de posición consolidado): **mediana ≤ 12 s, peor ≤ 20 s** |
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
  vista.ts          FOV por velocidad en pantalla, no por 8 m/s escrito a mano (K-301)
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
| **K-001** | `npm run diversion` corre las 32 regatas del baseline y, por circuito y en total, imprime: duración real, velocidad media de la flota en m/s reales, hueco máximo sin acontecimiento, adelantamientos ganados y sufridos por minuto (histéresis `B-702`), objetos por minuto, y la ventaja del piloto experto sobre el medio. Sale con código ≠ 0 si incumple KG1–KG5 | Se ejecuta en la fase K1 **antes** de cambiar nada y reproduce las cifras de §3 (±5 %). Test `[K-001]` sobre una regata corta: el hueco máximo es ≥ 0 y ≤ la duración |

### K-1xx · Ritmo

| ID | Requisito | Aceptación |
|---|---|---|
| **K-101** | `RITMO` (valor inicial **2,0**, dato en `ritmo.ts`) es cuántos segundos de simulación avanza la costura por segundo real. `fisica.ts` no cambia; el agua de Gerstner y el cielo siguen en tiempo real para que el mar no se vea acelerado | Test `[K-101]`: con la misma semilla, la secuencia de estados del motor es **idéntica** con cualquier `RITMO` (el ritmo solo cambia cuántos pasos por fotograma). `git diff` de la fase no toca `fisica.ts`. `realismo.test.ts` sigue en verde sin tocarlo |
| **K-102** | Las vueltas y las longitudes de tramo de los cuatro circuitos se recortan hasta cumplir KG1. Se escalan **longitud y radio del mismo tramo por el mismo factor**, para que la vuelta siga cerrando (`R-105`) y el reparto de `B-102` se mantenga | Test `[K-102]`: cada circuito cierra (Σ longitud/radio = ±2π, el test de `R-105` sigue en verde); la proporción de cada tipo de tramo en la vuelta cambia menos de 5 puntos. `npm run diversion`: KG1 |
| **K-103** | Los tiempos que el jugador tiene que *leer* —cuenta atrás, avisos, el indicador del objeto— van en segundos reales, no de simulación | Test `[K-103]`: la cuenta atrás dura 3 s reales con `RITMO` 1 y con `RITMO` 2 |

### K-2xx · Acción

| ID | Requisito | Aceptación |
|---|---|---|
| **K-201** | **Reescribe `H-102`** (se edita SPEC-002 al abrir la fase K2): las filas de huevos se reparten para que, a la velocidad de crucero media del circuito, pase **una fila cada 8–10 s reales**. La fila sigue saliendo del circuito, no de una lista a mano, y sigue sin costar nada (`H-101`) | Test `[K-201]`: para cada circuito, `longitudDeVuelta / filas / vCrucero / RITMO` cae en `[8, 10]`. `npm run objetos-audit` sigue en verde. `npm run diversion`: KG3 |
| **K-202** | **Salida con cuenta atrás.** La regata empieza con 3 s de cuenta atrás en los que nadie avanza. Pedir gas a tope en los últimos 0,5 s da un turbo de salida (`H-201`, 1,5 s); pedirlo antes de eso, un ahogo de 1 s a media fuerza. Lo decide el motor a partir del mando, con el reloj de la regata | Tests `[K-202]`: gas a tope en `t = −0,3 s` ⇒ la nave sale con efecto `turbo`; en `t = −1,5 s` ⇒ con efecto `frenado`; sin tocar ⇒ sin efecto. Misma semilla ⇒ mismo resultado (`B-901`) |
| **K-203** | **Ceñir la boya con miniturbo.** En un tramo `curva`, mantener el timón hacia el interior estando ya en el carril interior carga un medidor (hoy ese gesto no hace nada). Soltarlo con ≥ 0,8 s de carga da un turbo corto (0,6 s); con ≥ 1,6 s, uno largo (1,2 s). Mientras carga, la barca paga la penalización de viraje de `velocidadDeViraje` como si fuera 10 % más rápido: arriesgar cuesta | Tests `[K-203]`: carga de 1,0 s ⇒ turbo de 0,6 s; de 2,0 s ⇒ de 1,2 s; de 0,5 s ⇒ nada; fuera de curva o fuera del carril interior ⇒ el medidor no sube. KG5 con el piloto experto |
| **K-204** | Las rivales también salen con turbo y ciñen, con probabilidad según su personalidad (`B-501`): la `lanzada` casi siempre, la `regular` a veces. Sin eso, el miniturbo es una ventaja que solo tiene el jugador y KG4 baja | `npm run baseline` en verde (KG6). Test `[K-204]`: sobre 20 salidas con semilla fija, cada personalidad clava la salida en la proporción declarada ± 15 puntos |

### K-3xx · Que se note

| ID | Requisito | Aceptación |
|---|---|---|
| **K-301** | El FOV se abre en función de la velocidad **en pantalla** (`velocidad · RITMO`) relativa a la velocidad de casco de la barca del jugador, no a 8 m/s escritos a mano. A velocidad de casco llega al FOV lanzado; con turbo lo supera hasta 82° | Test `[K-301]` sobre una función pura `fovPara(vPantalla, vCascoPantalla, turbo)`: devuelve 62° parado, 76° a velocidad de casco, 82° con turbo, y es monótona. `R-501` no se toca |
| **K-302** | El tablero muestra la cuenta atrás (3 · 2 · 1 · ¡Ya!) y, si la salida fue buena, «¡Salida perfecta!». Sin unidades del motor (`H-3xx`) | Test `[K-302]` en el patrón de `higiene.test.ts`: los textos nuevos no contienen «N», «newtons» ni «empuje» |
| **K-303** | El motor registra, por tick, los acontecimientos del jugador (adelantamiento ganado o sufrido ya consolidado, huevo roto, objeto recibido, turbo); el tablero muestra un aviso breve por cada uno («¡Te pasa la Lancha!», «¡Pasas a la Trainera!»). El mismo registro alimenta el hueco máximo de `K-001` | Test `[K-303]`: en una regata con semilla fija, el número de avisos de adelantamiento sufrido es igual a `adelantamientosSufridos` |

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

### Fase K1 — Arnés y ritmo
**Alcance:** `K-001`, `K-101`, `K-102`, `K-103`
**Puerta:** `npm run diversion` reproduce §3 con `--original` y, con el ritmo nuevo, cumple
**KG1** y **KG2**. `npm run baseline` en verde (**KG6**). Lint, tests y build limpios.

### Fase K2 — Acción
**Alcance:** `K-201`, `K-202`, `K-203`, `K-204` (y la reescritura de `H-102` en SPEC-002 antes de
tocar `huevos.ts`)
**Puerta:** **KG3**, **KG4** y **KG5** en `npm run diversion`; **KG6** en `npm run baseline`;
`npm run objetos-audit` en verde.

### Fase K3 — Que se note
**Alcance:** `K-301`, `K-302`, `K-303`
**Puerta:** tests de los tres requisitos; captura del arnés de render a velocidad de casco con el
FOV en 76° y con turbo en 82°.

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
| **KQ1** | ¿Acelerar el reloj (`K-101`, lo propuesto) o reescalar la física para que las barcas vayan de verdad a 9 m/s? Reescalar obliga a reescribir `B-202`, `B-203` y buena parte de `realismo.test.ts`, y los números de CLAUDE.md («una barca de 12 m alcanza 4,33 m/s») dejarían de ser ciertos. El reloj no toca nada de eso | K1 |
| **KQ2** | ¿Tres vueltas cortas o dos largas? El kart usa tres; con tres, cada vuelta de la ría se queda en unos 500 m | K1 |
| **KQ3** | ¿Mostrar la velocidad en el tablero (nudos o km/h)? Ayuda a sentirla, pero sería la velocidad de pantalla, no la del motor | K3 |

---

## Anexo A — Contratos de datos propuestos

```ts
// src/engine/ritmo.ts — [K-101]
export const RITMO = 2;

// src/engine/tipos.ts
export interface Nave {
  // …
  /** [K-203] Segundos de carga del miniturbo. 0–1,6. */
  cargaMiniturbo: number;
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
  | { tipo: 'golpe'; objeto: TipoObjeto }
  | { tipo: 'turbo'; origen: 'salida' | 'cenir' | 'objeto' };

// src/render/tresd/vista.ts (o trazado.ts si se quiere probar sin three) — [K-301]
export function fovPara(vPantalla: number, vCascoPantalla: number, turbo: boolean): number;
```

---

## Anexo B — Mapa de trazabilidad defecto → requisito → fase

| Defecto | Requisito | Fase | Estado | Test de regresión |
|---|---|---|---|---|
| DK1 · 12,4 min por regata | K-101, K-102 | K1 | 📋 | `[K-102]` · `npm run diversion` |
| DK2 · 4,1–4,8 m/s | K-101 | K1 | 📋 | `[K-101]` · `npm run diversion` |
| DK3 · 47 s sin que pase nada | K-201, K-202, K-203 | K2 | 📋 | `[K-201]` · `npm run diversion` |
| DK4 · 1,39 objetos/min | K-201 | K2 | 📋 | `[K-201]` · `npm run objetos-audit` |
| DK5 · 0,44 adelantamientos/min | K-203, K-204, K-303 | K2/K3 | 📋 | `npm run diversion` |
| DK6 · FOV nunca pasa de 72° | K-301 | K3 | 📋 | `[K-301]` |
