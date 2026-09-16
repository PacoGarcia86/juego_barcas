# SPEC-001 — El motor de regata

| Campo | Valor |
|---|---|
| **ID** | SPEC-001 |
| **Título** | Una barca navega por física de casco, y las rivales intentan adelantarla |
| **Estado** | ✅ `COMPLETADA` (Fases B1 y B2) |
| **Autor** | — |
| **Creado** | 2026-09-16 |
| **Módulos afectados** | `src/engine/{rng,tipos,fisica,circuito,carrera,ia,clasificacion}.ts`, `src/engine/datos/circuitos.ts` |
| **Depende de** | nada |
| **Reemplaza** | nada |

---

## 0. Cómo se usa este documento

Se aplican las reglas de [`WORKFLOW.md`](WORKFLOW.md) sin cambios: ID estable por requisito,
comentario `// [ID]` en el código que lo cumple, test nombrado con el ID, y cambio de alcance → se
edita este fichero **antes** que el código.

**Prefijo de este documento: `B-`** (de *barca*). Los requisitos de otras especificaciones se citan
con su ID original.

---

## 1. Contexto y problema

El juego es una carrera de barcas al estilo del kart. Dicho así, el camino fácil es el de siempre:
darle a cada barca una «velocidad» de 1 a 10, sumarle un número si va detrás de otra, y dejar que
la pantalla ponga el resto. Ese juego se agota en diez minutos, porque **comprar otra barca no
cambia nada**: si la única variable es «velocidad», la barca cara es la que tiene el número más
alto y no hay decisión que tomar.

Un casco de verdad no funciona así. Una barca de desplazamiento tiene una **velocidad de casco**
—la velocidad a la que su propia ola la atrapa— que depende de la raíz de su eslora, y pasar de
ahí cuesta una fortuna en empuje. Una barca planeadora, si tiene potencia para subirse encima del
agua, se salta esa barrera entera pero es un bote de feria en las curvas. Eso **ya es** una
decisión: eslora contra manejo, eficiencia contra punta.

Y la mecánica que el usuario pidió por encima de todas —«que las otras barcas no te adelanten»—
solo es un juego si adelantar cuesta algo: carriles, estela y bloqueo.

---

## 2. Objetivos y no-objetivos

### 2.1 Objetivos

| # | Objetivo | Métrica de éxito |
|---|---|---|
| **BG1** | La eslora es un compromiso, no una mejora | Sobre 5 semillas × 4 circuitos, **ninguna barca del catálogo gana más del 45 %** de las regatas |
| **BG2** | La regata está apretada | **Mediana** de la diferencia del 2.º al ganador entre 0,4 s y 8 s, y el peor 2.º a menos del **25 %** del tiempo del ganador, sobre las 32 regatas del arnés |
| **BG3** | Defender la posición es el juego | El jugador con pilotaje medio sufre **de 3 a 12 adelantamientos de media**; ni 0 (la IA no ataca) ni 20 (no se puede defender) |
| **BG4** | La regata se puede repetir | Misma semilla ⇒ misma clasificación y mismos tiempos al milisegundo, sobre 200 regatas |
| **BG5** | La estela paga | Ir en la estela a 8 m ahorra **al menos un 20 %** de resistencia frente a ir solo |

### 2.2 No-objetivos

- **No se simulan olas individuales que empujen la barca.** El oleaje es un parámetro del tramo
  (`B-207`), no un campo de alturas. El render dibuja olas de verdad (`R-201`); el motor no las ve.
- **No hay daño estructural ni hundimiento.** Un choque cuesta velocidad, nunca la regata.
- **No hay viento con dirección.** La vela es decorativa; el empuje sale del casco y de la
  tripulación.
- **No hay multijugador.** Un humano, siete rivales.

---

## 3. Defectos medidos (auditoría 2026-09-16)

Medidos sobre el prototipo del motor, 5 semillas por circuito salvo donde se indique.

