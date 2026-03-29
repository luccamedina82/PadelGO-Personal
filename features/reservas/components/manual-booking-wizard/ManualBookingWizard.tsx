'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { ManualBookingWizardProps, BookingType } from './types/manualBookingWizard.types'
import { todayLocalStr, computeEndTime, formatDateFull } from './helpers/manualBookingWizard.helpers'
import { CalendarPopover } from '@/features/reservas/components/ui/CalendarPopover'
import { getAvailableDurationsForCourt, getVisibleTimeSlotsForDate } from './helpers/bookingCalcUtils'

// ─── Especial category → DB mapping ─────────────────────────────────────────
const ESPECIAL_CATEGORIES = [
  { id: 'ENTRENAMIENTO' as const, label: 'Entrenamiento', source: 'ENTRENAMIENTO' },
  { id: 'TORNEO'        as const, label: 'Torneo',        source: 'TORNEO' },
  { id: 'EVENTO'        as const, label: 'Evento',        source: 'EVENTO' },
  { id: 'MANTENIMIENTO' as const, label: 'Mantenimiento', source: 'MANTENIMIENTO' },
  { id: 'OTRO'          as const, label: 'Otro',          source: 'BLOCK' },
] as const

type EspecialCategoryId = (typeof ESPECIAL_CATEGORIES)[number]['id']

function fmtDur(d: number) {
  return d === 60 ? '1h' : d === 90 ? '1h 30' : d === 120 ? '2h' : `${d} min`
}

