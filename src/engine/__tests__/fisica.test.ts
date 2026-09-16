// [B-2xx] La física del casco. Un test por requisito, nombrado con su ID.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aceleracion,
  empujeDisponible,
  energiaTras,
  factorEstela,
  factorPlaneo,
  resistenciaDeOla,
  resistenciaDeOleaje,
  resistenciaDeRozamiento,
  resistenciaTotal,
  velocidadDeCasco,
  velocidadDeEquilibrio,
  velocidadDeViraje,
  type Entorno,
} from '../fisica.ts';
import { barcaEfectiva } from '../barcas.ts';
import { barcaPorId, BARCAS } from '../datos/barcas.ts';
import type { BarcaEfectiva } from '../tipos.ts';

const LLANO: Entorno = { corriente: 0, oleaje: 0.1, estela: 1 };

function barca(id: string, tripulacion: Parameters<typeof barcaEfectiva>[1] = []): BarcaEfectiva {
  const b = barcaPorId(id);
  if (b === undefined) throw new Error(id);
  return barcaEfectiva(b, tripulacion);
}

test('[B-202] la velocidad de casco va con la raíz de la eslora', () => {
  assert.ok(Math.abs(velocidadDeCasco(6) - 1.25 * Math.sqrt(6)) < 1e-9);
  // Cuadruplicar la eslora solo duplica la velocidad de casco: es exactamente
  // por eso que una barca larga no es «el doble de buena».
  assert.ok(Math.abs(velocidadDeCasco(24) / velocidadDeCasco(6) - 2) < 1e-9);
});

test('[B-202] la barrera de ola se dispara al llegar a la velocidad de casco', () => {
  // Regresión de DB1: con la resistencia de ola puesta como un término lineal
  // más, la eslora salía gratis y la barca de 12 m ganaba 20 de 20 regatas.
  const vc = velocidadDeCasco(9);
  const mitad = resistenciaDeOla(1000, 9, vc * 0.5, 0.004);
  const entera = resistenciaDeOla(1000, 9, vc, 0.004);
  assert.ok(entera / mitad >= 25, `la barrera solo se multiplica por ${(entera / mitad).toFixed(1)}`);
});

test('[B-202] la resistencia de ola crece con la velocidad, sin saltos', () => {
  let anterior = 0;
  for (let v = 0.05; v <= 8; v += 0.05) {
    const r = resistenciaDeOla(900, 9, v, 0.004);
    assert.ok(r >= anterior, `baja en v=${v}`);
    anterior = r;
  }
});

test('[B-203] el planeo es un cambio de régimen, no un coeficiente', () => {
  // Regresión de DB2: modelado como «un 30 % menos siempre», el casco
  // planeador era más lento que el de desplazamiento en los cuatro circuitos.
  for (const r of [0.5, 1, 1.5, 3]) {
    assert.equal(factorPlaneo('desplazamiento', r), 1, 'un casco de desplazamiento no plana nunca');
  }
  assert.equal(factorPlaneo('planeador', 1.0), 1, 'por debajo del umbral paga la barrera entera');
  assert.ok(factorPlaneo('planeador', 1.6) <= 0.31);
  assert.equal(factorPlaneo('planeador', 2.5), factorPlaneo('planeador', 1.6), 'por encima de 1,6 se queda quieto');
});

test('[B-203] el factor de planeo no da saltos', () => {
  let anterior = factorPlaneo('planeador', 0);
  for (let r = 0; r <= 2.5; r += 0.01) {
    const f = factorPlaneo('planeador', r);
    assert.ok(Math.abs(f - anterior) < 0.05, `salto de ${Math.abs(f - anterior).toFixed(3)} en ratio ${r.toFixed(2)}`);
    anterior = f;
  }
});

test('[B-205] la resistencia de rozamiento va con el cuadrado de la velocidad', () => {
  const uno = resistenciaDeRozamiento(900, 9, 3);
  const dos = resistenciaDeRozamiento(900, 9, 6);
  assert.ok(Math.abs(dos / uno - 4) < 0.01, `sale ×${(dos / uno).toFixed(3)}`);
});

