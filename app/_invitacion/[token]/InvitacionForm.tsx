'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ActionResult } from '@/types'

interface InvitacionFormProps {
  token: string
  /** Non-null when the invited email already has a PadelGo account (CASO A) */
  existingUser: { name: string } | null
  acceptInvitationAction: (input: {
    token: string
    name?: string
    password: string
  }) => Promise<ActionResult<{ redirectTo: string }>>
}

export default function InvitacionForm({
  token,
  existingUser,
  acceptInvitationAction,
}: InvitacionFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)

  const isCasoA = existingUser !== null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (isCasoA) {
      // CASO A — verify existing account
      if (!password) {
        setError('Ingresá tu contraseña actual.')
        return
      }
      startTransition(async () => {
        const result = await acceptInvitationAction({ token, password })
        if (result.success) {
          router.push(result.data?.redirectTo ?? '/login')
        } else {
          setError(result.error ?? 'Error al aceptar la invitación.')
        }
      })
    } else {
      // CASO B — create new account
      if (!name.trim()) {
        setError('El nombre es obligatorio.')
        return
      }
      if (password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres.')
        return
      }
      if (password !== confirm) {
        setError('Las contraseñas no coinciden.')
        return
      }
      startTransition(async () => {
        const result = await acceptInvitationAction({ token, name: name.trim(), password })
        if (result.success) {
          router.push(result.data?.redirectTo ?? '/login')
        } else {
          setError(result.error ?? 'Error al activar la cuenta.')
        }
      })
    }
  }

  // ── CASO A — existing account ──────────────────────────────────────────────
  if (isCasoA) {
    return (
      <form onSubmit={handleSubmit} className="space-y-3">
        <h3 className="font-semibold text-sm text-text">Verificá tu identidad</h3>

        {/* Existing account banner */}
        <div className="bg-surface border border-border rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
            <span className="text-accent text-sm font-bold">
              {existingUser.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted">Encontramos tu cuenta PadelGo</p>
            <p className="font-semibold text-sm text-text truncate">{existingUser.name}</p>
          </div>
        </div>

        <p className="text-xs text-muted leading-relaxed">
          Ingresá tu contraseña actual para vincular tu cuenta con este club. Tu contraseña{' '}
          <strong className="text-text">no será modificada</strong>.
        </p>

        <div>
          <label className="text-xs text-muted block mb-1">Tu contraseña actual</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder:text-sub focus:outline-none focus:border-accent"
            required
          />
        </div>

        {error && (
          <div className="bg-red-400/10 border border-red-400/30 rounded-lg p-2.5">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full py-3 bg-accent text-accent-text font-semibold rounded-xl hover:bg-accent-dark transition-colors disabled:opacity-50 mt-1"
        >
          {isPending ? 'Verificando...' : 'Aceptar invitación'}
        </button>
      </form>
    )
  }

  // ── CASO B — new account ───────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="font-semibold text-sm text-text">Crear tu cuenta</h3>

      <div>
        <label className="text-xs text-muted block mb-1">Tu nombre</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre y apellido"
          autoComplete="name"
          className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder:text-sub focus:outline-none focus:border-accent"
          required
        />
      </div>

      <div>
        <label className="text-xs text-muted block mb-1">Contraseña</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 6 caracteres"
          autoComplete="new-password"
          className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder:text-sub focus:outline-none focus:border-accent"
          required
        />
      </div>

      <div>
        <label className="text-xs text-muted block mb-1">Confirmar contraseña</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repetí la contraseña"
          autoComplete="new-password"
          className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder:text-sub focus:outline-none focus:border-accent"
          required
        />
      </div>

      {error && (
        <div className="bg-red-400/10 border border-red-400/30 rounded-lg p-2.5">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-3 bg-accent text-accent-text font-semibold rounded-xl hover:bg-accent-dark transition-colors disabled:opacity-50 mt-1"
      >
        {isPending ? 'Activando cuenta...' : 'Activar cuenta y entrar'}
      </button>
    </form>
  )
}
