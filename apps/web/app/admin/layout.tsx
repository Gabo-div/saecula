'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-store'

function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { email, role, clear } = useAuth()

  const links = [
    { href: '/admin/grafo', label: 'Grafo' },
    { href: '/admin/nodos', label: 'Nodos' },
    { href: '/admin/textos', label: 'Textos' },
  ]

  function logout() {
    clear()
    router.push('/admin/login')
  }

  return (
    <aside className="admin-sidebar">
      <Link className="brand" href="/admin">
        <span className="brand-mark">S</span>
        Saecula
      </Link>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={pathname.startsWith(l.href) ? 'active' : ''}>
          {l.label}
        </Link>
      ))}
      <div className="spacer" />
      <div className="user-info">
        <span>{email}</span>
        <span>rol: {role}</span>
        <button className="btn btn-small btn-ghost" onClick={logout}>
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const token = useAuth((s) => s.token)
  const [checked, setChecked] = useState(false)

  // Gate the whole section: without a token only /admin/login is reachable.
  useEffect(() => {
    if (!token && typeof window !== 'undefined') {
      if (!window.location.pathname.startsWith('/admin/login')) {
        router.replace('/admin/login')
      }
    }
    setChecked(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  if (!token) {
    return <>{children}</> // the login page renders itself
  }

  return (
    <div className="admin-shell">
      <Sidebar />
      <main className="admin-main">{children}</main>
    </div>
  )
}
