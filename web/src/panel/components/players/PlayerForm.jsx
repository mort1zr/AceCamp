import { useEffect, useId, useRef, useState } from 'react'
import { playersErrorMessage, requiresPlayerGuardian, validatePlayer } from '../../lib/players.js'
import { BACKHANDS, DOMINANT_HANDS, PLAYER_CATEGORIES } from '../../lib/schema.js'

const sportFields = [
  { name: 'category', label: 'Categoría', options: PLAYER_CATEGORIES },
  { name: 'dominantHand', label: 'Mano dominante', options: DOMINANT_HANDS },
  { name: 'backhand', label: 'Revés', options: BACKHANDS },
  { name: 'utr', label: 'UTR', type: 'number', step: 'any' },
  { name: 'nationalRanking', label: 'Ranking nacional', type: 'number' },
  { name: 'nationality', label: 'Nacionalidad', maxLength: 60 },
  { name: 'graduationYear', label: 'Año de graduación', type: 'number' },
  { name: 'coachName', label: 'Entrenador en su academia', maxLength: 120 },
]

const guardianFields = [
  { name: 'guardianName', label: 'Nombre del apoderado', type: 'text', maxLength: 120 },
  { name: 'guardianPhone', label: 'Teléfono del apoderado', type: 'tel', maxLength: 32 },
  { name: 'guardianEmail', label: 'Correo del apoderado', type: 'email', maxLength: 254 },
]

