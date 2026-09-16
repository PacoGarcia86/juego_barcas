// [A-1xx] [A-2xx] [A-3xx] El catálogo, la tripulación y los doblones.

import test from 'node:test';
import assert from 'node:assert/strict';
import { barcaEfectiva, domina, velocidadDeCascoDe } from '../barcas.ts';
import { aporteDe, embarcar, plazasLibres } from '../tripulacion.ts';
import {
  bajarATierra,
  comprarBarca,
  comprarTripulante,
  cuentaEnTierra,
  enVenta,
  equiparBarca,
  partidaNueva,
  plazasLibresDe,
  subirABordo,
  venderTripulante,
} from '../astillero.ts';
import { doblonesDe, POR_HUEVO, premio, PREMIO_REGATA_LIMPIA } from '../economia.ts';
import { BARCAS, barcaPorId } from '../datos/barcas.ts';
import { TRIPULANTES } from '../datos/tripulantes.ts';
import { MASA_PATRON } from '../fisica.ts';
import { partidaCon } from './ayudas.ts';
import type { Oficio } from '../tipos.ts';

test('[A-101] el catálogo tiene seis barcas y todas traen sus campos', () => {
  assert.equal(BARCAS.length, 6);
  for (const b of BARCAS) {
    for (const campo of ['eslora', 'manga', 'empuje', 'maniobra', 'estabilidad', 'plazas', 'masa', 'coefOla'] as const) {
      assert.ok(typeof b[campo] === 'number' && b[campo] > 0, `${b.id} no declara ${campo}`);
    }
    assert.ok(b.descripcion.length > 20, `${b.id} sin descripción`);
    assert.ok(['desplazamiento', 'planeador'].includes(b.casco));
  }
});

test('[A-102] ninguna barca domina a otra en las cinco características', () => {
  // Es el frente de Pareto: lo que hace que comprar sea decidir en vez de
  // esperar a tener el dinero. La auditoría encontró dos barcas dominadas.
  for (const a of BARCAS) {
    for (const b of BARCAS) {
      if (a.id === b.id) continue;
      assert.ok(!domina(a, b), `${a.id} domina a ${b.id}: ${b.id} no tiene razón de existir`);
    }
  }
});

test('[A-103] la barca inicial es gratis y es la más maniobrable', () => {
  const chalana = barcaPorId('chalana')!;
  assert.equal(chalana.precio, 0);
  assert.equal(chalana.maniobra, Math.max(...BARCAS.map((b) => b.maniobra)));
  const nueva = partidaNueva();
  assert.deepEqual(nueva.barcasCompradas, ['chalana']);
  assert.equal(nueva.barcaEquipada, 'chalana');
  assert.deepEqual(nueva.embarcados, []);
});

test('[A-104] el precio no es un orden total de las características', () => {
  // La neumática (planeadora y ágil, pero frágil) cuesta menos que la traiñera.
  assert.ok(barcaPorId('neumatica')!.precio < barcaPorId('trainera')!.precio);
  assert.ok(barcaPorId('lancha')!.precio > barcaPorId('trainera')!.precio);
});

test('[A-105] la barca efectiva es lo único que ve la física', () => {
  const chalana = barcaPorId('chalana')!;
  const efectiva = barcaEfectiva(chalana, ['remero']);
  for (const campo of ['eslora', 'empujeMax', 'empujeCrucero', 'maniobra', 'estabilidad', 'masa', 'casco', 'coefOla'] as const) {
    assert.ok(efectiva[campo] !== undefined, `falta ${campo}`);
  }
  assert.ok(!('tripulacion' in efectiva), 'la barca efectiva no puede llevar la tripulación dentro');
  assert.ok(velocidadDeCascoDe(chalana) > 0);
});

test('[A-201] hay cinco oficios y cada uno declara qué aporta', () => {
  assert.equal(TRIPULANTES.length, 5);
  for (const t of TRIPULANTES) {
    assert.ok(t.peso > 0, `${t.oficio} no pesa`);
    assert.ok(t.precio > 0);
    assert.ok(t.descripcion.length > 20);
  }
});