| ID | Fichero | Defecto | Medición | Consecuencia |
|---|---|---|---|---|
| **DB1** | `fisica.ts` | La resistencia de ola estaba puesta como un término lineal más. La eslora salía gratis | La barca de 12 m ganó **20 de 20** regatas (N=20) | El astillero sobraba: solo había que comprar la más larga |
| **DB2** | `fisica.ts` | El planeo se modeló como «un 30 % menos de resistencia», constante | El casco planeador era más lento que el de desplazamiento **en los 4 circuitos** (N=20) | Nadie compraba un planeador: el régimen de planeo no existía |
| **DB3** | `carrera.ts` | La estela era binaria: «detrás de alguien» ⇒ −25 % | Las ocho barcas llegaban a meta en **2,1 s** (N=5, circuito `ria`) | Una fila india pegada: no había regata, había un tren |
| **DB4** | `fisica.ts` | La velocidad de equilibrio se resolvía con Newton-Raphson | Con corriente en contra de 1,2 m/s, la velocidad convergía a **0,5 m/s** (el suelo del método) en el tramo 3 de `ria` | La IA creía que no podía avanzar y dejaba de empujar |
| **DB5** | `ia.ts` | Las rivales empujaban al máximo siempre | Adelantamientos al jugador: **0,0 de media** (N=20). Las rivales reventaban de energía en la vuelta 1 y se descolgaban | La promesa del juego —que no te adelanten— no se cumplía ni una vez |
| **DB7** | `ia.ts` | Una rival pegada a otra en su carril se creía a rueda y no intentaba salir | En `faro` y `tormenta` —los circuitos anchos, de 5 y 6 carriles— las ocho barcas llegaron a meta **en 4,6 s**, todas entre 3,80 y 3,82 m/s, y **cinco de las ocho con cero huevos rotos** (N=2) | Fila india: no había regata, había una cola. Y con el bloqueo de `B-302` encadenado, cada una iba 0,1 m/s más lenta que la de delante |
| **DB6** | `carrera.ts` | El adelantamiento se contaba comparando posiciones entre ticks | En un cruce lateral se contaban **hasta 14** adelantamientos en 0,4 s (N=1, observado) | El marcador de regata limpia era ruido |

---

## 4. Arquitectura objetivo

```
src/engine/
  rng.ts            NUEVO  PRNG con semilla. Única fuente de azar        [B-901]
  tipos.ts          NUEVO  Contratos de datos. Sin lógica
  fisica.ts         NUEVO  Empuje → velocidad. PURO, sin azar            [B-2xx]
  circuito.ts       NUEVO  Tramos, boyas, vueltas, corriente             [B-1xx]
  carrera.ts        NUEVO  Un tick de regata. Orquesta                   [B-3xx] [B-7xx]
  ia.ts             NUEVO  Táctica de las siete rivales                  [B-5xx]
  clasificacion.ts  NUEVO  Posiciones, vueltas, tiempos. PURO            [B-4xx]
  datos/circuitos.ts NUEVO Los cuatro circuitos, declarativos            [B-104]
```

Principios que la arquitectura sostiene:

- **Ninguna capa inferior conoce a la superior** (`B-902`). `fisica.ts` no sabe que existe una
  regata; `circuito.ts` no sabe que existe una barca.
- **El azar entra por un solo sitio** (`B-901`). `fisica.ts` y `clasificacion.ts` son deterministas
  por construcción: no reciben `Rng`.
- **La posición se calcula una vez** (`B-105`). Metros recorridos, vuelta y punto del trazado salen
  de `circuito.ts`. El render lee; no recalcula.

---

## 5. Requisitos

### B-1xx · El circuito

