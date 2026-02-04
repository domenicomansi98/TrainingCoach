import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db, ensurePlannedWorkouts, getDueSessionId, getPlanForDate, seedDemoData } from '../data/db'

const Dashboard = () => {
  const plans = useLiveQuery(() => db.plans.orderBy('createdAt').reverse().toArray(), [])
  const activePlan = getPlanForDate(plans, new Date())
  const sessions = useLiveQuery(
    () => (activePlan ? db.sessions.where('planId').equals(activePlan.id).sortBy('order') : []),
    [activePlan?.id]
  )
  const workouts = useLiveQuery(() => db.workouts.orderBy('date').reverse().limit(6).toArray(), [])

  useEffect(() => {
    if (activePlan) ensurePlannedWorkouts(activePlan)
  }, [activePlan?.id])

  const dueSessionId =
    activePlan && sessions?.length ? getDueSessionId(activePlan, sessions, new Date()) : null
  const dueSession = sessions?.find((session) => session.id === dueSessionId) ?? sessions?.[0]

  return (
    <div>
      <div className="hero hero-dark">
        <div className="hero-content">
          <div>
            <div className="pill">Monthly plan</div>
            <div className="hero-title">Train with clarity, recover with intent.</div>
            <div className="muted">
              {activePlan?.name ?? 'Load your first plan to get started.'}
            </div>
          </div>
          {activePlan && (
            <Link className="button primary" to={`/plan/${activePlan.id}`}>
              Open Plan
            </Link>
          )}
        </div>
        <div className="hero-stats">
          <div className="stat-card gradient-widget stat-variant-a">
            <div className="row">
              <div className="icon-bubble">🏋️</div>
              <div>
                <div className="muted">Current week</div>
                <div className="stat-value">Week {activePlan?.currentWeek ?? '-'}</div>
              </div>
            </div>
          </div>
          <div className="stat-card gradient-widget stat-variant-b">
            <div className="row">
              <div className="icon-bubble">🗓️</div>
              <div>
                <div className="muted">Sessions</div>
                <div className="stat-value">{sessions?.length ?? 0}</div>
              </div>
            </div>
          </div>
          <div className="stat-card gradient-widget stat-variant-c">
            <div className="row">
              <div className="icon-bubble">📈</div>
              <div>
                <div className="muted">Recent workouts</div>
                <div className="stat-value">{workouts?.length ?? 0}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid">
        <div className="focus-card dark-card">
          <div>
            <div className="pill">Today</div>
            <h3>Find your strength</h3>
            <div className="muted">Start a session and track reps, weights, and fatigue.</div>
          </div>
          {activePlan && dueSession && (
            <Link className="button primary" to={`/session/${dueSession.id}`}>
              Start {dueSession.name}
            </Link>
          )}
        </div>

        <div className="card">
          <h3>Quick Sessions</h3>
          {sessions?.length ? (
            <div className="chip-group">
              {sessions.map((session) => (
                <Link key={session.id} className="chip active" to={`/session/${session.id}`}>
                  {session.name}
                </Link>
              ))}
            </div>
          ) : (
            <div className="muted">No sessions yet.</div>
          )}
          {activePlan && (
            <button className="button ghost" onClick={() => seedDemoData(activePlan.id)}>
              Load Demo Data
            </button>
          )}
        </div>

        <div className="card">
          <h3>Recent Workouts</h3>
          {workouts?.length ? (
            workouts.map((workout) => (
              <div key={workout.id} className="row">
                <div className="pill">
                  {new Date(workout.date).toLocaleDateString()}
                </div>
                <div className="muted">{workout.status}</div>
              </div>
            ))
          ) : (
            <div className="muted">Start a workout to see logs.</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
