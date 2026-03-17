'use client'

import { useActionState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { register } from '@/actions/auth'
import type { ActionResult } from '@/types'

type RegisterState = ActionResult<{ redirectTo: string }> | null

const initialState: RegisterState = null

// Buenos Aires zones matching seed data zones
const ZONES = [
  'Palermo',
  'Belgrano',
  'San Isidro',
  'Núñez',
  'Villa Urquiza',
  'Caballito',
  'Recoleta',
  'Villa Crespo',
  'Almagro',
  'Tigre',
  'San Martín',
  'Otro',
]

async function registerAction(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const zone = formData.get('zone') as string
  return register({ name, email, password, zone })
}

export default function RegisterForm() {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(registerAction, initialState)
  const [, startTransition] = useTransition()

  useEffect(() => {
    if (state?.success && state.data?.redirectTo) {
      startTransition(() => {
        router.push(state.data!.redirectTo)
      })
    }
  }, [state, router])

  return (
    <form action={formAction} className="space-y-4">
      {/* Error */}
      {state && !state.success && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
          {state.error}
        </div>
      )}

      {/* Name */}
      <div className="space-y-1.5">
        <label htmlFor="name" className="block text-sm font-medium text-muted">
          Nombre completo
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          placeholder="Juan García"
          className="w-full px-3.5 py-2.5 rounded-lg bg-card border border-border focus:border-accent focus:outline-none text-sm text-text placeholder:text-sub transition-colors"
        />
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium text-muted">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="tu@email.com"
          className="w-full px-3.5 py-2.5 rounded-lg bg-card border border-border focus:border-accent focus:outline-none text-sm text-text placeholder:text-sub transition-colors"
        />
      </div>

      {/* Zone */}
      <div className="space-y-1.5">
        <label htmlFor="zone" className="block text-sm font-medium text-muted">
          Zona
        </label>
        <select
          id="zone"
          name="zone"
          required
          defaultValue=""
          className="w-full px-3.5 py-2.5 rounded-lg bg-card border border-border focus:border-accent focus:outline-none text-sm text-text transition-colors appearance-none"
        >
          <option value="" disabled>
            Seleccioná tu zona
          </option>
          {ZONES.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-medium text-muted">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="Mínimo 8 caracteres"
          className="w-full px-3.5 py-2.5 rounded-lg bg-card border border-border focus:border-accent focus:outline-none text-sm text-text placeholder:text-sub transition-colors"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full py-2.5 rounded-lg bg-accent text-accent-text font-semibold text-sm hover:bg-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? 'Creando cuenta...' : 'Crear cuenta gratis'}
      </button>

      {/* Terms note */}
      <p className="text-center text-xs text-sub">
        Al registrarte aceptás los términos de uso de PadelGo.
      </p>

      {/* Login link */}
      <p className="text-center text-sm text-muted">
        ¿Ya tenés cuenta?{' '}
        <Link
          href="/login"
          className="text-accent hover:text-accent-dark transition-colors font-medium"
        >
          Ingresá
        </Link>
      </p>
    </form>
  )
}
