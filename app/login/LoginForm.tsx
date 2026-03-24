'use client'

import { useActionState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { login } from '@/actions/auth'
import type { ActionResult } from '@/types'
import Button from '@/components/ui/Button'

type LoginState = ActionResult<{ redirectTo: string }> | null

const initialState: LoginState = null

async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  return login({ email, password })
}

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnPath = searchParams.get('r') || '/'
  const isBanned = searchParams.get('banned') === 'true'

  const [state, formAction, isPending] = useActionState(loginAction, initialState)
  const [, startTransition] = useTransition()

  // Redirect on success
  useEffect(() => {
    if (state?.success && state.data?.redirectTo) {
      startTransition(() => {
        router.push(state.data!.redirectTo)
      })
    }
  }, [state, router, returnPath])

  return (
    <form action={formAction} className="space-y-4">
      {/* Ban message */}
      {isBanned && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
          Tu cuenta fue suspendida. Contactá a soporte.
        </div>
      )}

      {/* Error message */}
      {state && !state.success && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
          {state.error}
        </div>
      )}

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
          disabled={isPending}
          placeholder="tu@email.com"
          className="w-full px-3.5 py-2.5 rounded-lg bg-card border border-border focus:border-accent focus:outline-none text-sm text-text placeholder:text-sub transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        />
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
          autoComplete="current-password"
          required
          disabled={isPending}
          placeholder="••••••••"
          className="w-full px-3.5 py-2.5 rounded-lg bg-card border border-border focus:border-accent focus:outline-none text-sm text-text placeholder:text-sub transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </div>

      {/* Submit */}
      <Button type="submit" loading={isPending} className="w-full" aria-busy={isPending}>
        {isPending ? 'Ingresando...' : 'Ingresar'}
      </Button>

      {/* Forgot password */}
      <p className="text-center text-sm text-muted">
        <Link
          href="/forgot-password"
          className="text-muted hover:text-text transition-colors"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </p>

      {/* Register link */}
      <p className="text-center text-sm text-muted">
        ¿No tenés cuenta?{' '}
        <Link
          href="/registro"
          className="text-accent hover:text-accent-dark transition-colors font-medium"
        >
          Registrate gratis
        </Link>
      </p>
    </form>
  )
}
