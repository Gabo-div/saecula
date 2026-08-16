'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReactNode } from 'react'
import TamaguiProviderWrapper from './TamaguiProvider'

const NAV_LINKS = [
  { href: '/biblia', label: 'Biblia' },
  { href: '/catecismo', label: 'Catecismo' },
  { href: '/lecturas', label: 'Lecturas' },
  { href: '/prayers', label: 'Oraciones' },
  { href: '/chat', label: 'Preguntar' },
]

export default function ReaderLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <TamaguiProviderWrapper>
      <div className="reader-shell">
        <header className="reader-header">
          <Link className="brand" href="/">
            <span className="brand-mark">S</span>
            Saecula
          </Link>
          <nav className="reader-nav">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={pathname.startsWith(l.href) ? 'active' : ''}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="reader-main">{children}</main>
      </div>
    </TamaguiProviderWrapper>
  )
}
