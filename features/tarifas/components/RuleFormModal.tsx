'use client'

import { useState, useTransition } from 'react'
import type { BookingRuleRow } from '@/features/tarifas/dal/rules'
import type { RuleInput, RuleActionResult } from '@/features/tarifas/actions/rules'

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
  onSubmit: (data: RuleInput) => Promise<RuleActionResult<{ id: string }>>
  initialData: BookingRuleRow | null
  courts: { id: string; name: string }[]
  isDuplicate?: boolean
  /** Forces priority=0, hides priority/courts, shows vigencia radio */
  baseRuleMode?: boolean
  /** Used for auto-fill when creating a new base rule version */
  activeBaseRule?: BookingRuleRow | null
}

export default function RuleFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  courts,
  isDuplicate,
  baseRuleMode,
  activeBaseRule,
}: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [conflictWarning, setConflictWarning] = useState<{ message: string; payload: RuleInput } | null>(null)

  // When creating a new base rule version, auto-fill from the active rule
  const fillSource =
    baseRuleMode && !initialData && activeBaseRule ? activeBaseRule : initialData

  const [name, setName] = useState(isDuplicate ? '' : (fillSource?.name ?? ''))
  const [priority, setPriority] = useState(
    baseRuleMode ? '0' : String(fillSource?.priority ?? 1)
  )
  const [courtIds, setCourtIds] = useState<string[]>(
    baseRuleMode ? [] : (fillSource?.courtIds ?? [])
  )
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    fillSource?.daysOfWeek ?? [1, 2, 3, 4, 5]
  )
  const [startTime, setStartTime] = useState(fillSource?.startTime ?? '08:00')
  const [endTime, setEndTime] = useState(fillSource?.endTime ?? '23:00')
  const [priceARS, setPriceARS] = useState(
    fillSource?.price != null ? String(Math.round(fillSource.price / 100)) : ''
  )
  const [intervalMinutes, setIntervalMinutes] = useState(
    String(fillSource?.intervalMinutes ?? 30)
  )
  const [allowedDurations, setAllowedDurations] = useState<number[]>(
    fillSource?.allowedDurations ?? [60, 90, 120]
  )
  const [isActive, setIsActive] = useState(fillSource?.isActive ?? true)

  // Vigencia: radio for base rule creation, date inputs otherwise
  const [vigencia, setVigencia] = useState<'immediate' | 'scheduled'>('immediate')
  const [activeFrom, setActiveFrom] = useState(
    initialData?.activeFrom && !isDuplicate ? initialData.activeFrom.toISOString().slice(0, 10) : ''
  )
  const [activeUntil, setActiveUntil] = useState(
    initialData?.activeUntil && !isDuplicate ? initialData.activeUntil.toISOString().slice(0, 10) : ''
  )

  if (!isOpen) return null

  const isEditingBase = !baseRuleMode && initialData?.priority === 0 && initialData.courtIds.length === 0
  const isBaseForm = baseRuleMode || isEditingBase
  const showVigenciaRadio = baseRuleMode && !initialData

  const allCourtsSelected = courtIds.length === 0

  function toggleCourt(id: string) {
    setCourtIds((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id])
  }
  function toggleDay(day: number) {
    setDaysOfWeek((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day])
  }
  function toggleDuration(dur: number) {
    setAllowedDurations((prev) => prev.includes(dur) ? prev.filter((d) => d !== dur) : [...prev, dur])
  }

  function handleSubmit() {
    if (!name.trim()) return setError('El nombre es obligatorio.')
    if (daysOfWeek.length === 0) return setError('Seleccioná al menos un día.')
    if (allowedDurations.length === 0) return setError('Seleccioná al menos una duración.')
    const pNum = parseInt(priority, 10)
    if (pNum === 0 && priceARS.trim() === '') return setError('La regla base requiere un precio.')
    if (startTime >= endTime) return setError('El horario de inicio debe ser anterior al de cierre.')

    const resolvedActiveFrom = showVigenciaRadio
      ? (vigencia === 'immediate' ? null : (activeFrom ? new Date(`${activeFrom}T00:00:00.000Z`) : null))
      : (activeFrom ? new Date(`${activeFrom}T00:00:00.000Z`) : null)

    const resolvedActiveUntil = showVigenciaRadio
      ? null
      : (activeUntil ? new Date(`${activeUntil}T00:00:00.000Z`) : null)

    if (!showVigenciaRadio && activeFrom && activeUntil && activeFrom > activeUntil) {
      return setError('"Válida hasta" debe ser posterior a "Válida desde".')
    }

    const price = priceARS.trim() === '' ? null : parseInt(priceARS, 10) * 100
    const payload: RuleInput = {
      name: name.trim(),
      priority: pNum,
      courtIds: isBaseForm ? [] : courtIds,
      daysOfWeek,
      startTime,
      endTime,
      price,
      intervalMinutes: parseInt(intervalMinutes, 10),
      allowedDurations,
      isActive: baseRuleMode && !initialData ? true : isActive,
      activeFrom: resolvedActiveFrom,
      activeUntil: resolvedActiveUntil,
    }
    setError(null)
    startTransition(async () => {
      const res = await onSubmit(payload)
      if (res.success) {
        onClose()
      } else if ('warning' in res && res.warning) {
        setConflictWarning({ message: res.message, payload })
      } else {
        setError(res.error)
      }
    })
  }

  function handleConfirmConflict() {
    if (!conflictWarning) return
    const payload = conflictWarning.payload
    setConflictWarning(null)
    startTransition(async () => {
      const res = await onSubmit({ ...payload, confirmConflicts: true })
      if (res.success) {
        onClose()
      } else if (!('warning' in res)) {
        setError(res.error)
      }
    })
  }

  const inputCls =
    'bg-surface border border-border rounded-[10px] px-3 py-[9px] text-[13px] text-text outline-none w-full ' +
    'placeholder:text-muted focus:border-accent transition-colors font-[inherit]'
  const labelCls = 'text-[10px] font-bold uppercase tracking-[1.5px] text-muted mb-1.5 block'

  const title = isDuplicate ? 'Duplicar Regla' : baseRuleMode && !initialData ? 'Nueva Versión Base' : initialData ? 'Editar Regla' : 'Nueva Regla'
  const submitLabel = pending ? 'Guardando…' : isDuplicate ? 'Crear copia' : initialData ? 'Guardar cambios' : 'Crear regla'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-bg rounded-t-3xl sm:rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="font-display text-[16px] tracking-[2.5px] text-text uppercase">{title}</h2>
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

          {/* Name (+ Priority for non-base rules) */}
          <div className={`grid gap-3 ${isBaseForm ? 'grid-cols-1' : 'grid-cols-3'}`}>
            <div className={isBaseForm ? '' : 'col-span-2'}>
              <label className={labelCls}>Nombre</label>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={baseRuleMode ? 'Ej: Temporada Alta 2026' : 'Ej: Horario Nocturno'} />
            </div>
            {!isBaseForm && (
              <div>
                <label className={labelCls}>Prioridad</label>
                <input
                  className={inputCls}
                  type="number"
                  min={1}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Courts — only for non-base rules */}
          {!isBaseForm && courts.length > 0 && (
            <div>
              <label className={labelCls}>Canchas</label>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setCourtIds([])}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-[12px] font-semibold transition-colors w-full text-left
                              ${allCourtsSelected ? 'bg-accent/15 border-accent/50 text-accent' : 'bg-surface border-border text-muted hover:border-border-hover'}`}
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${allCourtsSelected ? 'bg-accent border-accent' : 'border-border'}`}>
                    {allCourtsSelected && (
                      <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="2 6 5 9 10 3" />
                      </svg>
                    )}
                  </span>
                  Todas las canchas
                </button>
                <div className="grid grid-cols-2 gap-1.5 pl-1">
                  {courts.map((c) => {
                    const checked = courtIds.includes(c.id)
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleCourt(c.id)}
                        className={`flex items-center gap-2 px-3 py-[7px] rounded-lg border text-[12px] transition-colors text-left
                                    ${checked ? 'bg-accent/10 border-accent/40 text-text' : 'bg-surface border-border text-muted hover:border-border-hover'}`}
                      >
                        <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-accent border-accent' : 'border-border'}`}>
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

          {/* ── Main fields ─────────────────────────────────────────── */}

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
                              ${daysOfWeek.includes(value) ? 'bg-accent/20 border-accent/60 text-accent' : 'bg-surface border-border text-muted hover:border-border-hover'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Time range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Apertura</label>
              <input className={inputCls} type="time" step={1800} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Cierre</label>
              <input className={inputCls} type="time" step={1800} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          {/* Price */}
          <div>
            <label className={labelCls}>Precio por hora (ARS)</label>
            <input
              className={inputCls}
              type="number"
              min={0}
              placeholder={!isBaseForm ? 'Heredar de regla base' : 'Requerido'}
              value={priceARS}
              onChange={(e) => setPriceARS(e.target.value)}
            />
          </div>

          {/* ── Vigencia ─────────────────────────────────────────────── */}
          {showVigenciaRadio ? (
            <div>
              <label className={labelCls}>Vigencia</label>
              <div className="flex flex-col gap-2">
                <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors
                                  ${vigencia === 'immediate' ? 'bg-accent/5 border-accent/40' : 'bg-surface border-border hover:border-border-hover'}`}>
                  <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                                   ${vigencia === 'immediate' ? 'border-accent' : 'border-border'}`}>
                    {vigencia === 'immediate' && <span className="w-2 h-2 rounded-full bg-accent" />}
                  </div>
                  <input type="radio" className="sr-only" checked={vigencia === 'immediate'} onChange={() => setVigencia('immediate')} />
                  <div>
                    <p className="text-[13px] font-semibold text-text">Activar inmediatamente</p>
                    <p className="text-[11px] text-muted mt-0.5">Reemplaza a la regla base activa al guardar.</p>
                  </div>
                </label>
                <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors
                                  ${vigencia === 'scheduled' ? 'bg-accent/5 border-accent/40' : 'bg-surface border-border hover:border-border-hover'}`}>
                  <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                                   ${vigencia === 'scheduled' ? 'border-accent' : 'border-border'}`}>
                    {vigencia === 'scheduled' && <span className="w-2 h-2 rounded-full bg-accent" />}
                  </div>
                  <input type="radio" className="sr-only" checked={vigencia === 'scheduled'} onChange={() => setVigencia('scheduled')} />
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-text">Programar a partir de una fecha</p>
                    <p className="text-[11px] text-muted mt-0.5">La regla entrará en vigencia en la fecha elegida.</p>
                    {vigencia === 'scheduled' && (
                      <input
                        className={`${inputCls} mt-2`}
                        type="date"
                        value={activeFrom}
                        onChange={(e) => setActiveFrom(e.target.value)}
                      />
                    )}
                  </div>
                </label>
              </div>
            </div>
          ) : !isBaseForm && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Válida desde</label>
                <input className={inputCls} type="date" value={activeFrom} onChange={(e) => setActiveFrom(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Válida hasta</label>
                <input className={inputCls} type="date" value={activeUntil} onChange={(e) => setActiveUntil(e.target.value)} />
              </div>
            </div>
          )}

          {/* ── Advanced settings ─────────────────────────────────────── */}
          <details className="group">
            <summary className="flex items-center gap-2 cursor-pointer list-none text-[11px] font-bold uppercase tracking-[1.5px] text-muted hover:text-text transition-colors select-none">
              <svg
                width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                className="transition-transform group-open:rotate-90"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              Configuración Avanzada del Turno
            </summary>
            <div className="mt-4 flex flex-col gap-4">
              <div>
                <label className={labelCls}>Intervalo de slots</label>
                <div className="flex gap-2">
                  {[30, 60].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setIntervalMinutes(String(v))}
                      className={`flex-1 py-[9px] rounded-[10px] text-[12px] font-bold border transition-colors
                                  ${intervalMinutes === String(v) ? 'bg-accent/20 border-accent/60 text-accent' : 'bg-surface border-border text-muted hover:border-border-hover'}`}
                    >
                      {v} min
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Duraciones permitidas</label>
                <div className="flex gap-2">
                  {DURATION_OPTIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDuration(d)}
                      className={`flex-1 py-[7px] rounded-lg text-[11px] font-bold border transition-colors
                                  ${allowedDurations.includes(d) ? 'bg-accent/20 border-accent/60 text-accent' : 'bg-surface border-border text-muted hover:border-border-hover'}`}
                    >
                      {DURATION_LABELS[d]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </details>

          {/* Active toggle — only for non-base rule edits */}
          {!baseRuleMode && initialData && (
            <div className="flex items-center justify-between py-1">
              <span className="text-[13px] text-text font-medium">Activa</span>
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
          )}

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
            {submitLabel}
          </button>
        </div>
      </div>

      {/* Conflict pre-flight modal */}
      {conflictWarning && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm rounded-t-3xl sm:rounded-2xl">
          <div className="w-full bg-bg rounded-2xl border border-amber-500/30 shadow-2xl p-5 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-amber-400">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <p className="text-[13px] font-bold text-text mb-1">Conflicto de turnos</p>
                <p className="text-[12px] text-muted leading-relaxed">{conflictWarning.message}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConflictWarning(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-[13px] font-semibold text-muted hover:text-text hover:border-border-hover transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={handleConfirmConflict}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-[13px] font-bold hover:bg-amber-600 transition-colors active:scale-[.98] disabled:opacity-40"
              >
                {pending ? 'Guardando…' : 'Continuar de todos modos'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
