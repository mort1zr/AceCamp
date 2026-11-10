import { useEffect, useId, useRef, useState } from 'react'
import { SegmentedControl } from '../ui'
import { analysisErrorMessage, formatBytes, validateAnalysis } from '../../lib/analysis.js'
import { validateLocalVideo } from '../../lib/validateLocalVideo.js'
import { MAX_VIDEO_FPS, MAX_VIDEO_SECONDS, MIN_VIDEO_FPS, MIN_VIDEO_HEIGHT, MIN_VIDEO_WIDTH } from '../../lib/videoRequirements.js'

const initial = { sourceType: 'file', file: null, url: '', playerPosition: '', opponent: '', tournament: '', matchDate: '', result: '' }

export default function AnalysisForm({ service, players, playersLoading, playersError, playerId, onPlayerChange, onNewPlayer, playerCreationOpen, disabled = false }) {
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
    if (sending.current || disabled || playerCreationOpen || playersLoading || playersError) return
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
    const transfer = new AbortController()
    controller.current = transfer
    try {
      if (input.sourceType === 'file') {
        setProgress({ phase: 'checking', percent: 0 })
        const error = await validateLocalVideo(input.file, transfer.signal)
        transfer.signal.throwIfAborted()
        if (!active.current) return
        if (error) {
          setErrors({ file: error })
          return
        }
      }
      setProgress({ phase: 'uploading', percent: 0 })
      request.current ??= service.createRequestId()
      await service.enqueue(input, {
        requestId: request.current,
        signal: transfer.signal,
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
  const fieldError = field => errors[field] && <p className="players-field-error" id={`${id}-${field}-error`} role={field === 'file' ? 'alert' : undefined}>{errors[field]}</p>
  const invalid = (field, description) => ({
    'aria-invalid': Boolean(errors[field]),
    'aria-describedby': [description, errors[field] && `${id}-${field}-error`].filter(Boolean).join(' ') || undefined,
  })

  const pickPosition = value => change('playerPosition', value)
  const dropFile = event => {
    event.preventDefault()
    const file = event.dataTransfer?.files?.[0]
    if (file && !disabled && !busy) change('file', file)
  }
  const limit = Number.isFinite(service.maxBytes) && service.maxBytes > 0 ? ` · Hasta ${formatBytes(service.maxBytes)}${service.mode === 'demo' ? ' en esta demostración' : ''}` : ''

  return (
    <form ref={formRef} className="analysis-form" onSubmit={submit} noValidate aria-label="Analizar video" aria-busy={busy}>
      <fieldset disabled={busy || playerCreationOpen || disabled} className="players-form-fields analysis-steps">
        <section className="analysis-panel" aria-labelledby={`${id}-source-title`}>
          <div className="analysis-step-heading"><span className="analysis-step" aria-hidden="true">1</span><h2 id={`${id}-source-title`}>Origen del video</h2></div>
          <SegmentedControl label="Origen del video" value={values.sourceType} onChange={value => change('sourceType', value)} options={[{ value: 'file', label: 'Subir archivo' }, { value: 'link', label: 'Usar enlace', disabled: !service.supportsLinks }]} />
          {values.sourceType === 'file' ? (
            <div className="analysis-upload" onDragOver={event => event.preventDefault()} onDrop={dropFile}>
              <span className="analysis-upload-icon" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V4" /><path d="M7 9l5-5 5 5" /><path d="M4 15v4a1 1 0 001 1h14a1 1 0 001-1v-4" /></svg></span>
              <label htmlFor={`${id}-file`}>Selecciona el video del partido</label>
              <p>Arrastra el archivo aquí o elígelo desde tu equipo{limit}.</p>
              <p id={`${id}-file-requirements`}>
                MP4 o MOV de hasta {MAX_VIDEO_SECONDS / 60} minuto, con un mínimo de 720p ({MIN_VIDEO_WIDTH}×{MIN_VIDEO_HEIGHT}) y de {MIN_VIDEO_FPS} a {MAX_VIDEO_FPS} FPS.
                {' '}Recomendamos 1080p a 30 FPS. Graba con cámara fija detrás de la línea de fondo, con toda la cancha visible y sin cortes.
              </p>
              <label htmlFor={`${id}-file`} className="analysis-file-button">Elegir archivo</label>
              <input ref={fileInput} id={`${id}-file`} name="file" type="file" className="analysis-file-input" accept=".mp4,.mov,video/mp4,video/quicktime" onChange={event => change('file', event.target.files?.[0] ?? null)} {...invalid('file', `${id}-file-requirements`)} />
              {values.file && <p className="analysis-selected-file">{values.file.name} · {formatBytes(values.file.size)}</p>}
              {fieldError('file')}
            </div>
          ) : (
            <div className="players-field analysis-url"><label htmlFor={`${id}-url`}>Enlace del video *</label><input id={`${id}-url`} type="url" name="url" value={values.url} onChange={update} placeholder={service.supportsYouTube ? 'https://youtu.be/abcdefghijk' : 'https://ejemplo.com/partido.mp4'} {...invalid('url')} /><p>{service.supportsYouTube ? 'Video público de YouTube o enlace directo a MP4/MOV.' : 'Enlace público directo a MP4 o MOV.'} {service.mode === 'demo' ? 'En esta demostración solo se valida el enlace; no se descarga ningún video.' : 'Se comprobará su formato y tamaño antes de añadirlo a la cola.'}</p>{fieldError('url')}</div>
          )}
          {!service.supportsLinks && <p className="analysis-muted">La importación por enlace aún no está disponible. Puedes usar un archivo.</p>}
        </section>

        <section className="analysis-panel" aria-labelledby={`${id}-player-title`}>
          <div className="analysis-step-heading"><span className="analysis-step" aria-hidden="true">2</span><h2 id={`${id}-player-title`}>Vincular jugador</h2></div>
          <div className="analysis-player-row"><div className="players-field"><label htmlFor={`${id}-player`}>Jugador *</label><select ref={playerSelect} id={`${id}-player`} name="playerId" value={playerId} onChange={event => { request.current = null; setFailure(null); setSuccess(''); setErrors(previous => ({ ...previous, playerId: undefined })); onPlayerChange(event.target.value) }} disabled={playersLoading || Boolean(playersError)} {...invalid('playerId')}><option value="">{playersLoading ? 'Cargando jugadores…' : 'Selecciona un jugador'}</option>{players.map(player => <option key={player.id} value={player.id}>{player.fullName}</option>)}</select>{fieldError('playerId')}</div><button type="button" className="players-button-secondary" onClick={onNewPlayer}>Nuevo jugador</button></div>
          {playersError && <p role="alert" className="players-save-error">{playersError}</p>}
          {!playersLoading && !playersError && players.length === 0 && <p className="analysis-muted">Registra un jugador para vincularle este video.</p>}
        </section>

        <section className="analysis-panel" aria-labelledby={`${id}-position-title`}>
          <div className="analysis-step-heading"><span className="analysis-step" aria-hidden="true">3</span><h2 id={`${id}-position-title`}>¿Cuál es tu jugador en la cancha?</h2></div>
          <p className="analysis-muted">Marca dónde está al inicio del video. El sistema lo seguirá todo el partido, incluso cuando cambien de lado.</p>
          <div className="analysis-court">
            <svg viewBox="0 0 640 360" aria-hidden="true">
              <rect width="640" height="360" className="analysis-court-bg" />
              <polygon points="190,40 450,40 590,340 50,340" className="analysis-court-floor" />
              <g className="analysis-court-lines">
                <polygon points="190,40 450,40 590,340 50,340" />
                <path d="M222,40 L105,340 M418,40 L535,340" />
                <path d="M120,268 L520,268 M200,110 L440,110" />
                <path d="M320,110 L320,268" />
              </g>
              <path d="M150,165 L490,165" className="analysis-court-net" />
              <g className="analysis-court-player">
                <circle cx="300" cy="74" r="9" /><rect x="292" y="82" width="16" height="22" rx="5" />
                <circle cx="350" cy="288" r="12" /><rect x="339" y="299" width="22" height="30" rx="7" />
              </g>
            </svg>
            <button type="button" className="analysis-zone analysis-zone-top" aria-pressed={values.playerPosition === 'arriba'} onClick={() => pickPosition('arriba')}>Jugador de arriba</button>
            <button type="button" className="analysis-zone analysis-zone-bottom" aria-pressed={values.playerPosition === 'abajo'} onClick={() => pickPosition('abajo')}>Jugador de abajo</button>
          </div>
          <div className="players-field analysis-position"><label htmlFor={`${id}-position`}>Posición al inicio del video *</label><select id={`${id}-position`} name="playerPosition" value={values.playerPosition} onChange={update} {...invalid('playerPosition')}><option value="">Elige una posición</option><option value="arriba">Arriba de la cancha</option><option value="abajo">Abajo de la cancha</option></select>{fieldError('playerPosition')}</div>
        </section>

        <section className="analysis-panel" aria-labelledby={`${id}-match-title`}>
          <div className="analysis-step-heading"><span className="analysis-step" aria-hidden="true">4</span><h2 id={`${id}-match-title`}>Datos del partido</h2></div>
          <div className="players-form-grid">{[
            ['opponent', 'Rival *', 'text', 'Nombre del rival'], ['matchDate', 'Fecha del partido *', 'date', undefined],
            ['tournament', 'Torneo (opcional)', 'text', 'Ej. Torneo Nacional Sub-18'], ['result', 'Resultado (opcional)', 'text', 'Ej. 6-4 3-6 7-5'],
          ].map(([name, label, type, placeholder]) => <div className="players-field" key={name}><label htmlFor={`${id}-${name}`}>{label}</label><input id={`${id}-${name}`} name={name} type={type} placeholder={placeholder} maxLength={type === 'text' ? 120 : undefined} value={values[name]} onChange={update} {...invalid(name)} />{fieldError(name)}</div>)}</div>
        </section>
        <div className="analysis-submit">
          <p><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>Para mejores resultados: cámara fija desde atrás y en alto, con la cancha completa visible.</p>
          <button className="players-button-primary" type="submit" disabled={playersLoading || Boolean(playersError)}>{busy ? 'Preparando análisis…' : 'Añadir a la cola'}<span aria-hidden="true"> →</span></button>
        </div>
      </fieldset>
      {busy && (
        <div className="analysis-progress">
          <div role="status">
            {progress.phase === 'checking' ? <p>Verificando resolución y duración…</p> : (
              <>
                <p>{progress.phase === 'saving' ? 'Guardando partido…' : 'Cargando video…'}</p>
                <progress aria-label="Progreso de carga" max={100} value={progress.percent} />
                <span>{Math.round(progress.percent)} %</span>
              </>
            )}
          </div>
          <button type="button" className="players-button-secondary" disabled={progress.phase === 'saving'} onClick={() => controller.current?.abort()}>
            {progress.phase === 'checking' ? 'Cancelar verificación' : 'Cancelar carga'}
          </button>
        </div>
      )}
      {failure && <p role="alert" className="players-save-error">{failure}</p>}
      <p ref={noticeRef} tabIndex={-1} className="players-notice" role="status">{success}</p>
    </form>
  )
}
