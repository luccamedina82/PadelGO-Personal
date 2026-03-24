import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import ForgotPasswordForm from '@/features/auth/components/ForgotPasswordForm'
import Skeleton from '@/components/ui/Skeleton'

export const metadata: Metadata = {
  title: 'Recuperar contraseña — PadelGo',
}

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center">
          <Link href="/">
            <span className="font-display text-4xl tracking-widest text-accent">PADELGO</span>
          </Link>
          <p className="mt-2 text-sm text-muted">Ingresá tu email para recuperar tu acceso</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
          <h2 className="text-base font-semibold text-text mb-4">¿Olvidaste tu contraseña?</h2>
          <Suspense
            fallback={
              <div className="space-y-4" aria-busy="true">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            }
          >
            <ForgotPasswordForm />
          </Suspense>
        </div>

        <p className="text-center text-xs text-sub">
          <Link href="/" className="hover:text-muted transition-colors">
            ← Volver al inicio
          </Link>
        </p>
      </div>
    </div>
  )
}
