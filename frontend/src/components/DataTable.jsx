import React from 'react'
import { Plus } from 'lucide-react'

function DataTable({ columns, rows, onCellChange, onAddRow, onDeleteRow, onDeleteColumn, library, temporaryColumnMetadata = {}, onAddToLibrary }) {
  const getOptionsForColumn = (columnName) => {
    // First check library
    if (library && library.headers) {
      const header = library.headers.find(h => h.name === columnName)
      if (header && header.options) {
        return header.options
      }
    }
    // Then check temporary metadata (for columns not in library)
    if (temporaryColumnMetadata[columnName]) {
      return temporaryColumnMetadata[columnName].options || []
    }
    return []
  }

  const getColumnType = (columnName) => {
    // First check library
    if (library && library.headers) {
      const header = library.headers.find(h => h.name === columnName)
      if (header) {
        // If has options, it's select type
        if (header.options && header.options.length > 0) return 'select'
        // Otherwise use the type field or default to text
        return header.type || 'text'
      }
    }
    // Then check temporary metadata (for columns not in library)
    if (temporaryColumnMetadata[columnName]) {
      const metadata = temporaryColumnMetadata[columnName]
      if (metadata.options && metadata.options.length > 0) return 'select'
      return metadata.type || 'text'
    }
    return 'text'
  }

  const isColumnInLibrary = (columnName) => {
    if (!library || !library.headers) return false
    return library.headers.some(h => h.name === columnName)
  }

  const handleCellChange = (rowIndex, columnName, value) => {
    if (onCellChange) {
      onCellChange(rowIndex, columnName, value)
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase border-b">
              Row No
            </th>
            {columns.map((col, idx) => {
              const isInLibrary = isColumnInLibrary(col)
              return (
                <th key={idx} className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase border-b">
                  <div className="flex items-center justify-between">
                    <span>{col}</span>
                    <div className="flex items-center space-x-1">
                      {!isInLibrary && onAddToLibrary && (
                        <button
                          onClick={() => onAddToLibrary(col)}
                          className="text-green-500 hover:text-green-700 text-xs px-2 py-1 border border-green-300 rounded flex items-center space-x-1"
                          title="Add to Library"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add</span>
                        </button>
                      )}
                      {onDeleteColumn && (
                        <button
                          onClick={() => onDeleteColumn(col)}
                          className="text-red-500 hover:text-red-700 text-sm font-bold"
                          title="Delete column"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                </th>
              )
            })}
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase border-b">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-gray-50">
              <td className="px-4 py-2 border-b font-medium text-gray-600">
                {row.rowNo || rowIndex + 1}
              </td>
              {columns.map((col, colIndex) => {
                const options = getOptionsForColumn(col)
                const columnType = getColumnType(col)
                const cellValue = row[col] || ''
                
                return (
                  <td key={colIndex} className="px-4 py-2 border-b">
                    {columnType === 'select' && options.length > 0 ? (
                      <select
                        value={cellValue}
                        onChange={(e) => handleCellChange(rowIndex, col, e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select...</option>
                        {options.map((opt, optIdx) => (
                          <option key={optIdx} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : columnType === 'number' ? (
                      <input
                        type="number"
                        step="any"
                        value={cellValue}
                        onChange={(e) => handleCellChange(rowIndex, col, e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter number..."
                      />
                    ) : (
                      <input
                        type="text"
                        value={cellValue}
                        onChange={(e) => handleCellChange(rowIndex, col, e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter value..."
                      />
                    )}
                  </td>
                )
              })}
              <td className="px-4 py-2 border-b">
                <button
                  onClick={() => onDeleteRow && onDeleteRow(rowIndex)}
                  className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4">
        <button
          onClick={onAddRow}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Add Row
        </button>
      </div>
    </div>
  )
}

export default DataTable

