'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { minutesToTime } from '@/lib/availability'
import type { PendingCreate } from '../hooks/useBookingDragCreate'
import type { CourtColumn } from '../types/bookingGrid.types'
import type { CreateManualBookingInput } from '@/features/reservas/actions/bookings'

type CreateAction = (data: CreateManualBookingInput) => Promise<{ success: boolean; error?: string; data?: { bookingId?: string } }>

interface DragCreatePopoverProps {
  pendingCreate: PendingCreate
  clubId: string
  date: string
  courts: CourtColumn[]
  createManualBookingAction: CreateAction
  onCancel: () => void
  onCreated: (bookingId: string | undefined) => void
  isOutOfBounds?: boolean
}

function fmtDur(d: number) {
  if (d < 60) return `${d} min`
  const h = Math.floor(d / 60)
  const m = d % 60
  return m === 0 ? `${h}h` : `${h}h ${m}min`
}

export default function DragCreatePopover({
  pendingCreate,
  clubId,
  date,
  courts,
  createManualBookingAction,
  onCancel,
  onCreated,
  isOutOfBounds,
}: DragCreatePopoverProps) {
  const { ghost, courtId, popoverPos } = pendingCreate
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const court = courts.find((c) => c.id === courtId)
  const startTime = minutesToTime(ghost.startMin)
  const endTime = minutesToTime(ghost.startMin + ghost.durationMinutes)

  useEffect(() => {
    nameInputRef.current?.focus()
  }, [])

  // Close on Escape or outside click
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    function onPointerDown(e: PointerEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    const t = setTimeout(() => document.addEventListener('pointerdown', onPointerDown), 120)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      clearTimeout(t)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [onCancel])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    startTransition(async () => {
      const result = await createManualBookingAction({
        clubId,
        courtId,
        date,
        startTime,
        durationMinutes: ghost.durationMinutes,
        bookingType: 'PRESENCIAL',
        manualName: name.trim(),
        manualPhone: phone.trim() || undefined,
      })
      if (result.success) {
        toast.success('Reserva creada', { position: 'bottom-right' })
        onCreated(result.data?.bookingId)
      } else {
        setError(result.error ?? 'Error al crear la reserva.')
      }
    })
  }

  const inputCls = 'w-full bg-card border border-border rounded-lg px-3 py-2 text-[13px] text-text outline-none transition-colors placeholder:text-muted focus:border-accent font-[inherit]'
  const ring = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50'

  return (
    <div
      ref={popoverRef}
      className="fixed z-[80] w-[240px] rounded-xl border border-border-hover bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-100 overflow-hidden"
      style={{ left: popoverPos.x, top: popoverPos.y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="px-3.5 pt-3 pb-2 border-b border-border bg-surface">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Nueva reserva</p>
          <button
            type="button"
            onClick={onCancel}
            className="w-5 h-5 flex items-center justify-center rounded text-muted hover:text-text transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <p className="text-[12px] font-semibold text-text truncate">{court?.name}</p>
        <p className="text-[11px] font-mono text-muted">{startTime} – {endTime} · {fmtDur(ghost.durationMinutes)}</p>
        {isOutOfBounds && (
          <p className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-amber-400">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Fuera del horario operativo
          </p>
        )}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-3 flex flex-col gap-2">
        <input
          ref={nameInputRef}
          type="text"
          placeholder="Nombre del cliente *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={isPending}
          className={`${inputCls} ${ring}`}
        />
        <input
          type="tel"
          placeholder="Teléfono (opcional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={isPending}
          className={`${inputCls} ${ring}`}
        />
        {error && (
          <p className="text-[11px] text-red-400 bg-red-400/8 border border-red-400/20 rounded-lg px-2.5 py-2">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!name.trim() || isPending}
          className={`w-full px-4 py-2 rounded-lg bg-accent text-accent-text text-[12px] font-bold
                      cursor-pointer transition-all enabled:hover:bg-accent-dark active:enabled:scale-[.98]
                      disabled:opacity-35 disabled:cursor-not-allowed ${ring}`}
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-1.5">
              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity=".2" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              Creando…
            </span>
          ) : 'Crear reserva'}
        </button>
      </form>
    </div>
  )
}
