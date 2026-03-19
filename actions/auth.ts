'use server'

import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import {
  generateAccessToken,
  verifyAccessToken,
  generateRefreshTokenRaw,
  hashToken,
  hashPassword,
  verifyPassword,
  generateAvatarColor,
  REFRESH_TOKEN_EXPIRY_SECONDS,
} from '@/lib/auth'
import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
  ACCESS_COOKIE_OPTIONS,
  REFRESH_COOKIE_OPTIONS,
} from '@/lib/cookies'
import type { ActionResult, JwtSession, Role } from '@/types'

const verifyAccessTokenCached = cache(async (token: string) => verifyAccessToken(token))

const getSessionUserByIdCached = cache(async (userId: string) => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, avatarColor: true, zone: true, level: true },
  })
})

// ── SESSION HELPERS (boundary layer — uses next/headers) ─────────────────

/**
 * Read and verify the access token from cookies.
 * Returns null if not present, invalid, or expired.
 */
export async function getSession(): Promise<JwtSession | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value
  if (!token) return null
  return verifyAccessTokenCached(token)
}

export async function getSessionAndUserProfile(): Promise<{
  session: JwtSession | null
  user: { name: string; avatarColor: string; zone: string; level: number } | null
}> {
  const session = await getSession()
  if (!session) return { session: null, user: null }

  const user = (await getSessionUserByIdCached(session.userId)) ?? null
  return { session, user }
}

/**
 * Require an authenticated session. Redirects to /login if not found.
 * To be used in Server Components and Server Actions.
 */
export async function requireAuth(): Promise<JwtSession> {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}

/**
 * Require a specific role (or one of many). Redirects to / if unauthorized.
 */
export async function requireRole(roles: Role[]): Promise<JwtSession> {
  const session = await requireAuth()
  if (!roles.includes(session.role)) redirect('/')
  return session
}

/**
 * Require SUPERADMIN. Redirects to / if not authorized.
 */
export async function requireSuperAdmin(): Promise<JwtSession> {
  const session = await requireAuth()
  if (session.role !== 'SUPERADMIN') redirect('/')
  return session
}

// ── INTERNAL HELPERS ──────────────────────────────────────────────────────

async function setAuthCookies(accessToken: string, refreshToken: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_ACCESS_TOKEN, accessToken, ACCESS_COOKIE_OPTIONS)
  cookieStore.set(COOKIE_REFRESH_TOKEN, refreshToken, REFRESH_COOKIE_OPTIONS)
}

async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_ACCESS_TOKEN)
  cookieStore.delete(COOKIE_REFRESH_TOKEN)
}

// ── REGISTER ──────────────────────────────────────────────────────────────

interface RegisterInput {
  name: string
  email: string
  password: string
  zone: string
}

export async function register(
  input: RegisterInput
): Promise<ActionResult<{ redirectTo: string }>> {
  const { name, email, password, zone } = input

  // Basic validation
  if (!name?.trim() || !email?.trim() || !password || !zone?.trim()) {
    return { success: false, error: 'Todos los campos son obligatorios.' }
  }
  if (password.length < 8) {
    return { success: false, error: 'La contraseña debe tener al menos 8 caracteres.' }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: 'Email inválido.' }
  }

  // Check if email already exists
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing && !existing.isGhost) {
    return { success: false, error: 'Ya existe una cuenta con ese email.' }
  }

  const passwordHash = await hashPassword(password)
  const avatarColor = generateAvatarColor(name)
  const refreshTokenRaw = generateRefreshTokenRaw()
  const refreshTokenHash = hashToken(refreshTokenRaw)
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000)

  let user
  if (existing?.isGhost) {
    // Promote ghost account → real account
    user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: existing.id },
        data: {
          name,
          password: passwordHash,
          avatarColor,
          zone,
          isGhost: false,
        },
      })
      await tx.refreshToken.create({
        data: { token: refreshTokenHash, userId: updated.id, expiresAt },
      })
      return updated
    })
  } else {
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name,
          email,
          password: passwordHash,
          avatarColor,
          zone,
          role: 'PLAYER', // C-09: register always creates PLAYER
        },
      })
      await tx.refreshToken.create({
        data: { token: refreshTokenHash, userId: created.id, expiresAt },
      })
      return created
    })
  }

  const accessToken = await generateAccessToken({
    userId: user.id,
    role: user.role as Role,
    isBanned: user.isBanned,
    staffClubId: user.staffClubId,
  })

  await setAuthCookies(accessToken, refreshTokenRaw)
  return { success: true, data: { redirectTo: '/' } }
}

// ── LOGIN ─────────────────────────────────────────────────────────────────

interface LoginInput {
  email: string
  password: string
}

export async function login(input: LoginInput): Promise<ActionResult<{ redirectTo: string }>> {
  const { email, password } = input

  if (!email?.trim() || !password) {
    return { success: false, error: 'Email y contraseña son obligatorios.' }
  }

  const user = await prisma.user.findUnique({ where: { email } })

  if (!user || user.isGhost) {
    return { success: false, error: 'Email o contraseña incorrectos.' }
  }

  if (!user.isActive) {
    return { success: false, error: 'Tu cuenta está desactivada. Contacta soporte.' }
  }

  if (user.isBanned) {
    return {
      success: false,
      error: `Cuenta suspendida${user.bannedReason ? `: ${user.bannedReason}` : '.'}`,
    }
  }

  const passwordMatch = await verifyPassword(password, user.password)
  if (!passwordMatch) {
    return { success: false, error: 'Email o contraseña incorrectos.' }
  }

  const refreshTokenRaw = generateRefreshTokenRaw()
  const refreshTokenHash = hashToken(refreshTokenRaw)
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000)

  await prisma.refreshToken.create({
    data: { token: refreshTokenHash, userId: user.id, expiresAt },
  })

  const accessToken = await generateAccessToken({
    userId: user.id,
    role: user.role as Role,
    isBanned: user.isBanned,
    staffClubId: user.staffClubId,
  })

  await setAuthCookies(accessToken, refreshTokenRaw)

  // Role-based redirect
  const redirectMap: Record<string, string> = {
    SUPERADMIN: '/superadmin',
    OWNER: '/admin',
    STAFF: '/admin',
    PLAYER: '/',
  }
  const redirectTo = redirectMap[user.role] ?? '/'
  return { success: true, data: { redirectTo } }
}

// ── LOGOUT ────────────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
  const cookieStore = await cookies()
  const refreshTokenRaw = cookieStore.get(COOKIE_REFRESH_TOKEN)?.value

  if (refreshTokenRaw) {
    const hash = hashToken(refreshTokenRaw)
    await prisma.refreshToken
      .updateMany({
        where: { token: hash, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch(() => {}) // Non-critical
  }

  await clearAuthCookies()
  redirect('/login')
}