export default function PlayerForm({ service, onCancel, onCreated, initialPlayer, initialValues = initialPlayer }) {
  const id = useId()
  const nameRef = useRef(null)
  const active = useRef(false)
  const submitting = useRef(false)
  const original = useRef(initialPlayer)
  const editing = Boolean(initialPlayer)
  const [values, setValues] = useState(() => ({
    fullName: initialValues?.fullName ?? '', birthDate: initialValues?.birthDate ?? '', academy: initialValues?.academy ?? '',
    guardianName: initialValues?.guardian?.name ?? '', guardianPhone: initialValues?.guardian?.phone ?? '', guardianEmail: initialValues?.guardian?.email ?? '', consentAccepted: editing,
    ...Object.fromEntries(sportFields.map(field => [field.name, initialValues?.[field.name] ?? ''])),
  }))
  const [errors, setErrors] = useState({})
  const [saveError, setSaveError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    active.current = true
    nameRef.current?.focus()
    return () => { active.current = false }
  }, [])

  const update = event => {
    const { name, value, type, checked } = event.target
    setValues(previous => {
      const next = { ...previous, [name]: type === 'checkbox' ? checked : value }
      if (name === 'birthDate') {
        const needsGuardian = requiresPlayerGuardian(value)
        if (!needsGuardian) for (const field of guardianFields) next[field.name] = ''
        if (needsGuardian !== requiresPlayerGuardian(previous.birthDate)) next.consentAccepted = editing
      }
      return next
    })
    setErrors(previous => {
      const next = { ...previous, [name]: undefined }
      if (name === 'birthDate') for (const field of guardianFields) delete next[field.name]
      return next
    })
  }

  async function submit(event) {
    event.preventDefault()
    if (submitting.current) return
    const validation = validatePlayer(values)
    setErrors(validation)
    if (Object.keys(validation).length) {
      event.currentTarget.elements.namedItem(Object.keys(validation)[0])?.focus()
      return
    }
    submitting.current = true
    setSaving(true)
    setSaveError(null)
    try {
      const player = editing ? await service.update(original.current, values) : await service.create(values)
      if (active.current) onCreated(player)
    } catch (error) {
      if (active.current) setSaveError(playersErrorMessage(error, editing ? 'update' : 'create'))
    } finally {
      submitting.current = false
      if (active.current) setSaving(false)
    }
  }

  return (
    <section className="players-form-panel" aria-labelledby={`${id}-title`}>
      <div className="players-form-heading"><div><p className="players-eyebrow">{editing ? 'Ficha del jugador' : 'Un nuevo comienzo'}</p><h2 id={`${id}-title`}>{editing ? 'Editar jugador' : 'Registrar jugador'}</h2><p>{editing ? 'Actualiza sus datos personales y deportivos.' : 'Agrega sus datos básicos para comenzar el seguimiento.'}</p></div><span className="players-required-note">* Campos obligatorios</span></div>
      <form onSubmit={submit} noValidate aria-label={editing ? 'Editar jugador' : 'Registrar jugador'} aria-busy={saving}>
        <fieldset disabled={saving} className="players-form-fields">
          <div className="players-form-grid">
            <div className="players-field players-field-wide">
              <label htmlFor={`${id}-name`}>Nombre completo *</label>
              <input ref={nameRef} id={`${id}-name`} name="fullName" autoComplete="off" maxLength={120} required value={values.fullName} onChange={update} aria-invalid={Boolean(errors.fullName)} aria-describedby={errors.fullName ? `${id}-name-error` : undefined} placeholder="Nombre y apellidos" />
              {errors.fullName && <p className="players-field-error" id={`${id}-name-error`}>{errors.fullName}</p>}
            </div>
            <div className="players-field">
              <label htmlFor={`${id}-birth`}>Fecha de nacimiento *</label>
              <input id={`${id}-birth`} name="birthDate" type="date" required value={values.birthDate} onChange={update} aria-invalid={Boolean(errors.birthDate)} aria-describedby={errors.birthDate ? `${id}-birth-error` : undefined} />
              {errors.birthDate && <p className="players-field-error" id={`${id}-birth-error`}>{errors.birthDate}</p>}
            </div>
            <div className="players-field">
              <label htmlFor={`${id}-academy`}>Academia <span>(opcional)</span></label>
              <input id={`${id}-academy`} name="academy" maxLength={120} value={values.academy} onChange={update} aria-invalid={Boolean(errors.academy)} aria-describedby={errors.academy ? `${id}-academy-error` : undefined} placeholder="Academia o club" />
              {errors.academy && <p className="players-field-error" id={`${id}-academy-error`}>{errors.academy}</p>}
            </div>
          </div>
          <fieldset className="players-form-fields"><legend>Datos deportivos y personales opcionales</legend>
            <div className="players-form-grid">{sportFields.map(field => <div className="players-field" key={field.name}>
              <label htmlFor={`${id}-${field.name}`}>{field.label}</label>
              {field.options ? <select id={`${id}-${field.name}`} name={field.name} value={values[field.name]} onChange={update} aria-invalid={Boolean(errors[field.name])} aria-describedby={errors[field.name] ? `${id}-${field.name}-error` : undefined}><option value="">Sin registrar</option>{field.options.map(option => <option key={option} value={option}>{option}</option>)}</select>
                : <input id={`${id}-${field.name}`} name={field.name} type={field.type ?? 'text'} step={field.step ?? 1} maxLength={field.maxLength} value={values[field.name]} onChange={update} aria-invalid={Boolean(errors[field.name])} aria-describedby={errors[field.name] ? `${id}-${field.name}-error` : undefined} />}
              {errors[field.name] && <p className="players-field-error" id={`${id}-${field.name}-error`}>{errors[field.name]}</p>}
            </div>)}</div>
          </fieldset>
          {requiresPlayerGuardian(values.birthDate) && (
            <fieldset className="players-guardian players-form-fields">
              <legend>Datos del apoderado</legend>
              <div className="players-form-grid">
                {guardianFields.map(({ name, label, type, maxLength }) => (
                  <div className={name === 'guardianName' ? 'players-field players-field-wide' : 'players-field'} key={name}>
                    <label htmlFor={`${id}-${name}`}>{label} *</label>
                    <input
                      id={`${id}-${name}`} name={name} type={type} maxLength={maxLength}
                      autoComplete="off" required value={values[name]} onChange={update}
                      aria-invalid={Boolean(errors[name])}
                      aria-describedby={errors[name] ? `${id}-${name}-error` : undefined}
                    />
                    {errors[name] && <p className="players-field-error" id={`${id}-${name}-error`}>{errors[name]}</p>}
                  </div>
                ))}
              </div>
            </fieldset>
          )}
          {editing ? <p className="text-sm text-muted">Se conserva la autorización registrada originalmente.</p> : <div className="players-consent">
            <label htmlFor={`${id}-consent`}><input id={`${id}-consent`} name="consentAccepted" type="checkbox" checked={values.consentAccepted} onChange={update} required aria-invalid={Boolean(errors.consentAccepted)} aria-describedby={`${id}-consent-note${errors.consentAccepted ? ` ${id}-consent-error` : ''}`} /><span>Confirmo que el jugador o su apoderado ha sido informado y autorizó el registro de sus datos para el seguimiento deportivo. *</span></label>
            <p id={`${id}-consent-note`}>La autorización es obligatoria. El registro guardará quién la confirmó y cuándo.</p>
            {errors.consentAccepted && <p className="players-field-error" id={`${id}-consent-error`}>{errors.consentAccepted}</p>}
          </div>}
          {saveError && <p role="alert" className="players-save-error">{saveError}</p>}
          <div className="players-form-actions"><button type="button" className="players-button-secondary" onClick={onCancel}>Cancelar</button><button type="submit" className="players-button-primary">{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Guardar jugador'}</button></div>
        </fieldset>
      </form>
    </section>
  )
}
