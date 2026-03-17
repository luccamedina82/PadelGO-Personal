'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  banUser,
  unbanUser,
  deactivateUser,
  activateUser,
  resetUserPassword,
  cancelUserBooking,
} from '@/actions/superadmin/users'

interface Booking {
  id: string
  clubName: string
  courtName: string
  date: string
  startTime: string
  status: string
  totalPrice: number
}

interface UserActionsProps {
  userId: string
  isActive: boolean
  isBanned: boolean
  bannedReason: string | null
  bookings: Booking[]
}

export default function UserActions({
  userId,
  isActive,
  isBanned,
  bannedReason,
  bookings,
}: UserActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [banReason, setBanReason] = useState('')
  const [showBanInput, setShowBanInput] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  )

  function handleAction(fn: () => Promise<{ success: boolean; error?: string }>) {
    setFeedback(null)
    startTransition(async () => {
      const result = await fn()
      if (result.success) {
        setFeedback({ type: 'success', message: 'Acción ejecutada correctamente.' })
        router.refresh()
      } else {
        setFeedback({ type: 'error', message: result.error ?? 'Error desconocido.' })
      }
    })
  }

  const actionBtnClass =
    'flex flex-col gap-0.5 items-start border rounded-xl p-3 text-sm font-medium transition-colors disabled:opacity-50 w-full'

  return (
    <div className="space-y-4">
      {feedback && (
        <div
          className={`text-sm px-3 py-2 rounded-lg border ${
            feedback.type === 'success'
              ? 'text-green-400 bg-green-400/10 border-green-500/30'
              : 'text-red-400 bg-red-400/10 border-red-500/30'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Ban info */}
      {isBanned && bannedReason && (
        <div className="border border-red-500/40 bg-red-500/5 rounded-xl p-3">
          <p className="text-xs text-red-400 font-semibold mb-1">Usuario baneado</p>
          <p className="text-xs text-muted">Motivo: {bannedReason}</p>
        </div>
      )}

      {/* Actions grid 2x2 */}
      <div className="grid grid-cols-2 gap-2">
        {/* Reset password */}
        <button
          onClick={() =>
            handleAction(() =>
              resetUserPassword(userId).then((r) => ({
                success: r.success,
                error: r.success ? undefined : (r as { error: string }).error,
              }))
            )
          }
          disabled={isPending}
          className={`${actionBtnClass} border-blue-500/30 text-blue-400 hover:bg-blue-500/10`}
        >
          <span>Resetear contraseña</span>
          <span className="text-xs text-blue-400/60 font-normal">Envía link al usuario</span>
        </button>

        {/* Activate / Deactivate */}
        {isActive ? (
          <button
            onClick={() => handleAction(() => deactivateUser(userId))}
            disabled={isPending}
            className={`${actionBtnClass} border-orange-500/30 text-orange-400 hover:bg-orange-500/10`}
          >
            <span>Desactivar cuenta</span>
            <span className="text-xs text-orange-400/60 font-normal">No puede loguearse</span>
          </button>
        ) : (
          <button
            onClick={() => handleAction(() => activateUser(userId))}
            disabled={isPending}
            className={`${actionBtnClass} border-green-500/30 text-green-400 hover:bg-green-500/10`}
          >
            <span>Activar cuenta</span>
            <span className="text-xs text-green-400/60 font-normal">Restaura el acceso</span>
          </button>
        )}

        {/* Ban / Unban */}
        {isBanned ? (
          <button
            onClick={() => handleAction(() => unbanUser(userId))}
            disabled={isPending}
            className={`${actionBtnClass} border-green-500/30 text-green-400 hover:bg-green-500/10`}
          >
            <span>Levantar ban</span>
            <span className="text-xs text-green-400/60 font-normal">Restaura el acceso</span>
          </button>
        ) : (
          <div>
            {!showBanInput ? (
              <button
                onClick={() => setShowBanInput(true)}
                disabled={isPending}
                className={`${actionBtnClass} border-red-500/30 text-red-400 hover:bg-red-500/10`}
              >
                <span>Banear usuario</span>
                <span className="text-xs text-red-400/60 font-normal">Bloqueo permanente</span>
              </button>
            ) : (
              <div className="border border-red-500/40 rounded-xl p-3 space-y-2">
                <p className="text-xs text-red-400 font-semibold">Motivo del ban *</p>
                <textarea
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Ej: Múltiples cancelaciones sin aviso..."
                  rows={2}
                  className="w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-xs text-text placeholder:text-sub focus:outline-none resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowBanInput(false)
                      setBanReason('')
                    }}
                    className="flex-1 text-xs py-1.5 border border-border rounded-lg text-muted hover:bg-card"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      if (!banReason.trim()) return
                      handleAction(() => banUser(userId, banReason))
                      setShowBanInput(false)
                      setBanReason('')
                    }}
                    disabled={!banReason.trim() || isPending}
                    className="flex-1 text-xs py-1.5 bg-red-500 text-white rounded-lg font-semibold disabled:opacity-50"
                  >
                    Confirmar ban
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Booking history */}
      {bookings.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm text-text mb-2">Historial de reservas</h3>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="divide-y divide-border max-h-64 overflow-y-auto">
              {bookings.map((booking) => (
                <div key={booking.id} className="flex items-center gap-3 px-3 py-2.5 text-xs">
                  <div className="flex-1 min-w-0">
                    <p className="text-text font-medium truncate">{booking.clubName}</p>
                    <p className="text-muted">
                      {booking.courtName} · {booking.date} {booking.startTime}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 px-1.5 py-0.5 rounded font-medium ${
                      booking.status === 'CONFIRMED'
                        ? 'text-green-400 bg-green-400/10'
                        : booking.status === 'CANCELLED'
                          ? 'text-red-400 bg-red-400/10'
                          : booking.status === 'PENDING'
                            ? 'text-yellow-400 bg-yellow-400/10'
                            : 'text-muted bg-muted/10'
                    }`}
                  >
                    {booking.status === 'CONFIRMED'
                      ? 'Conf.'
                      : booking.status === 'CANCELLED'
                        ? 'Canc.'
                        : booking.status === 'PENDING'
                          ? 'Pend.'
                          : 'Comp.'}
                  </span>
                  {(booking.status === 'CONFIRMED' || booking.status === 'PENDING') && (
                    <button
                      onClick={() => handleAction(() => cancelUserBooking(booking.id))}
                      disabled={isPending}
                      className="shrink-0 text-xs text-red-400 hover:underline disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
