// Invariantes que se comprueban sobre el CÓDIGO FUENTE, no sobre su resultado.
//
// Son baratos y difíciles de saltarse sin querer, que es justo lo que hace
// falta para las reglas que se rompen «temporalmente» y ya no se arreglan.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '../../..');

function ficheros(dir: string, extensiones: string[] = ['.ts', '.tsx']): string[] {
  const salida: string[] = [];
  const recorrer = (d: string): void => {
    for (const entrada of readdirSync(d)) {
      const completa = path.join(d, entrada);
      if (statSync(completa).isDirectory()) recorrer(completa);
      else if (extensiones.some((e) => entrada.endsWith(e))) salida.push(completa);
    }
  };
  recorrer(path.join(RAIZ, dir));
  return salida;
}

const leer = (f: string): string => readFileSync(f, 'utf8');
const relativo = (f: string): string => path.relative(RAIZ, f);

/** Quita comentarios y cadenas: una prohibición no puede saltar por un comentario. */
function codigo(fuente: string): string {
  return fuente
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""');
}

test('[B-901] Math.random está prohibido fuera de los tests', () => {
  // Toda la aleatoriedad pasa por `rng.ts`: una regata tiene que poder
  // repetirse exactamente para poder depurarla y para que el arnés mida lo
  // mismo dos veces.
  for (const dir of ['src/engine', 'src/render', 'src/modes', 'src/components', 'src/juego']) {
    for (const f of ficheros(dir)) {
      if (f.includes('__tests__')) continue;
      assert.ok(!codigo(leer(f)).includes('Math.random'), `${relativo(f)} usa Math.random`);
    }
  }
});

test('[B-903] el motor no hace entrada/salida, salvo `progreso.ts`', () => {
  const prohibidos = ['fetch(', 'localStorage', 'sessionStorage', 'document.', 'window.', 'XMLHttpRequest'];
  for (const f of ficheros('src/engine')) {
    if (f.includes('__tests__') || f.endsWith('progreso.ts')) continue;
    const fuente = codigo(leer(f));
    for (const p of prohibidos) assert.ok(!fuente.includes(p), `${relativo(f)} usa ${p}`);
  }
});

test('[B-902] ninguna capa inferior conoce a la superior', () => {
  const reglas: { dir: string; prohibido: RegExp; motivo: string }[] = [
    { dir: 'src/engine', prohibido: /from '\.\.\/(render|components|modes|juego)\//, motivo: 'el motor no conoce la pantalla' },
    { dir: 'src/engine', prohibido: /from 'react'/, motivo: 'el motor no es React' },
    { dir: 'src/render', prohibido: /from '\.\.\/(components|modes|juego)\//, motivo: 'el render no conoce la interfaz' },
    { dir: 'src/render', prohibido: /from 'react'/, motivo: 'el render pinta, no monta componentes' },
  ];
  for (const regla of reglas) {
    for (const f of ficheros(regla.dir)) {
      if (f.includes('__tests__')) continue;
      assert.ok(!regla.prohibido.test(leer(f)), `${relativo(f)}: ${regla.motivo}`);
    }
  }
});

test('[B-904] en el motor y el render, importaciones con extensión `.ts` explícita', () => {
  // El runner borra tipos, no compila: un especificador sin extensión sobrevive
  // al borrado y falla en ejecución.
  for (const dir of ['src/engine', 'src/render']) {
    for (const f of ficheros(dir)) {
      for (const m of leer(f).matchAll(/from '(\.[^']*)'/g)) {
        const r = m[1]!;
        assert.ok(r.endsWith('.ts') || r.endsWith('.tsx'), `${relativo(f)} importa «${r}» sin extensión`);
      }
    }
  }
});

test('[B-904] sin `enum` ni `namespace`: no son sintaxis borrable', () => {
  for (const dir of ['src/engine', 'src/render']) {
    for (const f of ficheros(dir)) {
      const fuente = codigo(leer(f));
      assert.ok(!/\benum\s+\w/.test(fuente), `${relativo(f)} declara un enum`);
      assert.ok(!/\bnamespace\s+\w/.test(fuente), `${relativo(f)} declara un namespace`);
    }
  }
});

test('[B-904] los tipos se importan con `import type`', () => {
  for (const dir of ['src/engine', 'src/render']) {
    for (const f of ficheros(dir)) {
      if (f.endsWith('tipos.ts')) continue;
      for (const m of leer(f).matchAll(/^import\s+\{[^}]*\}\s+from\s+'[^']*tipos\.ts'/gm)) {
        assert.ok(m[0].startsWith('import type'), `${relativo(f)}: ${m[0].split('\n')[0]}`);
      }
    }
  }
});

