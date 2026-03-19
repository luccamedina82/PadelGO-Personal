'use client'

import { useRouter } from 'next/navigation'

export default function ModalCloseBackdrop() {
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="Cerrar nueva reserva"
      className="absolute inset-0 bg-black/60 backdrop-blur-sm"
    />
  )
}
