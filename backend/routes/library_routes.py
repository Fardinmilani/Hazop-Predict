"""
Library Routes
Manages library configuration (headers and options)
"""

from flask import Blueprint, request, jsonify
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from utils.file_manager import save_json, load_json
from config import get_data_dir

library_bp = Blueprint('library', __name__)
LIBRARY_FILE = 'library.json'

@library_bp.route('/get', methods=['GET'])
def get_library():
    """Get library configuration"""
    library = load_json(LIBRARY_FILE)
    if library is None:
        library = {'headers': []}
    
    # Add backward compatibility: ensure all headers have 'type' field
    if 'headers' in library:
        for header in library['headers']:
            if 'type' not in header:
                # Auto-detect type: if has options, it's select, otherwise text
                if header.get('options') and len(header.get('options', [])) > 0:
                    header['type'] = 'select'
                else:
                    header['type'] = 'text'
    
    return jsonify({
        'success': True,
        'data': library
    })

@library_bp.route('/save', methods=['POST'])
def save_library():
    """Save library configuration"""
    data = request.json
    library_data = data.get('data', {})
    
    try:
        # If headers are empty, delete the file
        if not library_data.get('headers') or len(library_data.get('headers', [])) == 0:
            from pathlib import Path
            DATA_DIR = get_data_dir()
            filepath = DATA_DIR / LIBRARY_FILE
            if filepath.exists():
                filepath.unlink()
        else:
            save_json(library_data, LIBRARY_FILE)
        return jsonify({
            'success': True,
            'message': 'Library saved successfully'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@library_bp.route('/header/add', methods=['POST'])
def add_header():
    """Add a new header to library"""
    data = request.json
    header_name = data.get('name')
    options = data.get('options', [])
    header_type = data.get('type', 'text')
    
    # Auto-set type to 'select' if options exist
    if options and len(options) > 0:
        header_type = 'select'
    
    library = load_json(LIBRARY_FILE)
    if library is None:
        library = {'headers': []}
    
    # Check if header already exists
    for header in library['headers']:
        if header['name'] == header_name:
            return jsonify({'success': False, 'error': 'Header already exists'}), 400
    
    library['headers'].append({
        'name': header_name,
        'options': options,
        'type': header_type
    })
    
    try:
        save_json(library, LIBRARY_FILE)
        return jsonify({
            'success': True,
            'message': 'Header added successfully',
            'data': library
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@library_bp.route('/header/update', methods=['PUT'])
def update_header():
    """Update an existing header"""
    data = request.json
    header_name = data.get('name')
    new_name = data.get('newName', header_name)
    options = data.get('options', [])
    header_type = data.get('type', 'text')
    
    # Auto-set type to 'select' if options exist
    if options and len(options) > 0:
        header_type = 'select'
    
    library = load_json(LIBRARY_FILE)
    if library is None:
        return jsonify({'success': False, 'error': 'Library not found'}), 404
    
    # Find and update header
    found = False
    for header in library['headers']:
        if header['name'] == header_name:
            header['name'] = new_name
            header['options'] = options
            header['type'] = header_type
            found = True
            break
    
    if not found:
        return jsonify({'success': False, 'error': 'Header not found'}), 404
    
    try:
        save_json(library, LIBRARY_FILE)
        return jsonify({
            'success': True,
            'message': 'Header updated successfully',
            'data': library
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@library_bp.route('/header/delete', methods=['DELETE'])
def delete_header():
    """Delete a header from library"""
    data = request.json
    header_name = data.get('name')
    
    library = load_json(LIBRARY_FILE)
    if library is None:
        return jsonify({'success': False, 'error': 'Library not found'}), 404
    
    # Remove header
    library['headers'] = [h for h in library['headers'] if h['name'] != header_name]
    
    try:
        save_json(library, LIBRARY_FILE)
        return jsonify({
            'success': True,
            'message': 'Header deleted successfully',
            'data': library
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