test('[A-202] todo tripulante pesa, y el peso llega a la física', () => {
  // Cuando no pesaban y el efecto era un multiplicador suelto, «cinco remeros»
  // ganó 20 de 20 regatas del arnés.
  const trainera = barcaPorId('trainera')!;
  const vacia = barcaEfectiva(trainera, []);
  const llena = barcaEfectiva(trainera, Array(5).fill('remero') as Oficio[]);
  assert.equal(vacia.masa, trainera.masa + MASA_PATRON);
  assert.equal(llena.masa - vacia.masa, 5 * 82);
  assert.equal(aporteDe(['remero', 'remero']).peso, 164);
});

test('[A-203] las plazas mandan: no se embarca al que no cabe', () => {
  const patin = barcaPorId('patin')!;
  assert.equal(patin.plazas, 2);
  const dos: Oficio[] = ['remero', 'timonel'];
  assert.equal(plazasLibres(patin, dos), 0);
  const { embarcados, motivo } = embarcar(patin, dos, 'vigia');
  assert.equal(motivo, 'plazas');
  assert.deepEqual(embarcados, dos, 'ha embarcado igualmente');
});

test('[A-205] el vigía cambia el reparto, no el conjunto de objetos posibles', () => {
  const conVigia = barcaEfectiva(barcaPorId('trainera')!, ['vigia']);
  assert.equal(conVigia.vigia, true);
  assert.equal(barcaEfectiva(barcaPorId('trainera')!, ['remero']).vigia, false);
});

test('[A-206] el peso embarcado empeora la maniobra', () => {
  // Sin esto, las barcas de muchas plazas ganaban el 79 % de las regatas: el
  // frente de Pareto era correcto y el catálogo estaba roto igualmente.
  const galeota = barcaPorId('galeota')!;
  const vacia = barcaEfectiva(galeota, []);
  const llena = barcaEfectiva(galeota, Array(6).fill('remero') as Oficio[]);
  assert.ok(llena.maniobra < vacia.maniobra, `vacía ${vacia.maniobra.toFixed(1)}, llena ${llena.maniobra.toFixed(1)}`);
  // Y un timonel compensa parte, pero no toda.
  const conTimonel = barcaEfectiva(galeota, ['timonel']);
  assert.ok(conTimonel.maniobra > barcaEfectiva(galeota, ['remero']).maniobra);
});

test('[A-2xx] la maniobra y la estabilidad se topan en 99', () => {
  const patin = barcaPorId('patin')!;
  const e = barcaEfectiva(patin, ['timonel', 'timonel']);
  assert.ok(e.estabilidad <= 99);
  assert.ok(e.maniobra <= 99);
});

test('[A-301] el premio baja con la posición y correr siempre paga', () => {
  assert.equal(premio(1), 320);
  assert.equal(premio(8), 45);
  for (let p = 2; p <= 8; p++) assert.ok(premio(p) < premio(p - 1), `la plaza ${p} paga más que la ${p - 1}`);
  assert.ok(premio(20) > 0, 'correr siempre paga algo');
});

test('[A-301] la segunda barca cae en menos de doce regatas', () => {
  // Con el premio plano de 100 doblones de la auditoría hacían falta catorce
  // ganando el cien por cien: el astillero no se llegaba a ver.
  const masBarata = enVenta(partidaNueva())[0]!;
  // Un jugador que gana la mitad y queda tercero la otra mitad, con 12 huevos.
  const porRegata = (doblonesDe({ posicion: 1, limpia: false, huevos: 12 }) + doblonesDe({ posicion: 3, limpia: false, huevos: 12 })) / 2;
  assert.ok(masBarata.precio / porRegata < 12, `hacen falta ${(masBarata.precio / porRegata).toFixed(1)} regatas`);
});

test('[A-302] la regata limpia paga, y es el objetivo del juego', () => {
  const sucia = doblonesDe({ posicion: 3, limpia: false, huevos: 0 });
  const limpia = doblonesDe({ posicion: 3, limpia: true, huevos: 0 });
  assert.equal(limpia - sucia, PREMIO_REGATA_LIMPIA);
  // Una regata limpia en tercera plaza paga más que ganar sucio: defender la
  // posición tiene que competir de verdad con ir a por la victoria.
  assert.ok(limpia > doblonesDe({ posicion: 1, limpia: false, huevos: 0 }) - 50);
});

