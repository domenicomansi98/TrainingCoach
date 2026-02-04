import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useParams } from 'react-router-dom'
import { db, ExerciseLog, updateDynamicPlanDates } from '../data/db'

const WorkoutRun = () => {
  const { workoutId } = useParams()
  const workout = useLiveQuery(() => (workoutId ? db.workouts.get(workoutId) : undefined), [workoutId])
  const session = useLiveQuery(
    () => (workout?.sessionId ? db.sessions.get(workout.sessionId) : undefined),
    [workout?.sessionId]
  )
  const plan = useLiveQuery(() => (workout?.planId ? db.plans.get(workout.planId) : undefined), [
    workout?.planId
  ])
  const exercises = useLiveQuery(
    () => (workout?.sessionId ? db.exercises.where('sessionId').equals(workout.sessionId).sortBy('order') : []),
    [workout?.sessionId]
  )
  const logs = useLiveQuery(
    () => (workoutId ? db.exerciseLogs.where('workoutId').equals(workoutId).toArray() : []),
    [workoutId]
  )
  const planned = useLiveQuery(
    () => (workout?.planId ? db.plannedWorkouts.where('planId').equals(workout.planId).toArray() : []),
    [workout?.planId]
  )

  const [rest, setRest] = useState<{ label: string; remaining: number } | null>(null)

  useEffect(() => {
    if (!rest) return
    const timer = setInterval(() => {
      setRest((prev) => {
        if (!prev) return null
        const next = prev.remaining - 1
        return next <= 0 ? null : { ...prev, remaining: next }
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [rest])

  const logMap = useMemo(() => {
    const map = new Map(logs?.map((log) => [log.exerciseId, log]))
    return map
  }, [logs])

  const [selectedWeek, setSelectedWeek] = useState(1)
  useEffect(() => {
    if (plan?.currentWeek) setSelectedWeek(plan.currentWeek)
  }, [plan?.currentWeek])

  if (!workout || !session || !plan) return <div>Loading workout...</div>
  const getWeekValue = (exercise: {
    week1?: string | null
    week2?: string | null
    week3?: string | null
    week4?: string | null
  }) => {
    if (selectedWeek === 1) return exercise.week1
    if (selectedWeek === 2) return exercise.week2
    if (selectedWeek === 3) return exercise.week3
    return exercise.week4
  }

  const upsertLog = async (
    exerciseId: string,
    currentLog: ExerciseLog | undefined,
    changes: Partial<ExerciseLog>
  ) => {
    const updatedAt = new Date().toISOString()
    if (!currentLog) {
      await db.exerciseLogs.add({
        id: crypto.randomUUID(),
        workoutId: workout.id,
        exerciseId,
        completedSets: 0,
        updatedAt,
        ...changes
      })
      return
    }
    await db.exerciseLogs.update(currentLog.id, { ...changes, updatedAt })
  }

  return (
    <div className="section">
      <div className="glass-card">
        <div className="toolbar">
          <div>
            <div className="pill">Workout</div>
            <h1>{session.name}</h1>
            <div className="muted">Log sets, reps, and effort as you go.</div>
          </div>
          <button
            className="button primary"
            onClick={async () => {
              const now = new Date().toISOString()
              await db.workouts.update(workout.id, {
                status: 'completed',
                completedAt: now,
                updatedAt: now
              })
              const todayKey = new Date().toDateString()
              const match = planned?.find(
                (p) =>
                  p.status === 'planned' &&
                  p.sessionId === workout.sessionId &&
                  new Date(p.date).toDateString() === todayKey
              )
              if (match) {
                await db.plannedWorkouts.update(match.id, {
                  status: 'completed',
                  workoutId: workout.id,
                  updatedAt: now
                })
              }
              await updateDynamicPlanDates(plan.id)
            }}
          >
            Finish workout
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
          <div className="pill">Current week {plan.currentWeek}</div>
        </div>
      </div>

      {rest && (
        <div className="card">
          <div className="section-title">Rest timer</div>
          <div className="muted">
            {rest.label} · {rest.remaining}s remaining
          </div>
        </div>
      )}

      <div className="panel-grid">
        {exercises?.map((exercise) => {
          const log = logMap.get(exercise.id)
          const completedSets = log?.completedSets ?? 0
          const sets = Array.from({ length: exercise.plannedSets })
          return (
            <div className="card" key={exercise.id}>
              <div className="section-title">{exercise.name}</div>
              <div className="muted">{getWeekValue(exercise) ?? '-'}</div>
              <div className="sets">
                {sets.map((_, idx) => (
                  <button
                    key={idx}
                    className={`set ${idx < completedSets ? 'done' : ''}`}
                    onClick={() => {
                      const nextCount = idx + 1 === completedSets ? idx : idx + 1
                      upsertLog(exercise.id, log, { completedSets: nextCount })
                    }}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
              <button
                className="button secondary"
                onClick={() => {
                  setRest({ label: exercise.name, remaining: exercise.restSeconds })
                }}
              >
                Start rest ({exercise.restSeconds}s)
              </button>
              <div className="row">
                <div style={{ flex: 1 }}>
                  <label>Weight</label>
                  <input
                    className="input"
                    type="number"
                    value={log?.weight ?? ''}
                    onChange={(event) => {
                      const value = event.target.value
                      upsertLog(exercise.id, log, { weight: value === '' ? null : Number(value) })
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label>Reps</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={log?.reps ?? ''}
                    onChange={(event) => {
                      const value = event.target.value
                      upsertLog(exercise.id, log, { reps: value === '' ? null : Number(value) })
                    }}
                  />
                </div>
              </div>
              <div className="row">
                <div style={{ flex: 1 }}>
                  <label>Exertion (1-10)</label>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={10}
                    value={log?.exertion ?? ''}
                    onChange={(event) => {
                      const value = event.target.value
                      upsertLog(exercise.id, log, { exertion: value === '' ? null : Number(value) })
                    }}
                  />
                </div>
              </div>
              <div>
                <label>Comment</label>
                <textarea
                  className="textarea"
                  value={log?.comment ?? ''}
                  onChange={(event) => {
                    upsertLog(exercise.id, log, { comment: event.target.value })
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default WorkoutRun
