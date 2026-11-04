import { useEffect, useId, useRef, useState } from 'react'
import { SegmentedControl } from '../ui'
import { analysisErrorMessage, formatBytes, validateAnalysis } from '../../lib/analysis.js'

const initial = { sourceType: 'file', file: null, url: '', playerPosition: '', opponent: '', tournament: '', matchDate: '', result: '' }

export default function AnalysisForm({ service, players, playersLoading, playersError, playerId, onPlayerChange, onNewPlayer, playerCreationOpen }) {
  const id = useId()
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState({})
  const [failure, setFailure] = useState(null)
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({ phase: 'idle', percent: 0 })
  const request = useRef(null)
  const controller = useRef(null)
  const active = useRef(false)
  const sending = useRef(false)
  const fileInput = useRef(null)
  const formRef = useRef(null)
  const noticeRef = useRef(null)
  const playerSelect = useRef(null)

  useEffect(() => { request.current = null; if (playerId) playerSelect.current?.focus() }, [playerId])

  useEffect(() => {
    active.current = true
    return () => { active.current = false; controller.current?.abort() }
  }, [])

  function change(field, value) {
    request.current = null
    setSuccess('')
    setFailure(null)
    setValues(previous => field === 'sourceType' ? { ...previous, sourceType: value, file: null, url: '' } : { ...previous, [field]: value })
    setErrors(previous => field === 'sourceType' ? { ...previous, file: undefined, url: undefined } : { ...previous, [field]: undefined })
  }

  async function submit(event) {
    event.preventDefault()
    if (sending.current) return
    const input = { ...values, playerId }
    const validation = validateAnalysis(input, service)
    if (!players.some(player => player.id === playerId)) validation.playerId = 'Selecciona un jugador disponible.'
    setErrors(validation)
    setFailure(null)
    setSuccess('')
    if (Object.keys(validation).length) {
      formRef.current.elements.namedItem(Object.keys(validation)[0])?.focus()
      return
    }
    sending.current = true
    setBusy(true)
    setProgress({ phase: 'uploading', percent: 0 })
    controller.current = new AbortController()
    try {
      request.current ??= service.createRequestId()
      await service.enqueue(input, {
        requestId: request.current,
        signal: controller.current.signal,
        onProgress: next => { if (active.current) setProgress(next) },
      })
      if (!active.current) return
      setValues(initial)
      if (fileInput.current) fileInput.current.value = ''
      request.current = null
      setSuccess(service.mode === 'demo' ? 'Partido añadido a la cola de demostración. No se subió ni procesó ningún video.' : 'Partido añadido a la cola. Sus estadísticas estarán disponibles cuando termine el análisis.')
      noticeRef.current?.focus()
    } catch (error) {
      if (active.current) setFailure(analysisErrorMessage(error))
    } finally {
      sending.current = false
      if (active.current) setBusy(false)
    }
  }

  const update = event => change(event.target.name, event.target.value)
  const fieldError = field => errors[field] && <p className="players-field-error" id={`${id}-${field}-error`}>{errors[field]}</p>
  const invalid = field => ({ 'aria-invalid': Boolean(errors[field]), 'aria-describedby': errors[field] ? `${id}-${field}-error` : undefined })

  return (
    <form ref={formRef} className="analysis-form" onSubmit={submit} noValidate aria-label="Analizar video" aria-busy={busy}>
      <fieldset disabled={busy || playerCreationOpen} className="players-form-fields">
        <section className="analysis-panel" aria-labelledby={`${id}-source-title`}>
          <div className="analysis-step-heading"><span aria-hidden="true">01</span><div><h2 id={`${id}-source-title`}>El video del partido</h2><p>Un partido completo. Una nueva perspectiva.</p></div></div>
          <SegmentedControl label="Origen del video" value={values.sourceType} onChange={value => change('sourceType', value)} options={[{ value: 'file', label: 'Subir archivo' }, { value: 'link', label: 'Usar enlace', disabled: !service.supportsLinks }]} />
          {values.sourceType === 'file' ? <div className="analysis-upload"><span className="analysis-upload-icon" aria-hidden="true">↑</span><label htmlFor={`${id}-file`}>Selecciona el video del partido</label><p>MP4 o MOV · Hasta {formatBytes(service.maxBytes)}{service.mode === 'demo' ? ' en esta demostración' : ''}</p><input ref={fileInput} id={`${id}-file`} name="file" type="file" accept=".mp4,.mov,video/mp4,video/quicktime" onChange={event => change('file', event.target.files?.[0] ?? null)} {...invalid('file')} />{values.file && <p className="analysis-selected-file">{values.file.name} · {formatBytes(values.file.size)}</p>}{fieldError('file')}</div> : <div className="players-field analysis-url"><label htmlFor={`${id}-url`}>Enlace del video *</label><input id={`${id}-url`} type="url" name="url" value={values.url} onChange={update} placeholder={service.supportsYouTube ? 'https://youtu.be/abcdefghijk' : 'https://ejemplo.com/partido.mp4'} {...invalid('url')} /><p>{service.supportsYouTube ? 'Video público de YouTube o enlace directo a MP4/MOV.' : 'Enlace público directo a MP4 o MOV.'} {service.mode === 'demo' ? 'En esta demostración solo se valida el enlace; no se descarga ningún video.' : 'Se comprobará su formato y tamaño antes de añadirlo a la cola.'}</p>{fieldError('url')}</div>}
          {!service.supportsLinks && <p className="analysis-muted">La importación por enlace aún no está disponible. Puedes usar un archivo.</p>}
        </section>

        <section className="analysis-panel" aria-labelledby={`${id}-player-title`}>
          <div className="analysis-step-heading"><span aria-hidden="true">02</span><div><h2 id={`${id}-player-title`}>El protagonista</h2><p>Vincula el video al jugador que quieres seguir.</p></div></div>
          <div className="analysis-player-row"><div className="players-field"><label htmlFor={`${id}-player`}>Jugador *</label><select ref={playerSelect} id={`${id}-player`} name="playerId" value={playerId} onChange={event => { request.current = null; setFailure(null); setSuccess(''); setErrors(previous => ({ ...previous, playerId: undefined })); onPlayerChange(event.target.value) }} disabled={playersLoading || Boolean(playersError)} {...invalid('playerId')}><option value="">{playersLoading ? 'Cargando jugadores…' : 'Selecciona un jugador'}</option>{players.map(player => <option key={player.id} value={player.id}>{player.fullName}</option>)}</select>{fieldError('playerId')}</div><button type="button" className="players-button-secondary" onClick={onNewPlayer}>Nuevo jugador</button></div>
          {playersError && <p role="alert" className="players-save-error">{playersError}</p>}
          {!playersLoading && !playersError && players.length === 0 && <p className="analysis-muted">Registra un jugador para vincularle este video.</p>}
          <div className="players-field analysis-position"><label htmlFor={`${id}-position`}>Posición al inicio del video *</label><select id={`${id}-position`} name="playerPosition" value={values.playerPosition} onChange={update} {...invalid('playerPosition')}><option value="">Elige una posición</option><option value="arriba">Arriba de la cancha</option><option value="abajo">Abajo de la cancha</option></select>{fieldError('playerPosition')}</div>
        </section>

        <section className="analysis-panel" aria-labelledby={`${id}-match-title`}>
          <div className="analysis-step-heading"><span aria-hidden="true">03</span><div><h2 id={`${id}-match-title`}>El contexto del partido</h2><p>Los detalles que acompañarán al análisis.</p></div></div>
          <div className="players-form-grid">{[
            ['opponent', 'Rival *', 'text', 'Nombre del rival'], ['matchDate', 'Fecha del partido *', 'date', undefined],
            ['tournament', 'Torneo (opcional)', 'text', 'Torneo o partido amistoso'], ['result', 'Resultado (opcional)', 'text', 'Por ejemplo: 6-4, 6-3'],
          ].map(([name, label, type, placeholder]) => <div className="players-field" key={name}><label htmlFor={`${id}-${name}`}>{label}</label><input id={`${id}-${name}`} name={name} type={type} placeholder={placeholder} maxLength={type === 'text' ? 120 : undefined} value={values[name]} onChange={update} {...invalid(name)} />{fieldError(name)}</div>)}</div>
        </section>
        <div className="analysis-submit"><p>El partido aparecerá en la cola cuando termine la carga.</p><button className="players-button-primary" type="submit" disabled={playersLoading || Boolean(playersError)}>{busy ? 'Preparando análisis…' : 'Añadir a la cola'}<span aria-hidden="true"> →</span></button></div>
      </fieldset>
      {busy && <div className="analysis-progress"><div role="status"><p>{progress.phase === 'saving' ? 'Guardando partido…' : 'Cargando video…'}</p><progress aria-label="Progreso de carga" max={100} value={progress.percent} /><span>{Math.round(progress.percent)} %</span></div><button type="button" className="players-button-secondary" disabled={progress.phase === 'saving'} onClick={() => controller.current?.abort()}>Cancelar carga</button></div>}
      {failure && <p role="alert" className="players-save-error">{failure}</p>}
      <p ref={noticeRef} tabIndex={-1} className="players-notice" role="status">{success}</p>
    </form>
  )
}
