import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { hashToken } from '@/lib/auth'
import { argToday } from '@/lib/date'
import InvitacionForm from './InvitacionForm'
import { acceptStaffInvitation } from '@/actions/owner/staff'

interface Props {
  params: Promise<{ token: string }>
}

export default async function InvitacionPage({ params }: Props) {
  const { token } = await params

  if (!token) redirect('/login')

  // Hash the token to look it up
  const tokenHash = hashToken(token)

  const invitation = await prisma.invitation.findUnique({
    where: { token: tokenHash },
    include: { club: { select: { name: true, zone: true } } },
  })

  // Token not found
  if (!invitation) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-card border border-border rounded-2xl p-6 text-center">
          <p className="text-3xl mb-3">🔒</p>
          <h1 className="font-display text-2xl text-text mb-2 uppercase tracking-wide">
            Invitación inválida
          </h1>
          <p className="text-sm text-muted">Este link de invitación no existe o ya fue usado.</p>
        </div>
      </div>
    )
  }

  // Already accepted
  if (invitation.acceptedAt) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-card border border-border rounded-2xl p-6 text-center">
          <p className="text-3xl mb-3">✅</p>
          <h1 className="font-display text-2xl text-text mb-2 uppercase tracking-wide">
            Invitación ya usada
          </h1>
          <p className="text-sm text-muted mb-4">
            Esta invitación ya fue aceptada. Si tenés una cuenta, podés iniciar sesión.
          </p>
          <a
            href="/login"
            className="block w-full py-2.5 bg-accent text-accent-text font-semibold rounded-xl text-center hover:bg-accent-dark transition-colors"
          >
            Ir al login
          </a>
        </div>
      </div>
    )
  }

  // Expired
  if (invitation.expiresAt < argToday()) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-card border border-border rounded-2xl p-6 text-center">
          <p className="text-3xl mb-3">⏰</p>
          <h1 className="font-display text-2xl text-text mb-2 uppercase tracking-wide">
            Invitación expirada
          </h1>
          <p className="text-sm text-muted">
            Este link venció hace más de 48 horas. Pedile al dueño del club que te reenvíe la
            invitación.
          </p>
        </div>
      </div>
    )
  }

  // Check if a user account already exists for this email (CASO A vs CASO B)
  const existingUser = await prisma.user.findUnique({
    where: { email: invitation.email },
    select: { name: true },
  })

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="max-w-sm w-full">
        {/* Brand header */}
        <div className="text-center mb-6">
          <h1 className="font-display text-4xl text-accent tracking-widest uppercase mb-1">
            PadelGo
          </h1>
          <p className="text-sm text-muted">Panel de administración</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="mb-5">
            <p className="text-xs text-muted uppercase tracking-wide mb-1">Invitación para</p>
            <h2 className="font-semibold text-text text-lg">{invitation.club.name}</h2>
            <p className="text-xs text-muted">{invitation.club.zone}</p>
          </div>

          <div className="bg-accent/5 border border-accent/20 rounded-xl p-3 mb-5">
            <p className="text-xs text-accent">
              <span className="font-semibold">Email:</span> {invitation.email}
            </p>
            <p className="text-xs text-muted mt-0.5">
              Válida hasta:{' '}
              {invitation.expiresAt.toLocaleDateString('es-AR', {
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>

          <InvitacionForm
            token={token}
            existingUser={existingUser}
            acceptInvitationAction={acceptStaffInvitation}
          />
        </div>
      </div>
    </div>
  )
}
