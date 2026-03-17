'use client'

import { useState } from 'react'

interface DateRangePickerProps {
  onApply: (startDate: string, endDate: string) => void
  defaultStart?: string
  defaultEnd?: string
}

export default function DateRangePicker({
  onApply,
  defaultStart,
  defaultEnd,
}: DateRangePickerProps) {
  const [startDate, setStartDate] = useState(defaultStart || '')
  const [endDate, setEndDate] = useState(defaultEnd || '')
  const [showPicker, setShowPicker] = useState(false)

  function getToday(): string {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  function getLast7Days(): { start: string; end: string } {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 6)
    return {
      start: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`,
      end: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`,
    }
  }

  function getLast30Days(): { start: string; end: string } {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 29)
    return {
      start: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`,
      end: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`,
    }
  }

  function getCurrentMonth(): { start: string; end: string } {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return {
      start: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`,
      end: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`,
    }
  }

  function handleQuickSelect(period: 'today' | '7days' | '30days' | 'month') {
    let range: { start: string; end: string }
    const today = getToday()

    switch (period) {
      case 'today':
        range = { start: today, end: today }
        break
      case '7days':
        range = getLast7Days()
        break
      case '30days':
        range = getLast30Days()
        break
      case 'month':
        range = getCurrentMonth()
        break
    }

    setStartDate(range.start)
    setEndDate(range.end)
    onApply(range.start, range.end)
    setShowPicker(false)
  }

  function handleApply() {
    if (startDate && endDate) {
      onApply(startDate, endDate)
      setShowPicker(false)
    }
  }

  function formatDateForDisplay(dateStr: string): string {
    if (!dateStr) return ''
    const d = new Date(`${dateStr}T00:00:00.000Z`)
    return d.toLocaleDateString('es-AR')
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-lg text-xs text-muted hover:text-text hover:border-border-hover transition-colors"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        {startDate && endDate ? (
          <span>
            {formatDateForDisplay(startDate)} – {formatDateForDisplay(endDate)}
          </span>
        ) : (
          <span>Seleccionar período</span>
        )}
      </button>

      {showPicker && (
        <div className="absolute z-50 top-full mt-2 right-0 bg-surface border border-border rounded-xl shadow-2xl p-4 w-96">
          {/* Quick presets */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={() => handleQuickSelect('today')}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card hover:bg-card-hover text-muted hover:text-text transition-colors"
            >
              Hoy
            </button>
            <button
              onClick={() => handleQuickSelect('7days')}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card hover:bg-card-hover text-muted hover:text-text transition-colors"
            >
              Últimos 7 días
            </button>
            <button
              onClick={() => handleQuickSelect('30days')}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card hover:bg-card-hover text-muted hover:text-text transition-colors"
            >
              Últimos 30 días
            </button>
            <button
              onClick={() => handleQuickSelect('month')}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card hover:bg-card-hover text-muted hover:text-text transition-colors"
            >
              Este mes
            </button>
          </div>

          {/* Custom date range */}
          <div className="border-t border-border pt-4 space-y-3">
            <div>
              <label className="text-xs text-muted block mb-1">Desde</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Hasta</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-accent"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowPicker(false)}
                className="flex-1 px-3 py-1.5 rounded-lg border border-border text-muted hover:text-text transition-colors text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleApply}
                disabled={!startDate || !endDate}
                className="flex-1 px-3 py-1.5 rounded-lg bg-accent text-accent-text text-xs font-semibold hover:bg-accent-dark transition-colors disabled:opacity-40"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
