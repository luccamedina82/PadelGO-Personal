'use client'

import { useRef, useState, useEffect } from 'react'

const DOW_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

interface ManualBookingWizardStep1Props {
  date: string
  setDate(v: string): void
  availableDates: string[]
  dateHasSlots?: Record<string, boolean>
}

export default function ManualBookingWizardStep1({ date, setDate, availableDates, dateHasSlots }: ManualBookingWizardStep1Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  function updateArrows() {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    requestAnimationFrame(updateArrows)
    el.addEventListener('scroll', updateArrows, { passive: true })
    return () => el.removeEventListener('scroll', updateArrows)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableDates])

  function scrollPrev() {
    scrollRef.current?.scrollBy({ left: -(46 + 7) * 3, behavior: 'smooth' })
  }

  function scrollNext() {
    scrollRef.current?.scrollBy({ left: (46 + 7) * 3, behavior: 'smooth' })
  }

  return (
    <div className="flex flex-col">
      <p className="text-[9px] font-bold tracking-[1.5px] uppercase text-muted mb-[10px]">
        Seleccioná una fecha
      </p>
      <div className="relative">
        {/* Flecha izquierda */}
        <button
          type="button"
          onClick={scrollPrev}
          aria-label="Fechas anteriores"
          className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 z-10 w-6 h-6 rounded-lg
                      bg-card border border-border text-muted hover:text-text
                      flex items-center justify-center transition-opacity duration-150
                      ${canScrollLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* Scroll container */}
        <div
          ref={scrollRef}
          className="flex gap-[7px] overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {availableDates.map((d, idx) => {
            const dObj = new Date(`${d}T00:00:00.000Z`)
            const dow = DOW_LABELS[dObj.getUTCDay()]
            const day = dObj.getUTCDate()
            const isActive = date === d
            const isToday = idx === 0
            const hasSlots = dateHasSlots ? (dateHasSlots[d] ?? true) : true
            return (
              <button
                key={d}
                type="button"
                onClick={hasSlots ? () => setDate(d) : undefined}
                disabled={!hasSlots}
                className={`shrink-0 flex flex-col items-center gap-[2px] min-w-[46px] px-[6px] py-2
                            rounded-xl border transition-all duration-[130ms]
                            ${!hasSlots
                              ? 'border-border bg-card opacity-40 cursor-not-allowed'
                              : isActive
                                ? 'bg-accent border-accent cursor-pointer active:scale-95'
                                : isToday
                                  ? 'border-accent/45 bg-accent/6 hover:border-border-hover cursor-pointer active:scale-95'
                                  : 'border-border bg-card hover:border-border-hover cursor-pointer active:scale-95'
                            }`}
              >
                <span
                  className={`text-[9px] font-bold uppercase tracking-[0.6px]
                              ${isActive ? 'text-accent-text' : isToday && hasSlots ? 'text-accent' : 'text-muted'}`}
                >
                  {idx === 0 ? 'Hoy' : dow}
                </span>
                <span
                  className={`text-[17px] font-extrabold leading-none
                              ${isActive ? 'text-accent-text' : 'text-text'}`}
                >
                  {day}
                </span>
                {!hasSlots && (
                  <span className="text-[7px] font-bold uppercase tracking-[0.4px] text-muted leading-none mt-[1px]">
                    Completo
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Flecha derecha */}
        <button
          type="button"
          onClick={scrollNext}
          aria-label="Fechas siguientes"
          className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 z-10 w-6 h-6 rounded-lg
                      bg-card border border-border text-muted hover:text-text
                      flex items-center justify-center transition-opacity duration-150
                      ${canScrollRight ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  )
}
