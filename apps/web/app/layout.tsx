import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Saecula — Estudio católico interconectado',
  description:
    'Biblia, Catecismo, Santos, Concilios, Dogmas y eventos históricos conectados en un grafo de conocimiento y mapeados a una línea de tiempo. Multilingüe: español, inglés y latín.',
  keywords: ['Saecula', 'Biblia', 'Catecismo', 'Catolicismo', 'grafo de conocimiento', 'historia de la Iglesia'],
  openGraph: {
    title: 'Saecula',
    description:
      'Estudio católico e histórico: Biblia, Catecismo, Santos, Concilios y Dogmas conectados en un grafo de conocimiento sobre una línea de tiempo maestra.',
    type: 'website',
    locale: 'es_ES',
  },
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
