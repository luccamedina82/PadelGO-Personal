import type { ReactNode } from 'react'
import { Suspense } from 'react'

interface ReservasLayoutProps {
  children: ReactNode
  modal: ReactNode
}

export default function ReservasLayout({ children, modal }: ReservasLayoutProps) {
  return (
    <>
      {children}
      <Suspense fallback={null}>{modal}</Suspense>
    </>
  )
}
