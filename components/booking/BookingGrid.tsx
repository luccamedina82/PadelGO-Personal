'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import ConvertToOpenMatchModal from './ConvertToOpenMatchModal'

// ── TYPES ─────────────────────────────────────────────────────────────────

export interface BookingBlock {
  id: string
  courtId: string
  startTime: string // 'HH:MM'
  durationMinutes: number
  status: string // 'CONFIRMED' | 'PENDING' | 'CANCELLED'
  source: string // 'ONLINE' | 'MANUAL_OWNER' | 'MANUAL_SUPPORT' | 'BLOCK'
  displayName: string // manualName, user name, or 'Bloqueo'
  totalPrice: number // centavos
  paymentStatus: string
  manualPhone?: string | null
  recurringBookingId?: string | null
  playerDetails?: { id: string; name: string }[]
  paidPlayerIds?: string[]
  date?: string // YYYY-MM-DD, populated in week view
}

export interface CourtColumn {
  id: string
  name: string
  isActive: boolean
}

export interface UpdateBookingData {
  startTime: string
  durationMinutes: number
  manualName?: string
  manualPhone?: string
}

interface BookingGridProps {
  courts: CourtColumn[]
  bookings: BookingBlock[]
  date: string // YYYY-MM-DD
  gridStart: number // minutes from midnight, e.g. 7*60 = 420
  gridEnd: number // minutes from midnight, e.g. 23*60 = 1380
  onCancelBooking?: (bookingId: string) => Promise<void>
  onConfirmBooking?: (bookingId: string) => Promise<void>
  onUpdatePayment?: (bookingId: string, status: 'PAID' | 'UNPAID' | 'MANUAL') => Promise<void>
  onUpdateBooking?: (bookingId: string, data: UpdateBookingData) => Promise<void>
  onUpdatePlayers?: (bookingId: string, playerIds: string[], paidPlayerIds: string[]) => Promise<void>
  onSearchPlayers?: (query: string) => Promise<{ id: string; name: string }[]>
  highlightBookingId?: string
}

const SLOT_HEIGHT = 48 // px per 30-min row
const TIME_COL_WIDTH = 52 // px

// ── HELPERS ───────────────────────────────────────────────────────────────

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function formatPrice(centavos: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(centavos / 100)
}

function getLocalDateStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getBlockClass(source: string, status: string, recurringBookingId?: string | null): string {
  if (status === 'CANCELLED') return 'booking-block-cancelled'
  if (source === 'BLOCK' && recurringBookingId) return 'booking-block-recurring'
  if (source === 'BLOCK') return 'booking-block-block'
  if (source === 'ONLINE') return 'booking-block-online'
  return 'booking-block-manual'
}

function getSourceLabel(
  source: string,
  status: string,
  recurringBookingId?: string | null
): string {
  if (status === 'CANCELLED') return 'CANCEL'
  if (source === 'BLOCK' && recurringBookingId) return 'TURNO FIJO'
  if (source === 'BLOCK') return 'BLOQUEO'
  if (source === 'ONLINE') return 'ONLINE'
  return 'MANUAL'
}

// ── BOOKING DETAIL MODAL ──────────────────────────────────────────────────

interface BookingDetailProps {
  booking: BookingBlock | null
  onClose: () => void
  onCancel?: (id: string) => Promise<void>
  onConfirm?: (id: string) => Promise<void>
  onUpdatePayment?: (id: string, status: 'PAID' | 'UNPAID' | 'MANUAL') => Promise<void>
  onUpdateBooking?: (id: string, data: UpdateBookingData) => Promise<void>
  onUpdatePlayers?: (id: string, playerIds: string[], paidPlayerIds: string[]) => Promise<void>
  onSearchPlayers?: (query: string) => Promise<{ id: string; name: string }[]>
}

