interface BookingDetailPaymentSectionProps {
  localPlayers: { id: string; name: string }[]
  localPaidIds: string[]
  playersDirty: boolean
  loading: boolean
  onTogglePaid: (id: string) => void
  onRemovePlayer: (id: string) => void
  onSavePlayers: () => void
}

export default function BookingDetailPaymentSection({
  localPlayers,
  localPaidIds,
  playersDirty,
  loading,
  onTogglePaid,
  onRemovePlayer,
  onSavePlayers,
}: BookingDetailPaymentSectionProps) {
  return (
    <div className="mb-4 pt-3 border-t border-border">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs text-muted font-medium">Jugadores</span>
        <span className="text-[10px] text-sub">{localPlayers.length}/4</span>
      </div>

      {localPlayers.length === 0 && (
        <p className="text-xs text-muted italic mb-2">Sin jugadores asignados.</p>
      )}

      {localPlayers.map((p) => (
        <div key={p.id} className="flex items-center gap-2 py-1.5">
          <span className="flex-1 text-sm text-text truncate">{p.name}</span>
          <button
            onClick={() => onTogglePaid(p.id)}
            disabled={loading}
            className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-semibold transition-colors disabled:opacity-40 ${
              localPaidIds.includes(p.id)
                ? 'border-green-400/30 text-green-400 bg-green-400/10 hover:bg-green-400/20'
                : 'border-orange-400/30 text-orange-400 bg-orange-400/10 hover:bg-orange-400/20'
            }`}
          >
            {localPaidIds.includes(p.id) ? 'Pagó' : 'Debe'}
          </button>
          <button
            onClick={() => onRemovePlayer(p.id)}
            disabled={loading}
            className="w-5 h-5 flex items-center justify-center rounded-full bg-card hover:bg-red-400/10 text-muted hover:text-red-400 text-sm leading-none transition-colors disabled:opacity-40"
          >
            ×
          </button>
        </div>
      ))}


      {playersDirty && (
        <button
          onClick={onSavePlayers}
          disabled={loading}
          className="mt-3 w-full py-2 rounded-xl bg-accent text-accent-text text-sm font-semibold hover:bg-accent-dark transition-colors disabled:opacity-40"
        >
          {loading ? '...' : 'Guardar jugadores'}
        </button>
      )}
    </div>
  )
}
