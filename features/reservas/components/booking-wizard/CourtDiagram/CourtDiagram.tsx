'use client'

import type { CourtType } from '@/types'

export interface DiagramCourt {
  id: string
  name: string
  type: CourtType
  covered: boolean
  svgX: number
  svgY: number
  svgW: number
  svgH: number
  isActive: boolean
}

interface CourtDiagramProps {
  courts: DiagramCourt[]
  selectedCourtId: string | null
  onSelectCourt: (courtId: string) => void
}

const COURT_TYPE_LABEL: Record<CourtType, string> = {
  CRISTAL: 'Cristal',
  MURO: 'Muro',
  PANORAMICA: 'Panorámica',
}

export default function CourtDiagram({
  courts,
  selectedCourtId,
  onSelectCourt,
}: CourtDiagramProps) {
  return (
    <div className="bg-surface border border-border rounded-xl p-3">
      <p className="text-xs font-semibold text-muted tracking-widest uppercase mb-2">
        Seleccioná una cancha
      </p>

      {/* SVG diagram */}
      <svg viewBox="0 0 400 260" className="w-full" aria-label="Diagrama de canchas del club">
        {/* Court grid background */}
        <rect
          x="10"
          y="10"
          width="380"
          height="240"
          rx="6"
          fill="rgba(255,255,255,0.02)"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="1"
        />

        {courts.map((court) => {
          const isSelected = court.id === selectedCourtId
          const fillColor = isSelected ? 'rgba(163,230,53,0.15)' : 'rgba(255,255,255,0.04)'
          const strokeColor = isSelected ? '#a3e635' : 'rgba(255,255,255,0.15)'
          const textColor = isSelected ? '#a3e635' : '#666'

          return (
            <g
              key={court.id}
              onClick={() => onSelectCourt(court.id)}
              className="cursor-pointer"
              role="button"
              aria-label={`${court.name} — ${court.covered ? 'Techada' : 'Exterior'}, ${COURT_TYPE_LABEL[court.type]}`}
              aria-pressed={isSelected}
            >
              {/* Shadow on hover — css via group trick not available in SVG, use filter */}
              <rect
                x={court.svgX}
                y={court.svgY}
                width={court.svgW}
                height={court.svgH}
                rx="5"
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={isSelected ? 1.5 : 1}
              />

              {/* Stripe lines to simulate padel court */}
              <line
                x1={court.svgX + court.svgW / 2}
                y1={court.svgY + 4}
                x2={court.svgX + court.svgW / 2}
                y2={court.svgY + court.svgH - 4}
                stroke={isSelected ? 'rgba(163,230,53,0.3)' : 'rgba(255,255,255,0.06)'}
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <line
                x1={court.svgX + 4}
                y1={court.svgY + court.svgH / 2}
                x2={court.svgX + court.svgW - 4}
                y2={court.svgY + court.svgH / 2}
                stroke={isSelected ? 'rgba(163,230,53,0.3)' : 'rgba(255,255,255,0.06)'}
                strokeWidth="1"
              />

              {/* Court name */}
              <text
                x={court.svgX + court.svgW / 2}
                y={court.svgY + court.svgH / 2 - 8}
                textAnchor="middle"
                fontSize="12"
                fontWeight="600"
                fill={textColor}
              >
                {court.name}
              </text>

              {/* Type + covered */}
              <text
                x={court.svgX + court.svgW / 2}
                y={court.svgY + court.svgH / 2 + 8}
                textAnchor="middle"
                fontSize="9"
                fill={isSelected ? 'rgba(163,230,53,0.7)' : 'rgba(255,255,255,0.3)'}
              >
                {court.covered ? '▲' : '◇'} {COURT_TYPE_LABEL[court.type]}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Accessible button list below diagram */}
      <div className="flex flex-wrap gap-2 mt-3">
        {courts.map((court) => (
          <button
            key={court.id}
            type="button"
            onClick={() => onSelectCourt(court.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              court.id === selectedCourtId
                ? 'bg-accent text-accent-text border-accent'
                : 'bg-card border-border text-muted hover:border-border-hover hover:text-text'
            }`}
          >
            {court.name}
          </button>
        ))}
      </div>
    </div>
  )
}
