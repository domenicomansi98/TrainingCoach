import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams } from 'react-router-dom'
import { db } from '../data/db'

const PlanDetail = () => {
  const { planId } = useParams()
  const plan = useLiveQuery(() => (planId ? db.plans.get(planId) : undefined), [planId])
  const sessions = useLiveQuery(
    () => (planId ? db.sessions.where('planId').equals(planId).sortBy('order') : []),
    [planId]
  )

  if (!plan) return <div>Loading plan...</div>
  const dateRange =
    plan.startDate && plan.endDate
      ? `${new Date(`${plan.startDate}T00:00:00`).toLocaleDateString()} – ${new Date(
          `${plan.endDate}T00:00:00`
        ).toLocaleDateString()}`
      : null

  return (
    <div className="section">
      <div className="glass-card">
        <div className="toolbar">
          <div>
            <div className="pill">Monthly plan</div>
            <h1>{plan.name}</h1>
            <div className="muted">
              {dateRange ? `Active ${dateRange}` : 'Adjust your current week and jump in.'}
            </div>
          </div>
          <div>
            <label>Current week</label>
            <select
              className="select"
              value={plan.currentWeek}
              onChange={(event) => {
                const nextWeek = Number(event.target.value)
                const updatedAt = new Date().toISOString()
                db.plans.update(plan.id, { currentWeek: nextWeek, updatedAt })
              }}
            >
              {[1, 2, 3, 4].map((week) => (
                <option key={week} value={week}>
                  Week {week}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="panel-grid">
        <div className="card">
          <div className="section-title">Warm-up circuit</div>
          {plan.warmup?.length ? (
            plan.warmup.map((block) => (
              <div key={block.category} className="widget">
                <div className="widget-title">{block.category}</div>
                <div className="muted">{block.items.join(' • ')}</div>
              </div>
            ))
          ) : (
            <div className="muted">No warmup notes.</div>
          )}
        </div>
        <div className="card">
          <div className="section-title">Sessions</div>
          {sessions?.length ? (
            <div className="widget-grid">
              {sessions.map((session) => (
                <Link
                  key={session.id}
                  className="widget session-card"
                  to={`/session/${session.id}`}
                >
                  <div className="widget-title">Session</div>
                  <div className="widget-value">{session.name}</div>
                  <div className="muted">Tap to edit sets + rest</div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="muted">No sessions found.</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PlanDetail
