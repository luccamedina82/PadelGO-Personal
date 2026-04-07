'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useBookingMutations } from '@/features/reservas/hooks/useBookings'
import type { BookingBlock } from '../types/bookingGrid.types'
import { minutesToTime, timeToMinutes } from '@/lib/availability'
import { getBlockClass, isBlockSource } from '../helpers/bookingGrid.helpers'
import BookingDetailInfoSection from '../BookingDetailModal/BookingDetailInfoSection/BookingDetailInfoSection'
import BookingDetailEditSection from '../BookingDetailModal/BookingDetailEditSection/BookingDetailEditSection'
import BookingDetailActionButtons from '../BookingDetailModal/BookingDetailActionButtons/BookingDetailActionButtons'

interface BookingDetailDrawerProps {
  booking: BookingBlock | null
  onClose: () => void
  closeTimeMinutes?: number
  openTimeMinutes?: number
  defaultEditing?: boolean
}

export default function BookingDetailDrawer({
  booking,
  onClose,
  closeTimeMinutes,
  openTimeMinutes,
  defaultEditing,
}: BookingDetailDrawerProps) {
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editStartTime, setEditStartTime] = useState('')
  const [editDuration, setEditDuration] = useState(0)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')

  const { cancel, updatePayment, updateTime } = useBookingMutations(booking?.clubId ?? '')
  const loading = cancel.isPending || updatePayment.isPending || updateTime.isPending

  // Slide in when booking is set
  useEffect(() => {
    if (booking) {
      requestAnimationFrame(() => setVisible(true))
    }
  }, [booking])

  // Reset state on booking change
  useEffect(() => {
    setError(null)
    setIsEditing(false)
  }, [booking?.id])

  useEffect(() => {
    if (defaultEditing && booking) {
      setEditStartTime(booking.startTime)
      setEditDuration(booking.durationMinutes)
      setEditName(booking.displayName)
      setEditPhone(booking.manualPhone ?? '')
      setIsEditing(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Close on Escape
  useEffect(() => {
    if (!booking) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 220)
  }

  if (!booking) return null
  const activeBooking = booking

  async function handleCancel() {
    setError(null)
    try {
      const res = await cancel.mutateAsync(activeBooking.id)
      if (!res.success) { setError(res.error ?? 'Error al cancelar. Intentá de nuevo.'); return }
      handleClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cancelar. Intentá de nuevo.')
    }
  }

  async function handlePayment(status: 'PAID' | 'UNPAID') {
    setError(null)
    try {
      const res = await updatePayment.mutateAsync({ id: activeBooking.id, status })
      if (!res.success) { setError(res.error ?? 'Error al actualizar el pago. Intentá de nuevo.'); return }
      toast.success(status === 'UNPAID' ? 'Marcado como sin cobrar.' : 'Reserva cobrada.')
      handleClose()
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
      handleClose()
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

  const blockClass = getBlockClass(activeBooking.source, activeBooking.status, activeBooking.recurringBookingId)
  const endTime = minutesToTime(timeToMinutes(activeBooking.startTime) + activeBooking.durationMinutes)

  const sourceLabel =
    activeBooking.source === 'BLOCK' && activeBooking.recurringBookingId
      ? 'Turno fijo'
      : activeBooking.source === 'BLOCK'
        ? 'Bloqueo'
        : activeBooking.source === 'ONLINE'
          ? 'Reserva online'
          : 'Reserva manual'

  const statusLabel =
    activeBooking.status === 'CONFIRMED' ? 'Confirmada'
    : activeBooking.status === 'CANCELLED' ? 'Cancelada'
    : activeBooking.status === 'COMPLETED' ? 'Completada'
    : 'Pendiente'

  const statusColor =
    activeBooking.status === 'CONFIRMED' ? 'text-green-400'
    : activeBooking.status === 'CANCELLED' ? 'text-red-400'
    : activeBooking.status === 'COMPLETED' ? 'text-muted'
    : 'text-yellow-400'

  const payLabel =
    activeBooking.paymentStatus === 'PAID'     ? 'Pagado'
    : activeBooking.paymentStatus === 'MANUAL'   ? 'Cobrado (manual)'
    : activeBooking.paymentStatus === 'REFUNDED' ? 'Reembolsado'
    : 'Sin cobrar'

  const payColor =
    activeBooking.paymentStatus === 'PAID'     ? 'text-green-400'
    : activeBooking.paymentStatus === 'MANUAL'   ? 'text-lime-400'
    : activeBooking.paymentStatus === 'REFUNDED' ? 'text-orange-400'
    : 'text-red-400'

  return (
    <>
      {/* Backdrop — subtle, doesn't block grid */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] transition-opacity duration-200"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={handleClose}
      />

      {/* Drawer panel */}
      <div
        className="fixed right-0 top-0 h-full z-50 w-[340px] bg-surface border-l border-border shadow-2xl flex flex-col transition-transform duration-200 ease-out"
        style={{ transform: visible ? 'translateX(0)' : 'translateX(100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
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
            onClick={handleClose}
            aria-label="Cerrar detalle de reserva"
            className="w-7 h-7 flex items-center justify-center rounded-full bg-card hover:bg-card-hover text-muted hover:text-text transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4 min-h-0">
          {isEditing ? (
            <BookingDetailEditSection
              editStartTime={editStartTime}
              editDuration={editDuration}
              editName={editName}
              editPhone={editPhone}
              source={activeBooking.source}
              closeTimeMinutes={closeTimeMinutes}
              openTimeMinutes={openTimeMinutes}
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

          {error && (
            <p className="text-xs text-red-400 bg-red-400/5 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="px-5 py-4 border-t border-border shrink-0">
          <BookingDetailActionButtons
            booking={activeBooking}
            loading={loading}
            isEditing={isEditing}
            onCancelEdit={defaultEditing ? handleClose : () => { setIsEditing(false); setError(null) }}
            onSaveEdit={handleSaveEdit}
            onCancel={handleCancel}
            onPayment={handlePayment}
            onEdit={openEdit}
          />
        </div>
      </div>
    </>
  )
}
