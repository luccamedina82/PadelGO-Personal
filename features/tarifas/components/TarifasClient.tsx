'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { formatPrice } from '@/lib/availability'
import type { BookingRuleRow } from '@/features/tarifas/dal/rules'
import type { ActionResult } from '@/types'
import type { RuleInput } from '@/features/tarifas/actions/rules'
import RuleFormModal from './RuleFormModal'

const DAY_LABELS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá']

interface Court { id: string; name: string }

interface Props {
  clubId: string
  courts: Court[]
  rules: BookingRuleRow[]
  createRuleAction: (data: RuleInput) => Promise<ActionResult<{ id: string }>>
  updateRuleAction: (id: string, data: Partial<RuleInput>) => Promise<ActionResult>
  deleteRuleAction: (id: string) => Promise<ActionResult>
  toggleRuleStatusAction: (id: string, isActive: boolean) => Promise<ActionResult>
}

export default function TarifasClient({
  courts,
  rules: initialRules,
  createRuleAction,
  updateRuleAction,
  toggleRuleStatusAction,
  deleteRuleAction,
}: Props) {
  const [rules, setRules] = useState(initialRules)
  const [pending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<BookingRuleRow | null>(null)

  // ── Derived sections ──────────────────────────────────────────────────────
  const baseRule = rules.find((r) => r.priority === 0 && r.courtIds.length === 0) ?? null
  const generalRules = rules.filter((r) => r.courtIds.length === 0 && r.priority > 0).sort((a, b) => b.priority - a.priority)
  const courtRules = rules.filter((r) => r.courtIds.length > 0).sort((a, b) => b.priority - a.priority)

  function openCreate() { setEditingRule(null); setModalOpen(true) }
  function openEdit(rule: BookingRuleRow) { setEditingRule(rule); setModalOpen(true) }

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

  async function handleFormSubmit(data: RuleInput) {
    if (editingRule) {
      const res = await updateRuleAction(editingRule.id, data)
      if (res.success) {
        setRules((prev) =>
          prev.map((r) =>
            r.id === editingRule.id
              ? { ...r, ...data, courtIds: data.courtIds ?? [] }
              : r
          )
        )
        toast.success('Regla actualizada', { position: 'bottom-right' })
      } else {
        toast.error(res.error, { position: 'bottom-right' })
      }
      return res
    } else {
      const res = await createRuleAction(data)
      if (res.success) {
        const newRule: BookingRuleRow = {
          id: res.data?.id ?? crypto.randomUUID(),
          ...data,
          courtIds: data.courtIds ?? [],
          createdAt: new Date(),
        }
        setRules((prev) => [...prev, newRule].sort((a, b) => b.priority - a.priority))
        toast.success('Regla creada', { position: 'bottom-right' })
      } else {
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
            <SectionTitle label="Tarifa Base del Club" />
            {baseRule ? (
              <BaseRuleCard rule={baseRule} onEdit={openEdit} disabled={pending} />
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
                No hay tarifa base. Creá una con prioridad 0 directamente desde la base de datos.
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
                  <RuleCard key={r.id} rule={r} courts={courts} onToggle={handleToggle} onDelete={handleDelete} onEdit={openEdit} disabled={pending} />
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
                  <RuleCard key={r.id} rule={r} courts={courts} onToggle={handleToggle} onDelete={handleDelete} onEdit={openEdit} disabled={pending} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <RuleFormModal
        key={modalOpen ? (editingRule?.id ?? 'new') : 'closed'}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleFormSubmit}
        initialData={editingRule}
        courts={courts}
      />
    </>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionTitle({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-muted whitespace-nowrap">{label}</p>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

function BaseRuleCard({
  rule, onEdit, disabled,
}: {
  rule: BookingRuleRow
  onEdit: (rule: BookingRuleRow) => void
  disabled: boolean
}) {
  return (
    <div className="rounded-2xl border-2 border-accent/40 bg-accent/5">
      <div className="px-5 py-4 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-accent shrink-0">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <span className="text-[13px] font-bold text-text truncate">{rule.name}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/15 border border-accent/40 text-accent font-bold">
              Regla Base
            </span>
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
            <span>Slots cada {rule.intervalMinutes} min</span>
            <span className="w-px h-3 bg-border" />
            <span>{rule.allowedDurations.map((d) => `${d}min`).join(', ')}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onEdit(rule)}
            className="size-8 flex items-center justify-center rounded-lg border border-accent/30
                       text-accent/70 hover:text-accent hover:border-accent/60
                       transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Editar regla base"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-green-500/15 border border-green-500/30 text-green-500">
            Siempre Activa
          </span>
          <div className="size-8 flex items-center justify-center rounded-lg border border-border/40 text-muted/30" title="No se puede eliminar la regla base">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}

function RuleCard({
  rule, courts, onToggle, onDelete, onEdit, disabled,
}: {
  rule: BookingRuleRow
  courts: Court[]
  onToggle: (id: string, current: boolean) => void
  onDelete: (id: string) => void
  onEdit: (rule: BookingRuleRow) => void
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
            <span>Slots cada {rule.intervalMinutes} min</span>
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
