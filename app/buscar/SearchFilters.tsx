'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

const ZONES = [
  'Nueva Córdoba',
  'Güemes',
  'Cerro de las Rosas',
  'General Paz',
  'Urca',
  'Alberdi',
  'Villa Cabrera',
  'Barrio Jardín',
  'Centro',
]

interface FilterParams {
  zona?: string
  q?: string
  techado?: string
  premium?: string
}

export default function SearchFilters({ initialParams }: { initialParams: FilterParams }) {
  const router = useRouter()

  const updateParams = useCallback(
    (updates: Partial<FilterParams>) => {
      const next = { ...initialParams, ...updates }
      const params = new URLSearchParams()
      Object.entries(next).forEach(([k, v]) => {
        if (v) params.set(k, v)
      })
      const qs = params.toString()
      router.push(qs ? `/buscar?${qs}` : '/buscar')
    },
    [initialParams, router]
  )

  const toggle = (key: 'techado' | 'premium') => {
    updateParams({ [key]: initialParams[key] === '1' ? undefined : '1' })
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* Zone */}
      <select
        value={initialParams.zona ?? ''}
        onChange={(e) => updateParams({ zona: e.target.value || undefined })}
        className="px-3 py-2 rounded-lg bg-card border border-border text-sm text-text focus:border-accent focus:outline-none appearance-none cursor-pointer"
      >
        <option value="">Todas las zonas</option>
        {ZONES.map((z) => (
          <option key={z} value={z}>
            {z}
          </option>
        ))}
      </select>

      {/* Query */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const q = (e.currentTarget.elements.namedItem('q') as HTMLInputElement).value
          updateParams({ q: q || undefined })
        }}
        className="flex"
      >
        <input
          name="q"
          type="search"
          placeholder="Nombre del club..."
          defaultValue={initialParams.q ?? ''}
          className="px-3 py-2 rounded-lg bg-card border border-border text-sm text-text focus:border-accent focus:outline-none placeholder:text-sub w-44"
        />
      </form>

      {/* Techado toggle */}
      <button
        onClick={() => toggle('techado')}
        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
          initialParams.techado === '1'
            ? 'bg-accent text-accent-text border-accent'
            : 'bg-card border-border text-muted hover:text-text hover:border-border-hover'
        }`}
      >
        Techado
      </button>

      {/* Premium toggle */}
      <button
        onClick={() => toggle('premium')}
        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
          initialParams.premium === '1'
            ? 'bg-accent text-accent-text border-accent'
            : 'bg-card border-border text-muted hover:text-text hover:border-border-hover'
        }`}
      >
        Premium
      </button>

      {/* Clear */}
      {(initialParams.zona ||
        initialParams.q ||
        initialParams.techado ||
        initialParams.premium) && (
        <button
          onClick={() => router.push('/buscar')}
          className="px-3 py-2 rounded-lg text-sm text-sub hover:text-text transition-colors"
        >
          Limpiar
        </button>
      )}
    </div>
  )
}
