import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const DemoCtx = createContext({ demoMode: false, setDemoMode: () => {}, toggleDemoMode: () => {} })

const STORAGE_KEY = 'alpha_demo_mode'

export function DemoProvider({ children }) {
  const [demoMode, setDemoModeState] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1' } catch { return false }
  })

  const setDemoMode = useCallback((v) => {
    setDemoModeState(v)
    try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0') } catch { /* noop */ }
  }, [])

  const toggleDemoMode = useCallback(() => setDemoMode(!demoMode), [demoMode, setDemoMode])

  useEffect(() => {
    // expose so a vanilla fetch elsewhere can read it
    window.__alpha_demo_mode = demoMode
  }, [demoMode])

  return (
    <DemoCtx.Provider value={{ demoMode, setDemoMode, toggleDemoMode }}>
      {children}
    </DemoCtx.Provider>
  )
}

export const useDemo = () => useContext(DemoCtx)
