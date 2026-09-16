# SPEC-005 — Progreso, aplicación y despliegue

| Campo | Valor |
|---|---|
| **ID** | SPEC-005 |
| **Título** | La partida se guarda sola, el juego se instala y `main` despliega a Firebase |
| **Estado** | ✅ `COMPLETADA` (Fase P1) |
| **Autor** | — |
| **Creado** | 2026-09-16 |
| **Módulos afectados** | `src/engine/progreso.ts`, `public/manifest.json`, `vite.config.ts`, `firebase.json`, `.github/workflows/*` |
| **Depende de** | SPEC-003 (`A-3xx` qué hay que guardar) |
| **Reemplaza** | nada |

---

## 0. Cómo se usa este documento

Reglas de [`WORKFLOW.md`](WORKFLOW.md) sin cambios. **Prefijo: `P-`** (de *progreso*).

---

## 1. Contexto y problema

El juego es 100 % cliente: no hay servidor, ni base de datos, ni cuentas. Lo que hay que guardar es
poco —doblones, barcas compradas, tripulantes, barca equipada— y cabe en `localStorage`.

Lo que **no** se puede hacer es guardar al salir. En un móvil nadie «sale» de una aplicación: la
cierra el sistema cuando le hace falta la memoria, y un guardado al salir significa perder la
partida. Se guarda en cada cambio (`P-103`).

Y hay un caso que se olvida siempre: **`localStorage` puede lanzar**. En navegación privada de iOS
y con las cookies de terceros bloqueadas, el mero acceso tira una excepción. Un juego que revienta
al arrancar porque no puede guardar es un juego roto para una parte real de la gente (`P-104`).

---

## 2. Objetivos y no-objetivos

### 2.1 Objetivos

| # | Objetivo | Métrica de éxito |
|---|---|---|
| **PG1** | No se pierde una partida por cerrar la pestaña | Se guarda en cada cambio del astillero y tras cada regata |
| **PG2** | El juego funciona con el almacenamiento bloqueado | Con un almacén que lanza en `get` y en `set`, el juego arranca, se juega y avisa una vez |
| **PG3** | Se instala en Android y en iOS | Manifiesto, iconos maskable y `apple-touch-icon` presentes en `dist/`, comprobado en CI |
| **PG4** | Un push a `main` llega desplegado sin tocar nada | `deploy.yml` corre la misma puerta que un PR y publica en Firebase Hosting |

### 2.2 No-objetivos

- **No hay partidas en la nube.** Anotado en `index.md` como trabajo no realizado.
- **No se juega sin conexión en la primera visita.** Se precacha el armazón, no se promete más.

---

## 3. Defectos medidos (auditoría 2026-09-16)

| ID | Fichero | Defecto | Medición | Consecuencia |
|---|---|---|---|---|
| **DP1** | `progreso.ts` | `localStorage` sin `try/catch` | El juego no arrancaba en Safari privado: **excepción en el primer render** (N=1) | Pantalla en blanco |
| **DP2** | `progreso.ts` | Sin número de versión en el guardado | Un cambio del catálogo dejó partidas con `barcaEquipada` inexistente: **`undefined` al entrar en regata** (N=1) | Partida irrecuperable |
| **DP3** | `vite.config.ts` | Dos `<link rel="manifest">`: el del plugin y el de `index.html` | La pantalla de inicio de Android cogió el nombre del plugin, no el del juego (N=1) | Icono y nombre equivocados |

---

## 4. Arquitectura objetivo

```
src/engine/progreso.ts   NUEVO  ÚNICA excepción a «el motor no hace E/S» [B-903]
public/manifest.json     NUEVO  Manifiesto canónico, enlazado desde index.html
vite.config.ts           MOD    `manifest: false` en VitePWA (DP3)
.github/workflows/       NUEVO  ci.yml (puerta) + deploy.yml (la reutiliza)
```

`progreso.ts` **recibe el almacén por parámetro** y usa `localStorage` solo como valor por defecto.
Así se prueba sin navegador y `PG2` es comprobable con un almacén que lanza.

---

## 5. Requisitos

### P-1xx · Guardar

| ID | Requisito | Aceptación |
|---|---|---|
| **P-101** | La partida se guarda en `localStorage` bajo `regata-2026`: doblones, barcas compradas, tripulantes comprados, embarcados y barca equipada. Nada más | `guardar`/`cargar` hacen ida y vuelta sin pérdida |
| **P-102** | **Número de versión en el guardado** (`DP2`). Al cargar, una partida de versión distinta pasa por `migrar`, que descarta lo que ya no existe y deja una jugable | Cargar un guardado con `barcaEquipada: 'inexistente'` devuelve una partida con la `chalana` equipada, no `undefined` |
| **P-103** | Se guarda **en cada cambio**, no al salir | El componente guarda en el efecto del cambio de estado, no en `beforeunload` |
| **P-104** | **El almacén puede lanzar** (`DP1`). Todo acceso va en `try/catch`; si falla, el juego sigue y avisa **una vez** | Con un almacén que lanza en `get` y en `set`, `cargar` devuelve `null` y `guardar` devuelve `false`, sin excepción |
| **P-105** | `progreso.ts` recibe el almacén por parámetro (`B-903`). Es la única excepción declarada a «el motor no hace E/S» | La firma acepta `Almacen` y `higiene.test.ts` lo exceptúa por nombre, no por carpeta |

