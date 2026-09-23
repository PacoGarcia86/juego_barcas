// [K-303] Lo que te acaba de pasar, dicho en el agua y durante dos segundos:
// «¡Lancha te pasa!», «¡Pasas a Trainera!», «¡Miniturbo!».
//
// [H-302] Sin newtons ni empuje: se dice qué ha pasado, no cuánta fuerza hubo.

import type { Aviso, Nave } from '../engine/tipos.ts';
import type { AvisoFechado } from '../juego/motor.ts';

/** El texto de un aviso, o `null` si no merece cartel: el huevo y el objeto ya se ven en el tablero. */
export function textoDe(aviso: Aviso, naves: readonly Nave[]): { texto: string; bueno: boolean } | null {
  switch (aviso.tipo) {
    case 'teAdelantan':
      return { texto: `¡${naves[aviso.quien]?.nombre ?? 'Alguien'} te pasa!`, bueno: false };
    case 'adelantas':
      return { texto: `¡Pasas a ${naves[aviso.quien]?.nombre ?? 'una rival'}!`, bueno: true };
    case 'turbo':
      if (aviso.origen === 'salida') return { texto: '¡Salida perfecta!', bueno: true };
      if (aviso.origen === 'cenir') return { texto: '¡Miniturbo!', bueno: true };
      return { texto: '¡Racha de viento!', bueno: true };
    case 'ahogo':
      return { texto: 'Te has ahogado en la salida', bueno: false };
    case 'golpe':
      return { texto: '¡Te han dado!', bueno: false };
    case 'huevo':
    case 'usas':
      return null;
  }
}

export default function Avisos({ avisos, naves }: { avisos: AvisoFechado[]; naves: readonly Nave[] }) {
  const carteles = avisos
    .map((a) => ({ reloj: a.reloj, ...textoDe(a.aviso, naves) }))
    .filter((c): c is { reloj: number; texto: string; bueno: boolean } => c.texto !== undefined)
    .slice(-3);
  if (carteles.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/4 flex flex-col items-center gap-1">
      {carteles.map((c, i) => (
        <p
          key={`${c.reloj}-${c.texto}-${i}`}
          className={`tarjeta entrar px-4 py-1 text-lg font-semibold ${c.bueno ? 'text-[var(--color-bien)]' : 'text-[var(--color-mal)]'}`}
        >
          {c.texto}
        </p>
      ))}
    </div>
  );
}