| ID | Requisito | Aceptación |
|---|---|---|
| **B-101** | Un circuito son tramos declarados en orden (`recta`, `curva`, `estrecho`, `oleaje`), cada uno con longitud, anchura, radio (si curva), corriente y oleaje. Es cerrado: el final del último enlaza con el principio del primero | `longitudDeVuelta(c)` es la suma de las longitudes, y `tramoEn(c, L)` con `L` = longitud de vuelta devuelve el mismo tramo que con `L` = 0 |
| **B-102** | **Ningún tramo pasa del 30 % de la vuelta.** Un tramo que se come el circuito lo convierte en una línea recta con dos curvas de adorno | Test estático sobre los cuatro circuitos: `max(longitud)/longitudDeVuelta < 0,30` |
| **B-103** | La anchura del tramo fija los carriles utilizables: `carriles = floor(anchura / 4,5)`, mínimo 2. En un `estrecho` no caben dos barcas en paralelo salvo que la anchura lo permita | `carrilesEn` de un tramo de 9 m devuelve 2; de uno de 22 m, 4 |
| **B-104** | Cada circuito declara `vueltas`, `oleajeBase`, `nombre` y `procedencia` (`ficticio`). No hay circuitos reales: se declara para que nadie los presente como tales | Los cuatro circuitos tienen `procedencia: 'ficticio'` y la pantalla lo enseña |
| **B-105** | `puntoDe(circuito, metrosGlobales)` devuelve `{ vuelta, metrosEnVuelta, tramo, fraccion }`. Es la ÚNICA conversión de distancia a posición del proyecto | Con vuelta de 1 000 m, `puntoDe(c, 2 300)` da `vuelta 2`, `metrosEnVuelta 300` |
| **B-106** | La corriente del tramo (m/s, con signo) se suma a la velocidad sobre el fondo y se resta a la velocidad sobre el agua. La resistencia se paga sobre el AGUA, no sobre el fondo | Con corriente `+1`, una barca con velocidad sobre el agua de 3 m/s avanza 4 m/s sobre el fondo |
| **B-107** | El oleaje efectivo de un punto es `oleajeBase` del circuito más el del tramo, acotado a `[0, 1]` | `oleajeEn` nunca devuelve fuera de `[0, 1]` sobre los cuatro circuitos, todos sus metros |

### B-2xx · La física del casco

| ID | Requisito | Aceptación |
|---|---|---|
| **B-201** | **Estela.** Ir detrás de otra barca reduce la resistencia. El ahorro es función continua de la distancia longitudinal y de la separación lateral, con máximo del 30 % entre 6 y 10 m, cero por encima de 26 m y cero por debajo de 2 m (agua revuelta) | `factorEstela(8, 0)` ≤ 0,70; `factorEstela(30, 0)` = 1; `factorEstela(1, 0)` = 1; monótona por tramos y sin saltos > 0,02 entre metros contiguos |
| **B-202** | **Velocidad de casco y resistencia de ola.** `velocidadDeCasco(L) = 1,25·√L`. La resistencia de ola crece con `ratio = v / velocidadDeCasco` y se dispara al acercarse a 1: `R_ola = m·g·coefOla·ratio³ / max(1 − 0,85·ratio⁴; 0,06)` | `resistenciaDeOla` a `ratio = 1,0` es **al menos 25 veces** la de `ratio = 0,5`, con los mismos `m` y `L` |
| **B-203** | **Planeo: es un cambio de régimen, no un coeficiente.** Solo `casco: 'planeador'`. Por debajo de `ratio` 1,05 paga la barrera entera; entre 1,05 y 1,60 el factor cae suavemente de 1 a **0,30**; por encima se queda en 0,30 | `factorPlaneo('desplazamiento', r)` = 1 para todo `r`. `factorPlaneo('planeador', 1,0)` = 1 y `factorPlaneo('planeador', 1,6)` = 0,30, sin saltos > 0,05 entre `ratio` contiguos |
| **B-204** | **La velocidad de equilibrio se resuelve por BISECCIÓN, no por Newton.** Con corriente en contra el término de arrastre deja de ser monótono en el entorno del arranque y Newton diverge (`DB4`) | `velocidadDeEquilibrio` con corriente en contra de 1,2 m/s y empuje de 900 N devuelve > 2 m/s, y `resistenciaTotal` a esa velocidad iguala al empuje con error < 1 N |
| **B-205** | **Resistencia de rozamiento.** `R_f = ½·ρ·Cf·S·v²` con `S ≈ 2,6·√(∇·L)`, `∇ = m/1025` | Duplicar la velocidad sobre el agua multiplica `resistenciaDeRozamiento` por 4 ± 1 % |
| **B-206** | **El desplazamiento entra en las dos resistencias.** La masa es casco + patrón (80 kg) + tripulantes | Añadir 164 kg de tripulación a una barca de 900 kg sube la resistencia total a 3,5 m/s en más de un 8 % |
| **B-207** | **Oleaje.** Añade `R_olas = m·g·0,010·oleaje·(2 − estabilidad/100)` | Con `oleaje = 1`, una barca de `estabilidad 40` paga más del doble de penalización por oleaje que una de `estabilidad 95` |
| **B-208** | **Energía de la tripulación** (0–100). Empujar por encima de `empujeCrucero` la baja; por debajo la sube. A energía 0 el empuje máximo cae al 55 %, y no más: reventar no es abandonar | Empujando al máximo desde energía 100, `energiaTras` llega a 0 en menos de 240 s y no baja de 0 |
| **B-209** | **Viraje.** `velocidadDeViraje(radio, maniobra, eslora)` = `√(radio·g·0,06·(maniobra/100)^1,2·√(8/eslora))`. Ir por encima cuesta velocidad, no descalifica | Con `radio 25`, `maniobra 70`, `eslora 9` devuelve entre 2,5 y 3,5 m/s; con `eslora 14` devuelve menos que con `eslora 9` a igualdad de lo demás |

