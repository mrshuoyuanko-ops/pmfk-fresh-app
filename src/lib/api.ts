const TOKEN_KEY = 'pmfk-token'

// Point this at your backend (e.g. Render) when hosting the frontend statically.
// Leave empty to use the same origin (local dev / full-stack host).
export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t: string | null) => {
  if (t) localStorage.setItem(TOKEN_KEY, t)
  else localStorage.removeItem(TOKEN_KEY)
}

export interface MarketplaceTutor {
  id: string
  pseudonym: string
  avatar: string
  subjects: string[]
  rate: number
  bio: string
  verified: boolean
  rating: number
  reviewCount: number
}

export interface AuthResponse {
  token: string
  state: unknown
  marketplace: MarketplaceTutor[]
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers: { ...headers, ...((options.headers as Record<string, string>) || {}) } })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

export const api = {
  register: (name: string, email: string, password: string) =>
    request<AuthResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  login: (email: string, password: string) =>
    request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request<AuthResponse & { email: string }>('/api/me'),
  sync: (state: unknown) => request<{ ok: boolean }>('/api/sync', { method: 'PUT', body: JSON.stringify({ state }) }),
  erase: () => request<{ ok: boolean }>('/api/account', { method: 'DELETE' }),
  checkin: (insideZone: boolean, role: string, sessionId = '') =>
    request<{ checkIn: { id: string; insideZone: boolean } }>('/api/checkin', { method: 'POST', body: JSON.stringify({ insideZone, role, sessionId }) }),
  review: (tutorId: string, rating: number, comment: string) =>
    request<{ rating: number; reviewCount: number }>(`/api/marketplace/${tutorId}/review`, { method: 'POST', body: JSON.stringify({ rating, comment }) }),
  rooms: () => request<{ code: string }>('/api/rooms', { method: 'POST' }),
}
