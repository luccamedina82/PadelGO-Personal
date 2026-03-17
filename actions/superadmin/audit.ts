'use server'

import prisma from '@/lib/prisma'
import { requireSuperAdmin } from '@/actions/auth'
import type { AuditAction } from '@/app/generated/prisma/client'

export interface AuditLogEntry {
  id: string
  action: AuditAction
  entityType: string
  entityId: string
  metadata: unknown
  createdAt: Date
  actor: {
    id: string
    name: string
    avatarColor: string
  }
}

export interface GetAuditLogsInput {
  entityType?: string
  action?: string
  limit?: number
  offset?: number
}

export async function getAuditLogs(input: GetAuditLogsInput = {}): Promise<{
  logs: AuditLogEntry[]
  total: number
}> {
  await requireSuperAdmin()

  const { entityType, action, limit = 50, offset = 0 } = input

  const actionFilter = action && action !== 'ALL' ? (action as AuditAction) : undefined
  const entityFilter = entityType && entityType !== 'ALL' ? entityType : undefined

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        ...(entityFilter ? { entityType: entityFilter } : {}),
        ...(actionFilter ? { action: actionFilter } : {}),
      },
      include: {
        actor: {
          select: { id: true, name: true, avatarColor: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.auditLog.count({
      where: {
        ...(entityFilter ? { entityType: entityFilter } : {}),
        ...(actionFilter ? { action: actionFilter } : {}),
      },
    }),
  ])

  return { logs, total }
}
