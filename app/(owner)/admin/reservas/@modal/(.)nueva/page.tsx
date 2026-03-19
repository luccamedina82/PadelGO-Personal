import { requireRole } from '@/actions/auth'
import prisma from '@/lib/prisma'
import { argToday, argTodayStr } from '@/lib/date'
import { calcAvailableSlots } from '@/lib/availability'
import { createManualBooking } from '@/actions/owner/bookings'
import ModalBookingWizardClient from './ModalBookingWizardClient'
import ModalCloseBackdrop from './ModalCloseBackdrop'

interface Props {
  searchParams: Promise<{ courtId?: string; date?: string; time?: string }>
}

function todayStr() {
  return argTodayStr()
}

export default async function NuevaReservaModalPage({ searchParams }: Props) {
  const {
    courtId: defaultCourtId,
    date: dateParam,
    time: defaultTime,
  } = await searchParams

  const session = await requireRole(['OWNER', 'STAFF'])

  const club =
    session.role === 'STAFF'
      ? await prisma.club.findUnique({
          where: { id: session.staffClubId ?? '' },
          select: { id: true, name: true },
        })
      : await prisma.club.findFirst({
          where: { ownerId: session.userId },
          select: { id: true, name: true },
        })

  if (!club) {
    return null
  }

  const selectedDate = dateParam ?? todayStr()

  const courts = await prisma.court.findMany({
    where: { clubId: club.id, isActive: true },
    select: {
      id: true,
      name: true,
      type: true,
      covered: true,
      availabilities: {
        where: { isActive: true },
        select: {
          dayOfWeek: true,
          openTime: true,
          closeTime: true,
          pricePerHour: true,
          isActive: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  const availableDates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(argToday())
    d.setUTCDate(d.getUTCDate() + i)
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  })

  const from = new Date(`${availableDates[0]}T00:00:00.000Z`)
  const to = new Date(`${availableDates[availableDates.length - 1]}T23:59:59.000Z`)

  const allBookings = await prisma.booking.findMany({
    where: {
      clubId: club.id,
      date: { gte: from, lte: to },
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
    select: { courtId: true, date: true, startTime: true, durationMinutes: true, status: true },
  })

  type CourtSlotsEntry = {
    courtId: string
    slots: { time: string; available: boolean; durationOptions: number[]; pricePerHour: number }[]
  }

  const courtSlotsByDate: Record<string, CourtSlotsEntry[]> = {}

  for (const dateStr of availableDates) {
    const dObj = new Date(`${dateStr}T00:00:00.000Z`)
    const dow = dObj.getUTCDay()
    const dateSlots: CourtSlotsEntry[] = []

    for (const court of courts) {
      const avail = court.availabilities.find((a) => a.dayOfWeek === dow)
      if (!avail) {
        dateSlots.push({ courtId: court.id, slots: [] })
        continue
      }

      const courtBookings = allBookings.filter((b) => {
        const bd = b.date
        const bdStr = `${bd.getFullYear()}-${String(bd.getMonth() + 1).padStart(2, '0')}-${String(bd.getDate()).padStart(2, '0')}`
        return b.courtId === court.id && bdStr === dateStr
      })

      const slots = calcAvailableSlots(
        { openTime: avail.openTime, closeTime: avail.closeTime, pricePerHour: avail.pricePerHour },
        courtBookings,
        dObj
      )

      dateSlots.push({
        courtId: court.id,
        slots: slots.map((s) => ({
          time: s.time,
          available: s.available,
          durationOptions: s.durationOptions,
          pricePerHour: s.pricePerHour,
        })),
      })
    }
    courtSlotsByDate[dateStr] = dateSlots
  }

  const courtsForWizard = courts.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    covered: c.covered,
  }))

  return (
    <div className="fixed inset-0 z-50">
      <ModalCloseBackdrop />

      <div
        className="absolute right-0 top-0 bottom-0 w-full max-w-110 border-l border-border bg-bg"
        style={{ boxShadow: '-12px 0 40px rgba(0,0,0,0.28)' }}
      >
        <ModalBookingWizardClient
          courts={courtsForWizard}
          courtSlotsByDate={courtSlotsByDate}
          availableDates={availableDates}
          clubId={club.id}
          createManualBookingAction={createManualBooking}
          defaultCourtId={defaultCourtId}
          defaultDate={selectedDate}
          defaultTime={defaultTime}
        />
      </div>
    </div>
  )
}
