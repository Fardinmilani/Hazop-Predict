import React, { useState, useEffect, useRef } from 'react'
import { fileAPI, projectAPI, libraryAPI, rankingAPI } from '../utils/api'
import { Save, FolderOpen, FilePlus, X } from 'lucide-react'

const getSafeName = (file) => (file?.name || '').toLowerCase()
const getSafeType = (file) => (file?.type || '').toLowerCase()
const isProjectFile = (file) => getSafeType(file) === 'project' || getSafeName(file) === 'project.xlsx'
const isLibraryFile = (file) => getSafeType(file) === 'library' || getSafeName(file) === 'library.json'
const getFileKey = (file) => {
  if (isProjectFile(file)) return 'project'
  if (isLibraryFile(file)) return 'library'
  return getSafeName(file)
}

function FilePage() {
  const [activeFiles, setActiveFiles] = useState([]) // Track currently active/opened files
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [saveLoading, setSaveLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const fileInputRef = useRef(null)

  const normalizeFileEntry = (file) => {
    if (!file) return file
    if (isProjectFile(file)) {
      return { ...file, type: 'project' }
    }
    if (isLibraryFile(file)) {
      return { ...file, type: 'library' }
    }
    const safeType = getSafeType(file)
    if (safeType && safeType !== file.type) {
      return { ...file, type: safeType }
    }
    return file
  }

  const normalizeStoredFiles = (files) => {
    if (!Array.isArray(files)) return []
    let mutated = false
    const normalized = files.map((file) => {
      const updated = normalizeFileEntry(file)
      if (updated !== file) {
        mutated = true
      }
      return updated
    })
    if (mutated) {
      localStorage.setItem('activeFiles', JSON.stringify(normalized))
    }
    return normalized
  }

  const getStoredActiveFiles = () => {
    try {
      const stored = localStorage.getItem('activeFiles')
      const parsed = stored ? JSON.parse(stored) : []
      return normalizeStoredFiles(parsed)
    } catch (error) {
      console.error('Failed to parse stored active files:', error)
      localStorage.removeItem('activeFiles')
      return []
    }
  }
  
  // Modals state
  const [showNewModal, setShowNewModal] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)

  useEffect(() => {
    // Load active files from localStorage
    const savedFiles = getStoredActiveFiles()
    
    // Check for existing backend files and add them if they have data
    const loadFiles = async () => {
      setInitialLoading(true)
      try {
        await checkBackendFiles([...savedFiles])
      } finally {
        setInitialLoading(false)
      }
    }
    loadFiles()
    
    // Listen for data updates from other pages
    const handleDataUpdate = () => {
      // Refresh active files when data is updated
      const currentFiles = getStoredActiveFiles()
      checkBackendFiles([...currentFiles])
    }
    
    // Listen for file opened events to refresh the list
    const handleFileOpened = () => {
      // Refresh active files when a file is opened
      setTimeout(() => {
        const currentFiles = getStoredActiveFiles()
        checkBackendFiles([...currentFiles])
      }, 500)
    }
    
    // Listen for custom events from Project, Library, and Ranking pages
    window.addEventListener('project-updated', handleDataUpdate)
    window.addEventListener('library-updated', handleDataUpdate)
    window.addEventListener('ranking-updated', handleDataUpdate)
    window.addEventListener('file-opened', handleFileOpened)
    
    return () => {
      window.removeEventListener('project-updated', handleDataUpdate)
      window.removeEventListener('library-updated', handleDataUpdate)
      window.removeEventListener('ranking-updated', handleDataUpdate)
      window.removeEventListener('file-opened', handleFileOpened)
    }
  }, [])

  const checkBackendFiles = async (existingFiles) => {
    try {
      let files = existingFiles.map((file) => normalizeFileEntry(file))
      // Check if project.xlsx exists and has data
      // Also check if ranking data exists (since ranking is now part of project.xlsx)
      const projResponse = await projectAPI.get()
      const rankResponse = await rankingAPI.get()
      
      let hasProjectData = false
      let hasRankingData = false
      
      if (projResponse.data.success) {
        const projectData = projResponse.data.data
        // Check if project has data (rows or columns)
        hasProjectData = (projectData.rows && projectData.rows.length > 0) || 
                        (projectData.columns && projectData.columns.length > 0)
      }
      
      if (rankResponse.data && rankResponse.data.success) {
        const rankingData = rankResponse.data.data || {}
        // Check if ranking has any data
        hasRankingData = (rankingData.criteriaWeights && Object.keys(rankingData.criteriaWeights).length > 0) ||
                        (rankingData.alternativesScores && Object.keys(rankingData.alternativesScores).length > 0) ||
                        (rankingData.rankingResult !== null && rankingData.rankingResult !== undefined) ||
                        (rankingData.columns && rankingData.columns.length > 0)
      }
      
      // Show project.xlsx if it has project data OR ranking data
      if (hasProjectData || hasRankingData) {
        const projectFile = normalizeFileEntry({
          name: 'project.xlsx',
          type: 'project',
          openedAt: new Date().toISOString()
        })
        const existingIndex = files.findIndex(isProjectFile)
        if (existingIndex === -1) {
          files.push(projectFile)
        } else {
          // Update existing file
          files[existingIndex] = {
            ...files[existingIndex],
            ...projectFile
          }
        }
      } else {
        // Remove from list if no data
        files = files.filter(f => !isProjectFile(f))
      }

      // Check if library.json exists and has data
      const libResponse = await libraryAPI.get()
      if (libResponse.data.success) {
        const libraryData = libResponse.data.data
        if (libraryData.headers && libraryData.headers.length > 0) {
          const libraryFile = normalizeFileEntry({
            name: 'library.json',
            type: 'library',
            openedAt: new Date().toISOString()
          })
          const existingIndex = files.findIndex(isLibraryFile)
          if (existingIndex === -1) {
            files.push(libraryFile)
          } else {
            // Update existing file
            files[existingIndex] = {
              ...files[existingIndex],
              ...libraryFile
            }
          }
        } else {
          // Remove from list if no data
          files = files.filter(f => !isLibraryFile(f))
        }
      } else {
        // Remove from list if error
        files = files.filter(f => !isLibraryFile(f))
      }

      // Ranking data is now part of project.xlsx, no separate file needed

      // Update active files
      updateActiveFiles(files)
    } catch (error) {
      console.error('Error checking backend files:', error)
      // If error, just use saved files
      if (existingFiles.length > 0) {
        updateActiveFiles(existingFiles)
      }
    }
  }

  const updateActiveFiles = (files) => {
    // Remove duplicates based on name
    const normalizedFiles = files.map((file) => normalizeFileEntry(file))
    const uniqueFiles = normalizedFiles.filter((file, index, self) => 
      index === self.findIndex(f => getFileKey(f) === getFileKey(file))
    )
    setActiveFiles(uniqueFiles)
    localStorage.setItem('activeFiles', JSON.stringify(uniqueFiles))
  }

  const addActiveFile = (filename, type) => {
    const normalizedType = (type || '').toLowerCase()
    const newFile = normalizeFileEntry({
      name: filename,
      type: normalizedType || undefined, // 'project', 'library', etc.
      openedAt: new Date().toISOString()
    })
    const updated = [...activeFiles, newFile]
    updateActiveFiles(updated)
  }

  const handleNew = async (type) => {
    setLoading(true)
    setShowNewModal(false)
    setMessage({ type: '', text: '' })
    
    try {
      if (type === 'project') {
        const response = await fileAPI.new()
        if (response.data.success) {
          setMessage({ type: 'success', text: 'New project created successfully' })
          window.dispatchEvent(new CustomEvent('project-new', { detail: response.data.data }))
          addActiveFile('project.xlsx', 'project')
        } else {
          setMessage({ type: 'error', text: 'Failed to create new project' })
        }
      } else if (type === 'library') {
        // Create new library
        const response = await libraryAPI.save({ headers: [] })
        if (response.data.success) {
          setMessage({ type: 'success', text: 'New library created successfully' })
          addActiveFile('New Library', 'library')
        } else {
          setMessage({ type: 'error', text: 'Failed to create new library' })
        }
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to create new item' })
    } finally {
      setLoading(false)
    }
  }

  const handleOpen = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleFileSelect = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('http://localhost:5000/api/file/open', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()
      
      if (result.success) {
        setMessage({ type: 'success', text: 'File opened successfully' })
        
        // Determine file type based on content or extension
        const fileExt = file.name.split('.').pop().toLowerCase()
        const fileName = file.name.toLowerCase()
        const hasProjectData = result.data.rows && result.data.columns
        const hasRankingData = result.data.criteriaWeights || result.data.alternativesScores || result.data.rankingResult
        const hasLibraryData = result.data.headers && !hasProjectData
        
        let fileType = 'project'
        if (fileExt === 'json' || hasLibraryData) {
          fileType = 'library'
        } else if (fileName.includes('ranking') && !hasProjectData && hasRankingData) {
          // Only treat as ranking if it doesn't have project data
          // If it has both project and ranking data, treat as project
          fileType = 'ranking'
        }
        
        // If it's a project file, save it to backend and dispatch event
        if (fileType === 'project') {
          const projectData = result.data
          // Check if it has both project and ranking data
          const hasProjectData = projectData.rows && projectData.columns
          const hasRankingData = projectData.criteriaWeights || projectData.alternativesScores || projectData.rankingResult
          
          // Save to backend first
          try {
            // Save project data if available
            if (hasProjectData) {
              await projectAPI.update(projectData.rows || [], projectData.columns || [])
              // Dispatch event to load in ProjectPage
              window.dispatchEvent(new CustomEvent('project-open', { detail: {
                rows: projectData.rows,
                columns: projectData.columns
              } }))
            }
            
            // Save ranking data if available
            if (hasRankingData) {
              await rankingAPI.update(
                projectData.criteriaWeights || {},
                projectData.alternativesScores || {},
                projectData.rankingResult || null,
                projectData.rankingColumns || projectData.columns || [],
                projectData.groups || []
              )
              // Dispatch event to load in RankingPage
              window.dispatchEvent(new CustomEvent('ranking-open', { detail: {
                criteriaWeights: projectData.criteriaWeights || {},
                alternativesScores: projectData.alternativesScores || {},
                rankingResult: projectData.rankingResult || null,
                columns: projectData.rankingColumns || projectData.columns || [],
                groups: projectData.groups || []
              } }))
            }
            
            // Add to active files
            addActiveFile(file.name, fileType)
            // Notify that file was opened
            window.dispatchEvent(new CustomEvent('file-opened'))
          } catch (error) {
            console.error('Error saving project:', error)
            setMessage({ type: 'error', text: 'Failed to save project data' })
          }
        } else if (fileType === 'ranking') {
          // For ranking files, save to backend and dispatch event
          const rankingData = result.data
          // Save to backend first
          try {
            await rankingAPI.update(
              rankingData.criteriaWeights || {},
              rankingData.alternativesScores || {},
              rankingData.rankingResult || null,
              rankingData.columns || [],
              rankingData.groups || []
            )
            // Then dispatch event to load in RankingPage
            window.dispatchEvent(new CustomEvent('ranking-open', { detail: rankingData }))
            // Add to active files
            addActiveFile(file.name, fileType)
            // Notify that file was opened
            window.dispatchEvent(new CustomEvent('file-opened'))
          } catch (error) {
            console.error('Error saving ranking:', error)
            setMessage({ type: 'error', text: 'Failed to save ranking data' })
          }
        } else {
          // For library files, save to backend and dispatch event
          const libraryData = result.data
          // Save to backend first
          try {
            await libraryAPI.save(libraryData)
            // Then dispatch event to load in LibraryPage
            window.dispatchEvent(new CustomEvent('library-open', { detail: libraryData }))
            // Add to active files
            addActiveFile(file.name, fileType)
            // Notify that file was opened
            window.dispatchEvent(new CustomEvent('file-opened'))
          } catch (error) {
            console.error('Error saving library:', error)
            setMessage({ type: 'error', text: 'Failed to save library data' })
          }
        }
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to open file' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to open file' })
      console.error('Error opening file:', error)
    } finally {
      setLoading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleSave = async (dataTypes) => {
    setShowSaveModal(false)
    
    if (!dataTypes || dataTypes.length === 0) {
      setMessage({ type: 'error', text: 'Please select at least one data type to save' })
      return
    }

    setSaveLoading(true)
    setMessage({ type: '', text: '' })
    try {
      // Collect data based on selected types
      const dataToSave = {}
      
      if (dataTypes.includes('project')) {
        const projResponse = await projectAPI.get()
        if (projResponse.data.success) {
          dataToSave.project = projResponse.data.data
        }
      }
      
      if (dataTypes.includes('library')) {
        const libResponse = await libraryAPI.get()
        if (libResponse.data.success) {
          dataToSave.library = libResponse.data.data
        }
      }
      
      if (dataTypes.includes('ranking')) {
        const rankResponse = await rankingAPI.get()
        if (rankResponse.data.success) {
          dataToSave.ranking = rankResponse.data.data
        }
      }

      // Handle saving each data type separately
      for (const dataType of dataTypes) {
        if (dataType === 'library') {
          // Save library as JSON
          if ('showSaveFilePicker' in window) {
            try {
              const fileHandle = await window.showSaveFilePicker({
                suggestedName: 'library.json',
                types: [{
                  description: 'JSON files',
                  accept: { 'application/json': ['.json'] }
                }]
              })

              // Save library as JSON
              const response = await fetch('http://localhost:5000/api/file/save-json', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                  data: dataToSave.library,
                  filename: 'library.json'
                })
              })

              if (response.ok) {
                const blob = await response.blob()
                const writable = await fileHandle.createWritable()
                await writable.write(blob)
                await writable.close()
                
                setMessage({ type: 'success', text: 'Library saved successfully' })
                // Don't add to active files - only when opened
              } else {
                const error = await response.json()
                setMessage({ type: 'error', text: error.error || 'Failed to save library' })
              }
            } catch (err) {
              if (err.name !== 'AbortError') {
                setMessage({ type: 'error', text: 'Failed to save library' })
              }
            }
          } else {
            // Fallback: use download
            const response = await fetch('http://localhost:5000/api/file/save-json', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ 
                data: dataToSave.library,
                filename: 'library.json'
              })
            })

            if (response.ok) {
              const blob = await response.blob()
              const url = window.URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = 'library.json'
              document.body.appendChild(a)
              a.click()
              window.URL.revokeObjectURL(url)
              document.body.removeChild(a)
              
              setMessage({ type: 'success', text: 'Library saved successfully' })
              // Don't add to active files - only when opened
            }
          }
        } else if (dataType === 'project') {
          // Save project as Excel - include ranking data if available
          // Fetch ranking data to include in the save
          let rankingData = null
          try {
            const rankResponse = await rankingAPI.get()
            if (rankResponse.data.success && rankResponse.data.data) {
              const rankData = rankResponse.data.data
              // Only include if there's actual ranking data
              if ((rankData.criteriaWeights && Object.keys(rankData.criteriaWeights).length > 0) ||
                  (rankData.alternativesScores && Object.keys(rankData.alternativesScores).length > 0) ||
                  rankData.rankingResult) {
                rankingData = rankData
              }
            }
          } catch (err) {
            console.error('Error fetching ranking data:', err)
          }

          // Combine project and ranking data
          // Preserve project columns in 'columns' and ranking columns in 'rankingColumns'
          const combinedData = {
            ...dataToSave.project,
            ...(rankingData && {
              criteriaWeights: rankingData.criteriaWeights || {},
              alternativesScores: rankingData.alternativesScores || {},
              rankingResult: rankingData.rankingResult || null,
              rankingColumns: rankingData.columns || [], // Store ranking columns separately
              groups: rankingData.groups || [] // Store groups separately
            })
          }

          if ('showSaveFilePicker' in window) {
            try {
              const fileHandle = await window.showSaveFilePicker({
                suggestedName: 'project.xlsx',
                types: [{
                  description: 'Excel files',
                  accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
                }]
              })

              const saveData = {
                data: combinedData,
                filename: fileHandle.name
              }

              const response = await fetch('http://localhost:5000/api/file/save', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(saveData)
              })

              if (response.ok) {
                const blob = await response.blob()
                const writable = await fileHandle.createWritable()
                await writable.write(blob)
                await writable.close()
                
                setMessage({ type: 'success', text: 'Project saved successfully' })
                // Don't add to active files - only when opened
              } else {
                const error = await response.json()
                setMessage({ type: 'error', text: error.error || 'Failed to save project' })
              }
            } catch (err) {
              if (err.name !== 'AbortError') {
                setMessage({ type: 'error', text: 'Failed to save project' })
              }
            }
          } else {
            // Fallback: use download
            const filename = prompt('Enter filename (without extension):', 'project')
            if (!filename) {
              setSaveLoading(false)
              return
            }

            // Fetch ranking data to include in the save
            let rankingData = null
            try {
              const rankResponse = await rankingAPI.get()
              if (rankResponse.data.success && rankResponse.data.data) {
                const rankData = rankResponse.data.data
                // Only include if there's actual ranking data
                if ((rankData.criteriaWeights && Object.keys(rankData.criteriaWeights).length > 0) ||
                    (rankData.alternativesScores && Object.keys(rankData.alternativesScores).length > 0) ||
                    rankData.rankingResult) {
                  rankingData = rankData
                }
              }
            } catch (err) {
              console.error('Error fetching ranking data:', err)
            }

            // Combine project and ranking data
            // Preserve project columns in 'columns' and ranking columns in 'rankingColumns'
            const combinedData = {
              ...dataToSave.project,
              ...(rankingData && {
                criteriaWeights: rankingData.criteriaWeights || {},
                alternativesScores: rankingData.alternativesScores || {},
                rankingResult: rankingData.rankingResult || null,
                rankingColumns: rankingData.columns || [], // Store ranking columns separately
                groups: rankingData.groups || [] // Store groups separately
              })
            }

            const saveData = {
              data: combinedData,
              filename: filename
            }

            const response = await fetch('http://localhost:5000/api/file/save', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(saveData)
            })

            if (response.ok) {
              const blob = await response.blob()
              const url = window.URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `${filename}.xlsx`
              document.body.appendChild(a)
              a.click()
              window.URL.revokeObjectURL(url)
              document.body.removeChild(a)
              
              setMessage({ type: 'success', text: 'Project saved successfully' })
              // Don't add to active files - only when opened
            } else {
              const error = await response.json()
              setMessage({ type: 'error', text: error.error || 'Failed to save project' })
            }
          }
        } else if (dataType === 'ranking') {
          // Ranking data is now part of project.xlsx, so save as project.xlsx
          if ('showSaveFilePicker' in window) {
            try {
              const fileHandle = await window.showSaveFilePicker({
                suggestedName: 'project.xlsx',
                types: [{
                  description: 'Excel files',
                  accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
                }]
              })

              const saveData = {
                data: dataToSave.ranking,
                filename: fileHandle.name
              }

              const response = await fetch('http://localhost:5000/api/file/save', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(saveData)
              })

              if (response.ok) {
                const blob = await response.blob()
                const writable = await fileHandle.createWritable()
                await writable.write(blob)
                await writable.close()
                
                setMessage({ type: 'success', text: 'Ranking saved successfully' })
                // Don't add to active files - only when opened
              } else {
                const error = await response.json()
                setMessage({ type: 'error', text: error.error || 'Failed to save ranking' })
              }
            } catch (err) {
              if (err.name !== 'AbortError') {
                setMessage({ type: 'error', text: 'Failed to save ranking' })
              }
            }
          } else {
            // Fallback: use download
            const filename = prompt('Enter filename (without extension):', 'project')
            if (!filename) {
              setSaveLoading(false)
              return
            }

            const saveData = {
              data: dataToSave.ranking,
              filename: filename
            }

            const response = await fetch('http://localhost:5000/api/file/save', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(saveData)
            })

            if (response.ok) {
              const blob = await response.blob()
              const url = window.URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `${filename}.xlsx`
              document.body.appendChild(a)
              a.click()
              window.URL.revokeObjectURL(url)
              document.body.removeChild(a)
              
              setMessage({ type: 'success', text: 'Ranking saved successfully' })
              // Don't add to active files - only when opened
            } else {
              const error = await response.json()
              setMessage({ type: 'error', text: error.error || 'Failed to save ranking' })
            }
          }
        }
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save file' })
      console.error('Error saving file:', error)
    } finally {
      setSaveLoading(false)
    }
  }


  const handleRemoveFromList = async (file) => {
    const isProject = isProjectFile(file)
    const isLibrary = isLibraryFile(file)
    const displayType = file.type || (isProject ? 'project' : isLibrary ? 'library' : 'unknown')

    // Show confirmation dialog
    const confirmMessage = `Warning: This file will be permanently deleted from the application.\n\nPlease make sure you have saved a backup copy of this file before proceeding.\n\nFile: ${file.name}\nType: ${displayType}\n\nAre you sure you want to delete this file?`
    
    if (!window.confirm(confirmMessage)) {
      return // User cancelled
    }

    setLoading(true)
    try {
      // Delete from backend based on file type
      if (isProject) {
        // Use dedicated delete endpoint to remove entire project.xlsx file
        await projectAPI.delete()
        setMessage({ type: 'success', text: 'Project file removed and data cleared' })
      } else if (isLibrary) {
        await libraryAPI.save({ headers: [] })
        setMessage({ type: 'success', text: 'Library file removed and data cleared' })
      }
      // Note: Ranking data is now part of project.xlsx, so deleting project will also clear ranking data

      // Remove from active files list
      const updated = activeFiles.filter((f) => {
        if (isProject) return !isProjectFile(f)
        if (isLibrary) return !isLibraryFile(f)
        return getFileKey(f) !== getFileKey(file)
      })
      updateActiveFiles(updated)
      
      // Emit events to clear data in other pages
      if (isProject) {
        window.dispatchEvent(new CustomEvent('project-new', { detail: { rows: [], columns: [] } }))
        // Also trigger project-updated to refresh
        window.dispatchEvent(new CustomEvent('project-updated'))
      } else if (isLibrary) {
        window.dispatchEvent(new CustomEvent('library-updated'))
      }
      // Note: Ranking data is now part of project.xlsx, so project-updated event will handle ranking updates
      
      // Refresh the active files list to remove deleted files
      setTimeout(() => {
        const currentFiles = getStoredActiveFiles()
        checkBackendFiles([...currentFiles])
      }, 500)
    } catch (error) {
      console.error('Error removing file:', error)
      setMessage({ type: 'error', text: 'Failed to remove file: ' + (error.message || 'Unknown error') })
    } finally {
      setLoading(false)
    }
  }

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-600">Loading file information...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">File Operations</h2>
        
        {message.text && (
          <div className={`mb-4 p-3 rounded ${
            message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowNewModal(true)}
              disabled={loading || saveLoading}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              <FilePlus className="w-5 h-5" />
              <span>New</span>
            </button>

            <button
              onClick={handleOpen}
              disabled={loading || saveLoading}
              className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Opening...</span>
                </>
              ) : (
                <>
                  <FolderOpen className="w-5 h-5" />
                  <span>Open</span>
                </>
              )}
            </button>

            <button
              onClick={() => setShowSaveModal(true)}
              disabled={loading || saveLoading}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
            >
              {saveLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Save</span>
                </>
              )}
            </button>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>Note:</strong> Projects are saved as Excel files (.xlsx). 
              You can open Excel, CSV, or JSON files.
            </p>
          </div>
        </div>

        {/* Hidden file input for Open */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.csv,.json"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>

      {/* New Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Create New</h3>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-600 mb-4">What would you like to create?</p>
            <div className="space-y-2">
              <button
                onClick={() => handleNew('project')}
                disabled={loading}
                className="w-full text-left px-4 py-3 border border-gray-300 rounded hover:bg-blue-50 hover:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="font-medium text-gray-800">Project</div>
                <div className="text-xs text-gray-500 mt-1">Create a new HAZOP project workspace</div>
              </button>
              <button
                onClick={() => handleNew('library')}
                disabled={loading}
                className="w-full text-left px-4 py-3 border border-gray-300 rounded hover:bg-blue-50 hover:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="font-medium text-gray-800">Library</div>
                <div className="text-xs text-gray-500 mt-1">Create a new library configuration</div>
              </button>
            </div>
            <button
              onClick={() => setShowNewModal(false)}
              className="mt-4 w-full px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Save Data</h3>
              <button
                onClick={() => setShowSaveModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-600 mb-4">What would you like to save?</p>
            <div className="space-y-2">
              <label className="flex items-center space-x-3 p-3 border border-gray-300 rounded hover:bg-blue-50 cursor-pointer">
                <input
                  type="checkbox"
                  id="save-project"
                  defaultChecked
                  className="rounded"
                />
                <div>
                  <div className="font-medium text-gray-800">Project Data</div>
                  <div className="text-xs text-gray-500">Save current project workspace</div>
                </div>
              </label>
              <label className="flex items-center space-x-3 p-3 border border-gray-300 rounded hover:bg-blue-50 cursor-pointer">
                <input
                  type="checkbox"
                  id="save-library"
                  className="rounded"
                />
                <div>
                  <div className="font-medium text-gray-800">Library</div>
                  <div className="text-xs text-gray-500">Save library configuration</div>
                </div>
              </label>
            </div>
            <div className="mt-4 flex space-x-2">
              <button
                onClick={() => {
                  const selected = []
                  if (document.getElementById('save-project').checked) {
                    selected.push('project')
                  }
                  if (document.getElementById('save-library').checked) {
                    selected.push('library')
                  }
                  handleSave(selected)
                }}
                disabled={saveLoading}
                className="flex-1 px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {saveLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save</span>
                )}
              </button>
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Files List */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Active Files</h3>
        <div className="space-y-2">
          {activeFiles.length === 0 ? (
            <p className="text-gray-500">No active files. Create a new file or open an existing one.</p>
          ) : (
            activeFiles.map((file, index) => (
              <div
                key={index}
                className="p-3 border border-gray-300 rounded hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <span className="font-medium text-gray-800">{file.name}</span>
                    <span className="ml-2 text-xs text-gray-500">
                      ({file.type})
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveFromList(file)}
                    disabled={loading || saveLoading}
                    className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 flex items-center space-x-1"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        <span>Removing...</span>
                      </>
                    ) : (
                      <span>Remove</span>
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default FilePage
