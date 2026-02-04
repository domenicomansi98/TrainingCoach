import Dexie, { Table } from 'dexie'
import planImport from './plan_import.json'

export type WarmupCategory = { category: string; items: string[] }

export type Plan = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  currentWeek: number
  startDate?: string | null
  endDate?: string | null
  warmup: WarmupCategory[]
}

export type Session = {
  id: string
  planId: string
  name: string
  order: number
  updatedAt: string
}

export type Exercise = {
  id: string
  sessionId: string
  name: string
  order: number
  week1?: string | null
  week2?: string | null
  week3?: string | null
  week4?: string | null
  plannedSets: number
  restSeconds: number
  movement: 'push' | 'pull' | 'leg' | 'other'
  updatedAt: string
}

export type Workout = {
  id: string
  planId: string
  sessionId: string
  date: string
  status: 'in_progress' | 'completed'
  completedAt?: string | null
  updatedAt: string
}

export type PlannedWorkout = {
  id: string
  planId: string
  sessionId: string
  date: string
  status: 'planned' | 'completed' | 'skipped'
  workoutId?: string | null
  updatedAt: string
}

export type ExerciseLog = {
  id: string
  workoutId: string
  exerciseId: string
  weight?: number | null
  reps?: number | null
  exertion?: number | null
  comment?: string | null
  completedSets: number
  updatedAt: string
}

export type SyncState = {
  id: 'main'
  lastSync?: string | null
  deviceId: string
}

class WorkoutDB extends Dexie {
  plans!: Table<Plan, string>
  sessions!: Table<Session, string>
  exercises!: Table<Exercise, string>
  workouts!: Table<Workout, string>
  plannedWorkouts!: Table<PlannedWorkout, string>
  exerciseLogs!: Table<ExerciseLog, string>
  syncState!: Table<SyncState, string>

  constructor() {
    super('workout-planner')
    this.version(1).stores({
      plans: 'id, name, createdAt, updatedAt',
      sessions: 'id, planId, order, updatedAt',
      exercises: 'id, sessionId, order, updatedAt',
      workouts: 'id, planId, sessionId, date, status, updatedAt',
      exerciseLogs: 'id, workoutId, exerciseId, updatedAt',
      syncState: 'id'
    })
    this.version(2).stores({
      plans: 'id, name, createdAt, updatedAt',
      sessions: 'id, planId, order, updatedAt',
      exercises: 'id, sessionId, order, updatedAt',
      workouts: 'id, planId, sessionId, date, status, updatedAt',
      plannedWorkouts: 'id, planId, sessionId, date, status, updatedAt',
      exerciseLogs: 'id, workoutId, exerciseId, updatedAt',
      syncState: 'id'
    })
    this.version(3)
      .stores({
        plans: 'id, name, createdAt, updatedAt',
        sessions: 'id, planId, order, updatedAt',
        exercises: 'id, sessionId, order, updatedAt, movement',
        workouts: 'id, planId, sessionId, date, status, updatedAt',
        plannedWorkouts: 'id, planId, sessionId, date, status, updatedAt',
        exerciseLogs: 'id, workoutId, exerciseId, updatedAt',
        syncState: 'id'
      })
      .upgrade(async (tx) => {
        const table = tx.table('exercises')
        await table.toCollection().modify((exercise: Exercise) => {
          if (!exercise.movement) {
            exercise.movement = classifyMovement(exercise.name)
            exercise.updatedAt = new Date().toISOString()
          }
        })
      })
    this.version(4).stores({
      plans: 'id, name, createdAt, updatedAt',
      sessions: 'id, planId, order, updatedAt',
      exercises: 'id, sessionId, order, updatedAt, movement',
      workouts: 'id, planId, sessionId, date, status, updatedAt',
      plannedWorkouts: 'id, planId, sessionId, date, status, updatedAt',
      exerciseLogs: 'id, workoutId, exerciseId, updatedAt',
      syncState: 'id'
    })
  }
}

export const db = new WorkoutDB()

const uuid = () => crypto.randomUUID()

const parsePlannedSets = (text?: string | null) => {
  if (!text) return 1
  const match = text.match(/(\d+)\s*[x×]/i)
  if (match) {
    const val = Number(match[1])
    return Number.isFinite(val) && val > 0 ? val : 1
  }
  return 1
}

const classifyMovement = (name: string): Exercise['movement'] => {
  const n = name.toLowerCase()
  if (/(press|push|dip|hspu|pushup|pike|bench|overhead|military|shoulder)/.test(n))
    return 'push'
  if (/(pull|chin|row|lat|pulley|muscleup|front lever|pullup)/.test(n)) return 'pull'
  if (/(squat|leg|affondi|lunge|press|hip|deadlift|stacco|curl|extension)/.test(n))
    return 'leg'
  return 'other'
}

