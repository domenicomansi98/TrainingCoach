import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, ensurePlannedWorkouts, getPlanForDate } from '../data/db'

const CalendarView = () => {
  const plans = useLiveQuery(() => db.plans.orderBy('createdAt').reverse().toArray(), [])
  const [monthDate, setMonthDate] = useState(new Date())
  const activePlan = useMemo(() => getPlanForDate(plans, monthDate), [plans, monthDate])
  const planned = useLiveQuery(
    () =>
      activePlan ? db.plannedWorkouts.where('planId').equals(activePlan.id).toArray() : [],
    [activePlan?.id]
  )
  const sessions = useLiveQuery(
    () => (activePlan ? db.sessions.where('planId').equals(activePlan.id).toArray() : []),
    [activePlan?.id]
  )

  useEffect(() => {
    if (activePlan) ensurePlannedWorkouts(activePlan)
  }, [activePlan?.id])
  const today = new Date()
  const todayKey = today.toDateString()
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)

  const days = useMemo(() => {
    const startOffset = monthStart.getDay()
    const totalDays = monthEnd.getDate()
    const slots: (Date | null)[] = []
    for (let i = 0; i < startOffset; i += 1) slots.push(null)
    for (let day = 1; day <= totalDays; day += 1) {
      slots.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), day))
    }
    return slots
  }, [monthDate, monthStart, monthEnd])

  const plannedByDate = useMemo(() => {
    const map = new Map<string, typeof planned>()
    planned?.forEach((item) => {
      const key = new Date(item.date).toDateString()
      const list = map.get(key) ?? []
      list.push(item)
      map.set(key, list)
    })
    return map
  }, [planned])

  const sessionMap = useMemo(() => {
    const map = new Map<string, string>()
    sessions?.forEach((s) => map.set(s.id, s.name))
    return map
  }, [sessions])

  const monthStats = useMemo(() => {
    const monthKey = `${monthDate.getFullYear()}-${monthDate.getMonth()}`
    const items = (planned ?? []).filter((item) => {
      const d = new Date(item.date)
      return `${d.getFullYear()}-${d.getMonth()}` === monthKey
    })
    return {
      planned: items.length,
      completed: items.filter((i) => i.status === 'completed').length
    }
  }, [planned, monthDate])

  return (
    <div className="section">
      <div className="glass-card">
        <div className="toolbar">
          <div>
            <div className="pill">Training calendar</div>
            <h1>{monthDate.toLocaleString('default', { month: 'long' })}</h1>
            <div className="muted">{monthDate.getFullYear()}</div>
            <div className="muted">
              {activePlan ? activePlan.name : 'No plan for this month.'}
            </div>
          </div>
          <div className="toolbar-group">
            <button
              className="button ghost"
              onClick={() =>
                setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))
              }
            >
              Prev
            </button>
            <button className="button secondary" onClick={() => setMonthDate(new Date())}>
              Today
            </button>
            <button
              className="button ghost"
              onClick={() =>
                setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))
              }
            >
              Next
            </button>
          </div>
        </div>
        <div className="widget-grid">
          <div className="widget gradient-widget stat-variant-a">
            <div className="row">
              <div className="icon-bubble">📌</div>
              <div>
                <div className="widget-title">Planned sessions</div>
                <div className="widget-value">{monthStats.planned}</div>
              </div>
            </div>
          </div>
          <div className="widget gradient-widget stat-variant-b">
            <div className="row">
              <div className="icon-bubble">✅</div>
              <div>
                <div className="widget-title">Completed sessions</div>
                <div className="widget-value">{monthStats.completed}</div>
              </div>
            </div>
          </div>
          <div className="widget gradient-widget stat-variant-c">
            <div className="row">
              <div className="icon-bubble">🎯</div>
              <div>
                <div className="widget-title">Completion rate</div>
                <div className="widget-value">
                  {monthStats.planned
                    ? `${Math.round((monthStats.completed / monthStats.planned) * 100)}%`
                    : '0%'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="calendar">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
            <div key={label} className="calendar-header">
              {label}
            </div>
          ))}
          {days.map((day, idx) => {
            if (!day) {
              return <div key={`empty-${idx}`} className="calendar-cell muted" />
            }
            const key = day.toDateString()
            const items = plannedByDate.get(key) ?? []
            return (
              <div key={key} className={`calendar-cell ${key === todayKey ? 'today' : ''}`}>
                <div className="calendar-date">{day.getDate()}</div>
                {items.length ? (
                  items.map((item) => (
                    <button
                      key={item.id}
                      className={`calendar-item ${item.status}`}
                      onClick={async () => {
                        const next = window.prompt('Move to date (YYYY-MM-DD):', '')
                        if (!next) return
                        const nextDate = new Date(`${next}T00:00:00`)
                        if (Number.isNaN(nextDate.getTime())) return
                        const updatedAt = new Date().toISOString()
                        await db.plannedWorkouts.update(item.id, {
                          date: nextDate.toISOString(),
                          updatedAt
                        })
                      }}
                    >
                      <span>{item.status === 'completed' ? 'Completed' : 'Planned'}</span>
                      <span>{sessionMap.get(item.sessionId) ?? 'Session'}</span>
                    </button>
                  ))
                ) : (
                  <div className="calendar-empty">No training</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default CalendarView
