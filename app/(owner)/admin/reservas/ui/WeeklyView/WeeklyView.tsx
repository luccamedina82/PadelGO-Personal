import { argTodayStr } from "@/lib/date"
import Link from "next/link"

export default function WeekNavigation({ weekStart }: { weekStart: string }) {
      const today = argTodayStr()
    
  return (
    <div className="px-5 pb-3 flex items-center gap-2 print:hidden">
      <Link
        href={`/admin/reservas?date=${(() => {
          const d = new Date(`${weekStart}T00:00:00.000Z`)
          d.setUTCDate(d.getUTCDate() - 7)
          return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
        })()}&view=week`}
        className="px-3 py-1.5 bg-card border border-border rounded-lg text-xs text-muted hover:text-text hover:border-border-hover transition-colors"
      >
        ← Anterior
      </Link>
      <Link
        href={`/admin/reservas?date=${today}&view=week`}
        className="px-3 py-1.5 bg-accent/10 border border-accent/30 rounded-lg text-xs text-accent font-semibold hover:bg-accent/20 transition-colors"
      >
        Esta semana
      </Link>
      <Link
        href={`/admin/reservas?date=${(() => {
          const d = new Date(`${weekStart}T00:00:00.000Z`)
          d.setUTCDate(d.getUTCDate() + 7)
          return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
        })()}&view=week`}
        className="px-3 py-1.5 bg-card border border-border rounded-lg text-xs text-muted hover:text-text hover:border-border-hover transition-colors"
      >
        Siguiente →
      </Link>
    </div>
  )
}
