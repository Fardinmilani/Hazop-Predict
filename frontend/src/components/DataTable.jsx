import React from 'react'

function DataTable({ columns, rows, onCellChange, onAddRow, onDeleteRow, library }) {
  const getOptionsForColumn = (columnName) => {
    if (!library || !library.headers) return []
    const header = library.headers.find(h => h.name === columnName)
    return header ? header.options : []
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
            {columns.map((col, idx) => (
              <th key={idx} className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase border-b">
                {col}
              </th>
            ))}
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
                const cellValue = row[col] || ''
                
                return (
                  <td key={colIndex} className="px-4 py-2 border-b">
                    {options.length > 0 ? (
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

