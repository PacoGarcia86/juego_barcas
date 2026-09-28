// [V-304] Los anuncios grandes del centro de la pantalla: vuelta, última
// vuelta y meta. La cuenta atrás es de `Cuenta` y los adelantamientos y golpes,
// de `Avisos` (`K-302`, `K-303`). No decide nada: le llegan ya calculados.

export interface Anuncio {
  id: number;
  texto: string;
  color: string;
  grande?: boolean;
}

interface Props {
  avisos: Anuncio[];
}

export default function Anuncios({ avisos }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <div className="flex flex-col items-center gap-2" style={{ marginTop: '-18vh' }}>
        {avisos.map((a) => (
          <p
            key={a.id}
            className={`aviso texto-arcade text-center leading-none ${a.grande === true ? 'text-5xl sm:text-6xl' : 'text-3xl sm:text-4xl'}`}
            style={{ color: a.color }}
          >
            {a.texto}
          </p>
        ))}
      </div>
    </div>
  );
}
