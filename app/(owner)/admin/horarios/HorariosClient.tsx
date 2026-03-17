'use client'

import { useState, useTransition } from 'react'
import { Toast, useToast } from '@/components/ui'
import type { ActionResult } from '@/types'

interface Availability {
  id: string
  courtId: string
  dayOfWeek: number
  openTime: string
  closeTime: string
  pricePerHour: number
  isActive: boolean
}

interface Court {
  id: string
  name: string
  availabilities: Availability[]
}

interface HorariosClientProps {
  clubId: string
  clubName: string
  courts: Court[]
  updateClubAvailabilityAction: (input: {
    clubId: string
    rows: Array<{
      courtId: string
      dayOfWeek: number
      openTime: string
      closeTime: string
      pricePerHour: number
      isActive: boolean
    }>
  }) => Promise<ActionResult>
}

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const TIME_OPTIONS = Array.from({ length: 29 }, (_, i) => {
  const totalMin = 360 + i * 30 // 06:00 → 00:00
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${String(h % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

const SELECT_STYLE =
  'appearance-none bg-surface border border-border rounded-lg pl-2.5 pr-6 py-1 text-xs text-text font-mono focus:outline-none focus:border-accent cursor-pointer'

export default function HorariosClient({
  clubId,
  clubName,
  courts,
  updateClubAvailabilityAction,
}: HorariosClientProps) {
  const [isPending, startTransition] = useTransition()
  const { toast, show: showToast } = useToast(3000)
  const [isDirty, setIsDirty] = useState(false)

  const buildKey = (courtId: string, dow: number) => `${courtId}-${dow}`

  // Build initial state from server data
  const initialState: Record<string, Omit<Availability, 'id' | 'courtId'>> = {}
  for (const court of courts) {
    for (let dow = 0; dow < 7; dow++) {
      const avail = court.availabilities.find((a) => a.dayOfWeek === dow)
      initialState[buildKey(court.id, dow)] = {
        dayOfWeek: dow,
        openTime: avail?.openTime ?? '08:00',
        closeTime: avail?.closeTime ?? '22:00',
        pricePerHour: avail?.pricePerHour ?? 700000, // $7000 default
        isActive: avail?.isActive ?? false,
      }
    }
  }

  const [state, setState] = useState(initialState)

  function update(
    courtId: string,
    dow: number,
    partial: Partial<Omit<Availability, 'id' | 'courtId'>>
  ) {
    const key = buildKey(courtId, dow)
    setState((prev) => ({ ...prev, [key]: { ...prev[key]!, ...partial } }))
    setIsDirty(true)
  }

  function handleSaveAll() {
    const rows = courts.flatMap((court) =>
      Array.from({ length: 7 }, (_, dow) => {
        const data = state[buildKey(court.id, dow)]!
        return {
          courtId: court.id,
          dayOfWeek: dow,
          openTime: data.openTime,
          closeTime: data.closeTime,
          pricePerHour: data.pricePerHour,
          isActive: data.isActive,
        }
      })
    )

    startTransition(async () => {
      const result = await updateClubAvailabilityAction({ clubId, rows })
      if (result.success) {
        setIsDirty(false)
        showToast('success', 'Horarios guardados correctamente')
      } else {
        showToast('error', result.error ?? 'Error al guardar los horarios.')
      }
    })
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Toast notification */}
      {toast && <Toast toast={toast} />}

      {/* Sticky header with bulk save button */}
      <div className="sticky top-0 z-10 bg-surface border-b border-border px-4 py-3 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-semibold text-text">Horarios — {clubName}</h1>
          <p className="text-xs text-muted">Configurá la disponibilidad de cada cancha por día</p>
        </div>

        <button
          type="button"
          onClick={handleSaveAll}
          disabled={isPending || !isDirty}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-accent text-accent-text text-sm font-semibold rounded-xl hover:bg-accent-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-accent-text/30 border-t-accent-text rounded-full animate-spin" />
              Guardando...
            </>
          ) : isDirty ? (
            'Guardar cambios'
          ) : (
            'Sin cambios'
          )}
        </button>
      </div>

      <div className="p-4 space-y-6 max-w-3xl mx-auto pb-16">
        {courts.length === 0 && (
          <div className="text-center py-16 text-muted text-sm">
            No hay canchas activas para configurar.
          </div>
        )}

        {courts.map((court) => (
          <div key={court.id} className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Court header */}
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
              <h2 className="font-semibold text-text text-sm">{court.name}</h2>
            </div>

            {/* Days rows */}
            <div className="divide-y divide-border">
              {DAYS.map((dayLabel, dow) => {
                const key = buildKey(court.id, dow)
                const data = state[key]
                if (!data) return null

                return (
                  <div key={dow} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0">
                      {/* Active toggle */}
                      <button
                        type="button"
                        onClick={() => update(court.id, dow, { isActive: !data.isActive })}
                        className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                          data.isActive ? 'bg-accent' : 'bg-border'
                        }`}
                        aria-label={data.isActive ? 'Desactivar día' : 'Activar día'}
                      >
                        <span
                          className={`absolute top-0.5 left-0 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                            data.isActive ? 'translate-x-[22px]' : 'translate-x-0.5'
                          }`}
                        />
                      </button>

                      {/* Day label */}
                      <span
                        className={`text-sm font-medium w-8 flex-shrink-0 ${
                          data.isActive ? 'text-text' : 'text-muted'
                        }`}
                      >
                        {dayLabel}
                      </span>

                      {data.isActive ? (
                        <>
                          {/* Open time */}
                          <div className="relative flex-shrink-0">
                            <select
                              value={data.openTime}
                              onChange={(e) => update(court.id, dow, { openTime: e.target.value })}
                              className={SELECT_STYLE}
                            >
                              {TIME_OPTIONS.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                            <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted text-xs">
                              ▾
                            </span>
                          </div>

                          <span className="text-muted text-xs flex-shrink-0">–</span>

                          {/* Close time */}
                          <div className="relative flex-shrink-0">
                            <select
                              value={data.closeTime}
                              onChange={(e) => update(court.id, dow, { closeTime: e.target.value })}
                              className={SELECT_STYLE}
                            >
                              {TIME_OPTIONS.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                            <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted text-xs">
                              ▾
                            </span>
                          </div>

                          {/* Price */}
                          <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                            <span className="text-xs text-muted">$</span>
                            <input
                              type="number"
                              value={Math.round(data.pricePerHour / 100)}
                              onChange={(e) =>
                                update(court.id, dow, {
                                  pricePerHour: Math.round(parseFloat(e.target.value) * 100) || 0,
                                })
                              }
                              className="w-20 bg-surface border border-border rounded-lg px-2 py-1 text-xs text-text font-mono text-right focus:outline-none focus:border-accent"
                              step="100"
                              min="0"
                            />
                            <span className="text-xs text-muted">/hr</span>
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-sub ml-auto">Cerrado</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* Bottom save button (visible when there are unsaved changes on long pages) */}
        {isDirty && courts.length > 0 && (
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isPending}
            className="w-full py-3 bg-accent text-accent-text text-sm font-semibold rounded-xl hover:bg-accent-dark transition-colors disabled:opacity-50"
          >
            {isPending ? 'Guardando...' : 'Guardar todos los cambios'}
          </button>
        )}
      </div>
    </div>
  )
}
