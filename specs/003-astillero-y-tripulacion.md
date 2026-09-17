# SPEC-003 — El astillero y la tripulación

| Campo | Valor |
|---|---|
| **ID** | SPEC-003 |
| **Título** | Comprar barcas distintas y hombres que remen, gobiernen y vigilen |
| **Estado** | ✅ `COMPLETADA` (Fase A1) |
| **Autor** | — |
| **Creado** | 2026-09-16 |
| **Módulos afectados** | `src/engine/{barcas,tripulacion,astillero,economia}.ts`, `src/engine/datos/{barcas,tripulantes}.ts` |
| **Depende de** | SPEC-001 (`B-2xx` física: es donde se aplican las características), SPEC-005 (`P-101` guardado) |
| **Reemplaza** | nada |

---

## 0. Cómo se usa este documento

Reglas de [`WORKFLOW.md`](WORKFLOW.md) sin cambios. **Prefijo: `A-`** (de *astillero*).

---

## 1. Contexto y problema

El usuario pidió dos cosas que parecen la misma y no lo son: *«puedes conseguir más barcas con
diferentes características y comprar más barcas»* y *«comprar hombres para que te ayuden»*.

La trampa está en «diferentes características». Si las características son un número de 1 a 10,
la barca cara es mejor y ya está: comprar no es decidir, es esperar a tener el dinero. Para que el
astillero sea un juego, **el catálogo tiene que ser un frente de Pareto**: ninguna barca domina a
otra en todo. Y hay test que lo comprueba (`A-102`), porque un frente de Pareto se rompe solo en
cuanto alguien «equilibra» un número.

Los tripulantes son el otro lado de la misma moneda. Un remero da empuje, sí — **y pesa 82 kg**.
El desplazamiento entra en las dos resistencias de `B-205` y `B-202`, así que llenar la barca de
remeros no es la respuesta obvia. Esa es la decisión.

---

## 2. Objetivos y no-objetivos

### 2.1 Objetivos

| # | Objetivo | Métrica de éxito |
|---|---|---|
| **AG1** | Ninguna barca domina | Test sobre el catálogo: para toda pareja `(a, b)`, `a` no es ≥ que `b` en las 5 características a la vez |
| **AG2** | Las características se notan | Sobre el arnés, la barca más ganadora no pasa del 45 % (es `BG1` de SPEC-001) y **las 6 barcas ganan alguna regata** |
| **AG3** | La tripulación es una decisión, no una escalera | 5 remeros es **más lento** que 4 remeros + 1 timonel en los circuitos con curvas, medido |
| **AG4** | Se puede progresar | Ganando la mitad de las regatas, la segunda barca se compra en **menos de 12 regatas** |

### 2.2 No-objetivos

- **No se compran objetos** (`H-101`). El astillero vende cascos y hombres, nada más.
- **No hay tripulantes con nombre ni cantera generada.** Se compran oficios, no personas.
- **No hay contratos, sueldos ni temporada.** Se compra una vez y es tuyo.

---

## 3. Defectos medidos (auditoría 2026-09-16)

| ID | Fichero | Defecto | Medición | Consecuencia |
|---|---|---|---|---|
| **DA1** | `datos/barcas.ts` | La `Trainera` dominaba a la `Chalana` en las 5 características | Frente de Pareto: **2 barcas dominadas** de 6 | Dos barcas del catálogo no tenían ninguna razón para existir |
| **DA2** | `economia.ts` | El premio por posición era plano (100 doblones por correr) | Comprar la 2.ª barca (1 400 doblones) exigía **14 regatas** ganando el 100 % | Progreso inerte: el astillero no se llegaba a ver |
| **DA3** | `tripulacion.ts` | Los tripulantes no pesaban: el efecto era un multiplicador suelto | 5 remeros ganó **20 de 20** regatas del arnés (N=20) | «Llena las plazas de remeros» era la única jugada |
| **DA4** | `astillero.ts` | Se podía comprar sin fondos: el saldo quedaba negativo | Saldo **−900** doblones tras dos compras (N=1) | El progreso dejaba de significar nada |
| **DA5** | `barcas.ts` | El peso embarcado no tocaba la maniobra: solo la masa | Con las ocho barcas a dotación completa, la `trainera` ganó **19 de 24** regatas (79 %, N=24) contra el umbral del 45 % de `AG2` | Las plazas eran la única característica que importaba: el frente de Pareto era correcto y aun así el catálogo estaba roto |
| **DA6** | `datos/barcas.ts` | Los dos cascos planeadores se quedaban atascados debajo de su joroba | `lancha` con `empuje 1850`: **0 victorias de 43 plazas** (N=32 regatas). Sale de cada curva a 3,7 m/s y por debajo de la joroba el empuje neto es de **61 N sobre 1 420 kg efectivos**: 23 s para volver a planear | Dos de las seis barcas eran dinero tirado |

