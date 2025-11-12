import React, { useState, useEffect } from 'react'
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

  useEffect(() => {
    loadProjectData()
    loadLibrary()
  }, [])

  const loadProjectData = async () => {
    try {
      const response = await projectAPI.get()
      if (response.data.success) {
        const rows = response.data.data.rows || []
        const cols = response.data.data.columns || []
        setProjectData(rows)
        setColumns(cols)
        
        // Initialize alternatives scores
        const scores = {}
        rows.forEach((row, index) => {
          scores[`Alternative ${index + 1}`] = {}
        })
        setAlternativesScores(scores)
      }
    } catch (error) {
      console.error('Error loading project:', error)
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

  const handleWeightChange = (column, weight) => {
    setCriteriaWeights({
      ...criteriaWeights,
      [column]: parseFloat(weight) || 0
    })
  }

  const handleScoreChange = (alternative, column, score) => {
    setAlternativesScores({
      ...alternativesScores,
      [alternative]: {
        ...alternativesScores[alternative],
        [column]: parseFloat(score) || 0
      }
    })
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
        setRankingResult(response.data.data)
        setMessage({ type: 'success', text: 'Ranking calculated successfully' })
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Alternative</th>
                  {rankingColumns.map((col) => (
                    <th key={col} className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.keys(alternativesScores).map((alt) => (
                  <tr key={alt}>
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
                ))}
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

