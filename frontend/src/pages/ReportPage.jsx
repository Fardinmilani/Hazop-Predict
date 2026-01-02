import React, { useState, useEffect } from 'react'
import { reportAPI, projectAPI } from '../utils/api'
import { FileBarChart, Download, BarChart3, TrendingUp, X, Eye } from 'lucide-react'

function ReportPage() {
  const [projectData, setProjectData] = useState([])
  const [statistics, setStatistics] = useState(null)
  const [visualizations, setVisualizations] = useState({})
  const [selectedVizType, setSelectedVizType] = useState('heatmap')
  const [selectedColumn, setSelectedColumn] = useState('')
  const [xColumn, setXColumn] = useState('')
  const [yColumn, setYColumn] = useState('')
  const [includeCategorical, setIncludeCategorical] = useState(false)
  const [loading, setLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [showDistributionModal, setShowDistributionModal] = useState(false)
  const [selectedDistributionColumn, setSelectedDistributionColumn] = useState('')
  const [distributionImage, setDistributionImage] = useState('')
  const [loadingDistribution, setLoadingDistribution] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      setInitialLoading(true)
      try {
        await loadProjectData()
      } finally {
        setInitialLoading(false)
      }
    }
    loadData()
  }, [])

  const loadProjectData = async () => {
    try {
      const response = await projectAPI.get()
      if (response.data.success) {
        const rows = response.data.data.rows || []
        setProjectData(rows)
      }
    } catch (error) {
      console.error('Error loading project:', error)
    }
  }

  const loadStatistics = async () => {
    if (projectData.length === 0) {
      alert('No data available. Please add data to the project first.')
      return
    }

    setLoading(true)
    try {
      // Remove rowNo from data before sending to backend
      const dataWithoutRowNo = projectData.map(row => {
        const { rowNo, ...rest } = row
        return rest
      })
      const response = await reportAPI.statistics(dataWithoutRowNo)
      if (response.data.success) {
        setStatistics(response.data.data)
      }
    } catch (error) {
      console.error('Error loading statistics:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadVisualization = async () => {
    if (projectData.length === 0) {
      alert('No data available. Please add data to the project first.')
      return
    }

    setLoading(true)
    try {
      let options = {}
      if (selectedVizType === 'bar') {
        if (!selectedColumn) {
          alert('Please select a column for bar chart')
          setLoading(false)
          return
        }
        options = { column: selectedColumn }
      } else if (selectedVizType === 'scatter') {
        if (!xColumn || !yColumn) {
          alert('Please select both X and Y columns for scatter plot')
          setLoading(false)
          return
        }
        options = { xColumn, yColumn }
      }

      // Remove rowNo from data before sending to backend
      const dataWithoutRowNo = projectData.map(row => {
        const { rowNo, ...rest } = row
        return rest
      })
      
      // Add includeCategorical option for heatmap
      if (selectedVizType === 'heatmap') {
        options.includeCategorical = includeCategorical
      }
      
      const response = await reportAPI.visualizations(dataWithoutRowNo, selectedVizType, options)
      if (response.data.success) {
        setVisualizations({
          ...visualizations,
          [selectedVizType]: response.data.image
        })
      }
    } catch (error) {
      console.error('Error loading visualization:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadDistributionPlot = async (columnName) => {
    if (projectData.length === 0) {
      alert('No data available. Please add data to the project first.')
      return
    }

    setLoadingDistribution(true)
    setSelectedDistributionColumn(columnName)
    setShowDistributionModal(true)
    
    try {
      // Remove rowNo from data before sending to backend
      const dataWithoutRowNo = projectData.map(row => {
        const { rowNo, ...rest } = row
        return rest
      })
      
      const response = await reportAPI.visualizations(dataWithoutRowNo, 'distribution', { column: columnName })
      if (response.data.success) {
        setDistributionImage(response.data.image)
      } else {
        alert('Failed to generate distribution plot')
        setShowDistributionModal(false)
      }
    } catch (error) {
      console.error('Error loading distribution plot:', error)
      alert('Failed to generate distribution plot')
      setShowDistributionModal(false)
    } finally {
      setLoadingDistribution(false)
    }
  }

  const handleExportExcel = async () => {
    if (projectData.length === 0) {
      alert('No data available to export')
      return
    }

    setExportLoading(true)
    try {
      // Remove rowNo from data before sending to backend
      const dataWithoutRowNo = projectData.map(row => {
        const { rowNo, ...rest } = row
        return rest
      })
      const defaultFilename = `report_${new Date().toISOString().split('T')[0]}.xlsx`
      
      // Use File System Access API if available, otherwise use download
      if ('showSaveFilePicker' in window) {
        try {
          const fileHandle = await window.showSaveFilePicker({
            suggestedName: defaultFilename,
            types: [{
              description: 'Excel files',
              accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
            }]
          })
          
          const response = await reportAPI.exportExcel(dataWithoutRowNo, fileHandle.name)
          if (response.data.success) {
            // Download the file
            const downloadResponse = await fetch(`http://localhost:5000/api/report/download-excel?filename=${encodeURIComponent(fileHandle.name)}`)
            if (downloadResponse.ok) {
              const blob = await downloadResponse.blob()
              const writable = await fileHandle.createWritable()
              await writable.write(blob)
              await writable.close()
              alert('Excel report exported successfully!')
            }
          }
        } catch (err) {
          if (err.name !== 'AbortError') {
            throw err
          }
        }
      } else {
        // Fallback: use download
        const filename = prompt('Enter filename (without extension):', `report_${new Date().toISOString().split('T')[0]}`)
        if (!filename) {
          setExportLoading(false)
          return
        }
        const response = await reportAPI.exportExcel(dataWithoutRowNo, `${filename}.xlsx`)
        if (response.data.success) {
          // Download the file
          const downloadResponse = await fetch(`http://localhost:5000/api/report/download-excel?filename=${encodeURIComponent(`${filename}.xlsx`)}`)
          if (downloadResponse.ok) {
            const blob = await downloadResponse.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${filename}.xlsx`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
            alert('Excel report exported successfully!')
          }
        }
      }
    } catch (error) {
      console.error('Error exporting Excel:', error)
      alert('Failed to export Excel report')
    } finally {
      setExportLoading(false)
    }
  }

  const handleExportPDF = async () => {
    if (projectData.length === 0) {
      alert('No data available to export')
      return
    }

    setExportLoading(true)
    try {
      // Remove rowNo from data before sending to backend
      const dataWithoutRowNo = projectData.map(row => {
        const { rowNo, ...rest } = row
        return rest
      })
      const defaultFilename = `report_${new Date().toISOString().split('T')[0]}.pdf`
      
      // Use File System Access API if available, otherwise use download
      if ('showSaveFilePicker' in window) {
        try {
          const fileHandle = await window.showSaveFilePicker({
            suggestedName: defaultFilename,
            types: [{
              description: 'PDF files',
              accept: { 'application/pdf': ['.pdf'] }
            }]
          })
          
          const response = await reportAPI.exportPDF(dataWithoutRowNo, fileHandle.name)
          if (response.data.success) {
            // Download the file
            const downloadResponse = await fetch(`http://localhost:5000/api/report/download-pdf?filename=${encodeURIComponent(fileHandle.name)}`)
            if (downloadResponse.ok) {
              const blob = await downloadResponse.blob()
              const writable = await fileHandle.createWritable()
              await writable.write(blob)
              await writable.close()
              alert('PDF report exported successfully!')
            }
          }
        } catch (err) {
          if (err.name !== 'AbortError') {
            throw err
          }
        }
      } else {
        // Fallback: use download
        const filename = prompt('Enter filename (without extension):', `report_${new Date().toISOString().split('T')[0]}`)
        if (!filename) {
          setExportLoading(false)
          return
        }
        const response = await reportAPI.exportPDF(dataWithoutRowNo, `${filename}.pdf`)
        if (response.data.success) {
          // Download the file
          const downloadResponse = await fetch(`http://localhost:5000/api/report/download-pdf?filename=${encodeURIComponent(`${filename}.pdf`)}`)
          if (downloadResponse.ok) {
            const blob = await downloadResponse.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${filename}.pdf`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
            alert('PDF report exported successfully!')
          }
        }
      }
    } catch (error) {
      console.error('Error exporting PDF:', error)
      alert('Failed to export PDF report')
    } finally {
      setExportLoading(false)
    }
  }

  // Filter out rowNo from columns as it's not needed in report calculations
  const columns = projectData.length > 0 
    ? Object.keys(projectData[0]).filter(col => col !== 'rowNo')
    : []

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-600">Loading report data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Reports & Analytics</h2>
          <div className="flex space-x-2">
            <button
              onClick={handleExportExcel}
              disabled={exportLoading || loading || projectData.length === 0}
              className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {exportLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Exporting Excel...</span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  <span>Export Excel</span>
                </>
              )}
            </button>
            <button
              onClick={handleExportPDF}
              disabled={exportLoading || loading || projectData.length === 0}
              className="flex items-center space-x-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
            >
              {exportLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Exporting PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  <span>Export PDF</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Statistics Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Statistics Summary</h3>
            <button
              onClick={loadStatistics}
              disabled={loading || projectData.length === 0}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Generating...</span>
                </>
              ) : (
                <span>Generate Statistics</span>
              )}
            </button>
          </div>

          {statistics && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded">
                <p className="text-sm text-gray-600">Total Records: <span className="font-bold">{statistics.count}</span></p>
              </div>

              {Object.keys(statistics.numeric_stats).length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Numeric Statistics</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border border-gray-300">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Column</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Mean</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Std</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Min</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Max</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Median</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Q25</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Q75</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Distribution</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">P-Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(statistics.numeric_stats).map(([col, stats]) => (
                          <React.Fragment key={col}>
                            <tr>
                              <td className="px-4 py-2 border-b font-medium">{col}</td>
                              <td className="px-4 py-2 border-b">{stats.mean.toFixed(2)}</td>
                              <td className="px-4 py-2 border-b">{stats.std.toFixed(2)}</td>
                              <td className="px-4 py-2 border-b">{stats.min.toFixed(2)}</td>
                              <td className="px-4 py-2 border-b">{stats.max.toFixed(2)}</td>
                              <td className="px-4 py-2 border-b">{stats.median.toFixed(2)}</td>
                              <td className="px-4 py-2 border-b">{stats.q25.toFixed(2)}</td>
                              <td className="px-4 py-2 border-b">{stats.q75.toFixed(2)}</td>
                              <td className="px-4 py-2 border-b">
                                {stats.distribution ? (
                                  <span className="bg-blue-100 px-2 py-1 rounded text-xs">
                                    {stats.distribution.distribution}
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400">N/A</span>
                                )}
                              </td>
                              <td className="px-4 py-2 border-b">
                                {stats.distribution ? (
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs">
                                      {stats.distribution.pvalue?.toFixed(4) || 'N/A'}
                                    </span>
                                    <button
                                      onClick={() => loadDistributionPlot(col)}
                                      className="flex items-center space-x-1 px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
                                      title="View distribution plot"
                                    >
                                      <Eye className="w-3 h-3" />
                                      <span>View</span>
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">N/A</span>
                                )}
                              </td>
                            </tr>
                            {stats.distribution && stats.distribution.params && (
                              <tr className="bg-gray-50">
                                <td colSpan="10" className="px-4 py-2 border-b text-xs">
                                  <span className="font-medium">Parameters:</span>{' '}
                                  {stats.distribution.params.map((p, idx) => (
                                    <span key={idx}>
                                      {idx > 0 ? ', ' : ''}{p.toFixed(4)}
                                    </span>
                                  ))}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {Object.keys(statistics.categorical_stats || {}).length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold mb-2">Categorical Statistics</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border border-gray-300">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Column</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Unique Count</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Most Frequent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(statistics.categorical_stats).map(([col, stats]) => (
                          <tr key={col}>
                            <td className="px-4 py-2 border-b font-medium">{col}</td>
                            <td className="px-4 py-2 border-b">{stats.unique_count}</td>
                            <td className="px-4 py-2 border-b">
                              {stats.most_frequent && stats.most_frequent.length > 0 ? (
                                <div className="text-xs">
                                  {stats.most_frequent.slice(0, 3).map(([val, count], idx) => (
                                    <span key={idx} className="mr-2">
                                      {val}: {count}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">N/A</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Visualizations Section */}
        <div>
          <h3 className="text-xl font-semibold mb-4">Visualizations</h3>
          <div className="space-y-4">
            <div className="flex items-center space-x-4 flex-wrap">
              <select
                value={selectedVizType}
                onChange={(e) => setSelectedVizType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="heatmap">Correlation Heatmap</option>
                <option value="bar">Bar Chart</option>
                <option value="scatter">Scatter Plot</option>
              </select>

              {selectedVizType === 'heatmap' && (
                <label className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={includeCategorical}
                    onChange={(e) => setIncludeCategorical(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Include Categorical Values</span>
                </label>
              )}

              {selectedVizType === 'bar' && (
                <select
                  value={selectedColumn}
                  onChange={(e) => setSelectedColumn(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select column...</option>
                  {columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              )}

              {selectedVizType === 'scatter' && (
                <>
                  <select
                    value={xColumn}
                    onChange={(e) => setXColumn(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">X Column...</option>
                    {columns.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                  <select
                    value={yColumn}
                    onChange={(e) => setYColumn(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Y Column...</option>
                    {columns.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </>
              )}

              <button
                onClick={loadVisualization}
                disabled={loading || projectData.length === 0}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Generating...</span>
                  </>
                ) : (
                  <span>Generate</span>
                )}
              </button>
            </div>

            {visualizations[selectedVizType] && (
              <div className="mt-4">
                <img
                  src={`data:image/png;base64,${visualizations[selectedVizType]}`}
                  alt="Visualization"
                  className="border border-gray-300 rounded"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Distribution Plot Modal */}
      {showDistributionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">
                Distribution Plot: {selectedDistributionColumn}
              </h3>
              <button
                onClick={() => {
                  setShowDistributionModal(false)
                  setDistributionImage('')
                  setSelectedDistributionColumn('')
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {loadingDistribution ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                  <p className="text-gray-600">Generating distribution plot...</p>
                </div>
              </div>
            ) : distributionImage ? (
              <div className="mt-4">
                <img
                  src={`data:image/png;base64,${distributionImage}`}
                  alt={`Distribution plot for ${selectedDistributionColumn}`}
                  className="border border-gray-300 rounded w-full"
                />
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                No distribution plot available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ReportPage

