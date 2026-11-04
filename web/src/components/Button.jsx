import { Link } from 'react-router'
import LinkDeslizante from './LinkDeslizante.jsx'

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

const variants = {
  primary: 'bg-accent text-on-accent hover:opacity-90',
  secondary: 'border border-line2 bg-surface text-text hover:border-line3 hover:bg-surface2',
  quiet: 'text-accent-ink hover:underline',
}

const sizes = {
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  to,
  href,
  desliza = false,
  className = '',
  children,
  ...props
}) {
  const classes = `${base} ${variants[variant]} ${sizes[size]} ${className}`

  if (to) {
    const Enlace = desliza ? LinkDeslizante : Link
    return (
      <Enlace to={to} className={classes} {...props}>
        {children}
      </Enlace>
    )
  }

  if (href) {
    return (
      <a href={href} className={classes} {...props}>
        {children}
      </a>
    )
  }

  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  )
}
