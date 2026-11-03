const juegos = Array.from({ length: 12 }, (_, index) => `J${index + 1}`)

const juegoActual = 7

const puntos = {
  series1: 'bg-series1',
  series2: 'bg-series2',
  series3: 'bg-series3',
  series4: 'bg-series4',
}

const grupos = [
  {
    titulo: 'Saque',
    nota: '41 saques',
    eventos: [
      { desde: 1, hasta: 4, fila: 1, texto: 'Ace · 184 km/h', tono: 'series1' },
      { desde: 5, hasta: 11, fila: 2, texto: 'Racha de primeros saques · 9 de 10', tono: 'series2' },
    ],
  },
  {
    titulo: 'Peloteos',
    nota: '9.4 golpes por punto',
    eventos: [
      { desde: 2, hasta: 6, fila: 1, texto: 'Peloteo largo · 22 golpes', tono: 'series3' },
      { desde: 8, hasta: 11, fila: 2, texto: 'Mapa de calor', tono: 'series4' },
    ],
  },
]

function Evento({ desde, hasta, fila, texto, tono }) {
  return (
    <div
      style={{ gridColumn: `${desde} / ${hasta}`, gridRow: fila }}
      className="relative flex min-w-0 items-center gap-2 self-center rounded-full border border-line2 bg-surface2 px-3 py-2 text-xs text-text3"
    >
      <span className={`size-2 shrink-0 rounded-full ${puntos[tono]}`} />
      <span className="truncate">{texto}</span>
    </div>
  )
}

export default function HeroMock() {
  return (
    <div
      role="img"
      aria-label="Ejemplo de la línea de tiempo de un partido analizado por AceCam, con saques y peloteos marcados por juego"
      className="relative overflow-hidden rounded-t-[28px] border border-b-0 border-line2 bg-surface2 p-2 pb-0"
    >
      <p className="px-3 pb-2 text-right text-xs text-muted">Datos de ejemplo</p>

      <div className="overflow-hidden rounded-t-[22px] border border-b-0 border-line bg-surface">
        <div className="flex min-w-[44rem]">
          <div className="hidden w-48 shrink-0 border-r border-line md:block">
            <div className="flex h-12 items-center gap-2 border-b border-line px-4 text-sm font-medium text-text">
              <span className="size-2 rounded-full bg-accent-line" />
              Final · Set 1
            </div>
            {grupos.map((grupo) => (
              <div key={grupo.titulo} className="h-32 border-b border-line px-4 py-3 last:border-b-0">
                <p className="text-sm font-medium text-text">{grupo.titulo}</p>
                <p className="mt-0.5 text-xs text-muted">{grupo.nota}</p>
              </div>
            ))}
          </div>

          <div className="relative min-w-0 flex-1">
            <div className="grid h-12 grid-cols-12 items-center border-b border-line">
              {juegos.map((juego, index) => (
                <span key={juego} className="text-center font-display text-xs text-muted">
                  <span
                    className={
                      index + 1 === juegoActual
                        ? 'rounded-full bg-text px-2 py-0.5 font-semibold text-bg'
                        : ''
                    }
                  >
                    {juego}
                  </span>
                </span>
              ))}
            </div>

            <div className="pointer-events-none absolute inset-x-0 top-12 bottom-0 grid grid-cols-12">
              {juegos.map((juego) => (
                <span key={juego} className="border-r border-line last:border-r-0" />
              ))}
            </div>

            <span
              style={{ left: `${((juegoActual - 0.5) / juegos.length) * 100}%` }}
              className="absolute top-12 bottom-0 w-px bg-text"
            />

            {grupos.map((grupo) => (
              <div
                key={grupo.titulo}
                className="grid h-32 grid-cols-12 grid-rows-2 gap-x-1 border-b border-line px-1 last:border-b-0"
              >
                {grupo.eventos.map((evento) => (
                  <Evento key={evento.texto} {...evento} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
