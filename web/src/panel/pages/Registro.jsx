import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { AuthShell, Field, FormError } from '../components/AuthForm.jsx'
import Button from '../../compartido/components/Button.jsx'
import { useAuth } from '../context/AuthContext.js'
import { authErrorMessage, MIN_PASSWORD_LENGTH, validateRegistration } from '../lib/auth.js'

const EMPTY = { name: '', orgName: '', email: '', password: '', confirmPassword: '' }

export default function Registro() {
  const { user, profile, registerCoach } = useAuth()
  const navigate = useNavigate()
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user && profile && !submitting) return <Navigate to="/inicio" replace />

  const change = event => setValues(current => ({ ...current, [event.target.name]: event.target.value }))

  async function submit(event) {
    event.preventDefault()
    const found = validateRegistration(values)
    setErrors(found)
    setFormError('')
    if (Object.keys(found).length) return
    setSubmitting(true)
    try {
      await registerCoach(values)
      navigate('/inicio', { replace: true })
    } catch (error) {
      setFormError(authErrorMessage(error))
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Crear cuenta"
      subtitle="Registra a tu equipo o programa. Serás su entrenador principal."
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-medium text-accent-ink hover:underline">
            Iniciar sesión
          </Link>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <FormError message={formError} />
        <Field id="name" label="Nombre y apellido" autoComplete="name" value={values.name} onChange={change} error={errors.name} />
        <Field id="orgName" label="Organización" placeholder="Universidad, club o academia" autoComplete="organization" value={values.orgName} onChange={change} error={errors.orgName} />
        <Field id="email" label="Correo" type="email" autoComplete="email" value={values.email} onChange={change} error={errors.email} />
        <Field id="password" label="Contraseña" type="password" autoComplete="new-password" placeholder={`Al menos ${MIN_PASSWORD_LENGTH} caracteres`} value={values.password} onChange={change} error={errors.password} />
        <Field id="confirmPassword" label="Repite la contraseña" type="password" autoComplete="new-password" value={values.confirmPassword} onChange={change} error={errors.confirmPassword} />
        <Button type="submit" size="lg" className="mt-2" disabled={submitting}>
          {submitting ? 'Creando tu cuenta…' : 'Crear cuenta'}
        </Button>
      </form>
    </AuthShell>
  )
}
