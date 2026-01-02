import React, { useState, useEffect, useRef } from 'react'
import { rankingAPI, projectAPI, libraryAPI } from '../utils/api'
import { BarChart3, AlertCircle, X, RotateCcw } from 'lucide-react'
import { RANKING_GROUP_PRESETS } from '../constants/rankingGroupPresets'

function RankingPage() {
  const [projectData, setProjectData] = useState([])
  const [columns, setColumns] = useState([])
  const [rankingColumns, setRankingColumns] = useState([])
  const [columnGroups, setColumnGroups] = useState([]) // New state for column groups
  const [criteriaWeights, setCriteriaWeights] = useState({})
  const [alternativesScores, setAlternativesScores] = useState({})
  const [rankingResult, setRankingResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [showAddColumnModal, setShowAddColumnModal] = useState(false)
  const [newColumnName, setNewColumnName] = useState('')
  const [newGroup, setNewGroup] = useState('') // New state for group selection
  const [showAddGroupModal, setShowAddGroupModal] = useState(false)
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(null)
  const [showComputedResults, setShowComputedResults] = useState(false)
  const [computedResults, setComputedResults] = useState({})
  
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

  // Helper functions for group codes and key handling
  const extractGroupCode = (groupName) => {
    if (!groupName) return null
    const match = groupName.match(/\(([A-Z])\)$/)
    return match ? match[1] : null
  }

  const makeCriteriaKey = (groupName, label) => {
    const code = extractGroupCode(groupName)
    if (code) {
      return `${code}::${label}`
    }
    return label
  }

  const displayCriteriaLabel = (key) => {
    if (!key) return ''
    if (key.includes('::')) {
      return key.split('::')[1]
    }
    return key
  }

  // Helper functions for RCA tree structure
  const extractGroupToken = (groupName) => {
    if (!groupName) return null
    // Check for F(t) first
    if (groupName.includes('F(t)')) return 'F(t)'
    // Check for single letter tokens: (D), (P), (C), (O), (M)
    const match = groupName.match(/\(([A-Z])\)$/)
    return match ? match[1] : null
  }

  // Organize groups by phase
  const organizeGroupsByPhase = (groups) => {
    const development = [] // D, P, C
    const aging = [] // F(t)
    const operation = [] // O, M
    const other = [] // Unknown groups

    groups.forEach(group => {
      const token = extractGroupToken(group.name)
      if (token === 'D' || token === 'P' || token === 'C') {
        development.push(group)
      } else if (token === 'F(t)') {
        aging.push(group)
      } else if (token === 'O' || token === 'M') {
        operation.push(group)
      } else {
        other.push(group)
      }
    })

    // Sort development groups: D, P, C
    development.sort((a, b) => {
      const order = { 'D': 1, 'P': 2, 'C': 3 }
      const tokenA = extractGroupToken(a.name)
      const tokenB = extractGroupToken(b.name)
      return (order[tokenA] || 999) - (order[tokenB] || 999)
    })

    // Sort operation groups: O, M
    operation.sort((a, b) => {
      const order = { 'O': 1, 'M': 2 }
      const tokenA = extractGroupToken(a.name)
      const tokenB = extractGroupToken(b.name)
      return (order[tokenA] || 999) - (order[tokenB] || 999)
    })

    return { development, aging, operation, other }
  }

  // Calculate group score for an alternative
  const calculateGroupScore = (alternative, groupColumns) => {
    if (!groupColumns || groupColumns.length === 0) return 0
    
    const weights = {}
    let sumWeights = 0
    groupColumns.forEach(col => {
      const weight = criteriaWeights[col] || 0
      weights[col] = weight
      sumWeights += Math.abs(weight)
    })

    if (sumWeights === 0) {
      // Simple average if no weights
      let sum = 0
      let count = 0
      groupColumns.forEach(col => {
        const score = alternativesScores[alternative]?.[col]
        if (score !== '' && score !== null && score !== undefined) {
          const numScore = parseFloat(score)
          if (!isNaN(numScore)) {
            sum += numScore
            count++
          }
        }
      })
      return count > 0 ? sum / count : 0
    }

    // Weighted average
    let weightedSum = 0
    groupColumns.forEach(col => {
      const score = alternativesScores[alternative]?.[col]
      if (score !== '' && score !== null && score !== undefined) {
        const numScore = parseFloat(score)
        if (!isNaN(numScore)) {
          const normalizedWeight = weights[col] / sumWeights
          weightedSum += normalizedWeight * numScore
        }
      }
    })

    return weightedSum
  }

  // Calculate computed values for an alternative
  const calculateComputedValues = (alternative) => {
    const { development, aging, operation } = organizeGroupsByPhase(columnGroups)

    // Get group columns
    const dCols = development.find(g => extractGroupToken(g.name) === 'D')?.columns || []
    const pCols = development.find(g => extractGroupToken(g.name) === 'P')?.columns || []
    const cCols = development.find(g => extractGroupToken(g.name) === 'C')?.columns || []
    const fCols = aging.find(g => extractGroupToken(g.name) === 'F(t)')?.columns || []
    const oCols = operation.find(g => extractGroupToken(g.name) === 'O')?.columns || []
    const mCols = operation.find(g => extractGroupToken(g.name) === 'M')?.columns || []

    // Calculate group scores
    const D = calculateGroupScore(alternative, dCols)
    const P = calculateGroupScore(alternative, pCols)
    const C = calculateGroupScore(alternative, cCols)
    const F_t = calculateGroupScore(alternative, fCols)
    const O = calculateGroupScore(alternative, oCols)
    const M = calculateGroupScore(alternative, mCols)

    // Calculate sum of weights for each phase
    const sumWeights = (cols) => {
      return cols.reduce((sum, col) => sum + Math.abs(criteriaWeights[col] || 0), 0)
    }

    const wa = sumWeights([...dCols, ...pCols, ...cCols])
    const wv = sumWeights([...oCols, ...mCols])
    const wf = sumWeights(fCols)

    // Calculate a (weighted average of D, P, C)
    let a = 0
    if (wa > 0) {
      const wD = sumWeights(dCols)
      const wP = sumWeights(pCols)
      const wC = sumWeights(cCols)
      a = (wD * D + wP * P + wC * C) / wa
    } else if (dCols.length + pCols.length + cCols.length > 0) {
      const values = [D, P, C].filter(v => !isNaN(v))
      a = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0
    }

    // Calculate V (weighted average of O, M)
    let V = 0
    if (wv > 0) {
      const wO = sumWeights(oCols)
      const wM = sumWeights(mCols)
      V = (wO * O + wM * M) / wv
    } else if (oCols.length + mCols.length > 0) {
      const values = [O, M].filter(v => !isNaN(v))
      V = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0
    }

    // Calculate a·V·F(t)
    let aVF_t = 0
    const totalWeight = wa + wv + wf
    if (totalWeight > 0) {
      aVF_t = (wa * a + wv * V + wf * F_t) / totalWeight
    } else if (wa + wv + wf === 0 && (a !== 0 || V !== 0 || F_t !== 0)) {
      const values = [a, V, F_t].filter(v => !isNaN(v) && v !== 0)
      aVF_t = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0
    }

    return { D, P, C, a, 'F(t)': F_t, O, M, V, 'a·V·F(t)': aVF_t }
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
      setInitialLoading(true)
      try {
        const rows = await loadProjectData()
        await loadLibrary()
        // Then load ranking data which will merge with the structure
        // Pass rows to loadRankingData so it can use them immediately
        // This will also clear data if file was deleted
        await loadRankingData(rows)
      } finally {
        setInitialLoading(false)
      }
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
      setRankingResult(null)
      // Clear alternatives but keep structure from project if exists
      const rows = await loadProjectData()
      if (rows && rows.length > 0) {
        const newScores = {}
        rows.forEach(row => {
          const rowNo = row.rowNo || 0
          const altKey = `Row ${rowNo}`
          newScores[altKey] = {}
        })
        setAlternativesScores(newScores)
      } else {
        setAlternativesScores({})
      }
      // Reload ranking data to ensure it's empty (this will verify from backend)
      await loadRankingData(rows)
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
      
      isSyncingRef.current = true
      setAlternativesScores(prevScores => {
        if (!newRows || newRows.length === 0) {
          // All rows removed - clear alternatives but preserve columns
          setTimeout(async () => {
            await updateRanking(criteriaWeights, {}, rankingResult, rankingColumns)
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
        
        // Save updated scores while preserving columns and weights
        setTimeout(async () => {
          await updateRanking(criteriaWeights, newScores, rankingResult, rankingColumns)
        }, 100)
        
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
        const newScores = buildScoresFromRows(rows, alternativesScores)
        setAlternativesScores(newScores)
        // Save the synced alternatives to backend
        await updateRanking(criteriaWeights, newScores, rankingResult, rankingColumns)
        isSyncingRef.current = false
      } else {
        setAlternativesScores({})
        await updateRanking(criteriaWeights, {}, rankingResult, rankingColumns)
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
          setRankingResult(null)
          setRankingColumns([])
          setColumnGroups([])
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
        
        // Load ranking columns and groups
        if (data.columns && Array.isArray(data.columns) && data.columns.length > 0) {
          setRankingColumns(data.columns)
        } else {
          setRankingColumns([])
        }
        
        if (data.groups && Array.isArray(data.groups) && data.groups.length > 0) {
          setColumnGroups(data.groups)
        } else {
          setColumnGroups([])
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
        setRankingColumns([])
        setColumnGroups([])
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
      setRankingColumns([])
      setColumnGroups([])
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

  const updateRanking = async (newCriteriaWeights, newAlternativesScores, newRankingResult, newColumns = null, newGroups = null) => {
    try {
      const columnsToSave = newColumns !== null ? newColumns : rankingColumns
      const groupsToSave = newGroups !== null ? newGroups : columnGroups
      await rankingAPI.update(newCriteriaWeights, newAlternativesScores, newRankingResult, columnsToSave, groupsToSave)
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
    
    // Clear computed results when data changes
    if (showComputedResults) {
      setShowComputedResults(false)
      setComputedResults({})
    }
    
    // Auto-save only the changed cell
    rankingAPI.updateCell('score', alternative, column, scoreValue).catch(error => {
      console.error('Error updating score:', error)
    })
  }
  
  const handleCalculateComputedResults = () => {
    const newComputedResults = {}
    Object.keys(alternativesScores).forEach(alt => {
      newComputedResults[alt] = calculateComputedValues(alt)
    })
    setComputedResults(newComputedResults)
    setShowComputedResults(true)
    setMessage({ type: 'success', text: 'Computed results calculated successfully' })
    setTimeout(() => setMessage({ type: '', text: '' }), 3000)
  }
  
  const handleHideComputedResults = () => {
    setShowComputedResults(false)
    setComputedResults({})
    setMessage({ type: 'info', text: 'Computed results hidden' })
    setTimeout(() => setMessage({ type: '', text: '' }), 3000)
  }

  const handleAddColumn = () => {
    if (!newColumnName.trim()) {
      setMessage({ type: 'error', text: 'Please enter a column name' })
      return
    }
    
    const trimmedColumnName = newColumnName.trim()
    const trimmedGroup = newGroup.trim()
    
    // Use makeCriteriaKey if group is provided
    const columnKey = trimmedGroup ? makeCriteriaKey(trimmedGroup, trimmedColumnName) : trimmedColumnName
    
    if (rankingColumns.includes(columnKey)) {
      setMessage({ type: 'error', text: 'Column already exists' })
      return
    }
    
    const newColumns = [...rankingColumns, columnKey]
    setRankingColumns(newColumns)
    
    // Update groups
    let newGroups = [...columnGroups]
    if (trimmedGroup) {
      const existingGroupIndex = newGroups.findIndex(g => g.name === trimmedGroup)
      if (existingGroupIndex >= 0) {
        newGroups[existingGroupIndex] = {
          ...newGroups[existingGroupIndex],
          columns: [...newGroups[existingGroupIndex].columns, columnKey]
        }
      } else {
        newGroups.push({
          name: trimmedGroup,
          columns: [columnKey]
        })
      }
    }
    setColumnGroups(newGroups)
    
    setNewColumnName('')
    setNewGroup('')
    setShowAddColumnModal(false)
    
    // Clear weights and scores for this new column
    const newWeights = { ...criteriaWeights }
    newWeights[columnKey] = 0
    
    const newScores = { ...alternativesScores }
    Object.keys(newScores).forEach(alt => {
      newScores[alt] = { ...newScores[alt], [columnKey]: '' }
    })
    
    setCriteriaWeights(newWeights)
    setAlternativesScores(newScores)
    
    // Clear computed results when columns change
    setShowComputedResults(false)
    setComputedResults({})
    
    // Save to backend
    updateRanking(newWeights, newScores, rankingResult, newColumns, newGroups)
    setMessage({ type: 'success', text: `Column "${trimmedColumnName}" added successfully` })
    setTimeout(() => setMessage({ type: '', text: '' }), 3000)
  }

  const handleAddGroupPreset = (preset) => {
    if (!preset) {
      setMessage({ type: 'error', text: 'Please select a preset group' })
      return
    }

    const groupName = preset.name
    const criteriaKeys = preset.columns.map(label => makeCriteriaKey(groupName, label))
    
    // Filter out keys that already exist
    const newKeys = criteriaKeys.filter(key => !rankingColumns.includes(key))
    
    if (newKeys.length === 0) {
      setMessage({ type: 'info', text: `All columns from "${groupName}" already exist` })
      setTimeout(() => setMessage({ type: '', text: '' }), 3000)
      return
    }
    
    // Add new keys to rankingColumns (append to preserve order)
    const newRankingColumns = [...rankingColumns, ...newKeys]
    setRankingColumns(newRankingColumns)
    
    // Update groups
    let newColumnGroups = [...columnGroups]
    const existingGroupIndex = newColumnGroups.findIndex(g => g.name === groupName)
    
    if (existingGroupIndex >= 0) {
      // Merge columns without duplicates
      const existingColumns = new Set(newColumnGroups[existingGroupIndex].columns)
      criteriaKeys.forEach(key => existingColumns.add(key))
      newColumnGroups[existingGroupIndex] = {
        ...newColumnGroups[existingGroupIndex],
        columns: Array.from(existingColumns)
      }
    } else {
      // Create new group
      newColumnGroups.push({
        name: groupName,
        columns: criteriaKeys
      })
    }
    setColumnGroups(newColumnGroups)
    
    // Update weights - only add for new keys, don't overwrite existing
    const newWeights = { ...criteriaWeights }
    newKeys.forEach(key => {
      if (!(key in newWeights)) {
        newWeights[key] = 0
      }
    })
    setCriteriaWeights(newWeights)
    
    // Update scores - add empty values for new keys
    const newScores = { ...alternativesScores }
    Object.keys(newScores).forEach(alt => {
      newKeys.forEach(key => {
        if (!(key in newScores[alt])) {
          newScores[alt] = { ...newScores[alt], [key]: '' }
        }
      })
    })
    setAlternativesScores(newScores)
    
    // Clear computed results when groups change
    setShowComputedResults(false)
    setComputedResults({})
    
    // Close modal and reset selection
    setShowAddGroupModal(false)
    setSelectedPresetIndex(null)
    
    // Save to backend
    updateRanking(newWeights, newScores, rankingResult, newRankingColumns, newColumnGroups)
    
    const addedCount = newKeys.length
    const skippedCount = criteriaKeys.length - newKeys.length
    let messageText = `${addedCount} column(s) from "${groupName}" added successfully`
    if (skippedCount > 0) {
      messageText += ` (${skippedCount} already existed)`
    }
    setMessage({ type: 'success', text: messageText })
    setTimeout(() => setMessage({ type: '', text: '' }), 3000)
  }

  const handleDeleteColumn = (columnToDelete) => {
    const displayName = displayCriteriaLabel(columnToDelete)
    if (!window.confirm(`Are you sure you want to delete column "${displayName}"? All data in this column will be lost.`)) {
      return
    }
    
    const newColumns = rankingColumns.filter(col => col !== columnToDelete)
    setRankingColumns(newColumns)
    
    // Remove from groups
    const newGroups = columnGroups.map(group => ({
      ...group,
      columns: group.columns.filter(col => col !== columnToDelete)
    })).filter(group => group.columns.length > 0)
    setColumnGroups(newGroups)
    
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
    updateRanking(newWeights, newScores, rankingResult, newColumns, newGroups)
    setMessage({ type: 'success', text: `Column "${displayName}" deleted successfully` })
    setTimeout(() => setMessage({ type: '', text: '' }), 3000)
  }

  const handleDeleteGroup = (groupToDelete) => {
    const group = columnGroups.find(g => g.name === groupToDelete)
    if (!group) return

    const columnsToDelete = group.columns
    const columnsCount = columnsToDelete.length
    
    if (!window.confirm(`Are you sure you want to delete group "${groupToDelete}"? All ${columnsCount} column(s) in this group and their data will be lost.`)) {
      return
    }
    
    // Remove all columns of this group from rankingColumns
    const newColumns = rankingColumns.filter(col => !columnsToDelete.includes(col))
    setRankingColumns(newColumns)
    
    // Remove the group from columnGroups
    const newGroups = columnGroups.filter(g => g.name !== groupToDelete)
    setColumnGroups(newGroups)
    
    // Remove all columns from weights
    const newWeights = { ...criteriaWeights }
    columnsToDelete.forEach(col => {
      delete newWeights[col]
    })
    setCriteriaWeights(newWeights)
    
    // Remove all columns from scores
    const newScores = { ...alternativesScores }
    Object.keys(newScores).forEach(alt => {
      const altScores = { ...newScores[alt] }
      columnsToDelete.forEach(col => {
        delete altScores[col]
      })
      newScores[alt] = altScores
    })
    setAlternativesScores(newScores)
    
    // Clear computed results when groups change
    setShowComputedResults(false)
    setComputedResults({})
    
    // Save to backend
    updateRanking(newWeights, newScores, rankingResult, newColumns, newGroups)
    setMessage({ type: 'success', text: `Group "${groupToDelete}" and ${columnsCount} column(s) deleted successfully` })
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
    setMessage({ type: '', text: '' })
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
      setMessage({ type: 'error', text: error.response?.data?.error || 'Ranking calculation failed' })
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

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-600">Loading ranking data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Ranking (AHP)</h2>

        {message.text && (
          <div className={`mb-4 p-3 rounded ${
            message.type === 'success' 
              ? 'bg-green-100 text-green-700' 
              : message.type === 'info'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-red-100 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        {/* Column Management */}
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Ranking Columns</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowAddGroupModal(true)}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Add Group
            </button>
            <button
              onClick={() => setShowAddColumnModal(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Add Column
            </button>
            {!showComputedResults ? (
              <button
                onClick={handleCalculateComputedResults}
                className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
                disabled={Object.keys(alternativesScores).length === 0 || columnGroups.length === 0}
              >
                Calculate Computed Results
              </button>
            ) : (
              <button
                onClick={handleHideComputedResults}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Hide Computed Results
              </button>
            )}
          </div>
        </div>

        {/* Criteria Weights */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">Criteria Weights</h3>
          {rankingColumns.length === 0 ? (
            <p className="text-gray-500">No columns added. Click "Add Column" to add ranking criteria.</p>
          ) : columnGroups.length > 0 ? (
            // Grouped weights display
            columnGroups.map((group) => (
              <div key={group.name} className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-md font-semibold text-blue-600">{group.name}</h4>
                  <button
                    onClick={() => handleDeleteGroup(group.name)}
                    className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                    title="Delete group"
                  >
                    Delete Group
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {group.columns.map((col) => (
                    <div key={col} className="relative">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          {displayCriteriaLabel(col)}
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
                        className="w-auto max-w-[120px] px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Weight"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            // Flat weights display
            <div className="grid grid-cols-3 gap-4">
              {rankingColumns.map((col) => (
                <div key={col} className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      {displayCriteriaLabel(col)}
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
            {(() => {
              const { development, aging, operation, other } = organizeGroupsByPhase(columnGroups)
              
              // Determine which computed columns to show
              const hasD = development.some(g => extractGroupToken(g.name) === 'D')
              const hasP = development.some(g => extractGroupToken(g.name) === 'P')
              const hasC = development.some(g => extractGroupToken(g.name) === 'C')
              const hasF = aging.length > 0
              const hasO = operation.some(g => extractGroupToken(g.name) === 'O')
              const hasM = operation.some(g => extractGroupToken(g.name) === 'M')
              const hasDevelopment = hasD || hasP || hasC
              const hasOperation = hasO || hasM
              
              // Build ordered groups list with computed columns inserted at appropriate positions
              const orderedGroupsWithComputed = []
              
              // Development phase groups
              development.forEach((group, idx) => {
                orderedGroupsWithComputed.push({ type: 'group', group })
                const token = extractGroupToken(group.name)
                // Add computed column after each group
                if (showComputedResults) {
                  if (token === 'D' && hasD) {
                    orderedGroupsWithComputed.push({ type: 'computed', name: 'D' })
                  } else if (token === 'P' && hasP) {
                    orderedGroupsWithComputed.push({ type: 'computed', name: 'P' })
                  } else if (token === 'C' && hasC) {
                    orderedGroupsWithComputed.push({ type: 'computed', name: 'C' })
                  }
                }
              })
              
              // Add 'a' after all development groups (not after last group)
              if (development.length > 0 && showComputedResults && hasDevelopment) {
                orderedGroupsWithComputed.push({ type: 'computed', name: 'a' })
              }
              
              // Aging groups
              aging.forEach((group, idx) => {
                orderedGroupsWithComputed.push({ type: 'group', group })
                // Add F(t) after F(t) group
                if (idx === aging.length - 1 && showComputedResults && hasF) {
                  orderedGroupsWithComputed.push({ type: 'computed', name: 'F(t)' })
                }
              })
              
              // Operation phase groups
              operation.forEach((group, idx) => {
                orderedGroupsWithComputed.push({ type: 'group', group })
                const token = extractGroupToken(group.name)
                // Add computed column after each group
                if (showComputedResults) {
                  if (token === 'O' && hasO) {
                    orderedGroupsWithComputed.push({ type: 'computed', name: 'O' })
                  } else if (token === 'M' && hasM) {
                    orderedGroupsWithComputed.push({ type: 'computed', name: 'M' })
                  }
                }
              })
              
              // Add 'V' after all operation groups (not after last group)
              if (operation.length > 0 && showComputedResults && hasOperation) {
                orderedGroupsWithComputed.push({ type: 'computed', name: 'V' })
              }
              
              // Other groups
              other.forEach(group => {
                orderedGroupsWithComputed.push({ type: 'group', group })
              })
              
              // Add final a·V·F(t) at the end
              if (showComputedResults && ((hasDevelopment && hasOperation && hasF) || 
                  (hasDevelopment && hasOperation) || 
                  (hasDevelopment && hasF) || 
                  (hasOperation && hasF))) {
                orderedGroupsWithComputed.push({ type: 'computed', name: 'a·V·F(t)' })
              }
              
              // Calculate total columns
              let totalCols = 2 // Row No + Alternative
              orderedGroupsWithComputed.forEach(item => {
                if (item.type === 'group') {
                  totalCols += item.group.columns.length
                } else {
                  totalCols += 1
                }
              })
              
              // Calculate column spans for phase headers
              let devCols = 0
              let devComputedCols = 0
              development.forEach((group) => {
                devCols += group.columns.length
                if (showComputedResults) {
                  const token = extractGroupToken(group.name)
                  if (token === 'D' && hasD) devComputedCols++
                  else if (token === 'P' && hasP) devComputedCols++
                  else if (token === 'C' && hasC) devComputedCols++
                }
              })
              // Add 'a' after all development groups
              if (showComputedResults && hasDevelopment) devComputedCols++
              
              let agingCols = 0
              let agingComputedCols = 0
              aging.forEach((group, idx) => {
                agingCols += group.columns.length
                if (idx === aging.length - 1 && showComputedResults && hasF) {
                  agingComputedCols++ // F(t)
                }
              })
              
              let opCols = 0
              let opComputedCols = 0
              operation.forEach((group) => {
                opCols += group.columns.length
                if (showComputedResults) {
                  const token = extractGroupToken(group.name)
                  if (token === 'O' && hasO) opComputedCols++
                  else if (token === 'M' && hasM) opComputedCols++
                }
              })
              // Add 'V' after all operation groups
              if (showComputedResults && hasOperation) opComputedCols++
              
              const otherCols = other.reduce((sum, g) => sum + g.columns.length, 0)
              const finalComputedCols = showComputedResults && ((hasDevelopment && hasOperation && hasF) || 
                (hasDevelopment && hasOperation) || 
                (hasDevelopment && hasF) || 
                (hasOperation && hasF)) ? 1 : 0
              
              return (
                <table className="w-full bg-white border border-gray-300" style={{ tableLayout: 'auto' }}>
                  <thead>
                    {/* Row 1: Main Title */}
                    <tr className="bg-gray-50">
                      <th 
                        colSpan={totalCols} 
                        className="px-4 py-3 text-center text-sm font-bold text-gray-800 border-b border-gray-300"
                      >
                        RCA Table and Risk Occurrence Probability Calculation Using Fault Tree and Analytic Hierarchy Decision-Making Method
                      </th>
                    </tr>
                    
                    {/* Row 2: Subtitle */}
                    <tr className="bg-gray-50">
                      <th 
                        colSpan={totalCols} 
                        className="px-4 py-3 text-center text-xs font-semibold text-gray-700 border-b border-gray-300"
                      >
                        Weights of Factors Leading to the Occurrence of the Main Cause of Deviation (Cause resulting from equipment malfunction)
                        <br />
                        (Main Cause: Cause) {'{a·V·F(t)}'}
                      </th>
                    </tr>
                    
                    {/* Row 3: Phase Headers */}
                    <tr className="bg-gray-100">
                      <th 
                        className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase border-r border-gray-300 w-[80px]" 
                        rowSpan={3}
                      >
                        Row No
                      </th>
                      <th 
                        className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase border-r border-gray-300 w-[150px]" 
                        rowSpan={3}
                      >
                        Alternative
                      </th>
                      {(devCols + devComputedCols) > 0 && (
                        <th 
                          className="px-3 py-3 text-center text-xs font-medium text-gray-700 uppercase border-r border-gray-300"
                          colSpan={devCols + devComputedCols}
                        >
                          Factors Related to Equipment Development Phase (Parameters: a)
                        </th>
                      )}
                      {(agingCols + agingComputedCols) > 0 && (
                        <th 
                          className={`px-3 py-3 text-center text-xs font-medium text-gray-700 uppercase ${(opCols + opComputedCols) > 0 || otherCols > 0 || finalComputedCols > 0 ? 'border-r border-gray-300' : ''}`}
                          colSpan={agingCols + agingComputedCols}
                        >
                          Equipment Aging and Lifetime F(t)
                        </th>
                      )}
                      {(opCols + opComputedCols) > 0 && (
                        <th 
                          className={`px-3 py-3 text-center text-xs font-medium text-gray-700 uppercase ${otherCols > 0 || finalComputedCols > 0 ? 'border-r border-gray-300' : ''}`}
                          colSpan={opCols + opComputedCols}
                        >
                          Factors Related to Equipment Operation Phase (Variables: V)
                        </th>
                      )}
                      {otherCols > 0 && (
                        <th 
                          className={`px-3 py-3 text-center text-xs font-medium text-gray-700 uppercase ${finalComputedCols > 0 ? 'border-r border-gray-300' : ''}`}
                          colSpan={otherCols}
                        >
                          Other
                        </th>
                      )}
                      {finalComputedCols > 0 && (
                        <th 
                          className="px-3 py-3 text-center text-xs font-medium text-gray-700 uppercase"
                          colSpan={finalComputedCols}
                        >
                          Weights of Factors Leading to the Occurrence of the Main Cause of Deviation
                        </th>
                      )}
                    </tr>
                    
                    {/* Row 4: Group Headers */}
                    <tr className="bg-gray-100">
                      {orderedGroupsWithComputed
                        .filter(item => item.type === 'group' || (item.type === 'computed' && (item.name === 'a' || item.name === 'V' || item.name === 'a·V·F(t)')))
                        .map((item, itemIndex, filteredArray) => {
                          if (item.type === 'group') {
                            const group = item.group
                            const token = extractGroupToken(group.name)
                            const isLastDevGroup = development.indexOf(group) === development.length - 1
                            const isLastOpGroup = operation.indexOf(group) === operation.length - 1
                            const isLastAgingGroup = aging.indexOf(group) === aging.length - 1
                            
                            // Calculate computed columns that should come after this group (based on logic, not orderedGroupsWithComputed)
                            // Note: 'a' and 'V' are phase-level, not group-level, so they don't belong to any single group
                            let computedAfterCount = 0
                            if (showComputedResults) {
                              // Group-level computed columns only
                              if (token === 'D' && hasD) computedAfterCount++
                              else if (token === 'P' && hasP) computedAfterCount++
                              else if (token === 'C' && hasC) computedAfterCount++
                              else if (token === 'O' && hasO) computedAfterCount++
                              else if (token === 'M' && hasM) computedAfterCount++
                              else if (token === 'F(t)' && hasF && isLastAgingGroup) computedAfterCount++
                            }
                            
                            // Check if next item is a phase-level computed column (a or V), standalone computed (a·V·F(t)), or another group
                            const nextItem = itemIndex < filteredArray.length - 1 ? filteredArray[itemIndex + 1] : null
                            const hasPhaseLevelComputedAfter = nextItem && nextItem.type === 'computed' && 
                              ((isLastDevGroup && nextItem.name === 'a') || (isLastOpGroup && nextItem.name === 'V'))
                            const hasStandaloneComputedAfter = nextItem && nextItem.type === 'computed' && nextItem.name === 'a·V·F(t)'
                            const hasMoreGroups = nextItem && nextItem.type === 'group'
                            
                            const hasRightBorder = hasMoreGroups || hasStandaloneComputedAfter || hasPhaseLevelComputedAfter || computedAfterCount > 0
                            
                            const colSpan = group.columns.length + computedAfterCount
                            
                            return (
                              <th 
                                key={group.name}
                                className={`px-3 py-3 text-center text-xs font-medium text-gray-700 uppercase ${
                                  hasRightBorder ? 'border-r border-gray-300' : ''
                                }`}
                                colSpan={colSpan}
                              >
                                <div className="flex items-center justify-center gap-2">
                                  <span>{group.name}</span>
                                  <button
                                    onClick={() => handleDeleteGroup(group.name)}
                                    className="text-red-500 hover:text-red-700 text-xs font-normal px-1 py-0.5 rounded hover:bg-red-50 transition-colors"
                                    title="Delete group"
                                  >
                                    ×
                                  </button>
                                </div>
                              </th>
                            )
                          } else if (item.type === 'computed') {
                            // Phase-level computed columns (a, V) and standalone (a·V·F(t)) get empty headers in Row 4
                            const isLastItem = itemIndex === filteredArray.length - 1
                            return (
                              <th 
                                key={`computed_header_${item.name}`}
                                className={`px-3 py-3 text-center text-xs font-medium text-gray-700 uppercase ${
                                  !isLastItem ? 'border-r border-gray-300' : ''
                                }`}
                                colSpan={1}
                              >
                                {/* Empty for group header row - computed columns don't have group headers */}
                              </th>
                            )
                          }
                          return null
                        })}
                    </tr>
                    
                    {/* Row 5: Leaf Criteria and Computed Column Headers */}
                    <tr className="bg-gray-100">
                      {orderedGroupsWithComputed.map((item, itemIndex) => {
                        if (item.type === 'group') {
                          const group = item.group
                          const token = extractGroupToken(group.name)
                          const isLastDevGroup = development.indexOf(group) === development.length - 1
                          const isLastOpGroup = operation.indexOf(group) === operation.length - 1
                          
                          // Check if next item is a computed column that should be rendered after this group
                          // Note: 'a' comes after all development groups, 'V' comes after all operation groups
                          const nextItem = itemIndex < orderedGroupsWithComputed.length - 1 ? orderedGroupsWithComputed[itemIndex + 1] : null
                          const hasComputedAfter = nextItem && nextItem.type === 'computed' && (
                            (token === 'D' && nextItem.name === 'D') ||
                            (token === 'P' && nextItem.name === 'P') ||
                            (token === 'C' && nextItem.name === 'C') ||
                            (token === 'O' && nextItem.name === 'O') ||
                            (token === 'M' && nextItem.name === 'M') ||
                            (token === 'F(t)' && nextItem.name === 'F(t)')
                          )
                          // Check if next item is phase-level computed column (a or V)
                          // 'a' comes after all development groups, 'V' comes after all operation groups
                          const hasPhaseLevelComputedAfter = nextItem && nextItem.type === 'computed' && (
                            (isLastDevGroup && nextItem.name === 'a') ||
                            (isLastOpGroup && nextItem.name === 'V')
                          )
                          
                          return group.columns.map((col, colIndex) => {
                            const isLastInGroup = colIndex === group.columns.length - 1
                            // For phase-level computed columns (a, V), they come after all groups in their phase
                            // So we don't add border after the last column of the last group in each phase
                            const isLastItem = itemIndex === orderedGroupsWithComputed.length - 1 && !hasComputedAfter && !hasPhaseLevelComputedAfter
                            // Only add border if:
                            // 1. Not the last column in group, OR
                            // 2. Has group-level computed column after (D, P, C, O, M, F(t)), OR
                            // 3. Not the last item overall
                            // Note: We don't add border for phase-level computed columns (a, V) because they're rendered separately
                            const hasRightBorder = !isLastInGroup || hasComputedAfter || (!hasPhaseLevelComputedAfter && !isLastItem)
                            return (
                              <th 
                                key={`${group.name}__${col}`}
                                className={`px-3 py-3 text-center text-xs font-medium text-gray-700 uppercase w-[120px] ${
                                  hasRightBorder ? 'border-r border-gray-300' : ''
                                }`}
                              >
                                {displayCriteriaLabel(col)}
                              </th>
                            )
                          })
                        } else {
                          // Computed column header - render it here since it's already in orderedGroupsWithComputed
                          const isLastItem = itemIndex === orderedGroupsWithComputed.length - 1
                          return (
                            <th 
                              key={`computed_${item.name}`}
                              className={`px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase bg-gray-50 w-[100px] ${
                                !isLastItem ? 'border-r border-gray-300' : ''
                              }`}
                            >
                              {item.name}
                            </th>
                          )
                        }
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(alternativesScores).sort((a, b) => {
                      const rowNoA = extractRowNoFromKey(a) || 0
                      const rowNoB = extractRowNoFromKey(b) || 0
                      return rowNoA - rowNoB
                     }).map((alt) => {
                       const rowNo = extractRowNoFromKey(alt) || ''
                       const computedValues = showComputedResults ? computedResults[alt] || {} : {}
                       
                       return (
                         <tr key={alt}>
                           <td className="px-3 py-3 border-b border-r font-medium text-gray-600 w-[80px]">{rowNo}</td>
                           <td className="px-3 py-3 border-b border-r font-medium w-[150px] text-sm">{alt}</td>
                           
                           {/* Leaf input columns and computed columns interleaved */}
                           {orderedGroupsWithComputed.map((item, itemIndex) => {
                             if (item.type === 'group') {
                               const group = item.group
                               const token = extractGroupToken(group.name)
                               const isLastDevGroup = development.indexOf(group) === development.length - 1
                               const isLastOpGroup = operation.indexOf(group) === operation.length - 1
                               
                               // Check if next item is a computed column that should be rendered after this group
                               // Note: 'a' comes after all development groups, 'V' comes after all operation groups
                               const nextItem = itemIndex < orderedGroupsWithComputed.length - 1 ? orderedGroupsWithComputed[itemIndex + 1] : null
                               const hasComputedAfter = nextItem && nextItem.type === 'computed' && (
                                 (token === 'D' && nextItem.name === 'D') ||
                                 (token === 'P' && nextItem.name === 'P') ||
                                 (token === 'C' && nextItem.name === 'C') ||
                                 (token === 'O' && nextItem.name === 'O') ||
                                 (token === 'M' && nextItem.name === 'M') ||
                                 (token === 'F(t)' && nextItem.name === 'F(t)')
                               )
                               // Check if next item is phase-level computed column (a or V)
                               // 'a' comes after all development groups, 'V' comes after all operation groups
                               const hasPhaseLevelComputedAfter = nextItem && nextItem.type === 'computed' && (
                                 (isLastDevGroup && nextItem.name === 'a') ||
                                 (isLastOpGroup && nextItem.name === 'V')
                               )
                               
                               return group.columns.map((col, colIndex) => {
                                 const isLastInGroup = colIndex === group.columns.length - 1
                                 // For phase-level computed columns (a, V), they come after all groups in their phase
                                 // So we don't add border after the last column of the last group in each phase
                                 const isLastItem = itemIndex === orderedGroupsWithComputed.length - 1 && !hasComputedAfter && !hasPhaseLevelComputedAfter
                                 // Only add border if:
                                 // 1. Not the last column in group, OR
                                 // 2. Has group-level computed column after (D, P, C, O, M, F(t)), OR
                                 // 3. Not the last item overall
                                 // Note: We don't add border for phase-level computed columns (a, V) because they're rendered separately
                                 const hasRightBorder = !isLastInGroup || hasComputedAfter || (!hasPhaseLevelComputedAfter && !isLastItem)
                                 return (
                                   <td 
                                     key={`${group.name}__${col}`}
                                     className={`px-3 py-3 border-b w-[120px] ${
                                       hasRightBorder ? 'border-r border-gray-300' : ''
                                     }`}
                                   >
                                     <input
                                       type="number"
                                       step="0.1"
                                       value={alternativesScores[alt][col] || ''}
                                       onChange={(e) => handleScoreChange(alt, col, e.target.value)}
                                       className="w-full min-w-[70px] min-h-[35px] px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                     />
                                   </td>
                                 )
                               })
                             } else {
                               // Computed column cell - render it here since it's already in orderedGroupsWithComputed
                               const isLastItem = itemIndex === orderedGroupsWithComputed.length - 1
                               return (
                                 <td 
                                   key={`computed_${item.name}_${alt}`}
                                   className={`px-3 py-3 border-b bg-gray-50 font-semibold text-center w-[100px] ${
                                     !isLastItem ? 'border-r border-gray-300' : ''
                                   }`}
                                 >
                                   {computedValues[item.name] !== undefined 
                                     ? computedValues[item.name].toFixed(3)
                                     : '-'
                                   }
                                 </td>
                               )
                             }
                           })}
                         </tr>
                       )
                     })}
                  </tbody>
                </table>
              )
            })()}
          </div>
        </div>

        <button
          onClick={handleAHP}
          disabled={loading}
          className="flex items-center space-x-2 px-6 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span>Calculating...</span>
            </>
          ) : (
            <>
              <BarChart3 className="w-5 h-5" />
              <span>Calculate Ranking</span>
            </>
          )}
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
                  setNewGroup('')
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-600 mb-4">Enter a name for the new ranking criteria column:</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Column Name</label>
                <input
                  type="text"
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddColumn()
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Column name (e.g., Cost, Quality, Safety)"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Group (Optional)</label>
                <input
                  type="text"
                  value={newGroup}
                  onChange={(e) => setNewGroup(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddColumn()
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Group name (e.g., Economic, Technical, Safety)"
                />
                <p className="text-xs text-gray-500 mt-1">Columns will be grouped under this name in the table header</p>
              </div>
            </div>
            <div className="flex space-x-2 mt-6">
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
                  setNewGroup('')
                }}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Group Modal */}
      {showAddGroupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Add Preset Group</h3>
              <button
                onClick={() => {
                  setShowAddGroupModal(false)
                  setSelectedPresetIndex(null)
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-600 mb-4">Select a preset group to add with all its columns:</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Preset Group</label>
                <select
                  value={selectedPresetIndex !== null ? selectedPresetIndex : ''}
                  onChange={(e) => setSelectedPresetIndex(e.target.value !== '' ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select a preset group --</option>
                  {RANKING_GROUP_PRESETS.map((preset, index) => (
                    <option key={index} value={index}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              </div>
              {selectedPresetIndex !== null && RANKING_GROUP_PRESETS[selectedPresetIndex] && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Columns Preview</label>
                  <div className="bg-gray-50 border border-gray-200 rounded p-3 max-h-40 overflow-y-auto">
                    <ul className="list-disc list-inside space-y-1">
                      {RANKING_GROUP_PRESETS[selectedPresetIndex].columns.map((col, idx) => (
                        <li key={idx} className="text-sm text-gray-700">{col}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
            <div className="flex space-x-2 mt-6">
              <button
                onClick={() => {
                  if (selectedPresetIndex !== null) {
                    handleAddGroupPreset(RANKING_GROUP_PRESETS[selectedPresetIndex])
                  } else {
                    setMessage({ type: 'error', text: 'Please select a preset group' })
                    setTimeout(() => setMessage({ type: '', text: '' }), 3000)
                  }
                }}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Confirm
              </button>
              <button
                onClick={() => {
                  setShowAddGroupModal(false)
                  setSelectedPresetIndex(null)
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

