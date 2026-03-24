'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { requestPasswordReset } from '@/features/auth/actions/passwordReset'
import type { ActionResult } from '@/types'
import Button from '@/components/ui/Button'

type State = ActionResult | null

export default function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState<State, FormData>(
    requestPasswordReset,
    null
  )

  if (state?.success) {
    return (
      <div className="space-y-4 text-center">
        <div className="rounded-lg bg-green-500/10 border border-green-500/30 px-4 py-4 text-sm text-green-400">
          Si ese email está registrado, te enviamos las instrucciones para restablecer tu
          contraseña. Revisá tu bandeja de entrada (y spam).
        </div>
        <Link
          href="/login"
          className="block text-sm text-muted hover:text-text transition-colors"
        >
          ← Volver al login
        </Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.success && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
          {state.error}
        </div>
      )}

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
          disabled={isPending}
          placeholder="tu@email.com"
          className="w-full px-3.5 py-2.5 rounded-lg bg-card border border-border focus:border-accent focus:outline-none text-sm text-text placeholder:text-sub transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </div>

      <Button type="submit" loading={isPending} className="w-full" aria-busy={isPending}>
        {isPending ? 'Enviando...' : 'Enviar instrucciones'}
      </Button>

      <p className="text-center text-sm text-muted">
        <Link href="/login" className="text-accent hover:text-accent-dark transition-colors">
          ← Volver al login
        </Link>
      </p>
    </form>
  )
}
