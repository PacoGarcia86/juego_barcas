// [V-303] La tira de clasificación: las ocho barcas, de primera a última, con
// el color de su casco. La tuya, más grande y con borde.

import type { EstadoRegata } from '../engine/tipos.ts';

interface Props {
  est: EstadoRegata;
  orden: number[];
  jugador: number;
}

export default function Clasificacion({ est, orden, jugador }: Props) {
  return (
    <ol className="pointer-events-none absolute left-3 flex flex-col gap-1"
      style={{ top: 'calc(var(--safe-t) + 7.4rem)' }}>
      {orden.map((i, plaza) => {
        const nave = est.naves[i]!;
        const yo = i === jugador;
        return (
          <li key={i} className="flex items-center gap-1.5" style={{ transition: 'transform 0.3s' }}>
            <span className={`w-4 text-right text-[11px] font-bold tabular-nums ${yo ? 'text-laton-500' : 'text-tinta-200'}`}>
              {plaza + 1}
            </span>
            <span
              className="block rounded-full"
              style={{
                width: yo ? 22 : 14,
                height: yo ? 22 : 14,
                background: `linear-gradient(135deg, ${nave.colores.casco} 55%, ${nave.colores.franja} 55%)`,
                border: yo ? '3px solid var(--color-laton-500)' : '2px solid rgba(255,255,255,0.6)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
              }}
            />
            {yo && <span className="texto-arcade text-xs text-laton-500">TÚ</span>}
          </li>
        );
      })}
    </ol>
  );
}
