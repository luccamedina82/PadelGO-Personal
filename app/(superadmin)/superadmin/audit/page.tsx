import { requireSuperAdmin } from '@/actions/auth'
import prisma from '@/lib/prisma'
import type { AuditAction } from '@/app/generated/prisma/client'
import Link from 'next/link'

const ACTION_LABELS: Record<string, string> = {
  CREATE_CLUB: 'Club creado',
  UPDATE_CLUB: 'Club actualizado',
  ACTIVATE_CLUB: 'Club activado',
  DEACTIVATE_CLUB: 'Club desactivado',
  CREATE_COURT: 'Cancha creada',
  UPDATE_COURT: 'Cancha actualizada',
  CANCEL_BOOKING: 'Reserva cancelada',
  DEACTIVATE_USER: 'Usuario desactivado',
  ACTIVATE_USER: 'Usuario activado',
  BAN_USER: 'Usuario baneado',
  UNBAN_USER: 'Ban levantado',
  RESET_USER_PASSWORD: 'Password reseteado',
  UPDATE_CLUB_AVAILABILITY: 'Horarios actualizados',
  INVITE_STAFF: 'Staff invitado',
  REMOVE_STAFF: 'Staff removido',
  CREATE_MANUAL_BOOKING: 'Reserva manual creada',
}

function actionColor(action: string) {
  if (['CREATE_CLUB', 'ACTIVATE_CLUB', 'ACTIVATE_USER', 'UNBAN_USER'].includes(action))
    return 'text-green-400 bg-green-400/10'
  if (['BAN_USER', 'DEACTIVATE_CLUB'].includes(action)) return 'text-red-400 bg-red-400/10'
  if (['DEACTIVATE_USER', 'REMOVE_STAFF', 'CANCEL_BOOKING'].includes(action))
    return 'text-orange-400 bg-orange-400/10'
  if (['INVITE_STAFF'].includes(action)) return 'text-purple-400 bg-purple-400/10'
  return 'text-blue-400 bg-blue-400/10'
}

function entityIcon(entityType: string) {
  switch (entityType) {
    case 'Club':
      return '🏢'
    case 'User':
      return '👤'
    case 'Booking':
      return '📅'
    case 'Court':
      return '🎾'
    default:
      return '•'
  }
}

interface Props {
  searchParams: Promise<{
    action?: string
    entityType?: string
    page?: string
  }>
}

const PAGE_SIZE = 50

