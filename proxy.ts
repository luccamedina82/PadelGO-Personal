/**
 * proxy.ts — Next.js 16 proxy (replaces middleware.ts).
 *
 * Responsibilities:
 * - Protect routes requiring authentication
 * - Role-based guards for /admin/* and /superadmin/*
 * - Check isBanned from JWT claim (no DB query — C-07)
 * - Redirect expired tokens to /api/auth/refresh for token rotation
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAccessTokenEdge } from '@/lib/auth.edge'
import { COOKIE_ACCESS_TOKEN, COOKIE_REFRESH_TOKEN } from '@/lib/cookies'

// ── ROUTE CLASSIFICATION ─────────────────────────────────────────────────

/** Routes that never require authentication */
const PUBLIC_EXACT = new Set(['/', '/login', '/registro', '/buscar'])

/** Route prefixes that never require authentication */
const PUBLIC_PREFIX = [
  '/club/',
  '/api/auth/refresh',
  '/api/webhooks',
  '/_next/',
  '/favicon.ico',
  '/invitacion/',
  '/reset-password/',
]

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true
  return PUBLIC_PREFIX.some((p) => pathname.startsWith(p))
}

// ── PROXY HANDLER ────────────────────────────────────────────────────────

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // Static files and public routes — pass through immediately
  if (isPublicRoute(pathname)) return NextResponse.next()

  const accessToken = request.cookies.get(COOKIE_ACCESS_TOKEN)?.value
  const refreshToken = request.cookies.get(COOKIE_REFRESH_TOKEN)?.value

  // No access token at all
  if (!accessToken) {
    if (refreshToken) {
      // Has refresh token — try rotating before giving up
      return redirectToRefresh(request, pathname)
    }
    return redirectToLogin(request, pathname)
  }

  // Verify the access token (Edge-safe, jose only)
  const session = await verifyAccessTokenEdge(accessToken)

  if (!session) {
    // Token invalid or expired
    if (refreshToken) {
      return redirectToRefresh(request, pathname)
    }
    const response = redirectToLogin(request, pathname)
    response.cookies.delete(COOKIE_ACCESS_TOKEN)
    return response
  }


  // ── BAN CHECK via JWT claim (C-07 — zero DB query) ──────────────────
  if (session.isBanned) {
    const url = new URL('/login', request.url)
    url.searchParams.set('banned', 'true')
    const response = NextResponse.redirect(url)
    response.cookies.delete(COOKIE_ACCESS_TOKEN)
    response.cookies.delete(COOKIE_REFRESH_TOKEN)
    return response
  }

  // ── ROLE GUARDS ──────────────────────────────────────────────────────

  // /superadmin/* — SUPERADMIN only
  if (pathname.startsWith('/superadmin')) {
    if (session.role !== 'SUPERADMIN') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  // /admin/* — OWNER or STAFF only
  if (pathname.startsWith('/admin')) {
    if (session.role !== 'OWNER' && session.role !== 'STAFF') {
      return NextResponse.redirect(new URL('/', request.url))
    }
    // C-10: STAFF can only access their assigned club
    // Detailed clubId check is performed at the page/layout level (not here)
    // since we'd need DB to get the clubId from the URL
  }

  // All checks passed
  return NextResponse.next()
}

// ── HELPERS ──────────────────────────────────────────────────────────────

function redirectToLogin(request: NextRequest, returnPath: string): NextResponse {
  const url = new URL('/login', request.url)
  if (returnPath !== '/login') {
    url.searchParams.set('r', returnPath)
  }
  return NextResponse.redirect(url)
}

function redirectToRefresh(request: NextRequest, returnPath: string): NextResponse {
  const url = new URL('/api/auth/refresh', request.url)
  url.searchParams.set('r', returnPath)
  return NextResponse.redirect(url)
}

// ── NEXT.JS 16 EXPORTS ────────────────────────────────────────────────────

export default proxy

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
