import { Link } from 'react-router'
import Logo from '../components/Logo.jsx'

export default function Registro() {
  return (
    <div className="grid min-h-dvh place-content-center gap-6 bg-bg px-6 text-center text-text">
      <Link to="/" className="justify-self-center" aria-label="AceCam, ir al inicio">
        <Logo />
      </Link>
      <h1 className="text-3xl">Crear cuenta</h1>
      <p className="mx-auto max-w-md text-text2">
        El registro con Firebase Auth lo conecta el equipo en PCIT-21.
      </p>
      <Link to="/login" className="text-sm text-accent-ink hover:underline">
        Ya tengo cuenta
      </Link>
    </div>
  )
}
