'use client'

import { useRef, useEffect, useState } from 'react'
import { calcBookingPrice, formatPrice, timeToMinutes } from '@/lib/availability'
import { computeEndTime, formatDateShort } from '../../floating-booking-form/helpers/manualBookingWizard.helpers'
import { getBlockEndOptions } from '../../floating-booking-form/helpers/blockEndOptions'
import { BLOCK_REASON_PRESETS } from '../../floating-booking-form/helpers/constants'
import { useRecentClients } from '../../floating-booking-form/hooks/useRecentClients'
import type { CourtColumn } from '@/features/reservas/components/booking-grid/BookingGrid'
import type { FloatingFormCourtSlots } from '@/features/reservas/actions/floatingFormData'

interface DrawerStepClientProps {
  date: string
  startTime: string
  duration: number
  courtId: string
  courts: CourtColumn[]
  courtSlots: FloatingFormCourtSlots[]
  bookingMode: 'RESERVA' | 'BLOQUEO'
  clientName: string
  clientPhone: string
  noClient: boolean
  motivo: string
  reasonPreset: string
  isPending: boolean
  onNameChange: (v: string) => void
  onPhoneChange: (v: string) => void
  onNoClientToggle: (v: boolean) => void
  onMotivoChange: (v: string) => void
  onReasonPresetChange: (v: string) => void
  onDurationChange: (d: number) => void
}

const inputCls = 'w-full bg-surface border border-border rounded-[10px] px-3 py-2.5 text-[13px] text-text outline-none focus:border-accent font-[inherit] placeholder:text-muted transition-colors'
const ring = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50'

