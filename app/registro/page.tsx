import type { Metadata } from 'next'
import Link from 'next/link'
import RegisterForm from './RegisterForm'

export const metadata: Metadata = {
  title: 'Crear cuenta — PadelGo',
}

export default function RegistroPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center">
          <Link href="/">
            <span className="font-display text-4xl tracking-widest text-accent">PADELGO</span>
          </Link>
          <p className="mt-2 text-sm text-muted">Creá tu cuenta y empezá a jugar</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
          <RegisterForm />
        </div>

        {/* Back to home */}
        <p className="text-center text-xs text-sub">
          <Link href="/" className="hover:text-muted transition-colors">
            ← Volver al inicio
          </Link>
        </p>
      </div>
    </div>
  )
}
