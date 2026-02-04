import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'

const ProgressView = () => {
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

  const exerciseMap = useMemo(() => {
    const map = new Map<string, { name: string; movement: string }>()
    exercises?.forEach((exercise) =>
      map.set(exercise.id, { name: exercise.name, movement: exercise.movement })
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

  const LineChart = ({
    values,
    labels
  }: {
    values: number[]
    labels: string[]
  }) => {
    const [hoverIndex, setHoverIndex] = useState<number | null>(null)
    const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null)
    if (!values.length) return <span className="muted">No data</span>
    const max = Math.max(...values)
    const min = Math.min(...values)
    const padding = { left: 56, right: 20, top: 18, bottom: 44 }
    const width = 620
    const height = 200
    const innerW = width - padding.left - padding.right
    const innerH = height - padding.top - padding.bottom
    const range = max - min || 1
    const points = values.map((value, idx) => {
      const x = padding.left + (idx / Math.max(values.length - 1, 1)) * innerW
      const y = padding.top + innerH - ((value - min) / range) * innerH
      return { x, y, value, label: labels[idx] }
    })
    const line = points.map((p) => `${p.x},${p.y}`).join(' ')
    const fill = `${line} ${padding.left + innerW},${padding.top + innerH} ${padding.left},${
      padding.top + innerH
    }`
    const onMove = (event: React.MouseEvent<SVGSVGElement>) => {
      const rect = event.currentTarget.getBoundingClientRect()
      const x = event.clientX - rect.left
      let closest = 0
      let minDist = Infinity
      points.forEach((p, idx) => {
        const d = Math.abs(p.x - x)
        if (d < minDist) {
          minDist = d
          closest = idx
        }
      })
      setHoverIndex(closest)
      setHoverPos({ x: points[closest].x, y: points[closest].y })
    }
    const onLeave = () => {
      setHoverIndex(null)
      setHoverPos(null)
    }
    const yTicks = 4
    const xStep = Math.max(1, Math.ceil(values.length / 5))
    const formatDate = (label: string) => {
      const parts = label.split('/')
      if (parts.length === 3) return `${parts[0]}/${parts[1]}`
      return label
    }
    return (
      <div className="chart-wrap">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="chart chart-compact"
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
          <polygon fill="url(#chartFill)" points={fill} />
          <polyline fill="none" stroke="url(#chartLine)" strokeWidth="3" points={line} />
          {points.map((p) => (
            <circle key={`${p.x}-${p.y}`} cx={p.x} cy={p.y} r="4" fill="#e2e8f0" />
          ))}
          {points.map((p, idx) => {
            if (idx % xStep !== 0 && idx !== points.length - 1) return null
            return (
              <text
                key={`xlabel-${idx}`}
                x={p.x}
                y={padding.top + innerH + 22}
                fontSize="10"
                fill="currentColor"
                textAnchor="middle"
              >
                {formatDate(p.label)}
              </text>
            )
          })}
          {hoverIndex !== null && points[hoverIndex] && (
            <circle cx={points[hoverIndex].x} cy={points[hoverIndex].y} r="6" fill="#ffffff" />
          )}
        </svg>
        {hoverIndex !== null && points[hoverIndex] && hoverPos && (
          <div
            className="chart-tooltip"
            style={{ left: hoverPos.x + 12, top: hoverPos.y - 34 }}
          >
            <div>{points[hoverIndex].label}</div>
            <strong>{points[hoverIndex].value.toFixed(1)}</strong>
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
    const map = new Map<string, { date: string; load: number; weightAvg: number; count: number }>()
    loadSeries.clusterList.forEach((cluster) => {
      cluster.entries.forEach((entry) => {
        const key = new Date(entry.date).toDateString()
        const existing = map.get(key) ?? {
          date: entry.date,
          load: 0,
          weightAvg: 0,
          count: 0
        }
        existing.load += entry.load
        existing.weightAvg += entry.weightAvg
        existing.count += 1
        map.set(key, existing)
      })
    })
    return Array.from(map.values())
      .map((entry) => ({
        ...entry,
        weightAvg: entry.count ? entry.weightAvg / entry.count : 0
      }))
      .sort((a, b) => (a.date > b.date ? 1 : -1))
  }, [loadSeries.clusterList])

  const series = filterByDate(
    selectedExercise
      ? selectedExerciseSeries
      : selectedCluster
      ? selectedClusterSeries
      : aggregateSeries
  )
  const chartValues =
    metric === 'volume'
      ? series.map((entry) => entry.load)
      : series.map((entry) => entry.weightAvg)
  const chartLabels = series.map((entry) => new Date(entry.date).toLocaleDateString())
  const chartTitle = selectedExercise
    ? `${selectedExercise} · ${metric === 'volume' ? 'Volume' : 'Avg Weight'}`
    : selectedCluster
    ? `${selectedCluster} cluster · ${metric === 'volume' ? 'Volume' : 'Avg Weight'}`
    : `All training · ${metric === 'volume' ? 'Volume' : 'Avg Weight'}`

  return (
    <div className="section">
      <div className="progress-layout">
        <div className="glass-card progress-panel">
          <div className="section-title">Progress</div>
          <div className="muted">
            Volume load = sets × reps × weight, summed by day.
          </div>
          <div className="toolbar-group" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
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

        <div className="card progress-panel">
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
        </div>

        <div className="progress-chart card">
          <div className="row">
            <div className="pill">{chartTitle}</div>
          </div>
          <LineChart values={chartValues} labels={chartLabels} />
        </div>
      </div>

      <div className="card">
        <div className="section-title">Exercises</div>
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
        {selectedCluster && (
          <div className="table">
            {loadSeries.exerciseList
              .filter((ex) => ex.movement === selectedCluster)
              .map((exercise) => {
                const filtered = filterByDate(exercise.entries)
                const latest = filtered[filtered.length - 1]
                const full = exercises?.find((e) => e.name === exercise.name)
                return (
                  <div key={exercise.name} className="row">
                    <div className="pill">{exercise.name}</div>
                    <div className="muted">Latest: {latest?.load ?? 0}</div>
                    <select
                      className="select"
                      value={full?.movement ?? 'other'}
                      onChange={(event) => {
                        const updatedAt = new Date().toISOString()
                        if (full) {
                          db.exercises.update(full.id, {
                            movement: event.target.value as any,
                            updatedAt
                          })
                        }
                      }}
                    >
                      {['push', 'pull', 'leg', 'other'].map((movement) => (
                        <option key={movement} value={movement}>
                          {movement}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })}
          </div>
        )}
      </div>
    </div>
  )
}

export default ProgressView
