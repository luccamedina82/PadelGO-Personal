import { requireSuperAdmin } from '@/actions/auth'
import prisma from '@/lib/prisma'
import Link from 'next/link'

interface Props {
  searchParams: Promise<{ q?: string; filter?: string }>
}

export default async function SuperadminUsersPage({ searchParams }: Props) {
  await requireSuperAdmin()

  const { q, filter } = await searchParams

  const where = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
            { zone: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(filter === 'banned' ? { isBanned: true } : {}),
    ...(filter === 'inactive' ? { isActive: false } : {}),
    ...(filter === 'player' ? { role: 'PLAYER' as const } : {}),
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      zone: true,
      level: true,
      role: true,
      isActive: true,
      isBanned: true,
      avatarColor: true,
      _count: { select: { bookings: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 80,
  })

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-6xl mx-auto" style={{ background: '#0a0810' }}>
      {/* Header */}
      <div className="mb-5">
        <h1 className="font-display text-3xl tracking-wide uppercase" style={{ color: '#a855f7' }}>
          Usuarios
        </h1>
        <p className="text-sm text-muted mt-0.5">Soporte y gestión de cuentas</p>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <form className="flex-1">
          <input
            name="q"
            defaultValue={q}
            type="search"
            placeholder="Buscar por nombre, email o zona..."
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-sub focus:outline-none focus:border-border-hover"
          />
        </form>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'player', 'banned', 'inactive'] as const).map((f) => (
            <Link
              key={f}
              href={`/superadmin/users${f !== 'all' ? `?filter=${f}` : ''}${q ? `${f !== 'all' ? '&' : '?'}q=${q}` : ''}`}
              className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                (filter ?? 'all') === f
                  ? 'border-[#a855f7] bg-[#a855f7]/10 font-medium'
                  : 'border-border text-muted hover:text-text hover:bg-card'
              }`}
              style={(filter ?? 'all') === f ? { color: '#a855f7' } : {}}
            >
              {f === 'all'
                ? 'Todos'
                : f === 'player'
                  ? 'Players'
                  : f === 'banned'
                    ? 'Baneados'
                    : 'Inactivos'}
            </Link>
          ))}
        </div>
      </div>

      {/* User list */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-xs text-muted">
            {users.length} usuario{users.length !== 1 ? 's' : ''}
          </p>
        </div>
        {users.length === 0 ? (
          <div className="p-8 text-center text-muted text-sm">No se encontraron usuarios</div>
        ) : (
          <div className="divide-y divide-border">
            {users.map((user) => (
              <Link
                key={user.id}
                href={`/superadmin/users/${user.id}`}
                className="flex items-center gap-4 px-4 py-3 hover:bg-card-hover transition-colors group"
              >
                {/* Avatar */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ backgroundColor: user.avatarColor + '33', color: user.avatarColor }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm text-text truncate">{user.name}</p>
                    {user.isBanned && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-red-400 bg-red-400/10 shrink-0">
                        BAN
                      </span>
                    )}
                    {!user.isActive && !user.isBanned && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-muted bg-muted/10 shrink-0">
                        INACTIVO
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted truncate">{user.email}</p>
                </div>

                {/* Meta */}
                <div className="hidden md:flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <p className="text-xs text-muted">{user.zone}</p>
                    <p className="text-xs text-sub">{user.role}</p>
                  </div>
                  <div className="text-right w-16">
                    <p className="text-xs font-mono text-text">Nv. {user.level.toFixed(1)}</p>
                    <p className="text-xs text-sub">{user._count.bookings} res.</p>
                  </div>
                </div>

                <span className="text-xs text-muted group-hover:text-text transition-colors">
                  →
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
