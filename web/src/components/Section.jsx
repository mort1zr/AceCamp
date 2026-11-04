import Reveal from './Reveal.jsx'

export default function Section({
  id,
  eyebrow,
  title,
  lead,
  align = 'left',
  className = '',
  children,
}) {
  const centered = align === 'center'

  return (
    <section id={id} className={`border-t border-line px-6 py-16 sm:py-24 ${className}`}>
      <div className="mx-auto max-w-6xl">
        {eyebrow || title || lead ? (
          <Reveal className={`max-w-3xl ${centered ? 'mx-auto text-center' : ''}`}>
            {eyebrow ? (
              <p className="font-display text-xs font-semibold tracking-[0.22em] text-accent-ink uppercase">
                {eyebrow}
              </p>
            ) : null}
            {title ? <h2 className="mt-3 text-3xl sm:text-4xl">{title}</h2> : null}
            {lead ? <p className="mt-4 text-lg text-text2">{lead}</p> : null}
          </Reveal>
        ) : null}
        {children}
      </div>
    </section>
  )
}
