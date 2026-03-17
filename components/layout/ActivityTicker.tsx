'use client'

import { useState, useEffect } from 'react'

const MESSAGES = [
  '🟢 Martín reservó Arena Padel Cerro · hace 2 min',
  '⚡ Club Güemes Padel — 3 canchas libres esta noche',
  '🏆 Torneo relámpago en Padel Córdoba este sábado',
  '🟢 Laura confirmó turno en Green Court Urca · hace 5 min',
  '⚡ Punto de Padel Alberdi — 4 horarios disponibles hoy',
  '🏆 Open Match disponible en Nueva Córdoba · nivel 3.5',
]

export default function ActivityTicker() {
  const [idx, setIdx] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIdx((i) => (i + 1) % MESSAGES.length)
        setVisible(true)
      }, 350)
    }, 3500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className="w-full overflow-hidden"
      style={{
        background: 'rgba(212,240,0,0.04)',
        borderTop: '1px solid rgba(212,240,0,0.08)',
        borderBottom: '1px solid rgba(212,240,0,0.08)',
      }}
    >
      <div className="max-w-[1360px] mx-auto px-10 py-2 flex items-center gap-3">
        <span
          className="flex-shrink-0 text-[10px] font-bold uppercase tracking-widest"
          style={{ color: 'var(--accent)', opacity: 0.7 }}
        >
          EN VIVO
        </span>
        <div className="h-3 w-px flex-shrink-0" style={{ background: 'rgba(212,240,0,0.2)' }} />
        <p
          className="text-[12px] text-muted font-medium transition-opacity duration-300"
          style={{ opacity: visible ? 1 : 0 }}
        >
          {MESSAGES[idx]}
        </p>
      </div>
    </div>
  )
}
