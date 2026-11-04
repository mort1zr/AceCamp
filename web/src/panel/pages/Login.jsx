import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { AuthShell, Field, FormError } from '../components/AuthForm.jsx'
import Button from '../../compartido/components/Button.jsx'
import { useAuth } from '../context/AuthContext.js'
import { authErrorMessage, validateLogin } from '../lib/auth.js'

export default function Login() {
  const { user, profile, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [values, setValues] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

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
      navigate(destination, { replace: true })
    } catch (error) {
      setFormError(authErrorMessage(error))
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Iniciar sesión"
      subtitle="Entra para ver a tus jugadores y sus análisis."
      footer={
        <>
          ¿No tienes cuenta?{' '}
          <Link to="/registro" className="font-medium text-accent-ink hover:underline">
            Crear una cuenta
          </Link>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <FormError message={formError} />
        <Field id="email" label="Correo" type="email" autoComplete="email" value={values.email} onChange={change} error={errors.email} />
        <Field id="password" label="Contraseña" type="password" autoComplete="current-password" value={values.password} onChange={change} error={errors.password} />
        <Button type="submit" size="lg" className="mt-2" disabled={submitting}>
          {submitting ? 'Entrando…' : 'Iniciar sesión'}
        </Button>
      </form>
    </AuthShell>
  )
}
