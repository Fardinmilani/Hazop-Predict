/**
 * Risk Matrix Utility
 * Provides S/W options and likelihood calculation based on the risk matrix
 */

export const S_OPTIONS = ['S1', 'S2', 'S3', 'S4']
export const W_OPTIONS = ['W3', 'W2', 'W1', 'W0', 'W-1', 'W-2']
export const LIKELIHOOD_OPTIONS = ['Low Risk', 'Medium Risk', 'High Risk', 'Very High Risk']

/**
 * Calculate likelihood (risk label) from S and W values using the risk matrix
 * @param {string} s - S value (S1, S2, S3, or S4)
 * @param {string} w - W value (W3, W2, W1, W0, W-1, or W-2)
 * @returns {string} Risk label or empty string if S or W is missing
 */
export function getLikelihoodFromSW(s, w) {
  // If S or W is missing/empty, return empty string
  if (!s || !w || s.trim() === '' || w.trim() === '') {
    return ''
  }

  // Normalize values
  const sVal = String(s).trim()
  const wVal = String(w).trim()

  // Risk matrix mapping
  // S1: W3/W2→Medium, W1/W0/W-1/W-2→Low
  // S2: W3/W2→High, W1→Medium, W0/W-1/W-2→Low
  // S3: W3/W2→Very High, W1→High, W0→Medium, W-1/W-2→Low
  // S4: W3/W2→Very High, W1→High, W0→Medium, W-1/W-2→Low

  if (sVal === 'S1') {
    if (wVal === 'W3' || wVal === 'W2') return 'Medium Risk'
    if (wVal === 'W1' || wVal === 'W0' || wVal === 'W-1' || wVal === 'W-2') return 'Low Risk'
  } else if (sVal === 'S2') {
    if (wVal === 'W3' || wVal === 'W2') return 'High Risk'
    if (wVal === 'W1') return 'Medium Risk'
    if (wVal === 'W0' || wVal === 'W-1' || wVal === 'W-2') return 'Low Risk'
  } else if (sVal === 'S3' || sVal === 'S4') {
    if (wVal === 'W3' || wVal === 'W2') return 'Very High Risk'
    if (wVal === 'W1') return 'High Risk'
    if (wVal === 'W0') return 'Medium Risk'
    if (wVal === 'W-1' || wVal === 'W-2') return 'Low Risk'
  }

  // If no match found, return empty string
  return ''
}
