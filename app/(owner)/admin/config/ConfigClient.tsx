'use client'

import { useState, useTransition } from 'react'
import type { ActionResult } from '@/types'

interface SpecialHours {
  id: string
  date: string // ISO date
  reason: string
  isClosed: boolean
  openTime?: string
  closeTime?: string
}

interface ClubData {
  id: string
  name: string
  description: string
  vibe: string
  address: string
  phone: string
  email: string
  amenities: string[]
  tags: string[]
  cancelHoursBeforeStart: number
  cancellationFeePercent: number
  allowedDurations: number[]
  specialHours: SpecialHours[]
}

interface ConfigClientProps {
  club: ClubData
  updateClubConfigAction: (input: {
    clubId: string
    name?: string
    description?: string
    vibe?: string
    address?: string
    phone?: string
    email?: string
    amenities?: string[]
    tags?: string[]
    cancelHoursBeforeStart?: number
    cancellationFeePercent?: number
    allowedDurations?: number[]
  }) => Promise<ActionResult>
  createSpecialHoursAction: (input: {
    clubId: string
    date: string
    reason: string
    isClosed: boolean
    openTime?: string
    closeTime?: string
  }) => Promise<ActionResult>
  deleteSpecialHoursAction: (input: {
    clubId: string
    specialHoursId: string
  }) => Promise<ActionResult>
}

const AVAILABLE_TAGS = [
  'Techado',
  'Al Aire Libre',
  'Premium',
  'Iluminado',
  'Estacionamiento',
  'Vestuarios',
  'Cafetería',
]
const AVAILABLE_AMENITIES = [
  'WiFi',
  'Duchas',
  'Vestuarios',
  'Estacionamiento',
  'Bar/Cafetería',
  'Tienda deportiva',
  'Clases',
  'Alquiler de paletas',
]

