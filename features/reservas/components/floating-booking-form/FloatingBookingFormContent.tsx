'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { calcBookingPrice, formatPrice, timeToMinutes } from '@/lib/availability'
import { createManualBooking } from '@/features/reservas/actions/bookings'
import {
  getFloatingFormDataAction,
  type FloatingFormCourtSlots,
} from '@/features/reservas/actions/floatingFormData'
import {
  getAvailableDurationsForCourt,
  getVisibleTimeSlotsForDate,
} from './helpers/bookingCalcUtils'
import { computeEndTime, formatDateFull } from './helpers/manualBookingWizard.helpers'
import { PriceRuleDisplay } from './PriceRuleDisplay'
import { CalendarPopover } from '@/features/reservas/components/ui/CalendarPopover'
import type { CourtColumn } from '@/features/reservas/components/booking-grid/BookingGrid'
import type { FloatingFormInitialData } from '@/app/(owner)/admin/reservas/BookingsClient'
import type { BookingBlock } from '@/features/reservas/components/booking-grid/types/bookingGrid.types'

interface Props {
  clubId: string
  courts: CourtColumn[]
  baseStart?: number
  baseEnd?: number
  baseBookingRule?: { startTime: string; endTime: string; price: number | null } | null
  initialData: FloatingFormInitialData
  onClose: () => void
  onCreated: (bookingId?: string) => void
}

type BookingMode = 'RESERVA' | 'BLOQUEO'

function fmtDur(d: number) {
  return d < 60 ? `${d}min` : d % 60 === 0 ? `${d / 60}h` : `${Math.floor(d / 60)}h ${d % 60}min`
}

function getBlockEndOptions(startTime: string): string[] {
  const [h = '0', m = '0'] = startTime.split(':')
  const startMin = parseInt(h) * 60 + parseInt(m)
  const opts: string[] = []
  for (let t = startMin + 30; t <= 23 * 60 + 30; t += 30) {
    const hh = Math.floor(t / 60)
    if (hh >= 24) break
    opts.push(`${String(hh).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`)
  }
  return opts
}

