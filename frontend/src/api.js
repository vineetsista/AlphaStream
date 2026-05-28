const BASE = import.meta.env.VITE_API_URL || ''

const key = () => localStorage.getItem('alpha_api_key') || ''

const h = (extra = {}) => ({
  'Content-Type': 'application/json',
  'X-API-Key': key(),
  ...extra,
})

async function _req(method, path, body) {
  const opts = { method, headers: h() }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const r = await fetch(`${BASE}${path}`, opts)
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw data
  return data
}

export const api = {
  get: (path) => _req('GET', path),
  post: (path, body) => _req('POST', path, body),
  patch: (path, body) => _req('PATCH', path, body),
  del: (path) => _req('DELETE', path),

  // Auth
  register: (d) => api.post('/api/auth/register', d),
  login: (d) => api.post('/api/auth/login', d),
  me: () => api.get('/api/auth/me'),
  verifyEmail: (token) => api.post(`/api/verify-email/${token}`),
  resendVerification: (email) => api.post('/api/resend-verification', { email }),
  forgotPassword: (email) => api.post('/api/forgot-password', { email }),
  resetPassword: (token, password) => api.post(`/api/reset-password/${token}`, { password }),

  // Signals
  getSignals: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return api.get(`/api/signals${q ? '?' + q : ''}`)
  },
  scanNow: () => api.post('/api/signals/scan'),
  getSignal: (id) => api.get(`/api/signals/${id}`),
  deleteSignal: (id) => api.del(`/api/signals/${id}`),
  updateOutcome: (id, actual_outcome) => api.patch(`/api/signals/${id}/outcome`, { actual_outcome }),
  resolveOutcomes: () => api.post('/api/signals/resolve'),

  // Backtest
  getBacktest: (days = 30) => api.get(`/api/backtest?days=${days}`),
  getBacktestHistory: (days = 30) => api.get(`/api/backtest/history?days=${days}`),

  // Markets
  getWatchedMarkets: () => api.get('/api/markets/watched'),
  addWatchedMarket: (d) => api.post('/api/markets/watched', d),
  deleteWatchedMarket: (id) => api.del(`/api/markets/watched/${id}`),

  // Settings
  getSettings: () => api.get('/api/settings'),
  updateSettings: (d) => api.patch('/api/settings', d),
  changePassword: (d) => api.post('/api/settings/change-password', d),
  testDiscord: () => api.post('/api/settings/discord/test'),
  rotateApiKey: () => api.post('/api/settings/rotate-api-key'),

  // Portfolio
  getPortfolioExposure: () => api.get('/api/portfolio/exposure'),

  // Calibration
  getCalibration: () => api.get('/api/calibration'),

  // Analytics
  getAnalyticsBreakdown: () => api.get('/api/analytics/breakdown'),

  // Export
  exportSignalsCsv: async () => {
    const resp = await fetch(`${BASE}/api/signals/export`, { headers: h() })
    if (!resp.ok) throw await resp.json().catch(() => ({}))
    const blob = await resp.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'alphastream_signals.csv'; a.click()
    URL.revokeObjectURL(url)
  },

  // Push notifications
  getVapidKey: () => api.get('/api/push/vapid-key'),
  subscribePush: (subscription) => api.post('/api/push/subscribe', subscription),
  unsubscribePush: (endpoint) => api.del('/api/push/subscribe'),

  // Admin
  adminStats: () => api.get('/api/admin/stats'),
  adminListUsers: () => api.get('/api/admin/users'),
  adminScan: () => api.post('/api/admin/scan'),
  adminSeedDemo: () => api.post('/api/admin/demo/seed'),
  adminClearDemo: () => api.post('/api/admin/demo/clear'),
}

export function saveSession(user) {
  localStorage.setItem('alpha_api_key', user.api_key)
  localStorage.setItem('alpha_user', JSON.stringify(user))
}

export function loadSession() {
  try {
    const raw = localStorage.getItem('alpha_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearSession() {
  localStorage.removeItem('alpha_api_key')
  localStorage.removeItem('alpha_user')
}
