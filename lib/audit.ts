/**
 * lib/audit.ts — AuditLog utility.
 *
 * C-01: Zero Next.js imports. Framework-agnostic.
 * C-06: createAuditLog MUST always be called inside the same Prisma $transaction.
 *
 * Usage:
 *   await prisma.$transaction(async (tx) => {
 *     await doSomething(tx)
 *     await createAuditLog(tx, { ... })
 *   })
 */

import type { Prisma, AuditAction } from '@/app/generated/prisma/client'

export type { AuditAction }

export interface CreateAuditLogInput {
  actorId: string
  action: AuditAction
  entityType: string
  entityId: string
  metadata?: Record<string, unknown>
}

/**
 * Creates an AuditLog record.
 * MUST be called inside a Prisma $transaction — pass the `tx` client.
 */
export async function createAuditLog(
  tx: Prisma.TransactionClient,
  input: CreateAuditLogInput
): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      // Prisma Json fields require explicit cast from Record<string, unknown>
      metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : undefined,
    },
  })
}
