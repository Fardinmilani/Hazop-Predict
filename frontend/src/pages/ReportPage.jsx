import React, { useState, useEffect } from 'react'
import { reportAPI, projectAPI } from '../utils/api'
import { FileBarChart, Download, BarChart3, TrendingUp } from 'lucide-react'

function ReportPage() {
  const [projectData, setProjectData] = useState([])
  const [statistics, setStatistics] = useState(null)
  const [visualizations, setVisualizations] = useState({})
  const [selectedVizType, setSelectedVizType] = useState('heatmap')
  const [selectedColumn, setSelectedColumn] = useState('')
  const [xColumn, setXColumn] = useState('')
  const [yColumn, setYColumn] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadProjectData()
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
      const response = await reportAPI.statistics(projectData)
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

      const response = await reportAPI.visualizations(projectData, selectedVizType, options)
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

  const handleExportExcel = async () => {
    if (projectData.length === 0) {
      alert('No data available to export')
      return
    }

    setLoading(true)
    try {
      const filename = `report_${new Date().toISOString().split('T')[0]}.xlsx`
      const response = await reportAPI.exportExcel(projectData, filename)
      if (response.data.success) {
        alert('Excel report exported successfully!')
      }
    } catch (error) {
      console.error('Error exporting Excel:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExportPDF = async () => {
    if (projectData.length === 0) {
      alert('No data available to export')
      return
    }

    setLoading(true)
    try {
      const filename = `report_${new Date().toISOString().split('T')[0]}.pdf`
      const response = await reportAPI.exportPDF(projectData, filename)
      if (response.data.success) {
        alert('PDF report exported successfully!')
      }
    } catch (error) {
      console.error('Error exporting PDF:', error)
    } finally {
      setLoading(false)
    }
  }

  const columns = projectData.length > 0 ? Object.keys(projectData[0]) : []

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Reports & Analytics</h2>
          <div className="flex space-x-2">
            <button
              onClick={handleExportExcel}
              disabled={loading || projectData.length === 0}
              className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              <Download className="w-5 h-5" />
              <span>Export Excel</span>
            </button>
            <button
              onClick={handleExportPDF}
              disabled={loading || projectData.length === 0}
              className="flex items-center space-x-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
            >
              <Download className="w-5 h-5" />
              <span>Export PDF</span>
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
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              Generate Statistics
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
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(statistics.numeric_stats).map(([col, stats]) => (
                          <tr key={col}>
                            <td className="px-4 py-2 border-b font-medium">{col}</td>
                            <td className="px-4 py-2 border-b">{stats.mean.toFixed(2)}</td>
                            <td className="px-4 py-2 border-b">{stats.std.toFixed(2)}</td>
                            <td className="px-4 py-2 border-b">{stats.min.toFixed(2)}</td>
                            <td className="px-4 py-2 border-b">{stats.max.toFixed(2)}</td>
                            <td className="px-4 py-2 border-b">{stats.median.toFixed(2)}</td>
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
            <div className="flex items-center space-x-4">
              <select
                value={selectedVizType}
                onChange={(e) => setSelectedVizType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="heatmap">Correlation Heatmap</option>
                <option value="bar">Bar Chart</option>
                <option value="scatter">Scatter Plot</option>
              </select>

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
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                Generate
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
    </div>
  )
}

export default ReportPage

