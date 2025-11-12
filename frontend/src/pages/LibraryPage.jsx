import React, { useState, useEffect } from 'react'
import { libraryAPI } from '../utils/api'
import { Plus, Edit, Trash2, Save } from 'lucide-react'

function LibraryPage() {
  const [library, setLibrary] = useState({ headers: [] })
  const [loading, setLoading] = useState(false)
  const [editingIndex, setEditingIndex] = useState(null)
  const [editingHeader, setEditingHeader] = useState({ name: '', options: [] })
  const [editingOption, setEditingOption] = useState('')
  const [newHeader, setNewHeader] = useState({ name: '', options: [] })
  const [newOption, setNewOption] = useState('')
  const [message, setMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    loadLibrary()
    
    // Listen for library updates
    const handleLibraryUpdate = () => {
      loadLibrary()
    }
    
    // Listen for library open events from FilePage
    const handleLibraryOpen = async (e) => {
      const libraryData = e.detail
      if (libraryData && libraryData.headers) {
        setLibrary(libraryData)
        // Save to backend
        try {
          await libraryAPI.save(libraryData)
        } catch (error) {
          console.error('Error saving library:', error)
        }
      }
    }
    
    window.addEventListener('library-updated', handleLibraryUpdate)
    window.addEventListener('library-open', handleLibraryOpen)
    
    return () => {
      window.removeEventListener('library-updated', handleLibraryUpdate)
      window.removeEventListener('library-open', handleLibraryOpen)
    }
  }, [])

  const loadLibrary = async () => {
    try {
      const response = await libraryAPI.get()
      if (response.data.success) {
        setLibrary(response.data.data)
      }
    } catch (error) {
      console.error('Error loading library:', error)
    }
  }

  const handleAddHeader = async () => {
    if (!newHeader.name.trim()) {
      setMessage({ type: 'error', text: 'Header name is required' })
      return
    }

    setLoading(true)
    try {
      const response = await libraryAPI.addHeader(newHeader.name, newHeader.options)
      if (response.data.success) {
        setLibrary(response.data.data)
        setNewHeader({ name: '', options: [] })
        setMessage({ type: 'success', text: 'Header added successfully' })
        // Emit event to notify FilePage
        window.dispatchEvent(new CustomEvent('library-updated'))
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to add header' })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateHeader = async (oldName, newName, options) => {
    setLoading(true)
    try {
      const response = await libraryAPI.updateHeader(oldName, newName, options)
      if (response.data.success) {
        setLibrary(response.data.data)
        setEditingIndex(null)
        setEditingHeader({ name: '', options: [] })
        setEditingOption('')
        setMessage({ type: 'success', text: 'Header updated successfully' })
        // Emit event to notify FilePage
        window.dispatchEvent(new CustomEvent('library-updated'))
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to update header' })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteHeader = async (name) => {
    if (!confirm(`Are you sure you want to delete header "${name}"?`)) return

    setLoading(true)
    try {
      const response = await libraryAPI.deleteHeader(name)
      if (response.data.success) {
        setLibrary(response.data.data)
        setMessage({ type: 'success', text: 'Header deleted successfully' })
        // Emit event to notify FilePage
        window.dispatchEvent(new CustomEvent('library-updated'))
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to delete header' })
    } finally {
      setLoading(false)
    }
  }

  const addOptionToNewHeader = () => {
    if (newOption.trim()) {
      setNewHeader({
        ...newHeader,
        options: [...newHeader.options, newOption.trim()]
      })
      setNewOption('')
    }
  }

  const removeOptionFromNewHeader = (index) => {
    setNewHeader({
      ...newHeader,
      options: newHeader.options.filter((_, i) => i !== index)
    })
  }

  const handleStartEdit = (index) => {
    const header = library.headers[index]
    setEditingIndex(index)
    setEditingHeader({
      name: header.name,
      options: [...header.options]
    })
    setEditingOption('')
  }

  const handleCancelEdit = () => {
    setEditingIndex(null)
    setEditingHeader({ name: '', options: [] })
    setEditingOption('')
  }

  const addOptionToEditingHeader = () => {
    if (editingOption.trim()) {
      setEditingHeader({
        ...editingHeader,
        options: [...editingHeader.options, editingOption.trim()]
      })
      setEditingOption('')
    }
  }

  const removeOptionFromEditingHeader = (index) => {
    setEditingHeader({
      ...editingHeader,
      options: editingHeader.options.filter((_, i) => i !== index)
    })
  }

  const handleSaveEdit = async (index) => {
    const oldHeader = library.headers[index]
    if (!editingHeader.name.trim()) {
      setMessage({ type: 'error', text: 'Header name is required' })
      return
    }
    
    // Ensure we have the latest editingHeader state
    console.log('Saving header:', {
      oldName: oldHeader.name,
      newName: editingHeader.name,
      options: editingHeader.options
    })
    
    setLoading(true)
    try {
      const response = await libraryAPI.updateHeader(
        oldHeader.name, 
        editingHeader.name, 
        editingHeader.options || []
      )
      if (response.data.success) {
        setLibrary(response.data.data)
        setEditingIndex(null)
        setEditingHeader({ name: '', options: [] })
        setEditingOption('')
        setMessage({ type: 'success', text: 'Header updated successfully' })
        // Emit event to notify FilePage
        window.dispatchEvent(new CustomEvent('library-updated'))
      } else {
        setMessage({ type: 'error', text: response.data.error || 'Failed to update header' })
      }
    } catch (error) {
      console.error('Error updating header:', error)
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to update header' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Library Management</h2>
        
        {message.text && (
          <div className={`mb-4 p-3 rounded ${
            message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        {/* Add New Header */}
        <div className="mb-8 p-4 border border-gray-300 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Add New Header</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Header Name
              </label>
              <input
                type="text"
                value={newHeader.name}
                onChange={(e) => setNewHeader({ ...newHeader, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Deviation"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Options
              </label>
              <div className="flex space-x-2 mb-2">
                <input
                  type="text"
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addOptionToNewHeader()}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter option and press Enter"
                />
                <button
                  onClick={addOptionToNewHeader}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {newHeader.options.map((opt, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                  >
                    {opt}
                    <button
                      onClick={() => removeOptionFromNewHeader(index)}
                      className="ml-2 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={handleAddHeader}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              <Plus className="w-5 h-5" />
              <span>Add Header</span>
            </button>
          </div>
        </div>

        {/* Existing Headers */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Existing Headers</h3>
          <div className="space-y-4">
            {library.headers.length === 0 ? (
              <p className="text-gray-500">No headers defined yet</p>
            ) : (
              library.headers.map((header, index) => (
                <div key={index} className="p-4 border border-gray-300 rounded-lg">
                  {editingIndex === index ? (
                    // Edit Mode
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Header Name
                        </label>
                        <input
                          type="text"
                          value={editingHeader.name}
                          onChange={(e) => setEditingHeader({ ...editingHeader, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Header name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Options
                        </label>
                        <div className="flex space-x-2 mb-2">
                          <input
                            type="text"
                            value={editingOption}
                            onChange={(e) => setEditingOption(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && addOptionToEditingHeader()}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter option and press Enter"
                          />
                          <button
                            onClick={addOptionToEditingHeader}
                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                          >
                            Add
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {editingHeader.options.map((opt, optIndex) => (
                            <span
                              key={optIndex}
                              className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                            >
                              {opt}
                              <button
                                onClick={() => removeOptionFromEditingHeader(optIndex)}
                                className="ml-2 text-blue-600 hover:text-blue-800"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleSaveEdit(index)}
                          disabled={loading}
                          className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                        >
                          <Save className="w-5 h-5" />
                          <span>Save</span>
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          disabled={loading}
                          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-lg">{header.name}</h4>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleStartEdit(index)}
                            className="p-2 text-blue-500 hover:bg-blue-50 rounded"
                            title="Edit Header"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteHeader(header.name)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded"
                            title="Delete Header"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {header.options.map((opt, optIndex) => (
                          <span
                            key={optIndex}
                            className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                          >
                            {opt}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default LibraryPage

