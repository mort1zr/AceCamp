import { Link } from 'react-router'

function Bloque({ contenido }) {
  if (Array.isArray(contenido)) {
    return (
      <ul className="grid list-disc gap-2 pl-5 marker:text-accent-ink">
        {contenido.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    )
  }
  return <p>{contenido}</p>
}

export default function PaginaLegal({ t }) {
  return (
    <article className="mx-auto max-w-6xl px-5 pt-10 pb-20 sm:px-6 sm:pt-16 sm:pb-28">
      <header className="max-w-3xl">
        <h1 className="text-[2.5rem] leading-none sm:text-6xl">{t.titulo}</h1>
        <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
          <span className="rounded-full border border-line2 px-2.5 py-0.5 text-xs font-semibold text-text2">
            {t.borrador}
          </span>
          {t.actualizado}
        </p>
        <p className="mt-6 max-w-[65ch] text-lg text-text2">{t.intro}</p>
      </header>

      <div className="mt-12 lg:mt-16 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-16">
        <nav aria-label={t.indice} className="hidden lg:block">
          <div className="sticky top-24">
            <p className="text-sm font-semibold text-text">{t.indice}</p>
            <ol className="mt-3 grid gap-2 border-l border-line text-sm">
              {t.secciones.map((seccion) => (
                <li key={seccion.id}>
                  <a
                    href={`#${seccion.id}`}
                    className="-ml-px block border-l border-transparent pl-4 text-muted transition-colors hover:border-accent-line hover:text-text"
                  >
                    {seccion.titulo}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <div className="max-w-[68ch]">
          {t.secciones.map((seccion) => (
            <section
              key={seccion.id}
              id={seccion.id}
              className="border-t border-line pt-8 pb-10 first:border-t-0 first:pt-0"
            >
              <h2 className="text-2xl sm:text-3xl">{seccion.titulo}</h2>
              <div className="mt-4 grid gap-4 leading-relaxed text-text2">
                {seccion.contenido.map((bloque, indice) => (
                  <Bloque key={indice} contenido={bloque} />
                ))}
              </div>
            </section>
          ))}

          <p className="border-t border-line pt-8 text-text2">
            {t.otra.texto}{' '}
            <Link
              to={t.otra.to}
              className="font-semibold text-accent-ink underline decoration-accent-line/40 underline-offset-4 hover:decoration-accent-line"
            >
              {t.otra.enlace}
            </Link>
            .
          </p>
        </div>
      </div>
    </article>
  )
}
