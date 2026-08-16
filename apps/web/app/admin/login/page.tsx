'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authApi, apiErrorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth-store'

export default function AdminLoginPage() {
  const router = useRouter()
  const { setSession } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await authApi.login(email, password)
      setSession({ token: res.token, email: res.user.email, role: res.user.role })
      router.push('/admin/grafo')
      router.refresh()
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h1>Saecula Admin</h1>
        <p className="sub">Acceso restringido al panel de administración</p>
        {error && <div className="error">{error}</div>}
        <div className="form-grid">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@saecula.app"
              required
              autoComplete="username"
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </div>
        <p className="status-line" style={{ marginTop: 14 }}>
          <Link href="/">← Volver a la landing</Link>
        </p>
      </form>
    </div>
  )
}