export default function DrawerStepClient({
  date, startTime, duration, courtId, courts, courtSlots,
  bookingMode, clientName, clientPhone, noClient, motivo, reasonPreset,
  isPending, onNameChange, onPhoneChange, onNoClientToggle,
  onMotivoChange, onReasonPresetChange, onDurationChange,
}: DrawerStepClientProps) {
  const nameRef = useRef<HTMLInputElement>(null)
  const [showPhone, setShowPhone] = useState(false)
  const { recentClients } = useRecentClients()

  useEffect(() => {
    if (bookingMode === 'RESERVA') {
      const t = setTimeout(() => nameRef.current?.focus(), 120)
      return () => clearTimeout(t)
    }
  }, [bookingMode])

  const courtName = courts.find((c) => c.id === courtId)?.name ?? ''
  const slot = courtSlots.find((cs) => cs.courtId === courtId)?.slots.find((s) => s.time === startTime)
  const price = slot ? calcBookingPrice(slot.pricePerHour, duration) : 0
  const endTime = startTime && duration > 0 ? computeEndTime(startTime, duration) : null

  // BLOQUEO: end time options
  const blockEndOptions = bookingMode === 'BLOQUEO' && startTime && courtId
    ? getBlockEndOptions(startTime, courtId, courtSlots)
    : []

  // Derive selected end time from duration
  const selectedEndTime = bookingMode === 'BLOQUEO' && startTime && duration > 0
    ? computeEndTime(startTime, duration)
    : null

  function handleEndTimeSelect(endOpt: string) {
    const startMin = timeToMinutes(startTime)
    const endMin = timeToMinutes(endOpt)
    const diff = endMin > startMin ? endMin - startMin : (endMin + 24 * 30) - startMin
    onDurationChange(diff)
  }

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-150">
      {/* Resumen sticky */}
      <div className="px-3 py-3 bg-surface border border-border rounded-2xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-bold text-text">{courtName}</p>
            <p className="text-[12px] text-muted">
              {formatDateShort(date)} · {startTime}{endTime ? ` → ${endTime}` : ''}
            </p>
          </div>
          {bookingMode === 'RESERVA' && price > 0 && (
            <span className="text-[15px] font-bold text-accent">{formatPrice(price)}</span>
          )}
        </div>
      </div>

      {bookingMode === 'BLOQUEO' ? (
        <>
          {/* End time picker */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">
              Hora de fin
              {blockEndOptions.length === 0 && <span className="ml-2 normal-case font-normal text-muted/60">— Sin opciones disponibles</span>}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {blockEndOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  disabled={isPending}
                  onClick={() => handleEndTimeSelect(opt)}
                  className={`px-3 py-1.5 rounded-lg border text-[12px] font-mono font-semibold cursor-pointer transition-all active:scale-95 disabled:opacity-40 ${
                    selectedEndTime === opt
                      ? 'border-accent bg-accent text-accent-text'
                      : 'border-border bg-surface text-muted hover:border-border-hover hover:text-text'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Motivo (opcional) */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Motivo <span className="normal-case font-normal">(opcional)</span></p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {BLOCK_REASON_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    onReasonPresetChange(preset === reasonPreset ? '' : preset)
                    onMotivoChange(preset === reasonPreset ? '' : preset)
                  }}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer active:scale-95 disabled:opacity-40 ${
                    reasonPreset === preset
                      ? 'bg-accent/15 border-accent/60 text-accent'
                      : 'bg-surface border-border text-muted hover:border-border-hover hover:text-text'
                  }`}
                >
                  {preset}
                </button>
              ))}
              <button
                type="button"
                disabled={isPending}
                onClick={() => { onReasonPresetChange('otro'); onMotivoChange('') }}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer active:scale-95 disabled:opacity-40 ${
                  reasonPreset === 'otro'
                    ? 'bg-accent/15 border-accent/60 text-accent'
                    : 'border-dashed border-border text-muted hover:border-border-hover hover:text-text'
                }`}
              >
                Otro...
              </button>
            </div>
            {(reasonPreset === 'otro' || (!BLOCK_REASON_PRESETS.includes(reasonPreset as never) && motivo)) && (
              <input
                type="text"
                placeholder="Describe el motivo..."
                value={motivo}
                onChange={(e) => onMotivoChange(e.target.value)}
                disabled={isPending}
                className={`${inputCls} ${ring} animate-in fade-in slide-in-from-top-1 duration-150`}
                autoFocus
              />
            )}
          </div>
        </>
      ) : (
        /* Campo cliente */
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">¿A nombre de quién?</p>

          <input
            ref={nameRef}
            type="text"
            placeholder={noClient ? 'Sin cliente asignado' : 'Nombre del cliente'}
            value={noClient ? '' : clientName}
            onChange={(e) => {
              if (noClient) onNoClientToggle(false)
              onNameChange(e.target.value)
            }}
            disabled={isPending || noClient}
            className={`${inputCls} ${ring} ${noClient ? 'opacity-40 cursor-not-allowed' : ''}`}
          />

          {/* Chips: recientes + sin asignar */}
          <div className="flex flex-wrap gap-1.5">
            {recentClients.map((c) => {
              const isSelected = !noClient && clientName === c.name
              return (
                <button
                  key={c.name}
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    if (noClient) onNoClientToggle(false)
                    onNameChange(c.name)
                    if (c.phone) { onPhoneChange(c.phone); setShowPhone(true) }
                  }}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer active:scale-95 ${
                    isSelected
                      ? 'bg-accent/15 border-accent/60 text-accent'
                      : 'bg-surface border-border text-muted hover:border-border-hover hover:text-text'
                  }`}
                >
                  {c.name.split(' ')[0]}
                </button>
              )
            })}
            <button
              type="button"
              disabled={isPending}
              onClick={() => onNoClientToggle(!noClient)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer active:scale-95 ${
                noClient
                  ? 'bg-accent/15 border-accent/60 text-accent'
                  : 'border-dashed border-border text-muted hover:border-border-hover hover:text-text'
              }`}
            >
              Sin asignar
            </button>
          </div>

          {/* Teléfono colapsado */}
          {showPhone ? (
            <input
              type="tel"
              placeholder="Teléfono (opcional)"
              value={clientPhone}
              onChange={(e) => onPhoneChange(e.target.value)}
              disabled={isPending}
              className={`${inputCls} ${ring} animate-in fade-in slide-in-from-top-1 duration-150`}
            />
          ) : (
            !noClient && (
              <button
                type="button"
                onClick={() => setShowPhone(true)}
                className="self-start text-[11px] text-muted hover:text-text font-semibold transition-colors"
              >
                + Teléfono
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}
