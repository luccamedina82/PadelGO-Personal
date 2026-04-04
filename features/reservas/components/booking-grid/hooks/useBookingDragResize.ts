'use client'

import { useState, useRef, useEffect, type RefObject, type PointerEvent as ReactPointerEvent } from 'react'
import { toast } from 'sonner'
import { minutesToTime, timeToMinutes } from '@/lib/availability'
import { BLOCK_SOURCES, SLOT_HEIGHT, TIME_COL_WIDTH } from '../helpers/bookingGrid.helpers'
import { useBookingMutations } from '@/features/reservas/hooks/useBookings'
import type { BookingBlock, CourtColumn } from '../types/bookingGrid.types'

// ── Types ──────────────────────────────────────────────────────────────────

interface DragInfo {
  bookingId: string
  origCourtId: string
  origStartMin: number
  durationMinutes: number
  offsetY: number
  onSelect: (x: number, y: number) => void
  isDrag: boolean
  startClientX: number
  startClientY: number
}

interface ResizeInfo {
  bookingId: string
  courtId: string
  startMin: number
  origDuration: number
  startClientY: number
  courtCloseMin: number
  source: string
}

export interface GhostPos {
  courtIndex: number
  startMin: number
  durationMinutes: number
}

export type LocalOverrides = Record<string, { startTime: string; durationMinutes: number; courtId: string }>

interface Props {
  clubId: string
  gridStart: number
  gridEnd: number
  visibleCourts: CourtColumn[]
  colWidth: number
  containerRef: RefObject<HTMLDivElement | null>
  gridBodyRef: RefObject<HTMLDivElement | null>
}

