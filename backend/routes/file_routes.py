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
            
            # Check if file exists in data directory
            filepath = DATA_DIR / filename
            if not filepath.exists():
                return jsonify({'success': False, 'error': 'File not found'}), 404
            
            file_content = filepath.read_bytes()
            file_stream = io.BytesIO(file_content)
        else:
            return jsonify({'success': False, 'error': 'No file provided'}), 400
        
        file_extension = filename.split('.')[-1].lower()
        
        # Read file content based on extension
        if file_extension == 'xlsx':
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
    """Save project data as Excel file - returns file for download"""
    data = request.json
    project_data = data.get('data')
    filename = data.get('filename', 'project.xlsx')
    
    # Ensure filename has .xlsx extension
    if not filename.endswith('.xlsx'):
        filename = filename + '.xlsx'
    
    try:
        # Convert project data to rows format
        rows = project_data.get('rows', [])
        
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

