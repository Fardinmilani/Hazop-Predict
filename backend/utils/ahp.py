"""
Analytic Hierarchy Process (AHP) Implementation
For ranking and decision making
"""

import numpy as np

def calculate_consistency_ratio(matrix):
    """Calculate consistency ratio for AHP matrix"""
    n = len(matrix)
    
    # Calculate eigenvalues
    eigenvalues, _ = np.linalg.eig(matrix)
    max_eigenvalue = np.real(max(eigenvalues))
    
    # Calculate consistency index
    ci = (max_eigenvalue - n) / (n - 1)
    
    # Random consistency index (RI) for different matrix sizes
    ri_values = {
        1: 0, 2: 0, 3: 0.58, 4: 0.90, 5: 1.12,
        6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49
    }
    ri = ri_values.get(n, 1.49)
    
    # Consistency ratio
    cr = ci / ri if ri > 0 else 0
    
    return cr, ci, max_eigenvalue

def normalize_matrix(matrix):
    """Normalize pairwise comparison matrix"""
    matrix = np.array(matrix)
    column_sums = matrix.sum(axis=0)
    normalized = matrix / column_sums
    return normalized

def calculate_weights(matrix):
    """Calculate priority weights from pairwise comparison matrix"""
    normalized = normalize_matrix(matrix)
    weights = normalized.mean(axis=1)
    return weights / weights.sum()  # Normalize to sum to 1

def ahp_ranking(criteria_weights, alternatives_scores):
    """
    Perform AHP ranking
    
    Args:
        criteria_weights: dict of {criterion: weight}
        alternatives_scores: dict of {alternative: {criterion: score}}
    
    Returns:
        dict of {alternative: final_score}
    """
    # Normalize criteria weights to sum to 1
    total_weight = sum(criteria_weights.values())
    normalized_weights = {k: v / total_weight for k, v in criteria_weights.items()}
    
    # Calculate weighted scores for each alternative
    final_scores = {}
    for alternative, scores in alternatives_scores.items():
        weighted_score = sum(
            normalized_weights.get(criterion, 0) * score
            for criterion, score in scores.items()
        )
        final_scores[alternative] = weighted_score
    
    # Sort by score (descending)
    ranked = sorted(final_scores.items(), key=lambda x: x[1], reverse=True)
    
    return {
        'scores': final_scores,
        'ranking': [{'alternative': alt, 'score': score} for alt, score in ranked],
        'criteria_weights': normalized_weights
    }

def create_pairwise_matrix(scores):
    """Create pairwise comparison matrix from scores"""
    n = len(scores)
    matrix = np.ones((n, n))
    
    for i in range(n):
        for j in range(n):
            if i != j:
                # Use ratio of scores
                if scores[j] != 0:
                    matrix[i][j] = scores[i] / scores[j]
                else:
                    matrix[i][j] = 1.0
    
    return matrix.tolist()

