// [A-4xx] El astillero: comprar barcas, comprar hombres y subirlos a bordo.
//
// Este modo CONSUME el motor: las reglas de qué se puede comprar y qué cabe
// están en `astillero.ts`, no aquí.

import { useState } from 'react';
import type { Oficio, Partida } from '../engine/tipos.ts';
import { BARCAS, barcaPorId } from '../engine/datos/barcas.ts';
import { TRIPULANTES } from '../engine/datos/tripulantes.ts';
import {
  bajarATierra,
  comprarBarca,
  comprarTripulante,
  cuentaEnTierra,
  equiparBarca,
  plazasLibresDe,
  subirABordo,
  venderTripulante,
  type Motivo,
} from '../engine/astillero.ts';
import FichaBarca from '../components/FichaBarca.tsx';

const EXCUSAS: Record<Exclude<Motivo, null>, string> = {
  fondos: 'No llegan los doblones.',
  repetida: 'Esa ya la tienes.',
  desconocida: 'Esa barca no existe.',
  plazas: 'No queda plaza a bordo.',
  'no-la-tienes': 'Eso no lo tienes.',
};

interface Props {
  partida: Partida;
  onCambio: (p: Partida) => void;
  onVolver: () => void;
}

export default function AstilleroMode({ partida, onCambio, onVolver }: Props) {
  const [pestana, setPestana] = useState<'barcas' | 'gente'>('barcas');
  const [aviso, setAviso] = useState<string | null>(null);
  const mia = barcaPorId(partida.barcaEquipada) ?? BARCAS[0]!;

  const aplicar = ({ partida: p, motivo }: { partida: Partida; motivo: Motivo }): void => {
    setAviso(motivo === null ? null : EXCUSAS[motivo]);
    if (motivo === null) onCambio(p);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2"
        style={{ paddingTop: 'calc(var(--safe-t) + 0.75rem)' }}>
        <button className="min-w-0 text-left" onClick={onVolver}>
          <p className="titulo text-base leading-none">El astillero</p>
          <p className="text-[11px] text-tinta-100">
            Llevas la {mia.nombre} · {partida.embarcados.length}/{mia.plazas} plazas
          </p>
        </button>
        <p className="shrink-0 font-semibold tabular-nums text-laton-500">{partida.doblones} ⊙</p>
      </header>

      <div className="flex shrink-0 gap-2 px-4 pb-2">
        <button className={`boton flex-1 ${pestana === 'barcas' ? 'boton-laton' : ''}`} onClick={() => setPestana('barcas')}>
          Barcas
        </button>
        <button className={`boton flex-1 ${pestana === 'gente' ? 'boton-laton' : ''}`} onClick={() => setPestana('gente')}>
          Gente
        </button>
      </div>

      {aviso !== null && (
        <p className="tarjeta-plana mx-4 mb-2 px-3 py-2 text-sm text-[var(--color-ojo)]" role="status">
          {aviso}
        </p>
      )}

      <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        {pestana === 'barcas' && (
          <div className="grid gap-3">
            {BARCAS.map((b) => {
              const tengo = partida.barcasCompradas.includes(b.id);
              const puesta = partida.barcaEquipada === b.id;
              return (
                <div key={b.id} className={`tarjeta p-4 ${puesta ? 'ring-2 ring-[var(--color-laton-500)]' : ''}`}>
                  <FichaBarca barca={b} actual={puesta ? null : mia} />
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-sm tabular-nums text-tinta-200">
                      {b.precio === 0 ? 'de casa' : `${b.precio} ⊙`}
                    </span>
                    {puesta ? (
                      <span className="text-sm font-semibold text-laton-500">a flote</span>
                    ) : tengo ? (
                      <button className="boton boton-laton" onClick={() => aplicar(equiparBarca(partida, b.id))}>
                        Botarla
                      </button>
                    ) : (
                      <button
                        className="boton"
                        disabled={partida.doblones < b.precio}
                        onClick={() => aplicar(comprarBarca(partida, b.id))}
                      >
                        Comprar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {pestana === 'gente' && (
          <div className="grid gap-3">
            <p className="tarjeta-plana px-3 py-2 text-[12px] leading-snug text-tinta-300">
              Cada uno que subes rema, gobierna o vigila por ti — y pesa. Una barca cargada va más metida en el agua
              y tarda más en virar. Quedan <span className="text-laton-500">{plazasLibresDe(partida)}</span> plazas
              en la {mia.nombre}.
            </p>
            {TRIPULANTES.map((t) => {
              const enTierra = cuentaEnTierra(partida, t.oficio);
              const abordo = partida.embarcados.filter((o) => o === t.oficio).length;
              return (
                <div key={t.oficio} className="tarjeta grid gap-2 p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="titulo text-base">{t.nombre}</h3>
                    <span className="text-[11px] text-tinta-100">{t.peso} kg</span>
                  </div>
                  <p className="text-[13px] leading-snug text-tinta-300">{t.descripcion}</p>
                  <p className="text-[11px] text-tinta-100">
                    a bordo <span className="text-tinta-300">{abordo}</span> · en tierra{' '}
                    <span className="text-tinta-300">{enTierra}</span>
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm tabular-nums text-tinta-200">{t.precio} ⊙</span>
                    <div className="flex gap-2">
                      {abordo > 0 && (
                        <button className="boton px-3 py-1 text-xs" onClick={() => aplicar(bajarATierra(partida, t.oficio))}>
                          Bajar
                        </button>
                      )}
                      {enTierra > 0 && (
                        <>
                          <button className="boton px-3 py-1 text-xs" onClick={() => aplicar(venderTripulante(partida, t.oficio))}>
                            Vender
                          </button>
                          <button
                            className="boton boton-laton px-3 py-1 text-xs"
                            disabled={plazasLibresDe(partida) <= 0}
                            onClick={() => aplicar(subirABordo(partida, t.oficio))}
                          >
                            Subir
                          </button>
                        </>
                      )}
                      <button
                        className="boton"
                        disabled={partida.doblones < t.precio}
                        onClick={() => aplicar(comprarTripulante(partida, t.oficio))}
                      >
                        Contratar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