test('[B-206] el desplazamiento embarcado se paga en las dos resistencias', () => {
  const vacia = barca('trainera');
  const cargada = barca('trainera', ['remero', 'remero']);
  const sinTripulacion = resistenciaTotal(vacia, 3.5, LLANO);
  const conTripulacion = resistenciaTotal({ ...cargada, empujeMax: vacia.empujeMax }, 3.5, LLANO);
  assert.ok(conTripulacion > sinTripulacion * 1.08, `solo sube un ${(100 * (conTripulacion / sinTripulacion - 1)).toFixed(1)} %`);
});

test('[B-207] con mar de fondo, la barca estable paga mucho menos', () => {
  const inestable = resistenciaDeOleaje(1000, 1, 40);
  const estable = resistenciaDeOleaje(1000, 1, 95);
  assert.ok(inestable > estable * 2, `solo paga ×${(inestable / estable).toFixed(1)}`);
});

test('[B-207] y la barca pesada y estable sufre menos que la ligera e inestable', () => {
  // La primera versión escalaba solo con la masa y la `galeota` —la barca de
  // mar del catálogo— pagaba más oleaje que la `chalana`, que es la contraria.
  const galeota = barca('galeota', ['timonel']);
  const chalana = barca('chalana', ['timonel']);
  const conGaleota = resistenciaDeOleaje(galeota.masa, 1, galeota.estabilidad);
  const conChalana = resistenciaDeOleaje(chalana.masa, 1, chalana.estabilidad);
  assert.ok(conGaleota < conChalana, `galeota ${conGaleota.toFixed(0)} N contra chalana ${conChalana.toFixed(0)} N`);
});

test('[B-201] la estela ahorra al menos un 20 % a ocho metros', () => {
  assert.ok(factorEstela(8, 0) <= 0.8, `solo ahorra un ${(100 * (1 - factorEstela(8, 0))).toFixed(0)} %`);
  assert.equal(factorEstela(30, 0), 1, 'a treinta metros no hay estela');
  assert.equal(factorEstela(1, 0), 1, 'pegado a la popa es agua revuelta, no estela');
});

test('[B-201] la estela es continua: ningún salto de más de 0,02 entre metros contiguos', () => {
  // Regresión de DB3: siendo binaria, las ocho barcas llegaban a meta en 2,1 s
  // en fila india. No había regata, había un tren.
  let anterior = factorEstela(0, 0);
  for (let d = 0; d <= 40; d += 0.1) {
    const f = factorEstela(d, 0);
    assert.ok(Math.abs(f - anterior) <= 0.02, `salto de ${Math.abs(f - anterior).toFixed(3)} a ${d.toFixed(1)} m`);
    anterior = f;
  }
});

test('[B-201] salirse de la estela por el lado la deshace', () => {
  assert.ok(factorEstela(8, 4.5) > factorEstela(8, 0));
  assert.ok(factorEstela(8, 9) >= 0.99, 'a dos carriles ya no queda estela');
});

test('[B-204] la bisección aguanta la corriente en contra', () => {
  // Regresión de DB4: Newton-Raphson convergía al suelo del método (0,5 m/s) y
  // la IA creía que no podía avanzar.
  const b = barca('trainera');
  const v = velocidadDeEquilibrio(900, b, { corriente: -1.2, oleaje: 0.1, estela: 1 });
  assert.ok(v > 2, `devuelve ${v.toFixed(2)} m/s`);
  const residuo = resistenciaTotal(b, v + 1.2, { corriente: -1.2, oleaje: 0.1, estela: 1 }) - 900;
  assert.ok(Math.abs(residuo) < 1, `residuo de ${residuo.toFixed(3)} N`);
});

