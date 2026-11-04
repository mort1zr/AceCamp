export const AVATARES = [
  { fondo: '#8FD49C', tinta: 'var(--on-accent)' },
  {
    fondo: 'var(--accent)',
    tinta: 'var(--on-accent)',
    dibujo: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M5.6 6.6c3 2.6 3 8.2 0 10.8M18.4 6.6c-3 2.6-3 8.2 0 10.8" />
      </>
    ),
  },
  {
    fondo: 'var(--electric)',
    tinta: 'var(--on-accent)',
    dibujo: (
      <>
        <ellipse cx="10" cy="9.5" rx="5.5" ry="6.5" transform="rotate(-40 10 9.5)" />
        <path d="M7.5 7l5 5M10 5.2l4.8 4.8M6 9.5l4.6 4.6M14 13.5l6 6" />
      </>
    ),
  },
  {
    fondo: 'var(--series2)',
    tinta: 'var(--on-accent)',
    dibujo: (
      <>
        <rect x="6" y="3.5" width="12" height="17" rx="1" />
        <path d="M4.5 12h15M8.5 3.5v17M15.5 3.5v17M8.5 8h7M8.5 16h7M12 8v8" />
      </>
    ),
  },
  {
    fondo: 'var(--series3)',
    tinta: 'var(--on-accent)',
    dibujo: (
      <>
        <path d="M8 4h8v5a4 4 0 01-8 0V4z" />
        <path d="M8 6H5.5a2.5 2.5 0 002.7 3M16 6h2.5a2.5 2.5 0 01-2.7 3M12 13v4M8.5 20h7M10 17h4" />
      </>
    ),
  },
  {
    fondo: 'var(--series4)',
    tinta: 'var(--on-accent)',
    dibujo: <path d="M13.5 3L6 13.5h5.5L10 21l8-11h-5.5L13.5 3z" />,
  },
]
