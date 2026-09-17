// La barra de aliento de la tripulación y los efectos que te están cayendo
// encima [B-208] [H-303].
//
// [H-302] Se llama «aliento» y no «energía en newtons»: al patrón se le dice
// cómo está la gente, no cuántos vatios quedan.

import type { Efecto, Nave } from '../engine/tipos.ts';

const NOMBRES: Record<Efecto['tipo'], string> = {
  turbo: 'racha de viento',
  frenado: 'te han frenado',
  giro: 'sin gobierno',
  ciego: 'no ves nada',
  burbuja: 'protegido',
};

export default function Aliento({ nave }: { nave: Nave }) {
  const color =
    nave.energia > 55 ? 'var(--color-bien)' : nave.energia > 25 ? 'var(--color-ojo)' : 'var(--color-mal)';
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 px-3"
      style={{ paddingBottom: 'calc(var(--safe-b) + 6.5rem)' }}>
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-[10px] uppercase tracking-[0.18em] text-tinta-100">aliento</span>
          <span className="text-[11px] tabular-nums text-tinta-200">{Math.round(nave.energia)}</span>
        </div>
        <div className="barra">
          <i style={{ width: `${Math.max(0, Math.min(100, nave.energia))}%`, background: color }} />
        </div>
        {nave.efectos.length > 0 && (
          <div className="mt-1 flex flex-wrap justify-center gap-1">
            {nave.efectos.map((e, i) => (
              <span key={i} className="tarjeta-plana px-2 py-0.5 text-[10px] text-tinta-300">
                {NOMBRES[e.tipo]} · {e.restante.toFixed(1)} s
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
