import { useState } from 'react'
import { StatusBadge } from '../ui'
import { nextApplicationStates } from '../../lib/applicationStatus.js'
import { playerAge } from '../../lib/players.js'
import { APPLICATION_STATUS } from '../../lib/schema.js'
import './bandeja.css'

const estados = Object.values(APPLICATION_STATUS)
const etiquetaEstado = (estado) => estado[0].toUpperCase() + estado.slice(1)
const corta = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short' })

export function fechaCorta(createdAt) {
  const ms = createdAt?.toMillis?.()
  return Number.isFinite(ms) ? corta.format(new Date(ms)).replace('.', '') : null
}

export const iniciales = (nombre) =>
  String(nombre ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((palabra) => palabra[0]).join('').toUpperCase() || '?'

function ocultarCorreo(correo) {
  const [usuario, dominio] = String(correo ?? '').split('@')
  return usuario && dominio ? `${usuario[0]}•••@${dominio}` : null
}

function ocultarTelefono(telefono) {
  const texto = String(telefono ?? '').trim()
  if (!texto) return null
  const total = (texto.match(/\d/g) ?? []).length
  let visto = 0
  return texto.replace(/\d/g, (digito) => {
    visto += 1
    return visto <= 3 || visto > total - 3 ? digito : '•'
  })
}

function enlaceSeguro(valor) {
  try {
    const url = new URL(valor)
    return url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

function CambiarEstado({ application, onSave }) {
  const [pendiente, setPendiente] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const siguientes = nextApplicationStates(application.status)
  const elegido = siguientes.includes(pendiente) ? pendiente : ''

  async function guardar() {
    if (!elegido || guardando) return
    setGuardando(true)
    setError('')
    try {
      await onSave(application, elegido)
      setPendiente('')
    } catch (fallo) {
      setError(fallo.message === 'application/status-conflict'
        ? 'La postulación cambió en otra sesión. Revisa el estado actual.'
        : 'No se pudo guardar el estado. Inténtalo de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="rec-bloque">
      <h3 className="rec-etiqueta">Cambiar estado</h3>
      <div className="rec-estados" role="group" aria-label={`Estado de ${application.fullName}`}>
        {estados.map((estado) => {
          const actual = estado === application.status
          const permitido = siguientes.includes(estado)
          return (
            <button
              key={estado}
              type="button"
              aria-pressed={actual || estado === elegido}
              aria-current={actual ? 'true' : undefined}
              data-pendiente={estado === elegido || undefined}
              disabled={!permitido || guardando}
              title={actual ? 'Estado actual' : permitido ? undefined : 'Solo se puede avanzar al siguiente estado'}
              onClick={() => setPendiente(estado === elegido ? '' : estado)}
            >
              {etiquetaEstado(estado)}
            </button>
          )
        })}
      </div>
      {elegido && (
        <div className="rec-guardar">
          <p>Pasar a <strong>{elegido}</strong>. No se puede deshacer.</p>
          <button type="button" className="players-button-primary" disabled={guardando} aria-label={`Guardar estado de ${application.fullName}`} onClick={guardar}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
          <button type="button" className="players-button-secondary" disabled={guardando} onClick={() => setPendiente('')}>Cancelar</button>
        </div>
      )}
      {error && <p className="players-field-error" role="alert">{error}</p>}
    </div>
  )
}

function Dato({ etiqueta, valor }) {
  return (
    <div>
      <dt>{etiqueta}</dt>
      <dd>{valor ?? 'Sin datos'}</dd>
    </div>
  )
}

function Notas({ application, onSaveNotes }) {
  const [guardada, setGuardada] = useState(application.internalNotes ?? '')
  const [texto, setTexto] = useState(guardada)
  const [estado, setEstado] = useState('')
  const cambiado = texto !== guardada

  async function guardar() {
    setEstado('guardando')
    try {
      await onSaveNotes(application, texto)
      setGuardada(texto)
      setEstado('guardado')
    } catch {
      setEstado('error')
    }
  }

  return (
    <div className="rec-bloque">
      <h3 className="rec-etiqueta"><label htmlFor={`notas-${application.id}`}>Notas internas</label></h3>
      <textarea
        id={`notas-${application.id}`}
        className="rec-notas"
        rows={4}
        maxLength={2000}
        placeholder="Solo visible para tu equipo."
        value={texto}
        onChange={(evento) => { setTexto(evento.target.value); setEstado('') }}
      />
      <div className="rec-notas-pie">
        <button type="button" className="players-button-secondary" disabled={!cambiado || estado === 'guardando'} onClick={guardar}>
          {estado === 'guardando' ? 'Guardando…' : 'Guardar notas'}
        </button>
        {estado === 'guardado' && !cambiado && <span role="status">Notas guardadas.</span>}
        {estado === 'error' && <span role="alert" className="players-field-error">No se pudieron guardar las notas.</span>}
      </div>
    </div>
  )
}

export default function DetallePostulacion({ application, enFicha, bloqueado, onSaveStatus, onSaveNotes, onAssign, onProfile, children }) {
  const edad = playerAge(application.birthDate)
  const enlaces = (application.videoLinks ?? []).map((valor) => ({ valor, url: enlaceSeguro(valor) })).filter((enlace) => enlace.url)
  const archivos = application.videoCount ?? 0
  const guardian = application.guardian
  const correo = ocultarCorreo(application.email)
  const telefono = ocultarTelefono(guardian?.phone)
  const postulo = fechaCorta(application.createdAt)
  const ranking = application.nationalRanking == null ? null : `#${application.nationalRanking} nacional`
  const manos = [application.dominantHand, application.backhand].filter(Boolean).join(' · ')

  return (
    <article className="rec-detalle" aria-label={`Postulación de ${application.fullName}`}>
      <header className="rec-cabeza">
        <span className="rec-avatar" aria-hidden="true">{iniciales(application.fullName)}</span>
        <div>
          <h2>{application.fullName}</h2>
          <p>{[postulo && `Postuló el ${postulo}`, application.city].filter(Boolean).join(' · ')}</p>
        </div>
        <StatusBadge status={application.status} />
      </header>

      <div className="rec-acciones">
        {application.playerId ? (
          enFicha && (
            <button type="button" className="players-button-primary" aria-label={`Ver ficha de ${application.fullName}`} onClick={onProfile}>Ver ficha</button>
          )
        ) : (
          <button type="button" className="players-button-primary" aria-label={`Crear o vincular jugador para ${application.fullName}`} disabled={bloqueado} onClick={onAssign}>Crear jugador</button>
        )}
        {application.playerId && !enFicha && <span className="rec-vinculado">Jugador vinculado</span>}
      </div>

      {children}

      <CambiarEstado key={`${application.id}:${application.status}`} application={application} onSave={onSaveStatus} />

      <div className="rec-columnas">
        <div className="rec-bloque">
          <h3 className="rec-etiqueta">Datos deportivos</h3>
          <dl>
            <Dato etiqueta="Edad" valor={edad == null ? null : `${edad} años`} />
            <Dato etiqueta="Academia" valor={application.academy || null} />
            <Dato etiqueta="UTR" valor={application.utr} />
            <Dato etiqueta="Ranking nacional" valor={ranking} />
            <Dato etiqueta="Mano / revés" valor={manos || null} />
            <Dato etiqueta="Graduación" valor={application.graduationYear} />
          </dl>
        </div>
        <div className="rec-bloque">
          <h3 className="rec-etiqueta">Contacto</h3>
          <dl>
            <Dato etiqueta="Jugador" valor={correo} />
            {guardian && <Dato etiqueta="Apoderado" valor={guardian.name || null} />}
            {guardian && <Dato etiqueta="Teléfono" valor={telefono} />}
          </dl>
          <p className="rec-nota">Los datos de contacto se muestran parcialmente.</p>
        </div>
      </div>

      {application.message && (
        <div className="rec-bloque rec-separado">
          <h3 className="rec-etiqueta">Mensaje del jugador</h3>
          <blockquote>“{application.message}”</blockquote>
        </div>
      )}

      <div className="rec-bloque rec-separado">
        <h3 className="rec-etiqueta">Videos adjuntos</h3>
        {enlaces.length + archivos === 0 ? (
          <p className="rec-nota">No adjuntó videos.</p>
        ) : (
          <ul className="rec-videos">
            {enlaces.map(({ valor, url }) => (
              <li key={valor}>
                <span className="rec-play" aria-hidden="true">▶</span>
                <div>
                  <a href={url.href} target="_blank" rel="noopener noreferrer">{url.hostname.replace(/^www\./, '')}{url.pathname === '/' ? '' : url.pathname}</a>
                  <span>Enlace de video</span>
                </div>
              </li>
            ))}
            {Array.from({ length: archivos }, (_, i) => (
              <li key={`archivo-${i}`}>
                <span className="rec-play" aria-hidden="true">▶</span>
                <div>
                  <strong>Video adjunto {archivos > 1 ? i + 1 : ''}</strong>
                  <span>Archivo subido por el jugador</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rec-separado">
        <Notas key={application.id} application={application} onSaveNotes={onSaveNotes} />
      </div>
    </article>
  )
}
