import { useId } from 'react'

const SILUETA = '#16130f'
const BRILLO = 'rgb(255 255 255 / 0.22)'

const ESTILOS = [
  { peinado: 'ondas', cuello: 'polo', hombros: 0, vincha: '#c8452c' },
  { peinado: 'corto', cuello: 'redondo', hombros: 6, vincha: '#4fe3ff' },
  { peinado: 'largo', cuello: 'polo', hombros: 3, vincha: '#d7f25c' },
  { peinado: 'federer', cuello: 'v', hombros: -3, vincha: '#f3f2ee' },
  { peinado: 'rizado', cuello: 'redondo', hombros: 4, vincha: '#9b6fd6' },
  { peinado: 'corto', cuello: 'v', hombros: 1, vincha: '#2f7a3f' },
]

const PEINADOS = {
  federer:
    'M66 74C58 52 68 30 88 25C92 20 100 18 106 21C114 18 124 22 128 30C138 36 142 50 139 66C141 80 139 94 132 104C131 92 128 82 123 75C120 64 113 56 103 54C93 53 85 56 80 62C76 72 74 84 75 98C69 92 65 84 66 74ZM90 27C94 22 101 21 106 24C101 25 97 28 95 32ZM108 25C114 22 121 24 125 29C119 28 114 29 111 32Z',
  corto:
    'M70 66C66 40 82 24 101 24C121 24 136 38 132 64C127 52 118 46 108 46C98 48 86 48 78 46C74 52 71 58 70 66Z',
  ondas:
    'M68 70C60 44 76 20 99 21C110 15 125 19 131 30C141 36 142 54 134 70C131 58 125 50 117 48C112 42 104 42 98 45C90 42 82 46 78 52C72 56 69 62 68 70Z',
  rapado: 'M74 60C74 40 86 30 101 30S128 40 128 60C122 50 112 46 101 46S80 50 74 60Z',
  largo:
    'M66 70C60 40 78 22 101 22C124 22 142 40 136 70C138 86 136 102 130 114L124 82C122 64 113 54 101 54S80 64 78 82L72 114C66 102 64 86 66 70Z',
  rizado:
    'M64 66C56 56 62 40 72 38C72 26 86 18 97 24C104 16 120 18 123 28C134 26 144 36 140 48C148 56 144 68 136 72C132 58 122 50 110 48C100 52 88 52 78 48C72 52 67 58 64 66Z',
}

const CUELLOS = {
  polo: (
    <>
      <path d="M84 116L100 134L92 142L78 124" />
      <path d="M116 116L100 134L108 142L122 124" />
      <path d="M100 134V170" />
    </>
  ),
  redondo: <path d="M82 118C88 128 112 128 118 118" />,
  v: <path d="M84 116L100 140L116 116" />,
}

export default function AvatarTenista({ indice = 0, className = '' }) {
  const id = useId().replace(/[^a-zA-Z0-9-]/g, '')
  const e = ESTILOS[((indice % ESTILOS.length) + ESTILOS.length) % ESTILOS.length]
  const h = e.hombros
  return (
    <svg viewBox="0 0 200 230" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-cuerpo`} x1="0" y1="0" x2="1" y2="0.3">
          <stop offset="0" stopColor="#2b251f" />
          <stop offset="0.45" stopColor={SILUETA} />
          <stop offset="1" stopColor="#0d0b09" />
        </linearGradient>
        <radialGradient id={`${id}-cara`} cx="0.36" cy="0.42" r="0.7">
          <stop offset="0" stopColor="#2e2822" />
          <stop offset="0.6" stopColor={SILUETA} />
          <stop offset="1" stopColor="#0d0b09" />
        </radialGradient>
        <linearGradient id={`${id}-cuello`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b0907" />
          <stop offset="0.5" stopColor={SILUETA} />
        </linearGradient>
      </defs>
      <path
        d={`M${10 - h} 230C${8 - h} 182 ${14 - h} 144 ${40 - h} 131C56 125 70 122 80 118C82 112 82 104 82 98H118C118 104 118 112 120 118C130 122 144 125 ${160 + h} 131C${186 + h} 144 ${192 + h} 182 ${190 + h} 230Z`}
        fill={`url(#${id}-cuerpo)`}
        stroke="rgb(255 255 255 / 0.1)"
        strokeWidth="1"
      />
      <path
        d="M82 98H118C118 106 118 112 120 118C110 122 90 122 80 118C82 112 82 106 82 98Z"
        fill={`url(#${id}-cuello)`}
      />
      <g transform="translate(100 112) scale(1.16) translate(-100 -112)">
        <ellipse cx="73" cy="72" rx="6" ry="10" fill={SILUETA} />
        <ellipse cx="127" cy="72" rx="6" ry="10" fill={SILUETA} />
        <path
          d="M74 64C74 40 86 30 100 30S126 40 126 64C126 77 124 87 120 95C116 103 110 109 104 111C101 112 99 112 96 111C90 109 84 103 80 95C76 87 74 77 74 64Z"
          fill={`url(#${id}-cara)`}
        />
        <path d={PEINADOS[e.peinado]} fill={SILUETA} />
        <path
          d="M73 58C82 54 92 52 101 52S120 54 128 58L127 66C119 62 110 61 101 61S83 62 74 66Z"
          fill={e.vincha}
        />
        <path d="M126 59C136 61 143 68 145 78C139 74 133 72 127 71Z" fill={e.vincha} />
        <path
          d="M127 64C135 70 139 78 138 87C134 81 130 77 125 75Z"
          fill={e.vincha}
          opacity="0.85"
        />
      </g>
      <g fill="none" stroke={BRILLO} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {CUELLOS[e.cuello]}
        <path d={`M${44 - h} 160C${46 - h} 186 ${48 - h} 210 ${50 - h} 230`} />
        <path d={`M${156 + h} 160C${154 + h} 186 ${152 + h} 210 ${150 + h} 230`} />
        <path d={`M${60 - h} 140C${66 - h} 146 ${70 - h} 152 ${72 - h} 160`} />
        <path d={`M${140 + h} 140C${134 + h} 146 ${130 + h} 152 ${128 + h} 160`} />
        <path d="M83 104C86 110 88 116 87 122" />
        <path d="M117 104C114 110 112 116 113 122" />
        <path d="M96 116C98 118 102 118 104 116" />
        <path d={`M${64 - h} 160C${80 - h} 168 92 170 100 170C108 170 120 168 ${136 + h} 160`} />
      </g>
    </svg>
  )
}
