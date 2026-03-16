import { Routes, Route, Navigate } from 'react-router-dom'
import Generate from './pages/Generate'
import GenerateCharacter from './pages/GenerateCharacter'
import Gallery from './pages/Gallery'
import StorylineDetail from './pages/StorylineDetail'
import BatchDetail from './pages/BatchDetail'
import Settings from './pages/Settings'
import AuthCallback from './pages/AuthCallback'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/generate" replace />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/generate" element={<Generate />} />
      <Route path="/characters/generate" element={<GenerateCharacter />} />
      <Route path="/characters/generate/:draftId" element={<GenerateCharacter />} />
      <Route path="/characters/:characterId" element={<GenerateCharacter />} />
      <Route path="/characters" element={<Navigate to="/characters/generate" replace />} />
      <Route path="/gallery" element={<Gallery />} />
      <Route path="/storyline" element={<StorylineDetail />} />
      <Route path="/batch" element={<BatchDetail />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

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
