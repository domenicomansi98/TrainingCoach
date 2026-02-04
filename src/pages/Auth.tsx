import { useEffect, useState } from 'react'
import { supabase } from '../data/supabase'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'

const Auth = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const signIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setMessage(error ? error.message : 'Signed in')
  }

  const signUp = async () => {
    const { error } = await supabase.auth.signUp({ email, password })
    setMessage(error ? error.message : 'Account created. Check email for confirmation if required.')
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setMessage('Signed out')
  }

  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null)
      setUserId(data.user?.id ?? null)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUserEmail(session?.user?.email ?? null)
      setUserId(session?.user?.id ?? null)
    })
    return () => {
      sub?.subscription?.unsubscribe?.()
    }
  }, [])

  const syncState = useLiveQuery(() => db.syncState.get('main'), [])

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="pill">Login</div>
          <h1>{userEmail ? 'Account overview' : 'Welcome back'}</h1>
          <p className="muted">
            {userEmail
              ? 'Your data is synced and secure.'
              : 'Sign in to access your training plans and sync your progress.'}
          </p>
        </div>

        {userEmail ? (
          <div className="auth-profile">
            <div className="profile-pill">
              <div className="profile-label">Signed in as</div>
              <div className="profile-value">{userEmail}</div>
            </div>
            <div className="profile-pill">
              <div className="profile-label">User ID</div>
              <div className="profile-value value-small">{userId ?? '—'}</div>
            </div>
            <div className="profile-pill">
              <div className="profile-label">Last sync</div>
              <div className="profile-value">
                {syncState?.lastSync ? new Date(syncState.lastSync).toLocaleString() : '—'}
              </div>
            </div>
            <button className="button ghost" onClick={signOut}>
              Sign Out
            </button>
          </div>
        ) : (
          <>
            <div className="auth-form">
              <label>Email</label>
              <input
                className="input auth-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
              />
              <label>Password</label>
              <input
                className="input auth-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="auth-actions">
              <button className="button primary" onClick={signIn}>
                Login
              </button>
              <button className="button secondary" onClick={signUp}>
                Register
              </button>
            </div>
          </>
        )}
        {message && <div className="pill">{message}</div>}
      </div>
    </div>
  )
}

export default Auth
