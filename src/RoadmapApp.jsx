import { Navigate, Route, Routes } from 'react-router-dom'
import { reloadToHashRoute } from './lib/reloadToHashRoute'
import { flushBinStorage } from './lib/storageAdapter'
import { GoogleOAuthProvider } from '@react-oauth/google'
import App from './App.jsx'
import { AppPreloaderOverlay } from './components/ui/AppPreloader.jsx'
import RoadmapAppShell from './components/roadmap/RoadmapAppShell'
import RoadmapProtectedRoute from './components/roadmap/RoadmapProtectedRoute'
import { GOOGLE_CLIENT_ID, isGoogleConnectConfigured } from './config/google'
import { RoadmapAuthProvider, useRoadmapAuth } from './context/RoadmapAuthContext'
import RoadmapLogin from './pages/roadmap/RoadmapLogin'

function DashboardApp() {
  const { logout, profile } = useRoadmapAuth()

  const handleLogout = async () => {
    try {
      await flushBinStorage()
    } catch (err) {
      console.warn('Could not flush workspace before logout:', err)
    }
    logout()
    reloadToHashRoute('/login')
  }

  if (!profile) {
    return <AppPreloaderOverlay label="Loading OverDrive" />
  }

  return <App key={profile.id} onLogout={handleLogout} />
}

function AccountRedirect() {
  return (
    <RoadmapProtectedRoute>
      <DashboardApp />
    </RoadmapProtectedRoute>
  )
}

function RoadmapRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<RoadmapLogin />} />
      <Route path="/account" element={<AccountRedirect />} />
      <Route index element={<Navigate to="/login" replace />} />
      <Route
        path="/*"
        element={
          <RoadmapProtectedRoute>
            <DashboardApp />
          </RoadmapProtectedRoute>
        }
      />
    </Routes>
  )
}

export default function RoadmapApp() {
  const content = (
    <RoadmapAppShell>
      <RoadmapAuthProvider>
        <RoadmapRoutes />
      </RoadmapAuthProvider>
    </RoadmapAppShell>
  )

  if (!isGoogleConnectConfigured) {
    return content
  }

  return <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{content}</GoogleOAuthProvider>
}
