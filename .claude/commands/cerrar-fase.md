---
description: Pasar la puerta de una fase y dejarla cerrada con cifras medidas
argument-hint: SPEC-00N Fase N
---

Vas a cerrar: **$ARGUMENTS**

Sigue [`specs/WORKFLOW.md`](../../specs/WORKFLOW.md) §5. Las tres comprobaciones no se saltan:

```
npm run lint
npm test
npm run build
```

**Si el cambio tocó `fisica.ts`, `carrera.ts`, `ia.ts`, `objetos.ts` o `circuito.ts`:**

```
npm run baseline
```

Las cifras que valen son **velocidad media, diferencia del segundo, adelantamientos sufridos por
el jugador y reparto de victorias**. «Parece que va mejor» no es un resultado. Compáralas con los
umbrales de SPEC-001 §2.1.

Luego, en la especificación:

1. Marca la fase `· ✅ **CERRADA <fecha>**` y escribe el bloque `Resultado:` con la tabla de
   comprobaciones y **las cifras medidas**, no descripciones.
2. Si el arnés desmintió algo que la especificación afirmaba, escríbelo en «Lo que la medición
   cambió respecto a lo escrito». **No lo corrijas en silencio**: es el apartado más valioso del
   documento.
3. Actualiza `Estado` en la cabecera del documento y en
   [`specs/index.md`](../../specs/index.md).
4. Si quedó trabajo identificado y no hecho, anótalo en la tabla del final de `index.md`.

Termina con el commit convencional y el PR según §6, citando los IDs cubiertos.
