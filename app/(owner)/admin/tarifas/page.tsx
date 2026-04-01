import { getAdminContext } from '@/lib/dal/admin'
import { getRulesByClubId } from '@/features/tarifas/dal/rules'
import { getCourtsByClubId } from '@/features/reservas/dal/courts'
import TarifasClient from '@/features/tarifas/components/TarifasClient'
import {
  createRule,
  updateRule,
  deleteRule,
  toggleRuleStatus,
} from '@/features/tarifas/actions/rules'

export default async function TarifasPage() {
  const { club } = await getAdminContext(['OWNER'])

  if (!club) {
    return <div className="p-8 text-center text-muted">No tenés ningún club asignado.</div>
  }

  const [rules, { courts }] = await Promise.all([
    getRulesByClubId(club.id),
    getCourtsByClubId(club.id),
  ])

  return (
    <TarifasClient
      clubId={club.id}
      courts={courts.map((c) => ({ id: c.id, name: c.name }))}
      rules={rules}
      createRuleAction={createRule}
      updateRuleAction={updateRule}
      deleteRuleAction={deleteRule}
      toggleRuleStatusAction={toggleRuleStatus}
    />
  )
}
