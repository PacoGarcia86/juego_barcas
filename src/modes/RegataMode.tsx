// La regata. Monta el motor, le da el mando y dibuja.
//
// Este modo CONSUME el motor: no decide nada de la regata. Si te ves
// escribiendo criterio de carrera aquí, para [WORKFLOW §3].

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Circuito, EstadoRegata, Mando as MandoMotor, Oficio, Partida, Resultado } from '../engine/tipos.ts';
import type { Inscripcion } from '../engine/carrera.ts';
import { barcaEfectiva } from '../engine/barcas.ts';
import { BARCAS, barcaPorId } from '../engine/datos/barcas.ts';
import { MotorDeRegata } from '../juego/motor.ts';
import { RITMO } from '../juego/ritmo.ts';
import { SONIDO_DE, sucesosEntre, type Suceso } from '../juego/sucesos.ts';
import { Sintetizador } from '../sonido/sintetizador.ts';
import { formatearTiempo } from '../engine/clasificacion.ts';
import type { Diagnostico } from '../render/tresd/vista.ts';
import Lienzo from '../components/Lienzo.tsx';
import Tablero from '../components/Tablero.tsx';
import Aliento from '../components/Aliento.tsx';
import Mando from '../components/Mando.tsx';
import Avisos, { type Aviso } from '../components/Avisos.tsx';
import Clasificacion from '../components/Clasificacion.tsx';

/** [K-402] Lo que gira la ruleta antes de parar, en ms reales. */
const RULETA_MS = 1000;
/** [K-406] Lo que se deja ver «¡META!» antes de la tarjeta, en ms. */
const META_MS = 2500;
/** Lo que dura un aviso en pantalla, en ms (la animación `aviso`). */
const AVISO_MS = 1700;

const VERDE = 'var(--color-bien)';
const ROJO = 'var(--color-mal)';
const ORO = 'var(--color-laton-600)';