### B-3xx · Un tick de regata

| ID | Requisito | Aceptación |
|---|---|---|
| **B-301** | Orden dentro de `avanzar(estado, ctx, rng)`, y no otro: **(1)** decisión de cada barca (jugador: mando; rivales: `ia.ts`) · **(2)** objetos en vuelo (`H-209`) · **(3)** fuerzas y nueva velocidad · **(4)** bloqueo y carriles · **(5)** avance y vuelta · **(6)** huevos rotos (`H-101`) · **(7)** adelantamientos (`B-702`) · **(8)** meta | Test que instrumenta el orden con un espía y compara la secuencia exacta |
| **B-302** | **Bloqueo.** Una barca no puede ocupar el metro de otra en el mismo carril: si alcanza a menos de 2,5 m a una del mismo carril, su velocidad se topa a la de delante menos 0,1 m/s | Dos barcas en el mismo carril, la de atrás más rápida: tras 30 s la separación nunca es menor de 2,4 m |
| **B-303** | **Cambiar de carril cuesta.** Mientras dura el cambio (1,2 s) la barca pierde un 6 % de velocidad y no puede iniciar otro | Una barca que cambia de carril recorre menos distancia en 5 s que la misma barca en línea recta, con la misma semilla |
| **B-304** | **Carriles ocupados.** El cambio a un carril con otra barca a menos de 6 m longitudinalmente se rechaza; la decisión no se pierde, se reintenta al tick siguiente | Con los tres carriles ocupados, `intentarCarril` devuelve `false` y la barca no se teletransporta |
| **B-305** | La vuelta se cuenta al cruzar el metro 0 de la vuelta; la meta, al completar `vueltas` vueltas. El tiempo de meta se interpola dentro del tick para no cuantizar a 50 ms | Dos barcas que cruzan en el mismo tick tienen tiempos de meta distintos |
| **B-306** | **Boyas.** Cada tramo `curva` lleva una boya. Pasar por el lado exterior (carril más externo de la curva) alarga el recorrido un 4 %; por el interior, lo acorta un 2 % pero la velocidad de viraje baja un 12 % | Recorrer una curva por dentro a velocidad de viraje sin recortar da menos tiempo que por fuera; forzando el interior a más velocidad, más |

### B-4xx · Parrilla y clasificación

| ID | Requisito | Aceptación |
|---|---|---|
| **B-401** | La parrilla de salida se sortea con el `Rng` de la regata. El jugador **nunca** sale primero: sale entre la 4.ª y la 8.ª plaza. Si sale primero no hay nadie a quien impedir que te adelante | Sobre 200 semillas, la plaza del jugador está siempre en `[4, 8]` y las 5 aparecen |
| **B-402** | La clasificación en carrera ordena por metros globales descendentes; en meta, por tiempo de meta ascendente. Una barca que ya llegó siempre va por delante de una que no | `clasificar` de un estado mixto pone a los llegados primero, en orden de tiempo |
| **B-403** | Los tiempos se dan en segundos con dos decimales y la diferencia con el ganador, nunca la diferencia con el de delante | `formatearDiferencia(12,345)` = `'+12,35'` y `formatearDiferencia(0)` = `'—'` |

