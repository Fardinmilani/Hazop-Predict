import React, { useState, useEffect } from 'react'
import { projectAPI, libraryAPI } from '../utils/api'
import DataTable from '../components/DataTable'

function ProjectPage() {
  const [rows, setRows] = useState([])
  const [columns, setColumns] = useState([])
  const [library, setLibrary] = useState({ headers: [] })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [showColumnModal, setShowColumnModal] = useState(false)

  useEffect(() => {
    loadLibrary()
    loadProject()
    
    // Listen for project events from FilePage
    const handleNew = async (e) => {
      const rows = e.detail.rows || []
      const cols = e.detail.columns || []
      setRows(rows)
      setColumns(cols)
      // Save the new project (only if not empty)
      if (rows.length > 0 || cols.length > 0) {
        await updateProject(rows, cols)
      }
    }
    const handleOpen = async (e) => {
      if (Array.isArray(e.detail)) {
        // If data is array of rows
        if (e.detail.length > 0) {
          const cols = Object.keys(e.detail[0])
          setColumns(cols)
          setRows(e.detail)
          // Save the loaded data
          await updateProject(e.detail, cols)
        } else {
          // Empty array
          setRows([])
          setColumns([])
        }
      } else {
        const rows = e.detail.rows || []
        const cols = e.detail.columns || []
        setRows(rows)
        setColumns(cols)
        // Save the loaded data (only if not empty)
        if (rows.length > 0 || cols.length > 0) {
          await updateProject(rows, cols)
        }
      }
    }
    
    window.addEventListener('project-new', handleNew)
    window.addEventListener('project-open', handleOpen)
    
    return () => {
      window.removeEventListener('project-new', handleNew)
      window.removeEventListener('project-open', handleOpen)
    }
  }, [])

  const loadLibrary = async () => {
    try {
      const response = await libraryAPI.get()
      if (response.data.success) {
        setLibrary(response.data.data)
        // Update columns from library
        const libraryColumns = response.data.data.headers.map(h => h.name)
        if (libraryColumns.length > 0 && columns.length === 0) {
          setColumns(libraryColumns)
        }
      }
    } catch (error) {
      console.error('Error loading library:', error)
    }
  }

  const loadProject = async () => {
    try {
      const response = await projectAPI.get()
      if (response.data.success) {
        const data = response.data.data
        setRows(data.rows || [])
        setColumns(data.columns || [])
      }
    } catch (error) {
      console.error('Error loading project:', error)
    }
  }

  const handleCellChange = (rowIndex, columnName, value) => {
    const newRows = [...rows]
    if (!newRows[rowIndex]) {
      newRows[rowIndex] = {}
    }
    newRows[rowIndex][columnName] = value
    setRows(newRows)
    updateProject(newRows, columns)
  }

  const handleAddRow = () => {
    const newRow = {}
    columns.forEach(col => {
      newRow[col] = ''
    })
    const newRows = [...rows, newRow]
    setRows(newRows)
    updateProject(newRows, columns)
  }

  const handleDeleteRow = (index) => {
    const newRows = rows.filter((_, i) => i !== index)
    setRows(newRows)
    updateProject(newRows, columns)
  }

  const updateProject = async (newRows, newColumns) => {
    try {
      await projectAPI.update(newRows, newColumns)
      // Emit event to notify FilePage
      window.dispatchEvent(new CustomEvent('project-updated'))
    } catch (error) {
      console.error('Error updating project:', error)
    }
  }

  const handleAddColumn = () => {
    if (library.headers.length === 0) {
      setMessage({ type: 'error', text: 'No headers found in Library. Please add headers to Library first.' })
      return
    }
    setShowColumnModal(true)
  }

  const handleSelectColumn = (columnName) => {
    if (!columnName) return
    
    if (columns.includes(columnName)) {
      setMessage({ type: 'error', text: 'Column already exists' })
      setShowColumnModal(false)
      return
    }
    
    const newColumns = [...columns, columnName]
    setColumns(newColumns)
    
    // Add empty value for this column in all rows
    const newRows = rows.map(row => ({
      ...row,
      [columnName]: ''
    }))
    setRows(newRows)
    updateProject(newRows, newColumns)
    setShowColumnModal(false)
    setMessage({ type: 'success', text: `Column "${columnName}" added successfully` })
    setTimeout(() => setMessage({ type: '', text: '' }), 3000)
  }

  const getAvailableColumns = () => {
    return library.headers
      .map(h => h.name)
      .filter(name => !columns.includes(name))
  }

  const availableColumns = getAvailableColumns()

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Project Workspace</h2>
          <div className="flex space-x-2">
            <button
              onClick={handleAddColumn}
              disabled={library.headers.length === 0}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Column from Library
            </button>
          </div>
        </div>

        {message.text && (
          <div className={`mb-4 p-3 rounded ${
            message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        {columns.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No columns defined. Add columns from Library first.</p>
            <button
              onClick={handleAddColumn}
              disabled={library.headers.length === 0}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Column
            </button>
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            onCellChange={handleCellChange}
            onAddRow={handleAddRow}
            onDeleteRow={handleDeleteRow}
            library={library}
          />
        )}
      </div>

      {/* Column Selection Modal */}
      {showColumnModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Select Column from Library</h3>
            
            {availableColumns.length === 0 ? (
              <div className="py-4">
                <p className="text-gray-500 mb-4">All available columns from Library have been added.</p>
                <button
                  onClick={() => setShowColumnModal(false)}
                  className="w-full px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="mb-4 max-h-64 overflow-y-auto">
                  {availableColumns.map((colName) => {
                    const header = library.headers.find(h => h.name === colName)
                    return (
                      <button
                        key={colName}
                        onClick={() => handleSelectColumn(colName)}
                        className="w-full text-left px-4 py-3 mb-2 border border-gray-300 rounded hover:bg-blue-50 hover:border-blue-500 transition-colors"
                      >
                        <div className="font-medium text-gray-800">{colName}</div>
                        {header && header.options.length > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            {header.options.length} option(s) available
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={() => setShowColumnModal(false)}
                  className="w-full px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ProjectPage

