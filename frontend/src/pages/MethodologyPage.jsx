import React, { useState, useEffect } from 'react'
import { methodologyAPI, projectAPI, libraryAPI } from '../utils/api'
import { Play, TrendingUp } from 'lucide-react'

function MethodologyPage() {
  const [projectData, setProjectData] = useState([])
  const [columns, setColumns] = useState([])
  const [selectedFeatures, setSelectedFeatures] = useState([])
  const [selectedTarget, setSelectedTarget] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [predictionInput, setPredictionInput] = useState({})
  const [predictionResult, setPredictionResult] = useState(null)
  const [selectedModel, setSelectedModel] = useState('')
  const [library, setLibrary] = useState({ headers: [] })

  useEffect(() => {
    loadProjectData()
    loadLibrary()
  }, [])

  const loadProjectData = async () => {
    try {
      const projResponse = await projectAPI.get()
      if (projResponse.data.success) {
        const rows = projResponse.data.data.rows || []
        const cols = projResponse.data.data.columns || []
        setProjectData(rows)
        setColumns(cols)
      }
    } catch (error) {
      console.error('Error loading project:', error)
    }
  }

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

  const getOptionsForColumn = (columnName) => {
    if (!library || !library.headers) return []
    const header = library.headers.find(h => h.name === columnName)
    return header ? (header.options || []) : []
  }

  const getColumnType = (columnName) => {
    if (!library || !library.headers) return 'text'
    const header = library.headers.find(h => h.name === columnName)
    if (!header) return 'text'
    // If has options, it's select type
    if (header.options && header.options.length > 0) return 'select'
    // Otherwise use the type field or default to text
    return header.type || 'text'
  }

  const handleTrain = async () => {
    if (selectedFeatures.length === 0 || !selectedTarget) {
      alert('Please select feature columns and target column')
      return
    }

    if (projectData.length < 10) {
      alert('Need at least 10 data points for training')
      return
    }

    setLoading(true)
    try {
      const response = await methodologyAPI.train(
        projectData,
        selectedFeatures,
        selectedTarget
      )
      if (response.data.success) {
        setResults(response.data.results)
        setMessage({ type: 'success', text: 'Models trained successfully' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Training failed' })
    } finally {
      setLoading(false)
    }
  }

  const handlePredict = async () => {
    if (!selectedModel) {
      alert('Please select a trained model')
      return
    }

    setLoading(true)
    try {
      const response = await methodologyAPI.predict(selectedModel, predictionInput)
      if (response.data.success) {
        setPredictionResult(response.data.prediction)
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Prediction failed' })
    } finally {
      setLoading(false)
    }
  }

  const [message, setMessage] = useState({ type: '', text: '' })

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Machine Learning Methodology</h2>

        {message.text && (
          <div className={`mb-4 p-3 rounded ${
            message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        {/* Feature and Target Selection */}
        <div className="mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Feature Columns
            </label>
            <div className="grid grid-cols-4 gap-2">
              {columns.map((col) => (
                <label key={col} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={selectedFeatures.includes(col)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedFeatures([...selectedFeatures, col])
                      } else {
                        setSelectedFeatures(selectedFeatures.filter(c => c !== col))
                      }
                    }}
                    className="rounded"
                  />
                  <span className="text-sm">{col}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Target Column
            </label>
            <select
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select target column...</option>
              {columns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleTrain}
            disabled={loading || selectedFeatures.length === 0 || !selectedTarget}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            <Play className="w-5 h-5" />
            <span>Train Models</span>
          </button>
        </div>

        {/* Results Table */}
        {results && (
          <div className="mt-8">
            <h3 className="text-xl font-bold mb-4">Model Comparison</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Model</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Train R²</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Test R²</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Test MAE</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">CV Score</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Overfitting</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(results).map(([name, result]) => (
                    result.error ? (
                      <tr key={name}>
                        <td className="px-4 py-3 border-b">{name}</td>
                        <td colSpan="5" className="px-4 py-3 border-b text-red-500">{result.error}</td>
                      </tr>
                    ) : (
                      <tr key={name} className="hover:bg-gray-50">
                        <td className="px-4 py-3 border-b font-medium">{name}</td>
                        <td className="px-4 py-3 border-b">{result.train_r2.toFixed(4)}</td>
                        <td className="px-4 py-3 border-b">{result.test_r2.toFixed(4)}</td>
                        <td className="px-4 py-3 border-b">{result.test_mae.toFixed(4)}</td>
                        <td className="px-4 py-3 border-b">{result.cv_mean.toFixed(4)} ± {result.cv_std.toFixed(4)}</td>
                        <td className="px-4 py-3 border-b">
                          <span className={`px-2 py-1 rounded text-xs ${
                            result.is_overfitting ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {result.is_overfitting ? 'Yes' : 'No'}
                          </span>
                        </td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Prediction Section */}
        {results && (
          <div className="mt-8 p-4 border border-gray-300 rounded-lg">
            <h3 className="text-xl font-bold mb-4">Make Prediction</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Model
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full max-w-md px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select model...</option>
                  {Object.entries(results).map(([name, result]) => (
                    !result.error && (
                      <option key={name} value={result.model_key}>
                        {name}
                      </option>
                    )
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Input Values
                </label>
                <div className="grid grid-cols-2 gap-4">
                  {selectedFeatures.map((col) => {
                    const options = getOptionsForColumn(col)
                    const columnType = getColumnType(col)
                    const hasOptions = options.length > 0
                    
                    return (
                      <div key={col}>
                        <label className="block text-xs text-gray-600 mb-1">{col}</label>
                        {hasOptions ? (
                          <select
                            value={predictionInput[col] || ''}
                            onChange={(e) => setPredictionInput({
                              ...predictionInput,
                              [col]: e.target.value
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select...</option>
                            {options.map((opt, idx) => (
                              <option key={idx} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : columnType === 'number' ? (
                          <input
                            type="number"
                            step="any"
                            value={predictionInput[col] || ''}
                            onChange={(e) => setPredictionInput({
                              ...predictionInput,
                              [col]: e.target.value
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter number..."
                          />
                        ) : (
                          <input
                            type="text"
                            value={predictionInput[col] || ''}
                            onChange={(e) => setPredictionInput({
                              ...predictionInput,
                              [col]: e.target.value
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter value..."
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <button
                onClick={handlePredict}
                disabled={loading || !selectedModel}
                className="flex items-center space-x-2 px-6 py-3 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
              >
                <TrendingUp className="w-5 h-5" />
                <span>Predict</span>
              </button>

              {predictionResult !== null && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-sm font-medium text-blue-800">Prediction Result:</p>
                  <p className="text-2xl font-bold text-blue-900">{predictionResult.toFixed(4)}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MethodologyPage

