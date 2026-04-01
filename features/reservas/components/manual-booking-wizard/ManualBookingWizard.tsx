'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { ManualBookingWizardProps, BookingType } from './types/manualBookingWizard.types'
import { todayLocalStr, computeEndTime, formatDateFull } from './helpers/manualBookingWizard.helpers'
import { CalendarPopover } from '@/features/reservas/components/ui/CalendarPopover'
import { getAvailableDurationsForCourt, getVisibleTimeSlotsForDate } from './helpers/bookingCalcUtils'
import { PriceRuleDisplay } from './PriceRuleDisplay'
import { calcBookingPrice } from '@/lib/availability'

function fmtDur(d: number) {
  return d === 60 ? '1h' : d === 90 ? '1h 30' : d === 120 ? '2h' : `${d} min`
}

function getBlockEndTimeOptions(startTime: string): string[] {
  const [h = '0', m = '0'] = startTime.split(':')
  const startMin = parseInt(h) * 60 + parseInt(m)
  const options: string[] = []
  for (let t = startMin + 30; t <= 23 * 60 + 30; t += 30) {
    const hh = Math.floor(t / 60)
    if (hh >= 24) break
    const mm = t % 60
    options.push(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`)
  }
  return options
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

  const [bookingMode, setBookingMode] = useState<'RESERVA' | 'BLOQUEO'>('RESERVA')
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [motivo, setMotivo] = useState('')
  const [blockEndTime, setBlockEndTime] = useState('')
  const [priceOverrideEnabled, setPriceOverrideEnabled] = useState(false)
  const [priceOverrideInput, setPriceOverrideInput] = useState('')

  // ─── Derived slot data ───────────────────────────────────────────────────
  const allCourtSlots = courtSlotsByDate[date] ?? []
  const visibleTimes = getVisibleTimeSlotsForDate(allCourtSlots, durationOptions)

  // BLOQUEO can use any court; RESERVA only shows courts with available slots
  const courtsForTime = startTime
    ? bookingMode === 'BLOQUEO'
      ? courts
      : courts.filter((c) => getAvailableDurationsForCourt(startTime, c.id, allCourtSlots, durationOptions).length > 0)
    : []

  const blockEndTimeOptions = bookingMode === 'BLOQUEO' && startTime ? getBlockEndTimeOptions(startTime) : []

  const endTime = startTime && duration > 0 ? computeEndTime(startTime, duration) : null
  const courtName = courts.find((c) => c.id === courtId)?.name ?? ''

  const selectedSlot = courtId && startTime
    ? allCourtSlots.find((cs) => cs.courtId === courtId)?.slots.find((s) => s.time === startTime)
    : undefined
  const basePrice = selectedSlot && duration > 0 ? calcBookingPrice(selectedSlot.pricePerHour, duration) : 0

  // ─── Handlers ───────────────────────────────────────────────────────────
  function resetOverride() {
    setPriceOverrideEnabled(false)
    setPriceOverrideInput('')
  }

  function handleDateChange(d: string) {
    setDate(d)
    setStartTime('')
    setCourtId('')
    setDuration(0)
    setBlockEndTime('')
    setCalendarOpen(false)
    resetOverride()
  }

  function handleSelectTime(t: string) {
    setStartTime(t)
    setCourtId('')
    setBlockEndTime('')
    resetOverride()
    if (bookingMode === 'RESERVA') {
      const allDursAtTime = allCourtSlots.flatMap((cs) => {
        const slot = cs.slots.find((s) => s.time === t)
        return slot?.available ? slot.durationOptions : []
      })
      const validDurs = [...new Set(allDursAtTime)]
      setDuration((prev) => (validDurs.includes(prev) ? prev : (validDurs[0] ?? 0)))
    } else {
      setDuration(0)
    }
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

  function handleSelectCourtDuration(cId: string, dur: number) {
    setCourtId(cId)
    setDuration(dur)
    resetOverride()
  }

  function handleModeChange(m: 'RESERVA' | 'BLOQUEO') {
    setBookingMode(m)
    setClientName('')
    setClientPhone('')
    setMotivo('')
    setBlockEndTime('')
    setDuration(0)
    setCourtId('')
    resetOverride()
  }

  // ─── Validation ─────────────────────────────────────────────────────────
  const canConfirm = !!(
    courtId &&
    startTime &&
    duration > 0 &&
    (bookingMode === 'BLOQUEO' || clientName.trim().length > 0)
  )

  // ─── Submit ──────────────────────────────────────────────────────────────
  function handleConfirm() {
    if (!canConfirm) return
    setError(null)
    const priceOverride =
      bookingMode === 'RESERVA' && priceOverrideEnabled && priceOverrideInput.trim() !== ''
        ? parseInt(priceOverrideInput, 10) * 100
        : undefined
    const payload =
      bookingMode === 'RESERVA'
        ? {
            clubId, courtId, date, startTime, durationMinutes: duration,
            bookingType: 'PRESENCIAL' as BookingType,
            manualName: clientName.trim() || undefined,
            manualPhone: clientPhone.trim() || undefined,
            priceOverride,
          }
        : {
            clubId, courtId, date, startTime, durationMinutes: duration,
            bookingType: 'BLOQUEO' as BookingType,
            blockReason: motivo.trim() || undefined,
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
              <p className={labelCls}>{bookingMode === 'BLOQUEO' ? 'Cancha' : 'Cancha y duración'}</p>
              <div className="h-[220px] overflow-y-auto pr-2 flex flex-col gap-2 [scrollbar-width:thin] [scrollbar-color:var(--sub)_transparent]">
                {!startTime ? (
                  <p className="text-xs text-muted/50 text-center py-10">Selecciona un horario para ver las canchas</p>
                ) : courtsForTime.length === 0 ? (
                  <p className="text-xs text-muted text-center py-10">Sin canchas disponibles.</p>
                ) : bookingMode === 'BLOQUEO' ? (
                  // BLOQUEO: simple court selector, no duration pills
                  courtsForTime.map((c) => {
                    const isSelected = courtId === c.id
                    return (
                      <button
                        key={c.id}
                        type="button"
                        tabIndex={-1}
                        onClick={() => setCourtId(c.id)}
                        className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-colors duration-[130ms] w-full text-left
                                    ${isSelected ? 'border-accent bg-accent/8' : 'border-border bg-card hover:border-border-hover'}`}
                      >
                        <span className={`size-2 rounded-full shrink-0 ${isSelected ? 'bg-accent' : 'bg-muted/40'}`} />
                        <span className={`text-sm font-semibold truncate ${isSelected ? 'text-accent' : 'text-text'}`}>{c.name}</span>
                        <span className="text-[10px] text-muted shrink-0 opacity-60">{c.type}</span>
                      </button>
                    )
                  })
                ) : (
                  // RESERVA: court cards with duration pills
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

              {/* End time selector — only for BLOQUEO */}
              {bookingMode === 'BLOQUEO' && startTime && (
                <div className="flex flex-col gap-[6px] mt-1">
                  <label className="text-[10px] font-bold uppercase tracking-[1px] text-muted">
                    Hora de fin
                  </label>
                  <select
                    value={blockEndTime}
                    onChange={(e) => handleBlockEndTimeChange(e.target.value)}
                    className={`bg-surface border border-border rounded-[10px] px-3 py-[10px] text-[13px]
                                text-text outline-none transition-colors w-full
                                focus:border-accent font-mono font-[inherit] focus-visible:ring-2 focus-visible:ring-accent/50
                                ${!blockEndTime ? 'text-muted' : ''}`}
                  >
                    <option value="">Seleccionar hora de fin…</option>
                    {blockEndTimeOptions.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: Quién y Qué ───────────────────────────────── */}
          <div className="flex flex-col gap-5">

            {/* Booking mode — pill tabs */}
            <div>
              <p className={labelCls}>Tipo</p>
              <div className="flex gap-2">
                {([
                  { id: 'RESERVA', icon: '👤', label: 'Reserva' },
                  { id: 'BLOQUEO', icon: '🔒', label: 'Bloqueo' },
                ] as const).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleModeChange(m.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[12px] font-semibold
                                cursor-pointer transition-all duration-[130ms] ${ring}
                                ${bookingMode === m.id
                                  ? 'border-accent bg-accent/10 text-accent'
                                  : 'border-border bg-card text-muted hover:border-border-hover hover:text-text'
                                }`}
                  >
                    <span className="text-sm leading-none">{m.icon}</span>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reserva: name + phone */}
            {bookingMode === 'RESERVA' && (
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

            {/* Bloqueo: optional motivo */}
            {bookingMode === 'BLOQUEO' && (
              <div className="animate-wz-fade-in flex flex-col gap-[6px]">
                <label className="text-[10px] font-bold uppercase tracking-[1px] text-muted">
                  Motivo <span className="text-muted font-normal normal-case">(opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej: Mantenimiento, Torneo…"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  autoFocus
                  className={inputCls}
                />
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
                {bookingMode === 'RESERVA' && (
                  <PriceRuleDisplay
                    appliedRuleName={selectedSlot?.appliedRuleName}
                    basePrice={basePrice}
                    overrideEnabled={priceOverrideEnabled}
                    overrideInput={priceOverrideInput}
                    onToggleOverride={() => { setPriceOverrideEnabled((v) => !v); setPriceOverrideInput('') }}
                    onChangeOverride={setPriceOverrideInput}
                  />
                )}
                {bookingMode === 'BLOQUEO' && (
                  <div className="flex items-center justify-between px-[14px] py-[11px] rounded-xl bg-surface border border-border mb-3">
                    <span className="text-xs text-muted">Precio</span>
                    <span className="text-sm font-semibold text-muted">Sin costo</span>
                  </div>
                )}
                <div className="flex items-center justify-between px-[14px] py-[11px] rounded-xl bg-accent/15 border border-accent/40 mt-3">
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
              ) : bookingMode === 'BLOQUEO' ? 'Confirmar bloqueo' : 'Confirmar reserva'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
