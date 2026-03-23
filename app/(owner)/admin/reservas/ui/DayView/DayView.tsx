import { argTodayStr } from '@/lib/date'
import Link from 'next/link'

const DOW_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export default function DateNavigation({selectedDate}: { selectedDate: string }) {
  const today = argTodayStr()
  const todayDate = new Date(`${today}T00:00:00.000Z`)
  const navDates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(todayDate)
    d.setUTCDate(d.getUTCDate() + i - 2)
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  })

  return (
    <div className="overflow-x-auto px-5 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden print:hidden">
      <div className="flex gap-1.5">
        {navDates.map((d) => {
          const dObj = new Date(`${d}T00:00:00.000Z`)
          const dow = DOW_LABELS[dObj.getUTCDay()]
          const day = dObj.getUTCDate()
          const isToday = d === today
          const isSelected = d === selectedDate
          return (
            <Link
              key={d}
              href={`/admin/reservas?date=${d}&view=day`}
              className={`shrink-0 flex flex-col items-center px-2.5 py-1.5 rounded-xl
                                text-xs transition-colors min-w-[44px]
                                ${
                                  isSelected
                                    ? 'bg-accent text-accent-text font-bold'
                                    : isToday
                                      ? 'bg-accent/10 text-accent font-semibold border border-accent/30'
                                      : 'bg-card border border-border text-muted hover:text-text hover:border-border-hover'
                                }`}
            >
              <span className="text-[9px] uppercase tracking-wider leading-none mb-0.5">{dow}</span>
              <span className="text-base font-bold leading-tight">{day}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
