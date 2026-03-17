'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createReview } from '@/actions/reviews'

interface ReviewFormProps {
  clubId: string
  clubName: string
  initialRating?: number
  initialComment?: string | null
}

export default function ReviewForm({
  clubId,
  clubName,
  initialRating,
  initialComment,
}: ReviewFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [rating, setRating] = useState(initialRating ?? 0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState(initialComment ?? '')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  )
  const [submitted, setSubmitted] = useState(!!initialRating)

  function handleSubmit() {
    if (rating === 0) {
      setFeedback({ type: 'error', message: 'Seleccioná una puntuación.' })
      return
    }

    setFeedback(null)
    startTransition(async () => {
      const result = await createReview(clubId, rating, comment || undefined)
      if (result.success) {
        setFeedback({ type: 'success', message: '¡Reseña guardada!' })
        setSubmitted(true)
        router.refresh()
      } else {
        setFeedback({ type: 'error', message: result.error })
      }
    })
  }

  const displayRating = hovered || rating

  if (submitted && feedback?.type === 'success') {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">⭐</span>
          <div>
            <p className="text-sm font-semibold text-text">¡Gracias por tu reseña!</p>
            <p className="text-xs text-muted">Tu opinión ayuda a otros jugadores.</p>
          </div>
        </div>
        <div className="flex gap-0.5 mt-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <span key={s} className={`text-lg ${s <= rating ? 'text-accent' : 'text-sub'}`}>
              ★
            </span>
          ))}
        </div>
        {comment && <p className="text-xs text-muted mt-1 italic">&quot;{comment}&quot;</p>}
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold text-text mb-1">
        ¿Cómo fue tu experiencia en {clubName}?
      </h3>
      <p className="text-xs text-muted mb-3">Tu reseña ayuda a otros jugadores</p>

      {feedback && (
        <div
          className={`text-xs px-3 py-2 rounded-lg border mb-3 ${
            feedback.type === 'success'
              ? 'text-green-400 bg-green-400/10 border-green-500/30'
              : 'text-red-400 bg-red-400/10 border-red-500/30'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Star rating */}
      <div
        className="flex gap-1 mb-3"
        onMouseLeave={() => setHovered(0)}
        role="group"
        aria-label="Puntuación"
      >
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setRating(s)}
            onMouseEnter={() => setHovered(s)}
            aria-label={`${s} estrella${s > 1 ? 's' : ''}`}
            disabled={isPending}
            className={`text-2xl transition-transform hover:scale-110 disabled:opacity-50 ${
              s <= displayRating ? 'text-accent' : 'text-sub'
            }`}
          >
            ★
          </button>
        ))}
        {rating > 0 && (
          <span className="text-xs text-muted self-center ml-2">
            {['', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente'][rating]}
          </span>
        )}
      </div>

      {/* Comment */}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Contá tu experiencia (opcional)..."
        rows={2}
        maxLength={300}
        disabled={isPending}
        className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-sub focus:outline-none focus:border-border-hover resize-none mb-3 disabled:opacity-50"
      />

      <button
        onClick={handleSubmit}
        disabled={isPending || rating === 0}
        className="w-full py-2.5 bg-accent text-accent-text font-semibold text-sm rounded-lg hover:bg-accent-dark transition-colors disabled:opacity-50"
      >
        {isPending ? 'Guardando...' : initialRating ? 'Actualizar reseña' : 'Publicar reseña'}
      </button>
    </div>
  )
}
