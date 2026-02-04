import { Link } from 'react-router-dom'

const Landing = () => (
  <div className="auth-page landing-page">
    <div className="auth-card landing-card">
      <div className="auth-header">
        <div className="pill">Welcome</div>
        <h1>Start your fitness journey</h1>
        <p className="muted">
          Access your personalized plans, track sessions, and monitor progress with a premium
          experience.
        </p>
      </div>
      <div className="landing-actions">
        <Link className="button primary" to="/auth">
          Login
        </Link>
        <Link className="button ghost" to="/auth">
          Register
        </Link>
      </div>
      <div className="landing-highlights">
        <div className="highlight">
          <div className="highlight-icon">📅</div>
          <div>
            <div className="highlight-title">Monthly plans</div>
            <div className="muted">Structured blocks that evolve week to week.</div>
          </div>
        </div>
        <div className="highlight">
          <div className="highlight-icon">🏋️</div>
          <div>
            <div className="highlight-title">Session logging</div>
            <div className="muted">Track weights, reps, exertion, and notes.</div>
          </div>
        </div>
        <div className="highlight">
          <div className="highlight-icon">📈</div>
          <div>
            <div className="highlight-title">Progress insights</div>
            <div className="muted">Volume & load trends with projections.</div>
          </div>
        </div>
      </div>
    </div>
  </div>
)

export default Landing
