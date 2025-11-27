import React from 'react'
import { Menu } from 'lucide-react'

function Navbar({ onMenuClick }) {
  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onMenuClick}
            className="p-2 rounded hover:bg-gray-100 transition-colors"
            title="Toggle sidebar"
          >
            <Menu className="w-6 h-6 text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">HAZOP Analysis Tool</h1>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-600">Hazard and Operability Analysis</span>
        </div>
      </div>
    </nav>
  )
}

export default Navbar

