'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClub } from '@/actions/superadmin/clubs'

const ZONAS_BSAS = [
  'Palermo',
  'Belgrano',
  'Núñez',
  'Recoleta',
  'San Telmo',
  'Villa Crespo',
  'Caballito',
  'Flores',
  'Almagro',
  'Balvanera',
  'Boedo',
  'Villa del Parque',
  'Devoto',
  'Coghlan',
  'Saavedra',
  'Colegiales',
  'Paternal',
  'Parque Chacabuco',
  'Villa Pueyrredón',
  'Floresta',
  'Monte Castro',
  'Liniers',
  'Mataderos',
]

interface CreateClubFormProps {
  onCancel: () => void
}

export default function CreateClubForm({ onCancel }: CreateClubFormProps) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [step1, setStep1] = useState({
    name: '',
    zone: '',
    address: '',
    city: 'Buenos Aires',
    phone: '',
    email: '',
  })

  const [step2, setStep2] = useState({
    ownerEmail: '',
    ownerName: '',
  })

  function handleNext() {
    if (!step1.name.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    if (!step1.zone) {
      setError('Seleccioná una zona.')
      return
    }
    if (!step1.address.trim()) {
      setError('La dirección es obligatoria.')
      return
    }
    setError(null)
    setStep(2)
  }

  function handleSubmit() {
    if (!step2.ownerEmail.trim() || !step2.ownerEmail.includes('@')) {
      setError('Email del owner inválido.')
      return
    }
    setError(null)

    startTransition(async () => {
      const result = await createClub({
        name: step1.name.trim(),
        zone: step1.zone,
        address: step1.address.trim(),
        city: step1.city,
        phone: step1.phone.trim(),
        email: step1.email.trim(),
        lat: 0,
        lng: 0,
        ownerEmail: step2.ownerEmail.trim(),
        ownerName: step2.ownerName.trim() || undefined,
      })

      if (result.success) {
        setSuccess(
          result.data?.ownerInvited
            ? `Club creado. Se envió invitación al owner (${step2.ownerEmail}).`
            : `Club creado y vinculado al owner existente.`
        )
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  if (success) {
    return (
      <div
        className="border rounded-xl p-5 mb-6"
        style={{
          borderColor: 'rgba(168,85,247,0.4)',
          background: 'rgba(168,85,247,0.06)',
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-green-400 text-xl">✓</span>
          <div>
            <p className="font-medium text-text">{success}</p>
            <p className="text-xs text-muted mt-0.5">
              El club quedó inactivo hasta que el Owner complete la configuración.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="ml-auto text-xs text-muted hover:text-text px-3 py-1.5 border border-border rounded-lg"
          >
            Cerrar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="border rounded-xl p-5 mb-6"
      style={{
        borderColor: 'rgba(168,85,247,0.4)',
        background: 'rgba(168,85,247,0.06)',
      }}
    >
      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-2">
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              step === 1 ? 'text-[#a855f7] border-2 border-[#a855f7]' : 'bg-[#a855f7] text-white'
            }`}
          >
            {step === 2 ? '✓' : '1'}
          </span>
          <span className={`text-sm ${step === 1 ? 'text-text font-medium' : 'text-muted'}`}>
            Datos del club
          </span>
        </div>
        <div className="h-px flex-1 bg-border" />
        <div className="flex items-center gap-2">
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
              step === 2 ? 'text-[#a855f7] border-[#a855f7]' : 'text-muted border-border'
            }`}
          >
            2
          </span>
          <span className={`text-sm ${step === 2 ? 'text-text font-medium' : 'text-muted'}`}>
            Asignar Owner
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-400/10 border border-red-500/30 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted mb-1 block">Nombre del club *</label>
              <input
                type="text"
                value={step1.name}
                onChange={(e) => setStep1((s) => ({ ...s, name: e.target.value }))}
                placeholder="Ej: Club Padel Palermo"
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-sub focus:outline-none focus:border-border-hover"
              />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Zona / Barrio *</label>
              <select
                value={step1.zone}
                onChange={(e) => setStep1((s) => ({ ...s, zone: e.target.value }))}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-border-hover"
              >
                <option value="">Seleccioná zona...</option>
                {ZONAS_BSAS.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Dirección *</label>
            <input
              type="text"
              value={step1.address}
              onChange={(e) => setStep1((s) => ({ ...s, address: e.target.value }))}
              placeholder="Av. Santa Fe 1234"
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-sub focus:outline-none focus:border-border-hover"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted mb-1 block">Teléfono</label>
              <input
                type="tel"
                value={step1.phone}
                onChange={(e) => setStep1((s) => ({ ...s, phone: e.target.value }))}
                placeholder="+54 11 1234-5678"
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-sub focus:outline-none focus:border-border-hover"
              />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Email del club</label>
              <input
                type="email"
                value={step1.email}
                onChange={(e) => setStep1((s) => ({ ...s, email: e.target.value }))}
                placeholder="info@club.com"
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-sub focus:outline-none focus:border-border-hover"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-muted border border-border rounded-lg hover:bg-card transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleNext}
              className="px-4 py-2 text-sm font-semibold rounded-lg transition-colors"
              style={{ background: '#a855f7', color: 'white' }}
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted mb-1 block">Email del Owner *</label>
              <input
                type="email"
                value={step2.ownerEmail}
                onChange={(e) => setStep2((s) => ({ ...s, ownerEmail: e.target.value }))}
                placeholder="owner@email.com"
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-sub focus:outline-none focus:border-border-hover"
              />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">
                Nombre <span className="text-sub">(solo si es cuenta nueva)</span>
              </label>
              <input
                type="text"
                value={step2.ownerName}
                onChange={(e) => setStep2((s) => ({ ...s, ownerName: e.target.value }))}
                placeholder="Jorge Martínez"
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-sub focus:outline-none focus:border-border-hover"
              />
            </div>
          </div>
          <div
            className="text-xs rounded-lg p-3 border"
            style={{
              background: 'rgba(168,85,247,0.06)',
              borderColor: 'rgba(168,85,247,0.2)',
              color: 'rgba(168,85,247,0.9)',
            }}
          >
            Si el email no pertenece a ningún usuario registrado, se enviará un link de activación
            para crear su cuenta con rol OWNER.
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => {
                setStep(1)
                setError(null)
              }}
              className="px-4 py-2 text-sm text-muted border border-border rounded-lg hover:bg-card transition-colors"
            >
              ← Volver
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending}
              className="px-4 py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              style={{ background: '#a855f7', color: 'white' }}
            >
              {isPending ? 'Creando...' : 'Crear club'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
