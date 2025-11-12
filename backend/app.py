"""
HAZOP Analysis Tool - Flask Backend
Main application entry point
"""

from flask import Flask
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
CORS(app)  # Enable CORS for React frontend

# Register blueprints
app.register_blueprint(file_bp, url_prefix='/api/file')
app.register_blueprint(library_bp, url_prefix='/api/library')
app.register_blueprint(project_bp, url_prefix='/api/project')
app.register_blueprint(methodology_bp, url_prefix='/api/methodology')
app.register_blueprint(ranking_bp, url_prefix='/api/ranking')
app.register_blueprint(report_bp, url_prefix='/api/report')

# Create data directory if it doesn't exist
DATA_DIR = Path(__file__).parent.parent / 'data'
os.makedirs(DATA_DIR, exist_ok=True)

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return {'status': 'ok', 'message': 'HAZOP Backend is running'}

if __name__ == '__main__':
    app.run(debug=True, port=5000)

