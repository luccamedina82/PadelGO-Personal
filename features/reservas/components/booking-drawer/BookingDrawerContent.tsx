'use client'

import { useReducer, useTransition } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { calcBookingPrice } from '@/lib/availability'
import { getWeekStart } from '@/lib/date'
import { createManualBooking } from '@/features/reservas/actions/bookings'
import { getFloatingFormDataAction } from '@/features/reservas/actions/floatingFormData'
import { useRecentClients } from '../floating-booking-form/hooks/useRecentClients'
import { drawerReducer, initialDrawerState } from './helpers/drawerReducer'
import DrawerStepIntent from './steps/DrawerStepIntent'
import DrawerStepDateTime from './steps/DrawerStepDateTime'
import DrawerStepCourt from './steps/DrawerStepCourt'
import DrawerStepClient from './steps/DrawerStepClient'
import type { CourtColumn } from '@/features/reservas/components/booking-grid/BookingGrid'
import type { BookingBlock } from '@/features/reservas/components/booking-grid/types/bookingGrid.types'

interface Props {
  clubId: string
  courts: CourtColumn[]
  initialDate: string
  initialCourtId?: string
  initialStartTime?: string
  initialDuration?: number
  initialAllowedDurations?: number[]
  onClose: () => void
  onCreated: (bookingId?: string) => void
}

const STEP_LABELS_RESERVA = ['¿Cuándo?', 'Horario', 'Cancha', 'Cliente']
const STEP_LABELS_BLOQUEO = ['¿Cuándo?', 'Horario', 'Cancha', 'Motivo']

