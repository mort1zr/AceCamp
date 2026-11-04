import { useRef } from 'react'

const TILT_X = 18
const TILT_Y = 10

export default function MetalPill({ badge, children }) {
  const ref = useRef(null)

  const tilt = (event) => {
    if (event.pointerType !== 'mouse') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const rect = ref.current.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width - 0.5
    const y = (event.clientY - rect.top) / rect.height - 0.5
    ref.current.style.setProperty('--tilt-x', `${-y * TILT_X}deg`)
    ref.current.style.setProperty('--tilt-y', `${x * TILT_Y}deg`)
  }

  const reset = () => {
    ref.current.style.setProperty('--tilt-x', '0deg')
    ref.current.style.setProperty('--tilt-y', '0deg')
  }

  return (
    <p
      ref={ref}
      onPointerMove={tilt}
      onPointerLeave={reset}
      className="metal-edge rounded-full p-px shadow-tile transition-transform duration-300 ease-out [transform:perspective(700px)_rotateX(var(--tilt-x,0deg))_rotateY(var(--tilt-y,0deg))] [transform-style:preserve-3d]"
    >
      <span className="flex items-center gap-2 rounded-full bg-surface py-1 pr-4 pl-1 text-sm shadow-[inset_0_1px_0_var(--line3),inset_0_-2px_3px_rgb(0_0_0/0.3)] [transform-style:preserve-3d]">
        <span className="rounded-full bg-accent px-3 py-0.5 font-semibold text-on-accent shadow-[0_1px_2px_rgb(0_0_0/0.3)] [transform:translateZ(3px)]">
          {badge}
        </span>
        <span className="metal-text font-medium [transform:translateZ(2px)]">{children}</span>
      </span>
    </p>
  )
}
