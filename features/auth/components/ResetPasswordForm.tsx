'use client'

import { useActionState, useTransition } from 'react'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { resetPassword } from '@/features/auth/actions/passwordReset'
import type { ActionResult } from '@/types'
import Button from '@/components/ui/Button'

type State = ActionResult | null

interface ResetPasswordFormProps {
  token: string
}

export default function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState<State, FormData>(resetPassword, null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    if (state?.success) {
      startTransition(() => {
        router.push('/login?reset=true')
      })
    }
  }, [state, router])

  return (
    <form action={formAction} className="space-y-4">
      {/* Hidden token field */}
      <input type="hidden" name="token" value={token} />

      {state && !state.success && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
          {state.error}
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-medium text-muted">
          Nueva contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          disabled={isPending}
          placeholder="Mínimo 6 caracteres"
          className="w-full px-3.5 py-2.5 rounded-lg bg-card border border-border focus:border-accent focus:outline-none text-sm text-text placeholder:text-sub transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-muted">
          Confirmar contraseña
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          disabled={isPending}
          placeholder="Repetí la contraseña"
          className="w-full px-3.5 py-2.5 rounded-lg bg-card border border-border focus:border-accent focus:outline-none text-sm text-text placeholder:text-sub transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </div>

      <Button type="submit" loading={isPending} className="w-full" aria-busy={isPending}>
        {isPending ? 'Guardando...' : 'Crear nueva contraseña'}
      </Button>

      <p className="text-center text-sm text-muted">
        <Link href="/login" className="text-accent hover:text-accent-dark transition-colors">
          ← Volver al login
        </Link>
      </p>
    </form>
  )
}