export interface DragResizeResult {
  draggingId: string | null
  resizingId: string | null
  ghostPos: GhostPos | null
  resizeHeightPx: number | null
  localOverrides: LocalOverrides
  handleDragStart: (
    booking: BookingBlock,
    e: ReactPointerEvent<HTMLDivElement>,
    offsetY: number,
    onSelect: (x: number, y: number) => void
  ) => void
  handleResizeStart: (booking: BookingBlock, e: React.PointerEvent<HTMLDivElement>) => void
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useBookingDragResize({
  clubId,
  gridStart,
  gridEnd,
  visibleCourts,
  colWidth,
  containerRef,
  gridBodyRef,
}: Props): DragResizeResult {
  const { updateTime } = useBookingMutations(clubId)

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [resizingId, setResizingId] = useState<string | null>(null)
  const [ghostPos, setGhostPos] = useState<GhostPos | null>(null)
  const [resizeHeightPx, setResizeHeightPx] = useState<number | null>(null)
  const [localOverrides, setLocalOverrides] = useState<LocalOverrides>({})

  // Refs for reading in event handlers without stale closures
  const activeDragRef = useRef<DragInfo | null>(null)
  const activeResizeRef = useRef<ResizeInfo | null>(null)
  const ghostPosRef = useRef<GhostPos | null>(null)
  const currentResizeDurationRef = useRef<number | null>(null)

  // Keep grid params fresh in event handler closures
  const paramsRef = useRef({ gridStart, gridEnd, visibleCourts, colWidth })
  useEffect(() => {
    paramsRef.current = { gridStart, gridEnd, visibleCourts, colWidth }
  }, [gridStart, gridEnd, visibleCourts, colWidth])

  // ── Helpers ──────────────────────────────────────────────────────────

  function applyOverride(bookingId: string, startTime: string, durationMinutes: number, courtId: string) {
    setLocalOverrides((prev) => ({ ...prev, [bookingId]: { startTime, durationMinutes, courtId } }))
  }

  function removeOverride(bookingId: string) {
    setLocalOverrides((prev) => {
      const next = { ...prev }
      delete next[bookingId]
      return next
    })
  }

  function clearBodyCursor() {
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  // ── Commit drop ──────────────────────────────────────────────────────

  function commitDrop(drag: DragInfo, ghost: GhostPos) {
    const { visibleCourts: courts } = paramsRef.current
    const newStartTime = minutesToTime(ghost.startMin)
    const newCourtId = courts[ghost.courtIndex]?.id ?? drag.origCourtId
    const origStartTime = minutesToTime(drag.origStartMin)

    if (newCourtId === drag.origCourtId && ghost.startMin === drag.origStartMin) return

    // Instant optimistic update
    applyOverride(drag.bookingId, newStartTime, drag.durationMinutes, newCourtId)

    updateTime.mutate(
      {
        id: drag.bookingId,
        data: {
          startTime: newStartTime,
          durationMinutes: drag.durationMinutes,
          courtId: newCourtId !== drag.origCourtId ? newCourtId : undefined,
        },
      },
      {
        onSuccess: (res) => {
          if (!res.success) {
            removeOverride(drag.bookingId)
            toast.error(res.error ?? 'Error al mover la reserva.')
          } else {
            setTimeout(() => removeOverride(drag.bookingId), 600)
            toast(`Reserva movida a las ${newStartTime}.`, {
              action: {
                label: 'Deshacer',
                onClick: () => {
                  applyOverride(drag.bookingId, origStartTime, drag.durationMinutes, drag.origCourtId)
                  updateTime.mutate(
                    {
                      id: drag.bookingId,
                      data: {
                        startTime: origStartTime,
                        durationMinutes: drag.durationMinutes,
                        courtId: drag.origCourtId !== newCourtId ? drag.origCourtId : undefined,
                      },
                    },
                    {
                      onSuccess: (res) => {
                        if (res.success) setTimeout(() => removeOverride(drag.bookingId), 600)
                        else toast.error(res.error ?? 'Error al deshacer.')
                      },
                    }
                  )
                },
              },
              duration: 5000,
            })
          }
        },
        onError: () => {
          removeOverride(drag.bookingId)
          toast.error('Error al mover la reserva.')
        },
      }
    )

  }

  // ── Commit resize ────────────────────────────────────────────────────

  function commitResize(resize: ResizeInfo, newDuration: number) {
    if (newDuration === resize.origDuration) return

    const startTime = minutesToTime(resize.startMin)
    const origDuration = resize.origDuration

    applyOverride(resize.bookingId, startTime, newDuration, resize.courtId)

    updateTime.mutate(
      { id: resize.bookingId, data: { startTime, durationMinutes: newDuration } },
      {
        onSuccess: (res) => {
          if (!res.success) {
            removeOverride(resize.bookingId)
            toast.error(res.error ?? 'Error al modificar la reserva.')
          } else {
            setTimeout(() => removeOverride(resize.bookingId), 600)
          }
        },
        onError: () => {
          removeOverride(resize.bookingId)
          toast.error('Error al modificar la reserva.')
        },
      }
    )

    toast(`Duración cambiada a ${newDuration} min.`, {
      action: {
        label: 'Deshacer',
        onClick: () => {
          applyOverride(resize.bookingId, startTime, origDuration, resize.courtId)
          updateTime.mutate(
            { id: resize.bookingId, data: { startTime, durationMinutes: origDuration } },
            {
              onSuccess: (res) => {
                if (res.success) setTimeout(() => removeOverride(resize.bookingId), 600)
                else toast.error(res.error ?? 'Error al deshacer.')
              },
            }
          )
        },
      },
      duration: 5000,
    })
  }

  // ── Pointer event listeners (only active during drag/resize) ─────────

  useEffect(() => {
    if (!draggingId && !resizingId) return

    function onPointerMove(e: PointerEvent) {
      const { gridStart: gs, gridEnd: ge, visibleCourts: courts, colWidth: cw } = paramsRef.current

      if (activeDragRef.current) {
        const drag = activeDragRef.current

        // Check drag threshold before showing ghost
        const dist = Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY)
        if (!drag.isDrag && dist < 5) return
        if (!drag.isDrag) {
          drag.isDrag = true
        }

        if (!gridBodyRef.current || !containerRef.current) return

        const gridBodyRect = gridBodyRef.current.getBoundingClientRect()
        const containerRect = containerRef.current.getBoundingClientRect()
        const scrollLeft = containerRef.current.scrollLeft

        // X → court column
        const xInContent = e.clientX - containerRect.left + scrollLeft
        const courtIndex = Math.max(
          0,
          Math.min(courts.length - 1, Math.floor((xInContent - TIME_COL_WIDTH) / cw))
        )

        // Y → time slot (subtract offsetY so card top follows cursor)
        const rawY = e.clientY - gridBodyRect.top - drag.offsetY
        const targetCourtCloseMin = courts[courtIndex]?.closeTimeMinutes ?? ge
        const effectiveEnd = Math.min(targetCourtCloseMin, ge)
        const maxSlot = (effectiveEnd - gs) / 30 - drag.durationMinutes / 30
        const slotIndex = Math.max(0, Math.min(maxSlot, Math.round(rawY / SLOT_HEIGHT)))
        const newStartMin = gs + slotIndex * 30

        const next: GhostPos = { courtIndex, startMin: newStartMin, durationMinutes: drag.durationMinutes }
        const prev = ghostPosRef.current
        if (!prev || prev.courtIndex !== courtIndex || prev.startMin !== newStartMin) {
          ghostPosRef.current = next
          setGhostPos(next)
        }
      }

      if (activeResizeRef.current) {
        const resize = activeResizeRef.current
        const deltaSlots = Math.round((e.clientY - resize.startClientY) / SLOT_HEIGHT)

        const court = courts.find(c => c.id === resize.courtId)
        const minByCourt = court?.allowedDurations[0] ?? 60
        const maxByCourt = court?.allowedDurations[court.allowedDurations.length - 1] ?? 120
        const maxByClose = resize.courtCloseMin - resize.startMin
        const isBlock = BLOCK_SOURCES.has(resize.source)
        const upperLimit = isBlock ? maxByClose : Math.min(maxByCourt, maxByClose)
        const newDuration = Math.max(minByCourt, Math.min(upperLimit, resize.origDuration + deltaSlots * 30))
        currentResizeDurationRef.current = newDuration
        setResizeHeightPx((newDuration / 30) * SLOT_HEIGHT - 3)
      }
    }

    function onPointerUp() {
      if (activeDragRef.current) {
        const drag = activeDragRef.current
        const ghost = ghostPosRef.current

        if (!drag.isDrag) {
          drag.onSelect(drag.startClientX, drag.startClientY)
        } else if (ghost) {
          commitDrop(drag, ghost)
        }

        activeDragRef.current = null
        ghostPosRef.current = null
        setDraggingId(null)
        setGhostPos(null)
        clearBodyCursor()
      }

      if (activeResizeRef.current) {
        const resize = activeResizeRef.current
        const newDuration = currentResizeDurationRef.current ?? resize.origDuration
        commitResize(resize, newDuration)

        activeResizeRef.current = null
        currentResizeDurationRef.current = null
        setResizingId(null)
        setResizeHeightPx(null)
        clearBodyCursor()
      }
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingId, resizingId])

  // ── Public handlers ──────────────────────────────────────────────────

  function handleDragStart(
    booking: BookingBlock,
    e: ReactPointerEvent<HTMLDivElement>,
    offsetY: number,
    onSelect: (x: number, y: number) => void
  ) {
    if (booking.status === 'CANCELLED') return
    e.preventDefault() // suppress subsequent click event

    const origStartMin = timeToMinutes(booking.startTime)
    const courtIndex = paramsRef.current.visibleCourts.findIndex((c) => c.id === booking.courtId)

    activeDragRef.current = {
      bookingId: booking.id,
      origCourtId: booking.courtId,
      origStartMin,
      durationMinutes: booking.durationMinutes,
      offsetY,
      onSelect,
      isDrag: false,
      startClientX: e.clientX,
      startClientY: e.clientY,
    }

    ghostPosRef.current = {
      courtIndex: Math.max(0, courtIndex),
      startMin: origStartMin,
      durationMinutes: booking.durationMinutes,
    }

    setDraggingId(booking.id)
    setGhostPos(ghostPosRef.current)
  }

  function handleResizeStart(booking: BookingBlock, e: React.PointerEvent<HTMLDivElement>) {
    if (booking.status === 'CANCELLED') return
    e.preventDefault()
    e.stopPropagation()

    const startMin = timeToMinutes(booking.startTime)
    const { visibleCourts: courts, gridEnd: ge } = paramsRef.current
    const court = courts.find((c) => c.id === booking.courtId)
    const courtCloseMin = court?.closeTimeMinutes ?? ge

    activeResizeRef.current = {
      bookingId: booking.id,
      courtId: booking.courtId,
      startMin,
      origDuration: booking.durationMinutes,
      startClientY: e.clientY,
      courtCloseMin,
      source: booking.source,
    }

    currentResizeDurationRef.current = booking.durationMinutes
    setResizingId(booking.id)
    setResizeHeightPx((booking.durationMinutes / 30) * SLOT_HEIGHT - 3)
  }

  return {
    draggingId,
    resizingId,
    ghostPos,
    resizeHeightPx,
    localOverrides,
    handleDragStart,
    handleResizeStart,
  }
}
