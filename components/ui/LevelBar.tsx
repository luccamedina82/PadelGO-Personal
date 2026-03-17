interface LevelBarProps {
  level: number // 1.0 → 10.0
  showLabel?: boolean
  showCategory?: boolean
  className?: string
}

export function getLevelCategory(level: number): string {
  if (level <= 3.0) return 'Principiante'
  if (level <= 5.0) return 'Intermedio'
  if (level <= 7.0) return 'Avanzado'
  if (level <= 9.0) return 'Competitivo'
  return 'Élite'
}

export default function LevelBar({
  level,
  showLabel = true,
  showCategory = true,
  className,
}: LevelBarProps) {
  const clamped = Math.min(10, Math.max(1, level))
  const levelFloor = Math.floor(clamped)
  const progress = ((clamped - levelFloor) / 1.0) * 100

  return (
    <div className={className}>
      {(showLabel || showCategory) && (
        <div className="flex items-baseline justify-between mb-1.5">
          {showLabel && (
            <span className="font-mono text-xl font-semibold text-accent">
              {clamped.toFixed(1)}
            </span>
          )}
          {showCategory && <span className="text-xs text-muted">{getLevelCategory(clamped)}</span>}
        </div>
      )}
      <div className="h-1.5 bg-surface rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-sub">Nivel {levelFloor}</span>
          <span className="text-[10px] text-sub">Nivel {Math.min(10, levelFloor + 1)}</span>
        </div>
      )}
    </div>
  )
}
