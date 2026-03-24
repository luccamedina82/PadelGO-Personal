import type { Metadata } from 'next'
import { Bebas_Neue, DM_Sans, DM_Mono, Montserrat } from 'next/font/google'
import './globals.css'
import ThemeInitScript from '@/components/layout/ThemeInitScript'
import { Toaster } from '@/components/ui/sonner'

const bebasNeue = Bebas_Neue({
  weight: '400',
  variable: '--font-bebas',
  subsets: ['latin'],
  display: 'swap',
})

const montserrat = Montserrat({
  variable: '--font-montserrat',
  subsets: ['latin'],
  display: 'swap',
})

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  display: 'swap',
})

const dmMono = DM_Mono({
  weight: ['400', '500'],
  variable: '--font-dm-mono',
  subsets: ['latin'],
  display: 'swap',
})

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://padelgo.ar'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'PadelGo — Reservá tu cancha',
    template: '%s | PadelGo',
  },
  description:
    'La plataforma de reserva de canchas de pádel en Buenos Aires. Encontrá tu club, reservá en segundos.',
  keywords: ['pádel', 'padel', 'cancha', 'reserva', 'Buenos Aires', 'club', 'deporte'],
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    url: APP_URL,
    siteName: 'PadelGo',
    title: 'PadelGo — Reservá tu cancha',
    description:
      'La plataforma de reserva de canchas de pádel en Buenos Aires. Encontrá tu club, reservá en segundos.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PadelGo — Reservá tu cancha',
    description: 'Reservá canchas de pádel en Buenos Aires. Rápido, fácil y sin llamadas.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${bebasNeue.variable} ${montserrat.variable} ${dmSans.variable} ${dmMono.variable}`}
    >
      <head>
        {/* Inline script: apply saved theme before first paint to avoid flash */}
        <ThemeInitScript />
      </head>
      <body className="font-body bg-bg text-text antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
