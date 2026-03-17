'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ClubPublic } from '@/types'

// ── TYPES ─────────────────────────────────────────────────────────────────

interface ClubWithPrice extends ClubPublic {
  minPrice?: number | null
}

interface MapViewProps {
  clubs: ClubWithPrice[]
  selectedClubId?: string
  onSelectClub?: (clubId: string) => void
}

// ── COORDINATE SYSTEM ─────────────────────────────────────────────────────

// Córdoba capital bounding box (real geography)
const LAT_MAX = -31.33 // north (top)
const LAT_MIN = -31.5 // south (bottom)
const LNG_MIN = -64.27 // west  (left)
const LNG_MAX = -64.1 // east  (right)
const LAT_SPAN = Math.abs(LAT_MAX - LAT_MIN) // 0.17
const LNG_SPAN = LNG_MAX - LNG_MIN // 0.17

function toSVG(lat: number, lng: number) {
  const x = ((lng - LNG_MIN) / LNG_SPAN) * 100
  const y = ((LAT_MAX - lat) / LAT_SPAN) * 100
  return { x: Math.max(1, Math.min(99, x)), y: Math.max(1, Math.min(99, y)) }
}

function formatPrice(centavos: number): string {
  const val = centavos / 100
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`
  return `$${val.toFixed(0)}`
}

// ── SVG MAP PATHS — real Córdoba geography ────────────────────────────────

// Río Suquía: flows west→east through northern city, lat ~-31.40
const SUQUIA_PATH =
  'M 0,49 C 6,48 12,46 18,45 C 24,44 28,43 33,43 C 39,42 44,41 49,40 C 54,39 60,37 65,35 C 71,33 77,31 83,30 C 89,29 94,28 100,27'

// Parque Sarmiento — green park area in Nueva Córdoba
const psTL = toSVG(-31.42, -64.188)
const psTR = toSVG(-31.42, -64.175)
const psBR = toSVG(-31.435, -64.175)
const psBL = toSVG(-31.435, -64.188)
const PARQUE_SARMIENTO = `M ${psTL.x},${psTL.y} L ${psTR.x},${psTR.y} L ${psBR.x},${psBR.y} L ${psBL.x},${psBL.y} Z`

// Ciudad Universitaria — north-east area
const cuTL = toSVG(-31.368, -64.168)
const cuTR = toSVG(-31.368, -64.155)
const cuBR = toSVG(-31.382, -64.155)
const cuBL = toSVG(-31.382, -64.168)
const CIUDAD_UNIV = `M ${cuTL.x},${cuTL.y} L ${cuTR.x},${cuTR.y} L ${cuBR.x},${cuBR.y} L ${cuBL.x},${cuBL.y} Z`

// City block fill areas (dense urban fabric)
const CITY_BLOCKS = [
  { lat1: -31.408, lat2: -31.424, lng1: -64.2, lng2: -64.18 }, // Centro
  { lat1: -31.408, lat2: -31.418, lng1: -64.18, lng2: -64.165 }, // East center
  { lat1: -31.395, lat2: -31.408, lng1: -64.2, lng2: -64.185 }, // North center
  { lat1: -31.424, lat2: -31.44, lng1: -64.2, lng2: -64.178 }, // Nueva Córdoba
  { lat1: -31.42, lat2: -31.438, lng1: -64.218, lng2: -64.2 }, // Alberdi
  { lat1: -31.4, lat2: -31.418, lng1: -64.22, lng2: -64.202 }, // General Paz
  { lat1: -31.38, lat2: -31.396, lng1: -64.185, lng2: -64.168 }, // North resi
]

// Circunvalación ring road (approximate)
const CIRCUNVALACION_SEGMENTS = [
  { x1: 10, y1: 44, x2: 10, y2: 72 },
  { x1: 10, y1: 72, x2: 35, y2: 85 },
  { x1: 35, y1: 85, x2: 72, y2: 85 },
  { x1: 72, y1: 85, x2: 88, y2: 72 },
  { x1: 88, y1: 72, x2: 88, y2: 20 },
  { x1: 88, y1: 20, x2: 55, y2: 14 },
  { x1: 55, y1: 14, x2: 20, y2: 22 },
  { x1: 20, y1: 22, x2: 10, y2: 44 },
]

// Main avenues
const AVENUES = [
  // Bv. San Juan — east-west, lat ≈ -31.420
  {
    x1: 22,
    y1: 52.9,
    x2: 74,
    y2: 52.9,
    label: 'Bv. San Juan',
    lx: 48,
    ly: 51.6,
    rotate: 0,
  },
  // Av. Colón — north-south, lng ≈ -64.193
  {
    x1: 45.3,
    y1: 26,
    x2: 45.3,
    y2: 70,
    label: 'Av. Colón',
    lx: 43.5,
    ly: 35,
    rotate: -90,
  },
  // Av. Vélez Sársfield — diagonal NW-SE
  {
    x1: 22,
    y1: 38,
    x2: 58,
    y2: 62,
    label: 'Vélez Sársfield',
    lx: 30,
    ly: 42,
    rotate: -30,
  },
  // Bv. Chacabuco — parallel diagonal
  {
    x1: 30,
    y1: 33,
    x2: 62,
    y2: 53,
    label: '',
    lx: 0,
    ly: 0,
    rotate: 0,
  },
  // Av. Rafael Núñez — north area
  {
    x1: 52,
    y1: 27,
    x2: 74,
    y2: 40,
    label: 'Av. Núñez',
    lx: 60,
    ly: 29,
    rotate: -25,
  },
]

// Barrio labels
const BARRIOS = [
  { name: 'CENTRO', ...toSVG(-31.413, -64.192) },
  { name: 'NUEVA CÓRDOBA', ...toSVG(-31.43, -64.184) },
  { name: 'GÜEMES', ...toSVG(-31.409, -64.177) },
  { name: 'C. DE LAS ROSAS', ...toSVG(-31.386, -64.172) },
  { name: 'GENERAL PAZ', ...toSVG(-31.411, -64.213) },
  { name: 'URCA', ...toSVG(-31.445, -64.169) },
  { name: 'ALBERDI', ...toSVG(-31.432, -64.207) },
  { name: 'VILLA CABRERA', ...toSVG(-31.371, -64.161) },
]

// ── COMPONENT ─────────────────────────────────────────────────────────────

export default function MapView({ clubs, selectedClubId, onSelectClub }: MapViewProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const hoveredClub = hoveredId ? (clubs.find((c) => c.id === hoveredId) ?? null) : null

  return (
    <div
      className="relative w-full h-full min-h-[420px] rounded-2xl overflow-hidden"
      style={{ background: '#0b150a', border: '1px solid #1a2912' }}
    >
      {/* ── Realistic SVG Map ─────────────────────────────────────────── */}
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        style={{ display: 'block' }}
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Base background */}
        <rect width="100" height="100" fill="#0b150a" />

        {/* Very faint sub-grid */}
        {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((v) => (
          <g key={v}>
            <line x1={v} y1="0" x2={v} y2="100" stroke="#151f12" strokeWidth="0.12" />
            <line x1="0" y1={v} x2="100" y2={v} stroke="#151f12" strokeWidth="0.12" />
          </g>
        ))}

        {/* City block fills */}
        {CITY_BLOCKS.map((b, i) => {
          const tl = toSVG(b.lat1, b.lng1)
          const br = toSVG(b.lat2, b.lng2)
          return (
            <rect
              key={i}
              x={tl.x}
              y={tl.y}
              width={br.x - tl.x}
              height={br.y - tl.y}
              fill="#101a0e"
              rx="0.25"
            />
          )
        })}

        {/* Circunvalación (dashed outer ring) */}
        {CIRCUNVALACION_SEGMENTS.map((seg, i) => (
          <line
            key={i}
            x1={seg.x1}
            y1={seg.y1}
            x2={seg.x2}
            y2={seg.y2}
            stroke="#263820"
            strokeWidth="0.55"
            strokeDasharray="1.8 0.9"
          />
        ))}
        <text
          x="7"
          y="73"
          fontSize="1.6"
          fill="#2d4422"
          fontFamily="monospace"
          transform="rotate(-90, 7, 73)"
          style={{ userSelect: 'none' }}
        >
          Circunvalación
        </text>

        {/* Main avenues */}
        {AVENUES.map((av, i) => (
          <line
            key={i}
            x1={av.x1}
            y1={av.y1}
            x2={av.x2}
            y2={av.y2}
            stroke="#1e3016"
            strokeWidth="0.65"
          />
        ))}
        {/* Avenue labels */}
        {AVENUES.filter((av) => av.label).map((av, i) => (
          <text
            key={i}
            x={av.lx}
            y={av.ly}
            fontSize="1.65"
            fill="#283e1e"
            fontFamily="monospace"
            textAnchor="middle"
            letterSpacing="0.15"
            transform={av.rotate !== 0 ? `rotate(${av.rotate}, ${av.lx}, ${av.ly})` : undefined}
            style={{ userSelect: 'none' }}
          >
            {av.label}
          </text>
        ))}

        {/* Parque Sarmiento */}
        <path d={PARQUE_SARMIENTO} fill="#0d2010" stroke="#1c3e18" strokeWidth="0.3" />
        {(() => {
          const cx = (psTL.x + psBR.x) / 2
          const cy = (psTL.y + psBR.y) / 2
          return (
            <text
              x={cx}
              y={cy + 0.8}
              fontSize="1.7"
              fill="#2a5820"
              textAnchor="middle"
              fontFamily="monospace"
              style={{ userSelect: 'none' }}
            >
              Pque. Sarmiento
            </text>
          )
        })()}

        {/* Ciudad Universitaria */}
        <path d={CIUDAD_UNIV} fill="#0c1e22" stroke="#183040" strokeWidth="0.3" />
        {(() => {
          const cx = (cuTL.x + cuBR.x) / 2
          const cy = (cuTL.y + cuBR.y) / 2
          return (
            <text
              x={cx}
              y={cy + 0.8}
              fontSize="1.5"
              fill="#1a4058"
              textAnchor="middle"
              fontFamily="monospace"
              style={{ userSelect: 'none' }}
            >
              Ciu. Univ.
            </text>
          )
        })()}

        {/* ── Río Suquía ───────────────────────────────────────────── */}
        {/* Wide glow band */}
        <path
          d={SUQUIA_PATH}
          fill="none"
          stroke="rgba(25, 65, 140, 0.4)"
          strokeWidth="5"
          strokeLinecap="round"
        />
        {/* Main river body */}
        <path
          d={SUQUIA_PATH}
          fill="none"
          stroke="rgba(35, 100, 200, 0.55)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {/* River shimmer */}
        <path
          d={SUQUIA_PATH}
          fill="none"
          stroke="rgba(80, 160, 255, 0.22)"
          strokeWidth="0.7"
          strokeLinecap="round"
          strokeDasharray="3.5 2"
        />
        <text
          x="28"
          y="43.5"
          fontSize="2.1"
          fill="rgba(70, 130, 210, 0.7)"
          fontFamily="monospace"
          transform="rotate(-8, 28, 43.5)"
          style={{ userSelect: 'none' }}
        >
          ~ Río Suquía ~
        </text>

        {/* Barrio labels */}
        {BARRIOS.map((b) => (
          <text
            key={b.name}
            x={b.x}
            y={b.y}
            fontSize="1.85"
            fill="#2b3e22"
            textAnchor="middle"
            fontFamily="monospace"
            letterSpacing="0.35"
            fontWeight="600"
            style={{ userSelect: 'none' }}
          >
            {b.name}
          </text>
        ))}

        {/* ── Club pins ─────────────────────────────────────────────── */}
        {clubs.map((club) => {
          const pos = toSVG(club.lat, club.lng)
          const isActive = hoveredId === club.id || selectedClubId === club.id
          const r = club.colorR
          const g = club.colorG
          const b = club.colorB
          const clubColor = `rgb(${r},${g},${b})`
          const hasPrice = club.minPrice != null && club.minPrice > 0

          return (
            <g
              key={club.id}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredId(club.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => onSelectClub?.(club.id)}
            >
              {/* Outer glow ring */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={isActive ? 9.5 : 5.5}
                fill={`rgba(${r},${g},${b},${isActive ? 0.2 : 0.1})`}
                style={{ transition: 'all 0.18s ease' }}
              />
              {/* Middle ring */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={isActive ? 5.8 : 3.6}
                fill={`rgba(${r},${g},${b},${isActive ? 0.32 : 0.15})`}
                style={{ transition: 'all 0.18s ease' }}
              />
              {/* Inner solid dot */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={isActive ? 3.2 : 2.2}
                fill={clubColor}
                opacity={isActive ? 1 : 0.9}
                style={{ transition: 'all 0.18s ease' }}
              />

              {/* Price pill (above pin) */}
              {hasPrice && (
                <>
                  <rect
                    x={pos.x - 7.5}
                    y={pos.y - 14.5}
                    width={15}
                    height={6}
                    rx={3}
                    fill={isActive ? clubColor : '#0e1a0c'}
                    stroke={clubColor}
                    strokeWidth="0.45"
                    style={{ transition: 'all 0.18s ease' }}
                  />
                  <text
                    x={pos.x}
                    y={pos.y - 10.4}
                    textAnchor="middle"
                    fontSize="3"
                    fontWeight="700"
                    fontFamily="monospace"
                    fill={isActive ? '#000' : clubColor}
                    style={{ transition: 'all 0.18s ease', userSelect: 'none' }}
                  >
                    {formatPrice(club.minPrice!)}
                  </text>
                </>
              )}
            </g>
          )
        })}

        {/* ── Static overlays ───────────────────────────────────────── */}
        {/* CÓRDOBA watermark */}
        <text
          x="50"
          y="97.5"
          textAnchor="middle"
          fontSize="3.5"
          fill="#202e18"
          fontFamily="monospace"
          letterSpacing="3.5"
          fontWeight="bold"
          style={{ userSelect: 'none' }}
        >
          CÓRDOBA
        </text>

        {/* Compass N↑ */}
        <g>
          <circle
            cx="91.5"
            cy="7.5"
            r="4.2"
            fill="rgba(11,21,10,0.85)"
            stroke="#1e2e14"
            strokeWidth="0.4"
          />
          <text
            x="91.5"
            y="9.3"
            textAnchor="middle"
            fontSize="3.4"
            fill="#3a5030"
            fontFamily="monospace"
            fontWeight="bold"
            style={{ userSelect: 'none' }}
          >
            N↑
          </text>
        </g>
      </svg>

      {/* ── Hover tooltip card ────────────────────────────────────────── */}
      {hoveredClub && (
        <div
          className="absolute bottom-3 left-3 right-3 pointer-events-none z-10"
          style={{ animation: 'mapTooltipIn 0.14s ease forwards' }}
        >
          <Link
            href={`/club/${hoveredClub.id}`}
            className="pointer-events-auto block"
            style={{
              background: 'rgba(9, 16, 8, 0.93)',
              border: `1px solid rgba(${hoveredClub.colorR},${hoveredClub.colorG},${hoveredClub.colorB},0.45)`,
              borderRadius: 10,
              padding: '10px 12px',
              backdropFilter: 'blur(14px)',
              boxShadow: `0 8px 32px rgba(0,0,0,0.65), 0 0 0 1px rgba(${hoveredClub.colorR},${hoveredClub.colorG},${hoveredClub.colorB},0.12)`,
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-text text-[13px] leading-tight truncate">
                  {hoveredClub.name}
                </p>
                <p className="text-[11px] text-muted mt-0.5 flex items-center gap-1">
                  <span>📍</span> {hoveredClub.zone}
                </p>
              </div>
              <div className="flex-shrink-0 text-right">
                <span
                  className="text-[12px] font-semibold block"
                  style={{
                    color: `rgb(${hoveredClub.colorR},${hoveredClub.colorG},${hoveredClub.colorB})`,
                  }}
                >
                  ★ {hoveredClub.rating.toFixed(1)}
                </span>
                {hoveredClub.minPrice != null && (
                  <span className="text-[11px] text-muted font-mono block">
                    {formatPrice(hoveredClub.minPrice)}/hr
                  </span>
                )}
              </div>
            </div>
            {hoveredClub.vibe && (
              <p className="text-[11px] text-muted mt-1.5 leading-snug line-clamp-1 truncate">
                {hoveredClub.vibe}
              </p>
            )}
          </Link>
        </div>
      )}

      {/* Empty state */}
      {clubs.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-sub text-sm">Sin clubes en el mapa</p>
        </div>
      )}

      {/* Tooltip fade animation */}
      <style>{`
        @keyframes mapTooltipIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
