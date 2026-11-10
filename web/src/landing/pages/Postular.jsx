import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { db } from '../../panel/lib/firebase.js'
import { formatBytes, validateVideoFile } from '../../panel/lib/analysis.js'
import { requiresPlayerGuardian } from '../../panel/lib/players.js'
import { publicFormExists, submitPublicApplication } from '../../panel/lib/publicApplications.js'
import { validateLocalVideo } from '../../panel/lib/validateLocalVideo.js'
import { MAX_VIDEO_FPS, MAX_VIDEO_SECONDS, MIN_VIDEO_FPS, MIN_VIDEO_HEIGHT, MIN_VIDEO_WIDTH } from '../../panel/lib/videoRequirements.js'
import { MAX_VIDEO_BYTES } from '../../panel/lib/videoUpload.js'

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
// PCIT-185: campo trampa (honeypot). Las personas no lo ven ni llegan a él con el
// teclado ni con lector de pantalla; los bots que llenan todo lo completan.
const TRAMPA = 'website'

function CampoTrampa() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute -left-[9999px] h-px w-px overflow-hidden">
      <label htmlFor={TRAMPA}>Sitio web</label>
      <input id={TRAMPA} name={TRAMPA} type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
    </div>
  )
}

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

async function checkAttachment(file, signal) {
  const error = validateVideoFile(file, MAX_VIDEO_BYTES) ?? await validateLocalVideo(file, signal)
  if (error) throw Object.assign(new Error(error), { code: 'applications/video' })
}

