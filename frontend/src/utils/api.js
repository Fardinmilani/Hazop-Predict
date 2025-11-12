/**
 * API utility for communicating with Flask backend
 */

import axios from 'axios'

const API_BASE_URL = 'http://localhost:5000/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// File API
export const fileAPI = {
  new: () => api.post('/file/new'),
  open: (fileOrFilename) => {
    // If it's a File object, use FormData, otherwise use JSON with filename
    if (fileOrFilename instanceof File) {
      const formData = new FormData()
      formData.append('file', fileOrFilename)
      return api.post('/file/open', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
    } else {
      // It's a filename string
      return api.post('/file/open', { filename: fileOrFilename })
    }
  },
  save: (data, filename) => api.post('/file/save', { data, filename }),
  list: () => api.get('/file/list'),
  download: (filename) => api.get(`/file/download/${filename}`, { responseType: 'blob' })
}

// Library API
export const libraryAPI = {
  get: () => api.get('/library/get'),
  save: (data) => api.post('/library/save', { data }),
  addHeader: (name, options) => api.post('/library/header/add', { name, options }),
  updateHeader: (name, newName, options) => api.put('/library/header/update', { name, newName, options }),
  deleteHeader: (name) => api.delete('/library/header/delete', { data: { name } })
}

// Project API
export const projectAPI = {
  get: () => api.get('/project/get'),
  update: (rows, columns) => api.post('/project/update', { rows, columns }),
  addRow: (row) => api.post('/project/row/add', { row }),
  deleteRow: (index) => api.delete('/project/row/delete', { data: { index } })
}

// Methodology API
export const methodologyAPI = {
  train: (data, featureColumns, targetColumn) => 
    api.post('/methodology/train', { data, featureColumns, targetColumn }),
  predict: (modelKey, inputData) => 
    api.post('/methodology/predict', { modelKey, inputData })
}

// Ranking API
export const rankingAPI = {
  ahp: (criteriaWeights, alternativesScores) => 
    api.post('/ranking/ahp', { criteriaWeights, alternativesScores }),
  pairwiseMatrix: (scores) => 
    api.post('/ranking/pairwise-matrix', { scores }),
  other: () => api.post('/ranking/other')
}

// Report API
export const reportAPI = {
  statistics: (data) => api.post('/report/statistics', { data }),
  visualizations: (data, type, options = {}) => 
    api.post('/report/visualizations', { data, type, ...options }),
  exportExcel: (data, filename) => 
    api.post('/report/export-excel', { data, filename }),
  exportPDF: (data, filename) => 
    api.post('/report/export-pdf', { data, filename })
}

export default api

