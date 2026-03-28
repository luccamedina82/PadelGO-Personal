import { createManualBooking } from '@/features/reservas/actions/bookings'
import { getAdminContext } from '@/lib/dal/admin'
import { getWizardPageData } from '@/features/reservas/dal/wizardData'
import { argTodayStr } from '@/lib/date'
import ModalBookingWizardClient from './ModalBookingWizardClient'
import ModalCloseBackdrop from './ModalCloseBackdrop'

interface Props {
  searchParams: Promise<{ courtId?: string; date?: string; time?: string }>
}

export default async function NuevaReservaModalPage({ searchParams }: Props) {
  const { courtId: defaultCourtId, date: dateParam, time: defaultTime } = await searchParams
  const { club } = await getAdminContext(['OWNER', 'STAFF'])
  console.log({dateParam})
  if (!club) return null

  const { courts, courtSlotsByDate, availableDates, dateHasSlots, durationOptions } =
    await getWizardPageData(club.id, dateParam)

  const selectedDate = dateParam ?? argTodayStr()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <ModalCloseBackdrop />
      <div
        className="relative w-full max-w-4xl max-h-[90vh] rounded-2xl border border-border bg-bg flex flex-col overflow-hidden"
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
  )
}
