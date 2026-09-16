---
description: Redactar una especificación nueva a partir de la plantilla, y parar antes de programar
argument-hint: descripción corta de lo que hay que especificar
---

Vas a redactar una especificación para: **$ARGUMENTS**

Sigue el *Protocolo de nueva especificación* de
[`specs/WORKFLOW.md`](../../specs/WORKFLOW.md) §2, entero y en orden:

1. **Comprueba primero que no existe ya.** Lee [`specs/index.md`](../../specs/index.md) y busca en
   la tabla de enrutado. Si un requisito ya cubre la tarea, no hay especificación nueva: hay una
   implementación. Si existe pero el alcance cambia, se edita esa especificación.
2. **Reclama un prefijo** en el registro de `index.md`. Los libres están **solo allí**.
3. Redacta `specs/00N-<nombre-kebab>.md` partiendo de
   [`specs/000-plantilla.md`](../../specs/000-plantilla.md). No es negociable:
   - **§2 objetivos con métrica**, no adjetivos.
   - **§3 defectos medidos**, con la cifra que los delató. Un defecto afirmado sin medir no entra.
   - **§5 requisitos con criterio de aceptación** que se pueda convertir en test sin interpretar.
   - **§7 fases con puerta de salida** medible.
4. Regístrala en `index.md`: fila en la tabla de documentos con estado `📋 BORRADOR`, fila(s) en la
   tabla de enrutado, prefijo en el registro.

**Presenta el borrador y PARA. No escribas ni una línea de código sin aprobación explícita.**
