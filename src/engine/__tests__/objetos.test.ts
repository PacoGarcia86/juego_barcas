// [H-1xx] [H-2xx] Los huevos y los ocho objetos.

import test from 'node:test';
import assert from 'node:assert/strict';
import { envejecerHuevos, huevoPisado, huevosDe, REAPARICION, tirarRuleta } from '../huevos.ts';
import {
  ALCANCE_OLA,
  avanzarObjetos,
  envejecerEfectos,
  factorDeEfectos,
  fichaDe,
  liderDe,
  OBJETOS,
  pesosDePlaza,
  TIPOS,
  usarObjeto,
  VELOCIDAD_MINIMA,
} from '../objetos.ts';
import { avanzar, PASO } from '../carrera.ts';
import { longitudDeVuelta } from '../circuito.ts';
import { crearRng } from '../rng.ts';
import { CIRCUITOS } from '../datos/circuitos.ts';
import type { EstadoRegata, TipoObjeto } from '../tipos.ts';
import { circuito, mando, montar } from './ayudas.ts';

test('[H-102] los huevos salen del circuito, no de una lista escrita a mano', () => {
  for (const c of CIRCUITOS) {
    const huevos = huevosDe(c);
    const vuelta = longitudDeVuelta(c);
    assert.ok(huevos.length > 10, `${c.id} solo tiene ${huevos.length} huevos`);
    for (const h of huevos) {
      assert.ok(h.metros >= 0 && h.metros < vuelta, `${c.id}: huevo fuera de la vuelta`);
      assert.equal(h.reaparece, 0);
    }
  }
});

test('[H-102] hay huevo en todos los carriles del tramo', () => {
  // Con cinco por fila, una barca en el carril exterior de un tramo de seis
  // carriles no encontraba un huevo en toda la regata.
  for (const c of CIRCUITOS) {
    const huevos = huevosDe(c);
    const carriles = new Set(huevos.map((h) => h.carril));
    const maximo = Math.max(...c.tramos.map((t) => Math.max(2, Math.floor(t.anchura / 4.5))));
    assert.ok(carriles.size >= Math.min(6, maximo), `${c.id}: solo hay huevos en ${carriles.size} carriles de ${maximo}`);
  }
});

test('[H-105] un huevo roto no vuelve antes de tiempo', () => {
  // Regresión de DH2: reapareciendo al instante, una barca parada encima de un
  // huevo sacaba 19 objetos en 10 s.
  const roto = [{ metros: 100, carril: 0, reaparece: REAPARICION }];
  assert.equal(huevoPisado(roto, circuito('ria'), 90, 110, 0), -1, 'un huevo roto no se puede volver a romper');
  const casi = envejecerHuevos(roto, REAPARICION - 0.5);
  assert.equal(huevoPisado(casi, circuito('ria'), 90, 110, 0), -1);
  const vuelto = envejecerHuevos(roto, REAPARICION);
  assert.equal(huevoPisado(vuelto, circuito('ria'), 90, 110, 0), 0);
});

test('[H-101] romper un huevo es gratis y repetible, vayas donde vayas', () => {
  // Es la regla que define el sistema: los huevos no se compran. Y se mide
  // sobre varias semillas a propósito: con los 8 s de reaparición del borrador
  // esto pasaba con unas semillas y con otras el jugador rompía UN huevo en
  // toda la regata, según le tocase ir delante o detrás de alguien (`DH5`).
  // Tres vueltas fijas: la ría pasó a correrse a dos (`K-102`) y lo que se
  // vigila es el huevo, no la longitud de la regata.
  const rotosPorSemilla: number[] = [];
  for (const semilla of [1, 2, 3, 4, 5, 6]) {
    const { est, rng, circuito: c } = montar('ria', { barca: 'trainera', tripulacion: ['timonel'] }, { semilla, vueltas: 3 });
    let e = est;
    while (!e.terminada && e.reloj < 1800) {
      const jugador = e.naves.find((n) => n.jugador)!;
      // Suelta lo que lleve para tener las manos libres.
      e = avanzar(e, { mando: mando({ gas: 0.95, usar: jugador.objeto !== null }), ultimaVuelta: jugador.vuelta >= c.vueltas - 1 }, rng);
    }
    rotosPorSemilla.push(e.naves.find((n) => n.jugador)!.huevosRotos);
  }
  // [HG3] Este piloto **no toca el timón en toda la regata**: si le toca ir
  // pegado a otra barca en su mismo carril, se come sus sobras y no se aparta.
  // Pasa en una semilla de cada veinte con cualquier paso de filas (SPEC-002,
  // «Lo que la medición cambió»), así que el mínimo por semilla medía la
  // suerte. Lo que este test vigila es la ruina de `DH5` —1 y 3 huevos en la
  // MITAD de las semillas—: la mediana y que no caiga más de una.
  const orden = rotosPorSemilla.slice().sort((a, b) => a - b);
  const mediana = orden[Math.floor(orden.length / 2)]!;
  assert.ok(mediana >= 12, `mediana de ${mediana} huevos: ${rotosPorSemilla.join(' ')}`);
  assert.ok(rotosPorSemilla.filter((r) => r < 6).length <= 1, `más de una semilla por debajo de 6: ${rotosPorSemilla.join(' ')}`);
});

