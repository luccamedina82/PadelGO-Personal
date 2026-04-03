'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import type { ActionResult } from '@/types'

type CourtType = 'CRISTAL' | 'MURO' | 'PANORAMICA'

interface Court {
  id: string
  name: string
  type: CourtType
  covered: boolean
  isActive: boolean
  isUnderMaintenance: boolean
  hideFromGrid: boolean
}

interface Props {
  clubId: string
  clubName: string
  courts: Court[]
  createCourtAction: (input: {
    clubId: string; name: string; type: CourtType; covered: boolean
  }) => Promise<ActionResult<{ courtId: string }>>
  updateCourtAction: (courtId: string, clubId: string, data: { name?: string; type?: CourtType; covered?: boolean }) => Promise<ActionResult>
  setMaintenanceAction: (courtId: string, clubId: string, isUnderMaintenance: boolean) => Promise<ActionResult>
  getCourtPendingCountAction: (courtId: string) => Promise<ActionResult<{ count: number }>>
  toggleGridVisibilityAction: (courtId: string, clubId: string) => Promise<ActionResult>
  deactivateAction: (courtId: string, clubId: string) => Promise<ActionResult>
  activateAction: (courtId: string, clubId: string) => Promise<ActionResult>
}

const TYPE_LABELS: Record<CourtType, string> = { CRISTAL: 'Cristal', MURO: 'Muro', PANORAMICA: 'Panorámica' }

