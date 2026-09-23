# Especificaciones — Índice y enrutado

**Actualizado:** 2026-09-16

Este fichero es el punto de entrada. **Lee esto primero y carga solo la sección a la que te
enrute**, no el documento entero. El flujo de trabajo está en [`WORKFLOW.md`](WORKFLOW.md).

---

## Tabla de enrutado

Busca tu tarea, carga **solo** los apartados de la derecha.

| Tarea | Carga |
|---|---|
| Empuje, resistencia, velocidad de la barca | `001` §5 `B-2xx` |
| **Por qué una barca larga no siempre gana** (velocidad de casco, resistencia de ola) | `001` §5 `B-202`/`B-203` · §3 `DB2` — **léelo antes de tocar nada de cascos** |
| **Estela: por qué se puede cazar a quien va delante** | `001` §5 `B-201` · §3 `DB3` |
| Un tick de regata: orden de las cosas dentro de `avanzar` | `001` §4 · §5 `B-3xx` |
| Carriles, bloqueos, no dejarse adelantar | `001` §5 `B-302`/`B-303`/`B-304` |
| **Qué cuenta como «me han adelantado»** — es el objetivo del juego | `001` §5 `B-7xx` |
| Energía de la tripulación, reventar, recuperar | `001` §5 `B-208` |
| Trazado del circuito, tramos, boyas, vueltas, corriente | `001` §5 `B-1xx` — **`B-102` primero**: el reparto de longitud es lo que rompió los circuitos |
| **Táctica de las barcas rivales**: rueda, ataque, goma elástica | `001` §5 `B-5xx` · §3 `DB5` |
| **Por qué una rival bloqueada se aparta** (y por qué sin eso se hace fila india) | `001` §5 `B-506` · §3 `DB7` |
| Parrilla de salida, clasificación, tiempos | `001` §5 `B-4xx` |
| Aleatoriedad, semillas, repetir una regata | `001` §5 `B-901` |
| **Los huevos: dónde están y por qué no cuestan nada** | `002` §5 `H-101` — es la regla que define el sistema |
| Ruleta de objetos, ponderación por posición, reaparición | `002` §5 `H-102`–`H-105` · §3 `DH1` |
| **Qué hace cada objeto**, alcance, duración, cómo se resuelve | `002` §5 `H-2xx` |
| Objetos en vuelo, cota de terminación | `002` §5 `H-209`/`H-210` · §6.3 |
| El indicador del objeto en pantalla, el botón de soltar | `002` §5 `H-3xx` |
| **Catálogo de barcas y sus características** | `003` §5 `A-1xx` — **`A-102` primero**: ninguna barca gana en todo, y hay test que lo prueba |
| **Tripulantes: oficios, peso, plazas** | `003` §5 `A-2xx` — el peso es el contrapeso, no un detalle |
| Doblones: qué paga cada resultado, cuánto cuesta una barca | `003` §5 `A-3xx` · §3 `DA2` |
| Pantalla del astillero, comprar, equipar | `003` §5 `A-4xx` |
| Trazado del circuito en el mundo, rumbo, carriles en 3D | `004` §5 `R-1xx` |
| **Por qué un circuito tiene que girar una vuelta entera** y por qué un metro del motor es un metro del mundo | `004` §5 `R-105`/`R-106` · §3 `DR6`/`DR7` — **míralo antes de tocar `datos/circuitos.ts`** |
| **El agua: olas de Gerstner, espuma, estela** | `004` §5 `R-2xx` — **§1.1 primero**: por qué no es un plano con una normal map |
| Malla de la barca (la lancha de Blender), cabeceo, balanceo, trima | `004` §5 `R-3xx` |
| Cielo, costa, islas, boyas, niebla | `004` §5 `R-4xx` |
| **Cámara, luz, encuadre** | `004` §5 `R-5xx` — **`R-501` antes de tocar el encuadre** |
| Bucle de dibujo, rendimiento, `?diagnostico=1` | `004` §5 `R-6xx` |
| Guardar la partida, migración, almacenamiento bloqueado | `005` §5 `P-1xx` |
| Instalar en Android e iOS, manifiesto, iconos | `005` §5 `P-2xx` |
| Despliegue en Firebase Hosting, caché, integración continua | `005` §5 `P-3xx` + [`../DEPLOYMENT.md`](../DEPLOYMENT.md) |
| **Ritmo de kart: por qué la regata va más rápida sin tocar la física** (reloj de juego, `RITMO`) | `006` §4 · §5 `K-101` — **léelo antes de cambiar velocidades o duraciones** |
| Duración de la regata, longitud de los circuitos recortados | `006` §5 `K-102` · §3 `DK1` |
| Cada cuánto pasa algo: cadencia de huevos, hueco sin acontecimiento | `006` §5 `K-201` · §3 `DK3`/`DK4` |
| Salida con cuenta atrás y miniturbo al ceñir la boya | `006` §5 `K-202`–`K-204` |
| FOV de velocidad, avisos de adelantamiento en pantalla | `006` §5 `K-3xx` |
| Arnés de diversión (`npm run diversion`) | `006` §5 `K-001` · §2 `KG1`–`KG6` |

**Si tu tarea no aparece aquí**, no improvises: sigue el *Protocolo de nueva especificación* de
[`WORKFLOW.md`](WORKFLOW.md) §2.

---

## Documentos

