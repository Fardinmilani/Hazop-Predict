import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  FileText, Library, FolderOpen, Brain, 
  BarChart3, FileBarChart, Home, ChevronLeft, ChevronRight
} from 'lucide-react'

function Sidebar({ isOpen, onToggle }) {
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
    <aside className={`bg-gray-800 text-white shadow-lg transition-all duration-300 ease-in-out overflow-hidden ${
      isOpen ? 'w-64' : 'w-16'
    }`}>
      <div className={`transition-all duration-300 ${isOpen ? 'p-4' : 'p-2'}`}>
        <div className={`flex items-center mb-8 transition-all duration-300 ${
          isOpen ? 'justify-between' : 'justify-center'
        }`}>
          <div className={`flex items-center space-x-2 transition-all duration-300 ${
            isOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 overflow-hidden'
          }`}>
            <Home className="w-6 h-6 flex-shrink-0" />
            <span className="text-xl font-bold whitespace-nowrap">HAZOP</span>
          </div>
          <button
            onClick={onToggle}
            className={`p-1 rounded hover:bg-gray-700 transition-all duration-300 flex-shrink-0 ${
              isOpen ? '' : 'ml-0'
            }`}
            title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {isOpen ? (
              <ChevronLeft className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </button>
        </div>
        <nav className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center rounded-lg transition-all duration-300 ease-in-out group ${
                  isOpen 
                    ? 'px-4 space-x-3' 
                    : 'px-0 justify-center'
                } py-3 ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
                title={!isOpen ? item.label : ''}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className={`font-medium transition-all duration-300 ease-in-out whitespace-nowrap ${
                  isOpen 
                    ? 'opacity-100 max-w-full ml-0' 
                    : 'opacity-0 max-w-0 overflow-hidden ml-0'
                }`}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}

export default Sidebar

