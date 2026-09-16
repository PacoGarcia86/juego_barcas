# Flujo de trabajo spec-driven

Documento canónico. Las órdenes (`/nueva-spec`, `/implementar-fase`, `/cerrar-fase`) apuntan aquí;
no repiten el contenido, para que haya una sola copia que mantener.

**Los pasos van en orden y no se fusionan.**

---

## Paso 1 — Enrutado

Lee [`index.md`](index.md) y carga **solo** los apartados a los que te enrute. No cargues una
especificación entera: son largas, y cargarlas enteras es un error, no una precaución.

Antes de proponer código nuevo, comprueba si ya existe la pieza. El mapa del motor está en
[`../CLAUDE.md`](../CLAUDE.md). La cuenta que más fácil se duplica en este juego es **la posición
en el circuito**: metros recorridos, vuelta y punto del trazado salen todos de `circuito.ts`. Si
el render se pone a acumular su propia distancia, las boyas y las barcas dejan de coincidir.

---

## Paso 2 — Puerta de especificación

### ✅ Existe un requisito que cubre la tarea

Anota su ID y sigue al Paso 3. Impleméntalo tal como está escrito: ni más ni menos.

### ✏️ Existe pero hay que cambiar el alcance

**Edita la especificación primero, el código después.** Nunca al revés. Un requisito modificado
mantiene su ID; si cambia lo que promete, la fase que lo cerró deja de ser válida y hay que volver
a pasar su puerta.

### ❌ No existe — Protocolo de nueva especificación

1. **Reclama un prefijo** en el registro de [`index.md`](index.md). La lista de libres vive **solo
   allí**: no la copies aquí, mírala.
2. Redacta `specs/00N-<nombre-kebab>.md` partiendo de [`000-plantilla.md`](000-plantilla.md).
   Obligatorio para que la especificación sea utilizable:
   - **§2 objetivos con métrica de éxito**, no adjetivos. «Regatas más emocionantes» no es un
     objetivo; «el segundo clasificado a menos de 12 s del ganador sobre 5 regatas» sí.
   - **§3 defectos medidos.** Este proyecto mide los defectos antes de arreglarlos.
   - **§5 requisitos con criterio de aceptación verificable** por requisito.
   - **§7 fases con puerta de salida.** Una fase sin puerta medible no es una fase.
3. Regístrala en [`index.md`](index.md): fila en la tabla de documentos con estado `📋 BORRADOR`,
   fila(s) en la tabla de enrutado, prefijo en el registro.
4. **Presenta el borrador y PARA. No escribas ni una línea de código sin aprobación explícita.**

---

## Paso 3 — Implementación

- **`// [ID]` en el código que cumple cada requisito.** Es lo que hace la trazabilidad comprobable.
- Cambios quirúrgicos: modifica las líneas necesarias. No reformatees ni refactorices lo de al lado.
- Sin abstracciones especulativas ni ayudantes de un solo uso.
- Respeta los invariantes de [`../CLAUDE.md`](../CLAUDE.md): PRNG con semilla (`B-901`), el motor
  sin E/S (`B-903`), separación de capas (`B-902`), pureza de la física, y que la interfaz no
  habla en newtons.
- Fichero nuevo en `src/engine/` o `src/render/`: `import type`, extensión `.ts` explícita, sin
  `enum` ni `namespace` — el runner borra tipos, no compila.
- Los modos (`src/modes/`) **consumen** el motor. Si te encuentras escribiendo criterio de regata
  en un modo, para.

---

## Paso 4 — Tests

- Un test por requisito nuevo o cambiado, **nombrado con su ID**:
  `test('[B-201] la estela ahorra…', …)`.
- Ubicación: `src/engine/__tests__/`. Reutiliza [`ayudas.ts`](../src/engine/__tests__/ayudas.ts):
  `montar()` deja una regata completa lista para simular en una línea.
- Invariantes comprobables sobre el código fuente (prohibiciones, capas, formas de importar) →
  patrón de [`higiene.test.ts`](../src/engine/__tests__/higiene.test.ts). Es barato y difícil de
  eludir por accidente.
