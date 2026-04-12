'use client'

interface OobWarningProps {
  isVisible: boolean
  confirmed: boolean
  onToggle: (checked: boolean) => void
}

export default function OobWarning({ isVisible, confirmed, onToggle }: OobWarningProps) {
  if (!isVisible) return null

  return (
    <div className="flex flex-col gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 animate-in fade-in duration-150">
      <div className="flex items-center gap-1.5">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-amber-400">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span className="text-[11px] font-semibold text-amber-400">Fuera del horario operativo</span>
      </div>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => onToggle(e.target.checked)}
          className="w-3.5 h-3.5 accent-amber-400 cursor-pointer"
        />
        <span className="text-[11px] text-muted">Confirmar reserva igualmente</span>
      </label>
    </div>
  )
}
