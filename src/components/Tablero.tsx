// El marcador de la regata. Enseña lo que el patrón necesita saber: en qué
// plaza va, cuánto le queda, qué lleva en la mano y —lo que define el juego—
// cuántas veces le han adelantado [B-702].
//
// [H-302] Aquí no se habla en newtons. Se dice qué pasa en el agua.

import type { EstadoRegata } from '../engine/tipos.ts';
import { fichaDe } from '../engine/objetos.ts';

interface Props {
  est: EstadoRegata;
  orden: number[];
  jugador: number;
}

export default function Tablero({ est, orden, jugador }: Props) {
  const nave = est.naves[jugador];
  if (nave === undefined) return null;
  const plaza = orden.indexOf(jugador) + 1;
  const vuelta = Math.min(est.circuito.vueltas, nave.vuelta + 1);
  const objeto = nave.objeto === null ? null : fichaDe(nave.objeto);
  const guardado = nave.guardado === null ? null : fichaDe(nave.guardado);
  const adelante = orden[Math.max(0, plaza - 2)];
  const diferencia =
    adelante === undefined || adelante === jugador ? null : est.naves[adelante]!.metros - nave.metros;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3"
      style={{ paddingTop: 'calc(var(--safe-t) + 0.75rem)' }}>
      <div className="tarjeta px-3 py-2">
        <p className="titulo text-3xl leading-none text-laton-500">
          {plaza}
          <span className="text-base text-tinta-200">/{est.naves.length}</span>
        </p>
        <p className="text-[11px] text-tinta-200">
          vuelta {vuelta} de {est.circuito.vueltas}
        </p>
        {diferencia !== null && (
          <p className="text-[11px] tabular-nums text-tinta-100">
            {Math.round(diferencia)} m al de delante
          </p>
        )}
      </div>

      <div className="flex flex-col items-end gap-2">
        {/* [B-702] El marcador que define el juego. */}
        <div className={`tarjeta px-3 py-2 text-right ${est.adelantamientosSufridos === 0 ? '' : 'opacity-90'}`}>
          <p className="text-[10px] uppercase tracking-[0.18em] text-tinta-100">te han pasado</p>
          <p
            className={`titulo text-2xl leading-none ${
              est.adelantamientosSufridos === 0 ? 'text-[var(--color-bien)]' : 'text-[var(--color-mal)]'
            }`}
          >
            {est.adelantamientosSufridos}
          </p>
          {est.adelantamientosSufridos === 0 && <p className="text-[10px] text-[var(--color-bien)]">regata limpia</p>}
        </div>

        {/* [H-301] Lo que llevas en la mano. */}
        <div className="tarjeta-plana flex items-center gap-2 px-3 py-2">
          <span className={`text-2xl ${objeto === null ? 'opacity-25' : 'latir'}`}>{objeto?.icono ?? '🥚'}</span>
          {guardado !== null && <span className="text-base opacity-70">{guardado.icono}</span>}
        </div>
      </div>
    </div>
  );
}