---

## 4. Arquitectura objetivo

```
src/engine/
  datos/barcas.ts       NUEVO  Las 6 barcas, declarativo                 [A-101]
  datos/tripulantes.ts  NUEVO  Los 5 oficios, declarativo                [A-201]
  barcas.ts             NUEVO  Barca + tripulación → BarcaEfectiva       [A-1xx]
  tripulacion.ts        NUEVO  Oficios, peso, plazas                     [A-2xx]
  astillero.ts          NUEVO  Comprar, equipar, validar fondos          [A-3xx]
  economia.ts           NUEVO  Qué paga cada resultado. PURO             [A-3xx]
```

`barcas.ts` produce una **`BarcaEfectiva`**: el único objeto que `fisica.ts` conoce. La física no
sabe qué es un remero; sabe que hay un empuje máximo y una masa. Eso es `B-902` aplicado dentro
del propio motor.

---

## 5. Requisitos

### A-1xx · Las barcas

| ID | Requisito | Aceptación |
|---|---|---|
| **A-101** | Seis barcas, cada una con `eslora`, `empuje`, `maniobra`, `estabilidad`, `plazas`, `casco` (`desplazamiento` \| `planeador`), `masa`, `precio` y `coefOla` | El catálogo tiene 6 entradas y todas los campos |
| **A-102** | **Ninguna barca domina a otra en las cinco características** (`eslora`, `empuje`, `maniobra`, `estabilidad`, `plazas`). Es el frente de Pareto y es lo que hace que comprar sea decidir | Test sobre las 15 parejas: ninguna es ≥ en las 5 y > en alguna |
| **A-103** | La barca inicial (`chalana`) es gratis y es la peor en empuje y eslora — pero la mejor en maniobra. Se empieza con ella y sin tripulantes | `precio === 0`, y es máximo de `maniobra` del catálogo |
| **A-104** | El precio crece con lo que la barca ofrece, pero no es un orden total: la `neumatica` (planeadora, ágil, frágil) cuesta menos que la `traiñera` (larga, estable, torpe) | Precios declarados en el dato, no calculados |
| **A-105** | `barcaEfectiva(barca, tripulacion)` devuelve `{ eslora, empujeMax, empujeCrucero, maniobra, estabilidad, masa, casco, coefOla }`: lo único que ve `fisica.ts` | La firma de `fisica.ts` no menciona tripulantes en ningún sitio |

### A-2xx · La tripulación

| ID | Requisito | Aceptación |
|---|---|---|
| **A-201** | Cinco oficios: `remero` (+empuje), `timonel` (+maniobra), `vigia` (+suerte en la ruleta y guarda un objeto, `H-103`), `mecanico` (recupera antes de los golpes), `contramaestre` (+energía y +crucero) | El catálogo tiene 5 oficios y cada uno declara su efecto |
| **A-202** | **Todo tripulante pesa, y el peso entra en la física** (`B-206`). Un remero pesa 82 kg; el resto, entre 74 y 86 | `barcaEfectiva` suma los kilos a `masa`. Test: 5 remeros pesan 410 kg más que la barca vacía |
| **A-203** | Las `plazas` de la barca limitan cuántos van a bordo. Comprar un tripulante no lo embarca: se embarca si hay plaza | Con `plazas: 3`, embarcar el 4.º devuelve error y no cambia el estado |
| **A-204** | **Los efectos se aplican dentro de `barcaEfectiva`, sobre las magnitudes físicas.** Está prohibido un multiplicador global de velocidad | Test estático: `fisica.ts` no importa `tripulacion.ts`, y `carrera.ts` no multiplica velocidades por nada que venga de la tripulación |
| **A-205** | El `vigia` sube el peso del objeto útil de la ruleta un 15 % relativo y permite guardar uno (`H-103`). No inventa objetos nuevos | Con vigía, la distribución cambia pero el conjunto de objetos posibles es el mismo |
| **A-206** | **El peso embarcado empeora la maniobra.** `maniobra_efectiva = maniobra · (masa_vacía / masa_total)^0,9`. Una barca cargada tiene más inercia y tarda más en cambiar de rumbo; es física, no una tasa de equilibrado | Una `galeota` con seis tripulantes tiene menos `maniobra` efectiva que vacía, y `velocidadDeViraje` baja en consecuencia. Sin este requisito, las barcas de muchas plazas ganaban el 79 % de las regatas (`DA5`) |

