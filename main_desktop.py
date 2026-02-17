"""
HAZOP Analysis Tool - Desktop Launcher
Starts backend (port 5000), frontend server (port 3000), and opens app in native window.
"""
import sys
import os
import threading
import time
import webbrowser
from pathlib import Path

# Set data directory BEFORE any backend imports (for EXE/frozen mode)
if getattr(sys, 'frozen', False):
    BASE_DIR = Path(sys.executable).parent
else:
    BASE_DIR = Path(__file__).parent

DATA_DIR = BASE_DIR / 'data'
DATA_DIR.mkdir(exist_ok=True)
os.environ['HAZOP_DATA_DIR'] = str(DATA_DIR)

# Add backend to path
if getattr(sys, 'frozen', False):
    MEIPASS = Path(sys._MEIPASS)
    BACKEND_DIR = MEIPASS / 'backend'
    FRONTEND_DIST = MEIPASS / 'frontend_dist'
else:
    BACKEND_DIR = BASE_DIR / 'backend'
    FRONTEND_DIST = BASE_DIR / 'frontend' / 'dist'
sys.path.insert(0, str(BACKEND_DIR))

FLASK_PORT = 5000
FRONTEND_PORT = 3000
APP_URL = f'http://localhost:{FRONTEND_PORT}'


def run_flask():
    """Run Flask backend on port 5000."""
    os.chdir(str(BACKEND_DIR))
    from app import app
    app.run(host='127.0.0.1', port=FLASK_PORT, debug=False, use_reloader=False)


def run_frontend_server():
    """Serve frontend static files on port 3000 using HTTPServer."""
    from http.server import HTTPServer, SimpleHTTPRequestHandler

    class SPAHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(FRONTEND_DIST), **kwargs)

        def do_GET(self):
            # SPA routing: serve index.html for client-side routes (e.g. /file, /project)
            path = Path(self.translate_path(self.path))
            if not path.exists() or not path.is_file():
                self.path = '/index.html'
            return super().do_GET()

        def end_headers(self):
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
            super().end_headers()

        def log_message(self, format, *args):
            pass

    server = HTTPServer(('127.0.0.1', FRONTEND_PORT), SPAHandler)
    server.serve_forever()


def wait_for_server(url, timeout=15):
    """Wait until server is ready."""
    import urllib.request
    import urllib.error
    start = time.time()
    while time.time() - start < timeout:
        try:
            urllib.request.urlopen(url, timeout=1)
            return True
        except (urllib.error.URLError, OSError):
            time.sleep(0.3)
    return False


def main():
    if not FRONTEND_DIST.exists():
        print('Error: Frontend not built. Run: cd frontend && npm run build')
        sys.exit(1)

    # Start Flask backend
    flask_thread = threading.Thread(target=run_flask, daemon=True)
    flask_thread.start()

    # Start frontend static server
    frontend_thread = threading.Thread(target=run_frontend_server, daemon=True)
    frontend_thread.start()

    # Wait for both servers
    if not wait_for_server(f'http://127.0.0.1:{FLASK_PORT}/api/health'):
        print('Error: Backend failed to start')
        sys.exit(1)
    if not wait_for_server(APP_URL):
        print('Error: Frontend server failed to start')
        sys.exit(1)

    # Open in pywebview or fallback to browser
    try:
        import webview
        webview.create_window('HAZOP Analysis Tool', APP_URL, width=1280, height=800)
        webview.start()
    except ImportError:
        webbrowser.open(APP_URL)
        print('App opened in browser. Install pywebview for native window: pip install pywebview')
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
