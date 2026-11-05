import { Link } from 'react-router'
import LinkDeslizante from './LinkDeslizante.jsx'

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

const primary = 'bg-accent text-on-accent hover:opacity-90'

const sizes = {
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
}

export default function Button({
  size = 'md',
  to,
  desliza = false,
  className = '',
  children,
  ...props
}) {
  const classes = `${base} ${primary} ${sizes[size]} ${className}`

  if (to) {
    const Enlace = desliza ? LinkDeslizante : Link
    return (
      <Enlace to={to} className={classes} {...props}>
        {children}
      </Enlace>
    )
  }

  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  )
}