async function attachVideo({ orgId, formId, applicationId, file, signal }) {
  const path = [orgId, formId, applicationId].map(encodeURIComponent).join('/')
  const response = await fetch(`/api/application-video/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file, signal,
  })
  if (!response.ok) {
    const result = await response.json().catch(() => null)
    throw Object.assign(new Error(result?.error || 'No pudimos adjuntar el video. Vuelve a intentarlo.'), { code: 'applications/video' })
  }
}

function VideoField({ onChange }) {
  return (
    <div className="sm:col-span-2">
      <label className="mb-1 block text-sm font-semibold" htmlFor="application-video">Video (opcional)</label>
      <p className="mb-2 text-sm" id="application-video-requirements">
        MP4 o MOV de hasta {MAX_VIDEO_SECONDS / 60} minuto y {formatBytes(MAX_VIDEO_BYTES)}.
        {' '}Mínimo {MIN_VIDEO_WIDTH}×{MIN_VIDEO_HEIGHT} y de {MIN_VIDEO_FPS} a {MAX_VIDEO_FPS} FPS.
        {' '}Recomendamos 1080p a 30 FPS, con cámara fija detrás de la línea de fondo, cancha completa y sin cortes.
      </p>
      <input className={inputClass} id="application-video" name="video" type="file"
        accept=".mp4,.mov,video/mp4,video/quicktime" aria-describedby="application-video-requirements" onChange={onChange} />
    </div>
  )
}

function Formulario({ orgId, formId }) {
  const videoEnabled = import.meta.env.DEV && import.meta.env.MODE === 'demo'
  const [available, setAvailable] = useState(null)
  const [guardian, setGuardian] = useState(false)
  const [sending, setSending] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState({})
  const [attachment, setAttachment] = useState(null)
  const locked = useRef(false)
  const transfer = useRef(null)

  useEffect(() => {
    let active = true
    publicFormExists(db, orgId, formId).then(
      (exists) => { if (active) setAvailable(exists) },
      () => { if (active) setAvailable(false) },
    )
    return () => { active = false; transfer.current?.abort() }
  }, [orgId, formId])

  async function submit(event) {
    event.preventDefault()
    if (locked.current || !available) return
    const form = event.currentTarget
    const file = videoEnabled ? form.elements.namedItem('video')?.files?.[0] : null
    const data = new FormData(form)
    data.delete('video')
    // Un bot llenó el campo trampa: no se guarda nada y se muestra el mismo
    // "recibido" que a una persona, para no darle pistas.
    const trampa = String(data.get(TRAMPA) ?? '').trim()
    data.delete(TRAMPA)
    if (trampa) {
      setSubmitted(true)
      return
    }
    const input = { ...Object.fromEntries(data), attachVideo: Boolean(file), consentAccepted: data.has('consent') }
    locked.current = true
    setSending(true)
    setErrors({})
    setError('')
    const controller = new AbortController()
    transfer.current = controller
    try {
      if (file) await checkAttachment(file, controller.signal)
      const application = await submitPublicApplication(db, { orgId, formId }, input)
      if (file) {
        setAttachment({ applicationId: application.id, file })
        await attachVideo({ orgId, formId, applicationId: application.id, file, signal: controller.signal })
      }
      setSubmitted(true)
    } catch (failure) {
      setErrors(failure.fields ?? {})
      setError(failure.code === 'applications/video' ? failure.message :
        failure.fields || failure.message === 'applications/invalid-contact'
        ? 'Revisa los campos marcados y confirma la autorización.'
        : file && failure instanceof TypeError ? 'Comprueba tu conexión e inténtalo de nuevo.'
          : 'No pudimos enviar la postulación. Comprueba tu conexión y que el enlace siga activo.')
    } finally {
      locked.current = false
      setSending(false)
    }
  }

  async function retryVideo(event) {
    event.preventDefault()
    if (locked.current || !attachment.file) return
    locked.current = true
    setSending(true)
    setError('')
    const controller = new AbortController()
    transfer.current = controller
    try {
      await checkAttachment(attachment.file, controller.signal)
      await attachVideo({ orgId, formId, ...attachment, signal: controller.signal })
      setSubmitted(true)
    } catch (failure) {
      setError(failure.code === 'applications/video' ? failure.message : 'No pudimos adjuntar el video. Vuelve a intentarlo.')
    } finally {
      locked.current = false
      setSending(false)
    }
  }

  if (available == null) return <p role="status">Comprobando el enlace de postulación…</p>
  if (!available) return <p role="alert">Este enlace de postulación no está disponible. Pide un enlace activo a la organización.</p>
  if (submitted) return <p role="status">Recibimos tu postulación. La organización podrá revisarla y contactarte.</p>
  if (attachment) return (
    <form onSubmit={retryVideo} aria-label="Adjuntar video a la postulación" aria-busy={sending}>
      <p className="mb-3" role="status">{sending ? 'Postulación guardada. Verificando y adjuntando el video…' :
        'Tu postulación quedó guardada. Puedes reintentar el video o terminar.'}</p>
      <fieldset disabled={sending} className="space-y-3">
        <VideoField onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) setAttachment({ ...attachment, file })
        }} />
        <p className="text-sm">Archivo seleccionado: {attachment.file.name}</p>
        <div className="flex flex-wrap gap-3">
          <button className="rounded-lg bg-accent px-4 py-2 font-semibold text-bg" type="submit">Reintentar video</button>
          <button className="rounded-lg border border-line px-4 py-2" type="button" onClick={() => setSubmitted(true)}>Terminar</button>
        </div>
      </fieldset>
      {error && <p className="mt-3 text-sm" role="alert">{error}</p>}
    </form>
  )
  return (
    <form onSubmit={submit} aria-label="Formulario de postulación" aria-busy={sending} className="relative">
      <CampoTrampa />
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
          <textarea className={inputClass} id="message" name="message" maxLength={1000} rows={4}
            aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? 'message-error' : undefined} />
          {errors.message && <p id="message-error" className="mt-1 text-sm">{errors.message}</p>}
        </div>
        {videoEnabled && <VideoField />}
        <div className="sm:col-span-2">
          <label className="flex gap-2">
            <input type="checkbox" name="consent" required aria-describedby="application-privacy" />
            <span>{guardian ? 'Soy el apoderado y autorizo' : 'Autorizo'} el uso de estos datos para evaluar la postulación y contactarme.
              {videoEnabled && ' Si adjunto un video, autorizo su uso para evaluar esta postulación.'}</span>
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
