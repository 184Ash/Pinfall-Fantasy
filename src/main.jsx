// src/main.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import CreateLeaguePage from './CreateLeaguePage'
import LeaguePage from './LeaguePage'
import AuthCallback from './AuthCallback'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/create" element={<CreateLeaguePage />} />
        <Route path="/join/:joinCode" element={<LeaguePage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="*" element={
          <div style={{ color: 'white', padding: '40px', fontFamily: 'Arial' }}>
            Page not found
          </div>
        } />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)