import type { ReactNode } from 'react'
import { Archivo, Space_Mono } from 'next/font/google'
import './globals.css'

const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  display: 'swap',
})

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-space-mono',
  display: 'swap',
})

export const metadata = {
  title: 'Entrenamiento',
  description: 'Rutinas de entrenamiento para preparadores físicos y alumnos.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={`${archivo.variable} ${spaceMono.variable}`}>
      <body className="sheet-grid">{children}</body>
    </html>
  )
}