export const seedPlansFromImport = async () => {
  const existingPlans = await db.plans.toArray()
  const existingByName = new Map(existingPlans.map((plan) => [plan.name, plan]))
  const now = new Date().toISOString()
  for (const plan of planImport) {
    const existing = existingByName.get(plan.name)
    if (existing) {
      const updates: Partial<Plan> = {}
      if (!existing.startDate && plan.startDate) updates.startDate = plan.startDate
      if (!existing.endDate && plan.endDate) updates.endDate = plan.endDate
      if ((!existing.warmup || existing.warmup.length === 0) && plan.warmup) {
        updates.warmup = plan.warmup
      }
      if (Object.keys(updates).length > 0) {
        updates.updatedAt = now
        await db.plans.update(existing.id, updates)
      }
      const sessionCount = await db.sessions.where('planId').equals(existing.id).count()
      if (sessionCount === 0) {
        let sessionOrder = 0
        for (const session of plan.sessions ?? []) {
          const sessionId = uuid()
          await db.sessions.add({
            id: sessionId,
            planId: existing.id,
            name: session.name,
            order: sessionOrder++,
            updatedAt: now
          })

          let exOrder = 0
          for (const exercise of session.exercises ?? []) {
            const weeks = exercise.weeks ?? []
            await db.exercises.add({
              id: uuid(),
              sessionId,
              name: exercise.name,
              order: exOrder++,
              week1: weeks[0] ?? null,
              week2: weeks[1] ?? null,
              week3: weeks[2] ?? null,
              week4: weeks[3] ?? null,
              plannedSets: parsePlannedSets(weeks[0] ?? null),
              restSeconds: 90,
              movement: classifyMovement(exercise.name),
              updatedAt: now
            })
          }
        }
      }
      continue
    }

    const planId = uuid()
    await db.plans.add({
      id: planId,
      name: plan.name,
      createdAt: now,
      updatedAt: now,
      currentWeek: 1,
      startDate: plan.startDate ?? null,
      endDate: plan.endDate ?? null,
      warmup: plan.warmup ?? []
    })

    let sessionOrder = 0
    for (const session of plan.sessions ?? []) {
      const sessionId = uuid()
      await db.sessions.add({
        id: sessionId,
        planId,
        name: session.name,
        order: sessionOrder++,
        updatedAt: now
      })

      let exOrder = 0
      for (const exercise of session.exercises ?? []) {
        const weeks = exercise.weeks ?? []
        await db.exercises.add({
          id: uuid(),
          sessionId,
          name: exercise.name,
          order: exOrder++,
          week1: weeks[0] ?? null,
          week2: weeks[1] ?? null,
          week3: weeks[2] ?? null,
          week4: weeks[3] ?? null,
          plannedSets: parsePlannedSets(weeks[0] ?? null),
          restSeconds: 90,
          movement: classifyMovement(exercise.name),
          updatedAt: now
        })
      }
    }
  }
}

export const purgePlansWithoutDates = async () => {
  const plans = await db.plans.toArray()
  const targets = plans.filter((plan) => !plan.startDate || !plan.endDate)
  if (targets.length === 0) return

  const planIds = targets.map((plan) => plan.id)
  await db.transaction(
    'rw',
    db.plans,
    db.sessions,
    db.exercises,
    db.plannedWorkouts,
    db.workouts,
    db.exerciseLogs,
    async () => {
      const sessions = await db.sessions.where('planId').anyOf(planIds).toArray()
      const sessionIds = sessions.map((session) => session.id)

      const workouts = await db.workouts.where('planId').anyOf(planIds).toArray()
      const workoutIds = workouts.map((workout) => workout.id)

      if (workoutIds.length) {
        await db.exerciseLogs.where('workoutId').anyOf(workoutIds).delete()
      }
      if (sessionIds.length) {
        await db.exercises.where('sessionId').anyOf(sessionIds).delete()
      }

      await db.plannedWorkouts.where('planId').anyOf(planIds).delete()
      await db.workouts.where('planId').anyOf(planIds).delete()
      await db.sessions.where('planId').anyOf(planIds).delete()
      await db.plans.where('id').anyOf(planIds).delete()
    }
  )
}

const TRAINING_DAYS = [1, 2, 4, 5] // Mon, Tue, Thu, Fri

