import React from 'react'

function Navbar() {
  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">HAZOP Analysis Tool</h1>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-600">Hazard and Operability Analysis</span>
        </div>
      </div>
    </nav>
  )
}

export default Navbar

