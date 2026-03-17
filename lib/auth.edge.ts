/**
 * lib/auth.edge.ts — Edge Runtime compatible subset of lib/auth.ts.
 * Uses ONLY `jose` (Web Crypto API internally). Zero Node.js-specific imports.
 *
 * Used exclusively by middleware.ts (Edge runtime).
 * For Server Actions and API routes, import from lib/auth.ts instead.
 */

import { jwtVerify } from 'jose'
import type { JwtSession } from '@/types'

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET env variable is not set')
  return new TextEncoder().encode(secret)
}

/**
 * Verify and decode a JWT access token.
 * Returns null if invalid or expired — never throws.
 * Edge-runtime safe.
 */
export async function verifyAccessTokenEdge(token: string): Promise<JwtSession | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    return payload as unknown as JwtSession
  } catch {
    return null
  }
}
