'use client'

import { useState, useTransition, useEffect } from 'react'
import { toast } from 'sonner'
import { formatPrice } from '@/lib/availability'
import type { BookingRuleRow } from '@/features/tarifas/dal/rules'
import type { ActionResult } from '@/types'
import type { RuleInput, RuleActionResult } from '@/features/tarifas/actions/rules'
import RuleFormModal from './RuleFormModal'

const DAY_LABELS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá']

interface Court { id: string; name: string }

interface Props {
  clubId: string
  courts: Court[]
  rules: BookingRuleRow[]
  createRuleAction: (data: RuleInput) => Promise<RuleActionResult<{ id: string }>>
  updateRuleAction: (id: string, data: Partial<RuleInput>) => Promise<ActionResult>
  deleteRuleAction: (id: string) => Promise<ActionResult>
  toggleRuleStatusAction: (id: string, isActive: boolean) => Promise<ActionResult>
  activateRuleNowAction: (id: string) => Promise<ActionResult>
}

interface ActivationConfirm { id: string; name: string; timeRange: string }

export default function TarifasClient({
  courts,
  rules: initialRules,
  createRuleAction,
  updateRuleAction,
  toggleRuleStatusAction,
  deleteRuleAction,
  activateRuleNowAction,
}: Props) {
  const [rules, setRules] = useState(initialRules)
  const [pending, startTransition] = useTransition()

  // Sync with fresh server data after revalidatePath triggers a Server Component re-render
  useEffect(() => {
    setRules(initialRules)
  }, [initialRules])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<BookingRuleRow | null>(null)
  const [isDuplicate, setIsDuplicate] = useState(false)
  const [isBaseRuleMode, setIsBaseRuleMode] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [activationConfirm, setActivationConfirm] = useState<ActivationConfirm | null>(null)

  // ── Derived sections ──────────────────────────────────────────────────────
  const now = new Date()
  const baseRules = rules
    .filter((r) => r.priority === 0 && r.courtIds.length === 0)
    .sort((a, b) => {
      const aFrom = a.activeFrom?.getTime() ?? 0
      const bFrom = b.activeFrom?.getTime() ?? 0
      return bFrom - aFrom // newest first
    })

  const activeBaseRule = baseRules.find((r) => {
    if (!r.isActive) return false
    const fromOk = !r.activeFrom || r.activeFrom <= now
    const untilOk = !r.activeUntil || r.activeUntil >= now
    return fromOk && untilOk
  }) ?? null

  const scheduledBaseRules = baseRules.filter((r) => {
    if (r === activeBaseRule) return false
    return !(r.activeUntil && r.activeUntil < now)
  })

  const historyBaseRules = baseRules.filter((r) => r.activeUntil && r.activeUntil < now)
  const historyToShow = showHistory ? historyBaseRules : historyBaseRules.slice(0, 3)

  const generalRules = rules.filter((r) => r.courtIds.length === 0 && r.priority > 0).sort((a, b) => b.priority - a.priority)
  const courtRules = rules.filter((r) => r.courtIds.length > 0).sort((a, b) => b.priority - a.priority)

  // ── Modal openers ──────────────────────────────────────────────────────────
  function openCreate() { setEditingRule(null); setIsDuplicate(false); setIsBaseRuleMode(false); setModalOpen(true) }
  function openCreateBase() { setEditingRule(null); setIsDuplicate(false); setIsBaseRuleMode(true); setModalOpen(true) }
  function openEdit(rule: BookingRuleRow) { setEditingRule(rule); setIsDuplicate(false); setIsBaseRuleMode(false); setModalOpen(true) }
  function openDuplicate(rule: BookingRuleRow) { setEditingRule(rule); setIsDuplicate(true); setIsBaseRuleMode(false); setModalOpen(true) }

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleToggle(id: string, current: boolean) {
    const next = !current
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, isActive: next } : r)))
    startTransition(async () => {
      const res = await toggleRuleStatusAction(id, next)
      if (!res.success) {
        setRules((prev) => prev.map((r) => (r.id === id ? { ...r, isActive: current } : r)))
        toast.error(res.error, { position: 'bottom-right' })
      }
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await deleteRuleAction(id)
      if (res.success) {
        setRules((prev) => prev.filter((r) => r.id !== id))
        toast.success('Regla eliminada', { position: 'bottom-right' })
      } else {
        toast.error(res.error, { position: 'bottom-right' })
      }
    })
  }

  function handleActivateNow(rule: BookingRuleRow) {
    setActivationConfirm({ id: rule.id, name: rule.name, timeRange: `${rule.startTime}–${rule.endTime}` })
  }

  function confirmActivation() {
    if (!activationConfirm) return
    const { id } = activationConfirm
    setActivationConfirm(null)

    // Normalized UTC dates matching what the server will write
    const todayUtc = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z')
    const yesterdayEnd = new Date(todayUtc.getTime() - 1)

    // Optimistic update — runs immediately before the network call
    const snapshot = rules
    setRules((prev) => prev.map((r) => {
      if (r.id === id) return { ...r, activeFrom: todayUtc, activeUntil: null, isActive: true }
      if (r.priority === 0 && r.courtIds.length === 0 && r.id !== id) {
        const fromOk = !r.activeFrom || r.activeFrom <= todayUtc
        const untilOk = !r.activeUntil || r.activeUntil >= todayUtc
        if (fromOk && untilOk) return { ...r, activeUntil: yesterdayEnd }
      }
      return r
    }))

    startTransition(async () => {
      const res = await activateRuleNowAction(id)
      if (res.success) {
        toast.success('Regla activada', { position: 'bottom-right' })
      } else {
        setRules(snapshot) // rollback
        toast.error(res.error, { position: 'bottom-right' })
      }
    })
  }

  async function handleFormSubmit(data: RuleInput): Promise<RuleActionResult<{ id: string }>> {
    if (editingRule && !isDuplicate) {
      // Update
      const res = await updateRuleAction(editingRule.id, data)
      if (res.success) {
        setRules((prev) =>
          prev.map((r) => r.id === editingRule.id ? { ...r, ...data, courtIds: data.courtIds ?? [] } : r)
        )
        toast.success('Regla actualizada', { position: 'bottom-right' })
      } else {
        toast.error(res.error, { position: 'bottom-right' })
      }
      return res as RuleActionResult<{ id: string }>
    } else {
      // Create (also covers duplicate)
      const res = await createRuleAction(data)
      if (res.success) {
        const isImmediateBase = data.priority === 0 && data.courtIds.length === 0 && !data.activeFrom
        // Use normalized UTC midnight dates to match exactly what the server stores
        const todayUtc = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z')
        const yesterdayEnd = new Date(todayUtc.getTime() - 1)

        const newRule: BookingRuleRow = {
          id: res.data?.id ?? crypto.randomUUID(),
          ...data,
          isActive: true,
          activeFrom: isImmediateBase ? todayUtc : data.activeFrom,
          activeUntil: isImmediateBase ? null : data.activeUntil,
          courtIds: data.courtIds ?? [],
          createdAt: todayUtc,
        }
        let updated = rules
        if (isImmediateBase) {
          updated = rules.map((r) => {
            if (r.priority === 0 && r.courtIds.length === 0 && r.isActive) {
              const fromOk = !r.activeFrom || r.activeFrom <= todayUtc
              const untilOk = !r.activeUntil || r.activeUntil >= todayUtc
              if (fromOk && untilOk) return { ...r, activeUntil: yesterdayEnd }
            }
            return r
          })
        }
        setRules([...updated, newRule].sort((a, b) => b.priority - a.priority))
        toast.success(isDuplicate ? 'Regla duplicada' : 'Regla creada', { position: 'bottom-right' })
      } else if (!('warning' in res)) {
        toast.error(res.error, { position: 'bottom-right' })
      }
      return res
    }
  }

  return (
    <>
      <div className="min-h-screen bg-bg">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-surface border-b border-border">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="font-display text-[18px] tracking-[3px] text-text uppercase">Tarifas y Reglas</h1>
              <p className="text-[11px] text-muted mt-0.5">
                {rules.length} regla{rules.length !== 1 ? 's' : ''} configurada{rules.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-accent-text
                         text-[13px] font-bold cursor-pointer hover:bg-accent-dark transition-all active:scale-[.98]"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Nueva Regla
            </button>
          </div>
        </div>

        <div className="px-6 py-6 max-w-3xl mx-auto flex flex-col gap-8">

          {/* ── SECCIÓN 1: Tarifa Base ──────────────────────────────── */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-muted whitespace-nowrap">Tarifa Base del Club</p>
              <div className="flex-1 h-px bg-border" />
              <button
                type="button"
                onClick={openCreateBase}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[11px] font-semibold text-muted hover:border-border-hover hover:text-text transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Nueva versión
              </button>
            </div>

            {baseRules.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
                No hay tarifa base configurada.
              </div>
            ) : (
              <div className="flex flex-col gap-3">

                {/* ACTIVA AHORA */}
                {activeBaseRule && (
                  <BaseRuleCard rule={activeBaseRule} status="active" onEdit={openEdit} onDuplicate={openDuplicate} disabled={pending} />
                )}

                {/* PROGRAMADAS / BORRADORES */}
                {scheduledBaseRules.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-[9px] font-bold uppercase tracking-[1.5px] text-muted/60 px-1 mt-1">
                      Programadas / Borradores
                    </p>
                    {scheduledBaseRules.map((r) => (
                      <BaseRuleCard
                        key={r.id}
                        rule={r}
                        status="scheduled"
                        onEdit={openEdit}
                        onDuplicate={openDuplicate}
                        onActivateNow={handleActivateNow}
                        disabled={pending}
                      />
                    ))}
                  </div>
                )}

                {/* HISTORIAL */}
                {historyBaseRules.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-[9px] font-bold uppercase tracking-[1.5px] text-muted/60 px-1 mt-1">
                      Historial
                    </p>
                    {historyToShow.map((r) => (
                      <BaseRuleCard key={r.id} rule={r} status="history" onEdit={openEdit} onDuplicate={openDuplicate} disabled={pending} />
                    ))}
                    {historyBaseRules.length > 3 && (
                      <button
                        type="button"
                        onClick={() => setShowHistory((v) => !v)}
                        className="text-[11px] font-semibold text-muted hover:text-text transition-colors py-1 text-left px-1"
                      >
                        {showHistory ? '↑ Ocultar historial' : `↓ Ver historial completo (${historyBaseRules.length - 3} más)`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── SECCIÓN 2: Reglas Generales ─────────────────────────── */}
          <section>
            <SectionTitle label="Reglas Generales del Club" />
            {generalRules.length === 0 ? (
              <p className="text-sm text-muted/60 text-center py-4">Sin reglas generales.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {generalRules.map((r) => (
                  <RuleCard key={r.id} rule={r} courts={courts} onToggle={handleToggle} onDelete={handleDelete} onEdit={openEdit} onDuplicate={openDuplicate} disabled={pending} />
                ))}
              </div>
            )}
          </section>

          {/* ── SECCIÓN 3: Reglas por Cancha ────────────────────────── */}
          <section>
            <SectionTitle label="Reglas Específicas por Cancha" />
            {courtRules.length === 0 ? (
              <p className="text-sm text-muted/60 text-center py-4">Sin reglas por cancha.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {courtRules.map((r) => (
                  <RuleCard key={r.id} rule={r} courts={courts} onToggle={handleToggle} onDelete={handleDelete} onEdit={openEdit} onDuplicate={openDuplicate} disabled={pending} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Activation confirmation modal */}
      {activationConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setActivationConfirm(null)} />
          <div className="relative w-full max-w-sm bg-bg rounded-2xl border border-border shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-amber-400">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <p className="text-[13px] font-bold text-text mb-1">Activar "{activationConfirm.name}"</p>
                <p className="text-[12px] text-muted leading-relaxed">
                  Esta regla reemplazará a la activa actualmente. Los turnos fuera del horario{' '}
                  <span className="font-semibold text-text">{activationConfirm.timeRange}</span>{' '}
                  deberán gestionarse manualmente en el Centro de Resolución.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActivationConfirm(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-[13px] font-semibold text-muted hover:text-text hover:border-border-hover transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={confirmActivation}
                className="flex-1 py-2.5 rounded-xl bg-accent text-accent-text text-[13px] font-bold hover:bg-accent-dark transition-all active:scale-[.98] disabled:opacity-40"
              >
                {pending ? 'Activando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <RuleFormModal
        key={modalOpen ? (isDuplicate ? `dup-${editingRule?.id}` : (editingRule?.id ?? (isBaseRuleMode ? 'new-base' : 'new'))) : 'closed'}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleFormSubmit}
        initialData={editingRule}
        courts={courts}
        isDuplicate={isDuplicate}
        baseRuleMode={isBaseRuleMode}
        activeBaseRule={activeBaseRule}
      />
    </>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function SectionTitle({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-muted whitespace-nowrap">{label}</p>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

// ── BaseRuleCard ────────────────────────────────────────────────────────────

type BaseRuleStatus = 'active' | 'scheduled' | 'history'

function BaseRuleCard({
  rule, status, onEdit, onDuplicate, onActivateNow, disabled,
}: {
  rule: BookingRuleRow
  status: BaseRuleStatus
  onEdit: (rule: BookingRuleRow) => void
  onDuplicate: (rule: BookingRuleRow) => void
  onActivateNow?: (rule: BookingRuleRow) => void
  disabled: boolean
}) {
  const borderCls =
    status === 'active'
      ? 'border-2 border-accent/40 bg-accent/5'
      : status === 'scheduled'
      ? 'border border-border bg-card'
      : 'border border-border/40 bg-card opacity-60'

  return (
    <div className={`rounded-2xl ${borderCls}`}>
      <div className="px-5 py-4 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {status === 'active' && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-accent shrink-0">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            )}
            <span className="text-[13px] font-bold text-text truncate">{rule.name}</span>
            {status === 'active' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 border border-green-500/30 text-green-500 font-bold">
                ACTIVA AHORA
              </span>
            )}
            {status === 'scheduled' && rule.activeFrom && rule.activeFrom > new Date() && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 font-semibold">
                Desde {fmtDate(rule.activeFrom)}
              </span>
            )}
            {status === 'scheduled' && (!rule.activeFrom || rule.activeFrom <= new Date()) && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface border border-border text-muted font-semibold">
                Borrador
              </span>
            )}
            {status === 'history' && rule.activeUntil && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface border border-border text-muted font-semibold">
                Hasta {fmtDate(rule.activeUntil)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[12px] font-mono text-text">{rule.startTime} – {rule.endTime}</span>
            <div className="flex gap-1">
              {DAY_LABELS.map((label, i) => (
                <span key={i} className={`text-[10px] font-bold w-5 h-5 rounded flex items-center justify-center
                  ${rule.daysOfWeek.includes(i) ? 'bg-accent/20 text-accent' : 'bg-surface text-muted/40'}`}>
                  {label}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted">
            <span className="font-semibold text-text">{rule.price !== null ? formatPrice(rule.price) + '/hr' : '—'}</span>
            <span className="w-px h-3 bg-border" />
            <span>Slots c/{rule.intervalMinutes} min</span>
            <span className="w-px h-3 bg-border" />
            <span>{rule.allowedDurations.map((d) => `${d}min`).join(', ')}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {status === 'scheduled' && onActivateNow && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onActivateNow(rule)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-accent-text text-[11px] font-bold
                         hover:bg-accent-dark transition-all active:scale-[.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Activar Ahora
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => onDuplicate(rule)}
            className="size-8 flex items-center justify-center rounded-lg border border-border text-muted hover:text-text hover:border-border-hover transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Duplicar regla"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onEdit(rule)}
            className={`size-8 flex items-center justify-center rounded-lg border transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40
                        ${status === 'active'
                          ? 'border-accent/30 text-accent/70 hover:text-accent hover:border-accent/60'
                          : 'border-border text-muted hover:text-text hover:border-border-hover'}`}
            aria-label="Editar regla"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <div className="size-8 flex items-center justify-center rounded-lg border border-border/40 text-muted/30" title="La regla base no se puede eliminar">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── RuleCard ────────────────────────────────────────────────────────────────

function RuleCard({
  rule, courts, onToggle, onDelete, onEdit, onDuplicate, disabled,
}: {
  rule: BookingRuleRow
  courts: Court[]
  onToggle: (id: string, current: boolean) => void
  onDelete: (id: string) => void
  onEdit: (rule: BookingRuleRow) => void
  onDuplicate: (rule: BookingRuleRow) => void
  disabled: boolean
}) {
  const courtNames = rule.courtIds.map((id) => courts.find((c) => c.id === id)?.name ?? id)

  return (
    <div className={`rounded-2xl border bg-card transition-opacity ${rule.isActive ? 'border-border' : 'border-border/40 opacity-60'}`}>
      <div className="px-5 py-4 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-bold text-text truncate">{rule.name}</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface border border-border text-muted">P{rule.priority}</span>
            {(rule.activeFrom || rule.activeUntil) && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 font-semibold">
                {rule.activeFrom ? `Del ${fmtDate(rule.activeFrom)}` : 'Hasta'}{rule.activeUntil ? ` al ${fmtDate(rule.activeUntil)}` : ' en adelante'}
              </span>
            )}
            {courtNames.length === 0 ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface border border-border text-muted">Todas las canchas</span>
            ) : courtNames.length <= 2 ? (
              courtNames.map((name) => (
                <span key={name} className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 border border-accent/30 text-accent">{name}</span>
              ))
            ) : (
              <>
                {courtNames.slice(0, 2).map((name) => (
                  <span key={name} className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 border border-accent/30 text-accent">{name}</span>
                ))}
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface border border-border text-muted">+{courtNames.length - 2}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[12px] font-mono text-text">{rule.startTime} – {rule.endTime}</span>
            <div className="flex gap-1">
              {DAY_LABELS.map((label, i) => (
                <span key={i} className={`text-[10px] font-bold w-5 h-5 rounded flex items-center justify-center
                  ${rule.daysOfWeek.includes(i) ? 'bg-accent/20 text-accent' : 'bg-surface text-muted/40'}`}>
                  {label}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted">
            <span>{rule.price !== null ? formatPrice(rule.price) + '/hr' : 'Precio heredado'}</span>
            <span className="w-px h-3 bg-border" />
            <span>Slots c/{rule.intervalMinutes} min</span>
            <span className="w-px h-3 bg-border" />
            <span>{rule.allowedDurations.map((d) => `${d}min`).join(', ')}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button" disabled={disabled} onClick={() => onEdit(rule)}
            className="size-8 flex items-center justify-center rounded-lg border border-border text-muted hover:text-text hover:border-border-hover transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Editar regla"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            type="button" disabled={disabled} onClick={() => onDuplicate(rule)}
            className="size-8 flex items-center justify-center rounded-lg border border-border text-muted hover:text-text hover:border-border-hover transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Duplicar regla"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
          <button
            type="button" role="switch" aria-checked={rule.isActive} disabled={disabled}
            onClick={() => onToggle(rule.id, rule.isActive)}
            className={`relative w-10 h-6 rounded-full border transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed ${rule.isActive ? 'bg-accent border-accent' : 'bg-surface border-border'}`}
          >
            <span className={`absolute top-[3px] left-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${rule.isActive ? 'translate-x-4' : ''}`} />
          </button>
          <button
            type="button" disabled={disabled} onClick={() => onDelete(rule.id)}
            className="size-8 flex items-center justify-center rounded-lg border border-border text-muted hover:text-red-400 hover:border-red-400/40 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Eliminar regla"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