export default function ManualBookingWizard({
  courts,
  courtSlotsByDate,
  availableDates,
  clubId,
  createManualBookingAction,
  defaultCourtId,
  defaultDate,
  defaultTime,
  onClose,
  onBookingCreated,
  durationOptions,
}: ManualBookingWizardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const calendarBtnRef = useRef<HTMLButtonElement>(null)
  const wizardRef = useRef<HTMLDivElement>(null)

  // Focus trap
  useEffect(() => {
    const el = wizardRef.current
    if (!el) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const focusable = Array.from(
        el!.querySelectorAll<HTMLElement>(
          'button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), a[href]'
        )
      ).filter((n) => !n.closest('[aria-hidden="true"]'))
      if (focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    el.addEventListener('keydown', handleKeyDown)
    return () => el.removeEventListener('keydown', handleKeyDown)
  }, [])
  const [error, setError] = useState<string | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)

  const [date, setDate] = useState(defaultDate ?? availableDates[0] ?? todayLocalStr())
  const [startTime, setStartTime] = useState(defaultTime ?? '')
  const [duration, setDuration] = useState(() => {
    if (defaultCourtId && defaultDate && defaultTime) {
      const cs = courtSlotsByDate[defaultDate]?.find((c) => c.courtId === defaultCourtId)
      const slot = cs?.slots.find((s) => s.time === defaultTime)
      const opts = slot?.durationOptions ?? []
      if (opts.length > 0) return opts.includes(90) ? 90 : opts[opts.length - 1]!
    }
    return 0
  })
  // Only pre-select court when coming from a grid click (both courtId AND time present)
  const [courtId, setCourtId] = useState(
    defaultCourtId && defaultTime && courts.some((c) => c.id === defaultCourtId) ? defaultCourtId : ''
  )

  const [reservationType, setReservationType] = useState<'REGULAR' | 'ESPECIAL'>('REGULAR')
  const [especialCategory, setEspecialCategory] = useState<EspecialCategoryId | null>(null)
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [blockReason, setBlockReason] = useState('')

  // ─── Derived slot data ───────────────────────────────────────────────────
  const allCourtSlots = courtSlotsByDate[date] ?? []
  const visibleTimes = getVisibleTimeSlotsForDate(allCourtSlots, durationOptions)

  const courtsForTime = startTime
    ? courts.filter((c) => getAvailableDurationsForCourt(startTime, c.id, allCourtSlots, durationOptions).length > 0)
    : []

  const endTime = startTime && duration > 0 ? computeEndTime(startTime, duration) : null
  const courtName = courts.find((c) => c.id === courtId)?.name ?? ''

  // ─── Handlers ───────────────────────────────────────────────────────────
  function handleDateChange(d: string) {
    setDate(d)
    setStartTime('')
    setCourtId('')
    setDuration(0)
    setCalendarOpen(false)
  }

  function handleSelectTime(t: string) {
    setStartTime(t)
    setCourtId('')
    setDuration(0)
  }

  function handleSelectCourtDuration(cId: string, dur: number) {
    setCourtId(cId)
    setDuration(dur)
  }

  function handleTypeChange(t: 'REGULAR' | 'ESPECIAL') {
    setReservationType(t)
    setClientName('')
    setClientPhone('')
    setEspecialCategory(null)
    setBlockReason('')
  }

  // ─── Validation ─────────────────────────────────────────────────────────
  const canConfirm = !!(
    courtId &&
    startTime &&
    duration > 0 &&
    (
      (reservationType === 'REGULAR' && clientName.trim().length > 0) ||
      (reservationType === 'ESPECIAL' &&
        especialCategory !== null &&
        (especialCategory !== 'OTRO' || blockReason.trim().length > 0))
    )
  )

  // ─── Submit ──────────────────────────────────────────────────────────────
  function handleConfirm() {
    if (!canConfirm) return
    setError(null)
    const catData = especialCategory ? ESPECIAL_CATEGORIES.find((c) => c.id === especialCategory) : null
    const payload =
      reservationType === 'REGULAR'
        ? {
            clubId, courtId, date, startTime, durationMinutes: duration,
            bookingType: 'PRESENCIAL' as BookingType,
            manualName: clientName.trim() || undefined,
            manualPhone: clientPhone.trim() || undefined,
          }
        : {
            clubId, courtId, date, startTime, durationMinutes: duration,
            bookingType: 'BLOQUEO' as BookingType,
            blockSource: catData?.source,
            blockReason: especialCategory === 'OTRO' ? blockReason.trim() || undefined : catData?.label,
          }

    startTransition(async () => {
      const result = await createManualBookingAction(payload)
      if (result.success) {
        const newId = result.data?.bookingId
        toast.success('Reserva creada', { position: 'bottom-right' })
        if (onBookingCreated) { onBookingCreated({ date, bookingId: newId }); return }
      } else {
        setError(result.error ?? 'Error al crear la reserva.')
      }
    })
  }

  const ring = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
  const labelCls = 'text-[9px] font-bold tracking-[1.5px] uppercase text-muted mb-[10px]'
  const inputCls = `bg-surface border border-border rounded-[10px] px-3 py-[10px] text-[13px]
                    text-text outline-none transition-colors w-full placeholder:text-muted
                    focus:border-accent font-[inherit] focus-visible:ring-2 focus-visible:ring-accent/50`

  return (
    <div ref={wizardRef} className="relative flex flex-col h-full bg-bg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <h2 className="font-display text-[20px] tracking-[3px] leading-none text-text">NUEVA RESERVA</h2>
        <button
          type="button"
          onClick={() => { if (onClose) { onClose(date); return } router.push(`/admin/reservas?date=${date}`) }}
          className={`size-8 rounded-xl border border-border text-muted flex items-center justify-center cursor-pointer transition-all hover:text-text hover:border-border-hover ${ring}`}
          aria-label="Cerrar"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--sub)_transparent]">
        <div className="grid md:grid-cols-2 gap-6 p-6">

          {/* ── LEFT: Cuándo y Dónde ─────────────────────────────── */}
          <div className="flex flex-col gap-5">

            {/* Date picker */}
            <div>
              <p className={labelCls}>Fecha</p>
              <button
                ref={calendarBtnRef}
                type="button"
                onClick={() => setCalendarOpen((o) => !o)}
                className={`w-full flex items-center gap-3 px-4 py-[11px] rounded-xl border border-border bg-card
                            text-sm font-semibold text-text hover:border-border-hover transition-colors ${ring}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-muted shrink-0">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span className="flex-1 text-left capitalize">{formatDateFull(date)}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-muted shrink-0">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {calendarOpen && (
                <CalendarPopover
                  selectedDate={date}
                  onSelect={handleDateChange}
                  onClose={() => setCalendarOpen(false)}
                  anchorRef={calendarBtnRef}
                  clubId={clubId}
                />
              )}
            </div>

            {/* Time grid — flex-wrap, only slots with min duration available */}
            <div>
              <p className={labelCls}>Horario de inicio</p>
              <div className="min-h-[140px] content-start">
                {visibleTimes.length === 0 ? (
                  <p className="text-xs text-muted text-center py-4">Sin disponibilidad para este día.</p>
                ) : (
                  <div className="flex flex-wrap gap-[6px]">
                    {visibleTimes.map((t) => {
                      const isActive = startTime === t
                      return (
                        <button
                          key={t}
                          type="button"
                          tabIndex={-1}
                          onClick={() => handleSelectTime(t)}
                          className={`py-[8px] px-[10px] rounded-[10px] border text-[11px] font-mono font-semibold
                                      cursor-pointer transition-all duration-[120ms] active:scale-95
                                      ${isActive
                                        ? 'bg-accent border-accent text-accent-text font-bold'
                                        : 'border-border bg-card text-muted hover:border-border-hover hover:text-text'
                                      }`}
                        >
                          {t}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Court + Duration cards */}
            <div className="flex flex-col gap-2">
              <p className={labelCls}>Cancha y duración</p>
              <div className="h-[300px] overflow-y-auto pr-2 flex flex-col gap-2 [scrollbar-width:thin] [scrollbar-color:var(--sub)_transparent]">
                {!startTime ? (
                  <p className="text-xs text-muted/50 text-center py-10">Selecciona un horario para ver las canchas</p>
                ) : courtsForTime.length === 0 ? (
                  <p className="text-xs text-muted text-center py-10">Sin canchas disponibles.</p>
                ) : (
                  courtsForTime.map((c) => {
                    const durations = getAvailableDurationsForCourt(startTime, c.id, allCourtSlots, durationOptions)
                    const isSelected = courtId === c.id
                    return (
                      <div
                        key={c.id}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors duration-[130ms]
                                    ${isSelected ? 'border-accent bg-accent/8' : 'border-border bg-card'}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`size-2 rounded-full shrink-0 ${isSelected ? 'bg-accent' : 'bg-muted/40'}`} />
                          <span className={`text-sm font-semibold truncate ${isSelected ? 'text-accent' : 'text-text'}`}>{c.name}</span>
                          <span className="text-[10px] text-muted shrink-0 opacity-60">{c.type}</span>
                        </div>
                        <div className="flex gap-1.5 shrink-0 ml-3">
                          {durations.map((d) => {
                            const isActive = isSelected && duration === d
                            return (
                              <button
                                key={d}
                                type="button"
                                tabIndex={-1}
                                onClick={() => handleSelectCourtDuration(c.id, d)}
                                className={`px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer
                                            transition-all duration-[120ms] active:scale-95
                                            ${isActive
                                              ? 'bg-accent text-accent-text'
                                              : 'bg-surface border border-border text-muted hover:border-accent/60 hover:text-text'
                                            }`}
                              >
                                {fmtDur(d)}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

            </div>
          </div>

          {/* ── RIGHT: Quién y Qué ───────────────────────────────── */}
          <div className="flex flex-col gap-5">

            {/* Booking type — pill tabs */}
            <div>
              <p className={labelCls}>Tipo de reserva</p>
              <div className="flex gap-2">
                {(['REGULAR', 'ESPECIAL'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTypeChange(t)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[12px] font-semibold
                                cursor-pointer transition-all duration-[130ms] ${ring}
                                ${reservationType === t
                                  ? 'border-accent bg-accent/10 text-accent'
                                  : 'border-border bg-card text-muted hover:border-border-hover hover:text-text'
                                }`}
                  >
                    <span className="text-sm leading-none">{t === 'REGULAR' ? '👤' : '⭐'}</span>
                    {t === 'REGULAR' ? 'Regular' : 'Especial'}
                  </button>
                ))}
              </div>
            </div>

            {/* Regular: name + phone */}
            {reservationType === 'REGULAR' && (
              <div className="animate-wz-fade-in flex flex-col gap-3">
                <div className="flex flex-col gap-[6px]">
                  <label className="text-[10px] font-bold uppercase tracking-[1px] text-muted">
                    Nombre <span className="text-red-400 font-normal normal-case">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Nombre y apellido"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    autoFocus
                    className={inputCls}
                  />
                </div>
                <div className="flex flex-col gap-[6px]">
                  <label className="text-[10px] font-bold uppercase tracking-[1px] text-muted">
                    Teléfono <span className="text-muted font-normal normal-case">(opcional)</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="+54 11 1234-5678"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
            )}

            {/* Especial: category dropdown + freetext for OTRO */}
            {reservationType === 'ESPECIAL' && (
              <div className="animate-wz-fade-in flex flex-col gap-3">
                <div className="flex flex-col gap-[6px]">
                  <label className="text-[10px] font-bold uppercase tracking-[1px] text-muted">
                    Categoría <span className="text-red-400 font-normal normal-case">*</span>
                  </label>
                  <select
                    value={especialCategory ?? ''}
                    onChange={(e) => {
                      const v = e.target.value as EspecialCategoryId | ''
                      setEspecialCategory(v || null)
                      setBlockReason('')
                    }}
                    autoFocus
                    className={`${inputCls} cursor-pointer`}
                  >
                    <option value="" disabled>Seleccionar tipo…</option>
                    {ESPECIAL_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                {especialCategory === 'OTRO' && (
                  <div className="flex flex-col gap-[6px] animate-wz-fade-in">
                    <label className="text-[10px] font-bold uppercase tracking-[1px] text-muted">
                      Descripción <span className="text-red-400 font-normal normal-case">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Describir motivo…"
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      autoFocus
                      className={inputCls}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Summary */}
            {courtId && startTime && duration > 0 && (
              <div className="animate-wz-fade-in">
                <p className={labelCls}>Resumen</p>
                <div className="border border-border rounded-[14px] overflow-hidden mb-3">
                  {[
                    { label: 'Cancha',   value: courtName },
                    { label: 'Fecha',    value: formatDateFull(date) },
                    { label: 'Horario',  value: `${startTime} → ${endTime}`, mono: true },
                    { label: 'Duración', value: `${duration} min` },
                  ].map((r, i, arr) => (
                    <div
                      key={r.label}
                      className={`flex items-center justify-between px-4 py-3 odd:bg-surface/55
                                  ${i < arr.length - 1 ? 'border-b border-border/60' : ''}`}
                    >
                      <span className="text-xs text-muted">{r.label}</span>
                      <span className={`text-sm font-semibold text-text text-right ${r.mono ? 'font-mono' : ''}`}>{r.value}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between px-[14px] py-[11px] rounded-xl bg-accent/15 border border-accent/40">
                  <span className="text-xs font-medium text-text">Estado al crear</span>
                  <span className="text-[11px] font-bold px-[10px] py-[3px] rounded-full bg-accent/20 text-accent border border-accent/40">
                    ● Confirmada
                  </span>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="animate-wz-fade-in flex items-start gap-2 px-3 py-[10px] rounded-[10px] bg-red-400/8 border border-red-400/25 text-red-400">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-px">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p className="text-xs">{error}</p>
              </div>
            )}

            {/* Confirm */}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm || isPending}
              className={`w-full px-5 py-[14px] rounded-xl bg-accent text-accent-text text-[13px] font-bold
                          cursor-pointer transition-all duration-[130ms] mt-auto
                          enabled:hover:bg-accent-dark active:enabled:scale-[.98]
                          disabled:opacity-35 disabled:cursor-not-allowed ${ring}`}
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity=".2" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Creando…
                </span>
              ) : reservationType === 'ESPECIAL' ? 'Confirmar bloqueo' : 'Confirmar reserva'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
