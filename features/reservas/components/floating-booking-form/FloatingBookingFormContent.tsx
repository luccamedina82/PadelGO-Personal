'use client'

import { useMemo, useReducer, useRef, useState, useTransition } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { calcBookingPrice, formatPrice, timeToMinutes } from '@/lib/availability'
import { getWeekStart } from '@/lib/date'
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
import { formReducer } from './helpers/formReducer'

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

  // ── Form state ───────────────────────────────────────────────────────────
  const [isExpanded, setIsExpanded] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const clientNameRef = useRef<HTMLInputElement>(null)
  const [form, dispatch] = useReducer(formReducer, {
    bookingMode: 'RESERVA',
    date: initialData.date,
    courtId: initialData.courtId ?? '',
    startTime: initialData.startTime ?? '',
    duration: initialData.durationMinutes ?? 0,
    clientName: '',
    clientPhone: '',
    motivo: '',
    blockEndTime: '',
    oobConfirmed: false,
    priceOverrideEnabled: false,
    priceOverrideInput: '',
    error: null
  })
  // ── Duration options derived from selected court (or union of all courts) ──

  const { data: floatingData, isLoading: isLoadingSlots } = useQuery({
    queryKey: ['floatingData', clubId, form.date],
    queryFn: async () => {
      return await getFloatingFormDataAction(clubId, form.date)
    },
    staleTime: 1000 * 60, 
  })
  const courtSlots = floatingData?.courtSlots ?? []
  const globalDurations = floatingData?.durationOptions ?? []

  const durationOptions = useMemo(() => {
    // 1. Si el admin ya eligió Cancha y Hora, buscamos el slot exacto y sus duraciones permitidas
    if (form.courtId && form.startTime) {
      const courtData = courtSlots.find((cs) => cs.courtId === form.courtId)
      const slotData = courtData?.slots.find((s) => s.time === form.startTime)
      if (slotData && slotData.durationOptions.length > 0) {
        return slotData.durationOptions
      }
    }

    // 2. Si solo eligió la Hora, unimos las duraciones permitidas de todas las canchas para esa hora
    if (form.startTime) {
      const allAtTime = courtSlots.flatMap((cs) => {
        const s = cs.slots.find((x) => x.time === form.startTime)
        return s?.available ? s.durationOptions : []
      })
      const unique = [...new Set(allAtTime)].sort((a, b) => a - b)
      if (unique.length > 0) return unique
    }

    // 3. Fallback: Las duraciones globales activas hoy (para mostrar antes de que haga clic en una hora)
    return globalDurations.length > 0 ? globalDurations : [60, 90] // Fallback final por si está vacía la BD
  }, [form.courtId, form.startTime, courtSlots, globalDurations])

  // ── Derived ──────────────────────────────────────────────────────────────
  const visibleTimes = getVisibleTimeSlotsForDate(courtSlots, durationOptions)
  const courtsForTime = form.startTime
  
    ? form.bookingMode === 'BLOQUEO'
      ? courts
      : courts.filter((c) => getAvailableDurationsForCourt(form.startTime, c.id, courtSlots, durationOptions).length > 0)
    : []

  const selectedSlot = form.courtId && form.startTime
    ? courtSlots.find((cs) => cs.courtId === form.courtId)?.slots.find((s) => s.time === form.startTime)
    : undefined

  const startMin = form.startTime ? timeToMinutes(form.startTime) : 0
  const endMin = startMin + form.duration

  const isOOB =
    !!form.startTime && form.duration > 0 && baseStart !== undefined && baseEnd !== undefined &&
    (startMin < baseStart || endMin > baseEnd)

  const basePrice = selectedSlot && form.duration > 0
    ? calcBookingPrice(selectedSlot.pricePerHour, form.duration)
    : isOOB && baseBookingRule?.price != null && form.duration > 0
      ? calcBookingPrice(baseBookingRule.price, form.duration)
      : 0

  const endTime = form.startTime && form.duration > 0 ? computeEndTime(form.startTime, form.duration) : null
  const courtName = courts.find((c) => c.id === form.courtId)?.name ?? ''

  const canSubmit =
    !!form.courtId && !!form.startTime && form.duration > 0 &&
    (form.bookingMode === 'BLOQUEO' || form.clientName.trim().length > 0) &&
    (!isOOB || form.oobConfirmed)

  const isQuick = initialData.mode === 'quick' && !isExpanded
  const showPickers = initialData.mode === 'full' || isExpanded

  function handleDateChange(d: string) {
    dispatch({ type: 'SET_DATE', payload: d })
    setCalendarOpen(false)
  }

  function handleSelectTime(t: string) {
    dispatch({ type: 'SET_TIME', payload: t })
    if (form.bookingMode === 'RESERVA') {
      // Calculamos las duraciones disponibles para esta nueva hora
      const allDurs = courtSlots.flatMap((cs) => {
        const slot = cs.slots.find((s) => s.time === t)
        return slot?.available ? slot.durationOptions : []
      })
      const valid = [...new Set(allDurs)]
      const newDur = valid.includes(form.duration) ? form.duration : (valid[0] ?? 0)
      
      // Como no elegimos cancha todavía, mandamos un ID vacío
      dispatch({ type: 'SET_COURT_DURATION', payload: { courtId: '', duration: newDur } })
    }
  }

  function handleCourtDuration(cId: string, dur: number) {
    dispatch({ type: 'SET_COURT_DURATION', payload: { courtId: cId, duration: dur } })
  }

  function handleBlockEndTimeChange(endT: string) {
    dispatch({ type: 'SET_FIELD', field: 'blockEndTime', value: endT })
    if (form.startTime && endT) {
      const [sh = '0', sm = '0'] = form.startTime.split(':')
      const [eh = '0', em = '0'] = endT.split(':')
      const dur = (parseInt(eh) * 60 + parseInt(em)) - (parseInt(sh) * 60 + parseInt(sm))
      if (dur > 0) {
        dispatch({ type: 'SET_COURT_DURATION', payload: { courtId: form.courtId, duration: dur } })
      }
    }
  }

  function handleModeChange(m: BookingMode) {
    dispatch({ type: 'SET_MODE', payload: m })
  }

  function handleSubmit() {
    if (!canSubmit) return
    dispatch({ type: 'SET_FIELD', field: 'error', value: null })
    const priceOverride =
      form.bookingMode === 'RESERVA' && form.priceOverrideEnabled && form.priceOverrideInput.trim() !== ''
        ? parseInt(form.priceOverrideInput, 10) * 100
        : undefined
    const payload =
      form.bookingMode === 'RESERVA'
        ? { clubId, courtId: form.courtId, date: form.date, startTime: form.startTime, durationMinutes: form.duration, bookingType: 'PRESENCIAL' as const, manualName: form.clientName.trim() || undefined, manualPhone: form.clientPhone.trim() || undefined, priceOverride, outOfHoursWarning: isOOB }
        : { clubId, courtId: form.courtId, date: form.date, startTime: form.startTime, durationMinutes: form.duration, bookingType: 'BLOQUEO' as const, blockReason: form.motivo.trim() || undefined }

    startTransition(async () => {
      const result = await createManualBooking(payload)
      if (result.success && result.data) {
        const bookingId = result.data.bookingId
        toast.success('Reserva creada', { position: 'bottom-right' })
        const bookingWeekStart = getWeekStart(payload.date)
        queryClient.invalidateQueries({ queryKey: ['bookings', clubId, 'week', bookingWeekStart] })
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
          // Same day/week: inject optimistically and refresh in background
          queryClient.setQueryData(
            ['bookings', clubId, 'week', bookingWeekStart],
            (old: BookingBlock[] | undefined) => [...(old ?? []), optimisticBooking]
          )
          onCreated(bookingId)
        } else {
          // Different day: navigate to the new date with highlight
          onCreated(bookingId)
          router.push(`/admin/reservas?date=${payload.date}&highlight=${bookingId}`)
        }
      } else {
        dispatch({ type: 'SET_FIELD', field: 'error', value: ('error' in result ? (result.error as string) : null) ?? 'Error al crear la reserva.' })
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
    if (!form.startTime) return 'Selecciona un horario'
    if (!form.courtId) return 'Elegí una cancha'
    if (form.bookingMode === 'RESERVA' && !form.clientName.trim()) return 'Ingresá el nombre'
    if (isOOB && !form.oobConfirmed) return 'Confirmá horario especial'
    return form.bookingMode === 'BLOQUEO' ? 'Confirmar bloqueo' : 'Guardar reserva'
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
                  ${form.bookingMode === m ? 'bg-card text-text shadow-sm' : 'text-muted hover:text-text'}`}>
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
                {courtName || '—'} · {form.startTime}{endTime ? ` – ${endTime}` : ''}{form.duration > 0 ? ` · ${fmtDur(form.duration)}` : ''}
              </p>
              <p className="text-[11px] text-muted capitalize">{formatDateFull(form.date)}</p>
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
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${form.date ? 'bg-green-500/20 text-green-500' : 'bg-accent text-accent-text'}`}>
                  {form.date ? '✓' : '1'}
                </span>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Fecha</p>
              </div>
              <button ref={calendarBtnRef} type="button" onClick={() => setCalendarOpen((o) => !o)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-card text-[13px] font-semibold text-text hover:border-border-hover transition-colors ${ring}`}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-muted shrink-0">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <span className="flex-1 text-left capitalize">{formatDateFull(form.date)}</span>
              </button>
              {calendarOpen && <CalendarPopover selectedDate={form.date} onSelect={handleDateChange} onClose={() => setCalendarOpen(false)} anchorRef={calendarBtnRef} clubId={clubId} />}
            </div>

            {/* Time slots */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${form.startTime ? 'bg-green-500/20 text-green-500' : 'bg-accent text-accent-text'}`}>
                  {form.startTime ? '✓' : '2'}
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
                        ${form.startTime === t ? 'bg-accent border-accent text-accent-text' : 'border-border bg-card text-muted hover:border-border-hover hover:text-text'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Court + duration */}
            <div>
              <div className="mb-1.5">
                {form.bookingMode === 'BLOQUEO' ? 
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${form.courtId ? 'bg-green-500/20 text-green-500' : 'bg-accent text-accent-text'}`}>
                      {form.courtId ? '✓' : '3'}
                    </span>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Cancha</p>
                  </div>
                : 
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${form.courtId ? 'bg-green-500/20 text-green-500' : 'bg-accent text-accent-text'}`}>
                      {form.courtId ? '✓' : '3'}
                    </span>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Cancha y duración</p>
                  </div>
                }
              </div>
              {form.startTime ? (
              <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto [scrollbar-width:thin]">
                {courtsForTime.length === 0 ? (
                  <p className="text-xs text-muted text-center py-3">Sin canchas disponibles</p>
                ) : courtsForTime.map((c) => {
                  const durations = form.bookingMode === 'RESERVA'
                    ? getAvailableDurationsForCourt(form.startTime, c.id, courtSlots, durationOptions)
                    : []
                  const isSel = form.courtId === c.id
                  return (
                    <div key={c.id} onClick={() => form.bookingMode === 'BLOQUEO' && dispatch({ type: 'SET_COURT_DURATION', payload: { courtId: c.id, duration: form.duration } })}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors ${isSel ? 'border-accent bg-accent/8' : 'border-border bg-card'} ${form.bookingMode === 'BLOQUEO' ? 'cursor-pointer hover:border-border-hover' : ''}`}>
                      <span className={`text-[13px] font-semibold truncate ${isSel ? 'text-accent' : 'text-text'}`}>{c.name}</span>
                      {form.bookingMode === 'RESERVA' && (
                        <div className="flex gap-1 shrink-0 ml-2">
                          {durations.map((d) => (
                            <button key={d} type="button" onClick={() => handleCourtDuration(c.id, d)}
                              className={`px-2 py-0.5 rounded-full text-[11px] font-bold cursor-pointer transition-all active:scale-95
                                ${isSel && form.duration === d ? 'bg-accent text-accent-text' : 'bg-surface border border-border text-muted hover:border-accent/60 hover:text-text'}`}>
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
        {showPickers && form.bookingMode === 'BLOQUEO' && (
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${form.blockEndTime ? 'bg-green-500/20 text-green-500' : 'bg-accent text-accent-text'}`}>
                {form.blockEndTime ? '✓' : '4'}
              </span>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Hora fin</p>
            </div>
            { form.startTime ?
            <select value={form.blockEndTime} onChange={(e) => handleBlockEndTimeChange(e.target.value)}
              className={`${inputCls} font-mono ${!form.blockEndTime ? 'text-muted' : ''} ${ring}`}>
                <option value="Selecciona un horario">Selecciona un horario</option>
              {
                getBlockEndOptions(form.startTime).map((t) => (
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
              <input type="checkbox" checked={form.oobConfirmed} onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'oobConfirmed', value: e.target.checked })}
                className="w-3.5 h-3.5 accent-amber-400 cursor-pointer"/>
              <span className="text-[11px] text-muted">Confirmar reserva igualmente</span>
            </label>
          </div>
        )}

        {/* Client / Motivo */}
        <div className="flex flex-col gap-2">
          {form.bookingMode === 'RESERVA' ? (
            <>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${form.clientName ? 'bg-green-500/20 text-green-500' : 'bg-accent text-accent-text'}`}>
                  {form.clientName ? '✓' : '4'}
                </span>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Datos del cliente</p>
              </div>
              <input ref={clientNameRef} type="text" placeholder="Nombre del cliente *" value={form.clientName}
                onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'clientName', value: e.target.value })} disabled={isPending}
                className={`${inputCls} ${ring}`}/>
              <input type="tel" placeholder="Teléfono (opcional)" value={form.clientPhone}
                onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'clientPhone', value: e.target.value })} disabled={isPending}
                className={`${inputCls} ${ring}`}/>
            </>
          ) : (
            <input ref={clientNameRef} type="text" placeholder="Motivo (opcional)" value={form.motivo}
              onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'motivo', value: e.target.value })} disabled={isPending}
              className={`${inputCls} ${ring}`}/>
          )}
        </div>

        {/* Price */}
        {form.bookingMode === 'RESERVA' && form.courtId && form.duration > 0 && (
          <div className="shrink-0 pt-2 border-t border-border/40">
            <PriceRuleDisplay
              appliedRuleName={isOOB ? 'Regla Base (fuera de horario)' : selectedSlot?.appliedRuleName}
              basePrice={basePrice}
              overrideEnabled={form.priceOverrideEnabled}
              overrideInput={form.priceOverrideInput}
              onToggleOverride={() => { 
                dispatch({ type: 'SET_FIELD', field: 'priceOverrideEnabled', value: !form.priceOverrideEnabled }); 
                dispatch({ type: 'SET_FIELD', field: 'priceOverrideInput', value: '' });
              }}
              onChangeOverride={(val) => dispatch({ type: 'SET_FIELD', field: 'priceOverrideInput', value: val })}
            />
          </div>
        )}

        {/* Error */}
        {form.error && (
          <p className="text-[12px] text-red-400 bg-red-400/8 border border-red-400/20 rounded-lg px-3 py-2">
            {form.error}
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
