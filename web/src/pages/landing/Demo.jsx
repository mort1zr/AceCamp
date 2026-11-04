import { useRef, useState } from 'react'
import Icon from '../../components/Icon.jsx'
import Reveal from '../../components/Reveal.jsx'
import Section from '../../components/Section.jsx'

const VIDEO = '/demo.mp4'

export default function Demo() {
  const videoRef = useRef(null)
  const [reproduciendo, setReproduciendo] = useState(false)

  const reproducir = () => {
    setReproduciendo(true)
    videoRef.current.play()
  }

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
              <>
                <video
                  ref={videoRef}
                  src={VIDEO}
                  poster="/demo-poster.jpg"
                  controls={reproduciendo}
                  playsInline
                  preload="none"
                  className="size-full object-cover"
                />
                {!reproduciendo && (
                  <button
                    type="button"
                    onClick={reproducir}
                    aria-label="Reproducir video"
                    className="group absolute inset-0 grid place-content-center"
                  >
                    <span className="grid size-20 place-content-center rounded-full bg-accent text-on-accent shadow-tile transition-transform group-hover:scale-110">
                      <Icon name="play" size={30} strokeWidth={2.2} />
                    </span>
                  </button>
                )}
              </>
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
