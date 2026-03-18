/* eslint-disable react-refresh/only-export-components */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from './contexts/ThemeContext'
import { ProgressProvider } from './contexts/ProgressContext'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import GenerateSprites from './pages/GenerateSprites'
import GenerateCharacter from './pages/GenerateCharacter'
import CharacterDetail from './pages/CharacterDetail'
import CharacterList from './pages/CharacterList'
import Gallery from './pages/Gallery'
import StorylineDetail from './pages/StorylineDetail'
import BatchDetail from './pages/BatchDetail'
import Settings from './pages/Settings'
import StorylineForm from './pages/StorylineForm'
import StorylineResult from './pages/StorylineResult'
import AuthCallback from './pages/AuthCallback'
import './index.css'
// seedSettings.js no longer needed — API keys are managed by Supabase Edge Function secrets

const queryClient = new QueryClient()

function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-4">404</h1>
        <p className="text-lg opacity-60">Page not found</p>
      </div>
    </div>
  )
}

// Wrap a route element in ProtectedRoute
function Protected({ children }) {
  return <ProtectedRoute>{children}</ProtectedRoute>
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ProgressProvider>
          <AuthProvider>
            <BrowserRouter>
              <Layout>
                <Routes>
                  {/* Root redirect → canonical sprites route */}
                  <Route path="/" element={<Navigate to="/sprites/generate" replace />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  {/* New canonical route */}
                  <Route path="/sprites/generate"      element={<Protected><GenerateSprites /></Protected>} />
                  {/* Legacy route — permanent redirect to new canonical path */}
                  <Route path="/generate"              element={<Navigate to="/sprites/generate" replace />} />
                  <Route path="/characters"            element={<Protected><CharacterList /></Protected>} />
                  <Route path="/characters/generate"   element={<Protected><GenerateCharacter /></Protected>} />
                  <Route path="/characters/generate/:draftId" element={<Protected><GenerateCharacter /></Protected>} />
                  <Route path="/characters/:characterId" element={<Protected><CharacterDetail /></Protected>} />
                  <Route path="/gallery"               element={<Protected><Gallery /></Protected>} />
                  <Route path="/storyline"             element={<Protected><StorylineDetail /></Protected>} />
                  <Route path="/storyline/new"         element={<Protected><StorylineForm /></Protected>} />
                  <Route path="/storyline/result/:id"  element={<Protected><StorylineResult /></Protected>} />
                  <Route path="/batch"                 element={<Protected><BatchDetail /></Protected>} />
                  <Route path="/settings"              element={<Protected><Settings /></Protected>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Layout>
            </BrowserRouter>
          </AuthProvider>
        </ProgressProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
