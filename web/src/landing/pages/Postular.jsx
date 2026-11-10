import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { db } from '../../panel/lib/firebase.js'
import { requiresPlayerGuardian } from '../../panel/lib/players.js'
import { publicFormExists, submitPublicApplication } from '../../panel/lib/publicApplications.js'

const fields = [
  ['fullName', 'Nombre completo', 'text', { required: true, minLength: 2, maxLength: 120, autoComplete: 'name' }],
  ['birthDate', 'Fecha de nacimiento', 'date', { required: true, autoComplete: 'bday' }],
  ['city', 'Ciudad', 'text', { required: true, minLength: 2, maxLength: 100, autoComplete: 'address-level2' }],
  ['email', 'Correo de contacto', 'email', { required: true, maxLength: 254, autoComplete: 'email' }],
  ['graduationYear', 'Año de graduación', 'number', { required: true, min: 1900, max: 2100, step: 1 }],
  ['academy', 'Academia (opcional)', 'text', { maxLength: 120 }],
]
const guardianFields = [
  ['guardianName', 'Nombre del apoderado', 'text', { required: true, minLength: 2, maxLength: 120 }],
  ['guardianPhone', 'Teléfono del apoderado', 'tel', { required: true, minLength: 7, maxLength: 32 }],
  ['guardianEmail', 'Correo del apoderado', 'email', { required: true, maxLength: 254 }],
]
const inputClass = 'w-full rounded-lg border border-line bg-bg px-3 py-2 text-text'

function Field({ definition: [name, label, type, options], error, onChange }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold" htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} {...options} className={inputClass}
        onChange={onChange} aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : undefined} />
      {error && <p id={`${name}-error`} className="mt-1 text-sm">{error}</p>}
    </div>
  )
}

function Formulario({ orgId, formId }) {
  const [available, setAvailable] = useState(null)
  const [guardian, setGuardian] = useState(false)
  const [sending, setSending] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState({})
  const locked = useRef(false)

  useEffect(() => {
    let active = true
    publicFormExists(db, orgId, formId).then(
      (exists) => { if (active) setAvailable(exists) },
      () => { if (active) setAvailable(false) },
    )
    return () => { active = false }
  }, [orgId, formId])

  async function submit(event) {
    event.preventDefault()
    if (locked.current || !available) return
    const data = new FormData(event.currentTarget)
    const input = { ...Object.fromEntries(data), consentAccepted: data.has('consent') }
    locked.current = true
    setSending(true)
    setErrors({})
    setError('')
    try {
      await submitPublicApplication(db, { orgId, formId }, input)
      setSubmitted(true)
    } catch (failure) {
      setErrors(failure.fields ?? {})
      setError(failure.fields || failure.message === 'applications/invalid-contact'
        ? 'Revisa tus datos de contacto y confirma la autorización.'
        : 'No pudimos enviar la postulación. Comprueba tu conexión y que el enlace siga activo.')
    } finally {
      locked.current = false
      setSending(false)
    }
  }

  if (available == null) return <p role="status">Comprobando el enlace de postulación…</p>
  if (!available) return <p role="alert">Este enlace de postulación no está disponible. Pide un enlace activo a la organización.</p>
  if (submitted) return <p role="status">Recibimos tu postulación. La organización podrá revisarla y contactarte.</p>
  return (
    <form onSubmit={submit} aria-label="Formulario de postulación" aria-busy={sending}>
      <fieldset disabled={sending} className="grid gap-4 sm:grid-cols-2">
        {fields.map((definition) => (
          <Field key={definition[0]} definition={definition} error={errors[definition[0]]}
            onChange={definition[0] === 'birthDate'
              ? (e) => setGuardian(requiresPlayerGuardian(e.target.value, new Date().toISOString().slice(0, 10)))
              : undefined} />
        ))}
        {guardian && (
          <fieldset className="grid gap-3 rounded-lg border border-line p-3 sm:col-span-2">
            <legend className="px-1 text-sm font-semibold">Datos del apoderado</legend>
            {guardianFields.map((definition) => <Field key={definition[0]} definition={definition} error={errors[definition[0]]} />)}
          </fieldset>
        )}
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-semibold" htmlFor="message">Mensaje (opcional)</label>
          <textarea className={inputClass} id="message" name="message" maxLength={1000} rows={4} />
        </div>
        <div className="sm:col-span-2">
          <label className="flex gap-2">
            <input type="checkbox" name="consent" required aria-describedby="application-privacy" />
            <span>{guardian ? 'Soy el apoderado y autorizo' : 'Autorizo'} el uso de estos datos para evaluar la postulación y contactarme.</span>
          </label>
          <p id="application-privacy" className="mt-1 text-sm">
            Consulta la <Link className="underline" to="/privacidad" target="_blank" rel="noopener">Política de privacidad</Link>.
          </p>
        </div>
        <button className="rounded-lg bg-accent px-4 py-2 font-semibold text-bg sm:col-span-2" type="submit">
          {sending ? 'Enviando…' : 'Enviar postulación'}
        </button>
      </fieldset>
      {error && <p className="mt-3 text-sm" role="alert">{error}</p>}
    </form>
  )
}

export default function Postular() {
  const { orgId, formId } = useParams()
  return (
    <section className="mx-auto max-w-2xl px-4 py-12 text-text">
      <h1 className="mb-3 text-3xl font-bold">Postulación deportiva</h1>
      <p className="mb-6">Envía tus datos a la organización para que pueda evaluar tu postulación.</p>
      <Formulario key={JSON.stringify([orgId, formId])} orgId={orgId} formId={formId} />
    </section>
  )
}
