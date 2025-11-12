import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  FileText, Library, FolderOpen, Brain, 
  BarChart3, FileBarChart, Home 
} from 'lucide-react'

function Sidebar() {
  const location = useLocation()

  const menuItems = [
    { path: '/file', label: 'File', icon: FileText },
    { path: '/library', label: 'Library', icon: Library },
    { path: '/project', label: 'Project', icon: FolderOpen },
    { path: '/methodology', label: 'Methodology', icon: Brain },
    { path: '/ranking', label: 'Ranking', icon: BarChart3 },
    { path: '/report', label: 'Reports', icon: FileBarChart }
  ]

  return (
    <aside className="w-64 bg-gray-800 text-white shadow-lg">
      <div className="p-4">
        <div className="flex items-center space-x-2 mb-8">
          <Home className="w-6 h-6" />
          <span className="text-xl font-bold">HAZOP</span>
        </div>
        <nav className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}

export default Sidebar

