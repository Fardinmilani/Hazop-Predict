"""
Ranking Routes
Handles AHP and other ranking algorithms
"""

from flask import Blueprint, request, jsonify
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from utils.ahp import ahp_ranking, calculate_consistency_ratio, create_pairwise_matrix
from utils.file_manager import load_excel, save_excel
import pandas as pd

ranking_bp = Blueprint('ranking', __name__)
RANKING_FILE = 'ranking.xlsx'

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

@ranking_bp.route('/get', methods=['GET'])
def get_ranking():
    """Get current ranking data"""
    try:
        from pathlib import Path
        DATA_DIR = Path(__file__).parent.parent.parent / 'data'
        filepath = DATA_DIR / RANKING_FILE
        
        # Initialize default structure
        ranking_data = {
            'criteriaWeights': {},
            'alternativesScores': {},
            'rankingResult': None
        }
        
        if filepath.exists():
            try:
                # Load from multiple sheets
                xls = pd.ExcelFile(filepath)
                criteria_weights = {}
                alternatives_scores = {}
                ranking_result = None
                
                # Sheet 1: Criteria Weights
                if 'CriteriaWeights' in xls.sheet_names:
                    df_weights = pd.read_excel(filepath, sheet_name='CriteriaWeights')
                    for _, row in df_weights.iterrows():
                        if 'criteria' in row and 'weight' in row:
                            try:
                                criteria = str(row['criteria']).strip()
                                weight = row['weight']
                                if pd.notna(criteria) and pd.notna(weight):
                                    weight_val = float(weight)
                                    # Only add if weight is not zero
                                    if weight_val != 0:
                                        criteria_weights[criteria] = weight_val
                            except (ValueError, TypeError):
                                continue
                
                # Sheet 2: Alternatives Scores
                if 'AlternativesScores' in xls.sheet_names:
                    df_scores = pd.read_excel(filepath, sheet_name='AlternativesScores')
                    for _, row in df_scores.iterrows():
                        if 'alternative' in row and 'criteria' in row and 'score' in row:
                            try:
                                alt = str(row['alternative']).strip()
                                criteria = str(row['criteria']).strip()
                                score = row['score']
                                if pd.notna(alt) and pd.notna(criteria) and pd.notna(score):
                                    score_val = float(score)
                                    # Only add if score is not zero
                                    if score_val != 0:
                                        if alt not in alternatives_scores:
                                            alternatives_scores[alt] = {}
                                        alternatives_scores[alt][criteria] = score_val
                            except (ValueError, TypeError):
                                continue
                
                # Sheet 3: Ranking Result (optional)
                if 'RankingResult' in xls.sheet_names:
                    df_result = pd.read_excel(filepath, sheet_name='RankingResult')
                    ranking_result = {
                        'ranking': [
                            {'alternative': str(row['alternative']), 'score': float(row['score'])}
                            for _, row in df_result.iterrows()
                            if 'alternative' in row and 'score' in row and pd.notna(row['alternative']) and pd.notna(row['score'])
                        ]
                    }
                    if not ranking_result['ranking']:
                        ranking_result = None
                
                ranking_data = {
                    'criteriaWeights': criteria_weights,
                    'alternativesScores': alternatives_scores,
                    'rankingResult': ranking_result
                }
            except Exception as e:
                # If parsing fails, return empty structure
                print(f"Error parsing ranking file: {str(e)}")
                ranking_data = {
                    'criteriaWeights': {},
                    'alternativesScores': {},
                    'rankingResult': None
                }
        else:
            # File doesn't exist - return empty structure
            print(f"Ranking file does not exist: {filepath}")
            ranking_data = {
                'criteriaWeights': {},
                'alternativesScores': {},
                'rankingResult': None
            }
        
        return jsonify({
            'success': True,
            'data': ranking_data
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'data': {
                'criteriaWeights': {},
                'alternativesScores': {},
                'rankingResult': None
            }
        }), 500

@ranking_bp.route('/delete', methods=['POST'])
def delete_ranking():
    """Delete ranking file - simple and direct"""
    try:
        from pathlib import Path
        DATA_DIR = Path(__file__).parent.parent.parent / 'data'
        filepath = DATA_DIR / RANKING_FILE
        
        # Delete file if it exists
        if filepath.exists():
            try:
                filepath.unlink()
            except PermissionError:
                # On Windows, file might be locked. Overwrite with empty structure instead.
                # This effectively "clears" ranking data while avoiding file lock errors.
                try:
                    with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
                        # Write empty sheets to clear any existing data
                        pd.DataFrame(columns=['criteria', 'weight']).to_excel(writer, sheet_name='CriteriaWeights', index=False)
                        pd.DataFrame(columns=['alternative', 'criteria', 'score']).to_excel(writer, sheet_name='AlternativesScores', index=False)
                        pd.DataFrame(columns=['alternative', 'score']).to_excel(writer, sheet_name='RankingResult', index=False)
                except Exception:
                    # If even overwriting fails, just ignore and continue returning success
                    pass
        
        return jsonify({
            'success': True,
            'message': 'Ranking file deleted successfully'
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@ranking_bp.route('/update', methods=['POST'])
def update_ranking():
    """Update ranking data and save to Excel"""
    try:
        data = request.json
        criteria_weights = data.get('criteriaWeights', {})
        alternatives_scores = data.get('alternativesScores', {})
        ranking_result = data.get('rankingResult', None)
        
        DATA_DIR = Path(__file__).parent.parent.parent / 'data'
        DATA_DIR.mkdir(exist_ok=True)
        filepath = DATA_DIR / RANKING_FILE
        
        # Save as Excel with multiple sheets
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            # Sheet 1: Criteria Weights
            if criteria_weights:
                df_weights = pd.DataFrame([
                    {'criteria': k, 'weight': v}
                    for k, v in criteria_weights.items()
                ])
                df_weights.to_excel(writer, sheet_name='CriteriaWeights', index=False)
            
            # Sheet 2: Alternatives Scores
            if alternatives_scores:
                scores_rows = []
                for alt, scores in alternatives_scores.items():
                    if scores and isinstance(scores, dict):
                        for criteria, score in scores.items():
                            score_value = 0
                            if score is not None and score != '':
                                try:
                                    score_value = float(score)
                                except (ValueError, TypeError):
                                    score_value = 0
                            
                            scores_rows.append({
                                'alternative': str(alt),
                                'criteria': str(criteria),
                                'score': score_value
                            })
                
                if scores_rows:
                    df_scores = pd.DataFrame(scores_rows)
                    df_scores.to_excel(writer, sheet_name='AlternativesScores', index=False)
                else:
                    df_scores = pd.DataFrame(columns=['alternative', 'criteria', 'score'])
                    df_scores.to_excel(writer, sheet_name='AlternativesScores', index=False)
            
            # Sheet 3: Ranking Result
            if ranking_result and ranking_result.get('ranking'):
                df_result = pd.DataFrame(ranking_result['ranking'])
                df_result.to_excel(writer, sheet_name='RankingResult', index=False)
        
        return jsonify({
            'success': True,
            'message': 'Ranking updated successfully',
            'data': {
                'criteriaWeights': criteria_weights,
                'alternativesScores': alternatives_scores,
                'rankingResult': ranking_result
            }
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

