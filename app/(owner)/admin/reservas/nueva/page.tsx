import { createManualBooking } from '@/features/reservas/actions/bookings'
import { getAdminContext } from '@/lib/dal/admin'
import { getWizardPageData } from '@/features/reservas/dal/wizardData'
import { argTodayStr } from '@/lib/date'
import ModalBookingWizardClient from '@/app/(owner)/admin/reservas/@modal/(.)nueva/ModalBookingWizardClient'

interface Props {
  searchParams: Promise<{ courtId?: string; date?: string; time?: string }>
}

export default async function NuevaReservaPage({ searchParams }: Props) {
  const { courtId: defaultCourtId, date: dateParam, time: defaultTime } = await searchParams
  const { club } = await getAdminContext(['OWNER', 'STAFF'])

  if (!club) {
    return <div className="p-8 text-center text-muted">No tenés ningún club asignado.</div>
  }

  const { courts, courtSlotsByDate, availableDates, dateHasSlots, durationOptions } =
    await getWizardPageData(club.id, dateParam)

  const selectedDate = dateParam ?? argTodayStr()

  return (
    <div className="h-screen bg-bg overflow-hidden relative">
      {/* Dimmed backdrop */}
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" />

      {/* Wizard dialog (centered) */}
      <div className="absolute inset-0 flex items-center justify-center p-4 z-20">
        <div
          className="w-full max-w-4xl max-h-[90vh] rounded-2xl border border-border bg-bg flex flex-col overflow-hidden"
          style={{ boxShadow: '0 25px 60px rgba(0,0,0,0.50)' }}
        >
          <ModalBookingWizardClient
            courts={courts}
            courtSlotsByDate={courtSlotsByDate}
            availableDates={availableDates}
            clubId={club.id}
            createManualBookingAction={createManualBooking}
            defaultCourtId={defaultCourtId}
            defaultDate={selectedDate}
            defaultTime={defaultTime}
            durationOptions={durationOptions}
            dateHasSlots={dateHasSlots}
          />
        </div>
      </div>
    </div>
  )
}
