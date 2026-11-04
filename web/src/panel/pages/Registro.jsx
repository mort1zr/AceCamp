import { useLayoutEffect, useState } from 'react'
import { Navigate, useOutletContext, useNavigate } from 'react-router'
import { AuthHeader, Field, FormError } from '../components/AuthForm.jsx'
import Button from '../../compartido/components/Button.jsx'
import { useTextos } from '../../compartido/lib/idioma.jsx'
import { useAuth } from '../context/AuthContext.js'
import { authErrorMessage, MIN_PASSWORD_LENGTH, validateRegistration } from '../lib/auth.js'

const EMPTY = { name: '', orgName: '', email: '', password: '', confirmPassword: '' }

const textos = {
  es: {
    titulo: 'Crear cuenta',
    subtitulo: 'Registra a tu equipo o programa. Serás su entrenador principal.',
    nombre: 'Nombre y apellido',
    organizacion: 'Organización',
    ejemploOrganizacion: 'Universidad, club o academia',
    correo: 'Correo',
    clave: 'Contraseña',
    minimo: (n) => `Al menos ${n} caracteres`,
    repetir: 'Repite la contraseña',
    boton: 'Crear cuenta',
    cargando: 'Creando tu cuenta…',
  },
  en: {
    titulo: 'Sign up',
    subtitulo: 'Register your team or program. You will be its head coach.',
    nombre: 'Full name',
    organizacion: 'Organization',
    ejemploOrganizacion: 'University, club or academy',
    correo: 'Email',
    clave: 'Password',
    minimo: (n) => `At least ${n} characters`,
    repetir: 'Repeat the password',
    boton: 'Sign up',
    cargando: 'Creating your account…',
  },
}

export default function Registro() {
  const t = useTextos(textos)
  const { user, profile, registerCoach } = useAuth()
  const navigate = useNavigate()
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const acceso = useOutletContext()
  const etiqueta = submitting ? t.cargando : t.boton

  useLayoutEffect(() => {
    acceso?.setBoton({ label: etiqueta, disabled: submitting })
  }, [acceso, etiqueta, submitting])

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
    <>
      <AuthHeader
        compacto
        title={t.titulo}
        subtitle={t.subtitulo}
      />
      <form id="acceso-form" className="grid gap-3" onSubmit={submit} noValidate>
        <FormError message={formError} />
        <Field compacto id="name" label={t.nombre} autoComplete="name" value={values.name} onChange={change} error={errors.name} />
        <Field compacto id="orgName" label={t.organizacion} placeholder={t.ejemploOrganizacion} autoComplete="organization" value={values.orgName} onChange={change} error={errors.orgName} />
        <Field compacto id="email" label={t.correo} type="email" autoComplete="email" value={values.email} onChange={change} error={errors.email} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field compacto id="password" label={t.clave} type="password" autoComplete="new-password" placeholder={t.minimo(MIN_PASSWORD_LENGTH)} value={values.password} onChange={change} error={errors.password} />
          <Field compacto id="confirmPassword" label={t.repetir} type="password" autoComplete="new-password" value={values.confirmPassword} onChange={change} error={errors.confirmPassword} />
        </div>
        {acceso ? null : (
          <Button type="submit" size="lg" className="mt-2" disabled={submitting}>
            {etiqueta}
          </Button>
        )}
      </form>
    </>
  )
}