test('[B-204] la corriente mueve la velocidad sobre el fondo, no la que cuesta', () => {
  const b = barca('trainera');
  const aFavor = velocidadDeEquilibrio(900, b, { corriente: 1.1, oleaje: 0.1, estela: 1 });
  const quieta = velocidadDeEquilibrio(900, b, { corriente: 0, oleaje: 0.1, estela: 1 });
  const enContra = velocidadDeEquilibrio(900, b, { corriente: -1.2, oleaje: 0.1, estela: 1 });
  assert.ok(Math.abs(aFavor - quieta - 1.1) < 0.05, 'a favor se suma entera');
  assert.ok(Math.abs(quieta - enContra - 1.2) < 0.05, 'en contra se resta entera');
});

test('[B-204] con la corriente en contra bastante fuerte no se gana agua', () => {
  const b = barca('chalana');
  assert.equal(velocidadDeEquilibrio(10, b, { corriente: -3, oleaje: 0, estela: 1 }), 0);
});

test('[B-204] con varias raíces se devuelve la PRIMERA, que es la que se alcanza', () => {
  // La especificación daba por hecho que había una sola raíz positiva. No la
  // hay: un casco planeador tiene joroba y su curva BAJA al subirse al agua.
  // Con un empuje por debajo de la joroba existen tres raíces, y la que alcanza
  // una barca que arranca parada es la primera: se queda atascada debajo.
  const b = barca('lancha');
  // La joroba es el máximo LOCAL, no el máximo del intervalo: por encima del
  // planeo la resistencia vuelve a subir y acaba pasándose de largo.
  const joroba = (() => {
    let anterior = 0;
    for (let v = 1; v < 9; v += 0.01) {
      const r = resistenciaTotal(b, v, LLANO);
      if (r < anterior) return anterior;
      anterior = r;
    }
    throw new Error('la lancha no tiene joroba');
  })();
  const flojo = joroba * 0.9;
  const v = velocidadDeEquilibrio(flojo, b, LLANO);
  assert.ok(v < 5, `con empuje por debajo de la joroba devuelve ${v.toFixed(2)} m/s: se ha saltado la primera raíz`);
  // Y es una raíz de verdad: la resistencia iguala al empuje.
  assert.ok(Math.abs(resistenciaTotal(b, v, LLANO) - flojo) < 2);
  // Hay más raíces por encima, y no son la respuesta.
  const altas = (() => {
    let cuantas = 0;
    let anterior = resistenciaTotal(b, v + 0.2, LLANO) - flojo;
    for (let w = v + 0.2; w < 12; w += 0.01) {
      const actual = resistenciaTotal(b, w, LLANO) - flojo;
      if (anterior < 0 !== actual < 0) cuantas++;
      anterior = actual;
    }
    return cuantas;
  })();
  assert.ok(altas >= 2, `solo hay ${altas} raíces por encima: la curva no tiene joroba`);
});

test('[B-209] el viraje depende del radio, de la maniobra y de la eslora', () => {
  const v = velocidadDeViraje(25, 70, 9);
  assert.ok(v > 2.5 && v < 3.5, `devuelve ${v.toFixed(2)} m/s`);
  assert.ok(velocidadDeViraje(25, 70, 14) < velocidadDeViraje(25, 70, 9), 'un casco largo vira peor');
  assert.ok(velocidadDeViraje(25, 90, 9) > velocidadDeViraje(25, 70, 9), 'más maniobra, más velocidad de paso');
  assert.ok(velocidadDeViraje(60, 70, 9) > velocidadDeViraje(25, 70, 9), 'una curva abierta se pasa más rápido');
});

test('[B-208] empujando al máximo la energía llega a 0 y no baja de ahí', () => {
  const b = barca('chalana');
  let energia = 100;
  let segundos = 0;
  while (energia > 0 && segundos < 600) {
    energia = energiaTras(energia, b.empujeMax, b.empujeCrucero, 0.05);
    segundos += 0.05;
  }
  assert.ok(segundos < 240, `tarda ${segundos.toFixed(0)} s en reventar`);
  assert.equal(energiaTras(0, b.empujeMax, b.empujeCrucero, 1), 0, 'no baja de cero');
});