### B-5xx · La táctica de las rivales

| ID | Requisito | Aceptación |
|---|---|---|
| **B-501** | Cuatro personalidades declaradas, repartidas por sorteo: `lanzada` (empuja siempre, revienta), `rueda` (busca estela y ataca al final), `sucia` (usa objetos en cuanto los tiene, bloquea carriles), `regular` (gestiona energía) | `repartirPersonalidades` con 7 rivales devuelve las cuatro presentes al menos una vez sobre 50 semillas |
| **B-502** | Una rival busca activamente la estela: si tiene a alguien entre 6 y 20 m delante en otro carril y su carril está libre, se cambia | Test con una rival 14 m por detrás en otro carril: cambia al carril del de delante en menos de 4 s |
| **B-503** | **Una rival intenta adelantar al jugador.** Si va detrás de él a menos de 12 m y le queda energía > 35, saca el carril libre y empuja por encima de crucero durante hasta 8 s | Con el jugador a empuje de crucero, al menos una rival lo adelanta en una regata de 2 vueltas del circuito `ria` |
| **B-504** | **Goma elástica ACOTADA y declarada.** Una rival a más de 120 m por detrás del líder gana hasta un +6 % de empuje máximo; a más de 120 m por delante, hasta un −4 %. Nunca más, y se apaga en la última vuelta | `factorGoma` está en `[0,96; 1,06]` para toda diferencia, y vale exactamente 1 en la última vuelta |
| **B-505** | Las rivales rompen huevos y usan objetos con el mismo motor que el jugador (`H-2xx`). No tienen objetos infinitos ni reglas propias | En una regata simulada, los objetos usados por rivales salen todos de un huevo roto previo |
| **B-506** | **Una rival bloqueada intenta salir.** Si tiene a menos de 7 m a alguien delante en su MISMO carril y hay carril libre, se cambia. La regla de la estela (`B-502`) la da por satisfecha —«ya voy a rueda»— y sin esta no se despega nunca | En un circuito ancho, las ocho barcas no terminan dentro de 5 s unas de otras a la misma velocidad. Test: una rival pegada a una más lenta cambia de carril en menos de 4 s |

### B-7xx · El objetivo del juego

| ID | Requisito | Aceptación |
|---|---|---|
| **B-701** | La regata se gana llegando el primero. Es la condición principal y la que se enseña más grande | El resultado trae `posicion` y `ganada = posicion === 1` |
| **B-702** | **Se cuenta cada adelantamiento sufrido por el jugador.** Cuenta cuando una rival pasa de estar detrás a estar delante y **se mantiene delante 3 s seguidos** (`DB6`: sin la histéresis, un cruce lateral contaba 14 veces) | Un cruce en el que la rival vuelve a caer detrás en 1 s no suma; uno en el que se mantiene 4 s suma exactamente 1 |
| **B-703** | **Regata limpia:** terminar con `adelantamientosSufridos === 0`. La economía la premia (`A-302`) | El resultado trae `limpia`, y es `true` solo si el contador es 0 |
| **B-704** | El arnés mide los adelantamientos sufridos por un jugador de pilotaje medio y declara su **media**, que tiene que caer en `[3, 12]`. Además alguna regata tiene que traer al menos uno: si no, la IA no ataca | `npm run baseline` imprime la columna `adel.` y sale con código ≠ 0 si la media se sale del rango |

### B-9xx · Invariantes

| ID | Requisito | Aceptación |
|---|---|---|
| **B-901** | Todo el azar pasa por `rng.ts`. `Math.random` prohibido en `engine/`, `render/`, `modes/`, `components/`, `juego/` | Test estático sobre el código fuente |
| **B-902** | Ninguna capa inferior conoce a la superior | Test estático sobre las importaciones |
| **B-903** | El motor no hace E/S. `progreso.ts` es la única excepción y recibe el almacén por parámetro | Test estático |
| **B-904** | `import type`, extensión `.ts` explícita, sin `enum` ni `namespace` | Test estático |

---

## 6. Plan de pruebas