### P-2xx · Aplicación instalable

| ID | Requisito | Aceptación |
|---|---|---|
| **P-201** | Manifiesto canónico en `public/manifest.json`, enlazado desde `index.html`. **VitePWA con `manifest: false`** (`DP3`): dos manifiestos significan nombre e iconos equivocados | `dist/index.html` tiene exactamente un `<link rel="manifest">` |
| **P-202** | Iconos 192, 512, maskable 192 y 512, `apple-touch-icon` 180 y `icon.svg`. Se generan con `npm run icons`, no se dibujan a mano | CI comprueba que los seis están en `dist/` |
| **P-203** | Se precacha el armazón (código, estilos, iconos). El juego genera sus mallas y colores por código: no hay megas de textura que justifiquen otra política | `globPatterns` cubre `js,css,html,svg,woff2` |

### P-3xx · Despliegue

| ID | Requisito | Aceptación |
|---|---|---|
| **P-301** | `firebase.json` declara la caché: `/assets/**` inmutable un año (llevan hash), `*.html` y `*.json` sin caché, `/sw.js` sin caché, y reescritura de todo a `/index.html` | Las cuatro reglas están en el fichero |
| **P-302** | `deploy.yml` **reutiliza `ci.yml`** con `workflow_call`: la misma puerta que un PR corre antes de cada despliegue, sin duplicar pasos | `deploy.yml` tiene `uses: ./.github/workflows/ci.yml` |
| **P-303** | La credencial de Firebase vive en los secretos del repositorio (`FIREBASE_SERVICE_ACCOUNT`), **nunca en un fichero**. `projectId` va explícito en el flujo de trabajo, no se resuelve desde `.firebaserc` | `grep` de la credencial en el repositorio no encuentra nada; `projectId: juego-barcas` está escrito |
| **P-304** | `ci.yml` no pide ninguna credencial de nube: el código de un fork nunca puede llegar a Firebase | `ci.yml` tiene `permissions: contents: read` y ningún secreto |

---

## 6. Plan de pruebas

### 6.1 Posiciones doradas

| Defecto | Test |
|---|---|
| DP1 | `[P-104]` con un almacén que lanza, `cargar` devuelve `null` y no revienta |
| DP2 | `[P-102]` un guardado con barca inexistente se migra a una jugable |
| DP3 | CI: `dist/index.html` tiene exactamente un `<link rel="manifest">` |

### 6.2 No-regresión

`npm run build` deja los seis iconos y el `sw.js` en `dist/`. Lo comprueba CI, no una persona.

---

## 7. Fases y puertas de salida

### Fase P1 — Guardado, instalación y despliegue · ✅ **CERRADA 2026-09-16**
**Alcance:** `P-1xx`, `P-2xx`, `P-3xx`
**Puerta:** `cargar`/`guardar` con almacén que lanza en verde; `dist/` con los seis iconos y el
service worker; `deploy.yml` reutilizando `ci.yml`.
**Resultado:** 149 tests en verde · `tsc --noEmit` limpio · `vite build` correcto.

| Comprobación | Resultado |
|---|---|
| `P-104` · almacén que lanza en `get`, `set` y `borrar` | `cargar` → `null`, `guardar` → `false`, `borrar` sin excepción |
| `P-102` · partida con barca inexistente | sale con la `chalana` equipada, jugable |
| `P-201` · `<link rel="manifest">` en `dist/index.html` | **1** |
| `P-202` · iconos en `dist/` | los **6**, generados con `npm run icons` |
| `P-203` · precaché del armazón | **12 entradas, 814 KiB** |

---

## 8. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Un cambio del catálogo de barcas rompe partidas guardadas | Medio | `P-102`: versión + `migrar`, con test |
| El despliegue va al proyecto equivocado | Alto | `projectId` explícito en `deploy.yml` (`P-303`), no resuelto |

---

## 9. Preguntas abiertas

| # | Pregunta | Bloquea | Decisión |
|---|---|---|---|
| **PQ1** | ¿Partidas en la nube y varios dispositivos? | — | Anotado en `index.md` como trabajo no realizado |

---

## Anexo A — Contratos de datos propuestos

```ts
// [P-105] Recibe el almacén: se prueba sin navegador.
export interface Almacen { get(k: string): string | null; set(k: string, v: string): void; borrar(k: string): void }

// [P-104] Nunca lanzan. `guardar` devuelve si pudo.
export function cargar(almacen?: Almacen): Partida | null;
export function guardar(p: Partida, almacen?: Almacen): boolean;

// [P-102] Una partida de otra versión sale jugable o no sale.
export function migrar(bruto: unknown): Partida | null;
```

---

## Anexo B — Mapa de trazabilidad

| Defecto | Requisito | Fase | Estado | Test de regresión |
|---|---|---|---|---|
| DP1 · almacén que lanza | `P-104` | P1 | ✅ | `[P-104] el almacén puede lanzar` |
| DP2 · guardado sin versión | `P-102` | P1 | ✅ | `[P-102] una partida vieja se migra` |
| DP3 · dos manifiestos | `P-201` | P1 | ✅ | CI |
