'use client'

import type { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
  labelId?: string
  title?: string
}

const sizeMap = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
}

export default function Modal({
  open,
  onClose,
  children,
  size = 'sm',
  title,
}: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className={`${sizeMap[size]} bg-surface border-border-hover p-5`} showCloseButton={false}>
        {title && <DialogTitle className="sr-only">{title}</DialogTitle>}
        {!title && <DialogTitle className="sr-only">Modal</DialogTitle>}
        {children}
      </DialogContent>
    </Dialog>
  )
}