- Un cambio que afecte a cómo se corre una regata → aserción en
  [`realismo.test.ts`](../src/engine/__tests__/realismo.test.ts), que simula regatas enteras.

```
npm test
```

Si un test preexistente falla, arréglalo antes de seguir.

---

## Paso 5 — Puerta de fase (`/cerrar-fase`)

Ninguna fase se cierra sin las tres comprobaciones:

```
npm run lint          # tsc --noEmit limpio
npm test              # suite completa en verde
npm run build         # vite build + service worker
```

### 5.1 Arnés de regata — obligatorio si tocaste la física, la IA, los objetos o el circuito

Si el cambio toca `fisica.ts`, `carrera.ts`, `ia.ts`, `objetos.ts` o `circuito.ts`:

```
npm run regata-humo ria 3        # circuito con corriente de río
npm run regata-humo faro 3       # mar abierto con oleaje
npm run baseline                 # los cuatro circuitos de golpe, en tabla
```

**Las cuatro cifras que valen son la velocidad media, la diferencia del segundo, los
adelantamientos sufridos por el jugador y el reparto de victorias.** No «parece que va mejor».

| Lo que se mira | Qué delata |
|---|---|
| Velocidad media | Si el casco no plana, o si plana siempre y la eslora deja de importar |
| Diferencia del 2.º | Si la IA persigue o se descuelga: una regata con el 2.º a un minuto está rota |
| Adelantamientos al jugador | **Es el objetivo del juego** (`B-704`). Cero siempre = la IA no ataca; diez siempre = el jugador no puede defender |
| Reparto de victorias entre las ocho barcas | Si un solo casco gana el 100 %, el astillero no tiene sentido |

### 5.2 Escribe el resultado en la especificación

En el apartado de la fase:

```markdown
### Fase N — <nombre> · ✅ **CERRADA <fecha>**
**Alcance:** <IDs cubiertos>
**Puerta:** <criterio>
**Resultado:** <N> tests en verde · `tsc --noEmit` limpio · `vite build` correcto.

| Comprobación | Resultado |
|---|---|
| <ID> · <qué> | <cifra medida> |
```

Actualiza `Estado` en la cabecera del documento y en [`index.md`](index.md).

### 5.3 Anota lo que la medición contradijo

Si el arnés desmintió algo que la especificación afirmaba, **escríbelo** en «Lo que la medición
cambió respecto a lo escrito». No lo corrijas en silencio. Es el apartado más valioso de cualquier
especificación de este proyecto.

---

## Paso 6 — Git

`main` despliega a Firebase Hosting en cada push. **No se commitea en `main`.**

```
git checkout main && git pull origin main
git checkout -b feature/<kebab-corto>
git add <solo los ficheros de este trabajo>
git status
```

Commit en formato Conventional Commits (`feat` · `fix` · `refactor` · `test` · `docs` · `chore`):

```
<tipo>(<ámbito>): <resumen corto>

- <qué cambió y por qué>
- Spec: SPEC-00N Fase N cerrada · B-xxx, B-yyy
- Tests: <n> añadidos, suite <total> en verde
- Arnés: <media> m/s · 2.º a <n> s · <n> adelantamientos   ← si tocaste la regata
```

PR contra `main` usando [`.github/pull_request_template.md`](../.github/pull_request_template.md).
**Un PR que no cite al menos un ID de requisito no se acepta.**

---

## Lista de comprobación final

- [ ] Cargué solo las secciones que `index.md` enruta, no documentos enteros
- [ ] Todo requisito nuevo o cambiado está escrito en la especificación **antes** que en el código
- [ ] Cada requisito implementado tiene su `// [ID]` en el código
- [ ] Cada requisito tiene test nombrado con su ID
- [ ] `npm run lint` · `npm test` · `npm run build` limpios
- [ ] Si toqué la regata: arnés ejecutado y las cuatro cifras anotadas en el PR
- [ ] Bloque `Resultado:` con cifras medidas escrito en la fase
- [ ] Lo que la medición contradijo está anotado, no corregido en silencio
- [ ] `Estado` actualizado en la cabecera del documento y en `index.md`
- [ ] Rama `feature/…`, commit convencional, PR con IDs citados
