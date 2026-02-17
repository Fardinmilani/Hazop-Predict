"""
Build script for creating HAZOP Analysis Tool EXE.
Run: python build_exe.py

Prerequisites:
1. pip install -r requirements.txt
2. pip install pyinstaller pywebview
3. cd frontend && npm install && npm run build
"""
import subprocess
import sys
from pathlib import Path

BASE = Path(__file__).parent
FRONTEND_DIST = BASE / 'frontend' / 'dist'


def run(cmd, cwd=None):
    print(f"> {' '.join(cmd)}")
    r = subprocess.run(cmd, cwd=cwd or BASE)
    if r.returncode != 0:
        sys.exit(r.returncode)


def main():
    # 1. Build frontend (skip if dist already exists)
    if not FRONTEND_DIST.exists():
        if not (BASE / 'frontend' / 'package.json').exists():
            print("Error: frontend/package.json not found")
            sys.exit(1)
        run(['npm', 'run', 'build'], cwd=BASE / 'frontend')
        if not FRONTEND_DIST.exists():
            print("Error: frontend build failed. Run manually: cd frontend && npm run build")
            sys.exit(1)
    else:
        print("Using existing frontend build (frontend/dist)")

    # 2. Run PyInstaller to produce a single EXE with its own window.
    #    We use --onefile so the user only sees one .exe; data files
    #    (frontend_dist + backend package) are bundled via --add-data and
    #    extracted by PyInstaller at runtime into sys._MEIPASS, which
    #    main_desktop.py already handles. Ports (5000 for Flask, 3000 for
    #    static frontend) and the app logic are unchanged.
    sep = ';' if sys.platform == 'win32' else ':'
    backend_dir = BASE / 'backend'
    run([
        sys.executable, '-m', 'PyInstaller',
        '--clean',
        '--noconfirm',
        '--onefile',  # Single EXE as requested
        '--windowed',  # No console window
        '--name', 'HAZOP-Analysis-Tool',
        '--paths', str(BASE),
        '--paths', str(backend_dir),
        '--add-data', f'{FRONTEND_DIST}{sep}frontend_dist',
        '--add-data', f'{backend_dir}{sep}backend',
        '--hidden-import', 'app',
        '--hidden-import', 'config',
        '--hidden-import', 'sklearn.utils._typedefs',
        '--hidden-import', 'sklearn.utils._heap',
        '--hidden-import', 'sklearn.neighbors._typedefs',
        '--hidden-import', 'sklearn.neighbors._quad_tree',
        '--collect-all', 'sklearn',
        '--collect-all', 'xgboost',
        '--collect-all', 'catboost',
        'main_desktop.py'
    ])

    print("\nDone! EXE location: dist/HAZOP-Analysis-Tool.exe")
    print("Data folder (./data) will be created next to the executable on first run.")


if __name__ == '__main__':
    main()
