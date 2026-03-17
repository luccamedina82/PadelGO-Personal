'use client'

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="hidden md:flex items-center gap-1 px-2.5 py-1 bg-card border border-border rounded-lg text-[10px] text-muted hover:text-text hover:border-border-hover transition-colors"
      type="button"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <polyline points="6,9 6,2 18,2 18,9" />
        <path d="M6,18 L4,18 C2.9,18 2,17.1 2,16 L2,11 C2,9.9 2.9,9 4,9 L20,9 C21.1,9 22,9.9 22,11 L22,16 C22,17.1 21.1,18 20,18 L18,18" />
        <rect x="6" y="14" width="12" height="8" />
      </svg>
      Imprimir
    </button>
  )
}