function BookingDetail({
  booking,
  onClose,
  onCancel,
  onConfirm,
  onUpdatePayment,
  onUpdateBooking,
  onUpdatePlayers,
  onSearchPlayers,
}: BookingDetailProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editStartTime, setEditStartTime] = useState('')
  const [editDuration, setEditDuration] = useState(0)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')

  // Player management state
  const [localPlayers, setLocalPlayers] = useState<{ id: string; name: string }[]>([])
  const [localPaidIds, setLocalPaidIds] = useState<string[]>([])
  const [playersDirty, setPlayersDirty] = useState(false)
  const [showPlayerSearch, setShowPlayerSearch] = useState(false)
  const [playerQuery, setPlayerQuery] = useState('')
  const [playerResults, setPlayerResults] = useState<{ id: string; name: string }[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  // Open match conversion state
  const [showConvertModal, setShowConvertModal] = useState(false)

  // Reset player state when booking changes
  useEffect(() => {
    setLocalPlayers(booking?.playerDetails ?? [])
    setLocalPaidIds(booking?.paidPlayerIds ?? [])
    setPlayersDirty(false)
    setShowPlayerSearch(false)
    setPlayerQuery('')
    setPlayerResults([])
    setError(null)
    setIsEditing(false)
  }, [booking?.id, booking?.playerDetails, booking?.paidPlayerIds])

  if (!booking) return null

  // Player handlers
  function togglePaid(playerId: string) {
    setLocalPaidIds((prev) =>
      prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId]
    )
    setPlayersDirty(true)
  }

  function removePlayer(playerId: string) {
    setLocalPlayers((prev) => prev.filter((p) => p.id !== playerId))
    setLocalPaidIds((prev) => prev.filter((id) => id !== playerId))
    setPlayersDirty(true)
  }

  function addPlayer(player: { id: string; name: string }) {
    if (localPlayers.find((p) => p.id === player.id)) return
    setLocalPlayers((prev) => [...prev, player])
    setPlayersDirty(true)
    setShowPlayerSearch(false)
    setPlayerQuery('')
    setPlayerResults([])
  }

  async function handlePlayerSearch() {
    if (!onSearchPlayers || !playerQuery.trim()) return
    setSearchLoading(true)
    try {
      const results = await onSearchPlayers(playerQuery)
      setPlayerResults(results.filter((r) => !localPlayers.find((p) => p.id === r.id)))
    } finally {
      setSearchLoading(false)
    }
  }

  async function handleSavePlayers() {
    if (!onUpdatePlayers) return
    setLoading(true)
    setError(null)
    try {
      await onUpdatePlayers(
        booking!.id,
        localPlayers.map((p) => p.id),
        localPaidIds
      )
      setPlayersDirty(false)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar jugadores.')
    } finally {
      setLoading(false)
    }
  }

  const blockClass = getBlockClass(booking.source, booking.status, booking.recurringBookingId)
  const endTime = minutesToTime(timeToMinutes(booking.startTime) + booking.durationMinutes)

  const sourceLabel =
    booking.source === 'BLOCK' && booking.recurringBookingId
      ? 'Turno fijo'
      : booking.source === 'BLOCK'
        ? 'Bloqueo'
        : booking.source === 'ONLINE'
          ? 'Reserva online'
          : 'Reserva manual'

  const statusLabel =
    booking.status === 'CONFIRMED'
      ? 'Confirmada'
      : booking.status === 'CANCELLED'
        ? 'Cancelada'
        : 'Pendiente'

  const statusColor =
    booking.status === 'CONFIRMED'
      ? 'text-accent'
      : booking.status === 'CANCELLED'
        ? 'text-red-400'
        : 'text-orange-400'

  const payLabel =
    booking.paymentStatus === 'PAID'
      ? 'Pagado'
      : booking.paymentStatus === 'MANUAL'
        ? 'Manual'
        : 'Sin cobrar'

  const payColor =
    booking.paymentStatus === 'PAID'
      ? 'text-green-400'
      : booking.paymentStatus === 'MANUAL'
        ? 'text-muted'
        : 'text-orange-400'

  function openEdit() {
    setEditStartTime(booking!.startTime)
    setEditDuration(booking!.durationMinutes)
    setEditName(booking!.displayName)
    setEditPhone(booking!.manualPhone ?? '')
    setError(null)
    setIsEditing(true)
  }

  async function handleCancel() {
    if (!onCancel) return
    setLoading(true)
    setError(null)
    try {
      await onCancel(booking!.id)
      onClose()
    } catch {
      setError('Error al cancelar. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    if (!onConfirm) return
    setLoading(true)
    setError(null)
    try {
      await onConfirm(booking!.id)
      onClose()
    } catch {
      setError('Error al confirmar. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function handlePayment(status: 'PAID' | 'UNPAID' | 'MANUAL') {
    if (!onUpdatePayment) return
    setLoading(true)
    setError(null)
    try {
      await onUpdatePayment(booking!.id, status)
      onClose()
    } catch {
      setError('Error al actualizar el pago. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveEdit() {
    if (!onUpdateBooking) return
    setLoading(true)
    setError(null)
    try {
      const data: UpdateBookingData = { startTime: editStartTime, durationMinutes: editDuration }
      if (booking!.source === 'MANUAL_OWNER') {
        data.manualName = editName
        data.manualPhone = editPhone
      }
      await onUpdateBooking(booking!.id, data)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // Build time options (30-min steps, 07:00–23:00)
  const timeOptions: string[] = []
  for (let m = 7 * 60; m <= 22 * 60; m += 30) {
    timeOptions.push(minutesToTime(m))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-surface rounded-2xl border border-border-hover p-5 shadow-2xl animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div
              className={`booking-block ${blockClass}`}
              style={{
                position: 'static',
                padding: 0,
                border: 'none',
                borderLeft: '3px solid',
                borderRadius: 99,
                width: 4,
                height: 24,
                flexShrink: 0,
              }}
            />
            <span className="font-semibold text-text text-sm">{sourceLabel}</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-card hover:bg-card-hover text-muted hover:text-text transition-colors text-base leading-none"
          >
            ×
          </button>
        </div>

        {isEditing ? (
          /* ── EDIT MODE ── */
          <div className="space-y-3 mb-5">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Hora de inicio</label>
              <select
                value={editStartTime}
                onChange={(e) => setEditStartTime(e.target.value)}
                className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
              >
                {timeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Duración</label>
              <select
                value={editDuration}
                onChange={(e) => setEditDuration(Number(e.target.value))}
                className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
              >
                <option value={60}>60 min</option>
                <option value={90}>90 min</option>
                <option value={120}>120 min</option>
              </select>
            </div>
            {booking.source === 'MANUAL_OWNER' && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted">Nombre del cliente</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted">Teléfono</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="Opcional"
                    className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent placeholder:text-muted/50"
                  />
                </div>
              </>
            )}
          </div>
        ) : (
          /* ── VIEW MODE ── */
          <div className="space-y-3 mb-5">
            {[
              { label: 'Cliente', value: booking.displayName, mono: false },
              { label: 'Horario', value: `${booking.startTime} – ${endTime}`, mono: true },
              { label: 'Duración', value: `${booking.durationMinutes} min`, mono: false },
              ...(booking.source !== 'BLOCK'
                ? [{ label: 'Total', value: formatPrice(booking.totalPrice), mono: true }]
                : []),
            ].map(({ label, value, mono }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-xs text-muted">{label}</span>
                <span className={`text-sm font-medium text-text ${mono ? 'font-mono' : ''}`}>
                  {value}
                </span>
              </div>
            ))}

            <div className="flex justify-between items-center pt-1 border-t border-border">
              <span className="text-xs text-muted">Estado</span>
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full bg-card ${statusColor}`}
              >
                {statusLabel}
              </span>
            </div>

            {booking.source !== 'BLOCK' && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted">Pago</span>
                <span className={`text-xs font-semibold ${payColor}`}>{payLabel}</span>
              </div>
            )}
          </div>
        )}

        {/* ── PLAYERS SECTION (view mode only) ── */}
        {booking.source !== 'BLOCK' && !isEditing && onUpdatePlayers && (
          <div className="mb-4 pt-3 border-t border-border">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs text-muted font-medium">Jugadores</span>
              <span className="text-[10px] text-sub">{localPlayers.length}/4</span>
            </div>

            {localPlayers.length === 0 && (
              <p className="text-xs text-muted italic mb-2">Sin jugadores asignados.</p>
            )}

            {localPlayers.map((p) => (
              <div key={p.id} className="flex items-center gap-2 py-1.5">
                <span className="flex-1 text-sm text-text truncate">{p.name}</span>
                <button
                  onClick={() => togglePaid(p.id)}
                  disabled={loading}
                  className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-semibold transition-colors disabled:opacity-40 ${
                    localPaidIds.includes(p.id)
                      ? 'border-green-400/30 text-green-400 bg-green-400/10 hover:bg-green-400/20'
                      : 'border-orange-400/30 text-orange-400 bg-orange-400/10 hover:bg-orange-400/20'
                  }`}
                >
                  {localPaidIds.includes(p.id) ? 'Pagó' : 'Debe'}
                </button>
                <button
                  onClick={() => removePlayer(p.id)}
                  disabled={loading}
                  className="w-5 h-5 flex items-center justify-center rounded-full bg-card hover:bg-red-400/10 text-muted hover:text-red-400 text-sm leading-none transition-colors disabled:opacity-40"
                >
                  ×
                </button>
              </div>
            ))}

            {localPlayers.length < 4 && onSearchPlayers && (
              showPlayerSearch ? (
                <div className="mt-2 space-y-1.5">
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={playerQuery}
                      onChange={(e) => setPlayerQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handlePlayerSearch()}
                      placeholder="Nombre o email…"
                      className="flex-1 bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text focus:outline-none focus:border-accent placeholder:text-muted/50"
                      autoFocus
                    />
                    <button
                      onClick={handlePlayerSearch}
                      disabled={searchLoading || !playerQuery.trim()}
                      className="px-3 py-1.5 bg-accent text-accent-text text-xs font-semibold rounded-lg hover:bg-accent-dark transition-colors disabled:opacity-40"
                    >
                      {searchLoading ? '...' : 'Buscar'}
                    </button>
                  </div>
                  {playerResults.length > 0 && (
                    <div className="bg-bg border border-border rounded-lg overflow-hidden">
                      {playerResults.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => addPlayer(r)}
                          className="w-full px-3 py-2 text-left text-sm text-text hover:bg-accent/5 border-b border-border last:border-0 transition-colors"
                        >
                          {r.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {playerResults.length === 0 && playerQuery.trim().length >= 2 && !searchLoading && (
                    <p className="text-xs text-muted">Sin resultados.</p>
                  )}
                  <button
                    onClick={() => {
                      setShowPlayerSearch(false)
                      setPlayerQuery('')
                      setPlayerResults([])
                    }}
                    className="text-xs text-muted hover:text-text transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowPlayerSearch(true)}
                  className="mt-1.5 flex items-center gap-1 text-xs text-muted hover:text-text transition-colors"
                >
                  <span className="text-accent font-bold">+</span> Agregar jugador
                </button>
              )
            )}

            {playersDirty && (
              <button
                onClick={handleSavePlayers}
                disabled={loading}
                className="mt-3 w-full py-2 rounded-xl bg-accent text-accent-text text-sm font-semibold hover:bg-accent-dark transition-colors disabled:opacity-40"
              >
                {loading ? '...' : 'Guardar jugadores'}
              </button>
            )}
          </div>
        )}

        {error && (
          <p className="text-xs text-red-400 mb-3 bg-red-400/5 border border-red-400/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {isEditing ? (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setIsEditing(false)
                setError(null)
              }}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm font-medium hover:text-text transition-colors disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-accent text-accent-text text-sm font-semibold hover:bg-accent-dark transition-colors disabled:opacity-40"
            >
              {loading ? '...' : 'Guardar'}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Payment buttons — shown for non-block active bookings */}
            {booking.status !== 'CANCELLED' && booking.source !== 'BLOCK' && onUpdatePayment && (
              <div className="flex gap-2">
                {booking.paymentStatus !== 'PAID' && (
                  <button
                    onClick={() => handlePayment('PAID')}
                    disabled={loading}
                    className="flex-1 py-2 rounded-xl bg-green-400/10 border border-green-400/30 text-green-400
                               text-xs font-semibold hover:bg-green-400/20 transition-colors disabled:opacity-40"
                  >
                    {loading ? '...' : '$ Cobrado'}
                  </button>
                )}
                {booking.paymentStatus !== 'UNPAID' && (
                  <button
                    onClick={() => handlePayment('UNPAID')}
                    disabled={loading}
                    className="flex-1 py-2 rounded-xl bg-orange-400/10 border border-orange-400/30 text-orange-400
                               text-xs font-semibold hover:bg-orange-400/20 transition-colors disabled:opacity-40"
                  >
                    {loading ? '...' : 'Sin cobrar'}
                  </button>
                )}
              </div>
            )}

            {/* Edit + cancel/confirm row */}
            {booking.status !== 'CANCELLED' && (
              <div className="flex gap-2">
                {onUpdateBooking && booking.source !== 'BLOCK' && booking.source !== 'ONLINE' && (
                  <button
                    onClick={openEdit}
                    disabled={loading}
                    className="px-3 py-2.5 rounded-xl border border-border text-muted text-sm
                               hover:text-text hover:border-border-hover transition-colors disabled:opacity-40"
                  >
                    Editar
                  </button>
                )}
                {booking.status === 'PENDING' && onConfirm && (
                  <button
                    onClick={handleConfirm}
                    disabled={loading}
                    className="flex-1 py-2.5 rounded-xl bg-accent text-accent-text text-sm font-semibold
                               hover:bg-accent-dark transition-colors disabled:opacity-40"
                  >
                    {loading ? '...' : 'Confirmar'}
                  </button>
                )}
                {onCancel && (
                  <button
                    onClick={handleCancel}
                    disabled={loading}
                    className="flex-1 py-2.5 rounded-xl border border-red-400/30 text-red-400 text-sm
                               font-medium hover:bg-red-400/5 transition-colors disabled:opacity-40"
                  >
                    {loading ? '...' : 'Cancelar'}
                  </button>
                )}
              </div>
            )}

            {/* Convert to open match button */}
            {booking.status !== 'CANCELLED' && booking.source !== 'BLOCK' && booking.source !== 'ONLINE' && (
              <button
                onClick={() => setShowConvertModal(true)}
                disabled={loading}
                className="w-full py-2 rounded-xl border border-accent/30 text-accent text-xs font-semibold
                           hover:bg-accent/5 transition-colors disabled:opacity-40"
              >
                ✨ Convertir a Partido Abierto
              </button>
            )}
          </div>
        )}
      </div>

      {/* Convert to Open Match Modal */}
      {showConvertModal && (
        <ConvertToOpenMatchModal
          bookingId={booking.id}
          onClose={() => setShowConvertModal(false)}
          onSuccess={() => {
            setShowConvertModal(false)
            onClose()
          }}
        />
      )}
    </div>
  )
}

// ── MAIN GRID ─────────────────────────────────────────────────────────────

export default function BookingGrid({
  courts,
  bookings,
  date,
  gridStart,
  gridEnd,
  onCancelBooking,
  onConfirmBooking,
  onUpdatePayment,
  onUpdateBooking,
  onUpdatePlayers,
  onSearchPlayers,
  highlightBookingId,
}: BookingGridProps) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const hasScrolledRef = useRef(false)
  const [colWidth, setColWidth] = useState(140)
  const [currentMinutes, setCurrentMinutes] = useState<number | null>(null)
  const [selectedBooking, setSelectedBooking] = useState<BookingBlock | null>(null)
  const [highlightId, setHighlightId] = useState<string | undefined>(highlightBookingId)

  // Filters
  const [hiddenCourts, setHiddenCourts] = useState<Set<string>>(new Set())
  const [typeFilter, setTypeFilter] = useState<string | null>(null)

  // Tooltip
  const [tooltip, setTooltip] = useState<{
    booking: BookingBlock
    x: number
    y: number
  } | null>(null)

  const todayStr = getLocalDateStr()
  const isViewingToday = date === todayStr
  const isViewingPast = date < todayStr

  // Clear highlight after 30 seconds
  useEffect(() => {
    if (!highlightId) return
    const timer = setTimeout(() => setHighlightId(undefined), 30_000)
    return () => clearTimeout(timer)
  }, [highlightId])

  // Derived: visible court count — needed in the ResizeObserver effect below
  const visibleCourtCount = courts.filter((c) => !hiddenCourts.has(c.id)).length

  // Responsive column width
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const totalWidth = entry.contentRect.width - TIME_COL_WIDTH
        const w = Math.max(100, Math.floor(totalWidth / Math.max(visibleCourtCount, 1)))
        setColWidth(w)
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [visibleCourtCount])

  // Current time line
  useEffect(() => {
    if (!isViewingToday) {
      setCurrentMinutes(null)
      return
    }
    function update() {
      const now = new Date()
      setCurrentMinutes(now.getHours() * 60 + now.getMinutes())
    }
    update()
    const iv = setInterval(update, 60_000)
    return () => clearInterval(iv)
  }, [isViewingToday])

  // Scroll to highlighted booking or current time on mount (once)
  useEffect(() => {
    if (hasScrolledRef.current || !containerRef.current) return
    // Small delay to ensure grid is fully painted
    const t = setTimeout(() => {
      if (!containerRef.current) return
      let targetMin: number | null = null
      if (highlightId) {
        const b = bookings.find((bk) => bk.id === highlightId)
        if (b) targetMin = timeToMinutes(b.startTime)
      }
      if (targetMin === null && isViewingToday) {
        const now = new Date()
        targetMin = now.getHours() * 60 + now.getMinutes()
      }
      if (targetMin !== null && targetMin >= gridStart && targetMin <= gridEnd) {
        const top = ((targetMin - gridStart) / 30) * SLOT_HEIGHT
        containerRef.current.scrollTop = Math.max(0, top - 120)
      }
      hasScrolledRef.current = true
    }, 80)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalSlots = (gridEnd - gridStart) / 30
  const gridHeight = totalSlots * SLOT_HEIGHT

  const currentLineTop =
    currentMinutes !== null && currentMinutes >= gridStart && currentMinutes <= gridEnd
      ? ((currentMinutes - gridStart) / 30) * SLOT_HEIGHT
      : null

  function handleEmptyClick(courtId: string, slotMinutes: number) {
    const timeStr = minutesToTime(slotMinutes)
    const dateParam = encodeURIComponent(date)
    router.push(`/admin/reservas/nueva?courtId=${courtId}&date=${dateParam}&time=${timeStr}`)
  }

  const visibleCourts = courts.filter((c) => !hiddenCourts.has(c.id))
  const visibleBookings = bookings.filter((b) => {
    if (typeFilter === null) return true
    if (typeFilter === 'MANUAL') return b.source === 'MANUAL_OWNER' || b.source === 'MANUAL_SUPPORT'
    if (typeFilter === 'RECURRING') return !!b.recurringBookingId
    return b.source === typeFilter
  })

  const SOURCE_FILTERS = [
    { key: null, label: 'Todos' },
    { key: 'ONLINE', label: 'Online' },
    { key: 'MANUAL', label: 'Manual' },
    { key: 'BLOCK', label: 'Bloqueo' },
    { key: 'RECURRING', label: 'Turno fijo' },
  ] as const

  return (
    <>
      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 py-2 border-b border-border bg-surface flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {/* Court toggles */}
        {courts.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {courts.map((court) => {
              const hidden = hiddenCourts.has(court.id)
              return (
                <button
                  key={court.id}
                  onClick={() =>
                    setHiddenCourts((prev) => {
                      const next = new Set(prev)
                      if (next.has(court.id)) next.delete(court.id)
                      else next.add(court.id)
                      return next
                    })
                  }
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition-all ${
                    hidden
                      ? 'text-muted border-border opacity-40 line-through'
                      : 'text-text border-border-hover bg-card hover:bg-card-hover'
                  }`}
                >
                  {court.name}
                </button>
              )
            })}
          </div>
        )}

        {/* Source filter pills */}
        <div className="flex items-center gap-1 ml-auto">
          {SOURCE_FILTERS.map(({ key, label }) => (
            <button
              key={key ?? 'all'}
              onClick={() => setTypeFilter(typeFilter === key ? null : key)}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition-colors ${
                typeFilter === key
                  ? 'bg-accent text-accent-text border-accent'
                  : 'text-muted border-border hover:text-text hover:border-border-hover'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="grow overflow-auto min-h-0">
        <div style={{ minWidth: `${TIME_COL_WIDTH + visibleCourts.length * 100}px` }}>
          {/* Court headers */}
          <div className="flex sticky top-0 z-20 bg-surface border-b-2 border-border-hover">
            <div
              style={{ width: TIME_COL_WIDTH, minWidth: TIME_COL_WIDTH }}
              className="shrink-0 border-r border-border"
            />
            {visibleCourts.map((court) => (
              <div
                key={court.id}
                style={{ width: colWidth, minWidth: colWidth }}
                className={`flex flex-col items-center justify-center py-2.5 px-2
                            border-l border-border transition-colors
                            ${!court.isActive ? 'opacity-40' : ''}`}
              >
                <p className="text-xs font-bold text-text tracking-wide truncate">{court.name}</p>
                {court.isActive && (
                  <div className="mt-1.5 w-6 h-0.5 rounded-full bg-accent opacity-50" />
                )}
              </div>
            ))}
          </div>

          {/* Grid body */}
          <div className="relative flex">
            {/* Time labels column */}
            <div
              style={{ width: TIME_COL_WIDTH, minWidth: TIME_COL_WIDTH, height: gridHeight }}
              className="shrink-0 relative border-r border-border bg-bg"
            >
              {Array.from({ length: totalSlots }, (_, i) => {
                const mins = gridStart + i * 30
                const isHour = mins % 60 === 0
                const label = isHour ? minutesToTime(mins) : ''
                const isPast = isViewingPast || (currentMinutes !== null && mins < currentMinutes)
                return (
                  <div
                    key={i}
                    className={`absolute left-0 right-0 flex items-start justify-end pr-2
                                ${isPast ? 'opacity-35' : ''}
                                ${isHour ? 'border-b border-border-hover' : 'border-b border-border/40'}`}
                    style={{
                      top: i * SLOT_HEIGHT,
                      height: SLOT_HEIGHT,
                      background: isHour ? 'var(--grid-row-alt)' : 'transparent',
                    }}
                  >
                    {label && (
                      <span className="text-[10px] font-mono text-muted mt-1.5 leading-none">
                        {label}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Court columns */}
            {visibleCourts.map((court) => {
              const courtBookings = visibleBookings.filter((b) => b.courtId === court.id)

              return (
                <div
                  key={court.id}
                  style={{ width: colWidth, minWidth: colWidth, height: gridHeight }}
                  className="relative border-l border-border"
                >
                  {!court.isActive && <div className="court-reform-overlay" />}

                  {/* Slot click targets */}
                  {Array.from({ length: totalSlots }, (_, i) => {
                    const slotMin = gridStart + i * 30
                    const isHour = slotMin % 60 === 0
                    const isPast =
                      !court.isActive ||
                      isViewingPast ||
                      (currentMinutes !== null && slotMin < currentMinutes)
                    return (
                      <div
                        key={i}
                        className={`absolute left-0 right-0 transition-colors
                                    ${isHour ? 'border-b border-border-hover' : 'border-b border-border/40'}
                                    ${
                                      isPast
                                        ? 'opacity-40 cursor-not-allowed pointer-events-none'
                                        : 'cursor-pointer hover:bg-accent/[0.04]'
                                    }`}
                        style={{
                          top: i * SLOT_HEIGHT,
                          height: SLOT_HEIGHT,
                          background: isHour ? 'var(--grid-row-alt)' : 'transparent',
                        }}
                        onClick={() => !isPast && handleEmptyClick(court.id, slotMin)}
                      />
                    )
                  })}

                  {/* Booking blocks */}
                  {courtBookings.map((b) => {
                    const startMin = timeToMinutes(b.startTime)
                    const top = ((startMin - gridStart) / 30) * SLOT_HEIGHT
                    const height = (b.durationMinutes / 30) * SLOT_HEIGHT - 3
                    const blockCls = getBlockClass(b.source, b.status, b.recurringBookingId)
                    const label = getSourceLabel(b.source, b.status, b.recurringBookingId)
                    const isHighlighted = highlightId === b.id

                    if (top < 0 || top > gridHeight) return null

                    return (
                      <div
                        key={b.id}
                        className={`booking-block ${blockCls}${isHighlighted ? ' booking-block-highlighted' : ''}`}
                        style={{
                          top: top + 2,
                          left: 5,
                          right: 5,
                          height: Math.max(height, 22),
                        }}
                        onClick={() => setSelectedBooking(b)}
                        onMouseEnter={(e) => setTooltip({ booking: b, x: e.clientX, y: e.clientY })}
                        onMouseMove={(e) =>
                          setTooltip((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null))
                        }
                        onMouseLeave={() => setTooltip(null)}
                      >
                        <p className="text-[11px] font-bold leading-tight truncate">
                          {b.displayName}
                        </p>
                        {height > 34 && (
                          <p className="text-[9px] font-mono leading-tight opacity-70">
                            {b.startTime} · {b.durationMinutes}m
                          </p>
                        )}
                        {height > 60 && b.source !== 'BLOCK' && (
                          <p className="text-[10px] font-semibold mt-auto opacity-75">
                            {formatPrice(b.totalPrice)}
                          </p>
                        )}
                        {height > 52 && (
                          <span
                            className="absolute top-1.5 right-1.5 text-[8px] font-bold
                                       tracking-wider uppercase px-1.5 py-0.5 rounded opacity-60"
                            style={{ background: 'rgba(0,0,0,0.15)' }}
                          >
                            {label}
                          </span>
                        )}
                        {/* Payment status dot */}
                        {b.source !== 'BLOCK' && b.status !== 'CANCELLED' && (
                          <div
                            className={`absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full ${
                              b.paymentStatus === 'PAID'
                                ? 'bg-green-400'
                                : b.paymentStatus === 'MANUAL'
                                  ? 'bg-gray-400'
                                  : 'bg-orange-400'
                            }`}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}

            {/* Current time line */}
            {currentLineTop !== null && (
              <div
                className="absolute left-0 right-0 z-20 pointer-events-none"
                style={{ top: currentLineTop }}
              >
                <div className="flex items-center">
                  <div
                    style={{ width: TIME_COL_WIDTH, minWidth: TIME_COL_WIDTH }}
                    className="shrink-0 flex items-center justify-end pr-0.5"
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-accent now-dot" />
                  </div>
                  <div className="flex-1 h-px bg-accent opacity-70" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Booking detail modal */}
      {selectedBooking && (
        <BookingDetail
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onCancel={onCancelBooking}
          onConfirm={onConfirmBooking}
          onUpdatePayment={onUpdatePayment}
          onUpdateBooking={onUpdateBooking}
          onUpdatePlayers={onUpdatePlayers}
          onSearchPlayers={onSearchPlayers}
        />
      )}

      {/* Hover tooltip */}
      {tooltip && !selectedBooking && (
        <div
          className="fixed z-[90] pointer-events-none bg-surface border border-border-hover rounded-xl shadow-2xl px-3 py-2.5 min-w-[170px] max-w-[220px]"
          style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
        >
          <p className="text-sm font-semibold text-text truncate mb-1">
            {tooltip.booking.displayName}
          </p>
          <p className="text-xs font-mono text-muted">
            {tooltip.booking.startTime} –{' '}
            {minutesToTime(timeToMinutes(tooltip.booking.startTime) + tooltip.booking.durationMinutes)}
            {' · '}{tooltip.booking.durationMinutes}m
          </p>
          {tooltip.booking.source !== 'BLOCK' && (
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-xs font-mono text-text">
                {formatPrice(tooltip.booking.totalPrice)}
              </span>
              <span
                className={`text-[10px] font-bold ${
                  tooltip.booking.paymentStatus === 'PAID'
                    ? 'text-green-400'
                    : 'text-orange-400'
                }`}
              >
                {tooltip.booking.paymentStatus === 'PAID' ? 'Pagado' : 'Pendiente'}
              </span>
            </div>
          )}
        </div>
      )}
    </>
  )
}
