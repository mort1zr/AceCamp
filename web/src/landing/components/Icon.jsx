const paths = {
  serve:
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-6.4-2.6c3.4-1 5.6-4 5.6-7.4M18.4 5.6c-3.4 1-5.6 4-5.6 7.4',
  percent:
    'M19 5 5 19M7.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm9 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  fault: 'M6 6l12 12M18 6 6 18',
  racket: 'M14.5 3.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Zm-3.9 9.6L4 20',
  rally: 'M3 17h4l4-10h4m0 0-2.5-2.5M19 7l-2.5 2.5M21 17h-4',
  distance: 'M6 3v12a3 3 0 0 0 3 3h9m0 0-3-3m3 3-3 3M6 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  heatmap: 'M4 4h16v16H4zM4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16',
  upload: 'M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  ai: 'M9 3h6M9 21h6M3 9v6M21 9v6M7 7h10v10H7zM11 11h2v2h-2z',
  report: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zm0 0 5 5M9 13h6M9 17h4',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  close: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  play: 'M8 5.5v13l11-6.5z',
  arrow: 'M5 12h14m0 0-5.5-5.5M19 12l-5.5 5.5',
  arrowBack: 'M19 12H5m0 0 5.5-5.5M5 12l5.5 5.5',
  shield: 'M12 3 5 6v5.5c0 4.3 3 7.8 7 9.5 4-1.7 7-5.2 7-9.5V6zm-3.2 9 2.2 2.2 4.2-4.4',
  instagram:
    'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Zm5 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm5.5-9.5h.01',
  tiktok: 'M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.4 2.6 2.4 4.6 5 5',
  noCamera:
    'M3 3l18 18M8.5 5H15l1.5 2H19a2 2 0 0 1 2 2v8.5M17 19H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2M9.6 10.6a3 3 0 0 0 4 4',
}

export default function Icon({ name, size = 22, strokeWidth = 1.7, className = '' }) {
  const d = paths[name]
  if (!d) return null

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d={d}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
