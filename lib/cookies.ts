/**
 * lib/cookies.ts — Cookie name constants and configuration.
 * Zero imports from Next.js. C-01 compliant.
 *
 * Actual cookie reading/writing happens in:
 * - actions/auth.ts (cookies() from next/headers)
 * - proxy.ts / middleware.ts (NextRequest / NextResponse)
 */

export const COOKIE_ACCESS_TOKEN = 'padelgo_at'
export const COOKIE_REFRESH_TOKEN = 'padelgo_rt'

export const ACCESS_TOKEN_MAX_AGE = 15 * 60 // 15 minutes in seconds
export const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 // 7 days in seconds

/** Shared cookie security flags (used when setting cookies) */
export const COOKIE_BASE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
} as const

export const ACCESS_COOKIE_OPTIONS = {
  ...COOKIE_BASE_OPTIONS,
  maxAge: ACCESS_TOKEN_MAX_AGE,
} as const

export const REFRESH_COOKIE_OPTIONS = {
  ...COOKIE_BASE_OPTIONS,
  maxAge: REFRESH_TOKEN_MAX_AGE,
} as const