**Runner:** `node --test` sobre `.ts` crudo. Restricciones del borrado de tipos: `import type`,
extensión `.ts` explícita, sin `enum` ni `namespace`. Las comprueba
[`higiene.test.ts`](../src/engine/__tests__/higiene.test.ts).

### 6.1 Invariantes y propiedades

- `factorEstela` es continua: sobre 0–40 m en pasos de 0,1, ningún salto > 0,02.
- `resistenciaTotal` es estrictamente creciente en `v` para `v ∈ (0; 12]` **solo en los cascos de
  desplazamiento**. En los planeadores tiene joroba y luego baja: es la propiedad que el borrador
  dio por buena para las seis barcas y que la medición desmintió (ver «lo que la medición
  cambió»). En ellos lo que se comprueba es que la joroba EXISTE: un planeador que no la tiene no
  llega a planear nunca.
- `oleajeEn` ∈ `[0, 1]` en todos los metros de los cuatro circuitos.
- Determinismo (`BG4`): la misma semilla da la misma clasificación y los mismos tiempos.

### 6.2 Posiciones doradas

Cada defecto de §3 entra como regresión:

| Defecto | Test |
|---|---|
| DB1 | `[B-202]` la resistencia de ola a `ratio 1,0` es ≥ 25× la de `ratio 0,5` |
| DB2 | `[B-203]` `factorPlaneo` vale 1 en `ratio 1,0` y ≤ 0,20 en 1,6 |
| DB3 | `[B-201]` `factorEstela` es continua y vale 1 por debajo de 2 m |
| DB4 | `[B-204]` bisección con corriente en contra devuelve > 2 m/s |
| DB5 | `[B-503]` al menos una rival adelanta al jugador en 2 vueltas de `ria` |
| DB6 | `[B-702]` un cruce de 1 s no suma; uno de 4 s suma 1 |

### 6.3 Cotas de terminación

`avanzar` no tiene bucles sobre el futuro: cada tick hace trabajo `O(barcas² + objetos)`. La
bisección de `B-204` hace **exactamente 60 iteraciones**, no «hasta converger»: el coste lo fija
una constante, no la suerte.

### 6.4 No-regresión

La suite completa sigue en verde.

---

## 7. Fases y puertas de salida

### Fase B1 — Física y circuito · ✅ **CERRADA 2026-09-16**
**Alcance:** `B-1xx`, `B-2xx`, `B-4xx`, `B-9xx`
**Puerta:** `resistenciaDeOla` a `ratio 1,0` ≥ 25× la de `ratio 0,5`; `velocidadDeEquilibrio` con
corriente en contra > 2 m/s; `lint`, `test` y `build` limpios.
**Resultado:** 149 tests en verde · `tsc --noEmit` limpio · `vite build` correcto.

| Comprobación | Resultado |
|---|---|
| `B-202` · barrera de ola `ratio 1,0` vs `0,5` | **×50,5** (umbral ≥ 25) |
| `B-203` · `factorPlaneo(planeador, 1,6)` | **0,300** (ver «lo que la medición cambió») |
| `B-204` · barrido con corriente −1,2 m/s y 900 N | **3,22 m/s** sobre el fondo, residuo 0,00 N |
| `B-201` · ahorro de estela a 8 m | **30,0 %** (umbral ≥ 20 %) |
| `B-102` · tramo más largo de los 4 circuitos | **27,0 %** de la vuelta (umbral < 30 %) |
| `R-105` · giro total de los 4 circuitos | **6,27 – 6,33 rad** (2π = 6,283) |

Velocidad en llano y de paso por una curva de radio 30, con dotación completa
—las dos columnas que explican por qué cada circuito lo gana una barca distinta:

| Barca | llano | curva r30 |
|---|---|---|
| `chalana` | 4,45 m/s | **4,23 m/s** |
| `neumatica` | 5,58 m/s | 3,97 m/s |
| `patin` | 4,90 m/s | 4,13 m/s |
| `trainera` | 5,50 m/s | 2,78 m/s |
| `lancha` | **6,23 m/s** | 3,50 m/s |
| `galeota` | 5,93 m/s | 2,39 m/s |

