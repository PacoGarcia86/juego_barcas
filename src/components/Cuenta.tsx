// [K-302] La cuenta atrás de la salida: 3 · 2 · 1 · ¡Ya!
//
// Los segundos que se enseñan son REALES (`K-103`): el motor cuenta en
// segundos de simulación y aquí se dividen por el ritmo. Lo que pasa en la
// salida —clavarla o ahogarse— lo cuenta `Avisos`, que es quien celebra.

import type { EstadoRegata } from '../engine/tipos.ts';
import { segundosReales } from '../engine/ritmo.ts';

/** Segundos reales que se queda el «¡Ya!» en pantalla después de la salida. */
const YA = 1;

export default function Cuenta({ est }: { est: EstadoRegata }) {
  let texto: string | null = null;
  if (est.cuentaAtras > 0) texto = String(Math.ceil(segundosReales(est.cuentaAtras) - 1e-9));
  else if (segundosReales(est.reloj) < YA) texto = '¡Ya!';
  if (texto === null) return null;
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <div className="grid place-items-center gap-2 text-center">
        <p key={texto} className="titulo entrar text-8xl leading-none text-laton-500 drop-shadow-lg">
          {texto}
        </p>
        {est.cuentaAtras > 0 && (
          <p className="tarjeta-plana px-3 py-1 text-xs text-tinta-200">
            Pisa a tope justo antes de la salida
          </p>
        )}
      </div>
    </div>
  );
}
