'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useBookingMutations } from '@/features/reservas/hooks/useBookings'
import { formatPrice, minutesToTime, timeToMinutes } from '@/lib/availability'
import { getBlockClass, getSourceLabel, isBlockSource } from '../helpers/bookingGrid.helpers'
import type { BookingBlock } from '../types/bookingGrid.types'

const POPOVER_WIDTH = 272
const POPOVER_MARGIN = 10

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function cleanPhone(phone: string): string {
  return phone.replace(/[\s\-().+]/g, '')
}

const STATUS_CONFIG = {
  PENDING:   { label: 'Pendiente',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  CONFIRMED: { label: 'Confirmada', color: '#4ade80', bg: 'rgba(74,222,128,0.12)'  },
  COMPLETED: { label: 'Completada', color: 'var(--muted)', bg: 'rgba(255,255,255,0.06)' },
  CANCELLED: { label: 'Cancelada',  color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
} as const

const PAYMENT_CONFIG = {
  PAID:     { label: 'Cobrado',          color: '#4ade80', showToggle: true  },
  UNPAID:   { label: 'Sin cobrar',       color: '#f87171', showToggle: true  },
  REFUNDED: { label: 'Reembolsado',      color: '#fb923c', showToggle: false },
  MANUAL:   { label: 'Cobrado (manual)', color: '#a3e635', showToggle: true  },
} as const

interface BookingQuickPopoverProps {
  booking: BookingBlock
  courtName: string
  anchorX: number
  anchorY: number
  onClose: () => void
  onOpenDetail: () => void
}

export default function BookingQuickPopover({
  booking: b,
  courtName,
  anchorX,
  anchorY,
  onClose,
  onOpenDetail,
}: BookingQuickPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  const { cancel, updatePayment, approveException } = useBookingMutations(b.clubId ?? '')
  const loading = cancel.isPending || updatePayment.isPending || approveException.isPending

  // ── Positioning ───────────────────────────────────────────────────────
  const pos = (() => {
    if (typeof window === 'undefined') return { left: anchorX, top: anchorY }
    const estimatedHeight = isBlockSource(b.source) ? 160 : 340
    const offsetX = 18

    let left = anchorX + offsetX
    if (left + POPOVER_WIDTH > window.innerWidth - POPOVER_MARGIN) {
      left = anchorX - POPOVER_WIDTH - offsetX
    }
    left = Math.max(POPOVER_MARGIN, left)

    let top = anchorY - 40
    if (top + estimatedHeight > window.innerHeight - POPOVER_MARGIN) {
      top = window.innerHeight - estimatedHeight - POPOVER_MARGIN
    }
    top = Math.max(POPOVER_MARGIN, top)

    return { left, top }
  })()

  // ── Close on outside click / Escape ──────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    function onPointerDown(e: PointerEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const t = setTimeout(() => document.addEventListener('pointerdown', onPointerDown), 120)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      clearTimeout(t)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [onClose])

  // ── Derived data ─────────────────────────────────────────────────────
  const endTime = minutesToTime(timeToMinutes(b.startTime) + b.durationMinutes)
  const durationLabel = b.durationMinutes % 60 === 0
    ? `${b.durationMinutes / 60}h`
    : `${b.durationMinutes} min`

  const isBlock     = isBlockSource(b.source)
  const isCancelled = b.status === 'CANCELLED'
  const statusCfg   = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.PENDING
  const paymentCfg  = PAYMENT_CONFIG[b.paymentStatus] ?? PAYMENT_CONFIG.UNPAID
  const isPaid      = b.paymentStatus === 'PAID' || b.paymentStatus === 'MANUAL'
  const typeLabel   = getSourceLabel(b.source, b.status, b.recurringBookingId)
  const blockClass  = getBlockClass(b.source, b.status, b.recurringBookingId)
  const phone       = b.manualPhone ?? null
  const primaryPlayer = b.playerDetails?.[0]
  const showPaymentSection = !isBlock && !isCancelled
  const showPayToggle = showPaymentSection && paymentCfg.showToggle && !confirmingCancel
  const showWarning = !!b.outOfHoursWarning && !isCancelled
  const showApproveException = showWarning && !b.exceptionApprovedAt && !confirmingCancel

  // ── Handlers ─────────────────────────────────────────────────────────
  async function handleTogglePayment() {
    const newStatus = isPaid ? 'UNPAID' : 'PAID'
    const res = await updatePayment.mutateAsync({ id: b.id, status: newStatus })
    if (!res.success) { toast.error(res.error ?? 'Error al actualizar.'); return }
    toast.success(newStatus === 'PAID' ? 'Reserva cobrada.' : 'Marcada como sin cobrar.')
    onClose()
  }

  async function handleApproveException() {
    const res = await approveException.mutateAsync(b.id)
    if (!res.success) { toast.error(res.error ?? 'Error al aprobar.'); return }
    toast.success('Excepción aprobada.')
    onClose()
  }

  async function handleCancel() {
    const res = await cancel.mutateAsync(b.id)
    if (!res.success) { toast.error(res.error ?? 'Error al cancelar.'); return }
    onClose()
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div
      ref={popoverRef}
      className="fixed z-[80] rounded-xl overflow-hidden shadow-2xl border animate-in fade-in zoom-in-95 duration-100"
      style={{ left: pos.left, top: pos.top, width: POPOVER_WIDTH, borderColor: 'var(--border-hover)', background: 'var(--card)' }}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="px-3.5 pt-3 pb-2.5" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        {/* Row 1: colored indicator + badges + close */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <div
              className={`booking-block ${blockClass}`}
              style={{ position: 'static', padding: 0, border: 'none', borderLeft: '3px solid', borderRadius: 99, width: 3, height: 16, flexShrink: 0 }}
            />
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-card border border-border text-muted">
              {typeLabel}
            </span>
            {!isBlock && (
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider border"
                style={{ color: statusCfg.color, background: statusCfg.bg, borderColor: `${statusCfg.color}30` }}
              >
                {statusCfg.label}
              </span>
            )}
            {b.isOpenMatch && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider border border-accent/30 text-accent bg-accent/10">
                Abierto
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-5 h-5 flex items-center justify-center rounded text-muted hover:text-text transition-colors shrink-0"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Row 2: name + time + court */}
        <p className="text-[13px] font-bold leading-snug text-text truncate">{b.displayName}</p>
        <p className="text-[11px] mt-0.5 text-muted">
          {b.startTime} – {endTime}&nbsp;·&nbsp;{durationLabel}&nbsp;·&nbsp;{courtName}
        </p>
      </div>

      {/* ── Aviso fuera de horario ───────────────────────────────────── */}
      {showWarning && (
        <div
          className="flex items-center gap-2 px-3.5 py-2"
          style={{ background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid rgba(245,158,11,0.2)' }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0" style={{ color: '#f59e0b' }}>
            <path d="M6 1L11 10H1L6 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            <path d="M6 5v2.5M6 8.5h.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <span className="text-[11px] font-medium" style={{ color: '#f59e0b' }}>Reserva fuera de horario habitual</span>
        </div>
      )}

      {/* ── Aprobar excepción ───────────────────────────────────────── */}
      {showApproveException && (
        <button
          onClick={handleApproveException}
          disabled={loading}
          className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-card-hover transition-colors disabled:opacity-40"
          style={{ borderBottom: '1px solid var(--border)', background: 'rgba(245,158,11,0.05)' }}
        >
          <span className="text-[11px] font-medium" style={{ color: '#f59e0b' }}>Aprobar excepción</span>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ color: '#f59e0b' }}>
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {/* ── Jugador ─────────────────────────────────────────────────── */}
      {(primaryPlayer ?? phone) && !isBlock && (
        <div className="flex items-center gap-2.5 px-3.5 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 bg-surface border border-border text-muted">
            {initials(primaryPlayer?.name ?? b.displayName)}
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-text truncate">{primaryPlayer?.name ?? b.displayName}</p>
            {phone && <p className="text-[11px] text-muted truncate">{phone}</p>}
          </div>
        </div>
      )}

      {/* ── Precio + estado de pago ──────────────────────────────────── */}
      {showPaymentSection && (
        <div
          className="flex items-center justify-between px-3.5 py-2"
          style={{ borderBottom: paymentCfg.showToggle ? '1px solid var(--border)' : undefined }}
        >
          <span className="text-[11px] text-muted">Total</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold text-text">{formatPrice(b.totalPrice)}</span>
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded border"
              style={{ color: paymentCfg.color, background: `${paymentCfg.color}15`, borderColor: `${paymentCfg.color}30` }}
            >
              {paymentCfg.label}
            </span>
          </div>
        </div>
      )}

      {/* ── Toggle cobrado/sin cobrar ────────────────────────────────── */}
      {showPayToggle && (
        <button
          onClick={handleTogglePayment}
          disabled={loading}
          className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-card-hover transition-colors disabled:opacity-40"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <span className="text-[11px] text-muted">Marcar como</span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold" style={{ color: isPaid ? '#f87171' : '#4ade80' }}>
              {isPaid ? 'Sin cobrar' : 'Cobrado'}
            </span>
            <div
              className="relative w-8 h-[18px] rounded-full transition-colors"
              style={{ background: isPaid ? 'rgba(74,222,128,0.18)' : 'rgba(248,113,113,0.15)' }}
            >
              <div
                className="absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all duration-200"
                style={{ left: isPaid ? 'calc(100% - 16px)' : '2px', background: isPaid ? '#4ade80' : '#f87171' }}
              />
            </div>
          </div>
        </button>
      )}

      {/* ── Confirmación de cancelación ──────────────────────────────── */}
      {confirmingCancel && (
        <div className="px-3.5 py-2.5 flex flex-col gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <p className="text-[12px] text-center text-muted">¿Cancelar esta reserva?</p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmingCancel(false)}
              disabled={loading}
              className="flex-1 py-2 rounded-lg border border-border text-muted text-[12px] font-medium hover:text-text transition-colors disabled:opacity-40"
            >
              No
            </button>
            <button
              onClick={handleCancel}
              disabled={loading}
              className="flex-1 py-2 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-40"
              style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.35)', color: '#f87171' }}
            >
              {loading ? 'Cancelando...' : 'Sí, cancelar'}
            </button>
          </div>
        </div>
      )}

      {/* ── Acciones ────────────────────────────────────────────────── */}
      {!confirmingCancel && (
        <div className="flex flex-col">
          {/* WhatsApp + Ver detalle */}
          <div className={`grid ${!isCancelled && !isBlock ? 'grid-cols-2' : 'grid-cols-1'}`} style={{ borderBottom: !isCancelled && !isBlock ? '1px solid var(--border)' : undefined }}>
            {phone ? (
              <a
                href={`https://wa.me/${cleanPhone(phone)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-medium hover:bg-card-hover transition-colors"
                style={{ color: '#4dc870', borderRight: !isCancelled && !isBlock ? '1px solid var(--border)' : undefined }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                WhatsApp
              </a>
            ) : (
              <button
                disabled
                className="flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-medium opacity-25 cursor-not-allowed"
                style={{ color: '#4dc870', borderRight: !isCancelled && !isBlock ? '1px solid var(--border)' : undefined }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                WhatsApp
              </button>
            )}

            {(!isCancelled || isBlock) && (
              <button
                onClick={onOpenDetail}
                className="flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-medium text-muted hover:text-text hover:bg-card-hover transition-colors"
              >
                Ver detalle
                <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5h6M5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}

            {isCancelled && (
              <button
                onClick={onOpenDetail}
                className="col-span-2 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-medium text-muted hover:text-text hover:bg-card-hover transition-colors"
              >
                Ver detalle
                <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5h6M5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>

          {/* Cancelar */}
          {!isCancelled && !isBlock && (
            <button
              onClick={() => setConfirmingCancel(true)}
              disabled={loading}
              className="w-full py-2 text-[11px] font-medium transition-colors hover:bg-red-400/5 disabled:opacity-40"
              style={{ color: '#f87171' }}
            >
              Cancelar reserva
            </button>
          )}
        </div>
      )}
    </div>
  )
}
