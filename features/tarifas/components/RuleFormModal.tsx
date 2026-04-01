'use client'

import { useState, useTransition } from 'react'
import type { BookingRuleRow } from '@/features/tarifas/dal/rules'
import type { RuleInput } from '@/features/tarifas/actions/rules'
import type { ActionResult } from '@/types'

const DAY_OPTIONS = [
  { label: 'Do', value: 0 },
  { label: 'Lu', value: 1 },
  { label: 'Ma', value: 2 },
  { label: 'Mi', value: 3 },
  { label: 'Ju', value: 4 },
  { label: 'Vi', value: 5 },
  { label: 'Sá', value: 6 },
]
const DURATION_OPTIONS = [60, 90, 120]
const DURATION_LABELS: Record<number, string> = { 60: '1h', 90: '1h 30', 120: '2h' }

interface Props {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: RuleInput) => Promise<ActionResult<{ id: string }> | ActionResult>
  initialData: BookingRuleRow | null
  courts: { id: string; name: string }[]
}

export default function RuleFormModal({ isOpen, onClose, onSubmit, initialData, courts }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(initialData?.name ?? '')
  const [priority, setPriority] = useState(String(initialData?.priority ?? 1))
  const [courtIds, setCourtIds] = useState<string[]>(initialData?.courtIds ?? [])
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(initialData?.daysOfWeek ?? [1, 2, 3, 4, 5])
  const [startTime, setStartTime] = useState(initialData?.startTime ?? '08:00')
  const [endTime, setEndTime] = useState(initialData?.endTime ?? '23:00')
  const [priceARS, setPriceARS] = useState(
    initialData?.price != null ? String(Math.round(initialData.price / 100)) : ''
  )
  const [intervalMinutes, setIntervalMinutes] = useState(String(initialData?.intervalMinutes ?? 30))
  const [allowedDurations, setAllowedDurations] = useState<number[]>(
    initialData?.allowedDurations ?? [60, 90, 120]
  )
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true)

  if (!isOpen) return null

  const isBaseRule = initialData?.priority === 0
  const allCourtsSelected = courtIds.length === 0

  function toggleCourt(id: string) {
    setCourtIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }

  function toggleDay(day: number) {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  function toggleDuration(dur: number) {
    setAllowedDurations((prev) =>
      prev.includes(dur) ? prev.filter((d) => d !== dur) : [...prev, dur]
    )
  }

  function handleSubmit() {
    if (!name.trim()) return setError('El nombre es obligatorio.')
    if (daysOfWeek.length === 0) return setError('Seleccioná al menos un día.')
    if (allowedDurations.length === 0) return setError('Seleccioná al menos una duración.')
    const pNum = parseInt(priority, 10)
    if (pNum === 0 && priceARS.trim() === '')
      return setError('La regla default requiere un precio.')
    if (startTime >= endTime) return setError('El horario de inicio debe ser anterior al de cierre.')

    const price = priceARS.trim() === '' ? null : parseInt(priceARS, 10) * 100
    setError(null)
    startTransition(async () => {
      const res = await onSubmit({
        name: name.trim(),
        priority: pNum,
        courtIds,
        daysOfWeek,
        startTime,
        endTime,
        price,
        intervalMinutes: parseInt(intervalMinutes, 10),
        allowedDurations,
        isActive,
      })
      if (res.success) {
        onClose()
      } else {
        setError(res.error)
      }
    })
  }

  const inputCls =
    'bg-surface border border-border rounded-[10px] px-3 py-[9px] text-[13px] text-text outline-none w-full ' +
    'placeholder:text-muted focus:border-accent transition-colors font-[inherit]'
  const labelCls = 'text-[10px] font-bold uppercase tracking-[1.5px] text-muted mb-1.5 block'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-bg rounded-t-3xl sm:rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="font-display text-[16px] tracking-[2.5px] text-text uppercase">
            {initialData ? 'Editar Regla' : 'Nueva Regla'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-xl border border-border text-muted flex items-center justify-center hover:text-text hover:border-border-hover transition-all"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-5 [scrollbar-width:thin]">

          {/* Name + Priority row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Nombre</label>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Horario Nocturno" />
            </div>
            <div>
              <label className={labelCls}>Prioridad</label>
              <input
                className={`${inputCls} ${isBaseRule ? 'opacity-50 cursor-not-allowed' : ''}`}
                type="number"
                min={isBaseRule ? 0 : 1}
                disabled={isBaseRule}
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              />
            </div>
          </div>

          {/* Courts — checkboxes */}
          {courts.length > 0 && (
            <div>
              <label className={labelCls}>Canchas</label>
              <div className={`flex flex-col gap-2 ${isBaseRule ? 'opacity-50 pointer-events-none' : ''}`}>
                {/* "Todas" toggle */}
                <button
                  type="button"
                  onClick={() => setCourtIds([])}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-[12px] font-semibold transition-colors w-full text-left
                              ${allCourtsSelected
                                ? 'bg-accent/15 border-accent/50 text-accent'
                                : 'bg-surface border-border text-muted hover:border-border-hover'
                              }`}
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors
                                    ${allCourtsSelected ? 'bg-accent border-accent' : 'border-border'}`}>
                    {allCourtsSelected && (
                      <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="2 6 5 9 10 3" />
                      </svg>
                    )}
                  </span>
                  Todas las canchas
                </button>

                {/* Individual court checkboxes */}
                <div className="grid grid-cols-2 gap-1.5 pl-1">
                  {courts.map((c) => {
                    const checked = courtIds.includes(c.id)
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleCourt(c.id)}
                        className={`flex items-center gap-2 px-3 py-[7px] rounded-lg border text-[12px] transition-colors text-left
                                    ${checked
                                      ? 'bg-accent/10 border-accent/40 text-text'
                                      : 'bg-surface border-border text-muted hover:border-border-hover'
                                    }`}
                      >
                        <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors
                                          ${checked ? 'bg-accent border-accent' : 'border-border'}`}>
                          {checked && (
                            <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <polyline points="2 6 5 9 10 3" />
                            </svg>
                          )}
                        </span>
                        <span className="truncate">{c.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Days */}
          <div>
            <label className={labelCls}>Días de la semana</label>
            <div className="flex gap-2">
              {DAY_OPTIONS.map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleDay(value)}
                  className={`flex-1 py-[7px] rounded-lg text-[11px] font-bold border transition-colors
                              ${daysOfWeek.includes(value)
                                ? 'bg-accent/20 border-accent/60 text-accent'
                                : 'bg-surface border-border text-muted hover:border-border-hover'
                              }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Time range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Desde</label>
              <input className={inputCls} type="time" step={1800} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Hasta</label>
              <input className={inputCls} type="time" step={1800} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          {/* Price + Interval row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Precio por hora (ARS)</label>
              <input
                className={inputCls}
                type="number"
                min={0}
                placeholder={parseInt(priority, 10) > 0 ? 'Heredar de default' : 'Requerido'}
                value={priceARS}
                onChange={(e) => setPriceARS(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Intervalo de slots</label>
              <div className="flex gap-2">
                {[30, 60].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setIntervalMinutes(String(v))}
                    className={`flex-1 py-[9px] rounded-[10px] text-[12px] font-bold border transition-colors
                                ${intervalMinutes === String(v)
                                  ? 'bg-accent/20 border-accent/60 text-accent'
                                  : 'bg-surface border-border text-muted hover:border-border-hover'
                                }`}
                  >
                    {v} min
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Allowed durations */}
          <div>
            <label className={labelCls}>Duraciones permitidas</label>
            <div className="flex gap-2">
              {DURATION_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDuration(d)}
                  className={`flex-1 py-[7px] rounded-lg text-[11px] font-bold border transition-colors
                              ${allowedDurations.includes(d)
                                ? 'bg-accent/20 border-accent/60 text-accent'
                                : 'bg-surface border-border text-muted hover:border-border-hover'
                              }`}
                >
                  {DURATION_LABELS[d]}
                </button>
              ))}
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between py-1">
            <span className="text-[13px] text-text font-medium">Activa al guardar</span>
            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              onClick={() => setIsActive((v) => !v)}
              className={`relative w-10 h-6 rounded-full border transition-colors duration-200 cursor-pointer
                          ${isActive ? 'bg-accent border-accent' : 'bg-surface border-border'}`}
            >
              <span className={`absolute top-[3px] left-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${isActive ? 'translate-x-4' : ''}`} />
            </button>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400 px-3 py-2 rounded-lg bg-red-400/8 border border-red-400/25">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border shrink-0">
          <button
            type="button"
            disabled={pending}
            onClick={handleSubmit}
            className="w-full py-[13px] rounded-xl bg-accent text-accent-text text-[13px] font-bold
                       cursor-pointer hover:bg-accent-dark transition-all active:scale-[.98]
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pending ? 'Guardando…' : initialData ? 'Guardar cambios' : 'Crear regla'}
          </button>
        </div>
      </div>
    </div>
  )
}
