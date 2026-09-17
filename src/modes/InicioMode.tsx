// La pantalla de salida: elegir circuito y entrar al astillero.

import type { Circuito, Partida } from '../engine/tipos.ts';
import { CIRCUITOS } from '../engine/datos/circuitos.ts';
import { longitudDeVuelta } from '../engine/circuito.ts';
import { barcaPorId, BARCAS } from '../engine/datos/barcas.ts';

interface Props {
  partida: Partida;
  onCorrer: (c: Circuito) => void;
  onAstillero: () => void;
  onBorrar: () => void;
}

const MARES: Record<Circuito['hora'], string> = {
  amanecer: 'al amanecer',
  mediodia: 'a mediodía',
  tarde: 'por la tarde',
  noche: 'de noche',
};

export default function InicioMode({ partida, onCorrer, onAstillero, onBorrar }: Props) {
  const mia = barcaPorId(partida.barcaEquipada) ?? BARCAS[0]!;
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 px-5 pb-3" style={{ paddingTop: 'calc(var(--safe-t) + 1.5rem)' }}>
        <p className="text-xs font-semibold tracking-[0.3em] text-laton-500">REGATA 2026</p>
        <h1 className="titulo text-3xl leading-tight">Que no te pasen</h1>
        <p className="mt-1 text-[13px] leading-snug text-tinta-200">
          Rompe los huevos que flotan —son gratis y salen otra vez—, aguanta la posición y llega el primero.
        </p>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <button className="tarjeta mb-3 flex w-full items-center justify-between gap-3 p-4 text-left" onClick={onAstillero}>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-tinta-100">tu barca</p>
            <p className="titulo truncate text-lg">{mia.nombre}</p>
            <p className="text-[11px] text-tinta-200">
              {partida.embarcados.length} de {mia.plazas} plazas ocupadas · al astillero
            </p>
          </div>
          <span className="shrink-0 font-semibold tabular-nums text-laton-500">{partida.doblones} ⊙</span>
        </button>

        <p className="mb-2 px-1 text-[10px] uppercase tracking-[0.18em] text-tinta-100">elige agua</p>
        <div className="grid gap-3">
          {CIRCUITOS.map((c) => (
            <button key={c.id} className="tarjeta p-4 text-left" onClick={() => onCorrer(c)}>
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="titulo text-lg">{c.nombre}</h2>
                <span className="text-[11px] text-tinta-100">{MARES[c.hora]}</span>
              </div>
              <p className="mt-1 text-[13px] leading-snug text-tinta-300">{c.descripcion}</p>
              <p className="mt-2 text-[11px] tabular-nums text-tinta-100">
                {c.vueltas} vueltas de {longitudDeVuelta(c)} m · mar {Math.round(c.oleajeBase * 10)}/10 ·{' '}
                {/* [B-104] La procedencia se enseña: un dato aproximado sin etiqueta es un dato falso. */}
                recorrido {c.procedencia}
              </p>
            </button>
          ))}
        </div>

        {partida.regatasCorridas > 0 && (
          <p className="mt-4 px-1 text-center text-[11px] text-tinta-100">
            {partida.regatasCorridas} regatas · {partida.victorias} victorias · {partida.regatasLimpias} limpias
            {' · '}
            <button className="underline" onClick={onBorrar}>
              empezar de cero
            </button>
          </p>
        )}
      </main>
    </div>
  );
}
