import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../data/db'

const SessionDetail = () => {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const session = useLiveQuery(() => (sessionId ? db.sessions.get(sessionId) : undefined), [sessionId])
  const plan = useLiveQuery(
    () => (session?.planId ? db.plans.get(session.planId) : undefined),
    [session?.planId]
  )
  const exercises = useLiveQuery(
    () => (sessionId ? db.exercises.where('sessionId').equals(sessionId).sortBy('order') : []),
    [sessionId]
  )
  const planned = useLiveQuery(
    () =>
      sessionId
        ? db.plannedWorkouts.where('sessionId').equals(sessionId).sortBy('date')
        : [],
    [sessionId]
  )

  const [selectedWeek, setSelectedWeek] = useState(1)
  useEffect(() => {
    if (plan?.currentWeek) setSelectedWeek(plan.currentWeek)
  }, [plan?.currentWeek])
  const getWeekValue = (exercise: { week1?: string | null; week2?: string | null; week3?: string | null; week4?: string | null }) => {
    if (selectedWeek === 1) return exercise.week1
    if (selectedWeek === 2) return exercise.week2
    if (selectedWeek === 3) return exercise.week3
    return exercise.week4
  }
  const parseReps = (text?: string | null) => {
    if (!text) return null
    const match = text.replace(',', '.').match(/x\s*(\d+)(?:\s*-\s*(\d+))?/i)
    if (!match) return null
    const a = Number(match[1])
    const b = match[2] ? Number(match[2]) : a
    return match[2] ? `${a}-${b}` : `${a}`
  }

  if (!session || !plan)
    return (
      <div className="card">
        <div className="section-title">Session not found</div>
        <div className="muted">Please return to the plan and try again.</div>
      </div>
    )

  return (
    <div className="section">
      <div className="hero hero-dark">
        <div className="toolbar">
          <div>
            <div className="pill">Session</div>
            <h1>{session.name}</h1>
            <div className="muted">Current week {plan.currentWeek}</div>
          </div>
          <button
            className="button primary"
            onClick={async () => {
              const now = new Date().toISOString()
              const workoutId = crypto.randomUUID()
              await db.workouts.add({
                id: workoutId,
                planId: plan.id,
                sessionId: session.id,
                date: now,
                status: 'in_progress',
                completedAt: null,
                updatedAt: now
              })
              if (exercises) {
                for (const exercise of exercises) {
                  await db.exerciseLogs.add({
                    id: crypto.randomUUID(),
                    workoutId,
                    exerciseId: exercise.id,
                    completedSets: 0,
                    updatedAt: now
                  })
                }
              }
              const todayKey = new Date().toDateString()
              const match = planned?.find(
                (p) => p.status === 'planned' && new Date(p.date).toDateString() === todayKey
              )
              if (match) {
                await db.plannedWorkouts.update(match.id, {
                  status: 'completed',
                  workoutId,
                  updatedAt: now
                })
              }
              navigate(`/workout/${workoutId}`)
            }}
          >
            Start workout
          </button>
        </div>
        <div className="toolbar">
          <div>
            <label>View week</label>
            <select
              className="select"
              value={selectedWeek}
              onChange={(event) => setSelectedWeek(Number(event.target.value))}
            >
              {[1, 2, 3, 4].map((week) => (
                <option key={week} value={week}>
                  Week {week}
                </option>
              ))}
            </select>
          </div>
          <div className="muted">Sets, reps, rest shown below</div>
        </div>
      </div>

      <div className="list-stack">
        {exercises?.map((exercise) => (
          <div key={exercise.id} className="list-card exercise-card">
            <div className="list-header">
              <div>
                <div className="section-title">{exercise.name}</div>
                <div className="muted">{getWeekValue(exercise) ?? '-'}</div>
              </div>
              <div className="list-meta">Session</div>
            </div>
            <div className="list-controls">
              <div>
                <label>Sets</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={exercise.plannedSets}
                  onChange={(event) => {
                    const value = Number(event.target.value)
                    const updatedAt = new Date().toISOString()
                    db.exercises.update(exercise.id, {
                      plannedSets: Number.isFinite(value) ? value : 1,
                      updatedAt
                    })
                  }}
                />
              </div>
              <div>
                <label>Target reps</label>
                <input className="input" placeholder="e.g. 8-12" />
              </div>
              <div>
                <label>Rest (sec)</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={exercise.restSeconds}
                  onChange={(event) => {
                    const value = Number(event.target.value)
                    const updatedAt = new Date().toISOString()
                    db.exercises.update(exercise.id, {
                      restSeconds: Number.isFinite(value) ? value : 0,
                      updatedAt
                    })
                  }}
                />
              </div>
            </div>
            <div className="muted list-footnote">
              Log actual weight, reps, exertion, and comments in the workout view.
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default SessionDetail