test('[H-103] con un objeto en la mano no se coge otro, y el huevo sigue entero', () => {
  const c = circuito('ria');
  const huevos = huevosDe(c);
  const { est, rng } = montar('ria', { barca: 'trainera', tripulacion: [] }, { semilla: 6 });
  const jugador = est.naves.find((n) => n.jugador)!;
  const huevo = huevos.find((h) => h.carril === jugador.carril)!;
  const antes = huevo.metros - 1;
  const conObjeto: EstadoRegata = {
    ...est,
    huevos,
    naves: est.naves.map((n) => (n.jugador ? { ...n, metros: antes, velocidad: 5, objeto: 'ancla' as TipoObjeto } : { ...n, metros: 900 })),
  };
  const despues = avanzar(conObjeto, { mando: mando({ gas: 1 }), ultimaVuelta: false }, rng);
  assert.equal(despues.naves.find((n) => n.jugador)!.objeto, 'ancla', 'le han cambiado el objeto');
  assert.ok(despues.huevos.every((h) => h.reaparece === 0), 'ha roto un huevo sin poder cogerlo');
});

test('[H-104] la ruleta pondera por posición: el kraken es del que va último', () => {
  // Regresión de DH1: con ruleta uniforme, el líder sacaba kraken —que va
  // contra el líder— en el 12,4 % de las tiradas.
  const cuenta = (plaza: number, tipo: TipoObjeto): number => {
    const rng = crearRng(1234 + plaza);
    let n = 0;
    for (let i = 0; i < 20000; i++) if (tirarRuleta(plaza, 8, rng) === tipo) n++;
    return n;
  };
  const primera = cuenta(1, 'kraken');
  const ultima = cuenta(8, 'kraken');
  assert.ok(ultima > primera * 12, `×${(ultima / Math.max(1, primera)).toFixed(1)}`);
});

test('[H-104] todos los objetos tienen peso positivo en todas las plazas', () => {
  for (let plaza = 1; plaza <= 8; plaza++) {
    const pesos = pesosDePlaza(plaza, 8);
    assert.equal(pesos.length, TIPOS.length);
    for (let i = 0; i < pesos.length; i++) {
      assert.ok(pesos[i]! > 0, `${TIPOS[i]} no sale nunca en la plaza ${plaza}`);
    }
  }
});

test('[H-106] la misma semilla da la misma secuencia de objetos', () => {
  const tirada = (): string => {
    const rng = crearRng(777);
    return Array.from({ length: 40 }, () => tirarRuleta(4, 8, rng)).join(',');
  };
  assert.equal(tirada(), tirada());
});

test('[H-2xx] la ayuda describe exactamente los ocho objetos de la ruleta', () => {
  assert.equal(OBJETOS.length, 8);
  assert.deepEqual(new Set(OBJETOS.map((o) => o.tipo)), new Set(TIPOS));
  for (const t of TIPOS) assert.ok(fichaDe(t).descripcion.length > 10);
});

