import { requireRole } from '@/actions/auth'
import prisma from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole(['OWNER', 'STAFF'])

    // Get club
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
      return NextResponse.json({ error: 'Club not found' }, { status: 404 })
    }

    // Get date range from query params
    const startParam = request.nextUrl.searchParams.get('start')
    const endParam = request.nextUrl.searchParams.get('end')

    let startDate: Date
    let endDate: Date

    if (startParam && endParam) {
      startDate = new Date(`${startParam}T00:00:00.000Z`)
      endDate = new Date(`${endParam}T23:59:59.999Z`)
    } else {
      // Default: last 30 days
      endDate = new Date()
      startDate = new Date()
      startDate.setDate(startDate.getDate() - 30)
    }

    // Fetch bookings for the period
    const bookings = await prisma.booking.findMany({
      where: {
        clubId: club.id,
        date: {
          gte: startDate,
          lte: endDate,
        },
        status: { in: ['CONFIRMED', 'COMPLETED'] },
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        durationMinutes: true,
        totalPrice: true,
        paymentStatus: true,
        status: true,
        source: true,
        court: { select: { name: true } },
        user: { select: { name: true, email: true } },
        manualName: true,
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    })

    // Generate CSV
    const headers = [
      'Fecha',
      'Hora',
      'Cancha',
      'Duración (min)',
      'Precio (ARS)',
      'Cliente',
      'Email',
      'Estado',
      'Pago',
      'Origen',
    ]

    const rows = bookings.map((b) => [
      new Date(b.date).toLocaleDateString('es-AR'),
      b.startTime,
      b.court.name,
      b.durationMinutes.toString(),
      (b.totalPrice / 100).toFixed(2),
      b.manualName || b.user.name,
      b.user.email || '',
      b.status === 'COMPLETED' ? 'Finalizado' : 'Confirmado',
      b.paymentStatus === 'PAID'
        ? 'Pagado'
        : b.paymentStatus === 'MANUAL'
          ? 'Manual'
          : 'Sin cobrar',
      b.source === 'ONLINE'
        ? 'Online'
        : b.source === 'MANUAL_OWNER'
          ? 'Manual'
          : b.source === 'MANUAL_SUPPORT'
            ? 'Soporte'
            : 'Bloqueo',
    ])

    // Build CSV content
    const csvContent = [
      `Reporte de Reservas - ${club.name}`,
      `Período: ${new Date(startDate).toLocaleDateString('es-AR')} a ${new Date(endDate).toLocaleDateString('es-AR')}`,
      `Generado: ${new Date().toLocaleString('es-AR')}`,
      '', // Empty line
      headers.join(','),
      ...rows.map((row) =>
        row
          .map((cell) => {
            // Escape quotes and wrap in quotes if contains comma
            const escaped = String(cell).replace(/"/g, '""')
            return escaped.includes(',') || escaped.includes('"') ? `"${escaped}"` : escaped
          })
          .join(',')
      ),
      '', // Empty line
      `Total de reservas: ${bookings.length}`,
      `Ingresos totales: ARS ${(bookings.reduce((sum, b) => sum + b.totalPrice, 0) / 100).toFixed(2)}`,
    ].join('\n')

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="reservas_${club.name.replace(/\s+/g, '_')}_${startParam || 'ultimos30dias'}.csv"`,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Error exporting bookings' }, { status: 500 })
  }
}
