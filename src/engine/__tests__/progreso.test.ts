// [P-1xx] Guardar. La única excepción declarada a «el motor no hace E/S», y lo
// es a medias: recibe el almacén por parámetro y por eso se prueba sin
// navegador.

import test from 'node:test';
import assert from 'node:assert/strict';
import { borrar, cargar, guardar, migrar, VERSION } from '../progreso.ts';
import { comprarBarca, comprarTripulante, partidaNueva, subirABordo } from '../astillero.ts';
import { almacenFalso, almacenQueLanza, partidaCon } from './ayudas.ts';

test('[P-101] la partida va y vuelve sin perder nada', () => {
  const almacen = almacenFalso();
  let p = partidaCon(5000);
  p = comprarBarca(p, 'trainera').partida;
  p = comprarTripulante(p, 'remero').partida;
  p = subirABordo(p, 'remero').partida;
  p = { ...p, regatasCorridas: 7, victorias: 2, regatasLimpias: 1 };
  assert.equal(guardar(p, almacen), true);
  assert.deepEqual(cargar(almacen), { ...p, version: VERSION });
});

test('[P-102] una partida con una barca que ya no existe sale jugable', () => {
  // Un cambio del catálogo dejó partidas con `barcaEquipada` inexistente y el
  // juego entraba en regata con `undefined`.
  const migrada = migrar({ doblones: 400, barcasCompradas: ['submarino'], barcaEquipada: 'submarino', tripulantes: [] });
  assert.ok(migrada !== null);
  assert.equal(migrada.barcaEquipada, 'chalana');
  assert.deepEqual(migrada.barcasCompradas, ['chalana']);
  assert.equal(migrada.doblones, 400);
  assert.equal(migrada.version, VERSION);
});

test('[P-102] la chalana no se puede perder: es la barca con la que se empieza', () => {
  const migrada = migrar({ barcasCompradas: ['trainera'], barcaEquipada: 'trainera' })!;
  assert.ok(migrada.barcasCompradas.includes('chalana'));
  assert.equal(migrada.barcaEquipada, 'trainera');
});

test('[P-102] lo embarcado no puede pasar de las plazas ni de lo comprado', () => {
  const migrada = migrar({
    barcasCompradas: ['chalana'],
    barcaEquipada: 'chalana',
    tripulantes: ['remero'],
    // Cuatro embarcados en una barca de dos plazas, y tres sin comprar.
    embarcados: ['remero', 'remero', 'timonel', 'vigia'],
  })!;
  assert.ok(migrada.embarcados.length <= 2);
  assert.deepEqual(migrada.embarcados, ['remero']);
});

test('[P-102] la basura no revienta la migración', () => {
  assert.equal(migrar(null), null);
  assert.equal(migrar('vaya'), null);
  assert.equal(migrar(42), null);
  const vacia = migrar({})!;
  assert.deepEqual(vacia, { ...partidaNueva(), version: VERSION });
  const rara = migrar({ doblones: 'mucho', tripulantes: ['grumete', 'remero'], regatasCorridas: NaN })!;
  assert.equal(rara.doblones, 0);
  assert.deepEqual(rara.tripulantes, ['remero']);
  assert.equal(rara.regatasCorridas, 0);
});

test('[P-104] el almacén puede lanzar, y el juego sigue', () => {
  // En navegación privada de iOS el mero acceso tira una excepción, y el juego
  // no arrancaba: pantalla en blanco.
  const almacen = almacenQueLanza();
  assert.equal(cargar(almacen), null);
  assert.equal(guardar(partidaNueva(), almacen), false);
  assert.doesNotThrow(() => borrar(almacen));
});

test('[P-104] un guardado corrupto se descarta en vez de reventar', () => {
  const almacen = almacenFalso();
  almacen.set('regata-2026', '{esto no es json');
  assert.equal(cargar(almacen), null);
});

test('[P-101] sin nada guardado no hay partida', () => {
  assert.equal(cargar(almacenFalso()), null);
});

test('[P-101] borrar deja el almacén limpio', () => {
  const almacen = almacenFalso();
  guardar(partidaCon(100), almacen);
  borrar(almacen);
  assert.equal(cargar(almacen), null);
});
