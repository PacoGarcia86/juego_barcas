// El mando: dos pulgares y nada más. Gas a la derecha, timón a la izquierda,
// objeto en el centro.
//
// [H-302] El gas se pide en fracción —«a tope», «de crucero»—, nunca en
// newtons: la interfaz no habla de empuje. También responde al teclado, que es
// como se juega en un portátil.

import { useEffect } from 'react';
import type { Mando as MandoMotor } from '../engine/tipos.ts';

interface Props {
  valor: MandoMotor;
  onCambio: (m: MandoMotor) => void;
  puedeUsar: boolean;
}

export default function Mando({ valor, onCambio, puedeUsar }: Props) {
  // Teclado: flechas para el timón, espacio para el objeto, arriba para el gas.
  useEffect(() => {
    const abajo = (e: KeyboardEvent): void => {
      if (e.repeat) return;
      if (e.key === 'ArrowLeft') onCambio({ ...valor, timon: -1 });
      else if (e.key === 'ArrowRight') onCambio({ ...valor, timon: 1 });
      else if (e.key === 'ArrowUp') onCambio({ ...valor, gas: 1 });
      else if (e.key === 'ArrowDown') onCambio({ ...valor, gas: 0.35 });
      else if (e.key === ' ') onCambio({ ...valor, usar: true });
      else return;
      e.preventDefault();
    };
    const arriba = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') onCambio({ ...valor, timon: 0 });
      else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') onCambio({ ...valor, gas: 0.72 });
      else if (e.key === ' ') onCambio({ ...valor, usar: false });
    };
    globalThis.addEventListener('keydown', abajo);
    globalThis.addEventListener('keyup', arriba);
    return () => {
      globalThis.removeEventListener('keydown', abajo);
      globalThis.removeEventListener('keyup', arriba);
    };
  }, [valor, onCambio]);

  const timonear = (lado: -1 | 1) => ({
    onPointerDown: () => onCambio({ ...valor, timon: lado }),
    onPointerUp: () => onCambio({ ...valor, timon: 0 }),
    onPointerLeave: () => onCambio({ ...valor, timon: 0 }),
  });

  return (
    <div
      className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-4"
      style={{ paddingBottom: 'calc(var(--safe-b) + 1rem)' }}
    >
      <div className="flex gap-2">
        <button aria-label="Babor" className={`boton h-16 w-16 text-2xl ${valor.timon === -1 ? 'boton-laton' : ''}`} {...timonear(-1)}>
          ◀
        </button>
        <button aria-label="Estribor" className={`boton h-16 w-16 text-2xl ${valor.timon === 1 ? 'boton-laton' : ''}`} {...timonear(1)}>
          ▶
        </button>
      </div>

      <button
        aria-label="Usar el objeto"
        disabled={!puedeUsar}
        className={`boton h-16 w-16 text-2xl ${puedeUsar ? 'boton-laton latir' : ''}`}
        onPointerDown={() => onCambio({ ...valor, usar: true })}
        onPointerUp={() => onCambio({ ...valor, usar: false })}
      >
        ⚡
      </button>

      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] uppercase tracking-[0.18em] text-tinta-100">
          {valor.gas > 0.9 ? 'a tope' : valor.gas > 0.5 ? 'de crucero' : 'parando'}
        </span>
        <button
          aria-label="Empujar"
          className={`boton h-20 w-20 text-3xl ${valor.gas > 0.9 ? 'boton-laton' : ''}`}
          onPointerDown={() => onCambio({ ...valor, gas: 1 })}
          onPointerUp={() => onCambio({ ...valor, gas: 0.72 })}
          onPointerLeave={() => onCambio({ ...valor, gas: 0.72 })}
        >
          ⛵
        </button>
      </div>
    </div>
  );
}
