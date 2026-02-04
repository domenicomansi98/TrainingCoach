import { useEffect, useRef, useState } from 'react'
import { NavLink, Route, Routes, Navigate } from 'react-router-dom'
import {
  db,
  normalizeDynamicPlanState,
  purgeDuplicatePlansByName,
  purgePlansWithoutDates,
  seedPlansFromImport
} from './data/db'
import Dashboard from './pages/Dashboard'
import PlanDetail from './pages/PlanDetail'
import SessionDetail from './pages/SessionDetail'
import WorkoutRun from './pages/WorkoutRun'
import CalendarView from './pages/CalendarView'
import ProgressView from './pages/ProgressView'
import Auth from './pages/Auth'
import MyPlan from './pages/MyPlan'
import Landing from './pages/Landing'
import { syncAll } from './data/sync'
import ErrorBoundary from './components/ErrorBoundary'
import { supabase } from './data/supabase'

const App = () => {
  useEffect(() => {
    seedPlansFromImport().then(() => {
      const flag = 'purgedPlansWithoutDatesV1'
      if (!localStorage.getItem(flag)) {
        purgePlansWithoutDates().then(() => {
          localStorage.setItem(flag, 'true')
        })
      }
      const dupFlag = 'purgedDuplicatePlansV2'
      if (!localStorage.getItem(dupFlag)) {
        purgeDuplicatePlansByName().then(() => {
          localStorage.setItem(dupFlag, 'true')
        })
      }
      normalizeDynamicPlanState()
    })
  }, [])
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'ok' | 'error'>('idle')
  const debounceRef = useRef<number | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user?.email ?? null)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUserEmail(session?.user?.email ?? null)
      setAuthReady(true)
    })
    return () => {
      sub?.subscription?.unsubscribe?.()
    }
  }, [])

  useEffect(() => {
    const onChanges = () => {
      if (!userEmail) return
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
      debounceRef.current = window.setTimeout(async () => {
        setSyncState('syncing')
        const result = await syncAll()
        if (result.ok) {
          setSyncState('ok')
        } else {
          setSyncState('error')
        }
      }, 800)
    }
    const changesHook = db.on('changes')
    changesHook?.subscribe?.(onChanges)
    return () => {
      changesHook?.unsubscribe?.(onChanges)
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [userEmail])

  const initials = userEmail
    ? userEmail
        .split('@')[0]
        .split('.')
        .map((part) => part[0]?.toUpperCase())
        .join('')
        .slice(0, 2)
    : '—'

  const RequireAuth = ({ children }: { children: React.ReactNode }) => {
    if (!authReady) {
      return (
        <div className="section">
          <div className="card">
            <div className="section-title">Loading</div>
            <div className="muted">Checking your session…</div>
          </div>
        </div>
      )
    }
    if (!userEmail) return <Navigate to="/" replace />
    return <>{children}</>
  }

  return (
    <div className="app-shell">
      {userEmail && (
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">Pulse</div>
            <div>
              <div className="brand-title">Workout Planner</div>
              <div className="brand-subtitle">Strength • Consistency • Progress</div>
            </div>
          </div>
          <nav className="topnav">
            <NavLink to="/home" end className="nav-link">
              Home
            </NavLink>
            <NavLink to="/calendar" className="nav-link">
              Calendar
            </NavLink>
            <NavLink to="/plans" className="nav-link">
              My Plan
            </NavLink>
            <NavLink to="/progress" className="nav-link">
              Progress
            </NavLink>
          </nav>
          <div className="row">
            <div className={`sync-indicator ${syncState}`}>
              <span className="dot" />
              {syncState === 'syncing' && 'Syncing'}
              {syncState === 'ok' && 'Synced'}
              {syncState === 'error' && 'Sync paused'}
              {syncState === 'idle' && 'Auto-Sync On'}
            </div>
            <NavLink to="/auth" className="user-chip">
              {initials}
            </NavLink>
          </div>
        </header>
      )}
      <main className="content">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={userEmail ? <Navigate to="/home" replace /> : <Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/home"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/plan/:planId"
              element={
                <RequireAuth>
                  <PlanDetail />
                </RequireAuth>
              }
            />
            <Route
              path="/session/:sessionId"
              element={
                <RequireAuth>
                  <SessionDetail />
                </RequireAuth>
              }
            />
            <Route
              path="/workout/:workoutId"
              element={
                <RequireAuth>
                  <WorkoutRun />
                </RequireAuth>
              }
            />
            <Route
              path="/calendar"
              element={
                <RequireAuth>
                  <CalendarView />
                </RequireAuth>
              }
            />
            <Route
              path="/plans"
              element={
                <RequireAuth>
                  <MyPlan />
                </RequireAuth>
              }
            />
            <Route
              path="/progress"
              element={
                <RequireAuth>
                  <ProgressView />
                </RequireAuth>
              }
            />
          </Routes>
        </ErrorBoundary>
      </main>
      {userEmail && (
        <nav className="bottom-nav">
          <NavLink to="/home" end className="bottom-link">
            <span className="icon">🏠</span>
            Home
          </NavLink>
          <NavLink to="/calendar" className="bottom-link">
            <span className="icon">📅</span>
            Calendar
          </NavLink>
          <NavLink to="/plans" className="bottom-link">
            <span className="icon">📋</span>
            My Plan
          </NavLink>
          <NavLink to="/progress" className="bottom-link">
            <span className="icon">📈</span>
            Progress
          </NavLink>
          <NavLink to="/auth" className="bottom-link">
            <span className="icon">👤</span>
            Account
          </NavLink>
        </nav>
      )}
    </div>
  )
}

export default App
