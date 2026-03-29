import { useState } from 'react'
import type { BookingBlock } from '../../types/bookingGrid.types'
import { isBlockSource } from '../../helpers/bookingGrid.helpers'

interface BookingDetailActionButtonsProps {
  booking: BookingBlock
  loading: boolean
  isEditing: boolean
  onCancelEdit: () => void
  onSaveEdit: () => void
  onCancel: () => void
  onPayment: (status: 'PAID' | 'UNPAID') => void
  onEdit: () => void
}

export default function BookingDetailActionButtons({
  booking,
  loading,
  isEditing,
  onCancelEdit,
  onSaveEdit,
  onCancel,
  onPayment,
  onEdit,
}: BookingDetailActionButtonsProps) {
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  if (isEditing) {
    return (
      <div className="flex gap-2">
        <button
          onClick={onCancelEdit}
          disabled={loading}
          className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm font-medium hover:text-text transition-colors disabled:opacity-40"
        >
          Cancelar
        </button>
        <button
          onClick={onSaveEdit}
          disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-accent text-accent-text text-sm font-semibold hover:bg-accent-dark transition-colors disabled:opacity-40"
        >
          {loading ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    )
  }

  // Confirmación inline antes de cancelar
  if (confirmingCancel) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-center text-muted pb-1">¿Cancelar esta reserva?</p>
        <div className="flex gap-2">
          <button
            onClick={() => setConfirmingCancel(false)}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm font-medium hover:text-text transition-colors disabled:opacity-40"
          >
            No
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-400/10 border border-red-400/40 text-red-400 text-sm font-semibold hover:bg-red-400/20 transition-colors disabled:opacity-40"
          >
            {loading ? 'Cancelando...' : 'Sí, cancelar'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {booking.status !== 'CANCELLED' && !isBlockSource(booking.source) && (
        <div className="flex gap-2">
          {booking.paymentStatus !== 'PAID' && (
            <button
              onClick={() => onPayment('PAID')}
              disabled={loading}
              className="flex-1 py-2 rounded-xl bg-green-400/10 border border-green-400/30 text-green-400
                         text-xs font-semibold hover:bg-green-400/20 transition-colors disabled:opacity-40"
            >
              {loading ? 'Guardando...' : '$ Cobrado'}
            </button>
          )}
          {booking.paymentStatus === 'PAID' && (
            <button
              onClick={() => onPayment('UNPAID')}
              disabled={loading}
              className="flex-1 py-2 rounded-xl bg-orange-400/10 border border-orange-400/30 text-orange-400
                         text-xs font-semibold hover:bg-orange-400/20 transition-colors disabled:opacity-40"
            >
              {loading ? 'Guardando...' : 'Sin cobrar'}
            </button>
          )}
        </div>
      )}

      {booking.status !== 'CANCELLED' && (
        <div className="flex gap-2">
          {!isBlockSource(booking.source) && booking.source !== 'ONLINE' && (
            <button
              onClick={onEdit}
              disabled={loading}
              className="px-3 py-2.5 rounded-xl border border-border text-muted text-sm
                         hover:text-text hover:border-border-hover transition-colors disabled:opacity-40"
            >
              Editar
            </button>
          )}
          <button
            onClick={() => setConfirmingCancel(true)}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-red-400/30 text-red-400 text-sm
                         font-medium hover:bg-red-400/5 transition-colors disabled:opacity-40"
          >
            Cancelar reserva
          </button>
        </div>
      )}

    </div>
  )
}