export default async function SuperadminAuditPage({ searchParams }: Props) {
  await requireSuperAdmin()

  const { action, entityType, page: pageStr } = await searchParams
  const page = Math.max(0, parseInt(pageStr ?? '0', 10))

  const actionFilter = action && action !== 'ALL' ? (action as AuditAction) : undefined
  const entityFilter = entityType && entityType !== 'ALL' ? entityType : undefined

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        ...(actionFilter ? { action: actionFilter } : {}),
        ...(entityFilter ? { entityType: entityFilter } : {}),
      },
      include: {
        actor: { select: { id: true, name: true, avatarColor: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip: page * PAGE_SIZE,
    }),
    prisma.auditLog.count({
      where: {
        ...(actionFilter ? { action: actionFilter } : {}),
        ...(entityFilter ? { entityType: entityFilter } : {}),
      },
    }),
  ])

  // Distinct entities for filters
  const distinctEntityTypes = await prisma.auditLog.findMany({
    distinct: ['entityType'],
    select: { entityType: true },
    orderBy: { entityType: 'asc' },
  })

  const totalPages = Math.ceil(total / PAGE_SIZE)

  function buildHref(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams()
    const merged = { action, entityType, page: '0', ...overrides }
    if (merged.action && merged.action !== 'ALL') params.set('action', merged.action)
    if (merged.entityType && merged.entityType !== 'ALL')
      params.set('entityType', merged.entityType)
    if (merged.page && merged.page !== '0') params.set('page', merged.page)
    const qs = params.toString()
    return `/superadmin/audit${qs ? `?${qs}` : ''}`
  }

  function relativeTime(date: Date): string {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'Ahora'
    if (minutes < 60) return `Hace ${minutes}m`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `Hace ${hours}h`
    return new Date(date).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
    })
  }

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-5xl mx-auto" style={{ background: '#0a0810' }}>
      {/* Header */}
      <div className="mb-5">
        <h1 className="font-display text-3xl tracking-wide uppercase" style={{ color: '#a855f7' }}>
          Auditoría
        </h1>
        <p className="text-sm text-muted mt-0.5">Log inmutable de todas las acciones del sistema</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        {/* Entity Type filter */}
        <div className="flex gap-1">
          {['ALL', ...distinctEntityTypes.map((e) => e.entityType)].map((et) => (
            <Link
              key={et}
              href={buildHref({ entityType: et })}
              className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
                (entityType ?? 'ALL') === et
                  ? 'font-medium'
                  : 'border-border text-muted hover:text-text hover:bg-card'
              }`}
              style={
                (entityType ?? 'ALL') === et
                  ? {
                      borderColor: 'rgba(168,85,247,0.4)',
                      color: '#a855f7',
                      background: 'rgba(168,85,247,0.1)',
                    }
                  : {}
              }
            >
              {et === 'ALL' ? 'Todo' : et}
            </Link>
          ))}
        </div>

        {/* Action filter */}
        <div className="flex gap-1 flex-wrap">
          {['ALL', ...Object.keys(ACTION_LABELS)].map((a) => (
            <Link
              key={a}
              href={buildHref({ action: a })}
              className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
                (action ?? 'ALL') === a
                  ? 'font-medium'
                  : 'border-border text-muted hover:text-text hover:bg-card'
              }`}
              style={
                (action ?? 'ALL') === a
                  ? {
                      borderColor: 'rgba(168,85,247,0.4)',
                      color: '#a855f7',
                      background: 'rgba(168,85,247,0.1)',
                    }
                  : {}
              }
            >
              {a === 'ALL' ? 'Todas las acciones' : (ACTION_LABELS[a] ?? a)}
            </Link>
          ))}
        </div>
      </div>

      {/* Result count */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted">
          {total} entrada{total !== 1 ? 's' : ''}
        </p>
        {totalPages > 1 && (
          <p className="text-xs text-muted">
            Página {page + 1} de {totalPages}
          </p>
        )}
      </div>

      {/* Log table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-muted text-sm">Sin entradas para estos filtros</div>
        ) : (
          <div className="divide-y divide-border">
            {logs.map((log) => {
              const color = actionColor(log.action)
              const meta = log.metadata as Record<string, unknown> | null
              return (
                <div key={log.id} className="flex items-start gap-3 px-4 py-3">
                  {/* Time */}
                  <div className="w-16 shrink-0 text-right">
                    <p className="text-xs text-muted">{relativeTime(log.createdAt)}</p>
                    <p className="text-[10px] text-sub">
                      {new Date(log.createdAt).toLocaleTimeString('es-AR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>

                  {/* Actor avatar */}
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                    style={{
                      backgroundColor: log.actor.avatarColor + '33',
                      color: log.actor.avatarColor,
                    }}
                  >
                    {log.actor.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-text font-medium">{log.actor.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${color}`}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </span>
                      <span className="text-xs text-muted">
                        {entityIcon(log.entityType)} {log.entityType}
                      </span>
                      <span className="text-xs text-sub font-mono">#{log.entityId.slice(-8)}</span>
                    </div>
                    {meta && Object.keys(meta).length > 0 && (
                      <p className="text-xs text-sub mt-0.5">
                        {Object.entries(meta)
                          .slice(0, 3)
                          .map(([k, v]) => `${k}: ${String(v)}`)
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {page > 0 && (
            <Link
              href={buildHref({ page: String(page - 1) })}
              className="px-4 py-2 text-sm border border-border rounded-lg text-muted hover:text-text hover:bg-card transition-colors"
            >
              ← Anterior
            </Link>
          )}
          <span className="text-sm text-muted px-3">
            {page + 1} / {totalPages}
          </span>
          {page < totalPages - 1 && (
            <Link
              href={buildHref({ page: String(page + 1) })}
              className="px-4 py-2 text-sm border border-border rounded-lg text-muted hover:text-text hover:bg-card transition-colors"
            >
              Siguiente →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
