"""
Configuration - supports both dev and PyInstaller frozen/EXE mode.
When HAZOP_DATA_DIR env var is set (by main_desktop.py), use that for writable data.
"""
import os
import sys
from pathlib import Path


def get_data_dir():
    """Return data directory path. Uses HAZOP_DATA_DIR if set (EXE mode)."""
    if os.environ.get('HAZOP_DATA_DIR'):
        return Path(os.environ['HAZOP_DATA_DIR'])
    # Dev mode: project_root/data
    return Path(__file__).parent.parent / 'data'


def get_base_dir():
    """Return base directory for frozen vs dev mode."""
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).parent
    return Path(__file__).parent.parent


DATA_DIR = get_data_dir()
