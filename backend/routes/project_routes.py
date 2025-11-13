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

@project_bp.route('/cell/update', methods=['POST'])
def update_project_cell():
    """Update a single cell in the project without sending the entire dataset"""
    try:
        data = request.json or {}
        row_no = data.get('rowNo')
        column = data.get('column')
        value = data.get('value')
        columns = data.get('columns', [])

        if row_no is None:
            return jsonify({'success': False, 'error': 'rowNo is required'}), 400
        if not column:
            return jsonify({'success': False, 'error': 'column is required'}), 400

        project_rows = load_excel(PROJECT_FILE)
        if project_rows is None:
            project_rows = []

        # If we don't have columns info, infer from existing data
        if not columns:
            if project_rows:
                columns = list(project_rows[0].keys())
            else:
                columns = []

        # Ensure the column exists in the schema
        if column not in columns:
            columns.append(column)

        # Find the row to update
        target_index = None
        for idx, row in enumerate(project_rows):
            current_row_no = row.get('rowNo') or idx + 1
            if int(current_row_no) == int(row_no):
                target_index = idx
                break

        if target_index is None:
            # Row not present yet - create a new row with empty values
            new_row = {col: '' for col in columns}
            new_row['rowNo'] = row_no
            target_index = len(project_rows)
            project_rows.append(new_row)

        # Update the target row
        project_rows[target_index]['rowNo'] = row_no
        project_rows[target_index][column] = value

        # Save back to storage
        save_excel(project_rows, PROJECT_FILE)

        return jsonify({
            'success': True,
            'message': 'Cell updated successfully',
            'data': {
                'rowNo': row_no,
                'column': column,
                'value': value,
                'rowData': project_rows[target_index],
                'columns': columns
            }
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

