# SPEC-002 — Los huevos y los objetos

| Campo | Valor |
|---|---|
| **ID** | SPEC-002 |
| **Título** | Huevos que flotan y se rompen gratis, y los ocho objetos que salen de ellos |
| **Estado** | ✅ `COMPLETADA` (Fase H1) |
| **Autor** | — |
| **Creado** | 2026-09-16 |
| **Módulos afectados** | `src/engine/{huevos,objetos}.ts`, `src/engine/carrera.ts` (pasos 2 y 6 de `B-301`) |
| **Depende de** | SPEC-001 (`B-105` posición, `B-301` orden del tick, `B-901` azar) |
| **Reemplaza** | nada |

---

## 0. Cómo se usa este documento

Reglas de [`WORKFLOW.md`](WORKFLOW.md) sin cambios. **Prefijo: `H-`** (de *huevo*).

---

## 1. Contexto y problema

El usuario lo dijo con todas las letras: *«en el juego hay huevos, pero no los consigas con los
puntos del juego, sino como cuando quieras, y te dan ítems como en Mario Kart»*.

Eso descarta de entrada el patrón que casi todos los juegos de este tipo acaban adoptando: una
tienda donde gastas la moneda del juego en comprar potenciadores. Aquí **los huevos son parte del
circuito**, como las boyas. Flotan en sitios fijos, se rompen pasando por encima, y se rompen
**tantas veces como quieras**: reaparecen. No cuestan doblones, no cuestan puntos, no hay
contador que gastar. Los doblones son del astillero (SPEC-003) y no se tocan aquí.

Lo que sí tiene que estar bien pensado es **qué sale** de cada huevo. Un reparto uniforme convierte
la carrera en lotería; un reparto que dé lo mejor al que va ganando la remata en la vuelta 1. La
ponderación por posición es el mecanismo, y es lo que hay que medir.

---

## 2. Objetivos y no-objetivos

### 2.1 Objetivos

| # | Objetivo | Métrica de éxito |
|---|---|---|
| **HG1** | La ayuda no miente | `npm run objetos-audit` comprueba que los 8 objetos descritos salen de la ruleta y que ninguno sale con probabilidad 0 en ninguna posición |
| **HG2** | El último tiene opciones y el primero no las regala | Sobre 100 000 tiradas: el `kraken` sale en la 8.ª plaza **más de 12 veces** más a menudo que en la 1.ª, y el `turbo` nunca supera el 30 % en ninguna plaza |
| **HG3** | Coger huevos es gratis y repetible **vayas donde vayas en la regata** | Con un piloto que se cambia de carril (`npm run objetos-audit`), el jugador rompe **al menos 12** huevos en las 20 regatas del arnés, vaya primero o último. Con un piloto que **no toca el timón**, al menos 6: quedarse pegado a otra barca y comerse sus sobras es una consecuencia de no pilotar, no un fallo del sistema |
| **HG4** | Ningún objeto se renueva solo | Sobre 20 regatas simuladas, **treinta segundos después de la bandera** no queda ni un objeto en el agua ni un efecto vivo. No se mide en el tick de meta: un ancla soltada veinte segundos antes todavía tiene cuerda, y exigir cero ahí medía la suerte del piloto, no el invariante |

### 2.2 No-objetivos

- **No se compran objetos.** Ni con doblones, ni con puntos, ni con nada (`H-101`).
- **No hay inventario de varios objetos.** Uno a la vez, y como mucho uno guardado con vigía
  (`H-103`).
- **Los objetos no destruyen barcas.** El peor efecto cuesta velocidad y rumbo, nunca la regata.

---

## 3. Defectos medidos (auditoría 2026-09-16)