export default function FloatingBookingFormContent({
  clubId,
  courts,
  baseStart,
  baseEnd,
  baseBookingRule,
  initialData,
  onClose,
  onCreated,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const queryClient = useQueryClient()
  const router = useRouter()
  const calendarBtnRef = useRef<HTMLButtonElement>(null)

  // ── Slot data ────────────────────────────────────────────────────────────
  const [courtSlots, setCourtSlots] = useState<FloatingFormCourtSlots[]>([])
  const [isLoadingSlots, setIsLoadingSlots] = useState(true)

  // ── Form state ───────────────────────────────────────────────────────────
  const [bookingMode, setBookingMode] = useState<BookingMode>('RESERVA')
  const [date, setDate] = useState(initialData.date)
  const [courtId, setCourtId] = useState(initialData.courtId ?? '')
  const [startTime, setStartTime] = useState(initialData.startTime ?? '')
  const [duration, setDuration] = useState(initialData.durationMinutes ?? 0)
  const [isExpanded, setIsExpanded] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [motivo, setMotivo] = useState('')
  const [blockEndTime, setBlockEndTime] = useState('')
  const [oobConfirmed, setOobConfirmed] = useState(false)
  const [priceOverrideEnabled, setPriceOverrideEnabled] = useState(false)
  const [priceOverrideInput, setPriceOverrideInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const clientNameRef = useRef<HTMLInputElement>(null)

  // ── Duration options derived from selected court (or union of all courts) ──
  const durationOptions = useMemo(() => {
    if (courtId) {
      const court = courts.find((c) => c.id === courtId)
      if (court && court.allowedDurations.length > 0) return court.allowedDurations
    }
    const all = courts.flatMap((c) => c.allowedDurations)
    const unique = [...new Set(all)].sort((a, b) => a - b)
    return unique.length > 0 ? unique : [60, 90, 120]
  }, [courts, courtId])

  // Reset duration when durationOptions change and current value is no longer valid
  useEffect(() => {
    if (duration > 0 && !durationOptions.includes(duration)) {
      setDuration(durationOptions[0] ?? 0)
    }
  }, [durationOptions]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch slot data on date change ───────────────────────────────────────
  useEffect(() => {
    setIsLoadingSlots(true)
    getFloatingFormDataAction(clubId, date).then((data) => {
      if (data) setCourtSlots(data.courtSlots)
      setIsLoadingSlots(false)
    })
  }, [clubId, date])

  // Auto-focus client name when slots are loaded
  useEffect(() => {
    if (!isLoadingSlots) setTimeout(() => clientNameRef.current?.focus(), 50)
  }, [isLoadingSlots])

  // ── Derived ──────────────────────────────────────────────────────────────
  const visibleTimes = getVisibleTimeSlotsForDate(courtSlots, durationOptions)
  const courtsForTime = startTime
    ? bookingMode === 'BLOQUEO'
      ? courts
      : courts.filter((c) => getAvailableDurationsForCourt(startTime, c.id, courtSlots, durationOptions).length > 0)
    : []

  const selectedSlot = courtId && startTime
    ? courtSlots.find((cs) => cs.courtId === courtId)?.slots.find((s) => s.time === startTime)
    : undefined

  const startMin = startTime ? timeToMinutes(startTime) : 0
  const endMin = startMin + duration

  const isOOB =
    !!startTime && duration > 0 && baseStart !== undefined && baseEnd !== undefined &&
    (startMin < baseStart || endMin > baseEnd)

  const basePrice = selectedSlot && duration > 0
    ? calcBookingPrice(selectedSlot.pricePerHour, duration)
    : isOOB && baseBookingRule?.price != null && duration > 0
      ? calcBookingPrice(baseBookingRule.price, duration)
      : 0

  const endTime = startTime && duration > 0 ? computeEndTime(startTime, duration) : null
  const courtName = courts.find((c) => c.id === courtId)?.name ?? ''

  const canSubmit =
    !!courtId && !!startTime && duration > 0 &&
    (bookingMode === 'BLOQUEO' || clientName.trim().length > 0) &&
    (!isOOB || oobConfirmed)

  const isQuick = initialData.mode === 'quick' && !isExpanded
  const showPickers = initialData.mode === 'full' || isExpanded

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleDateChange(d: string) {
    setDate(d)
    setStartTime('')
    setCourtId('')
    setDuration(0)
    setCalendarOpen(false)
    setPriceOverrideEnabled(false)
    setPriceOverrideInput('')
  }

  function handleSelectTime(t: string) {
    setStartTime(t)
    setCourtId('')
    setPriceOverrideEnabled(false)
    setPriceOverrideInput('')
    if (bookingMode === 'RESERVA') {
      const allDurs = courtSlots.flatMap((cs) => {
        const slot = cs.slots.find((s) => s.time === t)
        return slot?.available ? slot.durationOptions : []
      })
      const valid = [...new Set(allDurs)]
      setDuration((prev) => (valid.includes(prev) ? prev : (valid[0] ?? 0)))
    } else {
      setDuration(0)
    }
  }

  function handleCourtDuration(cId: string, dur: number) {
    setCourtId(cId)
    setDuration(dur)
    setPriceOverrideEnabled(false)
    setPriceOverrideInput('')
  }

  function handleBlockEndTimeChange(endT: string) {
    setBlockEndTime(endT)
    if (startTime && endT) {
      const [sh = '0', sm = '0'] = startTime.split(':')
      const [eh = '0', em = '0'] = endT.split(':')
      const dur = (parseInt(eh) * 60 + parseInt(em)) - (parseInt(sh) * 60 + parseInt(sm))
      setDuration(dur > 0 ? dur : 0)
    }
  }

  function handleModeChange(m: BookingMode) {
    setBookingMode(m)
    // Preserve time, court, duration — reset only client/reason fields
    setClientName('')
    setClientPhone('')
    setMotivo('')
    setBlockEndTime('')
    setPriceOverrideEnabled(false)
    setPriceOverrideInput('')
  }

  function handleSubmit() {
    if (!canSubmit) return
    setError(null)
    const priceOverride =
      bookingMode === 'RESERVA' && priceOverrideEnabled && priceOverrideInput.trim() !== ''
        ? parseInt(priceOverrideInput, 10) * 100
        : undefined
    const payload =
      bookingMode === 'RESERVA'
        ? { clubId, courtId, date, startTime, durationMinutes: duration, bookingType: 'PRESENCIAL' as const, manualName: clientName.trim() || undefined, manualPhone: clientPhone.trim() || undefined, priceOverride, outOfHoursWarning: isOOB }
        : { clubId, courtId, date, startTime, durationMinutes: duration, bookingType: 'BLOQUEO' as const, blockReason: motivo.trim() || undefined }

    startTransition(async () => {
      const result = await createManualBooking(payload)
      if (result.success && result.data) {
        const bookingId = result.data.bookingId
        toast.success('Reserva creada', { position: 'bottom-right' })

        // ── Optimistic UI ─────────────────────────────────────────────────
        const optimisticBooking: BookingBlock = {
          id: bookingId,
          clubId,
          courtId: payload.courtId,
          startTime: payload.startTime,
          durationMinutes: payload.durationMinutes,
          status: 'CONFIRMED',
          source: payload.bookingType === 'BLOQUEO' ? 'BLOCK' : 'MANUAL_STAFF',
          displayName:
            payload.bookingType === 'BLOQUEO'
              ? (('blockReason' in payload && payload.blockReason) || 'Bloqueo')
              : (('manualName' in payload && payload.manualName) || '—'),
          totalPrice: priceOverride ?? basePrice,
          paymentStatus: 'UNPAID',
          manualPhone: 'manualPhone' in payload ? (payload.manualPhone ?? null) : null,
          date: payload.date,
        }

        if (payload.date === initialData.date) {
          // Same day: inject optimistically and refresh in background
          queryClient.setQueryData(
            ['bookings', clubId, payload.date],
            (old: BookingBlock[] | undefined) => [...(old ?? []), optimisticBooking]
          )
          window.dispatchEvent(
            new CustomEvent('reservas:refresh', { detail: { bookingId, date: payload.date } })
          )
          onCreated(bookingId)
        } else {
          // Different day: navigate to the new date with highlight
          onCreated(bookingId)
          router.push(`/admin/reservas?date=${payload.date}&highlight=${bookingId}`)
        }
      } else {
        setError(('error' in result ? (result.error as string) : null) ?? 'Error al crear la reserva.')
      }
    })
  }

  const inputCls = 'w-full bg-surface border border-border rounded-[10px] px-3 py-2.5 text-[13px] text-text outline-none focus:border-accent font-[inherit] placeholder:text-muted'
  const ring = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50'

  const getButtonLabel = () => {
    if (isPending) return (
      <span className="flex items-center justify-center gap-1.5">
        <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity=".2"/>
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
        </svg>
        Creando…
      </span>
    )
    if (!startTime) return 'Selecciona un horario'
    if (!courtId) return 'Elegí una cancha'
    if (bookingMode === 'RESERVA' && !clientName.trim()) return 'Ingresá el nombre'
    if (isOOB && !oobConfirmed) return 'Confirmá horario especial'
    return bookingMode === 'BLOQUEO' ? 'Confirmar bloqueo' : 'Guardar reserva'
  }

  return (
    <div className="flex flex-col max-h-[85vh] overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3.5 pb-2.5 border-b border-border shrink-0 bg-surface/30">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex gap-1 bg-surface rounded-lg p-0.5">
            {(['RESERVA', 'BLOQUEO'] as const).map((m) => (
              <button key={m} type="button" onClick={() => handleModeChange(m)}
                className={`px-3 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-all
                  ${bookingMode === m ? 'bg-card text-text shadow-sm' : 'text-muted hover:text-text'}`}>
                {m === 'RESERVA' ? 'Reserva' : 'Bloqueo'}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-surface transition-colors">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 [scrollbar-width:thin]">

        {/* Context: quick summary OR full pickers */}
        {isQuick ? (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-surface border border-border rounded-xl">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-muted uppercase tracking-wide mb-0.5">Turno</p>
              <p className="text-[13px] font-semibold text-text truncate">
                {courtName || '—'} · {startTime}{endTime ? ` – ${endTime}` : ''}{duration > 0 ? ` · ${fmtDur(duration)}` : ''}
              </p>
              <p className="text-[11px] text-muted capitalize">{formatDateFull(date)}</p>
            </div>
            <button type="button" onClick={() => setIsExpanded(true)}
              className="shrink-0 text-[11px] font-semibold text-accent hover:text-accent-dark transition-colors px-2 py-1 rounded-lg hover:bg-accent/10">
              Editar
            </button>
          </div>
        ) : null}

        {showPickers && (
          <>
            {/* Date */}
            
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${date ? 'bg-green-500/20 text-green-500' : 'bg-accent text-accent-text'}`}>
                  {date ? '✓' : '1'}
                </span>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Fecha</p>
              </div>
              <button ref={calendarBtnRef} type="button" onClick={() => setCalendarOpen((o) => !o)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-card text-[13px] font-semibold text-text hover:border-border-hover transition-colors ${ring}`}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-muted shrink-0">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <span className="flex-1 text-left capitalize">{formatDateFull(date)}</span>
              </button>
              {calendarOpen && <CalendarPopover selectedDate={date} onSelect={handleDateChange} onClose={() => setCalendarOpen(false)} anchorRef={calendarBtnRef} clubId={clubId} />}
            </div>

            {/* Time slots */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${startTime ? 'bg-green-500/20 text-green-500' : 'bg-accent text-accent-text'}`}>
                  {startTime ? '✓' : '2'}
                </span>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Hora de inicio</p>
              </div>
              {isLoadingSlots ? (
                <div className="flex gap-1.5 flex-wrap">{[1,2,3,4,5,6].map(i => <div key={i} className="h-8 w-14 rounded-lg bg-surface animate-pulse"/>)}</div>
              ) : visibleTimes.length === 0 ? (
                <p className="text-xs text-muted text-center py-3">Sin disponibilidad</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {visibleTimes.map((t) => (
                    <button key={t} type="button" onClick={() => handleSelectTime(t)}
                      className={`py-1.5 px-2.5 rounded-lg border text-[11px] font-mono font-semibold cursor-pointer transition-all active:scale-95
                        ${startTime === t ? 'bg-accent border-accent text-accent-text' : 'border-border bg-card text-muted hover:border-border-hover hover:text-text'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Court + duration */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1.5">
                {bookingMode === 'BLOQUEO' ? 
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${courtId ? 'bg-green-500/20 text-green-500' : 'bg-accent text-accent-text'}`}>
                      {courtId ? '✓' : '3'}
                    </span>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Cancha</p>
                  </div>
                : 
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${courtId ? 'bg-green-500/20 text-green-500' : 'bg-accent text-accent-text'}`}>
                      {courtId ? '✓' : '3'}
                    </span>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Cancha y duración</p>
                  </div>
                }
              </p>
              {startTime ? (
              <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto [scrollbar-width:thin]">
                {courtsForTime.length === 0 ? (
                  <p className="text-xs text-muted text-center py-3">Sin canchas disponibles</p>
                ) : courtsForTime.map((c) => {
                  const durations = bookingMode === 'RESERVA'
                    ? getAvailableDurationsForCourt(startTime, c.id, courtSlots, durationOptions)
                    : []
                  const isSel = courtId === c.id
                  return (
                    <div key={c.id} onClick={() => bookingMode === 'BLOQUEO' && setCourtId(c.id)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors ${isSel ? 'border-accent bg-accent/8' : 'border-border bg-card'} ${bookingMode === 'BLOQUEO' ? 'cursor-pointer hover:border-border-hover' : ''}`}>
                      <span className={`text-[13px] font-semibold truncate ${isSel ? 'text-accent' : 'text-text'}`}>{c.name}</span>
                      {bookingMode === 'RESERVA' && (
                        <div className="flex gap-1 shrink-0 ml-2">
                          {durations.map((d) => (
                            <button key={d} type="button" onClick={() => handleCourtDuration(c.id, d)}
                              className={`px-2 py-0.5 rounded-full text-[11px] font-bold cursor-pointer transition-all active:scale-95
                                ${isSel && duration === d ? 'bg-accent text-accent-text' : 'bg-surface border border-border text-muted hover:border-accent/60 hover:text-text'}`}>
                              {fmtDur(d)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>) : 
                <div className='flex items-center justify-between px-3 py-2.5 rounded-xl border'>
                  <span className="text-[13px] font-semibold truncate text-muted/30">Esperando hora de inicio...</span>
                </div>  
                }
            </div>

          </>
        )}

        {/* Block end time selector */}
        {showPickers && bookingMode === 'BLOQUEO' && (
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${blockEndTime ? 'bg-green-500/20 text-green-500' : 'bg-accent text-accent-text'}`}>
                {blockEndTime ? '✓' : '4'}
              </span>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Hora fin</p>
            </div>
            { startTime ?
            <select value={blockEndTime} onChange={(e) => handleBlockEndTimeChange(e.target.value)}
              className={`${inputCls} font-mono ${!blockEndTime ? 'text-muted' : ''} ${ring}`}>
              {
                getBlockEndOptions(startTime).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))
              } 
            </select> 
              : 
              <select className={`w-full border border-border rounded-[10px] px-3 py-2.5 text-[13px] text-muted/30 outline-none focus:border-accent font-[inherit] placeholder:text-muted `}><option value="">Esperando hora de inicio...</option></select>
            }

          </div>
        )}

        {/* OOB warning */}
        {isOOB && (
          <div className="flex flex-col gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25">
            <div className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-amber-400">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span className="text-[11px] font-semibold text-amber-400">Fuera del horario operativo</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={oobConfirmed} onChange={(e) => setOobConfirmed(e.target.checked)}
                className="w-3.5 h-3.5 accent-amber-400 cursor-pointer"/>
              <span className="text-[11px] text-muted">Confirmar reserva igualmente</span>
            </label>
          </div>
        )}

        {/* Client / Motivo */}
        <div className="flex flex-col gap-2">
          {bookingMode === 'RESERVA' ? (
            <>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${clientName ? 'bg-green-500/20 text-green-500' : 'bg-accent text-accent-text'}`}>
                  {clientName ? '✓' : '4'}
                </span>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Datos del cliente</p>
              </div>
              <input ref={clientNameRef} type="text" placeholder="Nombre del cliente *" value={clientName}
                onChange={(e) => setClientName(e.target.value)} disabled={isPending}
                className={`${inputCls} ${ring}`}/>
              <input type="tel" placeholder="Teléfono (opcional)" value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)} disabled={isPending}
                className={`${inputCls} ${ring}`}/>
            </>
          ) : (
            <input ref={clientNameRef} type="text" placeholder="Motivo (opcional)" value={motivo}
              onChange={(e) => setMotivo(e.target.value)} disabled={isPending}
              className={`${inputCls} ${ring}`}/>
          )}
        </div>

        {/* Price */}
        {bookingMode === 'RESERVA' && courtId && duration > 0 && (
          <div className="shrink-0 pt-2 border-t border-border/40">
            <PriceRuleDisplay
              appliedRuleName={isOOB ? 'Regla Base (fuera de horario)' : selectedSlot?.appliedRuleName}
              basePrice={basePrice}
              overrideEnabled={priceOverrideEnabled}
              overrideInput={priceOverrideInput}
              onToggleOverride={() => { setPriceOverrideEnabled((v) => !v); setPriceOverrideInput('') }}
              onChangeOverride={setPriceOverrideInput}
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-[12px] text-red-400 bg-red-400/8 border border-red-400/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border flex gap-2 shrink-0">
        <button type="button" onClick={onClose} disabled={isPending}
          className={`flex-1 py-2.5 rounded-xl border border-border text-[13px] font-semibold text-muted hover:text-text hover:border-border-hover transition-colors ${ring}`}>
          Cancelar
        </button>
        <button type="button" onClick={handleSubmit} disabled={!canSubmit || isPending}
          className={`flex-[2] py-2.5 rounded-xl bg-accent text-accent-text text-[13px] font-bold cursor-pointer transition-all enabled:hover:bg-accent-dark active:enabled:scale-[.98] disabled:opacity-35 disabled:cursor-not-allowed ${ring}`}>
          {getButtonLabel()}
        </button>
      </div>
    </div>
  )
}
