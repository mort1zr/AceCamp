import { useLayoutEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useOutletContext, useSearchParams } from 'react-router'
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
    subtituloInvitacion: 'Te invitaron a un equipo. Crea tu cuenta con el correo invitado para unirte.',
    nombre: 'Nombre y apellido',
    organizacion: 'Organización',
    ejemploOrganizacion: 'Universidad, club o academia',
    correo: 'Correo',
    clave: 'Contraseña',
    minimo: (n) => `Al menos ${n} caracteres`,
    repetir: 'Repite la contraseña',
    boton: 'Crear cuenta',
    cargando: 'Creando tu cuenta…',
    aceptas: 'Al crear tu cuenta aceptas los',
    terminos: 'Términos de uso',
    y: 'y la',
    privacidad: 'Política de privacidad',
  },
  en: {
    titulo: 'Sign up',
    subtitulo: 'Register your team or program. You will be its head coach.',
    subtituloInvitacion: 'You were invited to a team. Sign up with the invited email to join.',
    nombre: 'Full name',
    organizacion: 'Organization',
    ejemploOrganizacion: 'University, club or academy',
    correo: 'Email',
    clave: 'Password',
    minimo: (n) => `At least ${n} characters`,
    repetir: 'Repeat the password',
    boton: 'Sign up',
    cargando: 'Creating your account…',
    aceptas: 'By signing up you accept the',
    terminos: 'Terms of use',
    y: 'and the',
    privacidad: 'Privacy policy',
  },
}

export default function Registro() {
  const t = useTextos(textos)
  const { user, profile, registerCoach } = useAuth()
  const navigate = useNavigate()
  // PCIT-40: el enlace de invitación trae el correo y no pide organización.
  const [parametros] = useSearchParams()
  const correoInvitado = parametros.get('invitacion')?.trim() ?? ''
  const invited = Boolean(correoInvitado)
  const [values, setValues] = useState(() => ({ ...EMPTY, email: correoInvitado }))
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const acceso = useOutletContext()
  const from = useLocation().state?.from
  const destino = from ? `${from.pathname}${from.search ?? ''}` : '/inicio'
  const etiqueta = submitting ? t.cargando : t.boton

  useLayoutEffect(() => {
    acceso?.setBoton({ label: etiqueta, disabled: submitting })
  }, [acceso, etiqueta, submitting])

  if (user && profile && !submitting) return <Navigate to={destino} replace />

  const change = event => setValues(current => ({ ...current, [event.target.name]: event.target.value }))

  async function submit(event) {
    event.preventDefault()
    const found = validateRegistration({ ...values, invited })
    setErrors(found)
    setFormError('')
    if (Object.keys(found).length) return
    setSubmitting(true)
    try {
      await registerCoach({ ...values, invited })
      if (acceso?.entrar) await acceso.entrar(destino)
      else navigate(destino, { replace: true })
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
        subtitle={invited ? t.subtituloInvitacion : t.subtitulo}
      />
      <form id="acceso-form" className="grid gap-3" onSubmit={submit} noValidate>
        <FormError message={formError} />
        <Field compacto id="name" label={t.nombre} autoComplete="name" value={values.name} onChange={change} error={errors.name} />
        {invited ? null : (
          <Field compacto id="orgName" label={t.organizacion} placeholder={t.ejemploOrganizacion} autoComplete="organization" value={values.orgName} onChange={change} error={errors.orgName} />
        )}
        <Field compacto id="email" label={t.correo} type="email" autoComplete="email" value={values.email} onChange={change} error={errors.email} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field compacto id="password" label={t.clave} type="password" autoComplete="new-password" placeholder={t.minimo(MIN_PASSWORD_LENGTH)} value={values.password} onChange={change} error={errors.password} />
          <Field compacto id="confirmPassword" label={t.repetir} type="password" autoComplete="new-password" value={values.confirmPassword} onChange={change} error={errors.confirmPassword} />
        </div>
        <p className="text-xs text-muted">
          {t.aceptas}{' '}
          <Link to="/terminos" className="font-medium text-text2 underline underline-offset-2 hover:text-text">
            {t.terminos}
          </Link>{' '}
          {t.y}{' '}
          <Link to="/privacidad" className="font-medium text-text2 underline underline-offset-2 hover:text-text">
            {t.privacidad}
          </Link>
          .
        </p>
        {acceso ? null : (
          <Button type="submit" size="lg" className="mt-2" disabled={submitting}>
            {etiqueta}
          </Button>
        )}
      </form>
    </>
  )
}