| ID | Título | Prefijo | Estado |
|---|---|---|---|
| [SPEC-001](001-motor-de-regata.md) | El motor de regata | `B-` | ✅ COMPLETADA (Fases B1 y B2) |
| [SPEC-002](002-huevos-y-objetos.md) | Los huevos y los objetos | `H-` | ✅ COMPLETADA (Fase H1) |
| [SPEC-003](003-astillero-y-tripulacion.md) | El astillero y la tripulación | `A-` | ✅ COMPLETADA (Fase A1) |
| [SPEC-004](004-render-del-agua.md) | El render del agua | `R-` | ✅ COMPLETADA (Fases R1 y R2) |
| [SPEC-005](005-progreso-y-despliegue.md) | Progreso, aplicación y despliegue | `P-` | ✅ COMPLETADA (Fase P1) |
| [SPEC-006](006-ritmo-de-kart.md) | Ritmo de kart | `K-` | ✅ COMPLETADA (Fases K1, K2 y K3) |

---

## Registro de prefijos

Un prefijo por documento, para que un `grep '\[B-2'` no cruce especificaciones.

| Prefijo | Documento |
|---|---|
| `B-` | SPEC-001 · motor de regata |
| `H-` | SPEC-002 · huevos y objetos |
| `A-` | SPEC-003 · astillero y tripulación |
| `R-` | SPEC-004 · render del agua |
| `P-` | SPEC-005 · progreso y despliegue |
| `K-` | SPEC-006 · ritmo de kart |

**Libres:** `C-` `D-` `E-` `F-` `G-` `I-` `J-` `L-` `M-` `N-` `O-` `Q-` `S-` `T-` `U-` `V-`
`W-` `X-` `Y-` `Z-`.

---

## Trabajo identificado y no realizado

Se anota aquí para que no se pierda. No es una promesa de calendario.

| Qué | De dónde sale | Por qué no está hecho |
|---|---|---|
| Campeonato por temporadas con calendario y patrocinador | `003` `AQ1` | Hoy se corre regata a regata; los doblones y el astillero ya persisten (`P-101`) |
| Regatas de varias vueltas con paradas de avituallamiento | `001` `BQ2` | La energía ya se agota y recupera (`B-208`), pero no hay parada que la reponga de golpe |
| Multijugador en el mismo dispositivo (pantalla partida) | `004` `RQ1` | La vista es una sola cámara (`R-501`); partirla obliga a duplicar el post-proceso |
| Partidas en la nube y varios dispositivos | `005` `PQ1` | Hoy el progreso es local (`P-101`) y el juego funciona sin servidor |
| Sonido: remos, agua, choques, la bocina de meta | — | No hay especificación todavía. Sigue el protocolo de `WORKFLOW.md` §2 |
| `colores.vela` de cada barca ya no se usa | `004` `R-303` (Fase R2) | Desde R2 todas las barcas son una lancha sin vela. El campo sigue en `tipos.ts` y en `datos/barcas.ts`; quitarlo toca el motor y los datos del astillero, que no eran de esta fase |
| La lancha no enseña a los tripulantes | `004` `R-303` · `003` `A-2xx` | El astillero vende remeros, timoneles y vigías, pero desde R2 no hay remos ni figuras a bordo. Hace falta decidir cómo se ve la tripulación en una lancha antes de modelarla |
| El crédito CC-BY de la lancha no se ve dentro del juego | `004` `R-303` | El modelo es de JuanSimon (Sketchfab, CC-BY-4.0). El crédito está en `arte/barcas/CREDITOS.md` y en la cabecera de `modelos.ts`; falta una pantalla de créditos en la aplicación |
| De noche las lanchas se leen como siluetas negras | `004` `R-401` | Visto en una captura de `Punta Tormenta` a mitad de R2, antes de que todas fueran lanchas; no se ha vuelto a mirar. La luz nocturna de `paleta.ts` es la de R1 y no se ha comparado con las barcas anteriores |
| El arnés de capturas dibuja por software y no mide fotogramas de verdad | `004` `RG2` | SwiftShader en el contenedor. Lo que sí mide son llamadas de dibujo, triángulos y **lo que se ve**, que es lo que encontró `DR1`, `DR6` y `DR7` |
| Tres vueltas por regata, como en el kart | `006` `KQ2` | Solo caben recortando la geometría, y eso rompe `B-202` (patín 62 %, trainera y galeota 0 %). Haría falta rediseñar los circuitos, no escalarlos |
| El arnés de regata (`regata-humo`, `baseline`) imprime tiempos de simulación, no de pantalla | `006` `K-101` | Sus umbrales de SPEC-001 están en simulación y siguen valiendo; `npm run diversion` es el que habla en tiempo real |
| Que la ceñida premie la habilidad también en mar abierto | `006` `KG5` | Faro y tormenta tienen dos curvas por vuelta: el experto les saca un 3,1–3,4 %, justo por encima del umbral, contra el 7–8 % de ria y canal. Haría falta otra maniobra de habilidad para las rectas |
| Indicador de carga del miniturbo, y que el aliento no llame «racha» al miniturbo | `006` `K-203` | No lo pedía ningún requisito: en un móvil no se ve que se está cargando hasta que salta |
| La velocidad en el tablero (nudos o km/h) | `006` `KQ3` | Cerrada sin hacer: el FOV y los avisos ya transmiten velocidad |
| El panel `?diagnostico=1` queda tapado por los botones en un móvil | `004` `R-602` | Ya pasaba antes de SPEC-006; se vio en las capturas de K3 |
| Olas de Gerstner que empujen de verdad a la barca | `004` `RQ2` | Hoy el oleaje del motor (`B-207`) y el del render (`R-201`) son dos cuentas distintas: se ven iguales pero no lo son |