test('[H-101] los huevos no cuestan nada: la economía y los huevos no se conocen', () => {
  // Es la regla que define el sistema de objetos. Un `import` entre estos dos
  // ficheros es el primer paso de «y si un objeto costase N doblones».
  const huevos = leer(path.join(RAIZ, 'src/engine/huevos.ts'));
  assert.ok(!/from '\.\/economia\.ts'/.test(huevos), 'huevos.ts importa la economía');
  assert.ok(!/doblon/i.test(codigo(huevos)), 'huevos.ts habla de doblones');
  const economia = leer(path.join(RAIZ, 'src/engine/economia.ts'));
  assert.ok(!/from '\.\/(huevos|objetos)\.ts'/.test(economia), 'economia.ts importa los huevos o los objetos');
});

test('[A-204] la tripulación no es un multiplicador: la física no la conoce', () => {
  const fisica = leer(path.join(RAIZ, 'src/engine/fisica.ts'));
  assert.ok(!/from '\.\/(tripulacion|astillero)\.ts'/.test(fisica), 'fisica.ts importa la tripulación');
  assert.ok(!/tripulante|remero|timonel/i.test(codigo(fisica)), 'fisica.ts menciona oficios');
});

test('[H-209] el render no calcula objetos: solo lee tipos', () => {
  for (const f of ficheros('src/render')) {
    for (const m of leer(f).matchAll(/^import\s+(type\s+)?[^;]*?from\s+'[^']*engine\/[^']*'/gm)) {
      assert.ok(m[1] !== undefined, `${relativo(f)}: del motor solo \`import type\` — ${m[0].split('\n')[0]}`);
    }
  }
});

test('[R-104] `trazado.ts` no importa three: por eso se prueba con números', () => {
  const f = path.join(RAIZ, 'src/render/tresd/trazado.ts');
  assert.ok(!/from 'three'/.test(leer(f)), 'trazado.ts importa three');
});

test('[R-401] el color del render sale de `paleta.ts` y de ningún otro sitio', () => {
  // Aquí NO se usa `codigo()`: un color literal vive dentro de una cadena y
  // `codigo()` vacía las cadenas, así que el test pasaría siempre. Se quitan
  // solo los comentarios.
  const sinComentarios = (fuente: string): string =>
    fuente.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  for (const f of ficheros('src/render')) {
    if (f.endsWith('paleta.ts')) continue;
    const fuente = sinComentarios(leer(f));
    const color = fuente.match(/#[0-9a-fA-F]{6}\b/);
    assert.ok(color === null, `${relativo(f)} declara el color literal ${color?.[0]}`);
  }
});

test('[R-504] solo `vista.ts` toca el renderizador de WebGL', () => {
  for (const f of ficheros('src/render')) {
    if (f.endsWith('vista.ts')) continue;
    assert.ok(!codigo(leer(f)).includes('WebGLRenderer'), `${relativo(f)} crea un WebGLRenderer`);
  }
});

test('[H-302] la interfaz no habla en newtons', () => {
  // «N», «newtons» y «empuje» son unidades internas del motor. Al patrón se le
  // dice qué pasa en el agua, no cuánta fuerza hay detrás.
  const prohibidos = [/\bnewtons?\b/i, /\bempuje\b/i, /\bN\s*de\s*empuje\b/i];
  for (const dir of ['src/modes', 'src/components']) {
    for (const f of ficheros(dir)) {
      const visible = [...leer(f).matchAll(/>([^<>{}]{4,})</g)].map((m) => m[1]!).join(' ');
      for (const p of prohibidos) {
        assert.ok(!p.test(visible), `${relativo(f)} enseña «${visible.match(p)?.[0]}» en pantalla`);
      }
    }
  }
});

test('[B-9xx] los ficheros del motor no crecen sin control', () => {
  // Un fichero de mil líneas no se revisa: se hojea. El tope no es estético.
  for (const f of ficheros('src/engine').concat(ficheros('src/render'))) {
    if (f.includes('__tests__') || f.includes('/datos/')) continue;
    const lineas = leer(f).split('\n').length;
    assert.ok(lineas < 700, `${relativo(f)} tiene ${lineas} líneas`);
  }
});