const parseLocalDate = (value?: string | null) => {
  if (!value) return undefined
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export const getPlanForDate = (plans: Plan[] | undefined, targetDate: Date) => {
  if (!plans?.length) return undefined
  const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())
  const withRanges = plans
    .map((plan) => ({
      plan,
      start: parseLocalDate(plan.startDate),
      end: parseLocalDate(plan.endDate)
    }))
    .filter((item) => item.start && item.end) as Array<{
    plan: Plan
    start: Date
    end: Date
  }>

  if (withRanges.length) {
    withRanges.sort((a, b) => a.start.getTime() - b.start.getTime())
    const match = withRanges.find((item) => target >= item.start && target <= item.end)
    if (match) return match.plan
  }

  const ordered = [...plans].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return ordered[0]
}

export const ensurePlannedWorkouts = async (plan: Plan) => {
  const planId = plan.id
  const sessions = await db.sessions.where('planId').equals(planId).sortBy('order')
  if (!sessions.length) return

  const today = new Date()
  const rangeStart =
    parseLocalDate(plan.startDate) ?? new Date(today.getFullYear(), today.getMonth(), 1)
  const rangeEnd =
    parseLocalDate(plan.endDate) ?? new Date(today.getFullYear(), today.getMonth() + 1, 0)

  const existing = await db.plannedWorkouts.where('planId').equals(planId).toArray()
  const existingDates = new Set(
    existing
      .map((item) => new Date(item.date))
      .filter((d) => d >= rangeStart && d <= rangeEnd)
      .map((d) => d.toDateString())
  )

  let sessionIndex = 0
  for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
    if (!TRAINING_DAYS.includes(d.getDay())) continue
    if (existingDates.has(d.toDateString())) continue
    const session = sessions[sessionIndex % sessions.length]
    sessionIndex += 1
    await db.plannedWorkouts.add({
      id: uuid(),
      planId,
      sessionId: session.id,
      date: d.toISOString(),
      status: 'planned',
      workoutId: null,
      updatedAt: new Date().toISOString()
    })
  }
}

export const seedDemoData = async (planId: string) => {
  const sessions = await db.sessions.where('planId').equals(planId).sortBy('order')
  const exercises = await db.exercises.toArray()
  if (!sessions.length || !exercises.length) return

  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 28)
  let sessionIndex = 0

  for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
    if (![1, 2, 4, 5].includes(d.getDay())) continue
    const session = sessions[sessionIndex % sessions.length]
    sessionIndex += 1
    const workoutId = crypto.randomUUID()
    const dateIso = new Date(d).toISOString()
    await db.workouts.add({
      id: workoutId,
      planId,
      sessionId: session.id,
      date: dateIso,
      status: 'completed',
      completedAt: dateIso,
      updatedAt: dateIso
    })

    const sessionExercises = exercises.filter((ex) => ex.sessionId === session.id)
    let weightBase = 20 + sessionIndex * 2
    for (const exercise of sessionExercises) {
      await db.exerciseLogs.add({
        id: crypto.randomUUID(),
        workoutId,
        exerciseId: exercise.id,
        weight: weightBase,
        reps: 6 + (sessionIndex % 5),
        exertion: 6 + (sessionIndex % 4),
        comment: sessionIndex % 3 === 0 ? 'Felt strong' : null,
        completedSets: exercise.plannedSets,
        updatedAt: dateIso
      })
      weightBase += 2
    }
  }
}

const isDynamicFebPlan = (plan: Plan) => /febbraio/i.test(plan.name)

const toDateOnly = (value: string) => new Date(value).toISOString().slice(0, 10)

export const updateDynamicPlanDates = async (planId: string) => {
  const plan = await db.plans.get(planId)
  if (!plan || !isDynamicFebPlan(plan)) return

  const completedWorkouts = await db.workouts
    .where('planId')
    .equals(planId)
    .and((workout) => workout.status === 'completed')
    .toArray()

  if (!completedWorkouts.length) return

  const completionDates = completedWorkouts.map((workout) => workout.completedAt ?? workout.date)
  const sorted = completionDates.slice().sort()
  const firstCompleted = toDateOnly(sorted[0])
  const lastCompleted = toDateOnly(sorted[sorted.length - 1])

  const planned = await db.plannedWorkouts.where('planId').equals(planId).toArray()
  const plannedCount = planned.length
  const plannedCompleted = planned.filter((item) => item.status === 'completed').length

  const updates: Partial<Plan> = {}
  if (plan.startDate !== firstCompleted) updates.startDate = firstCompleted
  if (plannedCount > 0 && plannedCompleted === plannedCount && plan.endDate !== lastCompleted) {
    updates.endDate = lastCompleted
  }

  if (Object.keys(updates).length > 0) {
    updates.updatedAt = new Date().toISOString()
    await db.plans.update(plan.id, updates)
  }
}
