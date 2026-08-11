// src/main.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import CreateLeaguePage from './CreateLeaguePage'
import LeaguePage from './LeaguePage'
import AuthCallback from './AuthCallback'
import LandingPage from './LandingPage'
import CreatePoolPage from './pickem/CreatePoolPage'
import PoolPage from './pickem/PoolPage'
import ResultsArchive from './pickem/ResultsArchive'
import { isSessionStorageAvailable } from './session'

if (!isSessionStorageAvailable()) {
  document.getElementById('root').innerHTML = `
    <div style="min-height:100vh;background:#0D1520;display:flex;align-items:center;
      justify-content:center;font-family:Arial,sans-serif;padding:40px;text-align:center;">
      <div>
        <div style="font-size:13px;letter-spacing:3px;color:#C9A84C;text-transform:uppercase;margin-bottom:16px">
          Pinfall Fantasy
        </div>
        <div style="font-size:20px;font-weight:700;color:#E8EDF2;margin-bottom:12px">
          Browser Storage Required
        </div>
        <div style="font-size:14px;color:#7A8A9A;line-height:1.7;max-width:400px;margin:0 auto">
          Pinfall Fantasy needs browser session storage to keep you logged in during the draft.
          Your browser appears to have this blocked.<br><br>
          To fix this, disable your cookie/storage blocker for this site, or try a different browser such as Chrome or Edge.
        </div>
      </div>
    </div>
  `
} else {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/create" element={<CreateLeaguePage />} />
          <Route path="/join/:joinCode" element={<LeaguePage />} />
          <Route path="/pickem/create" element={<CreatePoolPage />} />
          {/* Public results archive — no pool membership required */}
          <Route path="/results" element={<ResultsArchive standalone />} />
          <Route path="/pickem/:joinCode" element={<PoolPage />} />
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
}