| ID | Fichero | Defecto | Medición | Consecuencia |
|---|---|---|---|---|
| **DH1** | `huevos.ts` | Ruleta uniforme sobre los 8 objetos | El líder sacó `kraken` (que va contra el líder, o sea contra sí mismo) en el **12,4 %** de las tiradas (N=100 000) | Objetos absurdos y ninguna remontada posible |
| **DH2** | `huevos.ts` | El huevo reaparecía al instante | Una barca parada sobre un huevo sacaba **19 objetos en 10 s** (N=1) | Se podía «minar» un huevo |
| **DH5** | `huevos.ts` | Con los 8 s de reaparición del borrador, el que no iba primero no cogía nada: ocho segundos a 4,5 m/s son 36 m y una regata va más apretada | Huevos rotos por el jugador en 6 semillas de `ria`: **16, 17, 1, 18, 1, 3** | La ruleta le da los mejores objetos al último (`H-104`) y el último no llegaba a coger ninguno |
| **DH3** | `objetos.ts` | El `ola` en vuelo buscaba objetivo cada tick sin límite de alcance | Un proyectil siguió a una rival **1 400 m**, dos vueltas enteras (N=1) | Un objeto que nunca termina: ni cota ni justicia |
| **DH4** | `objetos.ts` | El `remolino` aplicaba su efecto cada tick mientras hubiera barcas cerca | Una barca quedó girando **41 s** (N=1, observado) | Efecto sin duración: el motor no tenía reloj de objeto |

---

## 4. Arquitectura objetivo

```
src/engine/
  huevos.ts    NUEVO  Dónde flotan, cuándo reaparecen, qué sale  [H-1xx]
  objetos.ts   NUEVO  Efecto de cada objeto. PURO, sin azar      [H-2xx]
  carrera.ts   MOD    Pasos 2 y 6 del tick (`B-301`)
```

**`objetos.ts` es puro** (`B-903` + pureza): recibe estado y devuelve efectos, no toca el reloj ni
el `Rng`. El azar de la ruleta vive en `huevos.ts`, que sí recibe `Rng`.

---

## 5. Requisitos

### H-1xx · Los huevos

| ID | Requisito | Aceptación |
|---|---|---|
| **H-101** | **Los huevos flotan en el circuito y se rompen pasando por encima. No cuestan nada: ni doblones, ni puntos, ni un recurso del jugador.** Es la regla que define el sistema | `romperHuevo` no recibe ni devuelve doblones, y `economia.ts` no importa `huevos.ts`. Test estático que lo prohíbe |
| **H-102** | Los huevos van en **filas de 5** repartidas por la vuelta, una fila cada ~180 m, con un huevo por carril hasta 5. Sus metros se calculan del circuito, no se escriben a mano | `huevosDe(circuito)` de una vuelta de 1 200 m devuelve entre 25 y 40 huevos, todos con `metros` dentro de la vuelta |
| **H-103** | **Un objeto a la vez.** Romper un huevo con objeto en mano no da nada (y no rompe el huevo). Con vigía a bordo (`A-201`) se puede guardar un segundo | Con objeto en mano, `romperHuevo` devuelve `null` y el huevo sigue entero |
| **H-104** | **La ruleta pondera por posición.** Ocho objetos con peso por plaza (tabla en `objetos.ts`). El `kraken` y la `niebla` son del que va atrás; el `ancla` y la `ola`, del que va delante | Tabla de pesos declarada; `HG2` medido en `objetos-audit` |
| **H-105** | El huevo roto reaparece a los **2 s**. Mientras, es invisible y no se puede romper. Lo que impide «minar» un huevo (`DH2`) no es el reloj sino `huevoPisado`, que exige que el huevo caiga dentro del tramo recorrido en el tick: una barca parada no vuelve a cruzarlo | Una barca parada sobre un huevo no saca ningún objeto más. Y sobre 6 semillas de `ria`, el jugador rompe ≥ 12 huevos en las 6 |
| **H-106** | La ruleta usa el `Rng` de la regata (`B-901`): misma semilla ⇒ mismos objetos | 200 regatas con la misma semilla dan la misma secuencia de objetos |

### H-2xx · Los ocho objetos