export default function ConfigClient({
  club,
  updateClubConfigAction,
  createSpecialHoursAction,
  deleteSpecialHoursAction,
}: ConfigClientProps) {
  const [form, setForm] = useState({
    name: club.name,
    description: club.description,
    vibe: club.vibe,
    address: club.address,
    phone: club.phone,
    email: club.email,
    amenities: club.amenities,
    tags: club.tags,
    cancelHoursBeforeStart: club.cancelHoursBeforeStart,
    cancellationFeePercent: club.cancellationFeePercent,
    allowedDurations: club.allowedDurations,
  })

  const [specialHourForm, setSpecialHourForm] = useState({
    date: '',
    reason: '',
    isClosed: false,
    openTime: '10:00',
    closeTime: '22:00',
  })

  const [isPending, startTransition] = useTransition()
  const [isSpecialHoursPending, startSpecialHoursTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [specialHoursError, setSpecialHoursError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [specialHours, setSpecialHours] = useState<SpecialHours[]>(club.specialHours)

  function toggleTag(tag: string) {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
    }))
  }

  function toggleAmenity(amenity: string) {
    setForm((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter((a) => a !== amenity)
        : [...prev.amenities, amenity],
    }))
  }

  function toggleDuration(duration: number) {
    setForm((prev) => ({
      ...prev,
      allowedDurations: prev.allowedDurations.includes(duration)
        ? prev.allowedDurations.filter((d) => d !== duration)
        : [...prev.allowedDurations, duration],
    }))
  }

  function handleSave() {
    setError(null)
    if (!form.name.trim()) {
      setError('El nombre del club es obligatorio.')
      return
    }
    if (form.allowedDurations.length === 0) {
      setError('Debe seleccionar al menos una duración permitida.')
      return
    }
    startTransition(async () => {
      const result = await updateClubConfigAction({ clubId: club.id, ...form })
      if (result.success) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } else {
        setError(result.error)
      }
    })
  }

  function handleAddSpecialHours() {
    setSpecialHoursError(null)
    if (!specialHourForm.date || !specialHourForm.reason.trim()) {
      setSpecialHoursError('Fecha y motivo son requeridos.')
      return
    }
    startSpecialHoursTransition(async () => {
      const result = await createSpecialHoursAction({
        clubId: club.id,
        ...specialHourForm,
      })
      if (result.success) {
        const newEntry: SpecialHours = {
          id: Date.now().toString(), // temporal, se sincroniza al refetch
          date: specialHourForm.date,
          reason: specialHourForm.reason,
          isClosed: specialHourForm.isClosed,
          ...(specialHourForm.openTime && { openTime: specialHourForm.openTime }),
          ...(specialHourForm.closeTime && { closeTime: specialHourForm.closeTime }),
        }
        setSpecialHours([...specialHours, newEntry])
        setSpecialHourForm({
          date: '',
          reason: '',
          isClosed: false,
          openTime: '10:00',
          closeTime: '22:00',
        })
      } else {
        setSpecialHoursError(result.error)
      }
    })
  }

  function handleDeleteSpecialHours(id: string) {
    startSpecialHoursTransition(async () => {
      const result = await deleteSpecialHoursAction({ clubId: club.id, specialHoursId: id })
      if (result.success) {
        setSpecialHours(specialHours.filter((sh) => sh.id !== id))
      } else {
        setSpecialHoursError(result.error)
      }
    })
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="sticky top-0 z-10 bg-surface border-b border-border px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-text">Configuración — {club.name}</h1>
          <p className="text-xs text-muted">Datos del club visibles para los jugadores</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isPending}
          className={`px-4 py-1.5 rounded-lg font-semibold text-sm transition-colors ${
            saved
              ? 'bg-green-400/10 text-green-400 border border-green-400/30'
              : 'bg-accent text-accent-text hover:bg-accent-dark'
          } disabled:opacity-50`}
        >
          {isPending ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar cambios'}
        </button>
      </div>

      <div className="p-4 max-w-xl mx-auto space-y-5">
        {error && (
          <div className="bg-red-400/10 border border-red-400/30 rounded-lg p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Basic info */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h2 className="font-semibold text-sm text-text">Información básica</h2>
          <div>
            <label className="text-xs text-muted block mb-1">Nombre del club *</label>
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Tagline / Vibe</label>
            <input
              value={form.vibe}
              onChange={(e) => setForm((p) => ({ ...p, vibe: e.target.value }))}
              placeholder="Ej: El favorito de Palermo"
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-sub focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={3}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text resize-none focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Contact */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h2 className="font-semibold text-sm text-text">Contacto y ubicación</h2>
          <div>
            <label className="text-xs text-muted block mb-1">Dirección</label>
            <input
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted block mb-1">Teléfono</label>
              <input
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Email del club</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-semibold text-sm text-text mb-3">Etiquetas del club</h2>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  form.tags.includes(tag)
                    ? 'bg-accent text-accent-text border-accent'
                    : 'border-border text-muted hover:border-border-hover'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Amenities */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-semibold text-sm text-text mb-3">Comodidades e instalaciones</h2>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_AMENITIES.map((am) => (
              <button
                key={am}
                onClick={() => toggleAmenity(am)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  form.amenities.includes(am)
                    ? 'bg-accent/10 text-accent border-accent/30'
                    : 'border-border text-muted hover:border-border-hover'
                }`}
              >
                {am}
              </button>
            ))}
          </div>
        </div>

        {/* Políticas de cancelación */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h2 className="font-semibold text-sm text-text">Políticas de cancelación</h2>
          <div>
            <label className="text-xs text-muted block mb-1">
              Horas mínimas para cancelar sin cargo
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="48"
                value={form.cancelHoursBeforeStart}
                onChange={(e) =>
                  setForm((p) => ({ ...p, cancelHoursBeforeStart: parseInt(e.target.value) || 0 }))
                }
                className="w-20 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
              />
              <span className="text-xs text-muted">horas</span>
            </div>
            <p className="text-xs text-muted mt-1">
              Ejemplo: Con 2 horas, si cancela menos de 2hs antes, paga cargo.
            </p>
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Cargo por cancelación tardía</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                value={form.cancellationFeePercent}
                onChange={(e) =>
                  setForm((p) => ({ ...p, cancellationFeePercent: parseInt(e.target.value) || 0 }))
                }
                className="w-20 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
              />
              <span className="text-xs text-muted">% del total</span>
            </div>
          </div>
        </div>

        {/* Duraciones permitidas */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-semibold text-sm text-text mb-3">Duraciones de turnos permitidas</h2>
          <div className="space-y-2">
            {[60, 90, 120].map((duration) => (
              <label key={duration} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.allowedDurations.includes(duration)}
                  onChange={() => toggleDuration(duration)}
                  className="w-4 h-4 rounded accent"
                />
                <span className="text-sm text-text">{duration} minutos</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted mt-3">
            Selecciona al menos una duración. Los jugadores solo podrán reservar con estas opciones.
          </p>
        </div>

        {/* Horarios especiales */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h2 className="font-semibold text-sm text-text">
            Horarios especiales (feriados, eventos)
          </h2>

          {specialHoursError && (
            <div className="bg-red-400/10 border border-red-400/30 rounded-lg p-3 text-sm text-red-400">
              {specialHoursError}
            </div>
          )}

          <div className="bg-bg rounded-lg p-3 space-y-3 border border-border">
            <div>
              <label className="text-xs text-muted block mb-1">Fecha</label>
              <input
                type="date"
                value={specialHourForm.date}
                onChange={(e) => setSpecialHourForm((p) => ({ ...p, date: e.target.value }))}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="text-xs text-muted block mb-1">
                Motivo (ej: Feriado, Evento privado)
              </label>
              <input
                value={specialHourForm.reason}
                onChange={(e) => setSpecialHourForm((p) => ({ ...p, reason: e.target.value }))}
                placeholder="Descripción breve"
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-sub focus:outline-none focus:border-accent"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={specialHourForm.isClosed}
                onChange={(e) => setSpecialHourForm((p) => ({ ...p, isClosed: e.target.checked }))}
                className="w-4 h-4 rounded accent"
              />
              <span className="text-sm text-text">Club cerrado todo el día</span>
            </label>

            {!specialHourForm.isClosed && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted block mb-1">Abre a</label>
                  <input
                    type="time"
                    value={specialHourForm.openTime}
                    onChange={(e) =>
                      setSpecialHourForm((p) => ({ ...p, openTime: e.target.value }))
                    }
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Cierra a</label>
                  <input
                    type="time"
                    value={specialHourForm.closeTime}
                    onChange={(e) =>
                      setSpecialHourForm((p) => ({ ...p, closeTime: e.target.value }))
                    }
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleAddSpecialHours}
              disabled={isSpecialHoursPending}
              className="w-full px-3 py-2 rounded-lg text-sm font-medium bg-accent text-accent-text hover:bg-accent-dark disabled:opacity-50 transition-colors"
            >
              {isSpecialHoursPending ? 'Agregando...' : 'Agregar fecha especial'}
            </button>
          </div>

          {specialHours.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted">Fechas especiales registradas:</p>
              {specialHours.map((sh) => (
                <div
                  key={sh.id}
                  className="flex items-center justify-between bg-bg rounded-lg p-2 border border-border"
                >
                  <div className="text-sm">
                    <p className="text-text font-medium">{sh.reason}</p>
                    <p className="text-xs text-muted">
                      {new Date(sh.date).toLocaleDateString('es-AR', {
                        weekday: 'short',
                        month: 'short',
                        day: '2-digit',
                      })}
                      {sh.isClosed ? ' (cerrado)' : ` (${sh.openTime}-${sh.closeTime})`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteSpecialHours(sh.id)}
                    disabled={isSpecialHoursPending}
                    className="px-2 py-1 rounded text-xs bg-red-400/10 text-red-400 hover:bg-red-400/20 disabled:opacity-50 transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-card border border-red-400/20 rounded-xl p-4">
          <h2 className="font-semibold text-sm text-red-400 mb-1">Zona de peligro</h2>
          <p className="text-xs text-muted mb-3">
            Para desactivar tu club o realizar acciones críticas, contactá a soporte en{' '}
            <span className="text-accent">soporte@padelgo.ar</span>
          </p>
        </div>
      </div>
    </div>
  )
}
