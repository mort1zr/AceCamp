import Button from '../components/Button.jsx'
import Logo from '../components/Logo.jsx'

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-content-center gap-6 bg-bg px-6 text-center text-text">
      <Logo className="justify-center" />
      <p className="font-display text-7xl leading-none font-bold text-line3">404</p>
      <h1 className="text-3xl">Esta página no existe</h1>
      <p className="mx-auto max-w-md text-text2">
        El enlace puede estar mal escrito o la pantalla todavía no está publicada.
      </p>
      <div className="flex justify-center">
        <Button to="/">Volver al inicio</Button>
      </div>
    </div>
  )
}
