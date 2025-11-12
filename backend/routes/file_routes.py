"""
File Routes
Handles file operations: New, Open, Save, Save As
"""

from flask import Blueprint, request, jsonify, send_file
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from utils.file_manager import (
    save_json, load_json, save_csv, load_csv,
    save_excel, load_excel, list_files
)
import os
import pandas as pd
import io

file_bp = Blueprint('file', __name__)

# Data directory path
DATA_DIR = Path(__file__).parent.parent.parent / 'data'

@file_bp.route('/new', methods=['POST'])
def new_file():
    """Create a new empty project"""
    return jsonify({
        'success': True,
        'message': 'New project created',
        'data': {
            'rows': [],
            'columns': []
        }
    })

@file_bp.route('/open', methods=['POST'])
def open_file():
    """Open an existing project file - receives file content or filename"""
    import io
    
    try:
        # Check if file is uploaded or filename is provided
        if 'file' in request.files:
            # File uploaded from file picker
            file = request.files['file']
            if file.filename == '':
                return jsonify({'success': False, 'error': 'No file selected'}), 400
            
            filename = file.filename
            file_content = file.read()
            file_stream = io.BytesIO(file_content)
        elif request.is_json and request.json and 'filename' in request.json:
            # Filename provided (from saved files list)
            filename = request.json['filename']
            
            # Handle special files (project.xlsx and library.json)
            if filename == 'project.xlsx':
                from utils.file_manager import load_excel
                project = load_excel('project.xlsx')
                if project is None:
                    project = {'rows': [], 'columns': []}
                else:
                    if len(project) > 0:
                        columns = list(project[0].keys())
                        rows = project
                        project = {'rows': rows, 'columns': columns}
                    else:
                        project = {'rows': [], 'columns': []}
                return jsonify({
                    'success': True,
                    'data': project,
                    'filename': filename
                })
            elif filename == 'library.json':
                from utils.file_manager import load_json
                library = load_json('library.json')
                if library is None:
                    library = {'headers': []}
                return jsonify({
                    'success': True,
                    'data': library,
                    'filename': filename
                })
            elif filename == 'ranking.xlsx' or 'ranking' in filename.lower():
                # Handle ranking file with multiple sheets
                from pathlib import Path
                DATA_DIR = Path(__file__).parent.parent.parent / 'data'
                filepath = DATA_DIR / 'ranking.xlsx'
                if not filepath.exists():
                    ranking_data = {
                        'criteriaWeights': {},
                        'alternativesScores': {},
                        'rankingResult': None
                    }
                else:
                    try:
                        xls = pd.ExcelFile(filepath)
                        criteria_weights = {}
                        alternatives_scores = {}
                        ranking_result = None
                        
                        # Sheet 1: Criteria Weights
                        if 'CriteriaWeights' in xls.sheet_names:
                            df_weights = pd.read_excel(filepath, sheet_name='CriteriaWeights')
                            for _, row in df_weights.iterrows():
                                if 'criteria' in row and 'weight' in row:
                                    criteria_weights[row['criteria']] = float(row['weight'])
                        
                        # Sheet 2: Alternatives Scores
                        if 'AlternativesScores' in xls.sheet_names:
                            df_scores = pd.read_excel(filepath, sheet_name='AlternativesScores')
                            current_alternative = None
                            for _, row in df_scores.iterrows():
                                if 'alternative' in row and pd.notna(row['alternative']):
                                    current_alternative = row['alternative']
                                    alternatives_scores[current_alternative] = {}
                                elif current_alternative and 'criteria' in row and 'score' in row:
                                    alternatives_scores[current_alternative][row['criteria']] = float(row['score'])
                        
                        # Sheet 3: Ranking Result (optional)
                        if 'RankingResult' in xls.sheet_names:
                            df_result = pd.read_excel(filepath, sheet_name='RankingResult')
                            ranking_result = {
                                'ranking': [
                                    {'alternative': row['alternative'], 'score': float(row['score'])}
                                    for _, row in df_result.iterrows()
                                ]
                            }
                        
                        ranking_data = {
                            'criteriaWeights': criteria_weights,
                            'alternativesScores': alternatives_scores,
                            'rankingResult': ranking_result
                        }
                    except Exception as e:
                        ranking_data = {
                            'criteriaWeights': {},
                            'alternativesScores': {},
                            'rankingResult': None
                        }
                return jsonify({
                    'success': True,
                    'data': ranking_data,
                    'filename': filename
                })
            
            # Check if file exists in data directory
            filepath = DATA_DIR / filename
            if not filepath.exists():
                return jsonify({'success': False, 'error': 'File not found'}), 404
            
            file_content = filepath.read_bytes()
            file_stream = io.BytesIO(file_content)
        else:
            return jsonify({'success': False, 'error': 'No file provided'}), 400
        
        file_extension = filename.split('.')[-1].lower()
        file_name_lower = filename.lower()
        
        # Read file content based on extension
        if file_extension == 'xlsx':
            # Check if it's a ranking file by checking for multiple sheets
            try:
                file_stream.seek(0)
                xls = pd.ExcelFile(file_stream)
                # Check if it has ranking sheets
                if 'CriteriaWeights' in xls.sheet_names or 'ranking' in file_name_lower:
                    # It's a ranking file
                    criteria_weights = {}
                    alternatives_scores = {}
                    ranking_result = None
                    
                    # Sheet 1: Criteria Weights
                    if 'CriteriaWeights' in xls.sheet_names:
                        file_stream.seek(0)
                        df_weights = pd.read_excel(file_stream, sheet_name='CriteriaWeights')
                        for _, row in df_weights.iterrows():
                            if 'criteria' in row and 'weight' in row:
                                criteria_weights[row['criteria']] = float(row['weight'])
                    
                    # Sheet 2: Alternatives Scores
                    if 'AlternativesScores' in xls.sheet_names:
                        file_stream.seek(0)
                        df_scores = pd.read_excel(file_stream, sheet_name='AlternativesScores')
                        for _, row in df_scores.iterrows():
                            if 'alternative' in row and 'criteria' in row and 'score' in row:
                                alt = str(row['alternative'])
                                criteria = str(row['criteria'])
                                score = row['score']
                                if pd.notna(alt) and pd.notna(criteria) and pd.notna(score):
                                    if alt not in alternatives_scores:
                                        alternatives_scores[alt] = {}
                                    alternatives_scores[alt][criteria] = float(score)
                    
                    # Sheet 3: Ranking Result (optional)
                    if 'RankingResult' in xls.sheet_names:
                        file_stream.seek(0)
                        df_result = pd.read_excel(file_stream, sheet_name='RankingResult')
                        ranking_result = {
                            'ranking': [
                                {'alternative': row['alternative'], 'score': float(row['score'])}
                                for _, row in df_result.iterrows()
                            ]
                        }
                    
                    content = {
                        'criteriaWeights': criteria_weights,
                        'alternativesScores': alternatives_scores,
                        'rankingResult': ranking_result
                    }
                else:
                    # Regular Excel file - read first sheet
                    file_stream.seek(0)
                    df = pd.read_excel(file_stream)
                    content = df.to_dict('records')
            except Exception as e:
                # Fallback to regular Excel reading
                file_stream.seek(0)
                df = pd.read_excel(file_stream)
                content = df.to_dict('records')
        elif file_extension == 'csv':
            file_stream.seek(0)
            df = pd.read_csv(file_stream)
            content = df.to_dict('records')
        elif file_extension == 'json':
            file_stream.seek(0)
            import json
            content = json.load(file_stream)
        else:
            return jsonify({'success': False, 'error': 'Unsupported file type'}), 400
        
        # Convert to rows/columns format if needed
        if isinstance(content, dict):
            # Check if it's library format (has 'headers')
            if 'headers' in content:
                formatted_content = content  # Library format
            # Check if it's ranking format (has 'criteriaWeights' or 'alternativesScores')
            elif 'criteriaWeights' in content or 'alternativesScores' in content:
                formatted_content = content  # Ranking format
            elif 'rows' in content:
                formatted_content = content  # Project format
            else:
                # Try to convert list to project format
                if isinstance(content, list) and len(content) > 0:
                    columns = list(content[0].keys())
                    rows = content
                    formatted_content = {
                        'rows': rows,
                        'columns': columns
                    }
                else:
                    formatted_content = {
                        'rows': [],
                        'columns': []
                    }
        elif isinstance(content, list) and len(content) > 0:
            columns = list(content[0].keys())
            rows = content
            formatted_content = {
                'rows': rows,
                'columns': columns
            }
        else:
            formatted_content = {
                'rows': content if isinstance(content, list) else [],
                'columns': list(content[0].keys()) if isinstance(content, list) and len(content) > 0 else []
            }
        
        return jsonify({
            'success': True,
            'data': formatted_content,
            'filename': filename
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@file_bp.route('/save', methods=['POST'])
def save():
    """Save project or ranking data as Excel file - returns file for download"""
    data = request.json
    file_data = data.get('data')
    filename = data.get('filename', 'project.xlsx')
    
    # Ensure filename has .xlsx extension
    if not filename.endswith('.xlsx'):
        filename = filename + '.xlsx'
    
    try:
        # Check if it's ranking data (has criteriaWeights or alternativesScores)
        if isinstance(file_data, dict) and ('criteriaWeights' in file_data or 'alternativesScores' in file_data):
            # It's ranking data - save with multiple sheets
            criteria_weights = file_data.get('criteriaWeights', {})
            alternatives_scores = file_data.get('alternativesScores', {})
            ranking_result = file_data.get('rankingResult', None)
            
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
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
                        for criteria, score in scores.items():
                            scores_rows.append({
                                'alternative': alt,
                                'criteria': criteria,
                                'score': score
                            })
                    if scores_rows:
                        df_scores = pd.DataFrame(scores_rows)
                        df_scores.to_excel(writer, sheet_name='AlternativesScores', index=False)
                
                # Sheet 3: Ranking Result
                if ranking_result and ranking_result.get('ranking'):
                    df_result = pd.DataFrame(ranking_result['ranking'])
                    df_result.to_excel(writer, sheet_name='RankingResult', index=False)
            
            output.seek(0)
        else:
            # Regular project data - convert to rows format
            rows = file_data.get('rows', []) if isinstance(file_data, dict) else file_data
            
            # Create Excel file in memory
            output = io.BytesIO()
            df = pd.DataFrame(rows)
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df.to_excel(writer, index=False, sheet_name='Project Data')
            output.seek(0)
        
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@file_bp.route('/save-json', methods=['POST'])
def save_json_file():
    """Save data as JSON file - returns file for download"""
    data = request.json
    json_data = data.get('data')
    filename = data.get('filename', 'data.json')
    
    # Ensure filename has .json extension
    if not filename.endswith('.json'):
        filename = filename + '.json'
    
    try:
        import json
        # Create JSON file in memory
        output = io.BytesIO()
        json_str = json.dumps(json_data, indent=2, ensure_ascii=False)
        output.write(json_str.encode('utf-8'))
        output.seek(0)
        
        return send_file(
            output,
            mimetype='application/json',
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@file_bp.route('/list', methods=['GET'])
def list_project_files():
    """List all project files"""
    try:
        files = list_files()
        return jsonify({
            'success': True,
            'files': files
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@file_bp.route('/download/<filename>', methods=['GET'])
def download_file(filename):
    """Download a file"""
    filepath = DATA_DIR / filename
    if not filepath.exists():
        return jsonify({'success': False, 'error': 'File not found'}), 404
    
    return send_file(str(filepath), as_attachment=True)

