import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { argToday } from '@/lib/date'

/**
 * Vercel Cron: Auto-complete past bookings (CONFIRMED → COMPLETED)
 * Runs every 30 minutes, all day.
 * Offloads the lazy-completion mutations that used to run on every SSR.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const today = argToday()
    const nowUtc = new Date()
    // Argentina time = UTC-3
    const argMinutes = ((nowUtc.getUTCHours() - 3 + 24) % 24) * 60 + nowUtc.getUTCMinutes()

    // 1. Past days: mark all CONFIRMED bookings as COMPLETED
    const pastDays = await prisma.booking.updateMany({
      where: { status: 'CONFIRMED', date: { lt: today } },
      data: { status: 'COMPLETED' },
    })

    // 2. Today: mark CONFIRMED bookings whose end time has already passed
    const todayConfirmed = await prisma.booking.findMany({
      where: { status: 'CONFIRMED', date: today },
      select: { id: true, startTime: true, durationMinutes: true },
    })

    const pastTodayIds = todayConfirmed
      .filter((b) => {
        const [h = '0', m = '0'] = b.startTime.split(':')
        return parseInt(h) * 60 + parseInt(m) + b.durationMinutes <= argMinutes
      })
      .map((b) => b.id)

    let todayCompleted = 0
    if (pastTodayIds.length > 0) {
      const result = await prisma.booking.updateMany({
        where: { id: { in: pastTodayIds } },
        data: { status: 'COMPLETED' },
      })
      todayCompleted = result.count
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      pastDaysCompleted: pastDays.count,
      todayCompleted,
    })
  } catch (error) {
    console.error('[booking-auto-complete cron]', error)
    return NextResponse.json({ error: 'Failed to auto-complete bookings' }, { status: 500 })
  }
}
