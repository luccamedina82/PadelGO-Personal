import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import { hashToken } from '@/lib/auth'
import ResetPasswordForm from '@/features/auth/components/ResetPasswordForm'
import { connection } from 'next/server'
import Skeleton from '@/components/ui/skeleton'

export const metadata: Metadata = {
  title: 'Nueva contraseña — PadelGo',
}

interface Props {
  params: Promise<{ token: string }>
}

async function TokenContent({ paramsPromise }: { paramsPromise: Promise<{ token: string }> }) {
  await connection()

  const { token } = await paramsPromise
  const tokenHash = hashToken(token)
  const invitation = await prisma.invitation.findUnique({
    where: { token: tokenHash },
  })

  let errorMessage: string | null = null
  if (!invitation) {
    errorMessage = 'El link es inválido.'
  } else if (invitation.expiresAt < new Date()) {
    errorMessage = 'El link expiró.'
  } else if (invitation.acceptedAt !== null) {
    errorMessage = 'Este link ya fue usado.'
  }

  if (errorMessage) {
    return (
      <div className="space-y-4 text-center">
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-4 text-sm text-red-400">
          {errorMessage}
        </div>
        <p className="text-sm text-muted">
          Si necesitás un link nuevo,{' '}
          <Link
            href="/forgot-password"
            className="text-accent hover:text-accent-dark transition-colors"
          >
            solicitá otro acá
          </Link>
          .
        </p>
      </div>
    )
  }

  return <ResetPasswordForm token={token} />
}

export default function ResetPasswordPage({ params }: Props) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center">
          <Link href="/">
            <span className="font-display text-4xl tracking-widest text-accent">PADELGO</span>
          </Link>
          <p className="mt-2 text-sm text-muted">Creá tu nueva contraseña</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
          <Suspense fallback={<Skeleton className="h-40 w-full" />}>
            <TokenContent paramsPromise={params} />
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
