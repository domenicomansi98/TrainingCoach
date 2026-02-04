import { db, Exercise, ExerciseLog, Plan, PlannedWorkout, Session, Workout } from './db'
import { supabase } from './supabase'

const mapPlanToRemote = (plan: Plan, userId: string) => ({
  id: plan.id,
  user_id: userId,
  name: plan.name,
  created_at: plan.createdAt,
  updated_at: plan.updatedAt,
  current_week: plan.currentWeek,
  start_date: plan.startDate ?? null,
  end_date: plan.endDate ?? null,
  warmup: plan.warmup
})

const mapPlanFromRemote = (row: any): Plan => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  currentWeek: row.current_week,
  startDate: row.start_date ?? null,
  endDate: row.end_date ?? null,
  warmup: row.warmup ?? []
})

const mapSessionToRemote = (session: Session, userId: string) => ({
  id: session.id,
  user_id: userId,
  plan_id: session.planId,
  name: session.name,
  order_index: session.order,
  updated_at: session.updatedAt
})

const mapSessionFromRemote = (row: any): Session => ({
  id: row.id,
  planId: row.plan_id,
  name: row.name,
  order: row.order_index,
  updatedAt: row.updated_at
})

const mapExerciseToRemote = (exercise: Exercise, userId: string) => ({
  id: exercise.id,
  user_id: userId,
  session_id: exercise.sessionId,
  name: exercise.name,
  order_index: exercise.order,
  week1: exercise.week1,
  week2: exercise.week2,
  week3: exercise.week3,
  week4: exercise.week4,
  planned_sets: exercise.plannedSets,
  rest_seconds: exercise.restSeconds,
  movement: exercise.movement,
  updated_at: exercise.updatedAt
})

const mapExerciseFromRemote = (row: any): Exercise => ({
  id: row.id,
  sessionId: row.session_id,
  name: row.name,
  order: row.order_index,
  week1: row.week1,
  week2: row.week2,
  week3: row.week3,
  week4: row.week4,
  plannedSets: row.planned_sets,
  restSeconds: row.rest_seconds,
  movement: row.movement ?? 'other',
  updatedAt: row.updated_at
})

const mapWorkoutToRemote = (workout: Workout, userId: string) => ({
  id: workout.id,
  user_id: userId,
  plan_id: workout.planId,
  session_id: workout.sessionId,
  date: workout.date,
  status: workout.status,
  completed_at: workout.completedAt,
  updated_at: workout.updatedAt
})

const mapWorkoutFromRemote = (row: any): Workout => ({
  id: row.id,
  planId: row.plan_id,
  sessionId: row.session_id,
  date: row.date,
  status: row.status,
  completedAt: row.completed_at,
  updatedAt: row.updated_at
})

const mapExerciseLogToRemote = (log: ExerciseLog, userId: string) => ({
  id: log.id,
  user_id: userId,
  workout_id: log.workoutId,
  exercise_id: log.exerciseId,
  weight: log.weight,
  reps: log.reps,
  exertion: log.exertion,
  comment: log.comment,
  completed_sets: log.completedSets,
  updated_at: log.updatedAt
})

const mapExerciseLogFromRemote = (row: any): ExerciseLog => ({
  id: row.id,
  workoutId: row.workout_id,
  exerciseId: row.exercise_id,
  weight: row.weight,
  reps: row.reps,
  exertion: row.exertion,
  comment: row.comment,
  completedSets: row.completed_sets,
  updatedAt: row.updated_at
})

const mapPlannedWorkoutToRemote = (plan: PlannedWorkout, userId: string) => ({
  id: plan.id,
  user_id: userId,
  plan_id: plan.planId,
  session_id: plan.sessionId,
  date: plan.date,
  status: plan.status,
  workout_id: plan.workoutId,
  updated_at: plan.updatedAt
})

const mapPlannedWorkoutFromRemote = (row: any): PlannedWorkout => ({
  id: row.id,
  planId: row.plan_id,
  sessionId: row.session_id,
  date: row.date,
  status: row.status,
  workoutId: row.workout_id,
  updatedAt: row.updated_at
})

const mergeByUpdatedAt = <T extends { id: string; updatedAt: string }>(local: T[], remote: T[]) => {
  const map = new Map(local.map((item) => [item.id, item]))
  const updates: T[] = []
  for (const rem of remote) {
    const remoteUpdated = rem.updatedAt
    const localItem = map.get(rem.id)
    if (!localItem) {
      updates.push(rem)
      continue
    }
    if (remoteUpdated && remoteUpdated > localItem.updatedAt) {
      updates.push(rem)
    }
  }
  return updates
}

export const syncAll = async () => {
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'not-authenticated' }

  const now = new Date().toISOString()

  const syncTable = async <T extends { id: string; updatedAt: string }>(
    tableName: string,
    localRows: T[],
    toRemote: (row: T) => Record<string, unknown>,
    fromRemote: (row: any) => T,
    applyRemote: (rows: T[]) => Promise<void>
  ) => {
    const { data: remote, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('user_id', user.id)
    if (error) throw error

    const remoteMapped = (remote ?? []).map(fromRemote)
    const updates = mergeByUpdatedAt(localRows, remoteMapped)
    if (updates.length > 0) {
      await applyRemote(updates)
    }

    const remoteById = new Map(remoteMapped.map((r) => [r.id, r]))
    const toUpsert: Record<string, unknown>[] = []
    for (const row of localRows) {
      const remoteRow = remoteById.get(row.id)
      if (!remoteRow || row.updatedAt > remoteRow.updatedAt) {
        toUpsert.push(toRemote(row))
      }
    }
    if (toUpsert.length > 0) {
      const { error: upsertError } = await supabase
        .from(tableName)
        .upsert(toUpsert, { onConflict: 'id' })
      if (upsertError) throw upsertError
    }
  }

  await syncTable<Plan>(
    'plans',
    await db.plans.toArray(),
    (plan) => mapPlanToRemote(plan, user.id),
    mapPlanFromRemote,
    async (rows) => {
      await db.plans.bulkPut(rows)
    }
  )

  await syncTable<Session>(
    'sessions',
    await db.sessions.toArray(),
    (session) => mapSessionToRemote(session, user.id),
    mapSessionFromRemote,
    async (rows) => {
      await db.sessions.bulkPut(rows)
    }
  )

  await syncTable<Exercise>(
    'exercises',
    await db.exercises.toArray(),
    (exercise) => mapExerciseToRemote(exercise, user.id),
    mapExerciseFromRemote,
    async (rows) => {
      await db.exercises.bulkPut(rows)
    }
  )

  await syncTable<Workout>(
    'workouts',
    await db.workouts.toArray(),
    (workout) => mapWorkoutToRemote(workout, user.id),
    mapWorkoutFromRemote,
    async (rows) => {
      await db.workouts.bulkPut(rows)
    }
  )

  await syncTable<PlannedWorkout>(
    'planned_workouts',
    await db.plannedWorkouts.toArray(),
    (row) => mapPlannedWorkoutToRemote(row, user.id),
    mapPlannedWorkoutFromRemote,
    async (rows) => {
      await db.plannedWorkouts.bulkPut(rows)
    }
  )

  await syncTable<ExerciseLog>(
    'exercise_logs',
    await db.exerciseLogs.toArray(),
    (log) => mapExerciseLogToRemote(log, user.id),
    mapExerciseLogFromRemote,
    async (rows) => {
      await db.exerciseLogs.bulkPut(rows)
    }
  )

  await db.syncState.put({ id: 'main', deviceId: user.id, lastSync: now })

  return { ok: true }
}
