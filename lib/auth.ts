/**
 * lib/auth.ts — Pure JWT + crypto functions. Zero imports from Next.js.
 * Following C-01: this module must be framework-agnostic.
 *
 * Cookie reading / session extraction lives in actions/auth.ts (boundary layer).
 */

import { SignJWT, jwtVerify } from 'jose'
import { createHash, randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import type { JwtSession, Role } from '@/types'

// ── CONSTANTS ────────────────────────────────────────────────────────────

export const ACCESS_TOKEN_EXPIRY = '15m'
export const REFRESH_TOKEN_EXPIRY = '7d'
export const REFRESH_TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60
export const BCRYPT_ROUNDS = 12

function getJwtSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET env variable is not set')
  return new TextEncoder().encode(secret)
}

// ── ACCESS TOKEN (JWT) ────────────────────────────────────────────────────

export interface AccessTokenPayload {
  userId: string
  role: Role
  isBanned: boolean
  staffClubId?: string | null
}

/** Generate a signed JWT access token (15 min) */
export async function generateAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(getJwtSecret())
}

/**
 * Verify and decode an access token.
 * Returns null if invalid or expired — never throws.
 */
export async function verifyAccessToken(token: string): Promise<JwtSession | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    return payload as unknown as JwtSession
  } catch {
    return null
  }
}

// ── REFRESH TOKEN (random opaque token, SHA-256 hashed in DB) ─────────────

/** Generate a cryptographically random refresh token (hex string, 64 chars) */
export function generateRefreshTokenRaw(): string {
  return randomBytes(32).toString('hex')
}

/** SHA-256 hash of a token string — stored in DB, never the raw token */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// ── PASSWORD HELPERS ───────────────────────────────────────────────────────

/** Hash a password with bcrypt cost 12 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

/** Compare a plaintext password against a bcrypt hash */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// ── AVATAR COLOR ────────────────────────────────────────────────────────────

const AVATAR_PALETTE = [
  '#d4f000',
  '#f59e0b',
  '#ec4899',
  '#22c55e',
  '#06b6d4',
  '#8b5cf6',
  '#f97316',
  '#14b8a6',
  '#a855f7',
  '#3b82f6',
  '#ef4444',
  '#84cc16',
]

/** Deterministic avatar color based on name hash */
export function generateAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]
}
