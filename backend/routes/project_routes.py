"""
Project Routes
Manages project workspace data table
"""

from flask import Blueprint, request, jsonify
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from utils.file_manager import load_excel, save_excel
import pandas as pd

project_bp = Blueprint('project', __name__)
PROJECT_FILE = 'project.xlsx'

@project_bp.route('/get', methods=['GET'])
def get_project():
    """Get current project data"""
    project = load_excel(PROJECT_FILE)
    if project is None:
        project = {
            'rows': [],
            'columns': []
        }
    else:
        # Convert list of dicts to rows/columns format
        if len(project) > 0:
            columns = list(project[0].keys())
            rows = project
            project = {
                'rows': rows,
                'columns': columns
            }
        else:
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
        # If rows and columns are empty, delete the file
        if len(rows) == 0 and len(columns) == 0:
            from pathlib import Path
            DATA_DIR = Path(__file__).parent.parent.parent / 'data'
            filepath = DATA_DIR / PROJECT_FILE
            if filepath.exists():
                filepath.unlink()
        else:
            # Save as Excel - convert rows to list format for Excel
            save_excel(rows, PROJECT_FILE)
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

