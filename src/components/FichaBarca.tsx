// [A-401] [A-402] La ficha de una barca, comparada contra la que llevas: se ve
// qué ganas y qué pierdes, no un número en absoluto que no dice nada.
//
// [H-302] La ficha habla de velocidad y de plazas, nunca de newtons.

import type { Barca } from '../engine/tipos.ts';
import { velocidadDeCascoDe } from '../engine/barcas.ts';

interface Props {
  barca: Barca;
  /** La que se lleva ahora. `null` en la pantalla de elegir. */
  actual: Barca | null;
}

/** Las cinco características del frente de Pareto [A-102], como se llaman fuera. */
const CARACTERISTICAS: { campo: keyof Barca; nombre: string; tope: number }[] = [
  { campo: 'eslora', nombre: 'eslora', tope: 16 },
  { campo: 'empuje', nombre: 'fuerza', tope: 2800 },
  { campo: 'maniobra', nombre: 'timón', tope: 99 },
  { campo: 'estabilidad', nombre: 'aguante', tope: 99 },
  { campo: 'plazas', nombre: 'plazas', tope: 6 },
];

export default function FichaBarca({ barca, actual }: Props) {
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="titulo text-lg">{barca.nombre}</h3>
        <span className="text-[11px] text-tinta-100">
          {barca.casco === 'planeador' ? 'casco planeador' : 'casco de desplazamiento'}
        </span>
      </div>

      <p className="text-[13px] leading-snug text-tinta-300">{barca.descripcion}</p>

      <div className="grid gap-1">
        {CARACTERISTICAS.map(({ campo, nombre, tope }) => {
          const valor = barca[campo] as number;
          const mio = actual === null ? valor : (actual[campo] as number);
          const delta = valor - mio;
          return (
            <div key={campo} className="grid grid-cols-[4.5rem_1fr_2.6rem] items-center gap-2">
              <span className="text-[11px] text-tinta-100">{nombre}</span>
              <div className="barra">
                <i
                  style={{
                    width: `${Math.min(100, (valor / tope) * 100)}%`,
                    background: delta >= 0 ? 'var(--color-laton-500)' : 'var(--color-honda-400)',
                  }}
                />
              </div>
              <span
                className={`text-right text-[11px] tabular-nums ${
                  delta > 0 ? 'text-[var(--color-bien)]' : delta < 0 ? 'text-[var(--color-mal)]' : 'text-tinta-100'
                }`}
              >
                {actual === null || delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${Math.round(delta)}`}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-tinta-100">
        Se planta en <span className="tabular-nums text-tinta-300">{velocidadDeCascoDe(barca).toFixed(2)} m/s</span> antes de
        que su propia ola la frene
        {barca.casco === 'planeador' ? ', y a partir de ahí se sube encima del agua.' : '.'}
      </p>
    </div>
  );
}
