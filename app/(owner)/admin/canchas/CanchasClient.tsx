'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { ActionResult } from '@/types'

type CourtType = 'CRISTAL' | 'MURO' | 'PANORAMICA'

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
  type: CourtType
  covered: boolean
  isActive: boolean
  availabilities: Availability[]
}

interface Props {
  clubId: string
  clubName: string
  courts: Court[]
  createCourtAction: (input: {
    clubId: string; name: string; type: CourtType; covered: boolean
    svgX: number; svgY: number; svgW: number; svgH: number
  }) => Promise<ActionResult<{ courtId: string }>>
  updateCourtAction: (courtId: string, clubId: string, data: { name?: string; type?: CourtType; covered?: boolean }) => Promise<ActionResult>
  toggleCourtAction: (courtId: string, clubId: string) => Promise<ActionResult>
  updateAvailabilityAction: (input: {
    clubId: string
    rows: Array<{ courtId: string; dayOfWeek: number; openTime: string; closeTime: string; pricePerHour: number; isActive: boolean }>
  }) => Promise<ActionResult>
}

const TYPE_LABELS: Record<CourtType, string> = { CRISTAL: 'Cristal', MURO: 'Muro', PANORAMICA: 'Panorámica' }
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const TIME_OPTIONS = Array.from({ length: 36 }, (_, i) => {
  const totalMin = 360 + i * 30
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${String(h % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})
const SELECT_CLS = 'appearance-none bg-surface border border-border rounded-lg pl-2 pr-5 py-1 text-xs text-text font-mono focus:outline-none focus:border-accent cursor-pointer'

function buildKey(courtId: string, dow: number) { return `${courtId}-${dow}` }

function buildAvailState(courts: Court[]) {
  const map: Record<string, Omit<Availability, 'id' | 'courtId'>> = {}
  for (const court of courts) {
    for (let dow = 0; dow < 7; dow++) {
      const a = court.availabilities.find((av) => av.dayOfWeek === dow)
      map[buildKey(court.id, dow)] = {
        dayOfWeek: dow,
        openTime: a?.openTime ?? '08:00',
        closeTime: a?.closeTime ?? '22:00',
        pricePerHour: a?.pricePerHour ?? 700000,
        isActive: a?.isActive ?? false,
      }
    }
  }
  return map
}

export default function CanchasClient({
  clubId, clubName, courts: initialCourts,
  createCourtAction, updateCourtAction, toggleCourtAction, updateAvailabilityAction,
}: Props) {
  const [courts, setCourts] = useState(initialCourts)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<{ name: string; type: CourtType; covered: boolean } | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newCourt, setNewCourt] = useState({ name: '', type: 'CRISTAL' as CourtType, covered: false })
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [availState, setAvailState] = useState(() => buildAvailState(initialCourts))
  const [availDirty, setAvailDirty] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function updateAvail(courtId: string, dow: number, partial: Partial<Omit<Availability, 'id' | 'courtId'>>) {
    setAvailState((prev) => ({ ...prev, [buildKey(courtId, dow)]: { ...prev[buildKey(courtId, dow)]!, ...partial } }))
    setAvailDirty(true)
  }

  function handleSaveAvailability() {
    const rows = courts.flatMap((c) =>
      Array.from({ length: 7 }, (_, dow) => {
        const d = availState[buildKey(c.id, dow)]!
        return { courtId: c.id, dayOfWeek: dow, openTime: d.openTime, closeTime: d.closeTime, pricePerHour: d.pricePerHour, isActive: d.isActive }
      })
    )
    startTransition(async () => {
      const res = await updateAvailabilityAction({ clubId, rows })
      if (res.success) { setAvailDirty(false); toast.success('Horarios guardados.') }
      else toast.error(res.error ?? 'Error al guardar horarios.')
    })
  }

  function handleAddCourt() {
    if (!newCourt.name.trim()) { setError('El nombre es obligatorio.'); return }
    setError(null)
    startTransition(async () => {
      const res = await createCourtAction({ clubId, name: newCourt.name.trim(), type: newCourt.type, covered: newCourt.covered, svgX: 10, svgY: 10 + courts.length * 20, svgW: 80, svgH: 15 })
      if (res.success && res.data) {
        const newC: Court = { id: res.data.courtId, name: newCourt.name.trim(), type: newCourt.type, covered: newCourt.covered, isActive: true, availabilities: [] }
        setCourts((prev) => [...prev, newC])
        setAvailState((prev) => {
          const next = { ...prev }
          for (let dow = 0; dow < 7; dow++) {
            next[buildKey(res.data!.courtId, dow)] = { dayOfWeek: dow, openTime: '08:00', closeTime: '22:00', pricePerHour: 700000, isActive: false }
          }
          return next
        })
        setNewCourt({ name: '', type: 'CRISTAL', covered: false })
        setShowAdd(false)
        toast.success('Cancha creada.')
      } else { setError(!res.success ? res.error ?? 'Error al crear cancha.' : 'Error al crear cancha.') }
    })
  }

  function handleSaveEdit(courtId: string) {
    if (!editState?.name.trim()) { setError('El nombre es obligatorio.'); return }
    setError(null)
    startTransition(async () => {
      const res = await updateCourtAction(courtId, clubId, editState!)
      if (res.success) { setCourts((prev) => prev.map((c) => c.id === courtId ? { ...c, ...editState! } : c)); setEditingId(null); setEditState(null) }
      else { setError(res.error ?? 'Error al guardar.') }
    })
  }

  function handleToggle(courtId: string) {
    startTransition(async () => {
      const res = await toggleCourtAction(courtId, clubId)
      if (res.success) setCourts((prev) => prev.map((c) => c.id === courtId ? { ...c, isActive: !c.isActive } : c))
    })
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface border-b border-border px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-semibold text-text">Canchas y Horarios — {clubName}</h1>
          <p className="text-xs text-muted">{courts.length} cancha{courts.length !== 1 ? 's' : ''} · configurá disponibilidad y precios</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {availDirty && (
            <button onClick={handleSaveAvailability} disabled={isPending}
              className="px-3 py-1.5 bg-accent text-accent-text text-xs font-semibold rounded-lg hover:bg-accent-dark transition-colors disabled:opacity-50">
              {isPending ? 'Guardando...' : 'Guardar horarios'}
            </button>
          )}
          <button onClick={() => { setShowAdd(true); setError(null) }}
            className="px-3 py-1.5 bg-card border border-border text-text text-xs font-semibold rounded-lg hover:border-accent/50 transition-colors">
            + Nueva cancha
          </button>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-3 pb-16">
        {error && <div className="bg-red-400/10 border border-red-400/30 rounded-lg p-3 text-sm text-red-400">{error}</div>}

        {/* Add court form */}
        {showAdd && (
          <div className="bg-card border border-accent/30 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm text-text">Nueva cancha</h3>
            <input type="text" value={newCourt.name} onChange={(e) => setNewCourt((p) => ({ ...p, name: e.target.value }))} placeholder="Nombre (ej: Cancha 3)"
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-sub focus:outline-none focus:border-accent" />
            <div className="flex gap-2">
              {(['CRISTAL', 'MURO', 'PANORAMICA'] as CourtType[]).map((type) => (
                <button key={type} onClick={() => setNewCourt((p) => ({ ...p, type }))}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${newCourt.type === type ? 'bg-accent text-accent-text' : 'bg-bg border border-border text-muted'}`}>
                  {TYPE_LABELS[type]}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={newCourt.covered} onChange={(e) => setNewCourt((p) => ({ ...p, covered: e.target.checked }))} className="accent-accent" />
              <span className="text-sm text-text">Techada</span>
            </label>
            <div className="flex gap-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2 border border-border rounded-lg text-sm text-muted hover:text-text">Cancelar</button>
              <button onClick={handleAddCourt} disabled={isPending} className="flex-1 py-2 bg-accent text-accent-text font-semibold rounded-lg text-sm hover:bg-accent-dark disabled:opacity-50">
                {isPending ? 'Creando...' : 'Crear'}
              </button>
            </div>
          </div>
        )}

        {courts.length === 0 && !showAdd && (
          <div className="text-center py-12 text-muted text-sm">No hay canchas registradas. Creá la primera.</div>
        )}

        {courts.map((court) => {
          const isExpanded = expandedId === court.id
          return (
            <div key={court.id} className={`bg-card border rounded-xl overflow-hidden transition-opacity ${court.isActive ? 'border-border' : 'border-border opacity-60'}`}>
              {/* Court row */}
              {editingId === court.id && editState ? (
                <div className="p-4 space-y-3">
                  <input type="text" value={editState.name} onChange={(e) => setEditState((p) => p ? { ...p, name: e.target.value } : p)}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent" />
                  <div className="flex gap-2">
                    {(['CRISTAL', 'MURO', 'PANORAMICA'] as CourtType[]).map((type) => (
                      <button key={type} onClick={() => setEditState((p) => p ? { ...p, type } : p)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${editState.type === type ? 'bg-accent text-accent-text' : 'bg-bg border border-border text-muted'}`}>
                        {TYPE_LABELS[type]}
                      </button>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editState.covered} onChange={(e) => setEditState((p) => p ? { ...p, covered: e.target.checked } : p)} className="accent-accent" />
                    <span className="text-sm text-text">Techada</span>
                  </label>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingId(null); setEditState(null); setError(null) }} className="flex-1 py-1.5 border border-border rounded-lg text-sm text-muted">Cancelar</button>
                    <button onClick={() => handleSaveEdit(court.id)} disabled={isPending} className="flex-1 py-1.5 bg-accent text-accent-text font-semibold rounded-lg text-sm disabled:opacity-50">Guardar</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${court.isActive ? 'bg-green-400' : 'bg-muted'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text text-sm">{court.name}</p>
                    <p className="text-xs text-muted">{TYPE_LABELS[court.type]} · {court.covered ? 'Techada' : 'Al aire libre'}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => { setEditingId(court.id); setEditState({ name: court.name, type: court.type, covered: court.covered }); setError(null) }}
                      className="text-xs text-muted hover:text-accent transition-colors px-2 py-1 border border-border rounded-lg">Editar</button>
                    <button onClick={() => handleToggle(court.id)} disabled={isPending}
                      className={`text-xs px-2 py-1 border rounded-lg transition-colors ${court.isActive ? 'border-border text-muted hover:border-red-400 hover:text-red-400' : 'border-green-400/40 text-green-400'}`}>
                      {court.isActive ? 'Pausar' : 'Activar'}
                    </button>
                  </div>
                </div>
              )}

              {/* Availability toggle */}
              <button onClick={() => setExpandedId(isExpanded ? null : court.id)}
                className="w-full flex items-center justify-between px-4 py-2 border-t border-border/60 text-xs text-muted hover:text-text hover:bg-surface/50 transition-colors">
                <span className="font-medium">Horarios y precios</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* Availability section */}
              {isExpanded && (
                <div className="border-t border-border divide-y divide-border/60">
                  {DAYS.map((dayLabel, dow) => {
                    const key = buildKey(court.id, dow)
                    const d = availState[key]
                    if (!d) return null
                    return (
                      <div key={dow} className="px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                        {/* Toggle */}
                        <button onClick={() => updateAvail(court.id, dow, { isActive: !d.isActive })}
                          className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${d.isActive ? 'bg-accent' : 'bg-border'}`}>
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${d.isActive ? 'left-[18px]' : 'left-0.5'}`} />
                        </button>
                        <span className={`text-xs font-medium w-7 shrink-0 ${d.isActive ? 'text-text' : 'text-muted'}`}>{dayLabel}</span>
                        {d.isActive ? (
                          <>
                            <div className="relative shrink-0">
                              <select value={d.openTime} onChange={(e) => updateAvail(court.id, dow, { openTime: e.target.value })} className={SELECT_CLS}>
                                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                              </select>
                              <span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-muted text-[10px]">▾</span>
                            </div>
                            <span className="text-muted text-xs shrink-0">–</span>
                            <div className="relative shrink-0">
                              <select value={d.closeTime} onChange={(e) => updateAvail(court.id, dow, { closeTime: e.target.value })} className={SELECT_CLS}>
                                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                              </select>
                              <span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-muted text-[10px]">▾</span>
                            </div>
                            <div className="flex items-center gap-1 ml-auto shrink-0">
                              <span className="text-xs text-muted">$</span>
                              <input type="number" value={Math.round(d.pricePerHour / 100)}
                                onChange={(e) => updateAvail(court.id, dow, { pricePerHour: Math.round(parseFloat(e.target.value) * 100) || 0 })}
                                className="w-20 bg-surface border border-border rounded-lg px-2 py-1 text-xs text-text font-mono text-right focus:outline-none focus:border-accent" step="100" min="0" />
                              <span className="text-xs text-muted">/hr</span>
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-sub ml-auto">Cerrado</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {availDirty && courts.length > 0 && (
          <button onClick={handleSaveAvailability} disabled={isPending}
            className="w-full py-3 bg-accent text-accent-text text-sm font-semibold rounded-xl hover:bg-accent-dark transition-colors disabled:opacity-50">
            {isPending ? 'Guardando...' : 'Guardar todos los cambios'}
          </button>
        )}
      </div>
    </div>
  )
}
