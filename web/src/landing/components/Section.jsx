import Reveal from './Reveal.jsx'

export default function Section({
  id,
  title,
  lead,
  align = 'left',
  children,
}) {
  const centered = align === 'center'

  return (
    <section id={id} className="relative px-6 py-14 sm:py-20">
      <div className="mx-auto max-w-6xl">
        {title || lead ? (
          <Reveal className={`max-w-3xl ${centered ? 'mx-auto text-center' : ''}`}>
            {title ? <h2 className="text-4xl sm:text-5xl">{title}</h2> : null}
            {lead ? <p className="mt-4 text-lg text-text2">{lead}</p> : null}
          </Reveal>
        ) : null}
        {children}
      </div>
    </section>
  )
}
