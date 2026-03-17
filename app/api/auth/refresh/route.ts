/**
 * GET /api/auth/refresh?r=<returnPath>
 *
 * Token rotation endpoint. Called by proxy.ts (via redirect) when the
 * access token is expired but a refresh token cookie is present.
 *
 * Flow:
 * 1. Read padelgo_rt cookie → SHA-256 hash → DB lookup
 * 2. If invalid/expired → clear cookies + redirect to login
 * 3. If valid → rotate (revoke old, create new) → issue new access token
 * 4. Set new cookies + redirect to returnPath
 */

import { type NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import {
  generateAccessToken,
  generateRefreshTokenRaw,
  hashToken,
  REFRESH_TOKEN_EXPIRY_SECONDS,
} from '@/lib/auth'
import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
  ACCESS_COOKIE_OPTIONS,
  REFRESH_COOKIE_OPTIONS,
} from '@/lib/cookies'
import type { Role } from '@/types'

export async function GET(request: NextRequest) {
  const returnPath = request.nextUrl.searchParams.get('r') || '/'
  const safeReturn = returnPath.startsWith('/') ? returnPath : '/'

  const refreshTokenRaw = request.cookies.get(COOKIE_REFRESH_TOKEN)?.value

  if (!refreshTokenRaw) {
    console.info('[auth/refresh] No refresh token cookie — redirecting to login')
    return redirectToLogin(request, safeReturn)
  }

  const tokenHash = hashToken(refreshTokenRaw)

  // Look up the refresh token in the DB
  const stored = await prisma.refreshToken.findFirst({
    where: {
      token: tokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  })

  if (!stored) {
    console.error('[auth/refresh] Token not found or expired (hash not in DB / already revoked)')
    const response = redirectToLogin(request, safeReturn)
    response.cookies.delete(COOKIE_ACCESS_TOKEN)
    response.cookies.delete(COOKIE_REFRESH_TOKEN)
    return response
  }

  const { user } = stored

  // Banned or inactive users lose access immediately on refresh
  if (!user.isActive || user.isBanned) {
    console.info(
      `[auth/refresh] Blocking refresh for userId=${user.id} — isBanned=${user.isBanned} isActive=${user.isActive}`
    )
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    })
    const url = user.isBanned
      ? new URL('/login?banned=true', request.url)
      : new URL(`/login?r=${encodeURIComponent(safeReturn)}`, request.url)
    const response = NextResponse.redirect(url)
    response.cookies.delete(COOKIE_ACCESS_TOKEN)
    response.cookies.delete(COOKIE_REFRESH_TOKEN)
    return response
  }

  // Rotate: revoke old token + create new one
  const newRefreshRaw = generateRefreshTokenRaw()
  const newRefreshHash = hashToken(newRefreshRaw)
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000)

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: { token: newRefreshHash, userId: user.id, expiresAt },
    }),
  ])

  console.info(
    `[auth/refresh] Rotated token for userId=${user.id} role=${user.role} — returnPath=${safeReturn}`
  )

  const newAccessToken = await generateAccessToken({
    userId: user.id,
    role: user.role as Role,
    isBanned: user.isBanned,
    staffClubId: user.staffClubId,
  })

  const response = NextResponse.redirect(new URL(safeReturn, request.url))
  response.cookies.set(COOKIE_ACCESS_TOKEN, newAccessToken, ACCESS_COOKIE_OPTIONS)
  response.cookies.set(COOKIE_REFRESH_TOKEN, newRefreshRaw, REFRESH_COOKIE_OPTIONS)
  return response
}

function redirectToLogin(request: NextRequest, returnPath: string): NextResponse {
  const url = new URL('/login', request.url)
  if (returnPath !== '/login') {
    url.searchParams.set('r', returnPath)
  }
  return NextResponse.redirect(url)
}
