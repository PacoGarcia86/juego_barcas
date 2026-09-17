import { useCallback, useEffect, useState } from 'react';
import type { Circuito, Partida, Resultado } from './engine/tipos.ts';
import { partidaNueva } from './engine/astillero.ts';
import { borrar, cargar, guardar } from './engine/progreso.ts';
import InicioMode from './modes/InicioMode.tsx';
import AstilleroMode from './modes/AstilleroMode.tsx';
import RegataMode from './modes/RegataMode.tsx';

type Pantalla = 'inicio' | 'astillero' | 'regata';

export default function App() {
  const [partida, setPartida] = useState<Partida | null>(null);
  const [pantalla, setPantalla] = useState<Pantalla>('inicio');
  const [circuito, setCircuito] = useState<Circuito | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    setPartida(cargar() ?? partidaNueva());
  }, []);

  // [P-103] Se guarda en CADA cambio, no al salir: en un móvil nadie «sale» de
  // una aplicación — la cierra el sistema cuando le hace falta la memoria, y
  // con un guardado al salir eso significa perder la partida.
  useEffect(() => {
    if (partida === null) return;
    // [P-104] Si el almacén está bloqueado se avisa UNA vez y se sigue jugando.
    if (!guardar(partida)) setAviso('Este navegador no deja guardar. La partida se pierde al cerrar.');
  }, [partida]);

  const actualizar = useCallback((p: Partida) => setPartida(p), []);

  if (partida === null) return null;

  if (pantalla === 'regata' && circuito !== null) {
    const terminar = (r: Resultado): void => {
      setPartida({
        ...partida,
        doblones: partida.doblones + r.doblones,
        regatasCorridas: partida.regatasCorridas + 1,
        victorias: partida.victorias + (r.ganada ? 1 : 0),
        regatasLimpias: partida.regatasLimpias + (r.limpia ? 1 : 0),
      });
      setCircuito(null);
      setPantalla('inicio');
    };
    return (
      <RegataMode
        circuito={circuito}
        partida={partida}
        onTerminar={terminar}
        onSalir={() => {
          setCircuito(null);
          setPantalla('inicio');
        }}
      />
    );
  }

  if (pantalla === 'astillero') {
    return <AstilleroMode partida={partida} onCambio={actualizar} onVolver={() => setPantalla('inicio')} />;
  }

  return (
    <div className="flex h-full flex-col">
      {aviso !== null && (
        <p className="tarjeta-plana mx-4 mt-2 px-3 py-2 text-sm text-[var(--color-ojo)]" role="status">
          {aviso}
        </p>
      )}
      <div className="min-h-0 flex-1">
        <InicioMode
          partida={partida}
          onAstillero={() => setPantalla('astillero')}
          onCorrer={(c) => {
            setCircuito(c);
            setPantalla('regata');
          }}
          onBorrar={() => {
            borrar();
            setPartida(partidaNueva());
          }}
        />
      </div>
    </div>
  );
}
