// [K-401] [K-404] Lo que salta en el centro de la pantalla: la cuenta atrás y
// los avisos de la regata. No decide nada: le llegan ya calculados.

export interface Aviso {
  id: number;
  texto: string;
  color: string;
  grande?: boolean;
}

interface Props {
  /** [K-202] Número de la cuenta atrás, o `'¡YA!'`, o `null` si no hay cuenta. */
  cuenta: string | null;
  avisos: Aviso[];
}

export default function Avisos({ cuenta, avisos }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <div className="flex flex-col items-center gap-2" style={{ marginTop: '-18vh' }}>
        {cuenta !== null && (
          <p
            key={cuenta}
            className="cuenta texto-arcade leading-none"
            style={{ fontSize: 'min(28vw, 11rem)', color: cuenta === '¡YA!' ? 'var(--color-bien)' : 'var(--color-laton-600)' }}
          >
            {cuenta}
          </p>
        )}
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