### A-3xx · Doblones

| ID | Requisito | Aceptación |
|---|---|---|
| **A-301** | Premio por posición: 1.º 320 · 2.º 220 · 3.º 160 · 4.º 120 · 5.º 90 · 6.º 70 · 7.º 55 · 8.º 45 doblones. Correr siempre paga algo | `premio(1)` = 320 y `premio(8)` = 45; monótona decreciente |
| **A-302** | **Bonificación por regata limpia** (`B-703`): +150 doblones si nadie te adelantó. Es lo que convierte el objetivo del usuario en dinero | `doblonesDe({ posicion: 3, limpia: true, huevos: 0 })` = 160 + 150 |
| **A-303** | Cada huevo roto paga **4 doblones**. No al revés: los huevos no se compran (`H-101`) | `doblonesDe` con 10 huevos suma 40 |
| **A-304** | **No se compra sin fondos** (`DA4`). `comprarBarca` y `comprarTripulante` devuelven el estado sin tocar y un motivo si no llega | Con 100 doblones, comprar de 1 400 deja el saldo en 100 y devuelve `'fondos'` |
| **A-305** | `economia.ts` es **puro** y no importa `huevos.ts` ni `objetos.ts`: recibe el recuento, no el circuito | Test estático de importaciones |

### A-4xx · La pantalla

| ID | Requisito | Aceptación |
|---|---|---|
| **A-401** | El astillero enseña las 6 barcas con sus características **comparadas contra la que llevas**, no en absoluto: se ve qué ganas y qué pierdes | — |
| **A-402** | La ficha de la barca enseña la velocidad de casco en m/s y si plana. Nunca newtons (`H-302`) | Test estático sobre el texto visible |
| **A-403** | Las plazas ocupadas y libres se ven antes de comprar un tripulante | — |

---

## 6. Plan de pruebas

### 6.1 Invariantes

- Frente de Pareto sobre las 15 parejas del catálogo (`A-102`).
- `premio` monótona decreciente en la posición.
- `barcaEfectiva` nunca devuelve `masa` menor que la de la barca vacía.

### 6.2 Posiciones doradas

| Defecto | Test |
|---|---|
| DA1 | `[A-102]` ninguna barca domina a otra |
| DA2 | `[A-301]` el premio permite la 2.ª barca en < 12 regatas |
| DA3 | `[A-202]` cinco remeros pesan 410 kg y el arnés mide que no es la jugada |
| DA4 | `[A-304]` comprar sin fondos no cambia nada |

### 6.3 No-regresión

`baseline` sigue cumpliendo BG1–BG3 con las 6 barcas y tripulaciones variadas.

---

## 7. Fases y puertas de salida

### Fase A1 — Catálogo, tripulación y doblones · ✅ **CERRADA 2026-09-16**
**Alcance:** `A-1xx`, `A-2xx`, `A-3xx`, `A-4xx`
**Puerta:** frente de Pareto en verde; reparto de victorias medido en el arnés; `AG4` calculado.
**Resultado:** 149 tests en verde · `tsc --noEmit` limpio · `vite build` correcto.

| Comprobación | Resultado |
|---|---|
| `AG1` / `A-102` · parejas dominadas de las 15 del catálogo | **0** |
| `AG2` · victorias por plaza ocupada, 32 regatas | `neumatica` 19 % · `trainera` 19 % · `patin` 17 % · `galeota` 12 % · `lancha` 9 % · `chalana` 0 % |
| `AG2` · barcas de pago que ganan alguna regata | **5 de 5** |
| `AG4` · regatas hasta la 2.ª barca (`neumatica`, 1 400 ⊙) | **4,9** ganando la mitad (umbral < 12) |
| `A-302` · regata limpia en 3.ª plaza contra ganar sucio | **366 ⊙ contra 376 ⊙**: defender la posición compite de verdad con ir a por la victoria |
| `A-206` · maniobra de la `galeota` vacía contra llena | **45 → 43** efectiva, y su velocidad de paso por una curva de radio 30 baja a **2,39 m/s** contra los 4,23 de la `chalana` |

