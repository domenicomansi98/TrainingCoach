import { db } from './db'

export const getPlans = () => db.plans.orderBy('createdAt').reverse().toArray()

export const getPlanById = (planId: string) => db.plans.get(planId)

export const getSessionsByPlan = (planId: string) =>
  db.sessions.where('planId').equals(planId).sortBy('order')

export const getSessionById = (sessionId: string) => db.sessions.get(sessionId)

export const getExercisesBySession = (sessionId: string) =>
  db.exercises.where('sessionId').equals(sessionId).sortBy('order')

export const getWorkouts = () => db.workouts.orderBy('date').reverse().toArray()

export const getWorkoutsBySession = (sessionId: string) =>
  db.workouts.where('sessionId').equals(sessionId).sortBy('date')

export const getWorkoutById = (workoutId: string) => db.workouts.get(workoutId)

export const getExerciseLogsByWorkout = (workoutId: string) =>
  db.exerciseLogs.where('workoutId').equals(workoutId).toArray()

export const getExerciseById = (exerciseId: string) => db.exercises.get(exerciseId)
