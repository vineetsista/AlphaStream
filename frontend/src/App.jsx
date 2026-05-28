import React, { createContext, useContext, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { loadSession, clearSession, api, saveSession } from './api.js'
import Landing from './pages/Landing.jsx'
import SignIn from './pages/SignIn.jsx'
import Onboarding from './pages/Onboarding.jsx'
import VerifyEmail from './pages/VerifyEmail.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Backtest from './pages/Backtest.jsx'
import Settings from './pages/Settings.jsx'
import Portfolio from './pages/Portfolio.jsx'
import Analytics from './pages/Analytics.jsx'
import Admin from './pages/Admin.jsx'
import { DemoProvider } from './hooks/useDemo.jsx'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

function AuthProvider({ children }) {
  const [user, setUser] = useState(loadSession)
  const [loading, setLoading] = useState(false)

  const login = (u) => {
    saveSession(u)
    setUser(u)
  }

  const logout = () => {
    clearSession()
    setUser(null)
  }

  const refresh = async () => {
    try {
      const fresh = await api.me()
      const stored = loadSession()
      if (stored) {
        const merged = { ...fresh, api_key: stored.api_key }
        saveSession(merged)
        setUser(merged)
      }
    } catch {
      logout()
    }
  }

  return (
    <AuthCtx.Provider value={{ user, login, logout, refresh, loading, setLoading }}>
      {children}
    </AuthCtx.Provider>
  )
}

function RequireAuth({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/signin" state={{ from: location }} replace />
  return children
}

function RequireGuest({ children }) {
  const { user } = useAuth()
  if (user) return <Navigate to="/dashboard" replace />
  return children
}

function RequireAdmin({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/signin" replace />
  if (!user.is_admin) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DemoProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/signin" element={<RequireGuest><SignIn /></RequireGuest>} />
            <Route path="/onboarding" element={<RequireGuest><Onboarding /></RequireGuest>} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
            <Route path="/backtest" element={<RequireAuth><Backtest /></RequireAuth>} />
            <Route path="/portfolio" element={<RequireAuth><Portfolio /></RequireAuth>} />
            <Route path="/analytics" element={<RequireAuth><Analytics /></RequireAuth>} />
            <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
            <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </DemoProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
