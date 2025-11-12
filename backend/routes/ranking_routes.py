"""
Ranking Routes
Handles AHP and other ranking algorithms
"""

from flask import Blueprint, request, jsonify
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from utils.ahp import ahp_ranking, calculate_consistency_ratio, create_pairwise_matrix

ranking_bp = Blueprint('ranking', __name__)

@ranking_bp.route('/ahp', methods=['POST'])
def perform_ahp():
    """Perform AHP ranking"""
    data = request.json
    criteria_weights = data.get('criteriaWeights', {})
    alternatives_scores = data.get('alternativesScores', {})
    
    if not criteria_weights or not alternatives_scores:
        return jsonify({'success': False, 'error': 'Criteria weights and alternatives scores required'}), 400
    
    try:
        result = ahp_ranking(criteria_weights, alternatives_scores)
        return jsonify({
            'success': True,
            'data': result
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@ranking_bp.route('/pairwise-matrix', methods=['POST'])
def create_pairwise():
    """Create pairwise comparison matrix"""
    data = request.json
    scores = data.get('scores', [])
    
    try:
        matrix = create_pairwise_matrix(scores)
        cr, ci, max_eigenvalue = calculate_consistency_ratio(matrix)
        
        return jsonify({
            'success': True,
            'matrix': matrix,
            'consistency_ratio': float(cr),
            'consistency_index': float(ci),
            'max_eigenvalue': float(max_eigenvalue),
            'is_consistent': cr < 0.1
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@ranking_bp.route('/other', methods=['POST'])
def other_algorithms():
    """Placeholder for other ranking algorithms"""
    return jsonify({
        'success': False,
        'message': 'TOPSIS, VIKOR, and other algorithms need further development'
    })

