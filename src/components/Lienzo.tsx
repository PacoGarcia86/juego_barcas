// El lienzo de WebGL y el bucle de fotograma. Es el único componente que
// conoce `Vista`, y solo le pasa estado: no calcula regata [R-6xx].

import { useEffect, useRef } from 'react';
import type { EstadoRegata } from '../engine/tipos.ts';
import { Vista, type Diagnostico } from '../render/tresd/vista.ts';

interface Props {
  /** Se llama en cada fotograma con el tiempo real transcurrido. */
  alFotograma: (dt: number) => EstadoRegata;
  inicial: EstadoRegata;
  seguido: number;
  onDiagnostico?: (d: Diagnostico) => void;
}

export default function Lienzo({ alFotograma, inicial, seguido, onDiagnostico }: Props) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  // Las funciones se leen por referencia para que el bucle no se reinicie en
  // cada render de React: un bucle que se reinicia pierde el acumulador y con
  // él el paso fijo [R-601].
  const fotograma = useRef(alFotograma);
  fotograma.current = alFotograma;
  const diag = useRef(onDiagnostico);
  diag.current = onDiagnostico;
  const seguidoRef = useRef(seguido);
  seguidoRef.current = seguido;

  useEffect(() => {
    const elemento = lienzo.current;
    if (elemento === null) return;

    let vista: Vista;
    try {
      vista = new Vista(elemento, inicial);
    } catch {
      // Sin WebGL 2 no hay juego en 3D, pero tampoco pantalla en blanco.
      const aviso = document.createElement('p');
      aviso.textContent = 'Este navegador no puede dibujar el agua: le falta WebGL 2.';
      aviso.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;padding:2rem;text-align:center';
      elemento.parentElement?.appendChild(aviso);
      return;
    }

    const medir = (): void => {
      const padre = elemento.parentElement;
      if (padre !== null) vista.redimensionar(padre.clientWidth, padre.clientHeight);
    };
    medir();
    const observador = new ResizeObserver(medir);
    if (elemento.parentElement !== null) observador.observe(elemento.parentElement);

    let anterior = performance.now();
    let vivo = true;
    let contador = 0;

    const bucle = (ahora: number): void => {
      if (!vivo) return;
      const dt = Math.min(0.1, (ahora - anterior) / 1000);
      anterior = ahora;
      const est = fotograma.current(dt);
      vista.dibujar(est, dt, seguidoRef.current);
      if (diag.current !== undefined && ++contador % 15 === 0) diag.current(vista.diagnostico());
      requestAnimationFrame(bucle);
    };
    requestAnimationFrame(bucle);

    return () => {
      vivo = false;
      observador.disconnect();
      vista.destruir();
    };
    // `inicial` es el estado de arranque: montar la vista otra vez al cambiar
    // el estado sería reconstruir el mundo sesenta veces por segundo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={lienzo} className="block h-full w-full" />;
}
