'use client'

import { useState, useTransition } from 'react'
import type { ActionResult } from '@/types'

type CourtType = 'CRISTAL' | 'MURO' | 'PANORAMICA'

interface Court {
  id: string
  name: string
  type: CourtType
  covered: boolean
  svgX: number
  svgY: number
  svgW: number
  svgH: number
  isActive: boolean
}

interface CanchasClientProps {
  clubId: string
  clubName: string
  courts: Court[]
  createCourtAction: (input: {
    clubId: string
    name: string
    type: CourtType
    covered: boolean
    svgX: number
    svgY: number
    svgW: number
    svgH: number
  }) => Promise<ActionResult<{ courtId: string }>>
  updateCourtAction: (
    courtId: string,
    clubId: string,
    data: { name?: string; type?: CourtType; covered?: boolean }
  ) => Promise<ActionResult>
  toggleCourtAction: (courtId: string, clubId: string) => Promise<ActionResult>
}

const TYPE_LABELS: Record<CourtType, string> = {
  CRISTAL: 'Cristal',
  MURO: 'Muro',
  PANORAMICA: 'Panorámica',
}

export default function CanchasClient({
  clubId,
  clubName,
  courts: initialCourts,
  createCourtAction,
  updateCourtAction,
  toggleCourtAction,
}: CanchasClientProps) {
  const [courts, setCourts] = useState(initialCourts)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // New court form
  const [newCourt, setNewCourt] = useState({
    name: '',
    type: 'CRISTAL' as CourtType,
    covered: false,
  })

  // Edit form state
  const [editState, setEditState] = useState<{
    name: string
    type: CourtType
    covered: boolean
  } | null>(null)

  function startEdit(court: Court) {
    setEditingId(court.id)
    setEditState({ name: court.name, type: court.type, covered: court.covered })
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditState(null)
    setError(null)
  }

  function handleSaveEdit(courtId: string) {
    if (!editState?.name.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await updateCourtAction(courtId, clubId, editState)
      if (result.success) {
        setCourts((prev) => prev.map((c) => (c.id === courtId ? { ...c, ...editState } : c)))
        setEditingId(null)
        setEditState(null)
      } else {
        setError(result.error)
      }
    })
  }

  function handleToggle(courtId: string) {
    startTransition(async () => {
      const result = await toggleCourtAction(courtId, clubId)
      if (result.success) {
        setCourts((prev) =>
          prev.map((c) => (c.id === courtId ? { ...c, isActive: !c.isActive } : c))
        )
      }
    })
  }

  function handleAddCourt() {
    if (!newCourt.name.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await createCourtAction({
        clubId,
        name: newCourt.name.trim(),
        type: newCourt.type,
        covered: newCourt.covered,
        svgX: 10,
        svgY: 10 + courts.length * 20,
        svgW: 80,
        svgH: 15,
      })
      if (result.success) {
        // Refresh will happen via revalidatePath; for UI optimism just reset form
        setNewCourt({ name: '', type: 'CRISTAL', covered: false })
        setShowAdd(false)
        // Optimistically add to list
        if (result.data) {
          const newC: Court = {
            id: result.data.courtId,
            name: newCourt.name.trim(),
            type: newCourt.type,
            covered: newCourt.covered,
            svgX: 10,
            svgY: 10 + courts.length * 20,
            svgW: 80,
            svgH: 15,
            isActive: true,
          }
          setCourts((prev) => [...prev, newC])
        }
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="sticky top-0 z-10 bg-surface border-b border-border px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-text">Canchas — {clubName}</h1>
          <p className="text-xs text-muted">
            {courts.length} cancha{courts.length !== 1 ? 's' : ''} registrada
            {courts.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => {
            setShowAdd(true)
            setError(null)
          }}
          className="bg-accent text-accent-text font-semibold text-sm px-3 py-1.5 rounded-lg hover:bg-accent-dark transition-colors"
        >
          + Nueva cancha
        </button>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-3">
        {error && (
          <div className="bg-red-400/10 border border-red-400/30 rounded-lg p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Add court form */}
        {showAdd && (
          <div className="bg-card border border-accent/30 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm text-text">Nueva cancha</h3>
            <input
              type="text"
              value={newCourt.name}
              onChange={(e) => setNewCourt((p) => ({ ...p, name: e.target.value }))}
              placeholder="Nombre (ej: Cancha 3)"
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-sub focus:outline-none focus:border-accent"
            />
            <div className="flex gap-2">
              {(['CRISTAL', 'MURO', 'PANORAMICA'] as CourtType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setNewCourt((p) => ({ ...p, type }))}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${newCourt.type === type ? 'bg-accent text-accent-text' : 'bg-bg border border-border text-muted'}`}
                >
                  {TYPE_LABELS[type]}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newCourt.covered}
                onChange={(e) => setNewCourt((p) => ({ ...p, covered: e.target.checked }))}
                className="accent-accent"
              />
              <span className="text-sm text-text">Techada</span>
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 py-2 border border-border rounded-lg text-sm text-muted hover:text-text"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddCourt}
                disabled={isPending}
                className="flex-1 py-2 bg-accent text-accent-text font-semibold rounded-lg text-sm hover:bg-accent-dark disabled:opacity-50"
              >
                {isPending ? 'Guardando...' : 'Crear'}
              </button>
            </div>
          </div>
        )}

        {/* Court list */}
        {courts.length === 0 && !showAdd && (
          <div className="text-center py-12 text-muted">
            <p className="text-3xl mb-2">🎾</p>
            <p className="text-sm">No hay canchas registradas. Creá la primera.</p>
          </div>
        )}

        {courts.map((court) => (
          <div
            key={court.id}
            className={`bg-card border rounded-xl p-4 ${court.isActive ? 'border-border' : 'border-border opacity-60'}`}
          >
            {editingId === court.id && editState ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={editState.name}
                  onChange={(e) => setEditState((p) => (p ? { ...p, name: e.target.value } : p))}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
                />
                <div className="flex gap-2">
                  {(['CRISTAL', 'MURO', 'PANORAMICA'] as CourtType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setEditState((p) => (p ? { ...p, type } : p))}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${editState.type === type ? 'bg-accent text-accent-text' : 'bg-bg border border-border text-muted'}`}
                    >
                      {TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editState.covered}
                    onChange={(e) =>
                      setEditState((p) => (p ? { ...p, covered: e.target.checked } : p))
                    }
                    className="accent-accent"
                  />
                  <span className="text-sm text-text">Techada</span>
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={cancelEdit}
                    className="flex-1 py-1.5 border border-border rounded-lg text-sm text-muted"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleSaveEdit(court.id)}
                    disabled={isPending}
                    className="flex-1 py-1.5 bg-accent text-accent-text font-semibold rounded-lg text-sm disabled:opacity-50"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${court.isActive ? 'bg-green-400' : 'bg-muted'}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text">{court.name}</p>
                  <p className="text-xs text-muted">
                    {TYPE_LABELS[court.type]} · {court.covered ? 'Techada' : 'Al aire libre'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEdit(court)}
                    className="text-xs text-muted hover:text-accent transition-colors px-2 py-1 border border-border rounded-lg"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleToggle(court.id)}
                    disabled={isPending}
                    className={`text-xs px-2 py-1 border rounded-lg transition-colors ${
                      court.isActive
                        ? 'border-border text-muted hover:border-red-400 hover:text-red-400'
                        : 'border-green-400/40 text-green-400'
                    }`}
                  >
                    {court.isActive ? 'Pausar' : 'Activar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
