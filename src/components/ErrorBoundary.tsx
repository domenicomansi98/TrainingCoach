import { Component, ReactNode } from 'react'

type Props = { children: ReactNode }

type State = { hasError: boolean; message?: string }

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error) {
    console.error('UI error:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card">
          <div className="section-title">Something went wrong</div>
          <div className="muted">{this.state.message ?? 'Unknown error'}</div>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
