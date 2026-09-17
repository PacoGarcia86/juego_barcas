# Regata 2026

Juego de carreras de barcas al estilo del kart, en 3D y en el navegador.

**Pilotas una barca e intentas que no te adelanten.** Por el agua flotan **huevos** que se rompen
pasando por encima —no cuestan nada y vuelven a salir— y sueltan objetos: un ancla para el que
viene detrás, una ola, un kraken que va a por el que va primero, niebla para cegar a los de
delante. Con los doblones que ganas compras **barcas distintas** y **hombres** que reman, gobiernan
y vigilan por ti.

React + Vite + TypeScript + three.js. Sin servidor: la regata entera corre en el navegador.

---

## Jugar

```bash
npm ci
npm run dev
```

Con el pulgar o con el teclado: flechas para el timón, arriba para empujar, barra espaciadora para
soltar el objeto.

## Qué tiene dentro

| | |
|---|---|
| **Seis barcas** | Un frente de Pareto: ninguna es mejor que otra en todo. La `chalana` vira donde no cabe nadie; la `galeota` tiene seis plazas y velocidad de casco de 4,76 m/s; la `lancha` se sube encima del agua y en curva cerrada es un armario con motor |
| **Cinco oficios** | Remero, timonel, vigía, mecánico y contramaestre. Todos suman algo — y todos **pesan**, y el peso entra en la física |
| **Ocho objetos** | Repartidos por una ruleta que pondera por posición: el kraken sale ×77 más si vas último que si vas primero |
| **Cuatro circuitos** | `La Ría` y `El Canal` son de curva cerrada y los ganan las ágiles; `El Faro` y `Punta Tormenta` son de mar abierto y los ganan las largas y estables |

## Cómo se trabaja aquí

Este proyecto es **spec-driven**: antes de tocar código se lee
[`specs/index.md`](specs/index.md), que enruta a la sección que toca. El flujo completo está en
[`specs/WORKFLOW.md`](specs/WORKFLOW.md), y las instrucciones para agentes en
[`CLAUDE.md`](CLAUDE.md).

Tres reglas que no se negocian:

1. Cada requisito tiene un **ID estable**; el código que lo cumple lleva `// [ID]` y el test que lo
   prueba se llama `[ID] …`.
2. **Un cambio de alcance se escribe en la especificación antes que en el código.**
3. **Ninguna afirmación sobre la regata sin medirla.** `npm run baseline` es la puerta.

## Órdenes

| Orden | Qué hace |
|---|---|
| `npm run dev` | Vite en local |
| `npm run lint` | `tsc --noEmit` |
| `npm test` | Suite completa (`node --test` sobre `.ts` crudo) |
| `npm run build` | `vite build` + service worker |
| `npm run baseline` | **Puerta obligatoria** de todo cambio de regata: 4 circuitos × 8 semillas |
| `npm run regata-humo <circuito> [vueltas] [semilla] [barca]` | Una regata con detalle |
| `npm run objetos-audit` | Comprueba la ruleta y que no quede nada vivo en el agua |
| `npm run icons` | Regenera los iconos de la aplicación instalable |

## Despliegue

`main` despliega solo a Firebase Hosting en cada push. Los detalles, en
[`DEPLOYMENT.md`](DEPLOYMENT.md).