test('[B-208] por debajo del crucero se recupera, y nunca pasa de 100', () => {
  const b = barca('chalana');
  assert.ok(energiaTras(50, b.empujeCrucero * 0.5, b.empujeCrucero, 1) > 50);
  assert.equal(energiaTras(100, 0, b.empujeCrucero, 10), 100);
});

test('[B-208] reventar cuesta caro, pero no deja a nadie parado', () => {
  const b = barca('chalana');
  assert.ok(Math.abs(empujeDisponible(b, 100) - b.empujeMax) < 1e-9);
  assert.ok(Math.abs(empujeDisponible(b, 0) - b.empujeMax * 0.55) < 1e-9);
});

test('[B-2xx] la resistencia de un casco de desplazamiento crece siempre', () => {
  for (const b of BARCAS.filter((x) => x.casco === 'desplazamiento')) {
    const e = barcaEfectiva(b, []);
    let anterior = -1;
    for (let v = 0.1; v <= 12; v += 0.1) {
      const r = resistenciaTotal(e, v, LLANO);
      assert.ok(r > anterior, `${b.id} baja en v=${v.toFixed(1)}`);
      anterior = r;
    }
  }
});

test('[B-2xx] la de un casco planeador NO: tiene joroba y luego baja', () => {
  // La especificación decía que la resistencia era estrictamente creciente en
  // todas las barcas. Es falso, y es la mecánica más interesante del catálogo:
  // un planeador sube hasta su joroba, se sube encima del agua y la
  // resistencia CAE. De ahí salen las tres raíces de `B-204`.
  for (const b of BARCAS.filter((x) => x.casco === 'planeador')) {
    const e = barcaEfectiva(b, []);
    let anterior = 0;
    let baja = false;
    for (let v = 0.1; v <= 9; v += 0.02) {
      const r = resistenciaTotal(e, v, LLANO);
      if (v > 1 && r < anterior) baja = true;
      anterior = r;
    }
    assert.ok(baja, `${b.id} no tiene joroba: no llega a planear nunca`);
  }
});

test('[A-101] las dos planeadoras del catálogo tienen empuje para pasar su joroba', () => {
  // Regresión de DA6. La joroba EXISTE (test de arriba) y el catálogo pone a
  // las dos planeadoras por encima de ella a propósito: una barca atascada
  // debajo tarda más de veinte segundos en cruzarla, porque justo ahí el empuje
  // y la resistencia casi se igualan y la aceleración se va a cero. Está
  // medido en SPEC-003 §«lo que la medición cambió».
  for (const id of ['neumatica', 'lancha']) {
    const b = barcaPorId(id)!;
    const sola = barcaEfectiva(b, []);
    const v = velocidadDeEquilibrio(sola.empujeMax, sola, LLANO);
    assert.ok(v > velocidadDeCasco(b.eslora) * 1.6, `${id} se queda en ${v.toFixed(2)} m/s: no plana`);
  }
});

test('[B-201] una estela sube a un casco planeador por encima de su joroba', () => {
  // Y esto sí sobrevivió: llevar una rueda baja la resistencia un 30 %, mucho
  // más que el margen con el que se cruza la joroba a pulso.
  const b = barcaEfectiva(barcaPorId('lancha')!, []);
  const sola = velocidadDeEquilibrio(b.empujeMax, b, LLANO);
  const aRueda = velocidadDeEquilibrio(b.empujeMax, b, { ...LLANO, estela: factorEstela(8, 0) });
  assert.ok(aRueda > sola + 0.4, `a rueda solo gana ${(aRueda - sola).toFixed(2)} m/s`);
});

test('[B-2xx] con empuje por encima de la resistencia se acelera, y por debajo se frena', () => {
  const b = barca('patin');
  assert.ok(aceleracion(b.empujeMax, b, 1, LLANO) > 0);
  assert.ok(aceleracion(0, b, 4, LLANO) < 0);
});
