'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { ActionResult } from '@/types'

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface Court {
  id: string
  name: string
  type: string
  covered: boolean
}

interface AvailabilitySlot {
  time: string
  available: boolean
  durationOptions: number[]
  pricePerHour: number
}

interface CourtSlots {
  courtId: string
  slots: AvailabilitySlot[]
}

type BookingType = 'PRESENCIAL' | 'TELEFONO' | 'BLOQUEO'

interface ManualBookingWizardProps {
  courts: Court[]
  courtSlotsByDate: Record<string, CourtSlots[]>
  availableDates: string[]
  clubId: string
  createManualBookingAction: (input: {
    clubId: string
    courtId: string
    date: string
    startTime: string
    durationMinutes: number
    bookingType: BookingType
    manualName?: string
    manualPhone?: string
    blockReason?: string
  }) => Promise<ActionResult<{ bookingId: string }>>
  defaultCourtId?: string
  defaultDate?: string
  defaultTime?: string
  onClose?: (date: string) => void
  onBookingCreated?: (payload: { date: string; bookingId?: string }) => void
}

const DURATIONS = [
  { value: 60, label: '1h' },
  { value: 90, label: '1h 30' },
  { value: 120, label: '2h' },
]

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function todayLocalStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function computeEndTime(start: string, durationMins: number): string {
  if (!start) return ''
  const [h = 0, m = 0] = start.split(':').map(Number)
  const total = h * 60 + m + durationMins
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function formatDateFull(iso: string): string {
  if (!iso) return ''
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

function formatDateShort(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

// ─── STEP INDICATOR ───────────────────────────────────────────────────────────

function StepDots({ current }: { current: number }) {
  const steps = ['Horario', 'Cliente', 'Confirmar']
  return (
    <div className="flex items-center select-none">
      {steps.map((label, i) => {
        const n = i + 1
        const done = n < current
        const active = n === current
        return (
          <div key={n} className="flex items-center">
            <div className="flex flex-col items-center gap-1 w-[64px]">
              <div
                className={[
                  'w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-300',
                  done ? 'bg-accent text-accent-text' : '',
                  active ? 'bg-accent text-accent-text ring-[3px] ring-accent/20' : '',
                  !done && !active ? 'bg-card border border-border text-sub' : '',
                ].join(' ')}
              >
                {done ? (
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  n
                )}
              </div>
              <span
                className={`text-[9px] font-bold tracking-widest uppercase whitespace-nowrap
                               ${active ? 'text-accent' : 'text-sub'}`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-8 h-px mb-4 transition-colors duration-500
                               ${done ? 'bg-accent' : 'bg-border'}`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── STEP 1 — HORARIO ─────────────────────────────────────────────────────────

function Step1({
  courts,
  courtId,
  setCourtId,
  date,
  setDate,
  startTime,
  setStartTime,
  duration,
  setDuration,
  courtSlotsByDate,
  availableDates,
  onNext,
}: {
  courts: Court[]
  courtId: string
  setCourtId(v: string): void
  date: string
  setDate(v: string): void
  startTime: string
  setStartTime(v: string): void
  duration: number
  setDuration(v: number): void
  courtSlotsByDate: Record<string, CourtSlots[]>
  availableDates: string[]
  onNext(): void
}) {
  const DOW_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  // Slots for the currently selected court + date
  const currentSlots: AvailabilitySlot[] = courtId
    ? ((courtSlotsByDate[date] ?? []).find((cs) => cs.courtId === courtId)?.slots ?? [])
    : []

  const selectedSlot = startTime ? currentSlots.find((s) => s.time === startTime) : null
  const endTime = computeEndTime(startTime, duration)

  // When date changes, reset time if slot no longer exists
  function handleDateChange(d: string) {
    setDate(d)
    setStartTime('')
  }

  // When court changes, reset time
  function handleCourtChange(id: string) {
    setCourtId(id)
    setStartTime('')
  }

  return (
    <div className="flex flex-col">
      {/* Court */}
      <div className="mb-[22px]">
        <p className="text-[9px] font-bold tracking-[1.5px] uppercase text-muted mb-[10px]">
          Cancha
        </p>
        <div className="flex flex-col gap-2">
          {courts.map((c) => {
            const isActive = courtId === c.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleCourtChange(c.id)}
                className={`flex items-center gap-[10px] px-[14px] py-[11px] rounded-xl border cursor-pointer
                            transition-all duration-[130ms]
                            ${
                              isActive
                                ? 'border-accent bg-accent/8'
                                : 'border-border bg-card hover:border-border-hover hover:bg-card-hover'
                            }`}
              >
                <span
                  className={`size-2 rounded-full shrink-0 transition-colors duration-[130ms]
                                  ${isActive ? 'bg-accent' : 'bg-border'}`}
                />
                <span
                  className={`text-sm font-semibold flex-1 text-left
                                  ${isActive ? 'text-accent' : 'text-text'}`}
                >
                  {c.name}
                </span>
                {isActive && (
                  <span className="size-[18px] rounded-full bg-accent text-accent-text flex items-center justify-center shrink-0">
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Date — revealed after court is selected */}
      {courtId && (
        <div className="mb-[22px] animate-wz-fade-in">
          <p className="text-[9px] font-bold tracking-[1.5px] uppercase text-muted mb-[10px]">
            Fecha
          </p>
          <div className="flex gap-[7px] overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {availableDates.map((d, idx) => {
              const dObj = new Date(`${d}T00:00:00.000Z`)
              const dow = DOW_LABELS[dObj.getUTCDay()]
              const day = dObj.getUTCDate()
              const isActive = date === d
              const isToday = idx === 0 && !isActive
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleDateChange(d)}
                  className={`shrink-0 flex flex-col items-center gap-[2px] min-w-[46px] px-[6px] py-2
                              rounded-xl border cursor-pointer transition-all duration-[130ms]
                              ${
                                isActive
                                  ? 'bg-accent border-accent'
                                  : isToday
                                    ? 'border-accent/45 bg-accent/6 hover:border-border-hover'
                                    : 'border-border bg-card hover:border-border-hover'
                              }`}
                >
                  <span
                    className={`text-[9px] font-bold uppercase tracking-[0.6px]
                                    ${isActive ? 'text-accent-text' : isToday ? 'text-accent' : 'text-muted'}`}
                  >
                    {idx === 0 ? 'Hoy' : dow}
                  </span>
                  <span
                    className={`text-[17px] font-extrabold leading-none
                                    ${isActive ? 'text-accent-text' : 'text-text'}`}
                  >
                    {day}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Time grid — revealed after date is selected */}
      {courtId && date && (
        <div className="mb-[22px] animate-wz-fade-in">
          <p className="text-[9px] font-bold tracking-[1.5px] uppercase text-muted mb-[10px]">
            Horario de inicio
          </p>
          {currentSlots.length === 0 ? (
            <p className="text-xs text-muted text-center py-4">
              Sin disponibilidad configurada para este día.
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-[6px]">
              {currentSlots.map((s) => {
                const isActive = startTime === s.time
                return (
                  <button
                    key={s.time}
                    type="button"
                    onClick={() => {
                      setStartTime(s.time)
                      // Reset duration if it's no longer valid for the new slot
                      if (!s.durationOptions.includes(duration)) {
                        setDuration(s.durationOptions[0] ?? 90)
                      }
                    }}
                    disabled={!s.available && !isActive}
                    className={`py-[10px] px-1 rounded-[10px] border text-[11px] font-mono font-semibold
                                cursor-pointer transition-all duration-[120ms]
                                ${
                                  isActive
                                    ? 'bg-accent border-accent text-accent-text font-bold'
                                    : !s.available
                                      ? 'border-border/40 bg-card/40 text-sub line-through cursor-not-allowed'
                                      : 'border-border bg-card text-muted hover:border-border-hover hover:text-text'
                                }`}
                  >
                    {s.time}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Duration — revealed after selecting time */}
      {startTime && (
        <div className="mb-[22px] animate-wz-fade-in">
          <p className="text-[9px] font-bold tracking-[1.5px] uppercase text-muted mb-[10px]">
            Duración
          </p>
          <div className="grid grid-cols-3 gap-2">
            {DURATIONS.map((d) => {
              const isActive = duration === d.value
              const isAvailable = selectedSlot
                ? selectedSlot.durationOptions.includes(d.value)
                : true
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => isAvailable && setDuration(d.value)}
                  disabled={!isAvailable}
                  className={`p-3 rounded-xl border text-[13px] font-bold cursor-pointer
                              transition-all duration-[130ms]
                              ${
                                isActive
                                  ? 'bg-accent border-accent text-accent-text'
                                  : !isAvailable
                                    ? 'border-border/40 bg-card/30 text-sub cursor-not-allowed'
                                    : 'border-border bg-card text-muted hover:border-border-hover hover:text-text'
                              }`}
                >
                  {d.label}
                </button>
              )
            })}
          </div>

          {/* End time preview */}
          <div
            className="mt-[10px] flex items-center justify-between px-[14px] py-[10px]
                          rounded-xl bg-accent/8 border border-accent/25"
          >
            <span className="text-xs text-muted">Fin estimado</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-sm text-text">{startTime}</span>
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="text-muted"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
              <span className="font-mono font-bold text-sm text-accent">{endTime}</span>
              <span className="text-[10px] text-muted bg-card border border-border px-2 py-0.5 rounded-full ml-1">
                {duration} min
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="pt-[10px]">
        <button
          type="button"
          onClick={onNext}
          disabled={!courtId || !date || !startTime}
          className="w-full px-5 py-[13px] rounded-xl bg-accent text-accent-text text-[13px] font-bold
                     cursor-pointer transition-all duration-[130ms] tracking-[0.2px]
                     enabled:hover:bg-accent-dark active:enabled:scale-[.98]
                     disabled:opacity-35 disabled:cursor-not-allowed"
        >
          Siguiente →
        </button>
      </div>
    </div>
  )
}

// ─── STEP 2 — CLIENTE ─────────────────────────────────────────────────────────

const BOOKING_TYPES: { id: BookingType; icon: string; label: string }[] = [
  { id: 'PRESENCIAL', icon: '👤', label: 'Presencial' },
  { id: 'TELEFONO', icon: '📞', label: 'Teléfono' },
  { id: 'BLOQUEO', icon: '🔒', label: 'Bloqueo' },
]

function Step2({
  bookingType,
  setBookingType,
  clientName,
  setClientName,
  clientPhone,
  setClientPhone,
  blockReason,
  setBlockReason,
  onNext,
  onBack,
}: {
  bookingType: BookingType
  setBookingType(v: BookingType): void
  clientName: string
  setClientName(v: string): void
  clientPhone: string
  setClientPhone(v: string): void
  blockReason: string
  setBlockReason(v: string): void
  onNext(): void
  onBack(): void
}) {
  const canNext = bookingType === 'BLOQUEO' || clientName.trim().length > 0

  return (
    <div className="flex flex-col">
      {/* Booking type */}
      <div className="mb-[22px]">
        <p className="text-[9px] font-bold tracking-[1.5px] uppercase text-muted mb-[10px]">
          Tipo de reserva
        </p>
        <div className="grid grid-cols-3 gap-2">
          {BOOKING_TYPES.map((t) => {
            const isActive = bookingType === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setBookingType(t.id)
                  setClientName('')
                  setClientPhone('')
                  setBlockReason('')
                }}
                className={`flex flex-col items-center gap-[6px] px-2 py-3 rounded-xl border
                            cursor-pointer transition-all duration-[130ms]
                            ${
                              isActive
                                ? 'border-accent bg-accent/8 text-accent'
                                : 'border-border bg-card text-muted hover:border-border-hover hover:text-text'
                            }`}
              >
                <span className="text-xl leading-none">{t.icon}</span>
                <span className="text-[11px] font-semibold">{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* PRESENCIAL / TELEFONO: name + phone */}
      {bookingType !== 'BLOQUEO' && (
        <div className="mb-[22px] animate-wz-fade-in flex flex-col gap-3">
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
              className="bg-surface border border-border rounded-[10px] px-3 py-[10px] text-[13px]
                         text-text outline-none transition-colors duration-[130ms] font-[inherit]
                         w-full placeholder:text-muted focus:border-accent"
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
              className="bg-surface border border-border rounded-[10px] px-3 py-[10px] text-[13px]
                         text-text outline-none transition-colors duration-[130ms] font-[inherit]
                         w-full placeholder:text-muted focus:border-accent"
            />
          </div>
        </div>
      )}

      {/* BLOQUEO */}
      {bookingType === 'BLOQUEO' && (
        <div className="mb-[22px] animate-wz-fade-in flex flex-col gap-3">
          <div className="flex items-start gap-3 px-4 py-[14px] rounded-xl bg-card border border-border">
            <span className="text-2xl shrink-0">🔒</span>
            <p className="text-sm text-muted leading-relaxed">
              Este horario quedará bloqueado y no estará disponible para reservas online.
            </p>
          </div>
          <div className="flex flex-col gap-[6px]">
            <label className="text-[10px] font-bold uppercase tracking-[1px] text-muted">
              Motivo <span className="text-muted font-normal normal-case">(opcional)</span>
            </label>
            <input
              type="text"
              placeholder="Ej: Mantenimiento, Clase, Torneo…"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              className="bg-surface border border-border rounded-[10px] px-3 py-[10px] text-[13px]
                         text-text outline-none transition-colors duration-[130ms] font-[inherit]
                         w-full placeholder:text-muted focus:border-accent"
            />
          </div>
        </div>
      )}

      <div className="pt-[10px] flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 px-5 py-3 rounded-xl border border-border bg-transparent text-muted
                     text-[13px] font-semibold cursor-pointer transition-all duration-[130ms]
                     hover:border-border-hover hover:text-text"
        >
          ← Volver
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          className="flex-[2] px-5 py-[13px] rounded-xl bg-accent text-accent-text text-[13px] font-bold
                     cursor-pointer transition-all duration-[130ms] tracking-[0.2px]
                     enabled:hover:bg-accent-dark active:enabled:scale-[.98]
                     disabled:opacity-35 disabled:cursor-not-allowed"
        >
          Siguiente →
        </button>
      </div>
    </div>
  )
}

// ─── STEP 3 — CONFIRMAR ───────────────────────────────────────────────────────

function Step3({
  courtName,
  date,
  startTime,
  duration,
  bookingType,
  clientName,
  blockReason,
  isPending,
  error,
  onConfirm,
  onBack,
}: {
  courtName: string
  date: string
  startTime: string
  duration: number
  bookingType: BookingType
  clientName: string
  blockReason: string
  isPending: boolean
  error: string | null
  onConfirm(): void
  onBack(): void
}) {
  const endTime = computeEndTime(startTime, duration)
  const dateLabel = formatDateFull(date)

  const typeLabel =
    bookingType === 'PRESENCIAL'
      ? 'Presencial'
      : bookingType === 'TELEFONO'
        ? 'Teléfono'
        : 'Bloqueo'

  const rows = [
    { label: 'Cancha', value: courtName, mono: false },
    { label: 'Fecha', value: dateLabel, mono: false },
    { label: 'Horario', value: `${startTime} → ${endTime}`, mono: true },
    { label: 'Duración', value: `${duration} min`, mono: false },
    ...(bookingType === 'BLOQUEO'
      ? [
          {
            label: 'Tipo',
            value: `🔒 Bloqueo${blockReason ? ` — ${blockReason}` : ''}`,
            mono: false,
          },
        ]
      : [
          { label: 'Tipo', value: typeLabel, mono: false },
          { label: 'Cliente', value: clientName, mono: false },
        ]),
  ]

  return (
    <div className="flex flex-col">
      <div className="mb-[22px]">
        <p className="text-[9px] font-bold tracking-[1.5px] uppercase text-muted mb-[10px]">
          Resumen
        </p>
        <div className="border border-border rounded-[14px] overflow-hidden">
          {rows.map((r, i) => (
            <div
              key={r.label}
              className={`flex items-center justify-between px-4 py-3 odd:bg-surface/55
                          ${i < rows.length - 1 ? 'border-b border-border/60' : ''}`}
            >
              <span className="text-xs text-muted">{r.label}</span>
              <span
                className={`text-sm font-semibold text-text text-right max-w-[58%]
                               ${r.mono ? 'font-mono' : ''}`}
              >
                {r.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-[22px]">
        <div
          className="flex items-center justify-between px-[14px] py-[10px]
                        rounded-xl bg-accent/8 border border-accent/25"
        >
          <span className="text-xs text-muted">Estado al crear</span>
          <span
            className="text-[11px] font-bold px-[10px] py-[3px] rounded-full
                           bg-accent/15 text-accent border border-accent/30"
          >
            ✓ Confirmada
          </span>
        </div>
      </div>

      {error && (
        <div
          className="mb-[22px] animate-wz-fade-in flex items-start gap-2 px-3 py-[10px]
                        rounded-[10px] bg-red-400/8 border border-red-400/25 text-red-400"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="shrink-0 mt-px"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-xs">{error}</p>
        </div>
      )}

      <div className="pt-[10px] flex gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={isPending}
          className="flex-1 px-5 py-3 rounded-xl border border-border bg-transparent text-muted
                     text-[13px] font-semibold cursor-pointer transition-all duration-[130ms]
                     enabled:hover:border-border-hover enabled:hover:text-text
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← Volver
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isPending}
          className="flex-[2] px-5 py-[13px] rounded-xl bg-accent text-accent-text text-[13px] font-bold
                     cursor-pointer transition-all duration-[130ms]
                     enabled:hover:bg-accent-dark active:enabled:scale-[.98]
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeOpacity=".2"
                />
                <path
                  d="M12 2a10 10 0 0 1 10 10"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              Creando…
            </span>
          ) : bookingType === 'BLOQUEO' ? (
            'Bloquear horario'
          ) : (
            'Confirmar reserva'
          )}
        </button>
      </div>
    </div>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────

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
}: ManualBookingWizardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Step 1 state
  const [courtId, setCourtId] = useState(
    defaultCourtId && courts.some((c) => c.id === defaultCourtId) ? defaultCourtId : ''
  )
  const [date, setDate] = useState(defaultDate ?? availableDates[0] ?? todayLocalStr())
  const [startTime, setStartTime] = useState(defaultTime ?? '')
  const [duration, setDuration] = useState(90)

  // Step 2 state
  const [bookingType, setBookingType] = useState<BookingType>('PRESENCIAL')
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [blockReason, setBlockReason] = useState('')

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  const courtName = courts.find((c) => c.id === courtId)?.name ?? ''

  function handleConfirm() {
    if (!courtId || !startTime) return
    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current)
      redirectTimerRef.current = null
    }
    setError(null)
    startTransition(async () => {
      const result = await createManualBookingAction({
        clubId,
        courtId,
        date,
        startTime,
        durationMinutes: duration,
        bookingType,
        manualName: bookingType !== 'BLOQUEO' ? clientName.trim() || undefined : undefined,
        manualPhone: bookingType !== 'BLOQUEO' ? clientPhone.trim() || undefined : undefined,
        blockReason: bookingType === 'BLOQUEO' ? blockReason.trim() || undefined : undefined,
      })
      if (result.success) {
        setSuccess(true)
        redirectTimerRef.current = setTimeout(() => {
          const newId = result.data?.bookingId
          setSuccess(false)
          if (onBookingCreated) {
            onBookingCreated({ date, bookingId: newId })
            redirectTimerRef.current = null
            return
          }
          router.push(`/admin/reservas?date=${date}${newId ? `&new=${newId}` : ''}`)
          redirectTimerRef.current = null
        }, 2000)
      } else {
        setError(result.error ?? 'Error al crear la reserva.')
      }
    })
  }
  return (
    <div
      className="relative flex flex-col h-full bg-bg overflow-y-auto overflow-x-hidden
                 [scrollbar-width:thin] [scrollbar-color:var(--sub)_transparent]"
      ref={scrollRef}
    >
      {/* ── Success overlay ── */}
      {success && (
        <div className="absolute inset-0 z-50 bg-black flex items-center justify-center animate-wz-success-overlay">
          <div className="flex flex-col items-center gap-6">
            <div
              className="size-[88px] rounded-full bg-[#22c55e] flex items-center justify-center
                            animate-wz-success-circle shadow-[0_0_40px_rgba(34,197,94,0.35)]"
            >
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" className="animate-wz-success-check" />
              </svg>
            </div>
            <div className="animate-wz-success-label text-center">
              <p className="text-white text-[17px] font-bold tracking-[2.5px] uppercase">
                Reserva creada
              </p>
              <p className="text-white/40 text-[11px] mt-[5px] tracking-wider">Redirigiendo...</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="sticky top-0 z-10 px-5 pt-[18px] pb-[14px] bg-surface border-b border-border flex flex-col gap-[14px]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-[22px] tracking-[3px] leading-none text-text">
              NUEVA RESERVA
            </h1>
            <p className="text-[11px] text-muted mt-[3px] capitalize truncate">
              {courtName
                ? `${courtName}${date ? ` · ${formatDateShort(date)}` : ''}`
                : 'Seleccioná cancha y horario'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (onClose) {
                onClose(date)
                return
              }
              router.push(`/admin/reservas?date=${date}`)
            }}
            className="shrink-0 size-8 rounded-xl border border-border bg-transparent text-muted
                       flex items-center justify-center cursor-pointer transition-all duration-[130ms]
                       hover:text-text hover:border-border-hover -mt-0.5"
            aria-label="Cancelar"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <StepDots current={step} />
      </div>

      {/* ── Progress bar ── */}
      <div className="h-[2px] bg-border shrink-0">
        <div
          className="h-full bg-accent transition-[width] duration-[450ms] ease-[cubic-bezier(.4,0,.2,1)]"
          style={{ width: `${(step / 3) * 100}%` }}
        />
      </div>

      {/* ── Content ── */}
      <div key={step} className="p-5 flex flex-col animate-wz-fade-in">
        {step === 1 && (
          <Step1
            courts={courts}
            courtId={courtId}
            setCourtId={setCourtId}
            date={date}
            setDate={setDate}
            startTime={startTime}
            setStartTime={setStartTime}
            duration={duration}
            setDuration={setDuration}
            courtSlotsByDate={courtSlotsByDate}
            availableDates={availableDates}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <Step2
            bookingType={bookingType}
            setBookingType={setBookingType}
            clientName={clientName}
            setClientName={setClientName}
            clientPhone={clientPhone}
            setClientPhone={setClientPhone}
            blockReason={blockReason}
            setBlockReason={setBlockReason}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <Step3
            courtName={courtName}
            date={date}
            startTime={startTime}
            duration={duration}
            bookingType={bookingType}
            clientName={clientName}
            blockReason={blockReason}
            isPending={isPending}
            error={error}
            onConfirm={handleConfirm}
            onBack={() => setStep(2)}
          />
        )}
      </div>
    </div>
  )
}
