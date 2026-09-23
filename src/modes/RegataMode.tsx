// La regata. Monta el motor, le da el mando y dibuja.
//
// Este modo CONSUME el motor: no decide nada de la regata. Si te ves
// escribiendo criterio de carrera aquí, para [WORKFLOW §3].

import { useCallback, useMemo, useRef, useState } from 'react';
import type { Circuito, Mando as MandoMotor, Oficio, Partida, Resultado } from '../engine/tipos.ts';
import type { Inscripcion } from '../engine/carrera.ts';
import { barcaEfectiva } from '../engine/barcas.ts';
import { BARCAS, barcaPorId } from '../engine/datos/barcas.ts';
import { MotorDeRegata } from '../juego/motor.ts';
import { segundosReales } from '../engine/ritmo.ts';
import type { Diagnostico } from '../render/tresd/vista.ts';
import Lienzo from '../components/Lienzo.tsx';
import Tablero from '../components/Tablero.tsx';
import Aliento from '../components/Aliento.tsx';
import Mando from '../components/Mando.tsx';
import Cuenta from '../components/Cuenta.tsx';
import Avisos from '../components/Avisos.tsx';
import { velocidadDeCasco } from '../engine/fisica.ts';

interface Props {
  circuito: Circuito;
  partida: Partida;
  onTerminar: (r: Resultado) => void;
  onSalir: () => void;
}

/** Dotación de una rival: un timonel y el resto remeros, hasta sus plazas. */
function dotacion(plazas: number): Oficio[] {
  const t: Oficio[] = Array(plazas).fill('remero');
  if (plazas > 1) t[0] = 'timonel';
  return t;
}

/** [B-401] Siete rivales: el catálogo en ciclo, para que haya ocho en el agua. */
function parrilla(partida: Partida): Inscripcion[] {
  const mia = barcaPorId(partida.barcaEquipada) ?? BARCAS[0]!;
  const rivales: Inscripcion[] = [];
  const vistas = new Map<string, number>();
  for (let i = 0; i < 7; i++) {
    const b = BARCAS[i % BARCAS.length]!;
    const repetida = (vistas.get(b.nombre) ?? 0) + 1;
    vistas.set(b.nombre, repetida);
    rivales.push({
      nombre: repetida === 1 ? b.nombre : `${b.nombre} ${repetida}`,
      barca: barcaEfectiva(b, dotacion(b.plazas)),
      colores: b.colores,
      jugador: false,
    });
  }
  return [
    ...rivales,
    { nombre: 'Tu barca', barca: barcaEfectiva(mia, partida.embarcados), colores: mia.colores, jugador: true },
  ];
}

export default function RegataMode({ circuito, partida, onTerminar, onSalir }: Props) {
  const diagnosticoPedido = useMemo(
    () => new URLSearchParams(globalThis.location?.search ?? '').get('diagnostico') === '1',
    [],
  );
  const motor = useMemo(
    () => new MotorDeRegata(circuito, parrilla(partida), Date.now() >>> 0),
    [circuito, partida],
  );

  const [est, setEst] = useState(motor.est);
  const [diag, setDiag] = useState<Diagnostico | null>(null);
  const [terminada, setTerminada] = useState(false);
  const mando = useRef<MandoMotor>({ gas: 0.72, timon: 0, usar: false });
  const [mandoVisible, setMandoVisible] = useState<MandoMotor>(mando.current);
  // Cuántos fotogramas van desde el último refresco de React: el motor va a
  // 20 Hz y React no necesita ir a 60 para enseñar un marcador.
  const desde = useRef(0);

  const alFotograma = useCallback(
    (dt: number) => {
      motor.tictac(dt, mando.current);
      // El «usar» es de un solo tick: si se quedara pegado, un toque gastaría
      // el objeto y el guardado seguidos.
      if (mando.current.usar) mando.current = { ...mando.current, usar: false };
      if (++desde.current >= 6) {
        desde.current = 0;
        setEst(motor.est);
      }
      if (motor.terminada && !terminada) {
        setTerminada(true);
        setEst(motor.est);
      }
      return motor.est;
    },
    [motor, terminada],
  );

  const cambiarMando = useCallback((m: MandoMotor) => {
    mando.current = m;
    setMandoVisible(m);
  }, []);

  const jugador = motor.jugador;
  const nave = est.naves[jugador];
  // [K-301] La vista no puede importar el motor: el encuadre se le da hecho.
  const encuadre = useMemo(
    () => ({ ritmo: motor.ritmo, vCasco: velocidadDeCasco(motor.est.naves[motor.jugador]!.barca.eslora) }),
    [motor],
  );
  const final = motor.final;

  return (
    <div className="relative h-full w-full overflow-hidden bg-honda-900">
      <Lienzo
        inicial={motor.est}
        alFotograma={alFotograma}
        seguido={jugador}
        encuadre={encuadre}
        onDiagnostico={diagnosticoPedido ? setDiag : undefined}
      />

      <Tablero est={est} orden={motor.orden} jugador={jugador} />
      {/* [K-302] [K-303] */}
      <Cuenta est={est} />
      {!terminada && <Avisos avisos={motor.avisosRecientes(2)} naves={est.naves} />}
      {nave !== undefined && <Aliento nave={nave} />}
      {!terminada && (
        <Mando valor={mandoVisible} onCambio={cambiarMando} puedeUsar={nave?.objeto != null} />
      )}

      <button className="boton absolute right-3 px-3 py-1 text-xs"
        style={{ top: 'calc(var(--safe-t) + 7.5rem)' }} onClick={onSalir}>
        dejarlo
      </button>

      {/* [R-602] `?diagnostico=1` */}
      {diag !== null && (
        <p className="pointer-events-none absolute bottom-1 left-2 font-mono text-[10px] text-tinta-100">
          {diag.fps} fps · {diag.llamadas} llamadas · {Math.round(diag.triangulos / 1000)} k tri
          {' · '}{diag.fov}° de campo
          {diag.simplificado ? ' · CALIDAD REDUCIDA' : ''}
        </p>
      )}

      {terminada && final !== null && (
        <div className="absolute inset-0 grid place-items-center bg-honda-900/85 p-4 backdrop-blur-sm">
          <div className="tarjeta entrar grid w-full max-w-sm gap-3 p-5">
            <p className="text-xs font-semibold tracking-[0.3em] text-laton-500">META</p>
            <h2 className="titulo text-3xl">
              {final.posicion}.º de {est.naves.length}
            </h2>
            <ul className="grid gap-1 text-sm text-tinta-300">
              {/* [K-103] En segundos de pantalla, no de simulación. */}
              <li>Tiempo: {segundosReales(final.tiempo).toFixed(2).replace('.', ',')} s</li>
              {final.diferencia > 0 && <li>A {segundosReales(final.diferencia).toFixed(2).replace('.', ',')} s del ganador</li>}
              <li>Huevos rotos: {final.huevos}</li>
              <li className={final.limpia ? 'text-[var(--color-bien)]' : 'text-[var(--color-mal)]'}>
                {final.limpia
                  ? 'Regata limpia: no te adelantó nadie'
                  : `Te adelantaron ${final.adelantamientosSufridos} ${
                      final.adelantamientosSufridos === 1 ? 'vez' : 'veces'
                    }`}
              </li>
            </ul>
            <p className="titulo text-2xl text-laton-500">+{final.doblones} doblones</p>
            <button className="boton boton-laton mt-1" onClick={() => onTerminar(final)}>
              Al muelle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
