'use client'

import { memo } from 'react'
import CourtDiagram from '../CourtDiagram/CourtDiagram'
import {
  DAY_LABELS,
  DURATION_LABELS,
  MONTH_LABELS,
  STEPS,
} from '../helpers/bookingWizard.helpers'
import type {
  BookingStep,
  CourtForWizard,
  PaymentMethod,
  Period,
} from '../types/bookingWizard.types'
import type { DurationMinutes } from '@/lib/availability'

type SlotOption = {
  time: string
  available: boolean
  durationOptions: number[]
}

interface StepHeaderProps {
  step: BookingStep
  onGoToStep: (step: BookingStep) => void
}

export const StepHeader = memo(function StepHeader({ step, onGoToStep }: StepHeaderProps) {
  return (
    <div className="flex border-b border-border">
      {STEPS.map((label, i) => {
        const stepNum = (i + 1) as BookingStep
        const isActive = step === stepNum
        const isDone = step > stepNum
        return (
          <button
            key={label}
            type="button"
            onClick={() => isDone && onGoToStep(stepNum)}
            disabled={!isDone}
            className={`flex-1 py-3 text-xs font-semibold tracking-wide transition-colors border-r last:border-r-0 border-border ${
              isActive
                ? 'bg-accent/10 text-accent'
                : isDone
                  ? 'text-muted hover:text-text cursor-pointer'
                  : 'text-sub cursor-default'
            }`}
          >
            <span
              className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs mr-1.5 ${
                isActive
                  ? 'bg-accent text-accent-text'
                  : isDone
                    ? 'bg-border text-muted'
                    : 'bg-surface text-sub'
              }`}
            >
              {isDone ? '✓' : stepNum}
            </span>
            {label}
          </button>
        )
      })}
    </div>
  )
})

interface Step1Props {
  userId: string | null
  guestReady: boolean
  guestName: string
  guestEmail: string
  guestError: string | null
  dates: Date[]
  selectedDate: Date
  currentPath: string
  onGuestNameChange: (value: string) => void
  onGuestEmailChange: (value: string) => void
  onGuestContinue: (e: React.FormEvent) => void
  onGuestReset: () => void
  onSelectDate: (date: Date) => void
  onContinue: () => void
}

export const Step1AuthDate = memo(function Step1AuthDate({
  userId,
  guestReady,
  guestName,
  guestEmail,
  guestError,
  dates,
  selectedDate,
  currentPath,
  onGuestNameChange,
  onGuestEmailChange,
  onGuestContinue,
  onGuestReset,
  onSelectDate,
  onContinue,
}: Step1Props) {
  if (!userId && !guestReady) {
    return (
      <div className="space-y-4">
        <p className="text-xs text-muted">¿Tenés cuenta en PadelGo?</p>

        <div className="flex gap-2">
          <a
            href={`/login?redirect=${encodeURIComponent(currentPath)}`}
            className="flex-1 py-2.5 text-center text-sm font-semibold bg-accent text-accent-text rounded-xl hover:bg-accent-dark transition-colors"
          >
            Iniciar sesión
          </a>
          <a
            href={`/registro?redirect=${encodeURIComponent(currentPath)}`}
            className="flex-1 py-2.5 text-center text-sm font-semibold bg-surface border border-border text-text rounded-xl hover:bg-card transition-colors"
          >
            Registrarse
          </a>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-sub">o continuá sin cuenta</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={onGuestContinue} className="space-y-3">
          <div>
            <label className="text-xs text-muted block mb-1">Tu nombre</label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => onGuestNameChange(e.target.value)}
              placeholder="Nombre y apellido"
              autoComplete="name"
              className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder:text-sub focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Tu email</label>
            <input
              type="email"
              value={guestEmail}
              onChange={(e) => onGuestEmailChange(e.target.value)}
              placeholder="hola@ejemplo.com"
              autoComplete="email"
              className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder:text-sub focus:outline-none focus:border-accent"
            />
          </div>

          {guestError && (
            <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/30 rounded-lg px-3 py-2">
              {guestError}
            </p>
          )}

          <button
            type="submit"
            className="w-full py-2.5 bg-surface border border-border text-text text-sm font-semibold rounded-xl hover:bg-card hover:border-border-hover transition-colors"
          >
            Reservar como invitado →
          </button>
        </form>
      </div>
    )
  }

  return (
    <div>
      {!userId && guestReady && (
        <div className="mb-3 bg-surface border border-border rounded-xl px-3 py-2 flex items-center justify-between gap-2">
          <div>
            <p className="text-xs text-muted">Reservando como invitado</p>
            <p className="text-sm font-semibold text-text truncate">{guestName}</p>
          </div>
          <button
            type="button"
            onClick={onGuestReset}
            className="text-xs text-sub hover:text-muted underline shrink-0"
          >
            Cambiar
          </button>
        </div>
      )}

      <p className="text-xs text-muted mb-3">Elegí la fecha de tu turno</p>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {dates.map((date) => {
          const isSelected = date.toDateString() === selectedDate.toDateString()
          return (
            <button
              key={date.toISOString()}
              type="button"
              onClick={() => onSelectDate(date)}
              className={`flex flex-col items-center px-3 py-2 rounded-xl border shrink-0 min-w-14 transition-colors ${
                isSelected
                  ? 'bg-accent border-accent text-accent-text'
                  : 'bg-surface border-border text-muted hover:border-border-hover hover:text-text'
              }`}
            >
              <span className="text-xs font-medium">{DAY_LABELS[date.getUTCDay()]}</span>
              <span className="font-mono text-lg font-semibold leading-none mt-0.5">
                {date.getUTCDate()}
              </span>
              <span className="text-xs opacity-70">{MONTH_LABELS[date.getUTCMonth()]}</span>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="mt-5 w-full py-2.5 bg-accent text-accent-text text-sm font-semibold rounded-xl hover:bg-accent-dark transition-colors"
      >
        Continuar →
      </button>
    </div>
  )
})

interface Step2Props {
  selectedDate: Date
  courts: CourtForWizard[]
  selectedCourtId: string | null
  selectedCourt: CourtForWizard | null
  selectedTime: string | null
  slots: SlotOption[]
  slotsByPeriod: Record<Period, SlotOption[]>
  cooldownActive: boolean
  cooldownPct: number
  onSelectCourt: (id: string) => void
  onSelectSlot: (time: string) => void
  onContinue: () => void
}

export const Step2CourtAndSlots = memo(function Step2CourtAndSlots({
  selectedDate,
  courts,
  selectedCourtId,
  selectedCourt,
  selectedTime,
  slots,
  slotsByPeriod,
  cooldownActive,
  cooldownPct,
  onSelectCourt,
  onSelectSlot,
  onContinue,
}: Step2Props) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        Fecha:{' '}
        <span className="text-text font-semibold">
          {DAY_LABELS[selectedDate.getUTCDay()]} {selectedDate.getUTCDate()}{' '}
          {MONTH_LABELS[selectedDate.getUTCMonth()]}
        </span>
      </p>

      <CourtDiagram
        courts={courts}
        selectedCourtId={selectedCourtId}
        onSelectCourt={onSelectCourt}
      />

      {selectedCourt ? (
        <div>
          {slots.length === 0 ? (
            <p className="text-sm text-muted text-center py-6">
              No hay horarios disponibles para este día.
            </p>
          ) : (
            (['Mañana', 'Tarde', 'Noche'] as Period[]).map((period) => {
              const periodSlots = slotsByPeriod[period]
              if (periodSlots.length === 0) return null
              return (
                <div key={period} className="mb-4">
                  <p className="text-xs font-semibold text-sub tracking-widest uppercase mb-2">
                    {period}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {periodSlots.map((slot) => {
                      const isSelected = selectedTime === slot.time
                      if (!slot.available) {
                        return (
                          <div
                            key={slot.time}
                            className="relative px-3 py-1.5 rounded-lg text-sm font-mono font-medium border select-none"
                            style={{
                              background: 'var(--surface)',
                              borderColor: 'var(--border)',
                              color: 'var(--sub)',
                              cursor: 'not-allowed',
                              opacity: 0.5,
                            }}
                            title="Turno ya reservado"
                          >
                            <span className="line-through">{slot.time}</span>
                            <span
                              className="absolute -top-2 -right-1 text-[8px] font-bold uppercase tracking-wide px-1 py-0.5 rounded"
                              style={{
                                background: 'rgba(239,68,68,0.15)',
                                color: 'rgb(239,68,68)',
                                border: '1px solid rgba(239,68,68,0.25)',
                              }}
                            >
                              Ocupado
                            </span>
                          </div>
                        )
                      }

                      return (
                        <button
                          key={slot.time}
                          type="button"
                          onClick={() => onSelectSlot(slot.time)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-mono font-medium border transition-all ${
                            isSelected
                              ? 'bg-accent text-accent-text border-accent scale-105 shadow-md'
                              : 'bg-surface border-border text-text hover:border-border-hover hover:bg-card'
                          }`}
                        >
                          {isSelected && <span className="mr-1 text-xs">🔒</span>}
                          {slot.time}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      ) : (
        <p className="text-sm text-muted text-center py-4">
          Seleccioná una cancha para ver los horarios.
        </p>
      )}

      <div className="relative">
        <button
          type="button"
          disabled={!selectedTime || !selectedCourtId || cooldownActive}
          onClick={onContinue}
          className="w-full py-2.5 bg-accent text-accent-text text-sm font-semibold rounded-xl hover:bg-accent-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed relative overflow-hidden"
        >
          {cooldownActive ? 'Reservando turno...' : 'Continuar →'}
          {cooldownActive && (
            <span
              className="absolute bottom-0 left-0 h-0.5 bg-accent-text/40 transition-none"
              style={{ width: `${cooldownPct}%` }}
            />
          )}
        </button>
      </div>
    </div>
  )
})

interface Step3Props {
  userId: string | null
  guestReady: boolean
  guestName: string
  currentPath: string
  selectedCourtName?: string
  selectedDate: Date
  selectedTime: string | null
  durationOptions: number[]
  selectedDuration: DurationMinutes
  totalPrice: number
  error: string | null
  isPending: boolean
  onRetrySlotTaken: () => void
  onSelectDuration: (duration: DurationMinutes) => void
  onConfirm: () => void
}

export const Step3Confirm = memo(function Step3Confirm({
  userId,
  guestReady,
  guestName,
  currentPath,
  selectedCourtName,
  selectedDate,
  selectedTime,
  durationOptions,
  selectedDuration,
  totalPrice,
  error,
  isPending,
  onRetrySlotTaken,
  onSelectDuration,
  onConfirm,
}: Step3Props) {
  return (
    <div className="space-y-4">
      {error === 'SLOT_TAKEN' && (
        <div
          className="rounded-xl p-4 border"
          style={{
            background: 'rgba(239,68,68,0.06)',
            borderColor: 'rgba(239,68,68,0.25)',
          }}
        >
          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0">⚠️</span>
            <div className="flex-1">
              <p className="font-semibold text-sm text-text mb-1">Este turno acaba de ser reservado</p>
              <p className="text-xs text-muted mb-3">Alguien llegó primero. Elegí otro horario.</p>
              <button
                type="button"
                onClick={onRetrySlotTaken}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-accent text-accent-text hover:bg-accent-dark transition-colors"
              >
                Ver otros turnos →
              </button>
            </div>
          </div>
        </div>
      )}

      {error === 'ACCOUNT_EXISTS' && (
        <div
          className="rounded-xl p-4 border"
          style={{
            background: 'rgba(251,191,36,0.06)',
            borderColor: 'rgba(251,191,36,0.25)',
          }}
        >
          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0">👤</span>
            <div className="flex-1">
              <p className="font-semibold text-sm text-text mb-1">Ya tenés una cuenta con ese email</p>
              <p className="text-xs text-muted mb-3">
                Iniciá sesión para completar la reserva con tu cuenta.
              </p>
              <a
                href={`/login?redirect=${encodeURIComponent(currentPath)}`}
                className="inline-block px-4 py-2 text-xs font-semibold rounded-lg bg-accent text-accent-text hover:bg-accent-dark transition-colors"
              >
                Iniciar sesión →
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="bg-surface border border-border rounded-xl p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Cancha</span>
          <span className="text-text font-medium">{selectedCourtName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Fecha</span>
          <span className="text-text font-medium">
            {DAY_LABELS[selectedDate.getUTCDay()]} {selectedDate.getUTCDate()}{' '}
            {MONTH_LABELS[selectedDate.getUTCMonth()]}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Horario</span>
          <span className="font-mono text-text font-medium">{selectedTime}</span>
        </div>
        {!userId && guestReady && (
          <div className="flex justify-between pt-1 border-t border-border">
            <span className="text-muted">Invitado</span>
            <span className="text-text font-medium">{guestName}</span>
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold text-sub tracking-widest uppercase mb-2">Duración</p>
        <div className="flex gap-2">
          {durationOptions.map((dur) => (
            <button
              key={dur}
              type="button"
              onClick={() => onSelectDuration(dur as DurationMinutes)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                selectedDuration === dur
                  ? 'bg-accent text-accent-text border-accent'
                  : 'bg-surface border-border text-muted hover:border-border-hover hover:text-text'
              }`}
            >
              {DURATION_LABELS[dur] ?? `${dur}m`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between bg-surface border border-border rounded-xl p-4">
        <span className="text-sm text-muted">Total a pagar</span>
        <span className="font-mono text-2xl font-semibold text-accent">
          {new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 0,
          }).format(totalPrice / 100)}
        </span>
      </div>

      {error && error !== 'SLOT_TAKEN' && error !== 'ACCOUNT_EXISTS' && (
        <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {error !== 'SLOT_TAKEN' && error !== 'ACCOUNT_EXISTS' && (
        <button
          type="button"
          disabled={isPending}
          onClick={onConfirm}
          className="w-full py-3 bg-accent text-accent-text text-sm font-semibold rounded-xl hover:bg-accent-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? 'Reservando...' : 'Continuar al pago →'}
        </button>
      )}

      <p className="text-xs text-center text-sub">
        Al confirmar aceptás los términos del club y la política de cancelación.
      </p>
    </div>
  )
})

interface Step4Props {
  bookingId: string
  selectedCourtName?: string
  selectedDate: Date
  selectedTime: string | null
  selectedDuration: DurationMinutes
  totalPrice: number
  userId: string | null
  selectedPaymentMethod: PaymentMethod
  paymentError: string | null
  isPending: boolean
  onSelectPayment: (method: Exclude<PaymentMethod, null>) => void
  onConfirmPayment: () => void
  onBack: () => void
}

export const Step4Payment = memo(function Step4Payment({
  selectedCourtName,
  selectedDate,
  selectedTime,
  selectedDuration,
  totalPrice,
  userId,
  selectedPaymentMethod,
  paymentError,
  isPending,
  onSelectPayment,
  onConfirmPayment,
  onBack,
}: Step4Props) {
  return (
    <div className="space-y-4">
      <div className="bg-surface border border-border rounded-xl p-4 text-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-muted">Tu reserva</span>
          <span className="text-xs text-accent font-semibold">PENDIENTE DE PAGO</span>
        </div>
        <p className="font-semibold text-text">
          {selectedCourtName} · {DAY_LABELS[selectedDate.getUTCDay()]} {selectedDate.getUTCDate()}{' '}
          {MONTH_LABELS[selectedDate.getUTCMonth()]}
        </p>
        <p className="text-muted">
          {selectedTime} · {DURATION_LABELS[selectedDuration]}
        </p>
        <div className="mt-2 pt-2 border-t border-border flex justify-between">
          <span className="text-muted">Total</span>
          <span className="font-mono font-semibold text-accent">
            {new Intl.NumberFormat('es-AR', {
              style: 'currency',
              currency: 'ARS',
              minimumFractionDigits: 0,
            }).format(totalPrice / 100)}
          </span>
        </div>
      </div>

      <p className="text-xs font-semibold text-sub tracking-widest uppercase">Elegí cómo pagar</p>

      {userId && (
        <button
          type="button"
          onClick={() => onSelectPayment('mp')}
          className={`w-full p-4 rounded-xl border text-left transition-colors ${
            selectedPaymentMethod === 'mp'
              ? 'bg-accent text-accent-text border-accent ring-2 ring-accent'
              : 'bg-surface text-text border-border hover:border-border-hover hover:bg-card'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                selectedPaymentMethod === 'mp' ? 'border-accent-text bg-accent-text' : 'border-border'
              }`}
            >
              {selectedPaymentMethod === 'mp' && <span className="text-accent text-xs">✓</span>}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Pagar con Mercado Pago</p>
              <p
                className={`text-xs ${selectedPaymentMethod === 'mp' ? 'opacity-80' : 'text-muted'}`}
              >
                Tarjeta, débito o efectivo
              </p>
            </div>
            <span className="text-2xl">💳</span>
          </div>
        </button>
      )}

      <button
        type="button"
        onClick={() => onSelectPayment('cash')}
        className={`w-full p-4 rounded-xl border text-left transition-colors ${
          selectedPaymentMethod === 'cash'
            ? 'bg-accent text-accent-text border-accent ring-2 ring-accent'
            : 'bg-surface text-text border-border hover:border-border-hover hover:bg-card'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              selectedPaymentMethod === 'cash' ? 'border-accent-text bg-accent-text' : 'border-border'
            }`}
          >
            {selectedPaymentMethod === 'cash' && <span className="text-accent text-xs">✓</span>}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">Pagar en efectivo en el club</p>
            <p
              className={`text-xs ${selectedPaymentMethod === 'cash' ? 'opacity-80' : 'text-muted'}`}
            >
              Abonás cuando llegues
            </p>
          </div>
          <span className="text-2xl">💵</span>
        </div>
      </button>

      {paymentError && (
        <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {paymentError}
        </p>
      )}

      {selectedPaymentMethod && (
        <button
          type="button"
          onClick={onConfirmPayment}
          disabled={isPending}
          className="w-full py-3 bg-accent text-accent-text text-sm font-semibold rounded-xl hover:bg-accent-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? 'Procesando...' : 'Confirmar pago →'}
        </button>
      )}

      <button
        type="button"
        onClick={onBack}
        className="w-full text-center py-2 text-sm text-muted hover:text-text transition-colors"
      >
        ← Volver
      </button>
    </div>
  )
})