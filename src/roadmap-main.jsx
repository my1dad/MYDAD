import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import './roadmap-auth.css'
import RoadmapApp from './RoadmapApp.jsx'
import StorageBootstrap from './components/StorageBootstrap.jsx'
import { AppPreloaderOverlay } from './components/ui/AppPreloader.jsx'

class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'system-ui', color: '#b91c1c' }}>
          <h1>Something went wrong</h1>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '14px' }}>
            {this.state.error.message}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

function bootstrap() {
  const rootEl = document.getElementById('root')
  if (!rootEl) {
    document.body.innerHTML =
      '<p style="padding:2rem;font-family:system-ui">Missing #root element.</p>'
    return
  }

  rootEl.dataset.booted = '1'

  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <StorageBootstrap fallback={<AppPreloaderOverlay label="Loading OverDrive" />}>
          <HashRouter>
            <RoadmapApp />
          </HashRouter>
        </StorageBootstrap>
      </ErrorBoundary>
    </StrictMode>,
  )
}

bootstrap()
