import React, { useState, useEffect, useRef } from 'react'
import { fileAPI, projectAPI, libraryAPI } from '../utils/api'
import { Save, FolderOpen, FilePlus, X } from 'lucide-react'

function FilePage() {
  const [activeFiles, setActiveFiles] = useState([]) // Track currently active/opened files
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const fileInputRef = useRef(null)
  
  // Modals state
  const [showNewModal, setShowNewModal] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)

  useEffect(() => {
    // Load active files from localStorage
    const saved = localStorage.getItem('activeFiles')
    const savedFiles = saved ? JSON.parse(saved) : []
    
    // Check for existing backend files and add them if they have data
    checkBackendFiles(savedFiles)
    
    // Listen for data updates from other pages
    const handleDataUpdate = () => {
      // Refresh active files when data is updated
      const currentFiles = JSON.parse(localStorage.getItem('activeFiles') || '[]')
      checkBackendFiles(currentFiles)
    }
    
    // Listen for file opened events to refresh the list
    const handleFileOpened = () => {
      // Refresh active files when a file is opened
      setTimeout(() => {
        const currentFiles = JSON.parse(localStorage.getItem('activeFiles') || '[]')
        checkBackendFiles(currentFiles)
      }, 500)
    }
    
    // Listen for custom events from Project and Library pages
    window.addEventListener('project-updated', handleDataUpdate)
    window.addEventListener('library-updated', handleDataUpdate)
    window.addEventListener('file-opened', handleFileOpened)
    
    return () => {
      window.removeEventListener('project-updated', handleDataUpdate)
      window.removeEventListener('library-updated', handleDataUpdate)
      window.removeEventListener('file-opened', handleFileOpened)
    }
  }, [])

  const checkBackendFiles = async (existingFiles) => {
    try {
      // Check if project.xlsx exists and has data
      const projResponse = await projectAPI.get()
      if (projResponse.data.success) {
        const projectData = projResponse.data.data
        // Check if project has data (rows or columns)
        if ((projectData.rows && projectData.rows.length > 0) || 
            (projectData.columns && projectData.columns.length > 0)) {
          const projectFile = { name: 'project.xlsx', type: 'project', openedAt: new Date().toISOString() }
          const existingIndex = existingFiles.findIndex(f => f.name === 'project.xlsx')
          if (existingIndex === -1) {
            existingFiles.push(projectFile)
          } else {
            // Update existing file
            existingFiles[existingIndex] = projectFile
          }
        } else {
          // Remove from list if no data
          existingFiles = existingFiles.filter(f => f.name !== 'project.xlsx')
        }
      } else {
        // Remove from list if error
        existingFiles = existingFiles.filter(f => f.name !== 'project.xlsx')
      }

      // Check if library.json exists and has data
      const libResponse = await libraryAPI.get()
      if (libResponse.data.success) {
        const libraryData = libResponse.data.data
        if (libraryData.headers && libraryData.headers.length > 0) {
          const libraryFile = { name: 'library.json', type: 'library', openedAt: new Date().toISOString() }
          const existingIndex = existingFiles.findIndex(f => f.name === 'library.json')
          if (existingIndex === -1) {
            existingFiles.push(libraryFile)
          } else {
            // Update existing file
            existingFiles[existingIndex] = libraryFile
          }
        } else {
          // Remove from list if no data
          existingFiles = existingFiles.filter(f => f.name !== 'library.json')
        }
      } else {
        // Remove from list if error
        existingFiles = existingFiles.filter(f => f.name !== 'library.json')
      }

      // Update active files
      updateActiveFiles(existingFiles)
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
    const uniqueFiles = files.filter((file, index, self) => 
      index === self.findIndex(f => f.name === file.name)
    )
    setActiveFiles(uniqueFiles)
    localStorage.setItem('activeFiles', JSON.stringify(uniqueFiles))
  }

  const addActiveFile = (filename, type) => {
    const newFile = {
      name: filename,
      type: type, // 'project', 'library', etc.
      openedAt: new Date().toISOString()
    }
    const updated = [...activeFiles, newFile]
    updateActiveFiles(updated)
  }

  const handleNew = async (type) => {
    setLoading(true)
    setShowNewModal(false)
    
    try {
      if (type === 'project') {
        const response = await fileAPI.new()
        if (response.data.success) {
          setMessage({ type: 'success', text: 'New project created' })
          window.dispatchEvent(new CustomEvent('project-new', { detail: response.data.data }))
          addActiveFile('New Project', 'project')
        }
      } else if (type === 'library') {
        // Create new library
        const response = await libraryAPI.save({ headers: [] })
        if (response.data.success) {
          setMessage({ type: 'success', text: 'New library created' })
          addActiveFile('New Library', 'library')
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
        let fileType = 'project'
        if (fileExt === 'json' || (result.data.headers && !result.data.rows)) {
          fileType = 'library'
        }
        
        // If it's a project file, save it to backend and dispatch event
        if (fileType === 'project') {
          const projectData = result.data
          // Save to backend first
          try {
            await projectAPI.update(projectData.rows || [], projectData.columns || [])
            // Then dispatch event to load in ProjectPage
            window.dispatchEvent(new CustomEvent('project-open', { detail: projectData }))
            // Add to active files
            addActiveFile(file.name, fileType)
            // Notify that file was opened
            window.dispatchEvent(new CustomEvent('file-opened'))
          } catch (error) {
            console.error('Error saving project:', error)
            setMessage({ type: 'error', text: 'Failed to save project data' })
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

    setLoading(true)
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
          // Save project as Excel
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
                data: dataToSave.project,
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
              setLoading(false)
              return
            }

            const saveData = {
              data: dataToSave.project,
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
        }
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save file' })
      console.error('Error saving file:', error)
    } finally {
      setLoading(false)
    }
  }


  const handleRemoveFromList = async (file) => {
    // Show confirmation dialog
    const confirmMessage = `Warning: This file will be permanently deleted from the application.\n\nPlease make sure you have saved a backup copy of this file before proceeding.\n\nFile: ${file.name}\nType: ${file.type}\n\nAre you sure you want to delete this file?`
    
    if (!window.confirm(confirmMessage)) {
      return // User cancelled
    }

    setLoading(true)
    try {
      // Delete from backend based on file type
      if (file.name === 'project.xlsx' || file.type === 'project') {
        // Clear project data
        await projectAPI.update([], [])
        setMessage({ type: 'success', text: 'Project file removed and data cleared' })
      } else if (file.name === 'library.json' || file.type === 'library') {
        // Clear library data
        await libraryAPI.save({ headers: [] })
        setMessage({ type: 'success', text: 'Library file removed and data cleared' })
      }

      // Remove from active files list
      const updated = activeFiles.filter(f => f.name !== file.name)
      updateActiveFiles(updated)
      
      // Emit events to clear data in other pages
      if (file.type === 'project') {
        window.dispatchEvent(new CustomEvent('project-new', { detail: { rows: [], columns: [] } }))
        // Also trigger project-updated to refresh
        window.dispatchEvent(new CustomEvent('project-updated'))
      } else if (file.type === 'library') {
        window.dispatchEvent(new CustomEvent('library-updated'))
      }
      
      // Refresh the active files list to remove deleted files
      setTimeout(() => {
        const currentFiles = JSON.parse(localStorage.getItem('activeFiles') || '[]')
        checkBackendFiles(currentFiles)
      }, 500)
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to remove file' })
      console.error('Error removing file:', error)
    } finally {
      setLoading(false)
    }
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
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              <FilePlus className="w-5 h-5" />
              <span>New</span>
            </button>

            <button
              onClick={handleOpen}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              <FolderOpen className="w-5 h-5" />
              <span>Open</span>
            </button>

            <button
              onClick={() => setShowSaveModal(true)}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              <span>Save</span>
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
                className="w-full text-left px-4 py-3 border border-gray-300 rounded hover:bg-blue-50 hover:border-blue-500 transition-colors"
              >
                <div className="font-medium text-gray-800">Project</div>
                <div className="text-xs text-gray-500 mt-1">Create a new HAZOP project workspace</div>
              </button>
              <button
                onClick={() => handleNew('library')}
                className="w-full text-left px-4 py-3 border border-gray-300 rounded hover:bg-blue-50 hover:border-blue-500 transition-colors"
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
                className="flex-1 px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
              >
                Save
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
                    disabled={loading}
                    className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                  >
                    Remove
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