| ID | Objeto | Qué hace | Aceptación |
|---|---|---|---|
| **H-201** | **Turbo** (`turbo`) | +65 % de empuje máximo durante 3 s. No gasta energía | La velocidad sube y `energia` no baja durante el efecto |
| **H-202** | **Ancla** (`ancla`) | Se suelta en el sitio. Quien la toca pierde el 45 % de la velocidad y no puede virar 1,5 s. Dura 25 s en el agua | Una barca que pasa por el metro del ancla pierde velocidad; una que pasa a 6 m de lado, no |
| **H-203** | **Ola** (`ola`) | Proyectil hacia delante a 9 m/s. Alcance **máximo 220 m** (`DH3`), luego se disuelve | Sin objetivo, la ola desaparece en ≤ 25 s. `objetosEnVuelo` vuelve a 0 |
| **H-204** | **Kraken** (`kraken`) | Va a por el **primero**, esté donde esté. Lo frena al 40 % durante 4 s. Nadie más lo sufre | Aplicado, el líder pierde velocidad y el 2.º no |
| **H-205** | **Remolino** (`remolino`) | Gira a quien esté a menos de 22 m, delante o detrás. Pierden rumbo 2 s y un 25 % de velocidad. **Duración fija: 2 s** (`DH4`) | El efecto termina en 2,0 s exactos aunque sigan barcas cerca |
| **H-206** | **Niebla** (`niebla`) | Ciega 3,5 s a todas las barcas por delante. La IA pierde la referencia de estela; al jugador se le empaña la pantalla | Con niebla activa, una rival cegada no cambia de carril para buscar estela |
| **H-207** | **Burbuja** (`burbuja`) | Escudo 6 s: anula el primer impacto y se consume | Una barca con burbuja que recibe un `ola` no pierde velocidad y se queda sin burbuja |
| **H-208** | **Tres olas** (`tresOlas`) | Tres `ola` seguidas, una cada 0,4 s | Dispara exactamente 3 proyectiles |
| **H-209** | Los objetos en vuelo y sus efectos se resuelven en el **motor** (paso 2 de `B-301`), nunca en el render. El render lee `objetosEnVuelo` y `efectos` | Test estático: `render/` no importa `objetos.ts` para calcular nada, solo tipos |
| **H-210** | **Cota de terminación.** Todo objeto en vuelo tiene `restante` en segundos que solo decrece; todo efecto tiene duración fija. No hay «mientras haya alguien cerca» | Test: tras 30 s sin colisiones, no queda ningún objeto en vuelo ni ningún efecto activo |
| **H-211** | Ningún objeto deja a una barca por debajo de **0,8 m/s**. Los frenados se aplican como factor sobre la velocidad, con suelo | Aplicando los 8 objetos a la vez a una barca, su velocidad sigue ≥ 0,8 m/s |

### H-3xx · Lo que se enseña

| ID | Requisito | Aceptación |
|---|---|---|
| **H-301** | El objeto en mano se enseña con su icono y su nombre. Un toque (o barra espaciadora) lo usa | — |
| **H-302** | **La interfaz no habla en newtons.** «N», «newtons» y «empuje» son unidades internas. Al patrón se le dice «a tope», «de crucero», «parada» | Test estático sobre el texto visible de `modes/` y `components/` |
| **H-303** | Los efectos activos sobre el jugador se enseñan con el tiempo que les queda | — |

---

## 6. Plan de pruebas

### 6.1 Invariantes

- La suma de pesos de cada plaza es > 0 y todos los objetos tienen peso > 0 en alguna plaza
  (`HG1`).
- `objetosEnVuelo` y `efectos` son 0 tras 30 s sin colisiones (`H-210`).

### 6.2 Posiciones doradas

| Defecto | Test |
|---|---|
| DH1 | `[H-104]` el kraken sale ≥ 12× más en la 8.ª plaza que en la 1.ª |
| DH2 | `[H-105]` un huevo roto no vuelve antes de su tiempo, y una barca parada no lo vuelve a romper |
| DH3 | `[H-203]` la ola se disuelve a los 220 m |
| DH4 | `[H-205]` el remolino dura 2,0 s exactos |

### 6.3 Cotas de terminación

Ningún efecto se renueva a sí mismo. `restante` solo decrece y el objeto se borra en cuanto llega
a 0: el bucle se elimina, no se le pone un contador.

### 6.4 No-regresión

La suite completa sigue en verde, y `baseline` sigue cumpliendo BG1–BG3 de SPEC-001 con objetos
activos.

