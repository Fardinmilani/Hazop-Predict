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
PROJECT_FILE = 'project.xlsx'

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
            'rankingResult': None,
            'columns': []
        }
        
        if filepath.exists():
            try:
                # Load from multiple sheets
                xls = pd.ExcelFile(filepath)
                criteria_weights = {}
                alternatives_scores = {}
                ranking_result = None
                ranking_columns = []
                
                # Sheet 0: Ranking Columns (optional)
                if 'RankingColumns' in xls.sheet_names:
                    df_columns = pd.read_excel(filepath, sheet_name='RankingColumns')
                    for _, row in df_columns.iterrows():
                        if 'column' in row:
                            col = str(row['column']).strip()
                            if pd.notna(col) and col:
                                ranking_columns.append(col)
                
                # Sheet 1: Criteria Weights
                if 'CriteriaWeights' in xls.sheet_names:
                    df_weights = pd.read_excel(filepath, sheet_name='CriteriaWeights')
                    for _, row in df_weights.iterrows():
                        if 'criteria' in row and 'weight' in row:
                            try:
                                criteria = str(row['criteria']).strip()
                                weight = row['weight']
                                if pd.notna(criteria) and pd.notna(weight):
                                    criteria_weights[criteria] = float(weight)
                            except (ValueError, TypeError):
                                continue
                
                # Sheet 2: Alternatives Scores
                if 'AlternativesScores' in xls.sheet_names:
                    df_scores = pd.read_excel(filepath, sheet_name='AlternativesScores')
                    # Check if it's new format (table with alternative column + criteria columns)
                    # or old format (alternative, criteria, score columns)
                    if (
                        'alternative' in df_scores.columns
                        and 'criteria' in df_scores.columns
                        and 'score' in df_scores.columns
                    ):
                        # Old format: 3 columns (alternative, criteria, score)
                        for _, row in df_scores.iterrows():
                            if 'alternative' in row and 'criteria' in row and 'score' in row:
                                try:
                                    alt = str(row['alternative']).strip()
                                    criteria = str(row['criteria']).strip()
                                    score = row['score']
                                    if pd.notna(alt) and pd.notna(criteria) and pd.notna(score):
                                        score_val = float(score)
                                        if alt not in alternatives_scores:
                                            alternatives_scores[alt] = {}
                                        alternatives_scores[alt][criteria] = score_val
                                except (ValueError, TypeError):
                                    continue
                    else:
                        # New format: alternative column + criteria columns
                        if 'alternative' in df_scores.columns:
                            # Get all criteria columns (all columns except 'alternative')
                            criteria_cols = [col for col in df_scores.columns if col != 'alternative']
                            for _, row in df_scores.iterrows():
                                try:
                                    alt = str(row['alternative']).strip()
                                    if pd.notna(alt) and alt:
                                        alternatives_scores[alt] = {}
                                        for criteria in criteria_cols:
                                            score = row[criteria]
                                            if pd.notna(score):
                                                try:
                                                    score_val = float(score)
                                                    alternatives_scores[alt][criteria] = score_val
                                                except (ValueError, TypeError):
                                                    continue
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
                    'rankingResult': ranking_result,
                    'columns': ranking_columns
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
                'rankingResult': None,
                'columns': []
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
                'rankingResult': None,
                'columns': []
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
                        pd.DataFrame(columns=['alternative']).to_excel(writer, sheet_name='AlternativesScores', index=False)
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

