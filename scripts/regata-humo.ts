// Una regata con detalle: velocidades, estela, objetos y adelantamientos.
//
//   npm run regata-humo <circuito> [vueltas] [semilla] [barca]
//
// Es el arnés de una sola regata. El de la puerta de fase es `baseline.ts`.

import { avanzar, CUENTA_ATRAS, PASO, resultadoDe, type ContextoConTraza } from '../src/engine/carrera.ts';
import { clasificar, formatearTiempo } from '../src/engine/clasificacion.ts';
import { doblonesDe } from '../src/engine/economia.ts';
import { longitudDeVuelta } from '../src/engine/circuito.ts';
import { montar, type Plantilla } from '../src/engine/__tests__/ayudas.ts';
import { pilotoMedio } from './piloto.ts';

const [circuitoId = 'ria', vueltasTxt, semillaTxt, barcaId = 'chalana'] = process.argv.slice(2);
const vueltas = vueltasTxt === undefined ? undefined : Number(vueltasTxt);
const semilla = semillaTxt === undefined ? 7 : Number(semillaTxt);

const jugador: Plantilla = { barca: barcaId, tripulacion: [] };
const { est: inicial, rng, circuito } = montar(circuitoId, jugador, { semilla, vueltas, cuentaAtras: CUENTA_ATRAS });

let est = inicial;
const vuelta = longitudDeVuelta(circuito);
let picos = 0;
let sumaVel = 0;
let muestras = 0;

while (!est.terminada && est.reloj < 2400) {
  const jug = est.naves.find((n) => n.jugador)!;
  const ctx: ContextoConTraza = {
    mando: pilotoMedio(est, rng),
    ultimaVuelta: jug.vuelta >= circuito.vueltas - 1,
  };
  est = avanzar(est, ctx, rng);
  picos = Math.max(picos, est.objetos.length);
  for (const n of est.naves) {
    if (n.tiempoMeta === null) {
      sumaVel += n.velocidad;
      muestras++;
    }
  }
}

const orden = clasificar(est);
console.log(`\n${circuito.nombre} · ${circuito.vueltas} vueltas de ${vuelta} m · semilla ${semilla}\n`);
console.log('  pos  barca         tiempo      dif      vel.media  huevos  energía');
const ganador = est.naves[orden[0]!]!;
orden.forEach((i, k) => {
  const n = est.naves[i]!;
  const t = n.tiempoMeta;
  const media = t === null ? 0 : (vuelta * circuito.vueltas) / t;
  console.log(
    `  ${String(k + 1).padStart(2)}${n.jugador ? ' ▸' : '  '} ${n.nombre.padEnd(12)} ` +
      `${t === null ? 'no llega' : formatearTiempo(t).padStart(8)}  ` +
      `${t === null || k === 0 ? '   —  ' : ('+' + (t - ganador.tiempoMeta!).toFixed(2)).padStart(6)}  ` +
      `${media.toFixed(2).padStart(8)} m/s  ${String(n.huevosRotos).padStart(4)}  ${String(Math.round(n.energia)).padStart(6)}`,
  );
});
const r = resultadoDe(est, 0);
console.log(
  `\n  jugador: ${r.posicion}.º · adelantamientos sufridos ${r.adelantamientosSufridos} · ` +
    `${r.limpia ? 'REGATA LIMPIA' : 'no limpia'} · huevos ${r.huevos} · ` +
    `${doblonesDe(r)} doblones`,
);
console.log(`  velocidad media de la flota ${(sumaVel / Math.max(1, muestras)).toFixed(2)} m/s · objetos en el agua a la vez, máximo ${picos}`);
console.log(`  objetos en vuelo al terminar: ${est.objetos.length}\n`);
