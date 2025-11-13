import React, { useState, useEffect, useRef } from 'react'
import { rankingAPI, projectAPI, libraryAPI } from '../utils/api'
import { BarChart3, AlertCircle, X, RotateCcw } from 'lucide-react'

function RankingPage() {
  const [projectData, setProjectData] = useState([])
  const [columns, setColumns] = useState([])
  const [rankingColumns, setRankingColumns] = useState([])
  const [criteriaWeights, setCriteriaWeights] = useState({})
  const [alternativesScores, setAlternativesScores] = useState({})
  const [rankingResult, setRankingResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [showAddColumnModal, setShowAddColumnModal] = useState(false)
  const [newColumnName, setNewColumnName] = useState('')
  
  // Ref to track if we're syncing (to avoid auto-save during sync)
  const isSyncingRef = useRef(false)

  const formatAlternativeKey = (rowNo) => `Alternative ${rowNo}`
  const legacyAlternativeKeys = (rowNo) => [
    `Row ${rowNo}`,
    formatAlternativeKey(rowNo)
  ]
  const extractRowNoFromKey = (key) => {
    if (!key) return null
    const digits = key.match(/\d+/)
    if (!digits) return null
    return parseInt(digits[0], 10)
  }

  useEffect(() => {
    // Load data in sequence to avoid race conditions
    const loadAllData = async () => {
      const rows = await loadProjectData()
      await loadLibrary()
      // Then load ranking data which will merge with the structure
      // Pass rows to loadRankingData so it can use them immediately
      // This will also clear data if file was deleted
      await loadRankingData(rows)
    }
    
    loadAllData()
    
    // Also reload data when page becomes visible (in case file was deleted while on another page)
    const handleFocus = async () => {
      const rows = await loadProjectData()
      await loadRankingData(rows)
    }
    
    window.addEventListener('focus', handleFocus)
    
    // Listen for ranking events from FilePage
    const handleOpen = async (e) => {
      const data = e.detail
      if (data.criteriaWeights) {
        setCriteriaWeights(data.criteriaWeights)
      }
      if (data.alternativesScores) {
        setAlternativesScores(data.alternativesScores)
      }
      if (data.rankingResult) {
        setRankingResult(data.rankingResult)
      }
      // Save the loaded data
      await updateRanking(data.criteriaWeights || {}, data.alternativesScores || {}, data.rankingResult || null)
    }
    
    // Listen for ranking deletion/clear event
    const handleRankingDeleted = async () => {
      // Clear all ranking data immediately when file is deleted
      isSyncingRef.current = true
      setCriteriaWeights({})
      setRankingColumns([])
      setRankingResult(null)
      setAlternativesScores({})
    }
    
    // Listen for ranking updates (refresh data)
    const handleRankingUpdated = async () => {
      // Reload ranking data when updated
      const rows = await loadProjectData()
      await loadRankingData(rows)
    }
    
    // Listen for visibility change to reload data when user returns to page
    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        // Reload project and ranking data when page becomes visible
        const rows = await loadProjectData()
        await loadRankingData(rows)
      }
    }
    
    window.addEventListener('ranking-open', handleOpen)
    window.addEventListener('ranking-deleted', handleRankingDeleted)
    window.addEventListener('ranking-updated', handleRankingUpdated)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      window.removeEventListener('ranking-open', handleOpen)
      window.removeEventListener('ranking-deleted', handleRankingDeleted)
      window.removeEventListener('ranking-updated', handleRankingUpdated)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  // Auto-save when alternativesScores changes (but only if it's a user change, not a sync)
  // NOTE: This is disabled because we now use updateCell for individual cell changes
  // This useEffect is kept for potential future use but currently disabled
  // useEffect(() => {
  //   if (isSyncingRef.current) {
  //     isSyncingRef.current = false
  //     return // Don't save during sync
  //   }
  //   
  //   if (Object.keys(alternativesScores).length > 0) {
  //     // Only save if we have alternatives that match project rows
  //     const numRows = projectData.length
  //     const numAlternatives = Object.keys(alternativesScores).length
  //     if (numAlternatives === numRows && numRows > 0) {
  //       updateRanking(criteriaWeights, alternativesScores, rankingResult)
  //     }
  //   }
  // }, [alternativesScores])

  const loadProjectData = async () => {
    try {
      const response = await projectAPI.get()
      if (response.data.success) {
        const rows = response.data.data.rows || []
        const cols = response.data.data.columns || []
        setProjectData(rows)
        setColumns(cols)
        // Return rows so we can use them immediately
        return rows
      }
      return []
    } catch (error) {
      console.error('Error loading project:', error)
      return []
    }
  }

  const loadLibrary = async () => {
    // No longer needed - columns are managed independently
    // Keeping for potential future use
  }

  const loadRankingData = async (currentProjectRows = null) => {
    try {
      const response = await rankingAPI.get()
      if (response.data && response.data.success) {
        const data = response.data.data || {}
        
        // Check if file was deleted (all data is empty)
        const hasCriteria = data.criteriaWeights && Object.keys(data.criteriaWeights).length > 0
        const hasAlternatives = data.alternativesScores && Object.keys(data.alternativesScores).length > 0
        const hasResult = data.rankingResult && data.rankingResult !== null
        
        if (!hasCriteria && !hasAlternatives && !hasResult) {
          // File was deleted or is empty - clear all data
          isSyncingRef.current = true
          setCriteriaWeights({})
          setRankingColumns([])
          setRankingResult(null)
          // Sync alternatives with project structure if project has rows
          const rows = currentProjectRows || projectData
          if (rows && rows.length > 0) {
            setAlternativesScores(() => {
              const newScores = {}
              rows.forEach((row, index) => {
                const rowNo = row?.rowNo || index + 1
                const altKey = formatAlternativeKey(rowNo)
                newScores[altKey] = {}
              })
              return newScores
            })
          } else {
            setAlternativesScores({})
          }
          return
        }
        
        // Load ranking columns
        if (data.columns && Array.isArray(data.columns) && data.columns.length > 0) {
          setRankingColumns(data.columns)
        } else {
          // If no columns saved, start with empty array
          setRankingColumns([])
        }
        
        if (hasCriteria) {
          setCriteriaWeights(data.criteriaWeights)
        } else {
          setCriteriaWeights({})
        }
        
        if (hasAlternatives) {
          // When we already have alternatives in backend, trust them as source of truth
          // and avoid remapping/clearing scores on the frontend.
          isSyncingRef.current = true
          setAlternativesScores(data.alternativesScores || {})
        } else {
          // If no saved alternatives scores, sync with project structure
          const rows = currentProjectRows || projectData
          if (rows && rows.length > 0) {
            isSyncingRef.current = true
            setAlternativesScores(prevScores => {
              const newScores = {}
              rows.forEach((row, index) => {
                const rowNo = row?.rowNo || index + 1
                const altKey = formatAlternativeKey(rowNo)
                const candidateKeys = [
                  altKey,
                  ...legacyAlternativeKeys(rowNo),
                  formatAlternativeKey(index + 1),
                  ...legacyAlternativeKeys(index + 1)
                ]
                let existing = {}
                for (const key of candidateKeys) {
                  if (prevScores && prevScores[key]) {
                    existing = prevScores[key]
                    break
                  }
                }
                newScores[altKey] = existing
              })
              return newScores
            })
          } else {
            setAlternativesScores({})
          }
        }
        
        if (hasResult) {
          setRankingResult(data.rankingResult)
        } else {
          setRankingResult(null)
        }
      } else {
        // If response is not successful, clear data and sync with project structure
        setCriteriaWeights({})
        setRankingResult(null)
        const rows = currentProjectRows || projectData
        if (rows && rows.length > 0) {
          isSyncingRef.current = true
          setAlternativesScores(prevScores => {
            const newScores = {}
            rows.forEach((row, index) => {
              const rowNo = row?.rowNo || index + 1
              const altKey = formatAlternativeKey(rowNo)
              const candidateKeys = [
                altKey,
                ...legacyAlternativeKeys(rowNo),
                formatAlternativeKey(index + 1),
                ...legacyAlternativeKeys(index + 1)
              ]
              let existing = {}
              for (const key of candidateKeys) {
                if (prevScores && prevScores[key]) {
                  existing = prevScores[key]
                  break
                }
              }
              newScores[altKey] = existing
            })
            return newScores
          })
        } else {
          setAlternativesScores({})
        }
      }
    } catch (error) {
      console.error('Error loading ranking data:', error)
      // On error, clear data and sync with project structure
      setCriteriaWeights({})
      setRankingResult(null)
      const rows = currentProjectRows || projectData
      if (rows && rows.length > 0) {
        isSyncingRef.current = true
        setAlternativesScores(prevScores => {
          const newScores = {}
          for (let i = 0; i < rows.length; i++) {
            const altKey = `Alternative ${i + 1}`
            newScores[altKey] = prevScores[altKey] || {}
          }
          return newScores
        })
      } else {
        setAlternativesScores({})
      }
    }
  }

  const updateRanking = async (newCriteriaWeights, newAlternativesScores, newRankingResult, newColumns = null) => {
    try {
      const columnsToSave = newColumns !== null ? newColumns : rankingColumns
      await rankingAPI.update(newCriteriaWeights, newAlternativesScores, newRankingResult, columnsToSave)
      // Emit event to notify FilePage
      window.dispatchEvent(new CustomEvent('ranking-updated'))
    } catch (error) {
      console.error('Error updating ranking:', error)
    }
  }

  const handleWeightChange = (column, weight) => {
    const weightValue = parseFloat(weight) || 0
    const newWeights = {
      ...criteriaWeights,
      [column]: weightValue
    }
    setCriteriaWeights(newWeights)
    // Auto-save only the changed cell
    rankingAPI.updateCell('weight', '', column, weightValue).catch(error => {
      console.error('Error updating weight:', error)
    })
  }

  const handleScoreChange = (alternative, column, score) => {
    const scoreValue = score === '' ? '' : (parseFloat(score) || 0)
    const newScores = {
      ...alternativesScores,
      [alternative]: {
        ...(alternativesScores[alternative] || {}),
        [column]: scoreValue
      }
    }
    setAlternativesScores(newScores)
    // Auto-save only the changed cell
    rankingAPI.updateCell('score', alternative, column, scoreValue).catch(error => {
      console.error('Error updating score:', error)
    })
  }

  const handleAddColumn = () => {
    if (!newColumnName.trim()) {
      setMessage({ type: 'error', text: 'Please enter a column name' })
      return
    }
    
    if (rankingColumns.includes(newColumnName.trim())) {
      setMessage({ type: 'error', text: 'Column already exists' })
      return
    }
    
    const newColumns = [...rankingColumns, newColumnName.trim()]
    setRankingColumns(newColumns)
    setNewColumnName('')
    setShowAddColumnModal(false)
    
    // Clear weights and scores for this new column
    const newWeights = { ...criteriaWeights }
    newWeights[newColumnName.trim()] = 0
    
    const newScores = { ...alternativesScores }
    Object.keys(newScores).forEach(alt => {
      newScores[alt] = { ...newScores[alt], [newColumnName.trim()]: '' }
    })
    
    setCriteriaWeights(newWeights)
    setAlternativesScores(newScores)
    
    // Save to backend
    updateRanking(newWeights, newScores, rankingResult, newColumns)
    setMessage({ type: 'success', text: `Column "${newColumnName.trim()}" added successfully` })
    setTimeout(() => setMessage({ type: '', text: '' }), 3000)
  }

  const handleDeleteColumn = (columnToDelete) => {
    if (!window.confirm(`Are you sure you want to delete column "${columnToDelete}"? All data in this column will be lost.`)) {
      return
    }
    
    const newColumns = rankingColumns.filter(col => col !== columnToDelete)
    setRankingColumns(newColumns)
    
    // Remove from weights
    const newWeights = { ...criteriaWeights }
    delete newWeights[columnToDelete]
    setCriteriaWeights(newWeights)
    
    // Remove from scores
    const newScores = { ...alternativesScores }
    Object.keys(newScores).forEach(alt => {
      const altScores = { ...newScores[alt] }
      delete altScores[columnToDelete]
      newScores[alt] = altScores
    })
    setAlternativesScores(newScores)
    
    // Save to backend
    updateRanking(newWeights, newScores, rankingResult, newColumns)
    setMessage({ type: 'success', text: `Column "${columnToDelete}" deleted successfully` })
    setTimeout(() => setMessage({ type: '', text: '' }), 3000)
  }

  const handleAHP = async () => {
    if (Object.keys(criteriaWeights).length === 0) {
      setMessage({ type: 'error', text: 'Please set criteria weights' })
      return
    }

    if (Object.keys(alternativesScores).length === 0) {
      setMessage({ type: 'error', text: 'Please set alternatives scores' })
      return
    }

    setLoading(true)
    try {
      const response = await rankingAPI.ahp(criteriaWeights, alternativesScores)
      if (response.data.success) {
        const result = response.data.data
        setRankingResult(result)
        setMessage({ type: 'success', text: 'Ranking calculated successfully' })
        // Auto-save including ranking result
        updateRanking(criteriaWeights, alternativesScores, result)
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Ranking failed' })
    } finally {
      setLoading(false)
    }
  }

  const handleResetResults = async () => {
    if (!window.confirm('Are you sure you want to reset the ranking results? You can recalculate them by clicking "Calculate Ranking" again.')) {
      return
    }
    
    setRankingResult(null)
    // Update backend to clear ranking result
    await updateRanking(criteriaWeights, alternativesScores, null)
    setMessage({ type: 'success', text: 'Ranking results reset successfully' })
    setTimeout(() => setMessage({ type: '', text: '' }), 3000)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Ranking (AHP)</h2>

        {message.text && (
          <div className={`mb-4 p-3 rounded ${
            message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        {/* Column Management */}
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Ranking Columns</h3>
          <button
            onClick={() => setShowAddColumnModal(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Add Column
          </button>
        </div>

        {/* Criteria Weights */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">Criteria Weights</h3>
          {rankingColumns.length === 0 ? (
            <p className="text-gray-500">No columns added. Click "Add Column" to add ranking criteria.</p>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {rankingColumns.map((col) => (
                <div key={col} className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      {col}
                    </label>
                    <button
                      onClick={() => handleDeleteColumn(col)}
                      className="text-red-500 hover:text-red-700 text-sm"
                      title="Delete column"
                    >
                      ×
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    value={criteriaWeights[col] || ''}
                    onChange={(e) => handleWeightChange(col, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Weight"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alternatives Scores */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">Alternatives Scores</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Row No</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Alternative</th>
                  {rankingColumns.map((col) => (
                    <th key={col} className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.keys(alternativesScores).sort((a, b) => {
                  // Sort by row number
                  const rowNoA = extractRowNoFromKey(a) || 0
                  const rowNoB = extractRowNoFromKey(b) || 0
                  return rowNoA - rowNoB
                }).map((alt) => {
                  const rowNo = extractRowNoFromKey(alt) || ''
                  return (
                    <tr key={alt}>
                      <td className="px-4 py-3 border-b font-medium text-gray-600">{rowNo}</td>
                      <td className="px-4 py-3 border-b font-medium">{alt}</td>
                      {rankingColumns.map((col) => (
                        <td key={col} className="px-4 py-3 border-b">
                          <input
                            type="number"
                            step="0.1"
                            value={alternativesScores[alt][col] || ''}
                            onChange={(e) => handleScoreChange(alt, col, e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <button
          onClick={handleAHP}
          disabled={loading}
          className="flex items-center space-x-2 px-6 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          <BarChart3 className="w-5 h-5" />
          <span>Calculate Ranking</span>
        </button>

        {/* Results */}
        {rankingResult && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Ranking Results</h3>
              <button
                onClick={handleResetResults}
                className="flex items-center space-x-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                title="Reset ranking results"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset Results</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Rank</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Alternative</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {rankingResult.ranking.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 border-b font-bold">{index + 1}</td>
                      <td className="px-4 py-3 border-b">{item.alternative}</td>
                      <td className="px-4 py-3 border-b">{item.score.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Other Algorithms Notice */}
        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> TOPSIS, VIKOR, and other ranking algorithms need further development.
            </p>
          </div>
        </div>
      </div>

      {/* Add Column Modal */}
      {showAddColumnModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Add Ranking Column</h3>
              <button
                onClick={() => {
                  setShowAddColumnModal(false)
                  setNewColumnName('')
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-600 mb-4">Enter a name for the new ranking criteria column:</p>
            <input
              type="text"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleAddColumn()
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              placeholder="Column name (e.g., Cost, Quality, Safety)"
              autoFocus
            />
            <div className="flex space-x-2">
              <button
                onClick={handleAddColumn}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Add Column
              </button>
              <button
                onClick={() => {
                  setShowAddColumnModal(false)
                  setNewColumnName('')
                }}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RankingPage

