'use client'

import { forwardRef, useState } from 'react'
import SectionWrapper from './SectionWrapper'
import type { RecentClient } from '../hooks/useRecentClients'

interface ClientSectionProps {
  stepNumber: number
  isComplete: boolean
  isVisible: boolean
  clientName: string
  clientPhone: string
  noClient: boolean
  isPending: boolean
  isQuick: boolean
  recentClients: RecentClient[]
  onNameChange: (val: string) => void
  onPhoneChange: (val: string) => void
  onNoClientToggle: (val: boolean) => void
  onSelectRecent: (name: string, phone?: string) => void
}

const inputCls =
  'w-full bg-surface border border-border rounded-[10px] px-3 py-2.5 text-[13px] text-text outline-none focus:border-accent font-[inherit] placeholder:text-muted transition-colors'
const ring = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50'

const ClientSection = forwardRef<HTMLInputElement, ClientSectionProps>(
  function ClientSection(
    { stepNumber, isComplete, isVisible, clientName, clientPhone, noClient, isPending, isQuick,
      recentClients, onNameChange, onPhoneChange, onNoClientToggle, onSelectRecent },
    ref,
  ) {
    const [showPhone, setShowPhone] = useState(false)
    const label = isQuick ? 'A nombre de quién' : 'Datos del cliente'

    return (
      <SectionWrapper stepNumber={stepNumber} label={label} isComplete={isComplete} isVisible={isVisible}>
        <div className="flex flex-col gap-2">
          <input
            ref={ref}
            type="text"
            placeholder="Nombre del cliente *"
            value={clientName}
            onChange={(e) => onNameChange(e.target.value)}
            disabled={isPending}
            className={`${inputCls} ${ring}`}
          />
          {isQuick && !clientName && (
            <p className="text-[11px] text-muted/60 -mt-0.5">
              Ingresá el nombre del cliente o vinculá una cuenta.
            </p>
          )}

          {/* Quick chips: solo recientes (sin asignar eliminado del popover) */}
          {isQuick && recentClients.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {recentClients.map((c) => {
                const isSelected = clientName === c.name
                return (
                  <button
                    key={c.name}
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      onSelectRecent(c.name, c.phone)
                      if (c.phone) setShowPhone(true)
                    }}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer active:scale-95 ${
                      isSelected
                        ? 'bg-accent/15 border-accent/60 text-accent'
                        : 'bg-surface border-border text-muted hover:border-border-hover hover:text-text'
                    }`}
                  >
                    {c.name.split(' ')[0]}
                  </button>
                )
              })}
            </div>
          )}

          {/* Phone */}
          {isQuick ? (
            <>
              {showPhone && (
                <input
                  type="tel"
                  placeholder="Teléfono (opcional)"
                  value={clientPhone}
                  onChange={(e) => onPhoneChange(e.target.value)}
                  disabled={isPending}
                  className={`${inputCls} ${ring} animate-in fade-in slide-in-from-top-1 duration-150`}
                />
              )}
              {!showPhone && !noClient && (
                <button
                  type="button"
                  onClick={() => setShowPhone(true)}
                  className="self-start text-[11px] text-muted hover:text-text font-semibold transition-colors"
                >
                  + Teléfono
                </button>
              )}
            </>
          ) : (
            <input
              type="tel"
              placeholder="Teléfono (opcional)"
              value={clientPhone}
              onChange={(e) => onPhoneChange(e.target.value)}
              disabled={isPending}
              className={`${inputCls} ${ring}`}
            />
          )}
        </div>
      </SectionWrapper>
    )
  },
)

export default ClientSection
