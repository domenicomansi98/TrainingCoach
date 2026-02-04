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
    <div className="section">
      <div className="glass-card">
        <div>
          <div className="pill">Account</div>
          <h1>Sync your data</h1>
          <div className="muted">Sign in to keep workouts synced across devices.</div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 560, alignSelf: 'center', width: '100%' }}>
        {userEmail ? (
          <div className="section">
            <div className="widget-grid">
              <div className="widget gradient-widget stat-variant-a">
                <div className="widget-title">Signed in</div>
                <div className="widget-value value-small">{userEmail}</div>
              </div>
              <div className="widget gradient-widget stat-variant-b">
                <div className="widget-title">User ID</div>
                <div className="widget-value value-small">{userId ?? '—'}</div>
              </div>
              <div className="widget gradient-widget stat-variant-c">
                <div className="widget-title">Last sync</div>
                <div className="widget-value">
                  {syncState?.lastSync
                    ? new Date(syncState.lastSync).toLocaleString()
                    : '—'}
                </div>
              </div>
            </div>
            <div className="row">
              <button className="button ghost" onClick={signOut}>
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="row">
              <div style={{ flex: 1 }}>
                <label>Email</label>
                <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label>Password</label>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            <div className="row">
              <button className="button primary" onClick={signIn}>
                Sign In
              </button>
              <button className="button secondary" onClick={signUp}>
                Create Account
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
