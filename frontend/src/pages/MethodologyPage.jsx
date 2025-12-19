import React, { useState, useEffect } from 'react'
import { methodologyAPI, projectAPI, libraryAPI } from '../utils/api'
import { Play, TrendingUp } from 'lucide-react'
import { S_OPTIONS, W_OPTIONS, getLikelihoodFromSW } from '../utils/riskMatrix'

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
  const [initialLoading, setInitialLoading] = useState(true)

  // Constants for S & W combined feature/target
  const COMBINED_SW_LABEL = 'S & W'
  const SW_TARGET_COL = '__SW_TARGET__'

  useEffect(() => {
    const loadData = async () => {
      setInitialLoading(true)
      try {
        await Promise.all([loadProjectData(), loadLibrary()])
      } finally {
        setInitialLoading(false)
      }
    }
    loadData()
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
      setMessage({ type: 'error', text: 'Failed to load project data' })
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
      setMessage({ type: 'error', text: 'Failed to load library' })
    }
  }

  const getOptionsForColumn = (columnName) => {
    if (!library || !library.headers) return []
    const header = library.headers.find(h => h.name === columnName)
    return header ? (header.options || []) : []
  }

  const getColumnType = (columnName) => {
    // Handle built-in columns S and W
    if (columnName === 'S' || columnName === 'W') {
      return 'select'
    }
    
    if (!library || !library.headers) return 'text'
    const header = library.headers.find(h => h.name === columnName)
    if (!header) return 'text'
    // If has options, it's select type
    if (header.options && header.options.length > 0) return 'select'
    // Otherwise use the type field or default to text
    return header.type || 'text'
  }

  const getOptionsForColumnBuiltIn = (columnName) => {
    if (columnName === 'S') return S_OPTIONS
    if (columnName === 'W') return W_OPTIONS
    return []
  }

  // Expand feature columns: replace "S & W" with ['S', 'W'] and de-duplicate
  const expandFeatureColumns = (selectedFeatures) => {
    const expanded = []
    selectedFeatures.forEach(feature => {
      if (feature === COMBINED_SW_LABEL) {
        if (!expanded.includes('S')) expanded.push('S')
        if (!expanded.includes('W')) expanded.push('W')
      } else {
        if (!expanded.includes(feature)) expanded.push(feature)
      }
    })
    return expanded
  }

  // Check if project has both S and W columns
  const hasSAndW = columns.includes('S') && columns.includes('W')

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
    setMessage({ type: '', text: '' })
    try {
      let dataForTrain = projectData
      let effectiveFeatures = selectedFeatures
      let effectiveTarget = selectedTarget
      let targetType = 'text'

      // Expand feature columns (replace "S & W" with ['S', 'W'])
      effectiveFeatures = expandFeatureColumns(selectedFeatures)

      // Handle S & W target: create synthetic target column
      if (selectedTarget === COMBINED_SW_LABEL) {
        effectiveTarget = SW_TARGET_COL
        targetType = 'text'
        
        // Create synthetic target column: ${S}|${W}
        dataForTrain = projectData.map(row => {
          const s = row.S || ''
          const w = row.W || ''
          const syntheticValue = (s && w) ? `${s}|${w}` : null
          return {
            ...row,
            [SW_TARGET_COL]: syntheticValue
          }
        })
        
        // Filter out rows where S or W is missing (synthetic target is null)
        dataForTrain = dataForTrain.filter(row => row[SW_TARGET_COL] !== null)
        
        if (dataForTrain.length < 10) {
          alert('Need at least 10 data points with both S and W values for training')
          setLoading(false)
          return
        }
      } else {
        // Regular target column
        targetType = getColumnType(selectedTarget)
      }

      const response = await methodologyAPI.train(
        dataForTrain,
        effectiveFeatures,
        effectiveTarget,
        targetType
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
      // Prepare input data: expand feature columns if needed
      const expandedFeatures = expandFeatureColumns(selectedFeatures)
      const inputData = {}
      expandedFeatures.forEach(col => {
        inputData[col] = predictionInput[col] || ''
      })
      
      const response = await methodologyAPI.predict(selectedModel, inputData)
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

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-600">Loading methodology data...</p>
        </div>
      </div>
    )
  }

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
                        // If selecting S or W while S & W is selected, remove S & W
                        let newFeatures = [...selectedFeatures]
                        if ((col === 'S' || col === 'W') && newFeatures.includes(COMBINED_SW_LABEL)) {
                          newFeatures = newFeatures.filter(f => f !== COMBINED_SW_LABEL)
                        }
                        newFeatures.push(col)
                        setSelectedFeatures(newFeatures)
                      } else {
                        setSelectedFeatures(selectedFeatures.filter(c => c !== col))
                      }
                    }}
                    className="rounded"
                  />
                  <span className="text-sm">{col}</span>
                </label>
              ))}
              {hasSAndW && (
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={selectedFeatures.includes(COMBINED_SW_LABEL)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        // Remove S and W if they exist, then add S & W
                        let newFeatures = selectedFeatures.filter(f => f !== 'S' && f !== 'W')
                        newFeatures.push(COMBINED_SW_LABEL)
                        setSelectedFeatures(newFeatures)
                      } else {
                        setSelectedFeatures(selectedFeatures.filter(f => f !== COMBINED_SW_LABEL))
                      }
                    }}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">{COMBINED_SW_LABEL}</span>
                </label>
              )}
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
              {hasSAndW && (
                <option value={COMBINED_SW_LABEL}>{COMBINED_SW_LABEL}</option>
              )}
            </select>
          </div>

          <button
            onClick={handleTrain}
            disabled={loading || selectedFeatures.length === 0 || !selectedTarget}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Training Models...</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                <span>Train Models</span>
              </>
            )}
          </button>
        </div>

        {/* Results Table */}
        {results && (() => {
          // Check if any result is classification
          const firstResult = Object.values(results).find(r => !r.error)
          const isClassification = firstResult?.is_classification || false
          
          return (
            <div className="mt-8">
              <h3 className="text-xl font-bold mb-4">
                Model Comparison ({isClassification ? 'Classification' : 'Regression'})
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Model</th>
                      {isClassification ? (
                        <>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Train Accuracy</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Test Accuracy</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Test F1</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">CV Score</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Overfitting</th>
                        </>
                      ) : (
                        <>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Train R²</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Test R²</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Test MAE</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">CV Score</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Overfitting</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(results).map(([name, result]) => (
                      result.error ? (
                        <tr key={name}>
                          <td className="px-4 py-3 border-b">{name}</td>
                          <td colSpan="5" className="px-4 py-3 border-b text-red-500">{result.error}</td>
                        </tr>
                      ) : isClassification ? (
                        <tr key={name} className="hover:bg-gray-50">
                          <td className="px-4 py-3 border-b font-medium">{name}</td>
                          <td className="px-4 py-3 border-b">{(result.train_accuracy * 100).toFixed(2)}%</td>
                          <td className="px-4 py-3 border-b">{(result.test_accuracy * 100).toFixed(2)}%</td>
                          <td className="px-4 py-3 border-b">{result.test_f1.toFixed(4)}</td>
                          <td className="px-4 py-3 border-b">
                            {result.cv_mean !== null && result.cv_mean !== undefined ? (
                              `${(result.cv_mean * 100).toFixed(2)}% ± ${result.cv_std !== null && result.cv_std !== undefined ? (result.cv_std * 100).toFixed(2) : 'N/A'}%`
                            ) : (
                              'N/A (insufficient data)'
                            )}
                          </td>
                          <td className="px-4 py-3 border-b">
                            <span className={`px-2 py-1 rounded text-xs ${
                              result.is_overfitting ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {result.is_overfitting ? 'Yes' : 'No'}
                            </span>
                          </td>
                        </tr>
                      ) : (
                        <tr key={name} className="hover:bg-gray-50">
                          <td className="px-4 py-3 border-b font-medium">{name}</td>
                          <td className="px-4 py-3 border-b">{result.train_r2.toFixed(4)}</td>
                          <td className={`px-4 py-3 border-b ${result.test_r2 < 0 ? 'text-orange-600 font-semibold' : ''}`}>
                            {result.test_r2.toFixed(4)}
                          </td>
                          <td className="px-4 py-3 border-b">{result.test_mae.toFixed(4)}</td>
                          <td className="px-4 py-3 border-b">
                            {result.cv_mean !== null && result.cv_mean !== undefined ? (
                              `${result.cv_mean.toFixed(4)} ± ${result.cv_std !== null && result.cv_std !== undefined ? result.cv_std.toFixed(4) : 'N/A'}`
                            ) : (
                              'N/A (insufficient data)'
                            )}
                          </td>
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
          )
        })()}

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
                  {(() => {
                    // Expand feature columns to show actual inputs
                    const expandedFeatures = expandFeatureColumns(selectedFeatures)
                    return expandedFeatures.map((col) => {
                      // Get options: first check built-in, then library
                      let options = getOptionsForColumnBuiltIn(col)
                      if (options.length === 0) {
                        options = getOptionsForColumn(col)
                      }
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
                    })
                  })()}
                </div>
              </div>

              <button
                onClick={handlePredict}
                disabled={loading || !selectedModel}
                className="flex items-center space-x-2 px-6 py-3 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Predicting...</span>
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-5 h-5" />
                    <span>Predict</span>
                  </>
                )}
              </button>

              {predictionResult !== null && (() => {
                // Handle S & W target: parse prediction and show S, W, and likelihood
                if (selectedTarget === COMBINED_SW_LABEL) {
                  const predictionStr = String(predictionResult)
                  const parts = predictionStr.split('|')
                  
                  if (parts.length === 2) {
                    const predS = parts[0].trim()
                    const predW = parts[1].trim()
                    const likelihood = getLikelihoodFromSW(predS, predW)
                    
                    return (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded space-y-2">
                        <p className="text-sm font-medium text-blue-800">Prediction Result:</p>
                        <div className="space-y-1">
                          <p className="text-lg text-blue-900">
                            <span className="font-semibold">S:</span> {predS}
                          </p>
                          <p className="text-lg text-blue-900">
                            <span className="font-semibold">W:</span> {predW}
                          </p>
                          {likelihood && (
                            <p className="text-lg text-blue-900">
                              <span className="font-semibold">Likelihood:</span> {likelihood}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  } else {
                    // Fallback: show raw prediction if parsing fails
                    return (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                        <p className="text-sm font-medium text-blue-800">Prediction Result:</p>
                        <p className="text-2xl font-bold text-blue-900">{predictionStr}</p>
                      </div>
                    )
                  }
                } else {
                  // Regular target: show prediction as-is
                  return (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                      <p className="text-sm font-medium text-blue-800">Prediction Result:</p>
                      <p className="text-2xl font-bold text-blue-900">
                        {typeof predictionResult === 'string' ? predictionResult : predictionResult.toFixed(4)}
                      </p>
                    </div>
                  )
                }
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MethodologyPage