@ranking_bp.route('/cell/update', methods=['POST'])
def update_ranking_cell():
    """Update a single cell in ranking (score or weight).

    This implementation works directly on the AlternativesScores sheet as a table
    (row = alternative, column = criteria) to avoid shuffling or losing existing
    scores when a single cell changes.
    """
    try:
        data = request.json
        cell_type = data.get('type')  # 'score' or 'weight'
        alternative = data.get('alternative', '')
        criteria = data.get('criteria', '')
        value = data.get('value', '')

        DATA_DIR = Path(__file__).parent.parent.parent / 'data'
        DATA_DIR.mkdir(exist_ok=True)
        filepath = DATA_DIR / RANKING_FILE

        # --- Load existing meta data (columns, weights, result) ---
        ranking_columns = []
        criteria_weights = {}
        ranking_result = None
        df_scores = None

        if filepath.exists():
            try:
                xls = pd.ExcelFile(filepath)

                # Ranking columns
                if 'RankingColumns' in xls.sheet_names:
                    df_columns = pd.read_excel(filepath, sheet_name='RankingColumns')
                    for _, row in df_columns.iterrows():
                        if 'column' in row and pd.notna(row['column']):
                            col_name = str(row['column']).strip()
                            if col_name:
                                ranking_columns.append(col_name)

                # Criteria weights
                if 'CriteriaWeights' in xls.sheet_names:
                    df_weights = pd.read_excel(filepath, sheet_name='CriteriaWeights')
                    for _, row in df_weights.iterrows():
                        if 'criteria' in row and 'weight' in row:
                            try:
                                crit_name = str(row['criteria']).strip()
                                weight = row['weight']
                                if pd.notna(crit_name) and pd.notna(weight):
                                    criteria_weights[crit_name] = float(weight)
                            except (ValueError, TypeError):
                                continue

                # Ranking result (preserve if exists)
                if 'RankingResult' in xls.sheet_names:
                    df_result = pd.read_excel(filepath, sheet_name='RankingResult')
                    tmp_ranking = [
                        {
                            'alternative': str(row['alternative']),
                            'score': float(row['score'])
                        }
                        for _, row in df_result.iterrows()
                        if 'alternative' in row and 'score' in row
                        and pd.notna(row['alternative']) and pd.notna(row['score'])
                    ]
                    if tmp_ranking:
                        ranking_result = {'ranking': tmp_ranking}

                # Alternatives scores as table
                if 'AlternativesScores' in xls.sheet_names:
                    df_scores_raw = pd.read_excel(filepath, sheet_name='AlternativesScores')
                    if (
                        'alternative' in df_scores_raw.columns and
                        'criteria' in df_scores_raw.columns and
                        'score' in df_scores_raw.columns
                    ):
                        # Old format: pivot to wide table
                        df_scores = (
                            df_scores_raw
                            .dropna(subset=['alternative'])
                            .pivot_table(
                                index='alternative',
                                columns='criteria',
                                values='score',
                                aggfunc='first'
                            )
                            .reset_index()
                        )
                        df_scores.columns.name = None
                    else:
                        # New format already (wide table)
                        df_scores = df_scores_raw
            except Exception as e:
                print(f"Error loading ranking file: {str(e)}")

        # Ensure we have a DataFrame for AlternativesScores
        if df_scores is None:
            base_cols = ['alternative'] + list(ranking_columns)
            df_scores = pd.DataFrame(columns=base_cols)
        else:
            # Ensure 'alternative' exists and is first
            if 'alternative' not in df_scores.columns:
                df_scores.insert(0, 'alternative', None)
            else:
                other_cols = [c for c in df_scores.columns if c != 'alternative']
                df_scores = df_scores[['alternative'] + other_cols]

        # Make sure all known ranking columns exist in df_scores
        for col in ranking_columns:
            if col not in df_scores.columns:
                df_scores[col] = pd.NA

        # --- Initialize missing alternatives based on project rows (if available) ---
        # This ensures that when a new ranking file is created and the user starts
        # entering scores cell-by-cell, we still keep a full row per project row
        # instead of only creating the specific alternative that was edited.
        try:
            project_rows = load_excel(PROJECT_FILE) or []
        except Exception:
            project_rows = []

        if project_rows:
            # Build a set of existing alternative keys in the current scores table
            existing_alternatives = set(
                df_scores['alternative']
                .dropna()
                .astype(str)
                .str.strip()
                .tolist()
            )

            # For each project row, ensure there is a corresponding alternative row
            for idx, row in enumerate(project_rows):
                row_no = row.get('rowNo') or idx + 1
                try:
                    row_no_int = int(row_no)
                except (TypeError, ValueError):
                    row_no_int = idx + 1
                alt_key = f"Alternative {row_no_int}"

                if alt_key not in existing_alternatives:
                    new_row = {col_name: pd.NA for col_name in df_scores.columns}
                    new_row['alternative'] = alt_key
                    df_scores = pd.concat(
                        [df_scores, pd.DataFrame([new_row])],
                        ignore_index=True
                    )
                    existing_alternatives.add(alt_key)

        # --- Apply the specific cell update ---
        if cell_type == 'weight':
            if criteria:
                try:
                    weight_value = float(value) if value != '' else 0
                    criteria_weights[criteria] = weight_value
                except (ValueError, TypeError):
                    criteria_weights[criteria] = 0

                # Ensure criteria appears as a column / ranking column
                if criteria not in ranking_columns:
                    ranking_columns.append(criteria)
                if criteria not in df_scores.columns:
                    df_scores[criteria] = pd.NA

        elif cell_type == 'score':
            if alternative and criteria:
                # Ensure criteria column exists
                if criteria not in df_scores.columns:
                    df_scores[criteria] = pd.NA
                    if criteria not in ranking_columns:
                        ranking_columns.append(criteria)

                alt_str = str(alternative).strip()
                mask = df_scores['alternative'].astype(str).str.strip() == alt_str

                if not mask.any():
                    # Add a new row for this alternative
                    new_row = {col_name: pd.NA for col_name in df_scores.columns}
                    new_row['alternative'] = alt_str
                    df_scores = pd.concat(
                        [df_scores, pd.DataFrame([new_row])],
                        ignore_index=True
                    )
                    mask = df_scores['alternative'].astype(str).str.strip() == alt_str

                try:
                    score_value = float(value) if value != '' else 0
                except (ValueError, TypeError):
                    score_value = 0

                df_scores.loc[mask, criteria] = score_value

        # Normalize column order: alternative + sorted criteria columns
        criteria_cols_in_df = [c for c in df_scores.columns if c != 'alternative']
        all_criteria_cols = sorted(set(criteria_cols_in_df + list(ranking_columns)))
        if df_scores.shape[0] > 0:
            df_scores = df_scores[['alternative'] + all_criteria_cols]
        else:
            df_scores = pd.DataFrame(columns=['alternative'] + all_criteria_cols)

        # --- Save back to Excel ---
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            if ranking_columns:
                df_columns = pd.DataFrame([{'column': col} for col in ranking_columns])
                df_columns.to_excel(writer, sheet_name='RankingColumns', index=False)

            if criteria_weights:
                df_weights = pd.DataFrame(
                    [{'criteria': k, 'weight': v} for k, v in criteria_weights.items()]
                )
                df_weights.to_excel(writer, sheet_name='CriteriaWeights', index=False)

            # AlternativesScores sheet (always wide format)
            if df_scores is not None:
                if df_scores.empty:
                    pd.DataFrame(columns=['alternative'] + all_criteria_cols).to_excel(
                        writer, sheet_name='AlternativesScores', index=False
                    )
                else:
                    df_scores.to_excel(writer, sheet_name='AlternativesScores', index=False)

            if ranking_result and ranking_result.get('ranking'):
                df_result = pd.DataFrame(ranking_result['ranking'])
                df_result.to_excel(writer, sheet_name='RankingResult', index=False)

        return jsonify({'success': True, 'message': 'Cell updated successfully'})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@ranking_bp.route('/update', methods=['POST'])