export default function CanchasClient({
  clubId, clubName, courts: initialCourts,
  createCourtAction, updateCourtAction, setMaintenanceAction, getCourtPendingCountAction,
  toggleGridVisibilityAction, deactivateAction, activateAction,
}: Props) {
  const [courts, setCourts] = useState(initialCourts)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<{ name: string; type: CourtType; covered: boolean } | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newCourt, setNewCourt] = useState({ name: '', type: 'CRISTAL' as CourtType, covered: false })
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmFor, setConfirmFor] = useState<{ courtId: string; count: number } | null>(null)
  const [deactivateError, setDeactivateError] = useState<{ courtId: string; message: string } | null>(null)

  function handleAddCourt() {
    if (!newCourt.name.trim()) { setError('El nombre es obligatorio.'); return }
    setError(null)
    startTransition(async () => {
      const res = await createCourtAction({ clubId, name: newCourt.name.trim(), type: newCourt.type, covered: newCourt.covered })
      if (res.success && res.data) {
        const newC: Court = { id: res.data.courtId, name: newCourt.name.trim(), type: newCourt.type, covered: newCourt.covered, isActive: true, isUnderMaintenance: false, hideFromGrid: false }
        setCourts((prev) => [...prev, newC])
        setNewCourt({ name: '', type: 'CRISTAL', covered: false })
        setShowAdd(false)
        toast.success('Cancha creada.')
      } else {
        setError(!res.success ? res.error ?? 'Error al crear cancha.' : 'Error al crear cancha.')
      }
    })
  }

  function handleSaveEdit(courtId: string) {
    if (!editState?.name.trim()) { setError('El nombre es obligatorio.'); return }
    setError(null)
    startTransition(async () => {
      const res = await updateCourtAction(courtId, clubId, editState!)
      if (res.success) {
        setCourts((prev) => prev.map((c) => c.id === courtId ? { ...c, ...editState! } : c))
        setEditingId(null); setEditState(null)
      } else {
        setError(res.error ?? 'Error al guardar.')
      }
    })
  }

  async function handleToggleMaintenance(courtId: string, currentlyUnder: boolean) {
    if (currentlyUnder) {
      startTransition(async () => {
        const res = await setMaintenanceAction(courtId, clubId, false)
        if (res.success) setCourts((prev) => prev.map((c) => c.id === courtId ? { ...c, isUnderMaintenance: false } : c))
        else toast.error(res.error ?? 'Error al actualizar.')
      })
      return
    }
    const countRes = await getCourtPendingCountAction(courtId)
    const count = countRes.success ? (countRes.data?.count ?? 0) : 0
    if (count > 0) {
      setConfirmFor({ courtId, count })
      return
    }
    applyMaintenance(courtId)
  }

  function applyMaintenance(courtId: string) {
    setConfirmFor(null)
    startTransition(async () => {
      const res = await setMaintenanceAction(courtId, clubId, true)
      if (res.success) setCourts((prev) => prev.map((c) => c.id === courtId ? { ...c, isUnderMaintenance: true } : c))
      else toast.error(res.error ?? 'Error al actualizar.')
    })
  }

  function handleToggleGridVisibility(courtId: string) {
    startTransition(async () => {
      const res = await toggleGridVisibilityAction(courtId, clubId)
      if (res.success) {
        setCourts((prev) => prev.map((c) => c.id === courtId ? { ...c, hideFromGrid: !c.hideFromGrid } : c))
      } else {
        toast.error(res.error ?? 'Error al actualizar visibilidad.')
      }
    })
  }

  function handleDeactivate(courtId: string) {
    setDeactivateError(null)
    startTransition(async () => {
      const res = await deactivateAction(courtId, clubId)
      if (res.success) {
        setCourts((prev) => prev.map((c) => c.id === courtId ? { ...c, isActive: false } : c))
        toast.success('Cancha desactivada.')
      } else {
        setDeactivateError({ courtId, message: res.error ?? 'Error al desactivar.' })
      }
    })
  }

  function handleActivate(courtId: string) {
    startTransition(async () => {
      const res = await activateAction(courtId, clubId)
      if (res.success) {
        setCourts((prev) => prev.map((c) => c.id === courtId ? { ...c, isActive: true } : c))
        toast.success('Cancha activada.')
      } else {
        toast.error(res.error ?? 'Error al activar.')
      }
    })
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="sticky top-0 z-10 bg-surface border-b border-border px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-semibold text-text">Canchas — {clubName}</h1>
          <p className="text-xs text-muted">{courts.length} cancha{courts.length !== 1 ? 's' : ''} · infraestructura física</p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setError(null) }}
          className="px-3 py-1.5 bg-card border border-border text-text text-xs font-semibold rounded-lg hover:border-accent/50 transition-colors"
        >
          + Nueva cancha
        </button>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-3 pb-16">
        {error && (
          <div className="bg-red-400/10 border border-red-400/30 rounded-lg p-3 text-sm text-red-400">{error}</div>
        )}

        {showAdd && (
          <div className="bg-card border border-accent/30 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm text-text">Nueva cancha</h3>
            <input
              type="text" value={newCourt.name}
              onChange={(e) => setNewCourt((p) => ({ ...p, name: e.target.value }))}
              placeholder="Nombre (ej: Cancha 3)"
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-sub focus:outline-none focus:border-accent"
            />
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

        {courts.map((court) => (
          <div key={court.id} className={`bg-card border rounded-xl overflow-hidden transition-opacity ${court.isUnderMaintenance ? 'border-yellow-400/40 opacity-75' : court.isActive ? 'border-border' : 'border-border opacity-55'}`}>

            {/* Confirmation banner for maintenance */}
            {confirmFor?.courtId === court.id && (
              <div className="bg-yellow-400/10 border-b border-yellow-400/30 px-4 py-3">
                <p className="text-xs text-yellow-400 font-medium mb-2">
                  Esta cancha tiene {confirmFor.count} reserva{confirmFor.count !== 1 ? 's' : ''} activa{confirmFor.count !== 1 ? 's' : ''}. ¿Confirmar mantenimiento de todas formas?
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmFor(null)} className="flex-1 py-1 border border-border rounded-lg text-xs text-muted">Cancelar</button>
                  <button onClick={() => applyMaintenance(court.id)} className="flex-1 py-1 bg-yellow-400/20 border border-yellow-400/40 rounded-lg text-xs text-yellow-400 font-semibold">Confirmar</button>
                </div>
              </div>
            )}

            {/* Deactivate error banner */}
            {deactivateError?.courtId === court.id && (
              <div className="bg-red-400/10 border-b border-red-400/30 px-4 py-3">
                <p className="text-xs text-red-400 font-medium mb-2">{deactivateError.message}</p>
                <button onClick={() => setDeactivateError(null)} className="text-xs text-muted hover:text-text transition-colors">Entendido</button>
              </div>
            )}

            {editingId === court.id && editState ? (
              <div className="p-4 space-y-3">
                <input
                  type="text" value={editState.name}
                  onChange={(e) => setEditState((p) => p ? { ...p, name: e.target.value } : p)}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
                />
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
                <div className={`w-2 h-2 rounded-full shrink-0 ${court.isUnderMaintenance ? 'bg-yellow-400' : court.isActive ? 'bg-green-400' : 'bg-muted'}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text text-sm">{court.name}</p>
                  <p className="text-xs text-muted">
                    {TYPE_LABELS[court.type]} · {court.covered ? 'Techada' : 'Al aire libre'}
                    {!court.isActive && <span className="text-muted/60 ml-1.5">· Desactivada</span>}
                    {court.isActive && court.isUnderMaintenance && <span className="text-yellow-400 ml-1.5">· En mantenimiento</span>}
                    {court.isActive && court.hideFromGrid && <span className="text-blue-400/70 ml-1.5">· Oculta en grilla</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {court.isActive && (
                    <button
                      onClick={() => { setEditingId(court.id); setEditState({ name: court.name, type: court.type, covered: court.covered }); setError(null) }}
                      className="text-xs text-muted hover:text-accent transition-colors px-2 py-1 border border-border rounded-lg"
                    >
                      Editar
                    </button>
                  )}
                  {court.isActive && (
                    <button
                      onClick={() => handleToggleMaintenance(court.id, court.isUnderMaintenance)}
                      disabled={isPending}
                      className={`text-xs px-2 py-1 border rounded-lg transition-colors disabled:opacity-50 ${court.isUnderMaintenance ? 'border-green-400/40 text-green-400 hover:bg-green-400/10' : 'border-border text-muted hover:border-yellow-400/50 hover:text-yellow-400'}`}
                    >
                      {court.isUnderMaintenance ? 'Reactivar' : 'Mantenimiento'}
                    </button>
                  )}
                  {court.isActive && (
                    <button
                      onClick={() => handleToggleGridVisibility(court.id)}
                      disabled={isPending}
                      title={court.hideFromGrid ? 'La cancha está oculta en la grilla de reservas' : 'Ocultar esta cancha de la grilla de reservas'}
                      className={`text-xs px-2 py-1 border rounded-lg transition-colors disabled:opacity-50 ${court.hideFromGrid ? 'border-blue-400/40 text-blue-400 hover:bg-blue-400/10' : 'border-border text-muted hover:border-blue-400/40 hover:text-blue-400/80'}`}
                    >
                      {court.hideFromGrid ? 'Mostrar en grilla' : 'Ocultar de grilla'}
                    </button>
                  )}
                  {court.isActive ? (
                    <button
                      onClick={() => handleDeactivate(court.id)}
                      disabled={isPending}
                      className="text-xs px-2 py-1 border border-red-400/30 text-red-400/70 rounded-lg transition-colors hover:bg-red-400/10 hover:text-red-400 disabled:opacity-50"
                    >
                      Desactivar
                    </button>
                  ) : (
                    <button
                      onClick={() => handleActivate(court.id)}
                      disabled={isPending}
                      className="text-xs px-2 py-1 border border-green-400/40 text-green-400 rounded-lg transition-colors hover:bg-green-400/10 disabled:opacity-50"
                    >
                      Activar
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="border-t border-border/60 px-4 py-3 flex items-center justify-between gap-4 bg-surface/40">
              <div className="min-w-0">
                <p className="text-xs font-medium text-text">Tarifas y Reglas Asociadas</p>
                <p className="text-xs text-muted mt-0.5">Los horarios y precios se gestionan desde el motor de reglas.</p>
              </div>
              <Link href="/admin/tarifas" className="text-xs font-semibold text-accent hover:underline shrink-0">
                Gestionar Tarifas →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
