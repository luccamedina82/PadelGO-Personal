/**
 * lib/email.ts
 * Resend email wrapper — C-01 compliant (zero Next.js imports)
 */

import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.EMAIL_FROM ?? 'noreply@padelgo.ar'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// ── SHARED STYLES ──────────────────────────────────────────────────────────

const baseHtml = (content: string) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PadelGo</title>
  <style>
    body { margin: 0; padding: 0; background: #0a0a08; font-family: 'DM Sans', Arial, sans-serif; }
    .wrapper { max-width: 520px; margin: 40px auto; padding: 0 16px; }
    .card { background: #161616; border: 1px solid #242424; border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #1a1a00 0%, #0f0f00 100%); padding: 24px 28px; border-bottom: 1px solid #242424; }
    .logo { font-size: 28px; font-weight: 900; letter-spacing: 6px; color: #d4f000; text-transform: uppercase; }
    .tagline { font-size: 12px; color: #777; margin-top: 4px; }
    .body { padding: 28px; }
    h1 { color: #f2f2f2; font-size: 20px; margin: 0 0 8px; font-weight: 700; }
    p { color: #aaa; font-size: 14px; line-height: 1.6; margin: 0 0 16px; }
    .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #242424; }
    .info-label { color: #777; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-value { color: #f2f2f2; font-size: 14px; font-weight: 600; text-align: right; }
    .price { color: #d4f000; font-size: 20px; font-weight: 700; font-family: monospace; }
    .btn { display: inline-block; background: #d4f000; color: #080808; padding: 12px 28px; border-radius: 10px; font-weight: 700; font-size: 14px; text-decoration: none; margin-top: 8px; }
    .footer { padding: 16px 28px; border-top: 1px solid #242424; }
    .footer p { color: #444; font-size: 11px; margin: 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="logo">PadelGo</div>
        <div class="tagline">El pádel de Buenos Aires</div>
      </div>
      ${content}
      <div class="footer">
        <p>Recibiste este email porque tenés una cuenta en PadelGo. Si no reconocés esta actividad, contactanos en soporte@padelgo.ar</p>
      </div>
    </div>
  </div>
</body>
</html>
`

// ── BOOKING CONFIRMATION ────────────────────────────────────────────────────

export interface BookingConfirmationParams {
  to: string
  userName: string
  clubName: string
  clubAddress: string
  courtName: string
  date: string // "Lunes 5 de enero"
  startTime: string // "19:00"
  endTime: string // "20:30"
  totalPrice: string // "$8.500"
  bookingId: string
}

export async function sendBookingConfirmation(params: BookingConfirmationParams): Promise<void> {
  const {
    to,
    userName,
    clubName,
    clubAddress,
    courtName,
    date,
    startTime,
    endTime,
    totalPrice,
    bookingId,
  } = params

  const html = baseHtml(`
    <div class="body">
      <h1>¡Reserva confirmada, ${userName}!</h1>
      <p>Tu turno en <strong style="color:#f2f2f2">${clubName}</strong> está listo.</p>

      <div style="margin: 20px 0;">
        <div class="info-row">
          <span class="info-label">Club</span>
          <span class="info-value">${clubName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Dirección</span>
          <span class="info-value">${clubAddress}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Cancha</span>
          <span class="info-value">${courtName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Fecha</span>
          <span class="info-value">${date}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Horario</span>
          <span class="info-value">${startTime} – ${endTime}</span>
        </div>
        <div class="info-row" style="border-bottom: none;">
          <span class="info-label">Total</span>
          <span class="info-value price">${totalPrice}</span>
        </div>
      </div>

      <a href="${APP_URL}/confirmar/${bookingId}" class="btn">Ver mi reserva</a>
    </div>
  `)

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Reserva confirmada — ${clubName} ${startTime}`,
    html,
  })
}

// ── BOOKING CANCELLATION ────────────────────────────────────────────────────

export interface BookingCancellationParams {
  to: string
  userName: string
  clubName: string
  courtName: string
  date: string
  startTime: string
}

export async function sendBookingCancellation(params: BookingCancellationParams): Promise<void> {
  const { to, userName, clubName, courtName, date, startTime } = params

  const html = baseHtml(`
    <div class="body">
      <h1>Reserva cancelada</h1>
      <p>Hola ${userName}, tu turno fue cancelado.</p>

      <div style="margin: 20px 0; background: #1a0000; border: 1px solid #3a0000; border-radius: 10px; padding: 16px;">
        <div class="info-row" style="border-color: #3a0000;">
          <span class="info-label">Club</span>
          <span class="info-value">${clubName}</span>
        </div>
        <div class="info-row" style="border-color: #3a0000;">
          <span class="info-label">Cancha</span>
          <span class="info-value">${courtName}</span>
        </div>
        <div class="info-row" style="border-bottom: none;">
          <span class="info-label">Fecha y hora</span>
          <span class="info-value">${date} ${startTime}</span>
        </div>
      </div>

      <p>Si tenés alguna pregunta, respondé este email o contactanos en soporte@padelgo.ar</p>
      <a href="${APP_URL}/buscar" class="btn">Buscar otro turno</a>
    </div>
  `)

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Tu reserva en ${clubName} fue cancelada`,
    html,
  })
}

// ── REMINDER (2h before) ────────────────────────────────────────────────────

export interface BookingReminderParams {
  to: string
  userName: string
  clubName: string
  clubAddress: string
  courtName: string
  startTime: string
  bookingId: string
}

export async function sendBookingReminder(params: BookingReminderParams): Promise<void> {
  const { to, userName, clubName, clubAddress, courtName, startTime, bookingId } = params

  const html = baseHtml(`
    <div class="body">
      <h1>Tu partido es en 2 horas ⏰</h1>
      <p>Hola ${userName}, te recordamos tu turno de hoy en <strong style="color:#f2f2f2">${clubName}</strong>.</p>

      <div style="margin: 20px 0;">
        <div class="info-row">
          <span class="info-label">Club</span>
          <span class="info-value">${clubName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Dirección</span>
          <span class="info-value">${clubAddress}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Cancha</span>
          <span class="info-value">${courtName}</span>
        </div>
        <div class="info-row" style="border-bottom: none;">
          <span class="info-label">Horario</span>
          <span class="info-value">${startTime}</span>
        </div>
      </div>

      <a href="${APP_URL}/confirmar/${bookingId}" class="btn">Ver detalles</a>
    </div>
  `)

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Recordatorio: partido en ${clubName} a las ${startTime}`,
    html,
  })
}

// ── OWNER WELCOME ──────────────────────────────────────────────────────────

export interface OwnerWelcomeParams {
  to: string
  ownerName: string
  clubName: string
  invitationUrl: string
}

export async function sendOwnerWelcome(params: OwnerWelcomeParams): Promise<void> {
  const { to, ownerName, clubName, invitationUrl } = params

  const html = baseHtml(`
    <div class="body">
      <h1>¡Bienvenido a PadelGo, ${ownerName}!</h1>
      <p>Tu club <strong style="color:#f2f2f2">${clubName}</strong> fue creado en la plataforma. Solo falta que actives tu cuenta para empezar a recibir reservas.</p>

      <div style="background: #1a1a00; border: 1px solid #2a2a00; border-radius: 10px; padding: 20px; margin: 20px 0; text-align: center;">
        <p style="color: #d4f000; font-weight: 700; margin-bottom: 8px;">Tu panel de administración te espera</p>
        <p style="margin-bottom: 16px; font-size: 13px;">Desde ahí podrás configurar tus canchas, horarios, precios y gestionar todas tus reservas.</p>
        <a href="${invitationUrl}" class="btn">Activar mi cuenta</a>
      </div>

      <p style="font-size: 12px; color: #555;">Este link es válido por 48 horas. Si necesitás ayuda, escribinos a soporte@padelgo.ar</p>
    </div>
  `)

  await resend.emails.send({
    from: FROM,
    to,
    subject: `¡Bienvenido a PadelGo! Activá tu cuenta para ${clubName}`,
    html,
  })
}

// ── STAFF INVITATION ────────────────────────────────────────────────────────

export interface StaffInvitationParams {
  to: string
  clubName: string
  inviterName: string
  invitationUrl: string
}

export async function sendStaffInvitation(params: StaffInvitationParams): Promise<void> {
  const { to, clubName, inviterName, invitationUrl } = params
  console.log('que coño pasa aqui chavales')
  const html = baseHtml(`
    <div class="body">
      <h1>Te invitaron a gestionar ${clubName}</h1>
      <p><strong style="color:#f2f2f2">${inviterName}</strong> te invitó a unirte al equipo de <strong style="color:#f2f2f2">${clubName}</strong> en PadelGo.</p>

      <p>Como staff, podrás gestionar reservas, el bar y los horarios del club.</p>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${invitationUrl}" class="btn">Aceptar invitación</a>
      </div>

      <p style="font-size: 12px; color: #555;">Este link es válido por 48 horas.</p>
    </div>
  `)

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Invitación para gestionar ${clubName} en PadelGo`,
    html,
  })
}

// ── PASSWORD RESET ──────────────────────────────────────────────────────────

export interface PasswordResetParams {
  to: string
  userName: string
  resetUrl: string
}

export async function sendPasswordReset(params: PasswordResetParams): Promise<void> {
  const { to, userName, resetUrl } = params

  const html = baseHtml(`
    <div class="body">
      <h1>Reseteo de contraseña</h1>
      <p>Hola ${userName}, recibiste este email porque se solicitó un reseteo de contraseña para tu cuenta.</p>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${resetUrl}" class="btn">Crear nueva contraseña</a>
      </div>

      <p style="font-size: 12px; color: #555;">Este link es válido por 24 horas. Si no solicitaste este reseteo, ignorá este email.</p>
    </div>
  `)

  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Reseteo de contraseña — PadelGo',
    html,
  })
}