/** [K-404] El texto de cada suceso. Los que no llevan texto solo suenan. */
function textoDe(s: Suceso): Omit<Aviso, 'id'> | null {
  switch (s.tipo) {
    case 'vuelta':
      return { texto: `Vuelta ${s.vuelta}`, color: '#e8eef5' };
    case 'ultimaVuelta':
      return { texto: '¡Última vuelta!', color: 'var(--color-ojo)', grande: true };
    case 'tePasan':
      return { texto: '¡Te han pasado!', color: ROJO };
    case 'adelantas':
      return { texto: `¡${s.plaza}.º!`, color: VERDE };
    case 'golpe':
      return { texto: s.efecto === 'giro' ? '¡Sin gobierno!' : s.efecto === 'ciego' ? '¡Niebla!' : '¡Frenazo!', color: ROJO };
    case 'aciertas':
      return { texto: '¡Tocado!', color: ORO };
    case 'cenida':
      return s.nivel === 1 ? { texto: 'Ceñida', color: '#7cc8ff' } : { texto: '¡Ceñida máxima!', color: '#ffa04d' };
    case 'meta':
      return { texto: '¡META!', color: ORO, grande: true };
    case 'objeto':
    case 'lanzas':
    case 'racha':
    case 'huevo':
      return null;
  }
}

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
  // [K-5xx] El sonido. Arranca con el primer gesto del patrón [K-504].
  const sonido = useMemo(() => new Sintetizador(), []);
  const [callado, setCallado] = useState(false);
  useEffect(() => {
    const arrancar = (): void => sonido.arrancar();
    globalThis.addEventListener('pointerdown', arrancar);
    globalThis.addEventListener('keydown', arrancar);
    return () => {
      globalThis.removeEventListener('pointerdown', arrancar);
      globalThis.removeEventListener('keydown', arrancar);
      sonido.destruir();
    };
  }, [sonido]);

  const [est, setEst] = useState(motor.est);
  const [diag, setDiag] = useState<Diagnostico | null>(null);
  const [enMeta, setEnMeta] = useState(false);
  const [tarjeta, setTarjeta] = useState(false);
  const [cuenta, setCuenta] = useState<string | null>(String(Math.ceil(motor.cuenta)));
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [girando, setGirando] = useState(false);
  const mando = useRef<MandoMotor>({ gas: 0.72, timon: 0, usar: false });
  const [mandoVisible, setMandoVisible] = useState<MandoMotor>(mando.current);
  // Cuántos fotogramas van desde el último refresco de React: el motor va a
  // 20 Hz y React no necesita ir a 60 para enseñar un marcador.
  const desde = useRef(0);
  const siguienteAviso = useRef(1);
  const ultimaCuenta = useRef(Math.ceil(motor.cuenta));
  /** [K-402] Hasta cuándo gira la ruleta (reloj de `performance.now`). */
  const ruletaHasta = useRef(0);
  const ultimoTic = useRef(0);
  const ultimoAdelanto = useRef(0);

  const avisar = useCallback((a: Omit<Aviso, 'id'>) => {
    const id = siguienteAviso.current++;
    setAvisos((lista) => [...lista.slice(-2), { ...a, id }]);
    setTimeout(() => setAvisos((lista) => lista.filter((x) => x.id !== id)), AVISO_MS);
  }, []);

  const alFotograma = useCallback(
    (dt: number): EstadoRegata => {
      const ahora = performance.now();
      const antes = motor.est;
      const enCuenta = motor.cuenta > 0;
      // [K-402] Mientras gira la ruleta no se suelta nada.
      const ruleta = ahora < ruletaHasta.current;
      motor.tictac(dt, ruleta ? { ...mando.current, usar: false } : mando.current);
      // El «usar» es de un solo tick: si se quedara pegado, un toque gastaría
      // el objeto y el guardado seguidos.
      if (mando.current.usar) mando.current = { ...mando.current, usar: false };
      const despues = motor.est;
      const jugador = motor.jugador;

      // [K-202] [K-401] La cuenta atrás, número a número.
      if (enCuenta) {
        const n = Math.ceil(motor.cuenta);
        if (n !== ultimaCuenta.current) {
          ultimaCuenta.current = n;
          if (n > 0) {
            setCuenta(String(n));
            sonido.tocar('cuenta');
          } else {
            setCuenta('¡YA!');
            sonido.tocar('salida');
            setTimeout(() => setCuenta(null), 900);
            // [K-203] Cómo ha salido.
            if (motor.salida === 'perfecta') {
              sonido.tocar('perfecta');
              avisar({ texto: '¡Salida perfecta!', color: VERDE });
            } else if (motor.salida === 'calada') {
              sonido.tocar('calada');
              avisar({ texto: '¡Te has calado!', color: ROJO });
            }
          }
        }
      }

      // [K-404] [K-502] Lo que ha pasado, a la pantalla y al altavoz.
      for (const s of sucesosEntre(antes, despues, jugador)) {
        if (s.tipo === 'adelantas') {
          // Dos barcas de lado cambian de orden a cada metro: un aviso cada
          // segundo y medio basta.
          if (ahora - ultimoAdelanto.current < 1500) continue;
          ultimoAdelanto.current = ahora;
        }
        sonido.tocar(SONIDO_DE[s.tipo]);
        if (s.tipo === 'objeto') {
          ruletaHasta.current = ahora + RULETA_MS;
          setGirando(true);
          setTimeout(() => setGirando(false), RULETA_MS);
        }
        const aviso = textoDe(s);
        if (aviso !== null) avisar(aviso);
      }
      if (ruleta && ahora - ultimoTic.current > 85) {
        ultimoTic.current = ahora;
        sonido.tocar('ruleta');
      }
      const nave = despues.naves[jugador];
      if (nave !== undefined) sonido.ambiente(dt, nave.tiempoMeta === null ? nave.velocidad * RITMO : 0, nave.gas);

      if (++desde.current >= 6) {
        desde.current = 0;
        setEst(despues);
      }
      if (motor.enMeta && !enMeta) {
        setEnMeta(true);
        setEst(despues);
        setTimeout(() => setTarjeta(true), META_MS);
      }
      return despues;
    },
    [motor, enMeta, sonido, avisar],
  );

  const cambiarMando = useCallback((m: MandoMotor) => {
    mando.current = m;
    setMandoVisible(m);
  }, []);

  const jugador = motor.jugador;
  const nave = est.naves[jugador];
  const final = motor.final;

  return (
    <div className="relative h-full w-full overflow-hidden bg-honda-900">
      <Lienzo
        inicial={motor.est}
        alFotograma={alFotograma}
        seguido={jugador}
        ritmo={RITMO}
        onDiagnostico={diagnosticoPedido ? setDiag : undefined}
      />

      <Tablero est={est} orden={motor.orden} jugador={jugador} girando={girando} ritmo={RITMO} />
      <Clasificacion est={est} orden={motor.orden} jugador={jugador} />
      <Avisos cuenta={cuenta} avisos={avisos} />
      {nave !== undefined && !enMeta && <Aliento nave={nave} ritmo={RITMO} />}
      {!enMeta && (
        <Mando valor={mandoVisible} onCambio={cambiarMando} puedeUsar={nave?.objeto != null && !girando} />
      )}

      {cuenta !== null && cuenta !== '¡YA!' && (
        <p className="pointer-events-none absolute inset-x-0 text-center text-[12px] text-tinta-500"
          style={{ bottom: 'calc(var(--safe-b) + 10rem)', textShadow: '0 1px 3px #000' }}>
          Pide <b>a tope</b> (▲ o ⛵) justo después del «2» para salir con racha. Antes, te calas.
          <br />
          En las curvas, aprieta el timón hacia la boya desde el carril de dentro para <b>ceñir</b> y ganar una racha.
        </p>
      )}

      <div className="absolute right-3 flex gap-2" style={{ top: 'calc(var(--safe-t) + 6.2rem)' }}>
        <button
          aria-label={callado ? 'Con sonido' : 'Sin sonido'}
          className="boton px-3 py-1 text-xs"
          onClick={() => {
            sonido.arrancar();
            sonido.silenciar(!callado);
            setCallado(!callado);
          }}
        >
          {callado ? '🔇' : '🔊'}
        </button>
        <button className="boton px-3 py-1 text-xs" onClick={onSalir}>
          dejarlo
        </button>
      </div>

      {/* [R-602] `?diagnostico=1` */}
      {diag !== null && (
        <p className="pointer-events-none absolute bottom-1 left-2 font-mono text-[10px] text-tinta-100">
          {diag.fps} fps · {diag.llamadas} llamadas · {Math.round(diag.triangulos / 1000)} k tri
          {diag.simplificado ? ' · CALIDAD REDUCIDA' : ''}
        </p>
      )}

      {tarjeta && final !== null && (
        <div className="absolute inset-0 grid place-items-center bg-honda-900/80 p-4 backdrop-blur-sm">
          <div className="tarjeta entrar grid w-full max-w-sm gap-3 p-5">
            <p className="text-xs font-semibold tracking-[0.3em] text-laton-500">META</p>
            <h2 className="texto-arcade text-5xl" style={{ color: final.posicion === 1 ? ORO : '#e8eef5' }}>
              {final.posicion}.º <span className="text-2xl">de {est.naves.length}</span>
            </h2>
            <ul className="grid gap-1 text-sm text-tinta-300">
              {/* [K-407] El tiempo que se enseña es el de juego. */}
              <li>Tiempo: {formatearTiempo(final.tiempo / RITMO)}</li>
              {final.diferencia > 0 && <li>A {(final.diferencia / RITMO).toFixed(2).replace('.', ',')} s del ganador</li>}
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
