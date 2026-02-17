"""
HAZOP Analysis Tool - Flask Backend
Main application entry point
"""

from flask import Flask, jsonify
from flask_cors import CORS
import sys
from pathlib import Path
# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from routes.file_routes import file_bp
from routes.library_routes import library_bp
from routes.project_routes import project_bp
from routes.methodology_routes import methodology_bp
from routes.ranking_routes import ranking_bp
from routes.report_routes import report_bp
import os

app = Flask(__name__)
# Enable CORS for React frontend with explicit configuration
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

# Register blueprints
app.register_blueprint(file_bp, url_prefix='/api/file')
app.register_blueprint(library_bp, url_prefix='/api/library')
app.register_blueprint(project_bp, url_prefix='/api/project')
app.register_blueprint(methodology_bp, url_prefix='/api/methodology')
app.register_blueprint(ranking_bp, url_prefix='/api/ranking')
app.register_blueprint(report_bp, url_prefix='/api/report')

# Create data directory if it doesn't exist
from config import get_data_dir
DATA_DIR = get_data_dir()
os.makedirs(DATA_DIR, exist_ok=True)

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return {'status': 'ok', 'message': 'HAZOP Backend is running'}

# Error handler to ensure CORS headers are sent even on errors
@app.errorhandler(500)
def handle_500_error(e):
    response = jsonify({
        'success': False,
        'error': str(e) if hasattr(e, 'description') else 'Internal server error'
    })
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response, 500

@app.errorhandler(Exception)
def handle_exception(e):
    response = jsonify({
        'success': False,
        'error': str(e) if hasattr(e, 'description') else 'An error occurred'
    })
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response, 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)

