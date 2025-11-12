"""
File Manager Utility
Handles saving and loading data in JSON, CSV, and Excel formats
"""

import json
import pandas as pd
import os
from pathlib import Path

# Use absolute path relative to project root
DATA_DIR = Path(__file__).parent.parent.parent / 'data'

def ensure_data_dir():
    """Ensure data directory exists"""
    DATA_DIR.mkdir(exist_ok=True)

def save_json(data, filename):
    """Save data as JSON file"""
    ensure_data_dir()
    filepath = DATA_DIR / filename
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    return str(filepath)

def load_json(filename):
    """Load data from JSON file"""
    filepath = DATA_DIR / filename
    if not filepath.exists():
        return None
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_csv(data, filename):
    """Save data as CSV file"""
    ensure_data_dir()
    filepath = DATA_DIR / filename
    
    if isinstance(data, list):
        if len(data) > 0 and isinstance(data[0], dict):
            df = pd.DataFrame(data)
        else:
            df = pd.DataFrame(data)
    elif isinstance(data, dict):
        df = pd.DataFrame([data])
    else:
        df = pd.DataFrame(data)
    
    df.to_csv(filepath, index=False, encoding='utf-8')
    return str(filepath)

def load_csv(filename):
    """Load data from CSV file"""
    filepath = DATA_DIR / filename
    if not filepath.exists():
        return None
    return pd.read_csv(filepath).to_dict('records')

def save_excel(data, filename, sheet_name='Sheet1'):
    """Save data as Excel file"""
    ensure_data_dir()
    filepath = DATA_DIR / filename
    
    if isinstance(data, list):
        if len(data) > 0 and isinstance(data[0], dict):
            df = pd.DataFrame(data)
        else:
            df = pd.DataFrame(data)
    elif isinstance(data, dict):
        df = pd.DataFrame([data])
    else:
        df = pd.DataFrame(data)
    
    with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name=sheet_name, index=False)
    
    return str(filepath)

def load_excel(filename, sheet_name='Sheet1'):
    """Load data from Excel file"""
    filepath = DATA_DIR / filename
    if not filepath.exists():
        return None
    return pd.read_excel(filepath, sheet_name=sheet_name).to_dict('records')

def list_files(extension=None):
    """List all files in data directory"""
    ensure_data_dir()
    files = []
    for file in DATA_DIR.iterdir():
        if file.is_file():
            if extension is None or file.suffix == extension:
                files.append({
                    'name': file.name,
                    'path': str(file),
                    'size': file.stat().st_size
                })
    return files