test('[A-303] cada huevo roto paga, y los huevos no se compran', () => {
  assert.equal(doblonesDe({ posicion: 8, limpia: false, huevos: 10 }) - doblonesDe({ posicion: 8, limpia: false, huevos: 0 }), 10 * POR_HUEVO);
});

test('[A-304] no se compra sin fondos, y el estado no se toca', () => {
  // Sin esta comprobación, dos compras dejaron el saldo en −900 doblones.
  const pobre = partidaCon(100);
  const { partida, motivo } = comprarBarca(pobre, 'galeota');
  assert.equal(motivo, 'fondos');
  assert.equal(partida.doblones, 100);
  assert.deepEqual(partida.barcasCompradas, ['chalana']);
  const t = comprarTripulante(pobre, 'contramaestre');
  assert.equal(t.motivo, 'fondos');
  assert.equal(t.partida.doblones, 100);
});

test('[A-304] comprando con fondos se descuenta exactamente el precio', () => {
  const rico = partidaCon(9000);
  const { partida, motivo } = comprarBarca(rico, 'trainera');
  assert.equal(motivo, null);
  assert.equal(partida.doblones, 9000 - barcaPorId('trainera')!.precio);
  assert.ok(partida.barcasCompradas.includes('trainera'));
  assert.equal(comprarBarca(partida, 'trainera').motivo, 'repetida');
  assert.equal(comprarBarca(partida, 'submarino').motivo, 'desconocida');
});

test('[A-2xx] comprar un tripulante no lo embarca; embarcarlo es otro paso', () => {
  let p = partidaCon(3000);
  p = comprarTripulante(p, 'remero').partida;
  assert.deepEqual(p.embarcados, []);
  assert.equal(cuentaEnTierra(p, 'remero'), 1);
  p = subirABordo(p, 'remero').partida;
  assert.deepEqual(p.embarcados, ['remero']);
  assert.equal(cuentaEnTierra(p, 'remero'), 0);
  // La chalana tiene dos plazas: la tercera no cabe.
  p = comprarTripulante(comprarTripulante(p, 'timonel').partida, 'vigia').partida;
  p = subirABordo(p, 'timonel').partida;
  assert.equal(plazasLibresDe(p), 0);
  assert.equal(subirABordo(p, 'vigia').motivo, 'plazas');
  p = bajarATierra(p, 'timonel').partida;
  assert.equal(plazasLibresDe(p), 1);
});

test('[AQ2] un tripulante se vende al 60 % y baja a tierra solo', () => {
  let p = comprarTripulante(partidaCon(3000), 'remero').partida;
  p = subirABordo(p, 'remero').partida;
  const antes = p.doblones;
  const { partida, motivo } = venderTripulante(p, 'remero');
  assert.equal(motivo, null);
  assert.equal(partida.doblones, antes + Math.round(450 * 0.6));
  assert.deepEqual(partida.embarcados, []);
  assert.deepEqual(partida.tripulantes, []);
  assert.equal(venderTripulante(partida, 'remero').motivo, 'no-la-tienes');
});

test('[A-203] cambiar a una barca con menos plazas recorta la dotación', () => {
  let p = partidaCon(9000);
  p = comprarBarca(p, 'galeota').partida;
  p = equiparBarca(p, 'galeota').partida;
  for (let i = 0; i < 4; i++) {
    p = comprarTripulante(p, 'remero').partida;
    p = subirABordo(p, 'remero').partida;
  }
  assert.equal(p.embarcados.length, 4);
  p = equiparBarca(p, 'chalana').partida;
  assert.equal(p.embarcados.length, 2, 'la chalana solo tiene dos plazas');
  assert.equal(p.tripulantes.length, 4, 'los tripulantes siguen comprados, solo bajan a tierra');
});

test('[A-3xx] no se equipa una barca que no se tiene', () => {
  assert.equal(equiparBarca(partidaNueva(), 'galeota').motivo, 'no-la-tienes');
});
