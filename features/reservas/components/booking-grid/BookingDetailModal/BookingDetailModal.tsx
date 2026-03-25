'use client'

import { useEffect, useState } from 'react'
import { useBookingMutations } from '@/features/reservas/hooks/useBookings'
import type { BookingBlock } from '../types/bookingGrid.types'
import {
  getBlockClass,
  minutesToTime,
  timeToMinutes,
} from '../helpers/bookingGrid.helpers'
import BookingDetailInfoSection from './BookingDetailInfoSection/BookingDetailInfoSection'
import BookingDetailEditSection from './BookingDetailEditSection/BookingDetailEditSection'
import BookingDetailPaymentSection from './BookingDetailPaymentSection/BookingDetailPaymentSection'
import BookingDetailActionButtons from './BookingDetailActionButtons/BookingDetailActionButtons'

interface BookingDetailProps {
  booking: BookingBlock | null
  onClose: () => void
}

export default function BookingDetailModal({ booking, onClose }: BookingDetailProps) {
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editStartTime, setEditStartTime] = useState('')
  const [editDuration, setEditDuration] = useState(0)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')

  const [localPlayers, setLocalPlayers] = useState<{ id: string; name: string }[]>([])
  const [localPaidIds, setLocalPaidIds] = useState<string[]>([])
  const [playersDirty, setPlayersDirty] = useState(false)
  const { cancel, confirm, updatePayment, updateTime, updatePlayers } = useBookingMutations(
    booking?.clubId ?? ''
  )
  const loading =
    cancel.isPending ||
    confirm.isPending ||
    updatePayment.isPending ||
    updateTime.isPending ||
    updatePlayers.isPending

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // Reset local editing state when the selected booking changes
    setLocalPlayers(booking?.playerDetails ?? [])
    setLocalPaidIds(booking?.paidPlayerIds ?? [])
    setPlayersDirty(false)
    setError(null)
    setIsEditing(false)
  }, [booking?.id, booking?.playerDetails, booking?.paidPlayerIds])
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!booking) return null
  const activeBooking = booking

  function togglePaid(playerId: string) {
    setLocalPaidIds((prev) =>
      prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId]
    )
    setPlayersDirty(true)
  }

  function removePlayer(playerId: string) {
    setLocalPlayers((prev) => prev.filter((p) => p.id !== playerId))
    setLocalPaidIds((prev) => prev.filter((id) => id !== playerId))
    setPlayersDirty(true)
  }

  async function handleSavePlayers() {
    setError(null)
    try {
      const res = await updatePlayers.mutateAsync({
        id: activeBooking.id,
        playerIds: localPlayers.map((p) => p.id),
        paidPlayerIds: localPaidIds,
      })
      if (!res.success) { setError(res.error ?? 'Error al guardar jugadores.'); return }
      setPlayersDirty(false)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar jugadores.')
    }
  }

  async function handleCancel() {
    setError(null)
    try {
      const res = await cancel.mutateAsync(activeBooking.id)
      if (!res.success) { setError(res.error ?? 'Error al cancelar. Intentá de nuevo.'); return }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cancelar. Intentá de nuevo.')
    }
  }

  async function handleConfirm() {
    setError(null)
    try {
      const res = await confirm.mutateAsync(activeBooking.id)
      if (!res.success) { setError(res.error ?? 'Error al confirmar. Intentá de nuevo.'); return }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al confirmar. Intentá de nuevo.')
    }
  }

  async function handlePayment(status: 'PAID' | 'UNPAID' | 'MANUAL') {
    setError(null)
    try {
      const res = await updatePayment.mutateAsync({ id: activeBooking.id, status })
      if (!res.success) { setError(res.error ?? 'Error al actualizar el pago. Intentá de nuevo.'); return }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al actualizar el pago. Intentá de nuevo.')
    }
  }

  async function handleSaveEdit() {
    setError(null)
    try {
      const res = await updateTime.mutateAsync({
        id: activeBooking.id,
        data: {
          startTime: editStartTime,
          durationMinutes: editDuration,
          manualName: editName,
          manualPhone: editPhone,
        },
      })
      if (!res.success) { setError(res.error ?? 'Error al guardar. Intentá de nuevo.'); return }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar. Intentá de nuevo.')
    }
  }

  function openEdit() {
    setEditStartTime(activeBooking.startTime)
    setEditDuration(activeBooking.durationMinutes)
    setEditName(activeBooking.displayName)
    setEditPhone(activeBooking.manualPhone ?? '')
    setError(null)
    setIsEditing(true)
  }

  const blockClass = getBlockClass(
    activeBooking.source,
    activeBooking.status,
    activeBooking.recurringBookingId
  )
  const endTime = minutesToTime(
    timeToMinutes(activeBooking.startTime) + activeBooking.durationMinutes
  )

  const sourceLabel =
    activeBooking.source === 'BLOCK' && activeBooking.recurringBookingId
      ? 'Turno fijo'
      : activeBooking.source === 'BLOCK'
        ? 'Bloqueo'
        : activeBooking.source === 'ONLINE'
          ? 'Reserva online'
          : 'Reserva manual'

  const statusLabel =
    activeBooking.status === 'CONFIRMED'
      ? 'Confirmada'
      : activeBooking.status === 'CANCELLED'
        ? 'Cancelada'
        : 'Pendiente'

  const statusColor =
    activeBooking.status === 'CONFIRMED'
      ? 'text-accent'
      : activeBooking.status === 'CANCELLED'
        ? 'text-red-400'
        : 'text-orange-400'

  const payLabel =
    activeBooking.paymentStatus === 'PAID'
      ? 'Pagado'
      : activeBooking.paymentStatus === 'MANUAL'
        ? 'Manual'
        : 'Sin cobrar'

  const payColor =
    activeBooking.paymentStatus === 'PAID'
      ? 'text-green-400'
      : activeBooking.paymentStatus === 'MANUAL'
        ? 'text-muted'
        : 'text-orange-400'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-surface rounded-2xl border border-border-hover p-5 shadow-2xl animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div
              className={`booking-block ${blockClass}`}
              style={{
                position: 'static',
                padding: 0,
                border: 'none',
                borderLeft: '3px solid',
                borderRadius: 99,
                width: 4,
                height: 24,
                flexShrink: 0,
              }}
            />
            <span className="font-semibold text-text text-sm">{sourceLabel}</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar detalle de reserva"
            className="w-7 h-7 flex items-center justify-center rounded-full bg-card hover:bg-card-hover text-muted hover:text-text transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Info or Edit */}
        {isEditing ? (
          <BookingDetailEditSection
            editStartTime={editStartTime}
            editDuration={editDuration}
            editName={editName}
            editPhone={editPhone}
            source={activeBooking.source}
            onStartTimeChange={setEditStartTime}
            onDurationChange={setEditDuration}
            onNameChange={setEditName}
            onPhoneChange={setEditPhone}
          />
        ) : (
          <BookingDetailInfoSection
            booking={activeBooking}
            endTime={endTime}
            statusLabel={statusLabel}
            statusColor={statusColor}
            payLabel={payLabel}
            payColor={payColor}
          />
        )}

        {/* Players/Payment */}
        {activeBooking.source !== 'BLOCK' && !isEditing && (
          <BookingDetailPaymentSection
            localPlayers={localPlayers}
            localPaidIds={localPaidIds}
            playersDirty={playersDirty}
            loading={loading}
            onTogglePaid={togglePaid}
            onRemovePlayer={removePlayer}
            onSavePlayers={handleSavePlayers}
          />
        )}

        {error && (
          <p className="text-xs text-red-400 mb-3 bg-red-400/5 border border-red-400/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Action buttons */}
        <BookingDetailActionButtons
          booking={activeBooking}
          loading={loading}
          isEditing={isEditing}
          onCancelEdit={() => { setIsEditing(false); setError(null) }}
          onSaveEdit={handleSaveEdit}
          onCancel={handleCancel}
          onConfirm={handleConfirm}
          onPayment={handlePayment}
          onEdit={openEdit}
        />
      </div>

    </div>
  )
}