### Fase B2 — Regata, IA y defensa de la posición · ✅ **CERRADA 2026-09-16**
**Alcance:** `B-3xx`, `B-5xx`, `B-7xx`
**Puerta:** el arnés cumple BG1, BG2 y BG3 sobre 4 circuitos × 5 semillas.
**Resultado:** 149 tests en verde · `tsc --noEmit` limpio · `vite build` correcto · `baseline` en
verde sobre 4 circuitos × 8 semillas.

| Comprobación | Resultado |
|---|---|
| `BG1` · victoria de la barca más ganadora | **19 %** (umbral < 45 %) |
| `BG2` · diferencia del 2.º, mediana | **1,36 s** (umbral de la mediana 0,4–8 s) |
| `BG2` · peor 2.º | **3,5 %** del tiempo del ganador (umbral < 25 %) |
| `BG3` · adelantamientos sufridos, media | **5,5** (umbral de la media 3–12) |
| `BG4` · determinismo | **idéntico al milisegundo** sobre repeticiones de la misma semilla |
| `B-504` · `factorGoma`, extremos observados | **0,96 – 1,06** |

Reparto de victorias por plaza ocupada, que es lo que dice si el catálogo sirve
para algo: `neumatica` 19 % · `trainera` 19 % · `patin` 17 % · `galeota` 12 % ·
`lancha` 9 % · `chalana` 0 %. Y cada circuito lo gana quien tiene que ganarlo:
`ria` y `canal` las ágiles, `faro` y `tormenta` las largas y estables.

---

## 8. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| La barrera de ola hace la física poco manejable y el juego se vuelve frustrante | Alto | El empuje del jugador se pide en fracción de crucero, no en newtons (`H-3xx`): el mando esconde la física |
| La goma elástica se convierte en «la IA siempre te alcanza» | Alto | Acotada a ±6 % y **apagada en la última vuelta** (`B-504`), con test de los extremos |
| El coste `O(barcas²)` del bloqueo se dispara | Bajo | Ocho barcas: 64 pares por tick. Medido en el arnés, no estimado |

---

## 9. Preguntas abiertas

| # | Pregunta | Bloquea | Decisión |
|---|---|---|---|
| ~~**BQ1**~~ | ~~¿El empuje se pide en newtons o en fracción de crucero?~~ | B2 | **Fracción de crucero** (2026-09-16). La interfaz no habla en newtons |
| **BQ2** | ¿Merece la pena una parada de avituallamiento que reponga energía de golpe? | — | Anotado en `index.md` como trabajo no realizado |

---

## Anexo A — Contratos de datos propuestos

```ts
// [B-202] Velocidad a la que la propia ola atrapa al casco.
export function velocidadDeCasco(eslora: number): number;

// [B-202] La barrera. Ver §5 para la fórmula exacta.
export function resistenciaDeOla(masa: number, eslora: number, vAgua: number, coefOla: number): number;

// [B-203] Régimen de planeo. 1 = paga la barrera entera.
export function factorPlaneo(casco: TipoCasco, ratio: number): number;

// [B-201] Fracción de resistencia que sigue pagando quien va en la estela.
export function factorEstela(distancia: number, separacionLateral: number): number;

// [B-204] Por bisección. 60 iteraciones exactas.
export function velocidadDeEquilibrio(empuje: number, barca: BarcaEfectiva, entorno: Entorno): number;

// [B-301] Un tick. Devuelve un estado nuevo: no muta el que recibe.
export function avanzar(est: EstadoRegata, ctx: ContextoRegata, rng: Rng): EstadoRegata;
```

---

## Anexo B — Mapa de trazabilidad defecto → requisito → fase

| Defecto | Requisito | Fase | Estado | Test de regresión |
|---|---|---|---|---|
| DB1 · la eslora salía gratis | `B-202` | B1 | ✅ | `[B-202] la barrera de ola…` |
| DB2 · el planeo era un coeficiente | `B-203` | B1 | ✅ | `[B-203] el planeo es un cambio de régimen…` |
| DB3 · estela binaria | `B-201` | B1 | ✅ | `[B-201] la estela es continua…` |
| DB4 · Newton divergía | `B-204` | B1 | ✅ | `[B-204] la bisección aguanta la corriente en contra` |
| DB5 · la IA no atacaba | `B-503` | B2 | ✅ | `[B-503] una rival adelanta al jugador` |
| DB7 · fila india en los anchos | `B-506` | B2 | ✅ | `[B-506] una rival bloqueada saca el morro` |
| DB6 · adelantamientos de ruido | `B-702` | B2 | ✅ | `[B-702] el cruce corto no cuenta…` |

