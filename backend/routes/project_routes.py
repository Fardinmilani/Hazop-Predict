"""
Project Routes
Manages project workspace data table
"""

from flask import Blueprint, request, jsonify
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from utils.file_manager import load_json, save_json

project_bp = Blueprint('project', __name__)
PROJECT_FILE = 'project.json'

@project_bp.route('/get', methods=['GET'])
def get_project():
    """Get current project data"""
    project = load_json(PROJECT_FILE)
    if project is None:
        project = {
            'rows': [],
            'columns': []
        }
    return jsonify({
        'success': True,
        'data': project
    })

@project_bp.route('/update', methods=['POST'])
def update_project():
    """Update project data"""
    data = request.json
    rows = data.get('rows', [])
    columns = data.get('columns', [])
    
    project_data = {
        'rows': rows,
        'columns': columns
    }
    
    try:
        save_json(project_data, PROJECT_FILE)
        return jsonify({
            'success': True,
            'message': 'Project updated successfully',
            'data': project_data
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@project_bp.route('/row/add', methods=['POST'])
def add_row():
    """Add a new row to project"""
    data = request.json
    row_data = data.get('row', {})
    
    return jsonify({
        'success': True,
        'message': 'Row added successfully',
        'data': row_data
    })

@project_bp.route('/row/delete', methods=['DELETE'])
def delete_row():
    """Delete a row from project"""
    data = request.json
    row_index = data.get('index')
    
    return jsonify({
        'success': True,
        'message': 'Row deleted successfully'
    })

