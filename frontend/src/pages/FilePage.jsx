import React, { useState, useEffect } from 'react'
import { fileAPI, projectAPI } from '../utils/api'
import { Save, FolderOpen, FilePlus, Download } from 'lucide-react'

function FilePage() {
  const [files, setFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState('')
  const [fileType, setFileType] = useState('json')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    loadFiles()
  }, [])

  const loadFiles = async () => {
    try {
      const response = await fileAPI.list()
      if (response.data.success) {
        setFiles(response.data.files)
      }
    } catch (error) {
      console.error('Error loading files:', error)
    }
  }

  const handleNew = async () => {
    setLoading(true)
    try {
      const response = await fileAPI.new()
      if (response.data.success) {
        setMessage({ type: 'success', text: 'New project created' })
        // Emit event or use context to update project data
        window.dispatchEvent(new CustomEvent('project-new', { detail: response.data.data }))
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to create new project' })
    } finally {
      setLoading(false)
    }
  }

  const handleOpen = async () => {
    if (!selectedFile) {
      setMessage({ type: 'error', text: 'Please select a file' })
      return
    }
    setLoading(true)
    try {
      const response = await fileAPI.open(selectedFile, fileType)
      if (response.data.success) {
        setMessage({ type: 'success', text: 'File opened successfully' })
        window.dispatchEvent(new CustomEvent('project-open', { detail: response.data.data }))
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to open file' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    // Get current project data from API
    try {
      const projResponse = await projectAPI.get()
      const projectData = projResponse.data.success ? projResponse.data.data : { rows: [], columns: [] }
      
      if (!selectedFile && files.length === 0) {
        setMessage({ type: 'error', text: 'Please use Save As to specify filename' })
        return
      }
      
      const filename = selectedFile || 'project.json'
      setLoading(true)
      const response = await fileAPI.save(projectData, filename, fileType)
      if (response.data.success) {
        setMessage({ type: 'success', text: 'File saved successfully' })
        loadFiles()
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to save file' })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveAs = async () => {
    const filename = prompt('Enter filename (without extension):')
    if (!filename) return
    
    // Get current project data from API
    try {
      const projResponse = await projectAPI.get()
      const projectData = projResponse.data.success ? projResponse.data.data : { rows: [], columns: [] }
      
      const fullFilename = `${filename}.${fileType}`
      
      setLoading(true)
      const response = await fileAPI.saveAs(projectData, fullFilename, fileType)
      if (response.data.success) {
        setMessage({ type: 'success', text: 'File saved successfully' })
        setSelectedFile(fullFilename)
        loadFiles()
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to save file' })
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
              onClick={handleNew}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              <FilePlus className="w-5 h-5" />
              <span>New</span>
            </button>

            <button
              onClick={handleOpen}
              disabled={loading || !selectedFile}
              className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              <FolderOpen className="w-5 h-5" />
              <span>Open</span>
            </button>

            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              <span>Save</span>
            </button>

            <button
              onClick={handleSaveAs}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              <span>Save As</span>
            </button>
          </div>

          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">File Type:</label>
            <select
              value={fileType}
              onChange={(e) => setFileType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
              <option value="xlsx">Excel</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Available Files</h3>
        <div className="space-y-2">
          {files.length === 0 ? (
            <p className="text-gray-500">No files found</p>
          ) : (
            files.map((file, index) => (
              <div
                key={index}
                className={`p-3 border rounded cursor-pointer hover:bg-gray-50 ${
                  selectedFile === file.name ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                }`}
                onClick={() => setSelectedFile(file.name)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{file.name}</span>
                  <span className="text-sm text-gray-500">
                    {(file.size / 1024).toFixed(2)} KB
                  </span>
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