export default function BookingDrawerContent({
  clubId, courts, initialDate, initialCourtId, initialStartTime, initialDuration, initialAllowedDurations, onClose, onCreated,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const queryClient = useQueryClient()
  const router = useRouter()
  const { saveClient } = useRecentClients()
  const [state, dispatch] = useReducer(
    drawerReducer,
    initialDrawerState(initialDate, { courtId: initialCourtId, startTime: initialStartTime, duration: initialDuration }),
  )

  const stepLabels = state.bookingMode === 'BLOQUEO' ? STEP_LABELS_BLOQUEO : STEP_LABELS_RESERVA

  const { data: floatingData, isLoading } = useQuery({
    queryKey: ['floatingData', clubId, state.date],
    queryFn: () => getFloatingFormDataAction(clubId, state.date),
    staleTime: 60_000,
    enabled: state.step >= 1,
  })
  const courtSlots = floatingData?.courtSlots ?? []
  const globalDurations = initialAllowedDurations ?? []

  const slot = courtSlots.find((cs) => cs.courtId === state.courtId)?.slots.find((s) => s.time === state.startTime)
  const basePrice = slot ? calcBookingPrice(slot.pricePerHour, state.duration) : 0

  const canSubmit = state.bookingMode === 'BLOQUEO'
    ? !!state.courtId && !!state.startTime && state.duration > 0
    : !!state.courtId && !!state.startTime && state.duration > 0 &&
      (state.noClient || state.clientName.trim().length > 0)

  function handleBack() {
    if (state.step === 0) { onClose(); return }
    const prev = (state.step - 1) as 0 | 1 | 2 | 3
    dispatch({ type: 'GO_STEP', payload: prev })
  }

  function handleSubmit() {
    if (!canSubmit || isPending) return
    dispatch({ type: 'SET_ERROR', payload: null })

    startTransition(async () => {
      const payload = state.bookingMode === 'BLOQUEO'
        ? {
            clubId,
            courtId: state.courtId,
            date: state.date,
            startTime: state.startTime,
            durationMinutes: state.duration,
            bookingType: 'BLOQUEO' as const,
            blockReason: state.motivo.trim() || undefined,
          }
        : {
            clubId,
            courtId: state.courtId,
            date: state.date,
            startTime: state.startTime,
            durationMinutes: state.duration,
            bookingType: 'PRESENCIAL' as const,
            manualName: state.noClient ? undefined : (state.clientName.trim() || undefined),
            manualPhone: state.noClient ? undefined : (state.clientPhone.trim() || undefined),
          }

      const result = await createManualBooking(payload)

      if (result.success && result.data) {
        if (state.bookingMode === 'RESERVA' && !state.noClient && state.clientName.trim()) {
          saveClient(state.clientName.trim(), state.clientPhone.trim() || undefined)
        }
        const bookingId = result.data.bookingId
        toast.success(state.bookingMode === 'BLOQUEO' ? 'Bloqueo creado' : 'Reserva creada', { position: 'bottom-right' })
        const weekStart = getWeekStart(state.date)
        queryClient.invalidateQueries({ queryKey: ['bookings', clubId, 'week', weekStart] })
        queryClient.invalidateQueries({ queryKey: ['floatingData', clubId, state.date] })
        const optimistic: BookingBlock = {
          id: bookingId, clubId, courtId: state.courtId, startTime: state.startTime,
          durationMinutes: state.duration,
          status: 'CONFIRMED',
          source: state.bookingMode === 'BLOQUEO' ? 'BLOCK' : 'MANUAL_STAFF',
          displayName: state.bookingMode === 'BLOQUEO'
            ? (state.motivo.trim() || 'Bloqueo')
            : (state.noClient ? '—' : (state.clientName.trim() || '—')),
          totalPrice: state.bookingMode === 'BLOQUEO' ? 0 : basePrice,
          paymentStatus: 'UNPAID',
          manualPhone: state.bookingMode === 'RESERVA' ? (state.clientPhone.trim() || null) : null,
          date: state.date,
        }
        queryClient.setQueryData(['bookings', clubId, 'week', weekStart], (old: BookingBlock[] | undefined) =>
          [...(old ?? []), optimistic],
        )
        onCreated(bookingId)
      } else {
        const msg = ('error' in result ? (result.error as string) : null) ?? 'Error al crear.'
        toast.error(msg, { position: 'bottom-right' })
        dispatch({ type: 'SET_ERROR', payload: msg })
      }
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {state.step > 0 && (
              <button
                type="button"
                onClick={handleBack}
                disabled={isPending}
                className="flex items-center gap-1 text-[12px] font-semibold text-muted hover:text-text transition-colors disabled:opacity-40"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Volver
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-surface transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1 p-1 bg-surface rounded-xl mb-3">
          {(['RESERVA', 'BLOQUEO'] as const).map((m) => (
            <button
              key={m}
              type="button"
              disabled={isPending}
              onClick={() => dispatch({ type: 'SET_BOOKING_MODE', payload: m })}
              className={`flex-1 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40 ${
                state.bookingMode === m
                  ? 'bg-card text-text shadow-sm'
                  : 'text-muted hover:text-text'
              }`}
            >
              {m === 'RESERVA' ? 'Reserva' : 'Bloqueo'}
            </button>
          ))}
        </div>

        {/* Step dots */}
        {state.step > 0 && (
          <div className="flex items-center gap-1.5">
            {stepLabels.slice(1).map((label, i) => {
              const s = (i + 1) as 1 | 2 | 3
              const isDone = state.step > s
              const isCurrent = state.step === s
              return (
                <div key={s} className="flex items-center gap-1.5">
                  <div className={`flex items-center gap-1 ${isCurrent ? '' : isDone ? 'opacity-60' : 'opacity-25'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${isDone ? 'bg-green-500' : isCurrent ? 'bg-accent' : 'bg-muted'}`} />
                    <span className={`text-[10px] font-semibold ${isCurrent ? 'text-text' : 'text-muted'}`}>{label}</span>
                  </div>
                  {i < 2 && <span className="text-muted/30 text-[10px]">›</span>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-5 [scrollbar-width:thin]">
        {state.step === 0 && (
          <DrawerStepIntent clubId={clubId} onSelectDate={(d) => dispatch({ type: 'SET_DATE', date: d })} />
        )}
        {state.step === 1 && (
          <DrawerStepDateTime
            date={state.date}
            bookingMode={state.bookingMode}
            selectedDuration={state.duration}
            selectedTime={state.startTime}
            globalDurations={globalDurations}
            courtSlots={courtSlots}
            isLoading={isLoading}
            onDurationChange={(d) => dispatch({ type: 'SET_DURATION', payload: d })}
            onTimeSelect={(t) => dispatch({ type: 'SET_TIME', payload: t })}
          />
        )}
        {state.step === 2 && (
          <DrawerStepCourt
            startTime={state.startTime}
            duration={state.duration}
            courts={courts}
            courtSlots={courtSlots}
            onSelect={(id) => dispatch({ type: 'SET_COURT', payload: id })}
          />
        )}
        {state.step === 3 && (
          <DrawerStepClient
            date={state.date}
            startTime={state.startTime}
            duration={state.duration}
            courtId={state.courtId}
            courts={courts}
            courtSlots={courtSlots}
            bookingMode={state.bookingMode}
            clientName={state.clientName}
            clientPhone={state.clientPhone}
            noClient={state.noClient}
            motivo={state.motivo}
            reasonPreset={state.reasonPreset}
            isPending={isPending}
            onNameChange={(v) => dispatch({ type: 'SET_FIELD', field: 'clientName', value: v })}
            onPhoneChange={(v) => dispatch({ type: 'SET_FIELD', field: 'clientPhone', value: v })}
            onNoClientToggle={(v) => dispatch({ type: 'SET_NO_CLIENT', payload: v })}
            onMotivoChange={(v) => dispatch({ type: 'SET_FIELD', field: 'motivo', value: v })}
            onReasonPresetChange={(v) => dispatch({ type: 'SET_FIELD', field: 'reasonPreset', value: v })}
            onDurationChange={(d) => dispatch({ type: 'SET_DURATION', payload: d })}
          />
        )}

        {state.error && (
          <p className="mt-4 text-[12px] text-red-400 bg-red-400/8 border border-red-400/20 rounded-lg px-3 py-2 animate-in fade-in duration-150">
            {state.error}
          </p>
        )}
      </div>

      {/* Footer — solo visible en step 3 */}
      {state.step === 3 && (
        <div className="px-5 py-4 border-t border-border shrink-0 flex gap-2">
          <button
            type="button"
            onClick={handleBack}
            disabled={isPending}
            className="flex-1 py-3 rounded-xl border border-border text-[13px] font-semibold text-muted hover:text-text hover:border-border-hover transition-colors disabled:opacity-40"
          >
            Volver
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || isPending}
            className="flex-[2] py-3 rounded-xl bg-accent text-accent-text text-[13px] font-bold cursor-pointer transition-all enabled:hover:bg-accent-dark active:enabled:scale-[.98] disabled:opacity-35 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-1.5">
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity=".2"/>
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                </svg>
                Creando…
              </span>
            ) : state.bookingMode === 'BLOQUEO' ? 'Confirmar bloqueo' : 'Confirmar reserva'}
          </button>
        </div>
      )}
    </div>
  )
}
