import React, { useState, useEffect } from 'react'
import { projectAPI, libraryAPI, rankingAPI } from '../utils/api'
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
      const cols = (e.detail.columns || []).filter(col => col !== 'rowNo')
      let loadedRows = rows.map((row, index) => ({
        ...row,
        rowNo: row.rowNo || index + 1
      }))
      setRows(loadedRows)
      setColumns(cols)
      // Save the new project (only if not empty)
      if (loadedRows.length > 0 || cols.length > 0) {
        await updateProject(loadedRows, cols)
      }
    }
    const handleOpen = async (e) => {
      if (Array.isArray(e.detail)) {
        // If data is array of rows
        if (e.detail.length > 0) {
          const cols = Object.keys(e.detail[0]).filter(col => col !== 'rowNo')
          let loadedRows = e.detail.map((row, index) => ({
            ...row,
            rowNo: row.rowNo || index + 1
          }))
          setColumns(cols)
          setRows(loadedRows)
          // Save the loaded data
          await updateProject(loadedRows, cols)
        } else {
          // Empty array
          setRows([])
          setColumns([])
        }
      } else {
        const rows = e.detail.rows || []
        const cols = (e.detail.columns || []).filter(col => col !== 'rowNo')
        let loadedRows = rows.map((row, index) => ({
          ...row,
          rowNo: row.rowNo || index + 1
        }))
        setRows(loadedRows)
        setColumns(cols)
        // Save the loaded data (only if not empty)
        if (loadedRows.length > 0 || cols.length > 0) {
          await updateProject(loadedRows, cols)
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
        let loadedRows = data.rows || []
        let loadedColumns = (data.columns || []).filter(col => col !== 'rowNo')
        
        // Ensure all rows have rowNo - assign if missing
        let maxRowNo = 0
        loadedRows = loadedRows.map((row, index) => {
          if (!row.rowNo) {
            // Find max rowNo from existing rows
            const existingMax = Math.max(...loadedRows.map(r => r.rowNo || 0), 0)
            maxRowNo = Math.max(maxRowNo, existingMax, index)
            return { ...row, rowNo: index + 1 }
          }
          maxRowNo = Math.max(maxRowNo, row.rowNo)
          return row
        })
        
        setRows(loadedRows)
        setColumns(loadedColumns)
      }
    } catch (error) {
      console.error('Error loading project:', error)
    }
  }

  const handleCellChange = async (rowIndex, columnName, value) => {
    const newRows = [...rows]
    if (!newRows[rowIndex]) {
      newRows[rowIndex] = {}
    }
    newRows[rowIndex][columnName] = value
    setRows(newRows)

    const rowNo = newRows[rowIndex]?.rowNo || rowIndex + 1

    try {
      await projectAPI.updateCell(rowNo, columnName, value, columns)
      window.dispatchEvent(new CustomEvent('project-updated'))
    } catch (error) {
      console.error('Error updating project cell:', error)
      setMessage({ type: 'error', text: 'Failed to update cell' })
    }
  }

  const getNextRowNo = () => {
    if (rows.length === 0) return 1
    const maxRowNo = Math.max(...rows.map(row => row.rowNo || 0))
    return maxRowNo + 1
  }

  const handleAddRow = () => {
    const newRow = {
      rowNo: getNextRowNo()
    }
    columns.forEach(col => {
      newRow[col] = ''
    })
    const newRows = [...rows, newRow]
    setRows(newRows)
    updateProject(newRows, columns)
  }

  const syncRankingWithProjectRows = async (rows, deletedRowNo = null) => {
    try {
      const rankResponse = await rankingAPI.get()
      if (!rankResponse.data?.success) {
        return
      }

      const rankingData = rankResponse.data.data || {}
      const existingAlternatives = rankingData.alternativesScores || {}
      const existingColumns = rankingData.columns || [] // Preserve existing columns
      const existingWeights = rankingData.criteriaWeights || {} // Preserve existing weights
      
      let existingKeys = Object.keys(existingAlternatives).sort((a, b) => {
        const rowNoA = parseInt((a.match(/\d+/) || [0])[0], 10)
        const rowNoB = parseInt((b.match(/\d+/) || [0])[0], 10)
        return rowNoA - rowNoB
      })
      // If a specific row was deleted, remove that key from the old list to shift up correctly
      if (deletedRowNo) {
        existingKeys = existingKeys.filter((key) => {
          const num = parseInt((key.match(/\d+/) || [0])[0], 10)
          return num !== Number(deletedRowNo)
        })
      }

      const reorderedAlternatives = {}
      rows.forEach((row, idx) => {
        const rowNo = row?.rowNo || idx + 1
        const newKey = `Alternative ${rowNo}`
        const sourceKey = existingKeys[idx]
        if (sourceKey && existingAlternatives[sourceKey]) {
          reorderedAlternatives[newKey] = existingAlternatives[sourceKey]
        } else {
          reorderedAlternatives[newKey] = {}
        }
      })

      // Update ranking while preserving columns and weights
      await rankingAPI.update(
        existingWeights, // Preserve existing weights
        reorderedAlternatives,
        null, // Invalidate ranking result since data changed
        existingColumns // Preserve existing columns
      )

      // Inform other listeners that ranking data changed
      window.dispatchEvent(new CustomEvent('ranking-updated'))
    } catch (error) {
      console.error('Failed to sync ranking after project update:', error)
    }
  }

  const handleDeleteRow = async (index) => {
    const rowToDelete = rows[index]
    const deletedRowNo = rowToDelete?.rowNo
    
    // Remove the row
    let newRows = rows.filter((_, i) => i !== index)
    
    // Renumber all remaining rows to maintain continuity (1, 2, 3, ...)
    newRows = newRows.map((row, idx) => ({
      ...row,
      rowNo: idx + 1
    }))
    
    setRows(newRows)
    await updateProject(newRows, columns)
    await syncRankingWithProjectRows(newRows, deletedRowNo)
    
    // Notify RankingPage to sync with new project rows
    // Send the new rows so RankingPage can sync alternatives based on them
    window.dispatchEvent(new CustomEvent('project-row-deleted', { 
      detail: { 
        deletedRowNo,
        newRows: newRows // Send the new rows with renumbered rowNo
      } 
    }))
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

