'use client'

import DateRangePicker from '@/components/ui/DateRangePicker'

interface AnalyticsControlsProps {
  startDate?: string
  endDate?: string
}

export default function AnalyticsControls({ startDate, endDate }: AnalyticsControlsProps) {
  function handleExport(start: string, end: string) {
    // Trigger download
    const url = `/api/export/bookings?start=${start}&end=${end}`
    const link = document.createElement('a')
    link.href = url
    link.download = `reservas_${start}_${end}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="flex items-center gap-2">
      <DateRangePicker
        defaultStart={startDate}
        defaultEnd={endDate}
        onApply={(start, end) => {
          // Navigate with new params
          const params = new URLSearchParams()
          params.set('start', start)
          params.set('end', end)
          window.location.href = `/admin/analytics?${params.toString()}`
        }}
      />
      {startDate && endDate && (
        <button
          onClick={() => handleExport(startDate, endDate)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-accent-text text-xs font-semibold rounded-lg hover:bg-accent-dark transition-colors"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Exportar CSV
        </button>
      )}
    </div>
  )
}
