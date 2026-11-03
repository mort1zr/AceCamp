import Icon from '../../components/Icon.jsx'
import Reveal from '../../components/Reveal.jsx'
import Section from '../../components/Section.jsx'

const VIDEO = ''

export default function Demo() {
  return (
    <Section
      id="como-funciona"
      title={
        <>
          Así funciona <span className="text-accent-ink">AceCam</span>
        </>
      }
      lead="Sube tu partido, AceCam se encarga por ti."
      align="center"
    >
      <Reveal className="relative mx-auto mt-12 max-w-5xl">
        <span id="video-demo" aria-hidden="true" className="absolute -top-[120px]" />
        <div>
          <div className="relative aspect-video overflow-hidden rounded-[28px] border border-line2 bg-surface shadow-tile">
            {VIDEO ? (
              <video
                src={VIDEO}
                controls
                playsInline
                preload="metadata"
                className="size-full object-cover"
              />
            ) : (
              <div
                className="flex size-full flex-col items-center justify-center gap-5"
                style={{
                  backgroundImage: 'radial-gradient(var(--line2) 1px, transparent 1px)',
                  backgroundSize: '22px 22px',
                }}
              >
                <span className="grid size-20 place-content-center rounded-full bg-accent text-on-accent shadow-tile">
                  <Icon name="play" size={30} strokeWidth={2.2} />
                </span>
                <p className="font-display text-sm tracking-[0.18em] text-muted uppercase">
                  Video muy pronto
                </p>
              </div>
            )}
          </div>
        </div>
      </Reveal>
    </Section>
  )
}
