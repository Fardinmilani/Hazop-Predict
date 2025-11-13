import React, { useState, useEffect, useRef } from 'react'
import { rankingAPI, projectAPI, libraryAPI } from '../utils/api'
import { BarChart3, AlertCircle } from 'lucide-react'

function RankingPage() {
  const [projectData, setProjectData] = useState([])
  const [columns, setColumns] = useState([])
  const [rankingColumns, setRankingColumns] = useState([])
  const [criteriaWeights, setCriteriaWeights] = useState({})
  const [alternativesScores, setAlternativesScores] = useState({})
  const [rankingResult, setRankingResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  
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

  const buildScoresFromRows = (rows, baseScores) => {
    const result = {}
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
        if (baseScores && baseScores[key]) {
          existing = baseScores[key]
          break
        }
      }
      result[altKey] = existing
    })
    return result
  }

  // Sync alternatives with project rows - ensure we have exactly one alternative per project row
  const syncAlternativesWithProject = () => {
    isSyncingRef.current = true // Mark that we're syncing
    setAlternativesScores(prevScores => {
      const newScores = buildScoresFromRows(projectData, prevScores)
      return newScores
    })
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
      console.log('Ranking deleted event received - clearing all data')
      // Clear all ranking data immediately when file is deleted
      isSyncingRef.current = true
      setCriteriaWeights({})
      setRankingResult(null)
      // Clear alternatives but keep structure from project if exists
      const rows = await loadProjectData()
      console.log('Project rows after deletion:', rows?.length || 0)
      if (rows && rows.length > 0) {
        const newScores = {}
        rows.forEach(row => {
          const rowNo = row.rowNo || 0
          const altKey = `Row ${rowNo}`
          newScores[altKey] = {}
        })
        setAlternativesScores(newScores)
        console.log('Cleared alternatives scores, new structure:', Object.keys(newScores))
      } else {
        setAlternativesScores({})
        console.log('Cleared all alternatives scores (no project rows)')
      }
      // Reload ranking data to ensure it's empty (this will verify from backend)
      await loadRankingData(rows)
      console.log('Ranking data cleared and reloaded')
    }
    
    // Listen for ranking updates (refresh data)
    const handleRankingUpdated = async () => {
      // Reload ranking data when updated
      const rows = await loadProjectData()
      await loadRankingData(rows)
    }
    
    // Listen for project row deletion
    const handleProjectRowDeleted = async (e) => {
      const { deletedRowNo, newRows } = e.detail
      console.log('Project row deleted, rowNo:', deletedRowNo, 'New rows:', newRows)
      
      isSyncingRef.current = true
      setAlternativesScores(prevScores => {
        if (!newRows || newRows.length === 0) {
          // All rows removed - clear alternatives
          setTimeout(async () => {
            await updateRanking(criteriaWeights, {}, rankingResult)
          }, 0)
          return {}
        }
        
        const sortedOldKeys = Object.keys(prevScores || {})
          .filter((key) => {
            const rowNo = extractRowNoFromKey(key)
            return rowNo !== deletedRowNo
          })
          .sort((a, b) => {
            const rowNoA = extractRowNoFromKey(a) || 0
            const rowNoB = extractRowNoFromKey(b) || 0
            return rowNoA - rowNoB
          })
        
        const newScores = {}
        newRows.forEach((row, index) => {
          const newRowNo = row?.rowNo || index + 1
          const newAltKey = formatAlternativeKey(newRowNo)
          
          const sourceKey = sortedOldKeys[index]
          if (sourceKey && prevScores[sourceKey]) {
            newScores[newAltKey] = prevScores[sourceKey]
          } else {
            newScores[newAltKey] = {}
          }
        })
        
        console.log('Deleted alternative row', deletedRowNo, '-> new alternatives:', Object.keys(newScores))
        
        return newScores
      })
    }
    
    // Listen for project updates to sync alternatives with project rows
    const handleProjectUpdate = async () => {
      // Reload project data to get latest rows
      const rows = await loadProjectData()
      // Sync alternatives with project rows immediately using rowNo
      if (rows && rows.length > 0) {
        isSyncingRef.current = true
        setAlternativesScores(prevScores => {
          const newScores = buildScoresFromRows(rows, prevScores)
          return newScores
        })
      } else {
        setAlternativesScores({})
      }
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
    window.addEventListener('project-updated', handleProjectUpdate)
    window.addEventListener('project-row-deleted', handleProjectRowDeleted)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      window.removeEventListener('ranking-open', handleOpen)
      window.removeEventListener('ranking-deleted', handleRankingDeleted)
      window.removeEventListener('ranking-updated', handleRankingUpdated)
      window.removeEventListener('project-updated', handleProjectUpdate)
      window.removeEventListener('project-row-deleted', handleProjectRowDeleted)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  // Sync alternatives whenever projectData changes (after initial load)
  useEffect(() => {
    // Skip initial render to avoid double sync
    if (projectData.length === 0 && Object.keys(alternativesScores).length === 0) {
      return
    }
    
    if (projectData && projectData.length > 0) {
      syncAlternativesWithProject()
    } else if (projectData && projectData.length === 0) {
      // If project is empty, clear alternatives
      setAlternativesScores({})
    }
  }, [projectData.length])

  // Auto-save when alternativesScores changes (but only if it's a user change, not a sync)
  useEffect(() => {
    if (isSyncingRef.current) {
      isSyncingRef.current = false
      return // Don't save during sync
    }
    
    if (Object.keys(alternativesScores).length > 0) {
      // Only save if we have alternatives that match project rows
      const numRows = projectData.length
      const numAlternatives = Object.keys(alternativesScores).length
      if (numAlternatives === numRows && numRows > 0) {
        updateRanking(criteriaWeights, alternativesScores, rankingResult)
      }
    }
  }, [alternativesScores])

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
    try {
      const response = await libraryAPI.get()
      if (response.data.success) {
        // Filter columns that might be used for ranking
        // In a real app, you'd have a separate "Ranking Library" section
        setRankingColumns(response.data.data.headers.map(h => h.name))
      }
    } catch (error) {
      console.error('Error loading library:', error)
    }
  }

  const loadRankingData = async (currentProjectRows = null) => {
    try {
      console.log('Loading ranking data...')
      const response = await rankingAPI.get()
      console.log('Ranking API get response:', response)
      if (response.data && response.data.success) {
        const data = response.data.data || {}
        console.log('Ranking data received:', data)
        
        // Check if file was deleted (all data is empty)
        const hasCriteria = data.criteriaWeights && Object.keys(data.criteriaWeights).length > 0
        const hasAlternatives = data.alternativesScores && Object.keys(data.alternativesScores).length > 0
        const hasResult = data.rankingResult && data.rankingResult !== null
        
        console.log('Data check - hasCriteria:', hasCriteria, 'hasAlternatives:', hasAlternatives, 'hasResult:', hasResult)
        
        if (!hasCriteria && !hasAlternatives && !hasResult) {
          // File was deleted or is empty - clear all data
          console.log('File is empty or deleted - clearing all ranking data')
          isSyncingRef.current = true
          setCriteriaWeights({})
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
              console.log('Cleared alternatives, created new structure:', Object.keys(newScores))
              return newScores
            })
          } else {
            setAlternativesScores({})
            console.log('Cleared all alternatives (no project rows)')
          }
          return
        }
        
        if (hasCriteria) {
          setCriteriaWeights(data.criteriaWeights)
        } else {
          setCriteriaWeights({})
        }
        
        if (hasAlternatives) {
          // Merge saved alternatives scores with project structure
          isSyncingRef.current = true
          setAlternativesScores(prevScores => {
            // Use currentProjectRows if provided, otherwise use projectData state
            const rows = currentProjectRows || projectData
            const mergedScores = {}
            
            // First, create structure based on project rows using rowNo
            rows.forEach((row, index) => {
              const rowNo = row?.rowNo || index + 1
              const altKey = formatAlternativeKey(rowNo)
              const candidateKeys = [
                ...legacyAlternativeKeys(rowNo),
                altKey,
                formatAlternativeKey(index + 1),
                ...legacyAlternativeKeys(index + 1)
              ]
              
              let existingScores = {}
              for (const key of candidateKeys) {
                if (data.alternativesScores && data.alternativesScores[key]) {
                  existingScores = data.alternativesScores[key]
                  break
                }
                if (prevScores && prevScores[key]) {
                  existingScores = prevScores[key]
                  break
                }
              }
              
              mergedScores[altKey] = existingScores
            })
            
            return mergedScores
          })
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

  const updateRanking = async (newCriteriaWeights, newAlternativesScores, newRankingResult) => {
    try {
      console.log('Updating ranking with alternativesScores:', newAlternativesScores)
      console.log('Number of alternatives:', Object.keys(newAlternativesScores).length)
      await rankingAPI.update(newCriteriaWeights, newAlternativesScores, newRankingResult)
      // Emit event to notify FilePage
      window.dispatchEvent(new CustomEvent('ranking-updated'))
    } catch (error) {
      console.error('Error updating ranking:', error)
    }
  }

  const handleWeightChange = (column, weight) => {
    const newWeights = {
      ...criteriaWeights,
      [column]: parseFloat(weight) || 0
    }
    setCriteriaWeights(newWeights)
    // Auto-save
    updateRanking(newWeights, alternativesScores, rankingResult)
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
    // Auto-save immediately
    updateRanking(criteriaWeights, newScores, rankingResult)
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

        {/* Criteria Weights */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">Criteria Weights</h3>
          <div className="grid grid-cols-3 gap-4">
            {rankingColumns.map((col) => (
              <div key={col}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {col}
                </label>
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
            <h3 className="text-xl font-bold mb-4">Ranking Results</h3>
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
    </div>
  )
}

export default RankingPage

