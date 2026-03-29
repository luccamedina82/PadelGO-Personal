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
  popoverPos: { x: number; y: number }
}

interface Props {
  gridStart: number
  gridEnd: number
  visibleCourts: CourtColumn[]
  colWidth: number
  containerRef: RefObject<HTMLDivElement | null>
  gridBodyRef: RefObject<HTMLDivElement | null>
  onEmptyClick: (courtId: string, slotMin: number) => void
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

      const deltaSlots = Math.max(0, Math.round(deltaY / SLOT_HEIGHT))
      const rawDuration = (deltaSlots + 2) * 30 // minimum 2 slots = 60 min
      const court = visibleCourts[info.courtIndex]
      const courtCloseMin = court?.closeTimeMinutes ?? gridEnd
      const maxDuration = courtCloseMin - info.startMin
      const durationMinutes = Math.max(60, Math.min(rawDuration, maxDuration))

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
        // Calculate popover position relative to the ghost block
        const gridBodyEl = gridBodyRef.current
        const containerEl = containerRef.current
        let popX = e.clientX + 16
        let popY = e.clientY - 40
        if (gridBodyEl && containerEl) {
          const rect = containerEl.getBoundingClientRect()
          const ghostLeft = rect.left + TIME_COL_WIDTH + ghost.courtIndex * colWidth
          const ghostRight = ghostLeft + colWidth
          const ghostTop = rect.top + ((ghost.startMin - gridStart) / 30) * SLOT_HEIGHT
          // Prefer right side of ghost, fallback left
          const popoverWidth = 240
          if (ghostRight + 16 + popoverWidth < window.innerWidth - 12) {
            popX = ghostRight + 8
          } else {
            popX = ghostLeft - popoverWidth - 8
          }
          popY = Math.max(12, Math.min(ghostTop, window.innerHeight - 280))
        }
        const clampedX = Math.max(12, Math.min(popX, window.innerWidth - 260))
        const clampedY = Math.max(12, Math.min(popY, window.innerHeight - 280))
        setPendingCreate({
          ghost,
          courtId: info.courtId,
          popoverPos: { x: clampedX, y: clampedY },
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
  }, [visibleCourts, gridStart, gridEnd, colWidth, onEmptyClick])

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
