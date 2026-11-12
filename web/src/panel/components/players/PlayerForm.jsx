import { useEffect, useId, useRef, useState } from 'react'
import { playersErrorMessage, requiresPlayerGuardian, validatePlayer } from '../../lib/players.js'
import { BACKHANDS, DOMINANT_HANDS, PLAYER_CATEGORIES } from '../../lib/schema.js'

const segmentedFields = [
  { name: 'category', label: 'Categoría', options: PLAYER_CATEGORIES },
  { name: 'dominantHand', label: 'Mano dominante', options: DOMINANT_HANDS },
  { name: 'backhand', label: 'Revés', options: BACKHANDS },
]

const sportFields = [
  ...segmentedFields,
  { name: 'utr', label: 'UTR', type: 'number', step: 'any' },
  { name: 'nationalRanking', label: 'Ranking nacional', type: 'number' },
  { name: 'nationality', label: 'País de nacimiento', maxLength: 60 },
  { name: 'graduationYear', label: 'Año de graduación', type: 'number' },
  { name: 'coachName', label: 'Entrenador en su academia', maxLength: 120 },
]

const textFields = [
  { name: 'nationality', label: 'País de nacimiento', maxLength: 60, placeholder: 'Ej. Perú' },
  { name: 'coachName', label: 'Entrenador en su academia', maxLength: 120, placeholder: 'Nombre del entrenador' },
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
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    active.current = true
    nameRef.current?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { active.current = false; document.body.style.overflow = overflow }
  }, [])

  const leave = callback => {
    const reduced = !window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) { callback(); return }
    setClosing(true)
    setTimeout(callback, 700)
  }
  const cancel = () => { if (!closing) leave(onCancel) }

  const setField = (name, value) => {
    setValues(previous => ({ ...previous, [name]: value }))
    setErrors(previous => ({ ...previous, [name]: undefined }))
  }

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
      if (active.current) leave(() => onCreated(player))
    } catch (error) {
      if (active.current) setSaveError(playersErrorMessage(error, editing ? 'update' : 'create'))
    } finally {
      submitting.current = false
      if (active.current) setSaving(false)
    }
  }

  const error = name => errors[name] && <p className="players-field-error" id={`${id}-${name}-error`}>{errors[name]}</p>
  const describedBy = name => errors[name] ? `${id}-${name}-error` : undefined

  return (
    <div className="players-modal" data-closing={closing || undefined} onMouseDown={event => { if (event.target === event.currentTarget && !saving) cancel() }} onKeyDown={event => { if (event.key === 'Escape' && !saving) cancel() }}>
      <section className="players-modal-card" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
        <svg aria-hidden="true" viewBox="0 0 30 30" className="players-pelota">
          <circle cx="15" cy="15" r="14" fill="var(--accent)" stroke="var(--accent-line)" strokeWidth="1" />
          <path d="M4.6 6.2c5.4 4.7 5.4 12.9 0 17.6M25.4 6.2c-5.4 4.7-5.4 12.9 0 17.6" stroke="var(--on-accent)" strokeWidth="2.2" fill="none" />
        </svg>
        <header className="players-modal-header">
          <div>
            <h2 id={`${id}-title`}>{editing ? 'Editar jugador' : 'Registrar jugador'}</h2>
            <p>{editing ? 'Actualiza los datos personales y deportivos del jugador.' : 'Completa los datos del nuevo jugador para comenzar su seguimiento.'}</p>
          </div>
          <button type="button" className="players-modal-close" aria-label="Cerrar" disabled={saving} onClick={cancel}>×</button>
        </header>
        <form onSubmit={submit} noValidate aria-label={editing ? 'Editar jugador' : 'Registrar jugador'} aria-busy={saving}>
          <fieldset disabled={saving} className="players-form-fields players-modal-body">
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
              {textFields.map(field => (
                <div className="players-field" key={field.name}>
                  <label htmlFor={`${id}-${field.name}`}>{field.label} <span>(opcional)</span></label>
                  <input id={`${id}-${field.name}`} name={field.name} maxLength={field.maxLength} placeholder={field.placeholder} value={values[field.name]} onChange={update} aria-invalid={Boolean(errors[field.name])} aria-describedby={describedBy(field.name)} />
                  {error(field.name)}
                </div>
              ))}
              <div className="players-field">
                <label htmlFor={`${id}-utr`}>UTR <span>(opcional)</span></label>
                <input id={`${id}-utr`} name="utr" type="number" step="any" placeholder="Ej. 8.5" value={values.utr} onChange={update} aria-invalid={Boolean(errors.utr)} aria-describedby={describedBy('utr')} />
                {error('utr')}
              </div>
              {segmentedFields.map(field => (
                <div className={field.name === 'category' ? 'players-field players-field-wide' : 'players-field'} key={field.name}>
                  <span className="players-segment-label" id={`${id}-${field.name}-label`}>{field.label}</span>
                  <div className="players-segment" role="group" aria-labelledby={`${id}-${field.name}-label`}>
                    {field.options.map(option => (
                      <button key={option} type="button" aria-pressed={values[field.name] === option} onClick={() => setField(field.name, values[field.name] === option ? '' : option)}>{option}</button>
                    ))}
                  </div>
                  {error(field.name)}
                </div>
              ))}
            </div>
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
            {editing ? <p className="players-consent-note">Se conserva la autorización registrada originalmente.</p> : <div className="players-consent">
              <label htmlFor={`${id}-consent`}><input id={`${id}-consent`} name="consentAccepted" type="checkbox" checked={values.consentAccepted} onChange={update} required aria-invalid={Boolean(errors.consentAccepted)} aria-describedby={`${id}-consent-note${errors.consentAccepted ? ` ${id}-consent-error` : ''}`} /><span>Confirmo que el jugador o su apoderado ha sido informado y autorizó el registro de sus datos para el seguimiento deportivo. *</span></label>
              <p id={`${id}-consent-note`}>La autorización es obligatoria. El registro guardará quién la confirmó y cuándo.</p>
              {errors.consentAccepted && <p className="players-field-error" id={`${id}-consent-error`}>{errors.consentAccepted}</p>}
            </div>}
            {saveError && <p role="alert" className="players-save-error">{saveError}</p>}
            <div className="players-form-actions"><button type="button" className="players-button-secondary" onClick={cancel}>Cancelar</button><button type="submit" className="players-button-primary">{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Guardar jugador'}</button></div>
          </fieldset>
        </form>
      </section>
    </div>
  )
}
