import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendBookingReminder } from '@/lib/email'
import { argTodayStr, argToday } from '@/lib/date'

/**
 * Vercel Cron: Send booking reminders 2 hours before each match
 * Runs every 15 minutes during operating hours (06:00-23:00)
 *
 * Cron schedule format: minutes hours * * * (in this case: every 15 min from 6-23)
 */

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

export async function GET(request: NextRequest) {
  // Verify Vercel Cron signature
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const today = argTodayStr()

    // ── Auto-complete past bookings (CONFIRMED → COMPLETED) ────────────────────
    const argMinutes = ((now.getUTCHours() - 3 + 24) % 24) * 60 + now.getUTCMinutes()
    await prisma.booking.updateMany({
      where: { status: 'CONFIRMED', date: { lt: argToday() } },
      data: { status: 'COMPLETED' },
    })
    const todayConfirmed = await prisma.booking.findMany({
      where: { status: 'CONFIRMED', date: argToday() },
      select: { id: true, startTime: true, durationMinutes: true },
    })
    const pastTodayIds = todayConfirmed
      .filter((b) => {
        const [h = '0', m = '0'] = b.startTime.split(':')
        return parseInt(h) * 60 + parseInt(m) + b.durationMinutes <= argMinutes
      })
      .map((b) => b.id)
    if (pastTodayIds.length > 0) {
      await prisma.booking.updateMany({
        where: { id: { in: pastTodayIds } },
        data: { status: 'COMPLETED' },
      })
    }
    // ──────────────────────────────────────────────────────────────────────────

    // Fetch today's bookings
    const todayDate = new Date(`${today}T00:00:00.000Z`)
    const bookings = await prisma.booking.findMany({
      where: {
        date: todayDate,
        status: { in: ['CONFIRMED', 'COMPLETED'] },
      },
      select: {
        id: true,
        startTime: true,
        user: {
          select: { id: true, email: true, name: true },
        },
        court: {
          select: { name: true },
        },
        club: {
          select: { name: true, address: true },
        },
      },
    })

    // Track sent reminders
    let sentCount = 0
    const results: { bookingId: string; status: 'sent' | 'skipped' | 'error'; reason?: string }[] =
      []

    const targetBookings = bookings.filter((booking) => {
      const bookingTimeMinutes = timeToMinutes(booking.startTime)
      const minutesUntilBooking = bookingTimeMinutes - currentMinutes
      return minutesUntilBooking >= 100 && minutesUntilBooking <= 140
    })

    const existingReminderLogs =
      targetBookings.length > 0
        ? await prisma.notificationLog.findMany({
            where: {
              bookingId: { in: targetBookings.map((b) => b.id) },
              type: 'BOOKING_REMINDER',
              status: 'SENT',
            },
            select: { bookingId: true },
          })
        : []

    const alreadySentBookingIds = new Set(
      existingReminderLogs.map((log) => log.bookingId).filter((id): id is string => Boolean(id))
    )

    const sentLogsData: {
      bookingId: string
      userId: string
      type: string
      channel: string
      recipient: string
      status: string
      sentAt: Date
    }[] = []

    const failedLogsData: {
      bookingId: string
      userId: string
      type: string
      channel: string
      recipient: string
      status: string
      failureReason: string
    }[] = []

    for (const booking of targetBookings) {
      if (alreadySentBookingIds.has(booking.id)) {
        results.push({
          bookingId: booking.id,
          status: 'skipped',
          reason: 'Reminder already sent',
        })
        continue
      }

      try {
        await sendBookingReminder({
          to: booking.user.email,
          userName: booking.user.name,
          clubName: booking.club.name,
          clubAddress: booking.club.address || '',
          courtName: booking.court.name,
          startTime: booking.startTime,
          bookingId: booking.id,
        })

        sentLogsData.push({
          bookingId: booking.id,
          userId: booking.user.id,
          type: 'BOOKING_REMINDER',
          channel: 'EMAIL',
          recipient: booking.user.email,
          status: 'SENT',
          sentAt: new Date(),
        })

        sentCount++
        results.push({
          bookingId: booking.id,
          status: 'sent',
        })
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        console.error(`Failed to send reminder for booking ${booking.id}:`, error)

        failedLogsData.push({
          bookingId: booking.id,
          userId: booking.user.id,
          type: 'BOOKING_REMINDER',
          channel: 'EMAIL',
          recipient: booking.user.email,
          status: 'FAILED',
          failureReason: errorMsg,
        })

        results.push({
          bookingId: booking.id,
          status: 'error',
          reason: errorMsg,
        })
      }
    }

    if (sentLogsData.length > 0) {
      await prisma.notificationLog.createMany({
        data: sentLogsData,
      })
    }

    if (failedLogsData.length > 0) {
      await prisma.notificationLog.createMany({
        data: failedLogsData,
      })
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      sentCount,
      totalChecked: bookings.length,
      results,
    })
  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      {
        error: 'Failed to process booking reminders',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
