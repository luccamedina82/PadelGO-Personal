'use client'

import type { BookingMode } from '../helpers/formReducer'

interface FormModeToggleProps {
  mode: BookingMode
  onModeChange: (mode: BookingMode) => void
  onClose: () => void
}

export default function FormModeToggle({ mode, onModeChange, onClose }: FormModeToggleProps) {
  return (
    <div className="px-4 pt-3.5 pb-2.5 border-b border-border shrink-0 bg-surface/30">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex gap-1 bg-surface rounded-lg p-0.5">
          {(['RESERVA', 'BLOQUEO'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              className={`px-3 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-all ${
                mode === m
                  ? 'bg-card text-text shadow-sm'
                  : 'text-muted hover:text-text'
              }`}
            >
              {m === 'RESERVA' ? 'Reserva' : 'Bloqueo'}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-surface transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