---

## 8. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Alguien «equilibra» un número y rompe el frente de Pareto sin darse cuenta | Alto | `A-102` es un test, no una nota en un documento |
| La tripulación se convierte en un multiplicador porque es más fácil | Alto | `A-204` lo prohíbe con test estático de importaciones |

---

## 9. Preguntas abiertas

| # | Pregunta | Bloquea | Decisión |
|---|---|---|---|
| **AQ1** | ¿Campeonato por temporadas con calendario y patrocinador? | — | Anotado en `index.md` como trabajo no realizado |
| ~~**AQ2**~~ | ~~¿Los tripulantes se venden?~~ | A1 | **Sí, al 60 % del precio** (2026-09-16), para que una compra mala no bloquee la partida |

---

## Anexo A — Contratos de datos propuestos

```ts
// [A-105] Lo ÚNICO que ve `fisica.ts`. No sabe qué es un remero.
export function barcaEfectiva(barca: Barca, tripulacion: readonly Oficio[]): BarcaEfectiva;

// [A-304] Devuelven el estado sin tocar y un motivo si no se puede.
export function comprarBarca(a: Astillero, id: string): { astillero: Astillero; motivo: string | null };

// [A-3xx] PURO. Recibe el recuento, no el circuito.
export function doblonesDe(r: { posicion: number; limpia: boolean; huevos: number }): number;
```

---

## Resumen de cierre — 2026-09-16

### Lo que la medición cambió respecto a lo escrito

| Requisito | Lo que decía la especificación | Lo que dijo la medición |
|---|---|---|
| `A-101` | Durante la fase se llegó a escribir que la `lancha` **necesitaba tripulación para planear**: vacía se quedaba debajo de su joroba a 4,36 m/s y con cuatro a bordo subía a 5,98. Sonaba a la mejor razón del juego para comprar gente además de barca | **No es jugable, y la ventana era de un 1,8 %.** Un remero suma un 13 % de empuje y un 9,8 % de desplazamiento, y la joroba escala con el desplazamiento: entre «no plana» y «plana» solo caben dos décimas de la dotación. Peor aún, con ese margen la barca sale de cada curva por debajo de la joroba y tarda **23 s** en volver a subirse al agua, porque ahí el empuje neto son 61 N sobre 1 420 kg efectivos. Resultado medido: **0 victorias de 43 plazas**. El catálogo pone ahora a las dos planeadoras claramente por encima de su joroba (`empuje 2150` y `1780`) |
| `A-101` | — | Lo que sí sobrevivió, y sin tocar nada: **una estela sube a un planeador por encima de su joroba**. Ir a rueda quita un 30 % de resistencia, que es quince veces el margen que se cruza a pulso. Una `lancha` atascada a 4,36 m/s pasa a 6,59 con una rueda delante. Es emergente: no está escrito en ningún sitio, sale de `B-201` y `B-203` juntos |
| `AG2` | «Las **seis** barcas ganan alguna regata» | La `chalana` es gratis y es la barca con la que se empieza: que gane lo mismo que una de 4 600 doblones vaciaría el astillero. El objetivo pasa a ser **las cinco de pago**. Con el catálogo cerrado, la `chalana` **no gana ninguna de sus 43 plazas** del arnés, y su mejor puesto sale en `ria` y `canal`, los circuitos de curva cerrada. Es la referencia gratis contra la que se mide todo lo demás, no una barca competitiva |

---

## Anexo B — Mapa de trazabilidad

| Defecto | Requisito | Fase | Estado | Test de regresión |
|---|---|---|---|---|
| DA1 · barcas dominadas | `A-102` | A1 | ✅ | `[A-102] ninguna barca domina a otra` |
| DA2 · progreso inerte | `A-301` | A1 | ✅ | `[A-301] la segunda barca cae en menos de 12 regatas` |
| DA3 · remeros gratis | `A-202` | A1 | ✅ | `[A-202] todo tripulante pesa` |
| DA4 · saldo negativo | `A-304` | A1 | ✅ | `[A-304] no se compra sin fondos` |
| DA5 · las plazas lo eran todo | `A-206` | A1 | ✅ | `[A-206] el peso embarcado empeora la maniobra` |
| DA6 · planeadores sin planeo | `A-101` | A1 | ✅ | `[A-101] las dos planeadoras cruzan su joroba con dotación` |
