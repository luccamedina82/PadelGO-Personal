'use client'

import { useState, useTransition } from 'react'
import { Avatar } from '@/components/ui'
import type { ActionResult } from '@/types'

interface StaffMember {
  id: string
  name: string
  email: string
  avatarColor: string
  isActive: boolean
  createdAt: string
}

interface InvitationItem {
  id: string
  email: string
  isExpired: boolean
  expiresAt: string
  createdAt: string
}

interface EquipoClientProps {
  clubId: string
  clubName: string
  staffMembers: StaffMember[]
  invitations: InvitationItem[]
  inviteStaffAction: (
    email: string,
    clubId: string
  ) => Promise<ActionResult<{ invitationId: string }>>
  removeStaffAction: (staffUserId: string, clubId: string) => Promise<ActionResult>
}

export default function EquipoClient({
  clubId,
  clubName,
  staffMembers: initialStaff,
  invitations: initialInv,
  inviteStaffAction,
  removeStaffAction,
}: EquipoClientProps) {
  const [staff, setStaff] = useState(initialStaff)
  const [invitations, setInvitations] = useState(initialInv)
  const [isPending, startTransition] = useTransition()
  const [newEmail, setNewEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

  function handleInvite() {
    if (!newEmail.trim()) {
      setError('Ingresá un email.')
      return
    }
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const result = await inviteStaffAction(newEmail.trim(), clubId)
      if (result.success) {
        setNewEmail('')
        setSuccess(`Invitación enviada a ${newEmail.trim()}`)
        // Add to pending list
        setInvitations((prev) => [
          {
            id: result.data?.invitationId ?? Math.random().toString(),
            email: newEmail.trim(),
            isExpired: false,
            expiresAt: new Date(Date.now() + 48 * 3600000).toISOString(),
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ])
      } else {
        setError(result.error)
      }
    })
  }

  function handleRemove(userId: string) {
    setError(null)
    startTransition(async () => {
      const result = await removeStaffAction(userId, clubId)
      if (result.success) {
        setStaff((prev) => prev.filter((s) => s.id !== userId))
        setConfirmRemoveId(null)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="sticky top-0 z-10 bg-surface border-b border-border px-4 py-3">
        <h1 className="font-semibold text-text">Equipo — {clubName}</h1>
        <p className="text-xs text-muted">
          {staff.length} miembro{staff.length !== 1 ? 's' : ''} activo
          {staff.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="p-4 max-w-xl mx-auto space-y-6">
        {/* Invite form */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-semibold text-sm text-text mb-3">Invitar nuevo miembro</h2>
          <div className="flex gap-2">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              placeholder="email@ejemplo.com"
              className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-sub focus:outline-none focus:border-accent"
            />
            <button
              onClick={handleInvite}
              disabled={isPending}
              className="px-4 py-2 bg-accent text-accent-text font-semibold rounded-lg text-sm hover:bg-accent-dark transition-colors disabled:opacity-50"
            >
              {isPending ? '...' : 'Invitar'}
            </button>
          </div>
          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
          {success && <p className="text-xs text-green-400 mt-2">✓ {success}</p>}
          <p className="text-xs text-muted mt-2">
            Se enviará un link de activación válido por 48 horas.
          </p>
        </div>

        {/* Active staff */}
        {staff.length > 0 && (
          <div>
            <h2 className="font-semibold text-sm text-text mb-3">Equipo activo</h2>
            <div className="space-y-2">
              {staff.map((member) => (
                <div
                  key={member.id}
                  className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3"
                >
                  <Avatar name={member.name} color={member.avatarColor} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text">{member.name}</p>
                    <p className="text-xs text-muted truncate">{member.email}</p>
                  </div>
                  <span className="text-xs text-muted bg-surface border border-border rounded-full px-2 py-0.5">
                    Staff
                  </span>
                  {confirmRemoveId === member.id ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => setConfirmRemoveId(null)}
                        className="text-xs text-muted px-2 py-1 border border-border rounded-lg"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleRemove(member.id)}
                        disabled={isPending}
                        className="text-xs text-red-400 px-2 py-1 border border-red-400/30 rounded-lg hover:bg-red-400/10 disabled:opacity-50"
                      >
                        Confirmar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmRemoveId(member.id)}
                      className="text-xs text-muted px-2 py-1 border border-border rounded-lg hover:border-red-400 hover:text-red-400 transition-colors"
                    >
                      Remover
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending invitations */}
        {invitations.length > 0 && (
          <div>
            <h2 className="font-semibold text-sm text-text mb-3">Invitaciones pendientes</h2>
            <div className="space-y-2">
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  className={`bg-card border rounded-xl px-4 py-3 flex items-center gap-3 ${inv.isExpired ? 'border-border opacity-50' : 'border-border'}`}
                >
                  <div className="w-9 h-9 rounded-full bg-surface border border-border flex items-center justify-center text-muted text-xs">
                    ✉️
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text truncate">{inv.email}</p>
                    <p className="text-xs text-muted">
                      {inv.isExpired
                        ? '⚠️ Expirada'
                        : `Válida hasta ${new Date(inv.expiresAt).toLocaleDateString('es-AR')}`}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${inv.isExpired ? 'border-border text-sub' : 'border-yellow-400/30 text-yellow-400'}`}
                  >
                    {inv.isExpired ? 'Expirada' : 'Pendiente'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {staff.length === 0 && invitations.length === 0 && (
          <div className="text-center py-12 text-muted">
            <p className="text-3xl mb-2">👥</p>
            <p className="text-sm">No tenés miembros en el equipo todavía.</p>
            <p className="text-xs mt-1">Invitá a tu primer empleado arriba.</p>
          </div>
        )}
      </div>
    </div>
  )
}
