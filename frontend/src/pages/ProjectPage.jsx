import React, { useState, useEffect, useMemo } from 'react'
import { projectAPI, libraryAPI, rankingAPI } from '../utils/api'
import DataTable from '../components/DataTable'
import { AlertCircle, X, Plus } from 'lucide-react'
import { getLikelihoodFromSW } from '../utils/riskMatrix'

function ProjectPage() {
  const [rows, setRows] = useState([])
  const [columns, setColumns] = useState([])
  const [library, setLibrary] = useState({ headers: [] })
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [showColumnModal, setShowColumnModal] = useState(false)
  const [showDeleteColumnModal, setShowDeleteColumnModal] = useState(false)
  const [columnToDelete, setColumnToDelete] = useState(null)
  const [columnHasData, setColumnHasData] = useState(false)
  const [showAddToLibraryModal, setShowAddToLibraryModal] = useState(false)
  const [columnToAddToLibrary, setColumnToAddToLibrary] = useState(null)
  const [addToLibraryMode, setAddToLibraryMode] = useState(null) // 'replace' or 'merge'

  // Risk assessment columns that can be added as a pack
  const RISK_ASSESSMENT_PACK = ['S', 'W', 'likelihood']

  // Reorder columns to ensure risk assessment columns are always at the end
  const reorderColumns = (columns) => {
    const riskColumns = columns.filter(col => RISK_ASSESSMENT_PACK.includes(col))
    const otherColumns = columns.filter(col => !RISK_ASSESSMENT_PACK.includes(col))
    return [...otherColumns, ...riskColumns]
  }

  // Normalize project data: ensure all rows have keys for all columns and compute likelihood if S and W exist
  const normalizeProject = (rows, columns) => {
    const normalizedColumns = reorderColumns([...columns])

    // Ensure all rows have keys for all columns
    const normalizedRows = rows.map(row => {
      const normalizedRow = { ...row }
      normalizedColumns.forEach(col => {
        if (!(col in normalizedRow)) {
          normalizedRow[col] = ''
        }
      })
      // Compute likelihood from S and W if both columns exist
      if (normalizedColumns.includes('S') && normalizedColumns.includes('W')) {
        normalizedRow.likelihood = getLikelihoodFromSW(normalizedRow.S, normalizedRow.W)
      }
      return normalizedRow
    })

    return { rows: normalizedRows, columns: normalizedColumns }
  }

  useEffect(() => {
    const loadData = async () => {
      setInitialLoading(true)
      try {
        await Promise.all([loadLibrary(), loadProject()])
      } finally {
        setInitialLoading(false)
      }
    }
    loadData()
    
    // Listen for project events from FilePage
    const handleNew = async (e) => {
      const rows = e.detail.rows || []
      let cols = (e.detail.columns || []).filter(col => col !== 'rowNo')

      // When creating a brand new project from the File page, the backend
      // returns empty rows/columns. In that case we want to initialise the
      // project with the current Library headers so the user immediately
      // gets a usable table structure instead of an empty grid.
      if (cols.length === 0 && library.headers && library.headers.length > 0) {
        cols = library.headers.map((h) => h.name)
      }

      let loadedRows = rows.map((row, index) => ({
        ...row,
        rowNo: row.rowNo || index + 1
      }))
      
      // Normalize project data
      const normalized = normalizeProject(loadedRows, cols)
      setRows(normalized.rows)
      setColumns(normalized.columns)
      
      // Save the new project (only if not empty)
      if (normalized.rows.length > 0 || normalized.columns.length > 0) {
        await updateProject(normalized.rows, normalized.columns)
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
          
          // Normalize project data
          const normalized = normalizeProject(loadedRows, cols)
          setColumns(normalized.columns)
          setRows(normalized.rows)
          // Save the loaded data
          await updateProject(normalized.rows, normalized.columns)
        } else {
          // Empty array - still need required columns
          const normalized = normalizeProject([], [])
          setRows(normalized.rows)
          setColumns(normalized.columns)
        }
      } else {
        const rows = e.detail.rows || []
        const cols = (e.detail.columns || []).filter(col => col !== 'rowNo')
        let loadedRows = rows.map((row, index) => ({
          ...row,
          rowNo: row.rowNo || index + 1
        }))
        
        // Normalize project data
        const normalized = normalizeProject(loadedRows, cols)
        setRows(normalized.rows)
        setColumns(normalized.columns)
        // Save the loaded data (only if not empty)
        if (normalized.rows.length > 0 || normalized.columns.length > 0) {
          await updateProject(normalized.rows, normalized.columns)
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
      setMessage({ type: 'error', text: 'Failed to load library' })
    }
  }

  // Auto-detect column types and extract options for columns not in library
  const temporaryColumnMetadata = useMemo(() => {
    const metadata = {}
    const libraryColumnNames = library.headers.map(h => h.name)
    
    columns.forEach(col => {
      // Only process columns that are NOT in library
      if (!libraryColumnNames.includes(col)) {
        const values = rows
          .map(row => row[col])
          .filter(val => val !== undefined && val !== null && val !== '')
          .map(val => String(val).trim())
        
        if (values.length === 0) {
          // No data, default to text
          metadata[col] = { type: 'text', options: [] }
          return
        }
        
        // Check if all values are numeric
        const allNumeric = values.every(val => {
          const num = Number(val)
          return !isNaN(num) && isFinite(num) && val !== ''
        })
        
        if (allNumeric) {
          metadata[col] = { type: 'number', options: [] }
        } else {
          // Text type - extract unique values as options
          const uniqueValues = [...new Set(values)].sort()
          metadata[col] = { type: 'text', options: uniqueValues }
        }
      }
    })
    
    return metadata
  }, [columns, rows, library])

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
        
        // Normalize project data (always normalize, even if empty)
        const normalized = normalizeProject(loadedRows, loadedColumns)
        setRows(normalized.rows)
        setColumns(normalized.columns)
      } else {
        // If no project data, still ensure required columns exist
        const normalized = normalizeProject([], [])
        setRows(normalized.rows)
        setColumns(normalized.columns)
      }
    } catch (error) {
      console.error('Error loading project:', error)
      setMessage({ type: 'error', text: 'Failed to load project' })
      // Even on error, ensure required columns exist
      const normalized = normalizeProject([], [])
      setRows(normalized.rows)
      setColumns(normalized.columns)
    }
  }

  const handleCellChange = async (rowIndex, columnName, value) => {
    const newRows = [...rows]
    if (!newRows[rowIndex]) {
      newRows[rowIndex] = {}
    }
    newRows[rowIndex][columnName] = value
    // Ensure rowNo exists
    if (!newRows[rowIndex].rowNo) {
      newRows[rowIndex].rowNo = rowIndex + 1
    }
    
    // If S or W changed and both columns exist, recompute likelihood for this row
    if ((columnName === 'S' || columnName === 'W') && columns.includes('S') && columns.includes('W')) {
      newRows[rowIndex].likelihood = getLikelihoodFromSW(
        newRows[rowIndex].S || '',
        newRows[rowIndex].W || ''
      )
    }
    
    setRows(newRows)

    const rowNo = newRows[rowIndex]?.rowNo || rowIndex + 1

    try {
      // Update the full project to ensure all data is saved
      await updateProject(newRows, columns)
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
    // Compute likelihood only if both S and W columns exist
    if (columns.includes('S') && columns.includes('W')) {
      newRow.likelihood = getLikelihoodFromSW(newRow.S || '', newRow.W || '')
    }
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
    
    const newColumns = reorderColumns([...columns, columnName])
    setColumns(newColumns)
    
    // Add empty value for this column in all rows
    const newRows = rows.map(row => ({
      ...row,
      [columnName]: ''
    }))
    
    // Recompute likelihood for all rows after adding column (only if both S and W exist)
    const normalizedRows = newRows.map(row => ({
      ...row,
      ...(newColumns.includes('S') && newColumns.includes('W') ? {
        likelihood: getLikelihoodFromSW(row.S || '', row.W || '')
      } : {})
    }))
    
    setRows(normalizedRows)
    updateProject(normalizedRows, newColumns)
    setShowColumnModal(false)
    setMessage({ type: 'success', text: `Column "${columnName}" added successfully` })
    setTimeout(() => setMessage({ type: '', text: '' }), 3000)
  }

  const getAvailableColumns = () => {
    return library.headers
      .map(h => h.name)
      .filter(name => !columns.includes(name))
  }

  const handleSelectRiskAssessmentPack = () => {
    const packColumns = RISK_ASSESSMENT_PACK.filter(col => !columns.includes(col))

    if (packColumns.length === 0) {
      setMessage({ type: 'error', text: 'All risk assessment columns are already added' })
      setShowColumnModal(false)
      return
    }

    // Add pack columns and reorder to ensure they're at the end
    const newColumns = reorderColumns([...columns, ...packColumns])

    // Add empty value for these columns in all rows
    const newRows = rows.map(row => {
      const newRow = { ...row }
      packColumns.forEach(col => {
        newRow[col] = ''
      })
      // Compute likelihood for all rows since we now have S and W
      if (newColumns.includes('S') && newColumns.includes('W')) {
        newRow.likelihood = getLikelihoodFromSW(newRow.S || '', newRow.W || '')
      }
      return newRow
    })

    setColumns(newColumns)
    setRows(newRows)
    updateProject(newRows, newColumns)
    setShowColumnModal(false)

    const addedCount = packColumns.length
    const columnText = addedCount === 1 ? 'column' : 'columns'
    setMessage({ type: 'success', text: `Risk Assessment Pack added successfully (${addedCount} ${columnText})` })
    setTimeout(() => setMessage({ type: '', text: '' }), 3000)
  }

  const checkColumnHasData = (columnName) => {
    // Check if any row has data in this column
    return rows.some(row => {
      const value = row[columnName]
      return value !== undefined && value !== null && value !== ''
    })
  }

  const handleDeleteColumnClick = (columnName) => {
    const hasData = checkColumnHasData(columnName)
    setColumnToDelete(columnName)
    setColumnHasData(hasData)
    setShowDeleteColumnModal(true)
  }

  const handleDeleteColumnConfirm = async () => {
    if (!columnToDelete) return

    const newColumns = reorderColumns(columns.filter(col => col !== columnToDelete))
    setColumns(newColumns)
    
    // Remove column data from all rows
    const newRows = rows.map(row => {
      const newRow = { ...row }
      delete newRow[columnToDelete]
      return newRow
    })
    setRows(newRows)
    
    // Update project
    await updateProject(newRows, newColumns)
    
    setMessage({ type: 'success', text: `Column "${columnToDelete}" deleted successfully` })
    setTimeout(() => setMessage({ type: '', text: '' }), 3000)
    
    // Close modal
    setShowDeleteColumnModal(false)
    setColumnToDelete(null)
    setColumnHasData(false)
  }

  const handleDeleteColumnCancel = () => {
    setShowDeleteColumnModal(false)
    setColumnToDelete(null)
    setColumnHasData(false)
  }

  const handleAddToLibraryClick = (columnName) => {
    setColumnToAddToLibrary(columnName)
    // Check if column already exists in library
    const existingHeader = library.headers.find(h => h.name === columnName)
    if (existingHeader) {
      // Show modal to choose replace or merge
      setShowAddToLibraryModal(true)
    } else {
      // Directly add to library
      handleAddToLibrary(columnName, 'new')
    }
  }

  const handleAddToLibrary = async (columnName, mode = 'new') => {
    if (!columnName) return
    
    const metadata = temporaryColumnMetadata[columnName]
    if (!metadata) {
      setMessage({ type: 'error', text: 'Column metadata not found' })
      return
    }
    
    setLoading(true)
    try {
      const existingHeader = library.headers.find(h => h.name === columnName)
      
      if (existingHeader && mode === 'replace') {
        // Replace existing header
        const response = await libraryAPI.updateHeader(
          columnName,
          columnName,
          metadata.options,
          metadata.type
        )
        if (response.data.success) {
          await loadLibrary()
          setMessage({ type: 'success', text: `Column "${columnName}" updated in Library` })
          window.dispatchEvent(new CustomEvent('library-updated'))
        }
      } else if (existingHeader && mode === 'merge') {
        // Merge options with existing header
        const existingOptions = existingHeader.options || []
        const newOptions = metadata.options || []
        const mergedOptions = [...new Set([...existingOptions, ...newOptions])].sort()
        const finalType = existingHeader.type || metadata.type
        
        const response = await libraryAPI.updateHeader(
          columnName,
          columnName,
          mergedOptions,
          finalType
        )
        if (response.data.success) {
          await loadLibrary()
          setMessage({ type: 'success', text: `Column "${columnName}" merged with Library` })
          window.dispatchEvent(new CustomEvent('library-updated'))
        }
      } else {
        // Add new header
        const headerType = metadata.options.length > 0 ? 'select' : metadata.type
        const response = await libraryAPI.addHeader(columnName, metadata.options, headerType)
        if (response.data.success) {
          await loadLibrary()
          setMessage({ type: 'success', text: `Column "${columnName}" added to Library` })
          window.dispatchEvent(new CustomEvent('library-updated'))
          // Refresh the page data to reflect library changes
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('library-updated'))
          }, 100)
        }
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to add to Library' })
    } finally {
      setLoading(false)
      setShowAddToLibraryModal(false)
      setColumnToAddToLibrary(null)
      setAddToLibraryMode(null)
    }
  }

  const availableColumns = getAvailableColumns()

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-600">Loading project data...</p>
        </div>
      </div>
    )
  }

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
            onDeleteColumn={handleDeleteColumnClick}
            library={library}
            temporaryColumnMetadata={temporaryColumnMetadata}
            onAddToLibrary={handleAddToLibraryClick}
          />
        )}
      </div>

      {/* Column Selection Modal */}
      {showColumnModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Select Column from Library</h3>
            
            {availableColumns.length === 0 && RISK_ASSESSMENT_PACK.every(col => columns.includes(col)) ? (
              <div className="py-4">
                <p className="text-gray-500 mb-4">All available columns from Library have been added.</p>
              </div>
            ) : (
              <>
                {/* Risk Assessment Pack Section */}
                {RISK_ASSESSMENT_PACK.some(col => !columns.includes(col)) && (
                  <div className="mb-6 p-4 border-2 border-purple-200 rounded-lg bg-purple-50">
                    <h4 className="text-lg font-semibold text-purple-800 mb-2">Risk Assessment Pack</h4>
                    <p className="text-sm text-purple-700 mb-3">
                      Add Severity (S), Probability (W), and Likelihood columns together for comprehensive risk assessment.
                    </p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {RISK_ASSESSMENT_PACK.map(col => (
                        <span
                          key={col}
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            columns.includes(col)
                              ? 'bg-green-100 text-green-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {col}
                          {columns.includes(col) && ' ✓'}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={handleSelectRiskAssessmentPack}
                      className="w-full px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
                    >
                      Add Risk Assessment Pack
                    </button>
                  </div>
                )}

                {/* Individual Columns Section */}
                {availableColumns.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-lg font-semibold text-gray-800 mb-2">Individual Columns</h4>
                    <div className="max-h-64 overflow-y-auto">
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
                  </div>
                )}
              </>
            )}

            <button
              onClick={() => setShowColumnModal(false)}
              className="w-full px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Delete Column Modal */}
      {showDeleteColumnModal && columnToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Delete Column</h3>
              <button
                onClick={handleDeleteColumnCancel}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {columnHasData ? (
              <>
                <div className="flex items-start space-x-3 mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-yellow-800 font-medium mb-2">
                      Warning: This column contains data!
                    </p>
                    <p className="text-sm text-yellow-700">
                      Deleting column <strong>"{columnToDelete}"</strong> will permanently remove all data in this column from all rows.
                    </p>
                    <p className="text-sm text-yellow-700 mt-2">
                      This action cannot be undone. Are you sure you want to continue?
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-gray-600 mb-4">
                Are you sure you want to delete column <strong>"{columnToDelete}"</strong>?
              </p>
            )}
            
            <div className="flex space-x-2">
              <button
                onClick={handleDeleteColumnConfirm}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                {columnHasData ? 'Delete Anyway' : 'Delete'}
              </button>
              <button
                onClick={handleDeleteColumnCancel}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add to Library Modal (for existing headers) */}
      {showAddToLibraryModal && columnToAddToLibrary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Column Already Exists</h3>
              <button
                onClick={() => {
                  setShowAddToLibraryModal(false)
                  setColumnToAddToLibrary(null)
                  setAddToLibraryMode(null)
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-gray-600 mb-4">
              Column <strong>"{columnToAddToLibrary}"</strong> already exists in Library.
            </p>
            
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800 mb-2">
                <strong>Current options in Library:</strong>
              </p>
              <div className="flex flex-wrap gap-2">
                {library.headers.find(h => h.name === columnToAddToLibrary)?.options?.map((opt, idx) => (
                  <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                    {opt}
                  </span>
                )) || <span className="text-xs text-gray-500">No options</span>}
              </div>
            </div>
            
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
              <p className="text-sm text-green-800 mb-2">
                <strong>New options from project data:</strong>
              </p>
              <div className="flex flex-wrap gap-2">
                {temporaryColumnMetadata[columnToAddToLibrary]?.options?.map((opt, idx) => (
                  <span key={idx} className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                    {opt}
                  </span>
                )) || <span className="text-xs text-gray-500">No options</span>}
              </div>
            </div>
            
            <div className="space-y-2 mb-4">
              <button
                onClick={() => handleAddToLibrary(columnToAddToLibrary, 'replace')}
                className="w-full px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 text-left"
              >
                <div className="font-medium">Replace</div>
                <div className="text-xs opacity-90">Replace existing options with new ones</div>
              </button>
              <button
                onClick={() => handleAddToLibrary(columnToAddToLibrary, 'merge')}
                className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-left"
              >
                <div className="font-medium">Merge</div>
                <div className="text-xs opacity-90">Add new options to existing ones</div>
              </button>
            </div>
            
            <button
              onClick={() => {
                setShowAddToLibraryModal(false)
                setColumnToAddToLibrary(null)
                setAddToLibraryMode(null)
              }}
              className="w-full px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProjectPage

