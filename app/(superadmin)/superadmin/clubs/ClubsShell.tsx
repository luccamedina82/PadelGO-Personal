'use client'

import { useState } from 'react'
import CreateClubForm from './CreateClubForm'

export default function ClubsShell({ children }: { children: React.ReactNode }) {
  const [showForm, setShowForm] = useState(false)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1
            className="font-display text-3xl tracking-wide uppercase"
            style={{ color: '#a855f7' }}
          >
            Clubes
          </h1>
          <p className="text-sm text-muted mt-0.5">Gestión de clubes de la plataforma</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            style={{ background: '#a855f7', color: 'white' }}
          >
            + Nuevo club
          </button>
        )}
      </div>

      {showForm && <CreateClubForm onCancel={() => setShowForm(false)} />}

      {children}
    </div>
  )
}
