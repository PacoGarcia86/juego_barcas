# SPEC-00N — <Título corto>

> **Plantilla.** Copia este fichero a `specs/00N-<nombre-kebab>.md`, rellénalo y bórrale esta cita.
> Los comentarios `<!-- … -->` son instrucciones: quítalos al rellenar.
> No registres esta plantilla como especificación: no se implementa.

| Campo | Valor |
|---|---|
| **ID** | SPEC-00N |
| **Título** | <una línea que diga qué cambia, no qué área toca> |
| **Estado** | 📋 `BORRADOR` |
| **Autor** | — |
| **Creado** | <AAAA-MM-DD> |
| **Módulos afectados** | <ficheros o globs> |
| **Depende de** | <SPEC-00M (qué piezas consume) o «nada»> |
| **Reemplaza** | <qué código deja de existir, con `fichero:línea`, o «nada»> |

---

## 0. Cómo se usa este documento

Se aplican las reglas de [`WORKFLOW.md`](WORKFLOW.md) sin cambios: ID estable por
requisito, comentario `// [ID]` en el código que lo cumple, test nombrado con el ID, y cambio de
alcance → se edita este fichero **antes** que el código.

**Prefijo de este documento: `X-`** <!-- reclámalo en el registro de index.md ANTES de escribir requisitos --> —
distinto de los ya usados (mira el registro de [`index.md`](index.md)) para que un `grep` no
cruce documentos. Los requisitos de otras especificaciones se citan con su ID original.

---

## 1. Contexto y problema

<!-- Qué hay hoy, por qué no sirve, y qué se pierde por ello. Concreto y con referencias a
     `fichero:línea`. Si el problema es que ya existe una pieza mejor sin usar, dilo: es el
     patrón que originó SPEC-002 y SPEC-003. -->

---

## 2. Objetivos y no-objetivos

### 2.1 Objetivos

<!-- Cada objetivo lleva métrica de éxito comprobable. Sin cifra no es un objetivo. -->

| # | Objetivo | Métrica de éxito |
|---|---|---|
| **XG1** | | |

### 2.2 No-objetivos

<!-- Lo que explícitamente NO se hace. Protege el alcance y evita que la implementación se
     expanda sola. -->

- …

---

## 3. Defectos medidos (auditoría <AAAA-MM-DD>)

<!-- Este proyecto MIDE los defectos antes de arreglarlos. `N` es el tamaño de muestra de cada
     medición. Un defecto afirmado sin medir no entra en la especificación. -->

| ID | Fichero | Defecto | Medición | Consecuencia |
|---|---|---|---|---|
| **DX1** | `fichero:línea` | | (N=…) | |

---

## 4. Arquitectura objetivo

```
<!-- Árbol de ficheros con qué es nuevo, qué se modifica y qué prefijo de requisito le
     corresponde a cada pieza. -->
```

<!-- Declara los principios que la arquitectura sostiene: separación de capas, pureza, quién
     conoce a quién. «Ninguna capa inferior conoce a la superior» es el que rige el motor. -->

---

## 5. Requisitos

### X-1xx · <grupo>

| ID | Requisito | Aceptación |
|---|---|---|
| **X-101** | | |

<!-- Repite un apartado por grupo. La columna de aceptación es un contrato: debe poder
     convertirse en un test sin interpretación. «Funciona bien» no es un criterio;
     «con una barca de 9 m de eslora a 4,2 m/s,
     `resistenciaDeOla` devuelve al menos 2,5 veces la de 3,0 m/s» sí. -->

---

## 6. Plan de pruebas

**Runner:** `node --test` sobre `.ts` crudo. Restricciones que impone el borrado de tipos de Node:
`import type` para importaciones de solo tipos, extensión `.ts` explícita, sin `enum` ni `namespace`.
Las comprueba [`higiene.test.ts`](../src/engine/__tests__/higiene.test.ts).

### 6.1 <Invariantes / propiedades>

<!-- Propiedades que deben cumplirse SIEMPRE, sobre N casos generados con semilla fija. -->

### 6.2 Posiciones doradas

<!-- Casos con la respuesta correcta anotada y su justificación. Incluye siempre los defectos
     de §3 como regresión. -->

### 6.3 Cotas de terminación

<!-- Si generas escenarios: demuestra que el coste lo fija una cota y no la suerte. La forma
     preferida es eliminar el bucle, no ponerle un contador (lección de DB1). -->

### 6.4 No-regresión

<!-- La suite completa sigue en verde: <total actual> tests. -->

---

## 7. Fases y puertas de salida

<!-- Una fase = un incremento que entrega valor y se puede medir. Sin puerta medible no es fase.
     Al cerrarla se añade `· ✅ **CERRADA <fecha>**` y el bloque Resultado con cifras. -->

### Fase X1 — <nombre>
**Alcance:** <IDs>
**Puerta:** <criterio medible que hay que superar para pasar a la siguiente fase>

---

## 8. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| | | |

---

## 9. Preguntas abiertas

<!-- Una pregunta abierta declara qué fase bloquea. Al resolverse se anota la decisión y la
     fecha, y se tacha; no se borra. -->

| # | Pregunta | Bloquea |
|---|---|---|
| **XQ1** | | |

---

## Anexo A — Contratos de datos propuestos

```ts
// Firmas e interfaces públicas, con [ID] del requisito que las exige.
```

---

## Anexo B — Mapa de trazabilidad defecto → requisito → fase

| Defecto | Requisito | Fase | Estado | Test de regresión |
|---|---|---|---|---|
| DX1 · … | X-101 | X1 | | |

---

<!-- Al cerrar la última fase se añaden estos apartados, con el formato de SPEC-001:

## Resumen de cierre — <fecha>
  Tabla objetivo → umbral → resultado, y el recuento de defectos corregidos.

### Lo que la medición cambió respecto a lo escrito
  Tabla requisito → lo que decía la especificación → lo que dijo la medición.
  OBLIGATORIO si el arnés desmintió algo. Es el apartado más valioso del documento.

### Trabajo identificado y no realizado
  Para que no se pierda. Se replica en la tabla de index.md.
-->
