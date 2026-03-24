export default function StepDots({ current }: { current: number }) {
  const steps = ['Horario', 'Cliente', 'Confirmar']
  return (
    <div className="flex items-center select-none">
      {steps.map((label, i) => {
        const n = i + 1
        const done = n < current
        const active = n === current
        return (
          <div key={n} className="flex items-center">
            <div className="flex flex-col items-center gap-1 w-[64px]">
              <div
                className={[
                  'w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-300',
                  done ? 'bg-accent text-accent-text' : '',
                  active ? 'bg-accent text-accent-text ring-[3px] ring-accent/20' : '',
                  !done && !active ? 'bg-card border border-border text-sub' : '',
                ].join(' ')}
              >
                {done ? (
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  n
                )}
              </div>
              <span
                className={`text-[9px] font-bold tracking-widest uppercase whitespace-nowrap
                               ${active ? 'text-accent' : 'text-sub'}`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-8 h-px mb-4 transition-colors duration-500
                               ${done ? 'bg-accent' : 'bg-border'}`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