test('[H-201] el turbo empuja y no cansa a nadie', () => {
  const { est, rng } = montar('ria', { barca: 'chalana', tripulacion: [] }, { semilla: 4 });
  const jugador = est.naves.find((n) => n.jugador)!;
  const arranque: EstadoRegata = {
    ...est,
    naves: est.naves.map((n) => (n.jugador ? { ...n, objeto: 'turbo' as TipoObjeto, energia: 60, velocidad: 3 } : { ...n, metros: 900 })),
  };
  let e = avanzar(arranque, { mando: mando({ gas: 1, usar: true }), ultimaVuelta: false }, rng);
  const energiaAlEmpezar = e.naves[jugador.indice]!.energia;
  for (let i = 0; i < 20; i++) e = avanzar(e, { mando: mando({ gas: 1 }), ultimaVuelta: false }, rng);
  const nave = e.naves[jugador.indice]!;
  assert.equal(nave.energia, energiaAlEmpezar, 'el turbo ha gastado energía');
  assert.ok(nave.efectos.some((f) => f.tipo === 'turbo'));
  assert.ok(factorDeEfectos(nave.efectos) > 1.5);
});

test('[H-202] el ancla no se come a quien la suelta', () => {
  const { est } = montar('ria');
  const quien = est.naves[0]!.indice;
  const lanzamiento = usarObjeto('ancla', quien, est);
  assert.equal(lanzamiento.objetos.length, 1);
  const conAncla: EstadoRegata = { ...est, objetos: lanzamiento.objetos.map((o) => ({ ...o, id: 1 })) };
  const paso = avanzarObjetos(conAncla, PASO);
  assert.equal(paso.impactos.size, 0, 'se ha comido su propia ancla');
  assert.equal(paso.objetos.length, 1, 'el ancla tiene que quedarse en el agua');
});

test('[H-203] la ola se disuelve a los 220 m y no persigue a nadie', () => {
  // Regresión de DH3: un proyectil siguió a una rival 1 400 m, dos vueltas.
  const { est } = montar('ria');
  const solo: EstadoRegata = { ...est, naves: [est.naves[0]!], objetos: [] };
  const lanzamiento = usarObjeto('ola', solo.naves[0]!.indice, solo);
  assert.equal(lanzamiento.objetos[0]!.alcance, ALCANCE_OLA);
  let e: EstadoRegata = { ...solo, objetos: lanzamiento.objetos.map((o) => ({ ...o, id: 1 })) };
  let segundos = 0;
  while (e.objetos.length > 0 && segundos < 120) {
    e = { ...e, objetos: avanzarObjetos(e, PASO).objetos };
    segundos += PASO;
  }
  assert.ok(segundos <= 25, `tardó ${segundos.toFixed(1)} s en disolverse`);
  assert.equal(e.objetos.length, 0);
});

test('[H-204] el kraken va a por el primero, y solo a por él', () => {
  const { est } = montar('ria');
  const ordenado = est.naves.map((n, i) => ({ ...n, metros: 100 + i * 30 }));
  const e: EstadoRegata = { ...est, naves: ordenado };
  const lider = liderDe(e)!;
  assert.equal(lider, ordenado[ordenado.length - 1]!.indice);
  const ultimo = ordenado[0]!.indice;
  const lanzamiento = usarObjeto('kraken', ultimo, e);
  assert.equal(lanzamiento.objetos.length, 1);
  assert.equal(lanzamiento.objetos[0]!.tipo, 'kraken');
});

test('[H-204] el líder no puede krakenearse a sí mismo', () => {
  const { est } = montar('ria');
  const e: EstadoRegata = { ...est, naves: est.naves.map((n, i) => ({ ...n, metros: 100 + i * 30 })) };
  const lider = liderDe(e)!;
  assert.deepEqual(usarObjeto('kraken', lider, e), { objetos: [], efectos: [], golpes: [] });
});

test('[H-205] el remolino dura dos segundos exactos, haya quien haya cerca', () => {
  // Regresión de DH4: el efecto se renovaba mientras hubiera barcas cerca y una
  // barca se quedó girando 41 s.
  const { est } = montar('ria');
  const juntas: EstadoRegata = { ...est, naves: est.naves.map((n) => ({ ...n, metros: 100 })) };
  const lanzamiento = usarObjeto('remolino', juntas.naves[0]!.indice, juntas);
  assert.ok(lanzamiento.efectos.length >= 5, 'no ha mareado a los que tenía al lado');
  for (const { efecto } of lanzamiento.efectos) assert.equal(efecto.restante, 2);
  assert.equal(lanzamiento.objetos.length, 0, 'el remolino no deja nada en el agua que pueda renovarse');
});

