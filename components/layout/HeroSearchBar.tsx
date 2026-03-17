'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const ZONES = [
  'Nueva Córdoba',
  'Güemes',
  'Cerro de las Rosas',
  'General Paz',
  'Urca',
  'Alberdi',
  'Villa Cabrera',
  'Barrio Jardín',
]

const TIMES = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
  '21:00',
  '22:00',
]

function getDates() {
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const months = [
    'ene',
    'feb',
    'mar',
    'abr',
    'may',
    'jun',
    'jul',
    'ago',
    'sep',
    'oct',
    'nov',
    'dic',
  ]
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return {
      id: i === 0 ? 'hoy' : i === 1 ? 'mañana' : `${d.getDate()}/${d.getMonth() + 1}`,
      label: i === 0 ? 'HOY' : i === 1 ? 'MAÑANA' : days[d.getDay()].toUpperCase(),
      num: d.getDate(),
      month: months[d.getMonth()],
      full: i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : `${d.getDate()} ${months[d.getMonth()]}`,
    }
  })
}

export default function HeroSearchBar() {
  const router = useRouter()
  const [zone, setZone] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [open, setOpen] = useState<'zone' | 'date' | 'time' | null>(null)

  const dates = getDates()

  function handleSearch() {
    setOpen(null)
    const params = new URLSearchParams()
    if (zone) params.set('zona', zone)
    const qs = params.toString()
    router.push(qs ? `/buscar?${qs}` : '/buscar')
  }

  const segBase =
    'flex-1 px-4 py-3.5 cursor-pointer relative transition-colors select-none rounded-xl'
  const segActive = 'bg-white/10'

  return (
    <div className="relative w-full max-w-2xl">
      {/* Main bar */}
      <div
        className="flex items-stretch rounded-2xl overflow-visible"
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
        }}
      >
        {/* Zona */}
        <div
          className={`${segBase} ${open === 'zone' ? segActive : ''}`}
          onClick={() => setOpen(open === 'zone' ? null : 'zone')}
        >
          <span className="block text-[10px] font-bold uppercase tracking-widest text-white/50 mb-0.5">
            Zona
          </span>
          <span className={`text-sm font-medium ${zone ? 'text-white/95' : 'text-white/35'}`}>
            {zone || '¿Dónde querés jugar?'}
          </span>
          {open === 'zone' && (
            <div
              className="absolute top-[calc(100%+8px)] left-0 z-50 rounded-xl overflow-hidden"
              style={{
                minWidth: 230,
                background: 'var(--card)',
                border: '1px solid var(--border-hover)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.65)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-3 py-2 text-[10px] text-muted uppercase tracking-widest border-b border-border">
                Barrios de Córdoba
              </div>
              {ZONES.map((z) => (
                <div
                  key={z}
                  onClick={() => {
                    setZone(z)
                    setOpen(null)
                  }}
                  className="flex items-center gap-2 px-3 py-2.5 text-[13px] text-text cursor-pointer hover:bg-card-hover transition-colors"
                >
                  <span className="text-muted text-[11px]">📍</span> {z}
                </div>
              ))}
              <div
                onClick={() => {
                  setZone('')
                  setOpen(null)
                }}
                className="px-3 py-2.5 text-[12px] text-accent cursor-pointer hover:bg-card-hover transition-colors border-t border-border"
              >
                Ver todos los clubes →
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="self-stretch w-px my-2.5 bg-white/10 flex-shrink-0" />

        {/* Fecha */}
        <div
          className={`${segBase} ${open === 'date' ? segActive : ''}`}
          onClick={() => setOpen(open === 'date' ? null : 'date')}
        >
          <span className="block text-[10px] font-bold uppercase tracking-widest text-white/50 mb-0.5">
            Fecha
          </span>
          <span className={`text-sm font-medium ${date ? 'text-white/95' : 'text-white/35'}`}>
            {date || '¿Cuándo?'}
          </span>
          {open === 'date' && (
            <div
              className="absolute top-[calc(100%+8px)] left-0 z-50 rounded-xl p-3"
              style={{
                minWidth: 380,
                background: 'var(--card)',
                border: '1px solid var(--border-hover)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.65)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="grid grid-cols-7 gap-1.5">
                {dates.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => {
                      setDate(d.full)
                      setOpen(null)
                    }}
                    className="flex flex-col items-center py-1.5 rounded-xl cursor-pointer text-center transition-colors"
                    style={{
                      background: date === d.full ? 'var(--accent)' : 'var(--card-hover)',
                    }}
                  >
                    <span className="text-[9px] text-muted uppercase tracking-wide">
                      {d.label.slice(0, 3)}
                    </span>
                    <span
                      className="font-mono text-[15px] font-semibold leading-none mt-0.5"
                      style={{ color: date === d.full ? 'var(--accent-text)' : 'var(--text)' }}
                    >
                      {d.num}
                    </span>
                    <span className="text-[9px] text-muted">{d.month}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="self-stretch w-px my-2.5 bg-white/10 flex-shrink-0" />

        {/* Horario */}
        <div
          className={`${segBase} ${open === 'time' ? segActive : ''}`}
          onClick={() => setOpen(open === 'time' ? null : 'time')}
        >
          <span className="block text-[10px] font-bold uppercase tracking-widest text-white/50 mb-0.5">
            Horario
          </span>
          <span className={`text-sm font-medium ${time ? 'text-white/95' : 'text-white/35'}`}>
            {time || '¿A qué hora?'}
          </span>
          {open === 'time' && (
            <div
              className="absolute top-[calc(100%+8px)] left-0 z-50 rounded-xl p-3"
              style={{
                minWidth: 290,
                background: 'var(--card)',
                border: '1px solid var(--border-hover)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.65)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="grid grid-cols-4 gap-1.5">
                {TIMES.map((t) => (
                  <div
                    key={t}
                    onClick={() => {
                      setTime(t)
                      setOpen(null)
                    }}
                    className="py-1.5 rounded-lg cursor-pointer text-center font-mono text-[12px] font-semibold transition-colors"
                    style={{
                      background: time === t ? 'var(--accent)' : 'var(--card-hover)',
                      color: time === t ? 'var(--accent-text)' : 'var(--text)',
                    }}
                  >
                    {t}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Search button */}
        <div className="flex items-center pr-2.5 pl-2 flex-shrink-0">
          <button
            onClick={handleSearch}
            className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
            style={{
              background: 'var(--accent)',
              color: 'var(--accent-text)',
              boxShadow: '0 4px 20px var(--glow)',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </button>
        </div>
      </div>

      {/* Click-outside overlay */}
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(null)} />}
    </div>
  )
}
