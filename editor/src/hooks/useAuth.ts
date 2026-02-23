import { useCallback, useEffect, useState } from 'react'
import type { User } from '../types'
import { apiFetch, readApiError } from '../api/client'

type UseAuthResult = {
  jwt: string
  user: User | null
  apiBase: string
  setApiBase: (value: string) => void
  authEmail: string
  setAuthEmail: (value: string) => void
  authPassword: string
  setAuthPassword: (value: string) => void
  status: string
  error: string
  login: () => Promise<void>
  register: () => Promise<void>
  logout: () => void
  setJwt: (value: string) => void
  setUser: (value: User | null) => void
  refreshUser: () => Promise<void>
  clearError: () => void
  clearStatus: () => void
}

export function useAuth(defaultApiBase: string): UseAuthResult {
  const [jwt, setJwt] = useState(() => localStorage.getItem('zodiac_editor.jwt') ?? '')
  const [user, setUser] = useState<User | null>(null)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [apiBase, setApiBase] = useState(
    () => localStorage.getItem('zodiac_editor.apiBaseUrl') ?? defaultApiBase
  )
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    localStorage.setItem('zodiac_editor.apiBaseUrl', apiBase)
  }, [apiBase])

  useEffect(() => {
    if (jwt) {
      localStorage.setItem('zodiac_editor.jwt', jwt)
    } else {
      localStorage.removeItem('zodiac_editor.jwt')
    }
  }, [jwt])

  const refreshUser = useCallback(async () => {
    if (!jwt) {
      setUser(null)
      return
    }
    const response = await apiFetch(`${apiBase}/api/auth/me`, jwt)
    if (!response.ok) {
      setUser(null)
      return
    }
    const data = (await response.json()) as User
    setUser(data)
  }, [apiBase, jwt])

  useEffect(() => {
    queueMicrotask(() => {
      refreshUser().catch(() => undefined)
    })
  }, [refreshUser])

  const login = async () => {
    setError('')
    setStatus('')
    const response = await fetch(`${apiBase}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: authEmail, password: authPassword }),
    })
    if (!response.ok) {
      const detail = await readApiError(response)
      setError(detail ?? 'Login failed.')
      return
    }
    const data = (await response.json()) as {
      token: string
      user: { id: string; email: string; is_admin?: boolean }
    }
    setJwt(data.token)
    setUser(data.user)
    setStatus('Logged in.')
    setAuthPassword('')
  }

  const register = async () => {
    setError('')
    setStatus('')
    const response = await fetch(`${apiBase}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: authEmail, password: authPassword }),
    })
    if (!response.ok) {
      const detail = await readApiError(response)
      setError(detail ?? 'Registration failed.')
      return
    }
    const data = (await response.json()) as {
      token: string
      user: { id: string; email: string; is_admin?: boolean }
    }
    setJwt(data.token)
    setUser(data.user)
    setStatus('Account created.')
    setAuthPassword('')
  }

  const logout = () => {
    setJwt('')
    setUser(null)
    setStatus('Logged out.')
  }

  const clearError = () => setError('')
  const clearStatus = () => setStatus('')

  return {
    jwt,
    user,
    apiBase,
    setApiBase,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    status,
    error,
    login,
    register,
    logout,
    setJwt,
    setUser,
    refreshUser,
    clearError,
    clearStatus,
  }
}
