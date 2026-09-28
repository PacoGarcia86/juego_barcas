// El marcador de la regata. Enseña lo que el patrón necesita saber: en qué
// plaza va, cuánto le queda, qué lleva en la mano y —lo que define el juego—
// cuántas veces le han adelantado [B-702].
//
// [H-302] Aquí no se habla en newtons. Se dice qué pasa en el agua.
// [V-303] La plaza, en grande y latiendo al cambiar. [V-302] La casilla del
// objeto gira como una ruleta antes de parar en lo que ha salido.

import type { EstadoRegata } from '../engine/tipos.ts';
import { fichaDe, OBJETOS } from '../engine/objetos.ts';
import { formatearTiempo } from '../engine/clasificacion.ts';

interface Props {
  est: EstadoRegata;
  orden: number[];
  jugador: number;
  /** [V-302] La ruleta está girando: se enseña el carrusel, no el objeto. */
  girando: boolean;
  /** [K-101] [V-307] Segundos de regata por segundo real. */
  ritmo: number;
}

export default function Tablero({ est, orden, jugador, girando, ritmo }: Props) {
  const nave = est.naves[jugador];
  if (nave === undefined) return null;
  const plaza = orden.indexOf(jugador) + 1;
  const vuelta = Math.min(est.circuito.vueltas, nave.vuelta + 1);
  const ultima = vuelta === est.circuito.vueltas;
  const objeto = nave.objeto === null ? null : fichaDe(nave.objeto);
  const guardado = nave.guardado === null ? null : fichaDe(nave.guardado);
  const adelante = orden[Math.max(0, plaza - 2)];
  const diferencia =
    adelante === undefined || adelante === jugador ? null : est.naves[adelante]!.metros - nave.metros;
  const colorPlaza = plaza === 1 ? 'var(--color-laton-600)' : plaza <= 3 ? '#e8eef5' : '#ff9d7a';

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3"
      style={{ paddingTop: 'calc(var(--safe-t) + 0.75rem)' }}>
      <div className="flex items-end gap-2">
        <p key={plaza} className="pop texto-arcade leading-none" style={{ fontSize: '4.2rem', color: colorPlaza }}>
          {plaza}
          <span className="text-2xl">.º</span>
        </p>
        <div className="pb-1">
          <p className={`texto-arcade text-lg leading-none ${ultima ? 'text-[var(--color-ojo)]' : 'text-tinta-500'}`}>
            vuelta {vuelta}/{est.circuito.vueltas}
          </p>
          <p className="mt-1 text-[11px] tabular-nums text-tinta-100">{formatearTiempo(est.reloj / ritmo)}</p>
          {diferencia !== null && (
            <p className="text-[11px] tabular-nums text-tinta-100">{Math.round(diferencia)} m al de delante</p>
          )}
        </div>
      </div>

      {/* [H-301] [V-302] Lo que llevas en la mano, arriba en el centro. */}
      <div className="flex items-start gap-1.5">
        <div className="casilla-objeto grid h-16 w-16 place-items-center overflow-hidden rounded-2xl">
          {girando ? (
            <div className="ruleta flex flex-col items-center text-3xl leading-none">
              {OBJETOS.slice(0, 4).map((o) => (
                <span key={o.tipo}>{o.icono}</span>
              ))}
            </div>
          ) : (
            <span key={objeto?.tipo ?? 'nada'} className={`text-4xl ${objeto === null ? 'opacity-25' : 'pop'}`}>
              {objeto?.icono ?? '🥚'}
            </span>
          )}
        </div>
        {guardado !== null && !girando && (
          <div className="casilla-objeto grid h-10 w-10 place-items-center rounded-xl text-xl">{guardado.icono}</div>
        )}
      </div>

      {/* [B-702] El marcador que define el juego. */}
      <div className="tarjeta px-3 py-2 text-right">
        <p className="text-[10px] uppercase tracking-[0.18em] text-tinta-100">te han pasado</p>
        <p
          key={est.adelantamientosSufridos}
          className={`pop titulo text-2xl leading-none ${
            est.adelantamientosSufridos === 0 ? 'text-[var(--color-bien)]' : 'text-[var(--color-mal)]'
          }`}
        >
          {est.adelantamientosSufridos}
        </p>
        {est.adelantamientosSufridos === 0 && <p className="text-[10px] text-[var(--color-bien)]">regata limpia</p>}
      </div>
    </div>
  );
}
