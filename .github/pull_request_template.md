## Qué cambia

<!-- Una o dos frases. Qué hace ahora el juego que antes no hacía, o qué dejaba de hacer bien. -->

## Requisitos cubiertos

<!-- OBLIGATORIO: al menos un ID. Sin esto el PR no se acepta (WORKFLOW.md §6). -->

- `B-xxx` — …

## Cómo se ha comprobado

- [ ] `npm run lint` limpio
- [ ] `npm test` en verde (`<n>` tests)
- [ ] `npm run build` correcto
- [ ] Test nuevo o modificado, nombrado con su ID

## Arnés de regata

<!-- OBLIGATORIO si has tocado fisica.ts, carrera.ts, ia.ts, objetos.ts o circuito.ts.
     Pega la tabla de `npm run baseline`. Las columnas que valen son media, 2.º,
     adelantamientos al jugador y reparto de victorias. -->

```
circuito     | media  | 2.º   | adel. | ganadores
```

## Lo que la medición contradijo

<!-- Si el arnés desmintió algo que la especificación afirmaba, va aquí Y en la especificación.
     No se corrige en silencio (WORKFLOW.md §5.3). Si no aplica, «nada». -->