def update_ranking():
    """Update ranking data and save to Excel"""
    try:
        data = request.json
        criteria_weights = data.get('criteriaWeights', {})
        alternatives_scores = data.get('alternativesScores', {})
        ranking_result = data.get('rankingResult', None)
        ranking_columns = data.get('columns', [])
        
        DATA_DIR = Path(__file__).parent.parent.parent / 'data'
        DATA_DIR.mkdir(exist_ok=True)
        filepath = DATA_DIR / RANKING_FILE
        
        # Save as Excel with multiple sheets
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            # Sheet 0: Ranking Columns
            if ranking_columns:
                df_columns = pd.DataFrame([
                    {'column': col}
                    for col in ranking_columns
                ])
                df_columns.to_excel(writer, sheet_name='RankingColumns', index=False)
            
            # Sheet 1: Criteria Weights
            if criteria_weights:
                df_weights = pd.DataFrame([
                    {'criteria': k, 'weight': v}
                    for k, v in criteria_weights.items()
                ])
                df_weights.to_excel(writer, sheet_name='CriteriaWeights', index=False)
            
            # Sheet 2: Alternatives Scores - New format: table with alternative column + criteria columns
            if alternatives_scores:
                # Get all unique criteria from all alternatives
                all_criteria = set()
                for alt, scores in alternatives_scores.items():
                    if scores and isinstance(scores, dict):
                        all_criteria.update(scores.keys())
                
                # Also include criteria from ranking_columns if available
                if ranking_columns:
                    all_criteria.update(ranking_columns)
                
                all_criteria = sorted(list(all_criteria))
                
                # Build table structure: alternative column + criteria columns
                scores_rows = []
                for alt in sorted(alternatives_scores.keys()):
                    row = {'alternative': str(alt)}
                    scores = alternatives_scores.get(alt, {})
                    for criteria in all_criteria:
                        score_value = scores.get(criteria, '')
                        if score_value is not None and score_value != '':
                            try:
                                row[criteria] = float(score_value)
                            except (ValueError, TypeError):
                                row[criteria] = ''
                        else:
                            row[criteria] = ''
                    scores_rows.append(row)
                
                if scores_rows:
                    df_scores = pd.DataFrame(scores_rows)
                    df_scores.to_excel(writer, sheet_name='AlternativesScores', index=False)
                else:
                    # Empty structure with alternative column
                    df_scores = pd.DataFrame(columns=['alternative'])
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
                'rankingResult': ranking_result,
                'columns': ranking_columns
            }
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