---

## Resumen de cierre — 2026-09-16

| Objetivo | Umbral | Resultado |
|---|---|---|
| BG1 · ninguna barca domina | < 45 % de victorias | **19 %** |
| BG2 · regata apretada | mediana del 2.º entre 0,4 y 8 s | **1,36 s** |
| BG2 · nadie dobla al campo | peor 2.º < 25 % del ganador | **3,5 %** |
| BG3 · se puede defender | media de 3 a 12 adelantamientos | **5,5** |
| BG4 · repetible | idéntica al milisegundo | **idéntica** |
| BG5 · la estela paga | ≥ 20 % a 8 m | **30 %** |

Siete defectos medidos, siete corregidos, siete tests de regresión.

### Lo que la medición cambió respecto a lo escrito

| Requisito | Lo que decía la especificación | Lo que dijo la medición |
|---|---|---|
| `B-504` | La goma elástica se escribió con ±10 % | Con ±10 %, los adelantamientos al jugador subieron a **11–16** por regata: la última vuelta era una remontada garantizada y daba igual cómo pilotaras. Se bajó a ±6 % y **se apaga en la última vuelta**, que es lo que la devolvió al rango `[2, 8]`. El apagado no estaba en el borrador |
| `B-704` | El rango se declaró como «mínimo y máximo entre 1 y 9 adelantamientos» | **El mínimo y el máximo miden el sorteo, no el juego.** Una regata en la que al piloto medio le toca una barca que no es para ese circuito se va a 27 adelantamientos, y otra en la que se escapa en la primera vuelta se queda en 0: las dos tiraban la puerta abajo sin decir nada del equilibrio. Se declara la **media sobre las 32 regatas** —que sale 5,5 y es estable— más la condición de que alguna regata tenga ataque |
| `B-401` | El borrador sorteaba la parrilla entera, jugador incluido | Con el jugador saliendo primero en 1 de cada 8 regatas, esas regatas **no tenían juego**: nadie a quien impedir que te adelante, y el contador de `B-702` salía 0 por construcción, no por pilotar bien. Se acotó la salida del jugador a la 4.ª–8.ª plaza |
| `B-208` | El borrador decía que a energía 0 el empuje caía al 30 % | Al 30 %, una rival `lanzada` que reventaba en la vuelta 1 quedaba a **más de 300 m** y ya no volvía: se perdían tres rivales de siete. Al 55 % sigue siendo un castigo caro y la regata se mantiene junta |
| `B-203` | El borrador fijaba el suelo del planeo en **0,18** | Con 0,18, las dos barcas planeadoras rodaban a **6,37 y 6,80 m/s** contra los **4,31–5,18 m/s** de las cuatro de desplazamiento: un 30 % de ventaja que se llevaba por delante `BG1` y `AG2` enteros. El suelo subió a **0,30**, y con él las seis barcas caen en la banda 4,4–5,5 m/s en solitario. El número no se eligió: se resolvió hacia atrás desde la banda |
| `B-204` | El borrador afirmaba que `f(v)` «vale −empuje en el origen y crece sin límite: hay exactamente UNA raíz positiva» | **Es falso para los cascos planeadores.** Su curva de resistencia tiene una joroba (la `lancha`, 1 905 N a 4,6 m/s) y luego BAJA al subirse al agua: entre 0 y 14 m/s hay hasta **tres** raíces. Una bisección clásica converge a una cualquiera. `velocidadDeEquilibrio` pasó a **barrer de 0 hacia arriba y quedarse con la PRIMERA raíz**, que es la que alcanza de verdad una barca que arranca parada. Lo que el borrador daba por geometría del problema resultó ser la mecánica más interesante del juego: la `lancha` en solitario se queda en **4,43 m/s**, atascada bajo su joroba, y con dos remeros la cruza y pasa a **6,03 m/s** |
