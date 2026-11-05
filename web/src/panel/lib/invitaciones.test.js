import { beforeEach, describe, expect, it, vi } from 'vitest'

const setDoc = vi.fn()
const deleteDoc = vi.fn()
vi.mock('firebase/firestore', () => ({
  deleteDoc: (...args) => deleteDoc(...args),
  doc: (db, ...ruta) => ({ path: ruta.join('/') }),
  serverTimestamp: () => 'SERVER_TIME',
  setDoc: (...args) => setDoc(...args),
}))

const { anularInvitacion, enlaceInvitacion, invitarMiembro, normalizarCorreo, validarInvitacion } = await import('./invitaciones.js')

describe('validarInvitacion', () => {
  it('acepta un correo y un rol válidos', () => {
    expect(validarInvitacion({ email: ' Ana@Club.pe ', role: 'coach' })).toBeNull()
    expect(validarInvitacion({ email: 'ana@club.pe', role: 'admin' })).toBeNull()
  })

  it('rechaza correos o roles inválidos', () => {
    expect(validarInvitacion({ email: 'ana', role: 'coach' })).toMatch(/correo/)
    expect(validarInvitacion({ email: 'ana@club.pe', role: 'dueño' })).toMatch(/rol/)
  })
})

describe('invitarMiembro', () => {
  beforeEach(() => setDoc.mockReset())

  it('guarda la invitación pendiente con el correo en minúsculas como ID', async () => {
    await expect(invitarMiembro({ db: {}, orgId: 'org-1', uid: 'u1', email: ' Ana@Club.PE ' })).resolves.toBe('ana@club.pe')
    expect(setDoc).toHaveBeenCalledWith({ path: 'invites/ana@club.pe' }, {
      email: 'ana@club.pe', orgId: 'org-1', role: 'coach', status: 'pendiente', invitedBy: 'u1', createdAt: 'SERVER_TIME',
    })
  })

  it('no escribe nada si faltan datos', async () => {
    await expect(invitarMiembro({ db: {}, orgId: 'org-1', uid: 'u1', email: 'x' })).rejects.toMatchObject({ code: 'invite/invalid' })
    await expect(invitarMiembro({ db: {}, orgId: null, uid: 'u1', email: 'a@b.pe' })).rejects.toThrow()
    expect(setDoc).not.toHaveBeenCalled()
  })

  it('normaliza correos', () => {
    expect(normalizarCorreo('  A@B.Pe ')).toBe('a@b.pe')
  })

  it('arma el enlace de registro y anula por correo', async () => {
    expect(enlaceInvitacion('https://acecam.app', 'Ana@Club.pe')).toBe('https://acecam.app/registro?invitacion=ana%40club.pe')
    await anularInvitacion({ db: {}, email: 'Ana@Club.pe' })
    expect(deleteDoc).toHaveBeenCalledWith({ path: 'invites/ana@club.pe' })
  })
})
