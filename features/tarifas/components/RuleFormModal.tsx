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
  baseRuleMode?: boolean
  activeBaseRule?: BookingRuleRow | null
  baseDurations?: number[]
}

function Seg({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-[9px] font-bold uppercase tracking-[2px] text-muted/60 whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-border/60" />
    </div>
  )
}

export default function RuleFormModal({
  isOpen, onClose, onSubmit, initialData, courts,
  isDuplicate, baseRuleMode, activeBaseRule, baseDurations,
}: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [conflictWarning, setConflictWarning] = useState<{ message: string; payload: RuleInput } | null>(null)

  const fillSource = baseRuleMode && !initialData && activeBaseRule ? activeBaseRule : initialData
  const isEditingBase = !baseRuleMode && initialData?.priority === 0 && initialData.courtIds.length === 0
  const isBaseForm = baseRuleMode || isEditingBase
  const showVigenciaRadio = baseRuleMode && !initialData
  const availableDurations = isBaseForm
    ? DURATION_OPTIONS
    : (baseDurations && baseDurations.length > 0 ? baseDurations : DURATION_OPTIONS)

  const [name, setName] = useState(isDuplicate ? '' : (fillSource?.name ?? ''))
  const [priority, setPriority] = useState(baseRuleMode ? '0' : String(fillSource?.priority ?? 1))
  const [courtIds, setCourtIds] = useState<string[]>(baseRuleMode ? [] : (fillSource?.courtIds ?? []))
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(fillSource?.daysOfWeek ?? [1, 2, 3, 4, 5])
  const [startTime, setStartTime] = useState(fillSource?.startTime ?? '08:00')
  const [endTime, setEndTime] = useState(fillSource?.endTime ?? '23:00')
  const [priceARS, setPriceARS] = useState(fillSource?.price != null ? String(Math.round(fillSource.price / 100)) : '')
  const [intervalMinutes, setIntervalMinutes] = useState(String(fillSource?.intervalMinutes ?? 60))
  // Para reglas no-base: filtrar duraciones huérfanas (que ya no están en la base) al inicializar,
  // para evitar que queden en el estado invisible y fallen la validación del servidor.
  const [allowedDurations, setAllowedDurations] = useState<number[]>(
    fillSource?.allowedDurations
      ? fillSource.allowedDurations.filter((d) => availableDurations.includes(d))
      : availableDurations
  )
  const [isActive, setIsActive] = useState(fillSource?.isActive ?? true)
  const [onlineStartTime, setOnlineStartTime] = useState(fillSource?.onlineStartTime ?? '')
  const [onlineEndTime, setOnlineEndTime] = useState(fillSource?.onlineEndTime ?? '')
  const [vigencia, setVigencia] = useState<'immediate' | 'scheduled'>('immediate')
  const [activeFrom, setActiveFrom] = useState(
    initialData?.activeFrom && !isDuplicate ? initialData.activeFrom.toISOString().slice(0, 10) : ''
  )
  const [activeUntil, setActiveUntil] = useState(
    initialData?.activeUntil && !isDuplicate ? initialData.activeUntil.toISOString().slice(0, 10) : ''
  )

  if (!isOpen) return null

  const todayStr = new Date().toISOString().slice(0, 10)
  const activeFromIsPast = !isBaseForm && activeFrom && activeFrom < todayStr

  function toggleCourt(id: string) { setCourtIds((p) => p.includes(id) ? p.filter((c) => c !== id) : [...p, id]) }
  function toggleDay(d: number) { setDaysOfWeek((p) => p.includes(d) ? p.filter((x) => x !== d) : [...p, d]) }
  function toggleDuration(d: number) { setAllowedDurations((p) => p.includes(d) ? p.filter((x) => x !== d) : [...p, d]) }

  function handleSubmit() {
    if (!name.trim()) return setError('El nombre es obligatorio.')
    if (daysOfWeek.length === 0) return setError('Seleccioná al menos un día.')
    if (allowedDurations.length === 0) return setError('Seleccioná al menos una duración.')
    const pNum = parseInt(priority, 10)
    if (pNum === 0 && allowedDurations.length < 2) return setError('La tarifa base requiere al menos 2 duraciones.')
    if (pNum === 0 && priceARS.trim() === '') return setError('La regla base requiere un precio.')
    if (startTime >= endTime) return setError('El horario de inicio debe ser anterior al de cierre.')
    if (onlineStartTime && onlineEndTime && onlineStartTime >= onlineEndTime)
      return setError('La apertura online debe ser anterior al cierre online.')
    if (onlineStartTime && onlineStartTime < startTime)
      return setError('La apertura online no puede ser anterior a la apertura del club.')
    if (onlineEndTime && onlineEndTime > endTime)
      return setError('El cierre online no puede ser posterior al cierre del club.')
    if (!showVigenciaRadio && activeFrom && activeUntil && activeFrom > activeUntil)
      return setError('"Válida hasta" debe ser posterior a "Válida desde".')

    const resolvedActiveFrom = showVigenciaRadio
      ? (vigencia === 'immediate' ? null : (activeFrom ? new Date(`${activeFrom}T00:00:00.000Z`) : null))
      : (activeFrom ? new Date(`${activeFrom}T00:00:00.000Z`) : null)
    const resolvedActiveUntil = showVigenciaRadio ? null : (activeUntil ? new Date(`${activeUntil}T00:00:00.000Z`) : null)

    const payload: RuleInput = {
      name: name.trim(), priority: pNum, courtIds: isBaseForm ? [] : courtIds, daysOfWeek,
      startTime, endTime, price: priceARS.trim() === '' ? null : parseInt(priceARS, 10) * 100,
      intervalMinutes: parseInt(intervalMinutes, 10), allowedDurations,
      isActive: baseRuleMode && !initialData ? true : isActive,
      activeFrom: resolvedActiveFrom, activeUntil: resolvedActiveUntil,
      onlineStartTime: isBaseForm ? (onlineStartTime || null) : null,
      onlineEndTime: isBaseForm ? (onlineEndTime || null) : null,
    }
    setError(null)
    startTransition(async () => {
      const res = await onSubmit(payload)
      if (res.success) { onClose() }
      else if ('warning' in res && res.warning) { setConflictWarning({ message: res.message, payload }) }
      else { setError(res.error) }
    })
  }

  function handleConfirmConflict() {
    if (!conflictWarning) return
    const payload = conflictWarning.payload
    setConflictWarning(null)
    startTransition(async () => {
      const res = await onSubmit({ ...payload, confirmConflicts: true })
      if (res.success) { onClose() }
      else if (!('warning' in res)) { setError(res.error) }
    })
  }

  const inp = 'bg-surface border border-border rounded-[10px] px-3 py-[9px] text-[13px] text-text outline-none w-full placeholder:text-muted focus:border-accent transition-colors font-[inherit]'
  const lbl = 'text-[10px] font-bold uppercase tracking-[1.5px] text-muted mb-1.5 block'
  const title = isDuplicate ? 'Duplicar Regla' : baseRuleMode && !initialData ? 'Nueva Versión Base' : initialData ? 'Editar Regla' : 'Nueva Regla'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-bg rounded-t-3xl sm:rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="font-display text-[16px] tracking-[2.5px] text-text uppercase">{title}</h2>
            {!isBaseForm && (
              <p className="text-[10px] text-muted mt-0.5">Sobreescribe precio/duraciones online en un bloque horario</p>
            )}
          </div>
          <button type="button" onClick={onClose}
            className="size-8 rounded-xl border border-border text-muted flex items-center justify-center hover:text-text hover:border-border-hover transition-all">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-4 [scrollbar-width:thin]">

          {/* Nombre + Prioridad */}
          <div className={`grid gap-3 ${isBaseForm ? 'grid-cols-1' : 'grid-cols-3'}`}>
            <div className={isBaseForm ? '' : 'col-span-2'}>
              <label className={lbl}>Nombre</label>
              <input className={inp} value={name} onChange={(e) => setName(e.target.value)}
                placeholder={baseRuleMode ? 'Ej: Temporada Alta 2026' : 'Ej: Horario Nocturno'} />
            </div>
            {!isBaseForm && (
              <div>
                <label className={lbl}>Prioridad</label>
                <input className={inp} type="number" min={1} value={priority} onChange={(e) => setPriority(e.target.value)} />
              </div>
            )}
          </div>

          {/* Canchas — solo reglas no-base */}
          {!isBaseForm && courts.length > 0 && (
            <div>
              <label className={lbl}>Canchas</label>
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => setCourtIds([])}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-[12px] font-semibold transition-colors w-full text-left
                    ${courtIds.length === 0 ? 'bg-accent/15 border-accent/50 text-accent' : 'bg-surface border-border text-muted hover:border-border-hover'}`}>
                  <Checkbox checked={courtIds.length === 0} />
                  Todas las canchas
                </button>
                <div className="grid grid-cols-2 gap-1.5 pl-1">
                  {courts.map((c) => (
                    <button key={c.id} type="button" onClick={() => toggleCourt(c.id)}
                      className={`flex items-center gap-2 px-3 py-[7px] rounded-lg border text-[12px] transition-colors text-left
                        ${courtIds.includes(c.id) ? 'bg-accent/10 border-accent/40 text-text' : 'bg-surface border-border text-muted hover:border-border-hover'}`}>
                      <Checkbox checked={courtIds.includes(c.id)} size="sm" />
                      <span className="truncate">{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Días */}
          <div>
            <label className={lbl}>Días de la semana</label>
            <div className="flex gap-2">
              {DAY_OPTIONS.map(({ label, value }) => (
                <button key={value} type="button" onClick={() => toggleDay(value)}
                  className={`flex-1 py-[7px] rounded-lg text-[11px] font-bold border transition-colors
                    ${daysOfWeek.includes(value) ? 'bg-accent/20 border-accent/60 text-accent' : 'bg-surface border-border text-muted hover:border-border-hover'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Admin y Online ── */}
          <Seg label="Admin y Online" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>{isBaseForm ? 'Apertura del club' : 'Inicio del bloque'}</label>
              <input className={inp} type="time" step={1800} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <label className={lbl}>{isBaseForm ? 'Cierre del club' : 'Fin del bloque'}</label>
              <input className={inp} type="time" step={1800} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <div>
            <label className={lbl}>Precio por hora (ARS)</label>
            <input className={inp} type="number" min={0}
              placeholder={!isBaseForm ? 'Vacío = heredar de tarifa base' : 'Requerido'}
              value={priceARS} onChange={(e) => setPriceARS(e.target.value)} />
          </div>

          {/* ── Solo Admin ── (solo regla base) */}
          {isBaseForm && (
            <>
              <Seg label="Solo Admin" />
              <div>
                <label className={lbl}>Duraciones disponibles <span className="normal-case tracking-normal font-normal">(mín. 2)</span></label>
                <div className="flex gap-2">
                  {DURATION_OPTIONS.map((d) => (
                    <button key={d} type="button" onClick={() => toggleDuration(d)}
                      className={`flex-1 py-[7px] rounded-lg text-[11px] font-bold border transition-colors
                        ${allowedDurations.includes(d) ? 'bg-accent/20 border-accent/60 text-accent' : 'bg-surface border-border text-muted hover:border-border-hover'}`}>
                      {DURATION_LABELS[d]}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted mt-1.5">
                  El admin siempre puede elegir cualquiera de estas duraciones, independientemente del horario.
                </p>
              </div>
            </>
          )}

          {/* ── Solo Online ── */}
          <Seg label="Solo Online" />

          {!isBaseForm && (
            <div>
              <label className={lbl}>Duraciones en este bloque</label>
              {(!baseDurations || baseDurations.length === 0) ? (
                <p className="text-[11px] text-amber-400 px-3 py-2 rounded-lg bg-amber-400/8 border border-amber-400/25">
                  Primero configurá la tarifa base del club para definir las duraciones disponibles.
                </p>
              ) : (
                <>
                  <div className="flex gap-2">
                    {availableDurations.map((d) => (
                      <button key={d} type="button" onClick={() => toggleDuration(d)}
                        className={`flex-1 py-[7px] rounded-lg text-[11px] font-bold border transition-colors
                          ${allowedDurations.includes(d) ? 'bg-accent/20 border-accent/60 text-accent' : 'bg-surface border-border text-muted hover:border-border-hover'}`}>
                        {DURATION_LABELS[d] ?? `${d}min`}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted mt-1.5">
                    El jugador solo verá estas duraciones en este bloque horario.
                  </p>
                </>
              )}
            </div>
          )}

          {isBaseForm && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Apertura online</label>
                <input className={inp} type="time" step={1800} value={onlineStartTime}
                  onChange={(e) => setOnlineStartTime(e.target.value)} placeholder={startTime} />
              </div>
              <div>
                <label className={lbl}>Cierre online</label>
                <input className={inp} type="time" step={1800} value={onlineEndTime}
                  onChange={(e) => setOnlineEndTime(e.target.value)} placeholder={endTime} />
              </div>
              <p className="col-span-2 text-[10px] text-muted -mt-1">
                Vacío = mismo horario que el club. Recorta lo que ve el jugador sin afectar al admin.
              </p>
            </div>
          )}

          <div>
            <label className={lbl}>Slots cada (booking online)</label>
            <div className="flex gap-2">
              {[30, 60].map((v) => (
                <button key={v} type="button" onClick={() => setIntervalMinutes(String(v))}
                  className={`flex-1 py-[9px] rounded-[10px] text-[12px] font-bold border transition-colors
                    ${intervalMinutes === String(v) ? 'bg-accent/20 border-accent/60 text-accent' : 'bg-surface border-border text-muted hover:border-border-hover'}`}>
                  {v} min
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted mt-1.5">
              {intervalMinutes === '60' ? 'El jugador solo verá slots a la hora exacta (ej: 18:00, 19:00).' : 'El jugador verá slots cada media hora (ej: 18:00, 18:30, 19:00).'}
            </p>
          </div>

          {/* ── Vigencia ── */}
          <Seg label="Vigencia" />

          {showVigenciaRadio ? (
            <div className="flex flex-col gap-2">
              {(['immediate', 'scheduled'] as const).map((v) => (
                <label key={v} onClick={() => setVigencia(v)}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors
                    ${vigencia === v ? 'bg-accent/5 border-accent/40' : 'bg-surface border-border hover:border-border-hover'}`}>
                  <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${vigencia === v ? 'border-accent' : 'border-border'}`}>
                    {vigencia === v && <span className="w-2 h-2 rounded-full bg-accent" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-text">
                      {v === 'immediate' ? 'Activar inmediatamente' : 'Programar a partir de una fecha'}
                    </p>
                    <p className="text-[11px] text-muted mt-0.5">
                      {v === 'immediate' ? 'Reemplaza a la regla base activa al guardar.' : 'La regla entrará en vigencia en la fecha elegida.'}
                    </p>
                    {v === 'scheduled' && vigencia === 'scheduled' && (
                      <input className={`${inp} mt-2`} type="date" value={activeFrom} onChange={(e) => setActiveFrom(e.target.value)} />
                    )}
                  </div>
                </label>
              ))}
            </div>
          ) : !isBaseForm && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Válida desde</label>
                  <input className={inp} type="date" value={activeFrom} onChange={(e) => setActiveFrom(e.target.value)} />
                  {activeFromIsPast && (
                    <p className="text-[10px] text-amber-400 mt-1">Esta fecha ya pasó — la regla quedará activa con fecha retroactiva.</p>
                  )}
                </div>
                <div>
                  <label className={lbl}>Válida hasta</label>
                  <input className={inp} type="date" value={activeUntil} onChange={(e) => setActiveUntil(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-[13px] text-text font-medium">Activa</span>
                {initialData && (
                  <button type="button" role="switch" aria-checked={isActive} onClick={() => setIsActive((v) => !v)}
                    className={`relative w-10 h-6 rounded-full border transition-colors duration-200 cursor-pointer ${isActive ? 'bg-accent border-accent' : 'bg-surface border-border'}`}>
                    <span className={`absolute top-[3px] left-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${isActive ? 'translate-x-4' : ''}`} />
                  </button>
                )}
              </div>
            </>
          )}

          {error && (
            <p className="text-xs text-red-400 px-3 py-2 rounded-lg bg-red-400/8 border border-red-400/25">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border shrink-0">
          <button type="button" disabled={pending} onClick={handleSubmit}
            className="w-full py-[13px] rounded-xl bg-accent text-accent-text text-[13px] font-bold cursor-pointer hover:bg-accent-dark transition-all active:scale-[.98] disabled:opacity-40 disabled:cursor-not-allowed">
            {pending ? 'Guardando…' : isDuplicate ? 'Crear copia' : initialData ? 'Guardar cambios' : 'Crear regla'}
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
              <button type="button" onClick={() => setConflictWarning(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-[13px] font-semibold text-muted hover:text-text hover:border-border-hover transition-colors">
                Cancelar
              </button>
              <button type="button" disabled={pending} onClick={handleConfirmConflict}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-[13px] font-bold hover:bg-amber-600 transition-colors active:scale-[.98] disabled:opacity-40">
                {pending ? 'Guardando…' : 'Continuar de todos modos'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Checkbox({ checked, size = 'md' }: { checked: boolean; size?: 'md' | 'sm' }) {
  const s = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'
  return (
    <span className={`${s} rounded border flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-accent border-accent' : 'border-border'}`}>
      {checked && (
        <svg width={size === 'sm' ? 8 : 9} height={size === 'sm' ? 8 : 9} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="2 6 5 9 10 3" />
        </svg>
      )}
    </span>
  )
}
