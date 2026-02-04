import { Link } from 'react-router-dom'

const Landing = () => (
  <div className="section">
    <div className="glass-card hero">
      <div className="toolbar">
        <div>
          <div className="pill">Workout Planner</div>
          <div className="hero-title">Train smarter. Track everything.</div>
          <div className="muted">
            Sign in to access your personalized plans, sessions, and progress history.
          </div>
        </div>
        <Link className="button primary" to="/auth">
          Sign In
        </Link>
      </div>
      <div className="stat-grid">
        <div className="stat-card gradient-widget stat-variant-a">
          <div className="row">
            <div className="icon-bubble">🗓️</div>
            <div>
              <div className="muted">Plan cycles</div>
              <div className="stat-value">Monthly</div>
            </div>
          </div>
        </div>
        <div className="stat-card gradient-widget stat-variant-b">
          <div className="row">
            <div className="icon-bubble">✅</div>
            <div>
              <div className="muted">Track completion</div>
              <div className="stat-value">Sets + Reps</div>
            </div>
          </div>
        </div>
        <div className="stat-card gradient-widget stat-variant-c">
          <div className="row">
            <div className="icon-bubble">📈</div>
            <div>
              <div className="muted">Progress</div>
              <div className="stat-value">Volume & Load</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div className="grid">
      <div className="card">
        <h3>Plan by month</h3>
        <div className="muted">
          Your plan adapts with weekly progressions and tracks your training blocks.
        </div>
      </div>
      <div className="card">
        <h3>Log workouts</h3>
        <div className="muted">
          Record weights, reps, exertion, and notes for every session.
        </div>
      </div>
      <div className="card">
        <h3>See trends</h3>
        <div className="muted">
          Track volume and average weights to visualize real progress.
        </div>
      </div>
    </div>
  </div>
)

export default Landing
