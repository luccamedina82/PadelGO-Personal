import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "bg-destructive text-white focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 [a&]:hover:bg-destructive/90",
        outline:
          "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

// ── Project-specific Badge wrapper ──────────────────────────────────────────
type ProjectBadgeVariant = 'accent' | 'green' | 'yellow' | 'red' | 'muted' | 'purple'

const projectVariantClasses: Record<ProjectBadgeVariant, string> = {
  accent: 'bg-accent/10 text-accent border border-accent/20',
  green: 'bg-green-500/10 text-green-400 border border-green-500/20',
  yellow: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
  red: 'bg-red-500/10 text-red-400 border border-red-500/20',
  muted: 'bg-surface text-muted border border-border',
  purple: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
}

interface ProjectBadgeProps {
  label: string
  variant?: ProjectBadgeVariant
  className?: string
}

function ProjectBadge({ label, variant = 'muted', className }: ProjectBadgeProps) {
  return (
    <Badge
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium',
        projectVariantClasses[variant],
        className
      )}
    >
      {label}
    </Badge>
  )
}

export { Badge, badgeVariants }
export default ProjectBadge
