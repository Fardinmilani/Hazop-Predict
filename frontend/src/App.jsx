import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import FilePage from './pages/FilePage'
import LibraryPage from './pages/LibraryPage'
import ProjectPage from './pages/ProjectPage'
import MethodologyPage from './pages/MethodologyPage'
import RankingPage from './pages/RankingPage'
import ReportPage from './pages/ReportPage'

function App() {
  return (
    <Router>
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Navbar />
          <main className="flex-1 overflow-y-auto p-6">
            <Routes>
              <Route path="/" element={<FilePage />} />
              <Route path="/file" element={<FilePage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/project" element={<ProjectPage />} />
              <Route path="/methodology" element={<MethodologyPage />} />
              <Route path="/ranking" element={<RankingPage />} />
              <Route path="/report" element={<ReportPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  )
}

export default App