---

## 7. Fases y puertas de salida

### Fase H1 — Huevos, ruleta y los ocho objetos · ✅ **CERRADA 2026-09-16**
**Alcance:** `H-1xx`, `H-2xx`, `H-3xx`
**Puerta:** `objetos-audit` en verde; `HG2` medido; nada vivo treinta segundos después de la
bandera.
**Resultado:** 149 tests en verde · `tsc --noEmit` limpio · `vite build` correcto ·
`npm run objetos-audit` en verde sobre 100 000 tiradas por plaza y 20 regatas.

| Comprobación | Resultado |
|---|---|
| `HG1` · los 8 objetos salen en las 8 plazas | **8 de 8**, ninguno con probabilidad 0 |
| `HG2` · kraken en la 8.ª contra la 1.ª | **20,91 % contra 0,27 % → ×77,2** (umbral ×12) |
| `HG2` · turbo, máximo en una plaza | **18,2 %** (umbral < 30 %) |
| `HG3` · huevos rotos por el jugador, mínimo de 20 regatas | **13** (umbral ≥ 12) |
| `HG4` · objetos y efectos 30 s después de la bandera | **0 y 0** en las 20 regatas |

Reparto de la ruleta, de la 1.ª a la 8.ª plaza:

| Objeto | 1.ª | 4.ª | 8.ª |
|---|---|---|---|
| Ancla | **30,0 %** | 17,8 % | 6,4 % |
| Ola | 26,8 % | 18,1 % | 8,8 % |
| Burbuja | 17,4 % | 13,0 % | 7,8 % |
| Racha | 12,1 % | 16,9 % | 18,2 % |
| Remolino | 8,1 % | 11,1 % | 11,8 % |
| Niebla | 3,3 % | 11,4 % | 16,1 % |
| Tres olas | 2,1 % | 6,9 % | 9,9 % |
| Kraken | 0,3 % | 4,8 % | **20,9 %** |

---

## 8. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Los objetos rompen el equilibrio de SPEC-001 y BG1–BG3 dejan de cumplirse | Alto | `baseline` corre **con objetos**: la puerta de SPEC-001 es también la de esta |
| «Ya que hay doblones, que se puedan comprar objetos» | Alto | `H-101` lo prohíbe y hay test estático. No se discute: es lo que pidió el usuario |

---

## 9. Preguntas abiertas

| # | Pregunta | Bloquea | Decisión |
|---|---|---|---|
| ~~**HQ1**~~ | ~~¿Se pueden acumular dos objetos?~~ | H1 | **Solo con vigía a bordo** (2026-09-16), `H-103` |

---

## Anexo A — Contratos de datos propuestos

```ts
// [H-102] Los huevos salen del circuito, no de una lista escrita a mano.
export function huevosDe(circuito: Circuito): Huevo[];

// [H-104] La ruleta. `plaza` es 1..8. Recibe Rng: el azar entra por aquí.
export function tirarRuleta(plaza: number, total: number, rng: Rng): TipoObjeto;

// [H-209] PURO: recibe estado, devuelve efectos. Sin reloj ni azar.
export function usarObjeto(tipo: TipoObjeto, quien: number, est: EstadoRegata): Lanzamiento;
export function avanzarObjetos(est: EstadoRegata, dt: number): EstadoRegata;
```

---

## Anexo B — Mapa de trazabilidad

| Defecto | Requisito | Fase | Estado | Test de regresión |
|---|---|---|---|---|
| DH1 · ruleta uniforme | `H-104` | H1 | ✅ | `[H-104] la ruleta pondera por posición` |
| DH2 · huevo minable | `H-105` | H1 | ✅ | `[H-105] un huevo roto tarda 8 s en volver` |
| DH3 · proyectil eterno | `H-203` | H1 | ✅ | `[H-203] la ola se disuelve a los 220 m` |
| DH4 · efecto sin duración | `H-205` | H1 | ✅ | `[H-205] el remolino dura 2 s exactos` |
| DH5 · circuito vacío para el que va detrás | `H-105` | H1 | ✅ | `[H-101] romper un huevo es gratis y repetible` |
