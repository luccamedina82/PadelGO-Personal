'use client'

import { useState, useRef, useEffect, type RefObject, type PointerEvent as ReactPointerEvent } from 'react'
import { SLOT_HEIGHT, TIME_COL_WIDTH } from '../helpers/bookingGrid.helpers'
import type { CourtColumn } from '../types/bookingGrid.types'

export interface CreateGhost {
  courtIndex: number
  startMin: number
  durationMinutes: number
}

export interface PendingCreate {
  ghost: CreateGhost
  courtId: string
  /** Bounding rect of the ghost in viewport coordinates — used as floating-ui anchor */
  ghostRect: { x: number; y: number; width: number; height: number }
}

interface Props {
  gridStart: number
  gridEnd: number
  visibleCourts: CourtColumn[]
  colWidth: number
  containerRef: RefObject<HTMLDivElement | null>
  gridBodyRef: RefObject<HTMLDivElement | null>
  onEmptyClick: (courtId: string, slotMin: number) => void
  occupiedSlots: Map<string, Set<number>>
  courtMinDurations: Map<string, number>
}

export interface DragCreateResult {
  createGhost: CreateGhost | null
  pendingCreate: PendingCreate | null
  isCreating: boolean
  handleCreateStart: (
    courtId: string,
    courtIndex: number,
    slotMin: number,
    e: ReactPointerEvent<HTMLDivElement>
  ) => void
  handleCancelCreate: () => void
}

const DRAG_THRESHOLD = 5

export function useBookingDragCreate({
  gridStart,
  gridEnd,
  visibleCourts,
  colWidth,
  containerRef,
  gridBodyRef,
  onEmptyClick,
  occupiedSlots,
  courtMinDurations,
}: Props): DragCreateResult {
  const dragInfoRef = useRef<{
    courtId: string
    courtIndex: number
    startMin: number
    startClientY: number
    isDragging: boolean
  } | null>(null)

  const [createGhost, setCreateGhost] = useState<CreateGhost | null>(null)
  const [pendingCreate, setPendingCreate] = useState<PendingCreate | null>(null)
  const isCreating = dragInfoRef.current !== null || createGhost !== null

  function handleCreateStart(
    courtId: string,
    courtIndex: number,
    slotMin: number,
    e: ReactPointerEvent<HTMLDivElement>
  ) {
    // Don't interfere with right-click
    if (e.button !== 0) return
    e.preventDefault()
    dragInfoRef.current = {
      courtId,
      courtIndex,
      startMin: slotMin,
      startClientY: e.clientY,
      isDragging: false,
    }
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      const info = dragInfoRef.current
      if (!info) return

      const deltaY = e.clientY - info.startClientY
      if (!info.isDragging && Math.abs(deltaY) < DRAG_THRESHOLD) return
      info.isDragging = true

      const courtMinDuration = courtMinDurations.get(info.courtId) ?? 60
      const minSlots = courtMinDuration / 30
      const deltaSlots = Math.max(0, Math.round(deltaY / SLOT_HEIGHT))
      const rawDuration = (deltaSlots + minSlots) * 30
      const court = visibleCourts[info.courtIndex]
      const courtCloseMin = Math.min(court?.closeTimeMinutes ?? gridEnd, gridEnd)
      // Cap at court close and first collision
      const occupied = occupiedSlots.get(info.courtId)
      let maxDuration = courtCloseMin - info.startMin
      if (occupied) {
        for (let m = info.startMin + 30; m < courtCloseMin; m += 30) {
          if (occupied.has(m)) {
            maxDuration = m - info.startMin
            break
          }
        }
      }
      const durationMinutes = Math.min(rawDuration, maxDuration)

      setCreateGhost({
        courtIndex: info.courtIndex,
        startMin: info.startMin,
        durationMinutes,
      })
    }

    function onPointerUp(e: PointerEvent) {
      const info = dragInfoRef.current
      if (!info) return
      document.body.style.userSelect = ''

      if (!info.isDragging) {
        // Treat as a regular click
        dragInfoRef.current = null
        setCreateGhost(null)
        onEmptyClick(info.courtId, info.startMin)
        return
      }

      dragInfoRef.current = null

      setCreateGhost((ghost) => {
        if (!ghost) return null
        // Don't open form if capped duration is below this court's minimum
        const courtMinDuration = courtMinDurations.get(info.courtId) ?? 60
        if (ghost.durationMinutes < courtMinDuration) return null
        // Compute ghost bounding rect in viewport coordinates
        // floating-ui will handle left/right flip automatically
        const containerEl = containerRef.current
        let ghostLeft = e.clientX
        let ghostTop = e.clientY
        if (containerEl) {
          const rect = containerEl.getBoundingClientRect()
          ghostLeft = rect.left + TIME_COL_WIDTH + ghost.courtIndex * colWidth
          ghostTop = rect.top + ((ghost.startMin - gridStart) / 30) * SLOT_HEIGHT - containerEl.scrollTop
        }
        const ghostHeight = (ghost.durationMinutes / 30) * SLOT_HEIGHT
        setPendingCreate({
          ghost,
          courtId: info.courtId,
          ghostRect: { x: ghostLeft, y: ghostTop, width: colWidth, height: ghostHeight },
        })
        return ghost // keep ghost visible while popover is open
      })
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleCourts, gridStart, gridEnd, colWidth, onEmptyClick, occupiedSlots, courtMinDurations])

  function handleCancelCreate() {
    dragInfoRef.current = null
    setCreateGhost(null)
    setPendingCreate(null)
    document.body.style.userSelect = ''
  }

  return {
    createGhost,
    pendingCreate,
    isCreating,
    handleCreateStart,
    handleCancelCreate,
  }
}
