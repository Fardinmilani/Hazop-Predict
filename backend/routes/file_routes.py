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
    """Open an existing project file"""
    data = request.json
    filename = data.get('filename')
    file_type = data.get('type', 'json')  # json, csv, xlsx
    
    try:
        if file_type == 'json':
            content = load_json(filename)
        elif file_type == 'csv':
            content = load_csv(filename)
        elif file_type == 'xlsx':
            content = load_excel(filename)
        else:
            return jsonify({'success': False, 'error': 'Invalid file type'}), 400
        
        if content is None:
            return jsonify({'success': False, 'error': 'File not found'}), 404
        
        return jsonify({
            'success': True,
            'data': content,
            'filename': filename
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@file_bp.route('/save', methods=['POST'])
def save():
    """Save project data"""
    data = request.json
    project_data = data.get('data')
    filename = data.get('filename', 'project.json')
    file_type = data.get('type', 'json')  # json, csv, xlsx
    
    try:
        if file_type == 'json':
            filepath = save_json(project_data, filename)
        elif file_type == 'csv':
            filepath = save_csv(project_data, filename)
        elif file_type == 'xlsx':
            filepath = save_excel(project_data, filename)
        else:
            return jsonify({'success': False, 'error': 'Invalid file type'}), 400
        
        return jsonify({
            'success': True,
            'message': 'File saved successfully',
            'filepath': filepath,
            'filename': filename
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@file_bp.route('/save-as', methods=['POST'])
def save_as():
    """Save project data with new filename"""
    return save()  # Same logic as save

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

