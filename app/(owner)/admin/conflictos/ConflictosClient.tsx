'use client'

import { useState, useMemo, useTransition, useEffect } from 'react'
import { toast } from 'sonner'
import type { ConflictBooking, CancelledBooking } from '@/features/reservas/dal/conflicts'
import { cancelBooking, updateBooking } from '@/features/reservas/actions/bookings'
import { fetchSlotsForRelocAction } from '@/features/reservas/actions/conflicts'

const CONFLICT_META: Record<ConflictBooking['conflictType'], { label: string; cls: string }> = {
  MAINTENANCE: { label: 'Mantenimiento',    cls: 'bg-orange-500/10 border-orange-500/30 text-orange-500' },
  ARCHIVED:    { label: 'Cancha eliminada', cls: 'bg-red-500/10 border-red-500/30 text-red-500' },
}

function tmToMin(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + (m ?? 0) }
function minToTm(m: number) { return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }
function fmtDate(d: string) { const [, mo, dy] = d.split('-'); return `${dy}/${mo}` }

interface Props {
  conflicts: ConflictBooking[]
  cancellations: CancelledBooking[]
  courts: Array<{ id: string; name: string }>
}

export default function ConflictosClient({ conflicts: initial, cancellations, courts }: Props) {
  const [items, setItems] = useState(initial)
  const [tab, setTab] = useState<'conflicts' | 'cancellations'>('conflicts')
  const [fCourt, setFCourt] = useState('')
  const [fType, setFType] = useState('')
  const [fDate, setFDate] = useState('')
  const [selected, setSelected] = useState<ConflictBooking | null>(null)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [, startT] = useTransition()

  // Reloc wizard
  const [reloc, setReloc] = useState(false)
  const [rDate, setRDate] = useState('')
  const [rCourt, setRCourt] = useState('')
  const [rOccupied, setROccupied] = useState<Array<{ startTime: string; durationMinutes: number }> | null>(null)
  const [rLoading, setRLoading] = useState(false)
  const [rTime, setRTime] = useState<string | null>(null)
  const [rConfirming, setRConfirming] = useState(false)

  const courtOptions = useMemo(() => Array.from(new Set(items.map(c => c.courtName))).sort(), [items])
  const filtered = useMemo(
    () => items.filter(c =>
      (!fCourt || c.courtName === fCourt) &&
      (!fType || c.conflictType === fType) &&
      (!fDate || c.dateStr === fDate)
    ),
    [items, fCourt, fType, fDate]
  )

  useEffect(() => {
    if (!reloc || !rDate || !rCourt) return
    setROccupied(null); setRTime(null); setRLoading(true)
    fetchSlotsForRelocAction(rCourt, rDate).then(res => {
      setRLoading(false)
      if (res.success && res.data) setROccupied(res.data.occupied)
    })
  }, [reloc, rDate, rCourt])

  const availableSlots = useMemo(() => {
    if (!selected || !rOccupied) return []
    const dur = selected.durationMinutes
    const slots: string[] = []
    for (let s = 8 * 60; s + dur <= 23 * 60; s += 30) {
      const end = s + dur
      const blocked = rOccupied.some(b => {
        const bs = tmToMin(b.startTime)
        return bs < end && bs + b.durationMinutes > s
      })
      if (!blocked) slots.push(minToTm(s))
    }
    return slots
  }, [selected, rOccupied])

  function selectConflict(c: ConflictBooking) {
    setSelected(c); setReloc(false); setROccupied(null); setRTime(null)
  }

  function handleCancel(id: string) {
    setCancelId(id)
    startT(async () => {
      const res = await cancelBooking(id)
      setCancelId(null)
      if (res.success) {
        setItems(p => p.filter(c => c.id !== id))
        if (selected?.id === id) setSelected(null)
        toast.success('Reserva cancelada', { position: 'bottom-right' })
      } else {
        toast.error(res.error, { position: 'bottom-right' })
      }
    })
  }

  async function handleRelocConfirm() {
    if (!selected || !rTime) return
    setRConfirming(true)
    const res = await updateBooking(selected.id, {
      date: rDate,
      startTime: rTime,
      durationMinutes: selected.durationMinutes,
      courtId: rCourt,
    })
    setRConfirming(false)
    if (res.success) {
      setItems(p => p.filter(c => c.id !== selected.id))
      setSelected(null); setReloc(false)
      toast.success('Reserva reubicada', { position: 'bottom-right' })
    } else {
      toast.error(res.error ?? 'Error al reubicar', { position: 'bottom-right' })
    }
  }

  const tabCls = (t: 'conflicts' | 'cancellations') =>
    `px-4 py-2.5 text-[11px] font-bold uppercase tracking-[1.5px] border-b-2 transition-colors cursor-pointer ${
      tab === t ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-text'
    }`

  return (
    <div className="grid md:grid-cols-3 rounded-2xl border border-border bg-surface overflow-hidden" style={{ minHeight: 580 }}>

      {/* ── LEFT: Master ───────────────────────────────────────── */}
      <div className="border-b md:border-b-0 md:border-r border-border flex flex-col">
        {/* Tabs */}
        <div className="flex border-b border-border px-2 shrink-0">
          <button type="button" className={tabCls('conflicts')} onClick={() => setTab('conflicts')}>
            Conflictos ({items.length})
          </button>
          <button type="button" className={tabCls('cancellations')} onClick={() => setTab('cancellations')}>
            Canceladas
          </button>
        </div>

        {/* Filters */}
        {tab === 'conflicts' && (
          <div className="flex flex-col gap-1.5 px-3 py-2.5 border-b border-border bg-bg/40 shrink-0">
            <select value={fCourt} onChange={e => setFCourt(e.target.value)}
              className="text-[11px] bg-card border border-border rounded-lg px-2 py-1.5 text-text focus:outline-none focus:border-accent w-full">
              <option value="">Todas las canchas</option>
              {courtOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={fType} onChange={e => setFType(e.target.value)}
              className="text-[11px] bg-card border border-border rounded-lg px-2 py-1.5 text-text focus:outline-none focus:border-accent w-full">
              <option value="">Todos los tipos</option>
              <option value="MAINTENANCE">Mantenimiento</option>
              <option value="ARCHIVED">Cancha eliminada</option>
            </select>
            <div className="flex items-center gap-1.5">
              <input type="date" value={fDate} onChange={e => setFDate(e.target.value)}
                className="flex-1 text-[11px] bg-card border border-border rounded-lg px-2 py-1.5 text-text focus:outline-none focus:border-accent" />
              {(fCourt || fType || fDate) && (
                <button type="button" onClick={() => { setFCourt(''); setFType(''); setFDate('') }}
                  className="text-[10px] text-muted hover:text-text px-2 py-1.5 transition-colors cursor-pointer whitespace-nowrap">
                  Limpiar
                </button>
              )}
            </div>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto [scrollbar-width:thin]">
          {tab === 'conflicts' && (
            filtered.length === 0 ? (
              <p className="text-[12px] text-muted/60 text-center py-10 px-4">
                {items.length === 0 ? 'Sin conflictos activos. Todo en orden.' : 'Sin resultados.'}
              </p>
            ) : (
              filtered.map(c => {
                const meta = CONFLICT_META[c.conflictType]
                const isSel = selected?.id === c.id
                return (
                  <button key={c.id} type="button" onClick={() => selectConflict(c)}
                    className={`w-full text-left px-4 py-3 border-b border-border/50 transition-colors cursor-pointer border-l-2
                      ${isSel ? 'bg-accent/8 border-l-accent' : 'hover:bg-bg/60 border-l-transparent'}`}>
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-[12px] font-semibold text-text truncate">{c.playerName}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${meta.cls}`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted font-mono">{c.courtName} · {fmtDate(c.dateStr)} · {c.startTime}</p>
                  </button>
                )
              })
            )
          )}
          {tab === 'cancellations' && (
            cancellations.length === 0 ? (
              <p className="text-[12px] text-muted/60 text-center py-10 px-4">Sin cancelaciones recientes.</p>
            ) : (
              cancellations.map(c => {
                const endStr = minToTm(tmToMin(c.startTime) + c.durationMinutes)
                return (
                  <div key={c.id} className="px-4 py-3 border-b border-border/50 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-text truncate">{c.playerName}</p>
                      <p className="text-[11px] text-muted">{c.courtName} · {fmtDate(c.dateStr)} · {c.startTime}–{endStr}</p>
                    </div>
                    <span className="text-[10px] text-muted/60 shrink-0">
                      {c.cancelledAt.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>
                )
              })
            )
          )}
        </div>
      </div>

      {/* ── RIGHT: Detail ──────────────────────────────────────── */}
      <div className="md:col-span-2 flex flex-col">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8 py-12">
            <div className="w-12 h-12 rounded-2xl border border-border flex items-center justify-center text-muted/40">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p className="text-[13px] font-semibold text-text">Seleccioná un conflicto</p>
            <p className="text-[12px] text-muted max-w-xs">Hacé clic en un ítem de la lista para ver los detalles y opciones de resolución.</p>
          </div>
        ) : (() => {
          const meta = CONFLICT_META[selected.conflictType]
          const endStr = minToTm(tmToMin(selected.startTime) + selected.durationMinutes)
          return (
            <div className="flex-1 overflow-y-auto px-6 py-6 [scrollbar-width:thin]">
              {/* Header */}
              <div className="mb-6">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-[18px] font-bold text-text">{selected.playerName}</p>
                    <p className="text-[12px] text-muted mt-0.5">{selected.courtName}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${meta.cls}`}>
                    {meta.label}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted font-mono">
                  <span>{fmtDate(selected.dateStr)}</span>
                  <span className="w-px h-3 bg-border" />
                  <span>{selected.startTime} – {endStr}</span>
                  <span className="w-px h-3 bg-border" />
                  <span>{selected.durationMinutes} min</span>
                  <span className="w-px h-3 bg-border" />
                  <span className={selected.status === 'CONFIRMED' ? 'text-green-500' : 'text-amber-500'}>
                    {selected.status === 'CONFIRMED' ? 'Confirmada' : 'Pendiente'}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              {!reloc && (
                <div className="flex gap-3 mb-6">
                  <button type="button" disabled={!!cancelId} onClick={() => handleCancel(selected.id)}
                    className="flex-1 py-2.5 rounded-xl border border-red-400/30 text-red-400 text-[12px] font-bold
                               hover:bg-red-400/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                    {cancelId === selected.id ? 'Cancelando…' : 'Cancelar Turno'}
                  </button>
                  <button type="button"
                    onClick={() => { setReloc(true); setRDate(selected.dateStr); setRCourt(selected.courtId) }}
                    className="flex-1 py-2.5 rounded-xl border border-accent/30 text-accent text-[12px] font-bold
                               hover:bg-accent/10 transition-colors cursor-pointer">
                    Reubicar
                  </button>
                </div>
              )}

              {/* Reloc wizard */}
              {reloc && (
                <div className="rounded-xl border border-border bg-bg/60 p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-text uppercase tracking-wider">Reubicar turno</p>
                    <button type="button" onClick={() => setReloc(false)}
                      className="text-[10px] text-muted hover:text-text transition-colors cursor-pointer">
                      Cancelar
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Fecha</label>
                      <input type="date" value={rDate} onChange={e => setRDate(e.target.value)}
                        className="w-full text-[12px] bg-card border border-border rounded-lg px-3 py-2 text-text focus:outline-none focus:border-accent" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Cancha</label>
                      <select value={rCourt} onChange={e => setRCourt(e.target.value)}
                        className="w-full text-[12px] bg-card border border-border rounded-lg px-3 py-2 text-text focus:outline-none focus:border-accent">
                        {courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-muted uppercase tracking-wider mb-2 block">
                      Horarios disponibles ({selected.durationMinutes} min)
                    </label>
                    {rLoading ? (
                      <p className="text-[11px] text-muted py-2">Cargando disponibilidad…</p>
                    ) : rOccupied === null ? (
                      <p className="text-[11px] text-muted/50 py-2">Seleccioná fecha y cancha para ver horarios.</p>
                    ) : availableSlots.length === 0 ? (
                      <p className="text-[11px] text-amber-400 py-2">Sin horarios disponibles para esta fecha y cancha.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {availableSlots.map(slot => (
                          <button key={slot} type="button" onClick={() => setRTime(slot)}
                            className={`text-[11px] font-mono font-semibold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer
                              ${rTime === slot
                                ? 'bg-accent text-bg border-accent'
                                : 'border-border text-muted hover:border-accent/50 hover:text-text'
                              }`}>
                            {slot}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button type="button" disabled={!rTime || rConfirming} onClick={handleRelocConfirm}
                    className="w-full py-2.5 rounded-xl bg-accent text-bg text-[12px] font-bold
                               hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                    {rConfirming ? 'Reubicando…' : rTime ? `Confirmar → ${rTime}` : 'Seleccioná un horario'}
                  </button>
                </div>
              )}
            </div>
          )
        })()}
      </div>
    </div>
  )
}
