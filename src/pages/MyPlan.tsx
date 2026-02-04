import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db, getPlanForDate } from '../data/db'

const MyPlan = () => {
  const plans = useLiveQuery(() => db.plans.orderBy('createdAt').reverse().toArray(), [])
  const currentPlan = useMemo(() => getPlanForDate(plans, new Date()), [plans])

  const previousPlans = useMemo(() => {
    if (!plans?.length) return []
    return plans.filter(
      (plan) =>
        plan.id !== currentPlan?.id &&
        plan.startDate &&
        plan.endDate
    )
  }, [plans, currentPlan?.id])

  const formatRange = (start?: string | null, end?: string | null) => {
    if (!start || !end) return 'Date range not set'
    const startDate = new Date(`${start}T00:00:00`)
    const endDate = new Date(`${end}T00:00:00`)
    return `${startDate.toLocaleDateString()} – ${endDate.toLocaleDateString()}`
  }

  return (
    <div className="section">
      <div className="glass-card">
        <div className="toolbar">
          <div>
            <div className="pill">My plan</div>
            <h1>Current plan</h1>
            <div className="muted">Review this month and browse your history.</div>
          </div>
          {currentPlan && (
            <Link className="button primary" to={`/plan/${currentPlan.id}`}>
              Open Plan
            </Link>
          )}
        </div>
        {currentPlan ? (
          <div className="widget-grid">
            <div className="widget gradient-widget stat-variant-a">
              <div className="widget-title">Active plan</div>
              <div className="widget-value">{currentPlan.name}</div>
              <div className="muted">{formatRange(currentPlan.startDate, currentPlan.endDate)}</div>
            </div>
            <div className="widget gradient-widget stat-variant-b">
              <div className="widget-title">Current week</div>
              <div className="widget-value">Week {currentPlan.currentWeek}</div>
            </div>
          </div>
        ) : (
          <div className="muted">No current plan yet.</div>
        )}
      </div>

      <div className="card">
        <div className="section-title">Previous plans</div>
        {previousPlans.length ? (
          <div className="widget-grid">
            {previousPlans.map((plan) => (
              <Link key={plan.id} className="widget session-card" to={`/plan/${plan.id}`}>
                <div className="widget-title">Plan</div>
                <div className="widget-value">{plan.name}</div>
                <div className="muted">{formatRange(plan.startDate, plan.endDate)}</div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="muted">No previous plans found.</div>
        )}
      </div>
    </div>
  )
}

export default MyPlan