test('[H-206] la niebla ciega a los de delante y a nadie más', () => {
  const { est } = montar('ria');
  const e: EstadoRegata = { ...est, naves: est.naves.map((n, i) => ({ ...n, metros: 100 + i * 30 })) };
  const enMedio = e.naves[3]!.indice;
  const lanzamiento = usarObjeto('niebla', enMedio, e);
  const cegados = lanzamiento.efectos.map((f) => f.indice);
  for (const i of cegados) assert.ok(e.naves[i]!.metros > e.naves[enMedio]!.metros);
  assert.equal(cegados.length, e.naves.filter((n) => n.metros > e.naves[enMedio]!.metros).length);
});

test('[H-207] la burbuja para el primer golpe y se gasta', () => {
  const { est } = montar('ria');
  const conBurbuja: EstadoRegata = {
    ...est,
    naves: est.naves.map((n, i) => ({
      ...n,
      metros: 100,
      efectos: i === 1 ? [{ tipo: 'burbuja' as const, restante: 6, factor: 1 }] : [],
    })),
    objetos: [{ id: 1, tipo: 'ola', duenyo: 0, metros: 100, carril: est.naves[1]!.carril, restante: 10, alcance: 100 }],
  };
  const paso = avanzarObjetos(conBurbuja, PASO);
  assert.ok(paso.burbujasGastadas.includes(1), 'la burbuja no ha parado el golpe');
  assert.equal(paso.impactos.size, 0, 'ha recibido el golpe igualmente');
});

test('[H-208] las tres olas son exactamente tres', () => {
  const { est } = montar('ria');
  const lanzamiento = usarObjeto('tresOlas', est.naves[0]!.indice, est);
  assert.equal(lanzamiento.objetos.length, 3);
  for (const o of lanzamiento.objetos) assert.equal(o.tipo, 'ola');
  const metros = lanzamiento.objetos.map((o) => o.metros);
  assert.equal(new Set(metros).size, 3, 'salen las tres del mismo sitio');
});

test('[H-210] sin colisiones no queda nada: ni objetos ni efectos', () => {
  const { est } = montar('ria');
  // Una sola barca, todo lanzado a la vez.
  let e: EstadoRegata = { ...est, naves: [{ ...est.naves[0]!, indice: 0 }], objetos: [] };
  let id = 1;
  for (const tipo of TIPOS) {
    const l = usarObjeto(tipo, 0, e);
    e = {
      ...e,
      objetos: [...e.objetos, ...l.objetos.map((o) => ({ ...o, id: id++ }))],
      naves: e.naves.map((n) => ({ ...n, efectos: [...n.efectos, ...l.efectos.filter((f) => f.indice === n.indice).map((f) => f.efecto)] })),
    };
  }
  for (let t = 0; t < Math.round(30 / PASO); t++) {
    e = { ...e, objetos: avanzarObjetos(e, PASO).objetos, naves: e.naves.map((n) => ({ ...n, efectos: envejecerEfectos(n.efectos, PASO) })) };
  }
  assert.equal(e.objetos.length, 0, 'queda algo en el agua a los 30 s');
  assert.equal(e.naves[0]!.efectos.length, 0, 'queda algún efecto vivo a los 30 s');
});

test('[H-211] ningún objeto deja a una barca por debajo de 0,8 m/s', () => {
  const { est, rng } = montar('ria');
  // Todas encima, y el objeto más duro de cada tipo cayendo a la vez.
  let e: EstadoRegata = {
    ...est,
    naves: est.naves.map((n) => ({ ...n, metros: 100, velocidad: 1, carril: 0 })),
    objetos: TIPOS.filter((t) => t !== 'turbo' && t !== 'burbuja').map((tipo, i) => ({
      id: i + 1,
      tipo,
      duenyo: 0,
      metros: 100,
      carril: 0,
      restante: 20,
      alcance: 200,
    })),
  };
  // Con el gas a fondo, lo único que puede bajar la velocidad son los golpes:
  // con el gas a cero la barca se pararía sola y el test no diría nada.
  for (let t = 0; t < 40; t++) {
    e = avanzar(e, { mando: mando({ gas: 1 }), ultimaVuelta: false }, rng);
    for (const n of e.naves) assert.ok(n.velocidad >= VELOCIDAD_MINIMA - 1e-9, `${n.nombre} va a ${n.velocidad.toFixed(3)} m/s`);
  }
});
