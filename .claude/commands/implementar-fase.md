---
description: Implementar una fase de una especificación aprobada, contra sus IDs de requisito
argument-hint: SPEC-00N Fase N (o describe la tarea)
---

Vas a implementar: **$ARGUMENTS**

Sigue [`specs/WORKFLOW.md`](../../specs/WORKFLOW.md), pasos 1 a 4:

1. **Enrutado** — [`specs/index.md`](../../specs/index.md) primero; carga solo las secciones a las
   que te enrute, nunca la especificación entera.
2. **Puerta de especificación** — enumera los IDs que cubre esta fase y su criterio de aceptación.
   Si algo que hay que hacer no está en ningún requisito, **para**: eso es un cambio de alcance y
   se escribe en la especificación antes que en el código.
3. **Plan** — di qué ficheros vas a crear o modificar y qué ID cubre cada cambio. Luego implementa,
   con `// [ID]` en el código.
4. **Tests** — uno por requisito como mínimo, nombrado `[ID] …`. Reutiliza `montar()` de
   [`ayudas.ts`](../../src/engine/__tests__/ayudas.ts).

Respeta los invariantes de [`CLAUDE.md`](../../CLAUDE.md): PRNG con semilla `B-901`, capas `B-902`,
sin E/S en el motor `B-903`, borrado de tipos `B-904`, y que la interfaz no habla en newtons.

Si tocas la física, la IA, los objetos o el circuito, `npm run baseline` **antes de dar nada por
bueno**. Los seis defectos de SPEC-001 §3 salieron de esa tabla y ninguno era deducible leyendo el
código.

No cierres la fase aquí. Cerrarla es `/cerrar-fase`.
