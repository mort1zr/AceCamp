import { useLayoutEffect, useState } from 'react'
import { Navigate, useOutletContext, useLocation, useNavigate } from 'react-router'
import { AuthHeader, Field, FormError } from '../components/AuthForm.jsx'
import Button from '../../compartido/components/Button.jsx'
import { useTextos } from '../../compartido/lib/idioma.jsx'
import { useAuth } from '../context/AuthContext.js'
import { authErrorMessage, validateLogin } from '../lib/auth.js'

const textos = {
  es: {
    titulo: 'Iniciar sesión',
    subtitulo: 'Entra para ver a tus jugadores y sus análisis.',
    correo: 'Correo',
    clave: 'Contraseña',
    boton: 'Iniciar sesión',
    cargando: 'Entrando…',
  },
  en: {
    titulo: 'Log in',
    subtitulo: 'Sign in to see your players and their analyses.',
    correo: 'Email',
    clave: 'Password',
    boton: 'Log in',
    cargando: 'Signing in…',
  },
}

export default function Login() {
  const t = useTextos(textos)
  const { user, profile, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [values, setValues] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const acceso = useOutletContext()
  const etiqueta = submitting ? t.cargando : t.boton

  useLayoutEffect(() => {
    acceso?.setBoton({ label: etiqueta, disabled: submitting })
  }, [acceso, etiqueta, submitting])

  // Vuelve a la página privada que pidió, o al Inicio.
  const destination = location.state?.from?.pathname ?? '/inicio'

  if (user && profile && !submitting) return <Navigate to={destination} replace />

  const change = event => setValues(current => ({ ...current, [event.target.name]: event.target.value }))

  async function submit(event) {
    event.preventDefault()
    const found = validateLogin(values)
    setErrors(found)
    setFormError('')
    if (Object.keys(found).length) return
    setSubmitting(true)
    try {
      await login(values)
      if (acceso?.entrar) await acceso.entrar(destination)
      else navigate(destination, { replace: true })
    } catch (error) {
      setFormError(authErrorMessage(error))
      setSubmitting(false)
    }
  }

  return (
    <>
      <AuthHeader
        title={t.titulo}
        subtitle={t.subtitulo}
      />
      <form id="acceso-form" className="grid gap-4" onSubmit={submit} noValidate>
        <FormError message={formError} />
        <Field id="email" label={t.correo} type="email" autoComplete="email" value={values.email} onChange={change} error={errors.email} />
        <Field id="password" label={t.clave} type="password" autoComplete="current-password" value={values.password} onChange={change} error={errors.password} />
        {acceso ? null : (
          <Button type="submit" size="lg" className="mt-2" disabled={submitting}>
            {etiqueta}
          </Button>
        )}
      </form>
    </>
  )
}
