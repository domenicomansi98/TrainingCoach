import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getPlanForDate } from '../data/db'

const ProgressView = () => {
  const plans = useLiveQuery(() => db.plans.toArray(), [])
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const logs = useLiveQuery(() => db.exerciseLogs.toArray(), [])
  const workouts = useLiveQuery(() => db.workouts.toArray(), [])
  const [selectedCluster, setSelectedCluster] = useState<
    'push' | 'pull' | 'leg' | 'other' | null
  >(null)
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)
  const [metric, setMetric] = useState<'volume' | 'weight'>('volume')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const activePlan = useMemo(() => getPlanForDate(plans, new Date()), [plans])
  const sessions = useLiveQuery(
    () => (activePlan ? db.sessions.where('planId').equals(activePlan.id).sortBy('order') : []),
    [activePlan?.id]
  )

  const exerciseMap = useMemo(() => {
    const map = new Map<string, { name: string; movement: string; sessionId: string }>()
    exercises?.forEach((exercise) =>
      map.set(exercise.id, {
        name: exercise.name,
        movement: exercise.movement,
        sessionId: exercise.sessionId
      })
    )
    return map
  }, [exercises])

  const workoutMap = useMemo(() => {
    const map = new Map<string, { date: string; status: string }>()
    workouts?.forEach((workout) =>
      map.set(workout.id, { date: workout.date, status: workout.status })
    )
    return map
  }, [workouts])

  const loadSeries = useMemo(() => {
    const clusterMap = new Map<
      string,
      Map<string, { date: string; load: number; weightSum: number; weightCount: number }>
    >()
    const exerciseSeries = new Map<
      string,
      Map<string, { date: string; load: number; weightSum: number; weightCount: number }>
    >()

    logs?.forEach((log) => {
      const meta = exerciseMap.get(log.exerciseId)
      if (!meta) return
      const workoutMeta = workoutMap.get(log.workoutId)
      if (!workoutMeta || workoutMeta.status !== 'completed') return
      const date = workoutMeta.date
      const dayKey = new Date(date).toDateString()
      const reps = log.reps ?? 0
      const load = (log.weight ?? 0) * (log.completedSets ?? 0) * reps

      const clusterKey = meta.movement
      if (!clusterMap.has(clusterKey)) clusterMap.set(clusterKey, new Map())
      const daySeries = clusterMap.get(clusterKey)!
      const entry = daySeries.get(dayKey) ?? { date, load: 0, weightSum: 0, weightCount: 0 }
      entry.load += load
      if (typeof log.weight === 'number') {
        entry.weightSum += log.weight
        entry.weightCount += 1
      }
      daySeries.set(dayKey, entry)

      if (!exerciseSeries.has(meta.name)) exerciseSeries.set(meta.name, new Map())
      const exDaySeries = exerciseSeries.get(meta.name)!
      const exEntry = exDaySeries.get(dayKey) ?? {
        date,
        load: 0,
        weightSum: 0,
        weightCount: 0
      }
      exEntry.load += load
      if (typeof log.weight === 'number') {
        exEntry.weightSum += log.weight
        exEntry.weightCount += 1
      }
      exDaySeries.set(dayKey, exEntry)
    })

    const clusterList = Array.from(clusterMap.entries()).map(([movement, series]) => ({
      movement,
      entries: Array.from(series.values())
        .map((entry) => ({
          ...entry,
          weightAvg: entry.weightCount ? entry.weightSum / entry.weightCount : 0
        }))
        .sort((a, b) => (a.date > b.date ? 1 : -1))
    }))

    const exerciseList = Array.from(exerciseSeries.entries()).map(([name, series]) => {
      const example = exercises?.find((exercise) => exercise.name === name)
      return {
        name,
        movement: example?.movement ?? 'other',
        entries: Array.from(series.values())
          .map((entry) => ({
            ...entry,
            weightAvg: entry.weightCount ? entry.weightSum / entry.weightCount : 0
          }))
          .sort((a, b) => (a.date > b.date ? 1 : -1))
      }
    })

    return { clusterList, exerciseList }
  }, [logs, exerciseMap, workoutMap, exercises])

  const filterByDate = <T extends { date: string }>(entries: T[]) => {
    const start = startDate ? new Date(startDate) : null
    const end = endDate ? new Date(endDate) : null
    return entries.filter((entry) => {
      const d = new Date(entry.date)
      if (start && d < start) return false
      if (end && d > end) return false
      return true
    })
  }

  const parsePlanNameRange = (name: string) => {
    const map: Record<string, number> = {
      gennaio: 0,
      febbraio: 1,
      marzo: 2,
      aprile: 3,
      maggio: 4,
      giugno: 5,
      luglio: 6,
      agosto: 7,
      settembre: 8,
      ottobre: 9,
      novembre: 10,
      dicembre: 11
    }
    const lower = name.toLowerCase()
    const monthKey = Object.keys(map).find((key) => lower.includes(key))
    const yearMatch = lower.match(/\b(20\d{2})\b/)
    if (!monthKey || !yearMatch) return undefined
    const year = Number(yearMatch[1])
    const month = map[monthKey]
    return {
      start: new Date(year, month, 1),
      end: new Date(year, month + 1, 0)
    }
  }

  const parseWeekString = (text?: string | null) => {
    if (!text) return { sets: 0, reps: 0, weight: null as number | null }
    const cleaned = text.replace(',', '.')
    const weightMatch = cleaned.match(/([+]?)(\d+(?:\.\d+)?)\s*kg/i)
    const weight = weightMatch ? Number(weightMatch[2]) : null
    const setsMatch = cleaned.match(/(\d+)\s*[x×]/i)
    const sets = setsMatch ? Number(setsMatch[1]) : 0
    const repsMatch = cleaned.match(/x\s*(\d+)(?:\s*-\s*(\d+))?/i)
    let reps = 0
    if (repsMatch) {
      const a = Number(repsMatch[1])
      const b = repsMatch[2] ? Number(repsMatch[2]) : a
      reps = (a + b) / 2
    }
    return { sets, reps, weight }
  }

  const trainingDays = [1, 2, 4, 5]

  const avgRepsByExercise = useMemo(() => {
    const map = new Map<string, { repsSum: number; count: number }>()
    logs?.forEach((log) => {
      if (typeof log.reps !== 'number') return
      const exercise = exercises?.find((ex) => ex.id === log.exerciseId)
      if (!exercise) return
      const key = exercise.name
      const entry = map.get(key) ?? { repsSum: 0, count: 0 }
      entry.repsSum += log.reps
      entry.count += 1
      map.set(key, entry)
    })
    const out = new Map<string, number>()
    map.forEach((entry, key) => {
      out.set(key, entry.count ? entry.repsSum / entry.count : 0)
    })
    return out
  }, [logs, exercises])

  const LineChart = ({
    labels,
    actualValues,
    projectedValues
  }: {
    labels: string[]
    actualValues: Array<number | null>
    projectedValues: Array<number | null>
  }) => {
    const [hoverIndex, setHoverIndex] = useState<number | null>(null)
    const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null)
    const allValues = [...actualValues, ...projectedValues].filter(
      (value): value is number => typeof value === 'number'
    )
    if (!allValues.length) return <span className="muted">No data</span>
    const max = Math.max(...allValues)
    const min = Math.min(...allValues)
    const padding = { left: 56, right: 20, top: 18, bottom: 44 }
    const width = 620
    const height = 200
    const innerW = width - padding.left - padding.right
    const innerH = height - padding.top - padding.bottom
    const range = max - min || 1
    const pointFor = (value: number, idx: number) => {
      const x = padding.left + (idx / Math.max(labels.length - 1, 1)) * innerW
      const y = padding.top + innerH - ((value - min) / range) * innerH
      return { x, y, value, label: labels[idx], idx }
    }
    const actualPoints = actualValues
      .map((value, idx) => (typeof value === 'number' ? pointFor(value, idx) : null))
      .filter(Boolean) as Array<{ x: number; y: number; value: number; label: string; idx: number }>
    const projectedPoints = projectedValues
      .map((value, idx) => (typeof value === 'number' ? pointFor(value, idx) : null))
      .filter(Boolean) as Array<{ x: number; y: number; value: number; label: string; idx: number }>

    const lineFor = (points: Array<{ x: number; y: number }>) =>
      points.map((p) => `${p.x},${p.y}`).join(' ')
    const fillFor = (points: Array<{ x: number; y: number }>) =>
      points.length
        ? `${lineFor(points)} ${padding.left + innerW},${padding.top + innerH} ${padding.left},${
            padding.top + innerH
          }`
        : ''
    const actualLine = lineFor(actualPoints)
    const actualFill = fillFor(actualPoints)
    const projectedLine = lineFor(projectedPoints)
    const onMove = (event: React.MouseEvent<SVGSVGElement>) => {
      const rect = event.currentTarget.getBoundingClientRect()
      const x = event.clientX - rect.left
      let closest = 0
      let minDist = Infinity
      labels.forEach((_, idx) => {
        const px = padding.left + (idx / Math.max(labels.length - 1, 1)) * innerW
        const d = Math.abs(px - x)
        if (d < minDist) {
          minDist = d
          closest = idx
        }
      })
      const actualValue = actualValues[closest]
      const projectedValue = projectedValues[closest]
      const value =
        typeof actualValue === 'number'
          ? actualValue
          : typeof projectedValue === 'number'
          ? projectedValue
          : null
      if (value === null) {
        setHoverIndex(null)
        setHoverPos(null)
        return
      }
      const point = pointFor(value, closest)
      setHoverIndex(closest)
      setHoverPos({ x: point.x, y: point.y })
    }
    const onLeave = () => {
      setHoverIndex(null)
      setHoverPos(null)
    }
    const yTicks = 4
    const xStep = Math.max(1, Math.ceil(labels.length / 5))
    const formatDate = (label: string) => {
      if (label.includes('-')) {
        const [y, m, d] = label.split('-')
        return `${d}/${m}`
      }
      const parts = label.split('/')
      if (parts.length === 3) return `${parts[0]}/${parts[1]}`
      return label
    }
    return (
      <div className="chart-wrap">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="chart chart-wide"
          onMouseMove={onMove}
          onMouseLeave={onLeave}
        >
          <defs>
            <linearGradient id="chartFill" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#6a5cff" stopOpacity="0.45" />
              <stop offset="60%" stopColor="#40c9ff" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#ff6aa2" stopOpacity="0.12" />
            </linearGradient>
            <linearGradient id="chartLine" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#6a5cff" />
              <stop offset="60%" stopColor="#40c9ff" />
              <stop offset="100%" stopColor="#ff6aa2" />
            </linearGradient>
          </defs>
          {Array.from({ length: yTicks + 1 }).map((_, i) => {
            const y = padding.top + (innerH / yTicks) * i
            const value = max - (range / yTicks) * i
            return (
              <g key={`ytick-${i}`}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={padding.left + innerW}
                  y2={y}
                  stroke="currentColor"
                  opacity="0.12"
                />
                <text
                  x={padding.left - 10}
                  y={y + 4}
                  fontSize="10"
                  fill="currentColor"
                  textAnchor="end"
                >
                  {value.toFixed(0)}
                </text>
              </g>
            )
          })}
          <line
            x1={padding.left}
            y1={padding.top + innerH}
            x2={padding.left + innerW}
            y2={padding.top + innerH}
            stroke="currentColor"
            opacity="0.2"
          />
          {actualFill && <polygon fill="url(#chartFill)" points={actualFill} />}
          <polyline fill="none" stroke="url(#chartLine)" strokeWidth="3" points={actualLine} />
          {projectedLine && (
            <polyline
              fill="none"
              stroke="url(#chartLine)"
              strokeWidth="2.5"
              strokeDasharray="6 6"
              points={projectedLine}
              opacity="0.7"
            />
          )}
          {actualPoints.map((p) => (
            <circle key={`a-${p.idx}`} cx={p.x} cy={p.y} r="4" fill="#e2e8f0" />
          ))}
          {projectedPoints.map((p) => (
            <circle key={`p-${p.idx}`} cx={p.x} cy={p.y} r="3.5" fill="#e2e8f0" opacity="0.6" />
          ))}
          {labels.map((label, idx) => {
            if (idx % xStep !== 0 && idx !== labels.length - 1) return null
            const x = padding.left + (idx / Math.max(labels.length - 1, 1)) * innerW
            return (
              <text
                key={`xlabel-${label}-${idx}`}
                x={x}
                y={padding.top + innerH + 22}
                fontSize="10"
                fill="currentColor"
                textAnchor="middle"
              >
                {formatDate(label)}
              </text>
            )
          })}
          {hoverIndex !== null && hoverPos && (
            <circle cx={hoverPos.x} cy={hoverPos.y} r="6" fill="#ffffff" />
          )}
        </svg>
        {hoverIndex !== null && hoverPos && (
          <div
            className="chart-tooltip"
            style={{ left: hoverPos.x + 12, top: hoverPos.y - 34 }}
          >
            <div>
              {labels[hoverIndex].includes('-')
                ? labels[hoverIndex].split('-').reverse().join('/')
                : labels[hoverIndex]}
            </div>
            <strong>
              {(
                (typeof actualValues[hoverIndex] === 'number'
                  ? actualValues[hoverIndex]
                  : projectedValues[hoverIndex]) ?? 0
              ).toFixed(1)}
            </strong>
          </div>
        )}
      </div>
    )
  }

  const selectedClusterSeries = selectedCluster
    ? loadSeries.clusterList.find((c) => c.movement === selectedCluster)?.entries ?? []
    : []
  const selectedExerciseSeries = selectedExercise
    ? loadSeries.exerciseList.find((ex) => ex.name === selectedExercise)?.entries ?? []
    : []

  const aggregateSeries = useMemo(() => {
    const map = new Map<
      string,
      { date: string; load: number; weightSum: number; weightCount: number }
    >()
    loadSeries.clusterList.forEach((cluster) => {
      cluster.entries.forEach((entry) => {
        const key = new Date(entry.date).toDateString()
        const existing = map.get(key) ?? {
          date: entry.date,
          load: 0,
          weightSum: 0,
          weightCount: 0
        }
        existing.load += entry.load
        existing.weightSum += entry.weightAvg
        existing.weightCount += 1
        map.set(key, existing)
      })
    })
    return Array.from(map.values())
      .map((entry) => ({
        ...entry,
        weightAvg: entry.weightCount ? entry.weightSum / entry.weightCount : 0
      }))
      .sort((a, b) => (a.date > b.date ? 1 : -1))
  }, [loadSeries.clusterList])

  const projectedSeries = useMemo(() => {
    if (!activePlan || !sessions?.length || !exercises?.length) return []
    const planRange =
      activePlan.startDate && activePlan.endDate
        ? {
            start: new Date(`${activePlan.startDate}T00:00:00`),
            end: new Date(`${activePlan.endDate}T00:00:00`)
          }
        : parsePlanNameRange(activePlan.name)
    if (!planRange) return []

    const completedByDate = new Set(
      workouts
        ?.filter((workout) => workout.status === 'completed')
        .map((workout) => new Date(workout.date).toDateString()) ?? []
    )

    const avgWeightByExercise = new Map<string, number>()
    const weightCounts = new Map<string, number>()
    logs?.forEach((log) => {
      if (typeof log.weight !== 'number') return
      const exercise = exercises?.find((ex) => ex.id === log.exerciseId)
      if (!exercise) return
      const key = exercise.name
      avgWeightByExercise.set(key, (avgWeightByExercise.get(key) ?? 0) + log.weight)
      weightCounts.set(key, (weightCounts.get(key) ?? 0) + 1)
    })
    avgWeightByExercise.forEach((sum, key) => {
      const count = weightCounts.get(key) ?? 1
      avgWeightByExercise.set(key, sum / count)
    })
    const globalAvg =
      avgWeightByExercise.size > 0
        ? Array.from(avgWeightByExercise.values()).reduce((a, b) => a + b, 0) /
          avgWeightByExercise.size
        : 0

    const sessionExercises = new Map<string, typeof exercises>()
    sessions.forEach((session) => {
      sessionExercises.set(
        session.id,
        exercises.filter((exercise) => exercise.sessionId === session.id)
      )
    })

    const result: Array<{ date: string; load: number; weightAvg: number }> = []
    let trainingIndex = 0
    for (
      let d = new Date(planRange.start);
      d <= planRange.end;
      d.setDate(d.getDate() + 1)
    ) {
      if (!trainingDays.includes(d.getDay())) continue
      trainingIndex += 1
      const weekNumber = Math.min(4, Math.floor((trainingIndex - 1) / 4) + 1)
      if (completedByDate.has(d.toDateString())) {
        continue
      }
      const session = sessions[(trainingIndex - 1) % sessions.length]
      const exList = sessionExercises.get(session.id) ?? []
      let dayLoad = 0
      let weightSum = 0
      let weightCount = 0
      exList.forEach((exercise) => {
        const weekText =
          weekNumber === 1
            ? exercise.week1
            : weekNumber === 2
            ? exercise.week2
            : weekNumber === 3
            ? exercise.week3
            : exercise.week4
        const weekTextValue = weekText ?? ''
        const parsed = parseWeekString(weekTextValue)
        const sets = parsed.sets || exercise.plannedSets || 0
        const reps =
          parsed.reps ||
          avgRepsByExercise.get(exercise.name) ||
          8
        const weight =
          parsed.weight ?? avgWeightByExercise.get(exercise.name) ?? globalAvg ?? 0
        if (weight > 0) {
          weightSum += weight
          weightCount += 1
        }
        dayLoad += sets * reps * (weight ?? 0)
      })
      result.push({
        date: d.toISOString(),
        load: dayLoad,
        weightAvg: weightCount ? weightSum / weightCount : 0
      })
    }
    return result
  }, [activePlan, sessions, exercises, logs, workouts, avgRepsByExercise])

  const series = filterByDate(
    selectedExercise
      ? selectedExerciseSeries
      : selectedCluster
      ? selectedClusterSeries
      : aggregateSeries
  )
  const actualSeries = series.map((entry) => ({
    date: new Date(entry.date).toISOString().slice(0, 10),
    load: entry.load,
    weightAvg: entry.weightAvg
  }))
  const projectedFiltered = filterByDate(projectedSeries).map((entry) => ({
    date: new Date(entry.date).toISOString().slice(0, 10),
    load: entry.load,
    weightAvg: entry.weightAvg
  }))

  const labelSet = new Set<string>()
  actualSeries.forEach((entry) => labelSet.add(entry.date))
  projectedFiltered.forEach((entry) => labelSet.add(entry.date))
  const chartLabels = Array.from(labelSet.values()).sort()

  const actualMap = new Map(actualSeries.map((entry) => [entry.date, entry]))
  const projectedMap = new Map(projectedFiltered.map((entry) => [entry.date, entry]))

  const chartActualValues = chartLabels.map((label) => {
    const entry = actualMap.get(label)
    if (!entry) return null
    return metric === 'volume' ? entry.load : entry.weightAvg
  })
  const chartProjectedValues = chartLabels.map((label) => {
    if (actualMap.has(label)) return null
    const entry = projectedMap.get(label)
    if (!entry) return null
    return metric === 'volume' ? entry.load : entry.weightAvg
  })
  const chartTitle = selectedExercise
    ? `${selectedExercise} · ${metric === 'volume' ? 'Volume' : 'Avg Weight'}`
    : selectedCluster
    ? `${selectedCluster} cluster · ${metric === 'volume' ? 'Volume' : 'Avg Weight'}`
    : `All training · ${metric === 'volume' ? 'Volume' : 'Avg Weight'}`

  return (
    <div className="section">
      <div className="card progress-header">
        <div className="toolbar">
          <div>
            <div className="section-title">Progress</div>
            <div className="muted">
              Volume load = sets × reps × weight, summed by day.
            </div>
          </div>
          <div className="toolbar-group">
            <button
              className={`tab-pill ${metric === 'volume' ? 'active' : ''}`}
              onClick={() => setMetric('volume')}
            >
              Volume
            </button>
            <button
              className={`tab-pill ${metric === 'weight' ? 'active' : ''}`}
              onClick={() => setMetric('weight')}
            >
              Avg weight
            </button>
            <div>
              <label>Start date</label>
              <input
                className="input"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div>
              <label>End date</label>
              <input
                className="input"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="progress-grid">
        <div className="card">
          <div className="section-title">Clusters</div>
          <div className="widget-grid">
            {loadSeries.clusterList.map((cluster) => {
              const filtered = filterByDate(cluster.entries)
              const latest = filtered[filtered.length - 1]
              return (
                <button
                  key={cluster.movement}
                  className={`widget gradient-widget stat-variant-a ${
                    selectedCluster === cluster.movement ? 'active' : ''
                  }`}
                  onClick={() => {
                    setSelectedCluster(cluster.movement as any)
                    setSelectedExercise(null)
                  }}
                >
                  <div className="widget-title">{cluster.movement}</div>
                  <div className="widget-value">{latest?.load ?? 0}</div>
                  <div className="muted">Latest volume</div>
                </button>
              )
            })}
          </div>

          <div className="section-title" style={{ marginTop: '16px' }}>
            Exercises
          </div>
          {selectedCluster ? (
            <div className="chip-group">
              {loadSeries.exerciseList
                .filter((ex) => ex.movement === selectedCluster)
                .map((exercise) => (
                  <button
                    key={exercise.name}
                    className={`chip ${selectedExercise === exercise.name ? 'active' : ''}`}
                    onClick={() => setSelectedExercise(exercise.name)}
                  >
                    {exercise.name}
                  </button>
                ))}
            </div>
          ) : (
            <div className="muted">Select a cluster to view exercises.</div>
          )}
        </div>

        <div className="progress-chart card">
          <div className="row" style={{ justifyContent: 'space-between', width: '100%' }}>
            <div className="pill">{chartTitle}</div>
            <div className="muted">Solid = completed · Dotted = projected</div>
          </div>
          <LineChart
            labels={chartLabels}
            actualValues={chartActualValues}
            projectedValues={chartProjectedValues}
          />
        </div>
      </div>
    </div>
  )
}

export default ProgressView
