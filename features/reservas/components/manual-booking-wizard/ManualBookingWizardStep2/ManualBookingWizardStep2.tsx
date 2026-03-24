import { useState } from 'react'
import { type BookingType, BOOKING_TYPES } from '../types/manualBookingWizard.types'

const BLOCK_CATEGORIES = [
  { id: 'entrenamiento', label: 'Entrenamiento', icon: '🏋️' },
  { id: 'torneo',        label: 'Torneo',        icon: '🏆' },
  { id: 'evento',        label: 'Evento',        icon: '🎉' },
  { id: 'mantenimiento', label: 'Mantenimiento', icon: '🔧' },
  { id: 'otro',          label: 'Otro',          icon: '✏️' },
] as const

type BlockCategoryId = (typeof BLOCK_CATEGORIES)[number]['id']

interface ManualBookingWizardStep2Props {
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
}

export default function ManualBookingWizardStep2({
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
}: ManualBookingWizardStep2Props) {
  const [blockCategory, setBlockCategory] = useState<BlockCategoryId | null>(null)

  function handleCategorySelect(cat: BlockCategoryId) {
    setBlockCategory(cat)
    if (cat !== 'otro') setBlockReason(BLOCK_CATEGORIES.find((c) => c.id === cat)!.label)
    else setBlockReason('')
  }

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

      {/* PRESENCIAL / TELEFONO */}
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

          {/* Categorías de bloqueo */}
          <div className="flex flex-col gap-[8px]">
            <p className="text-[9px] font-bold tracking-[1.5px] uppercase text-muted">
              Motivo del bloqueo
            </p>
            <div className="grid grid-cols-3 gap-2">
              {BLOCK_CATEGORIES.map((cat) => {
                const isActive = blockCategory === cat.id
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategorySelect(cat.id)}
                    className={`flex flex-col items-center gap-[5px] px-2 py-2.5 rounded-xl border
                                cursor-pointer transition-all duration-[130ms] text-center
                                ${
                                  isActive
                                    ? 'border-accent bg-accent/8 text-accent'
                                    : 'border-border bg-card text-muted hover:border-border-hover hover:text-text'
                                }`}
                  >
                    <span className="text-lg leading-none">{cat.icon}</span>
                    <span className="text-[10px] font-semibold leading-tight">{cat.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Input libre — solo cuando eligieron "Otro" */}
            {blockCategory === 'otro' && (
              <input
                type="text"
                placeholder="Describir motivo…"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                autoFocus
                className="bg-surface border border-border rounded-[10px] px-3 py-[10px] text-[13px]
                           text-text outline-none transition-colors duration-[130ms] font-[inherit]
                           w-full placeholder:text-muted focus:border-accent animate-wz-fade-in"
              />
            )}
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
