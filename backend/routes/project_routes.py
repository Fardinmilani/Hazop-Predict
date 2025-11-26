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
from openpyxl.styles import Alignment

project_bp = Blueprint('project', __name__)
PROJECT_FILE = 'project.xlsx'

def save_project_with_ranking(rows, columns=None, filename=PROJECT_FILE):
    """Save project data while preserving ranking sheets and column order"""
    from pathlib import Path
    DATA_DIR = Path(__file__).parent.parent.parent / 'data'
    filepath = DATA_DIR / filename
    
    # Load existing ranking data and column order if file exists
    ranking_columns = []
    criteria_weights = {}
    alternatives_scores_df = None
    ranking_result = None
    existing_project_col_order = None  # Store existing Project sheet column order
    
    if filepath.exists():
        try:
            xls = pd.ExcelFile(filepath)
            
            # Get existing Project sheet column order FIRST (before any operations)
            # IMPORTANT: Ensure rowNo is always first in the order we read
            if 'Project' in xls.sheet_names:
                try:
                    df_existing_project = pd.read_excel(filepath, sheet_name='Project')
                    existing_project_col_order_raw = list(df_existing_project.columns)
                    # Ensure rowNo is first, regardless of Excel order
                    if 'rowNo' in existing_project_col_order_raw:
                        other_cols = [c for c in existing_project_col_order_raw if c != 'rowNo']
                        existing_project_col_order = ['rowNo'] + other_cols
                    else:
                        existing_project_col_order = existing_project_col_order_raw
                except:
                    pass
            elif 'Sheet1' in xls.sheet_names:
                try:
                    df_existing_project = pd.read_excel(filepath, sheet_name='Sheet1')
                    existing_project_col_order_raw = list(df_existing_project.columns)
                    # Ensure rowNo is first, regardless of Excel order
                    if 'rowNo' in existing_project_col_order_raw:
                        other_cols = [c for c in existing_project_col_order_raw if c != 'rowNo']
                        existing_project_col_order = ['rowNo'] + other_cols
                    else:
                        existing_project_col_order = existing_project_col_order_raw
                except:
                    pass
            
            # Load ranking columns
            if 'RankingColumns' in xls.sheet_names:
                df_columns = pd.read_excel(filepath, sheet_name='RankingColumns')
                ranking_columns = [
                    str(row['column']).strip() 
                    for _, row in df_columns.iterrows() 
                    if 'column' in row and pd.notna(row['column'])
                ]
            
            # Load criteria weights
            if 'CriteriaWeights' in xls.sheet_names:
                df_weights = pd.read_excel(filepath, sheet_name='CriteriaWeights')
                for _, row in df_weights.iterrows():
                    if 'criteria' in row and 'weight' in row:
                        try:
                            criteria = str(row['criteria']).strip()
                            weight = row['weight']
                            if pd.notna(criteria) and pd.notna(weight):
                                criteria_weights[criteria] = float(weight)
                        except (ValueError, TypeError):
                            continue
            
            # Load alternatives scores
            if 'AlternativesScores' in xls.sheet_names:
                alternatives_scores_df = pd.read_excel(filepath, sheet_name='AlternativesScores')
            
            # Load ranking result
            if 'RankingResult' in xls.sheet_names:
                df_result = pd.read_excel(filepath, sheet_name='RankingResult')
                if not df_result.empty and 'alternative' in df_result.columns and 'score' in df_result.columns:
                    ranking_result = df_result
        except Exception as e:
            print(f"Error loading existing ranking data: {str(e)}")
    
    # Save all sheets
    with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
        # Save project data with proper column order (same strategy as AlternativesScores)
        if rows:
            df_project = pd.DataFrame(rows)
            
            # Build ordered column list
            # Priority: 1) columns parameter from frontend (correct order from site), 2) existing_project_col_order from Excel, 3) infer from rows
            # IMPORTANT: rowNo must always be first, regardless of source
            if columns:
                # Use provided columns parameter from frontend (preserve order from site - same as AlternativesScores)
                # Frontend sends columns without rowNo, so we add it at the beginning
                col_order_to_use = ['rowNo'] + [c for c in columns if c != 'rowNo']
            elif existing_project_col_order:
                # Use existing column order from Excel (fallback if columns not provided)
                # But ensure rowNo is first
                other_cols = [c for c in existing_project_col_order if c != 'rowNo']
                col_order_to_use = ['rowNo'] + other_cols if 'rowNo' in existing_project_col_order else existing_project_col_order
            else:
                col_order_to_use = None
            
            if col_order_to_use:
                # Use the determined column order (preserve order from site)
                # Ensure all columns from existing file are present
                for col in col_order_to_use:
                    if col not in df_project.columns:
                        df_project[col] = pd.NA
                # Reorder to match existing order, then add any new columns
                # Ensure rowNo is always first
                ordered_cols = [c for c in col_order_to_use if c in df_project.columns]
                new_cols = [c for c in df_project.columns if c not in ordered_cols]
                # Make sure rowNo is first in final order
                final_cols = []
                if 'rowNo' in df_project.columns:
                    final_cols.append('rowNo')
                for col in ordered_cols + new_cols:
                    if col != 'rowNo':
                        final_cols.append(col)
                df_project = df_project[final_cols]
            else:
                # No existing file, use provided column order or infer from rows
                if columns is None:
                    # Infer columns from rows (excluding rowNo)
                    if len(rows) > 0:
                        all_keys = set()
                        for row in rows:
                            all_keys.update(row.keys())
                        columns = [k for k in all_keys if k != 'rowNo']
                
                # Build ordered column list: rowNo first, then specified columns, then any remaining
                ordered_columns = []
                if 'rowNo' in df_project.columns:
                    ordered_columns.append('rowNo')
                
                # Add columns in specified order
                if columns:
                    for col in columns:
                        if col != 'rowNo' and col in df_project.columns and col not in ordered_columns:
                            ordered_columns.append(col)
                
                # Add any remaining columns that weren't in the specified list
                for col in df_project.columns:
                    if col not in ordered_columns:
                        ordered_columns.append(col)
                
                # Reorder DataFrame columns
                df_project = df_project[ordered_columns]
            
            df_project.to_excel(writer, sheet_name='Project', index=False)
        else:
            # Empty DataFrame with proper structure
            if columns:
                empty_cols = ['rowNo'] + [col for col in columns if col != 'rowNo']
                pd.DataFrame(columns=empty_cols).to_excel(writer, sheet_name='Project', index=False)
            else:
                pd.DataFrame().to_excel(writer, sheet_name='Project', index=False)
        
        # Preserve ranking sheets
        if ranking_columns:
            df_columns = pd.DataFrame([{'column': col} for col in ranking_columns])
            df_columns.to_excel(writer, sheet_name='RankingColumns', index=False)
        
        if criteria_weights:
            df_weights = pd.DataFrame([
                {'criteria': k, 'weight': v} 
                for k, v in criteria_weights.items()
            ])
            df_weights.to_excel(writer, sheet_name='CriteriaWeights', index=False)
        
        # Sync AlternativesScores with Project rows
        # Ensure AlternativesScores has the same number of rows as Project
        if rows:
            num_project_rows = len(rows)
            
            # Prepare alternatives scores data
            if alternatives_scores_df is not None and not alternatives_scores_df.empty:
                # Ensure we have the right number of rows
                current_alternatives = alternatives_scores_df.to_dict('records')
                
                # Create a mapping from rowNo to alternative key
                row_no_to_alt = {}
                for idx, row in enumerate(rows):
                    row_no = row.get('rowNo', idx + 1)
                    alt_key = f"Alternative {row_no}"
                    row_no_to_alt[row_no] = alt_key
                
                # Build new alternatives scores list
                new_alternatives = []
                for idx, row in enumerate(rows):
                    row_no = row.get('rowNo', idx + 1)
                    alt_key = f"Alternative {row_no}"
                    
                    # Find existing alternative data
                    existing_alt = None
                    for alt in current_alternatives:
                        if str(alt.get('alternative', '')).strip() == alt_key:
                            existing_alt = alt
                            break
                    
                    if existing_alt:
                        new_alternatives.append(existing_alt)
                    else:
                        # Create new alternative row
                        new_alt = {'alternative': alt_key}
                        if ranking_columns:
                            for col in ranking_columns:
                                new_alt[col] = pd.NA
                        new_alternatives.append(new_alt)
                
                # Create DataFrame with proper structure
                if ranking_columns:
                    all_cols = ['alternative'] + ranking_columns
                else:
                    all_cols = ['alternative']
                    if new_alternatives and len(new_alternatives) > 0:
                        # Get all columns from existing data
                        for alt in new_alternatives:
                            for key in alt.keys():
                                if key not in all_cols:
                                    all_cols.append(key)
                
                alternatives_scores_df = pd.DataFrame(new_alternatives)
                # Ensure all columns exist
                for col in all_cols:
                    if col not in alternatives_scores_df.columns:
                        alternatives_scores_df[col] = pd.NA
                alternatives_scores_df = alternatives_scores_df[all_cols]
                
                alternatives_scores_df.to_excel(writer, sheet_name='AlternativesScores', index=False)
            elif ranking_columns:
                # Create alternatives scores based on project rows
                alternatives_list = []
                for idx, row in enumerate(rows):
                    row_no = row.get('rowNo', idx + 1)
                    alt_key = f"Alternative {row_no}"
                    alt_row = {'alternative': alt_key}
                    for col in ranking_columns:
                        alt_row[col] = pd.NA
                    alternatives_list.append(alt_row)
                
                alternatives_scores_df = pd.DataFrame(alternatives_list)
                alternatives_scores_df.to_excel(writer, sheet_name='AlternativesScores', index=False)
            else:
                # No ranking columns, but create empty structure to match project rows
                alternatives_list = []
                for idx, row in enumerate(rows):
                    row_no = row.get('rowNo', idx + 1)
                    alt_key = f"Alternative {row_no}"
                    alternatives_list.append({'alternative': alt_key})
                
                alternatives_scores_df = pd.DataFrame(alternatives_list)
                alternatives_scores_df.to_excel(writer, sheet_name='AlternativesScores', index=False)
        elif alternatives_scores_df is not None and not alternatives_scores_df.empty:
            # No project rows, but we have alternatives scores - keep them
            alternatives_scores_df.to_excel(writer, sheet_name='AlternativesScores', index=False)
        elif ranking_columns:
            # Create empty structure
            pd.DataFrame(columns=['alternative'] + ranking_columns).to_excel(
                writer, sheet_name='AlternativesScores', index=False
            )
        
        if ranking_result is not None and not ranking_result.empty:
            ranking_result.to_excel(writer, sheet_name='RankingResult', index=False)
        
        # Apply center alignment to all cells in all sheets
        workbook = writer.book
        for sheet_name in workbook.sheetnames:
            sheet = workbook[sheet_name]
            for row in sheet.iter_rows():
                for cell in row:
                    cell.alignment = Alignment(horizontal='center', vertical='center')
    
    return str(filepath)

@project_bp.route('/get', methods=['GET'])
def get_project():
    """Get current project data - preserve column order from Excel"""
    from pathlib import Path
    DATA_DIR = Path(__file__).parent.parent.parent / 'data'
    filepath = DATA_DIR / PROJECT_FILE
    
    if not filepath.exists():
        project = {
            'rows': [],
            'columns': []
        }
    else:
        # Try to load from 'Project' sheet first, fallback to 'Sheet1'
        try:
            df_project = pd.read_excel(filepath, sheet_name='Project')
            # Preserve exact column order from Excel, but ensure rowNo is first
            column_order_raw = list(df_project.columns)
            # IMPORTANT: Ensure rowNo is always first, regardless of Excel order
            if 'rowNo' in column_order_raw:
                other_cols = [c for c in column_order_raw if c != 'rowNo']
                column_order = ['rowNo'] + other_cols
                # Reorder DataFrame columns to match
                df_project = df_project[column_order]
            else:
                column_order = column_order_raw
            # Convert to dict and handle NaN values - replace NaN with empty string
            # First fillna, then convert to dict
            df_project = df_project.fillna('')
            project = df_project.to_dict('records')
            # Clean up any remaining NaN values in the dict
            for row in project:
                for key, value in row.items():
                    if pd.isna(value) if hasattr(pd, 'isna') else (value != value):  # Check for NaN
                        row[key] = ''
        except Exception as e:
            print(f"Error loading Project sheet: {str(e)}")
            try:
                df_project = pd.read_excel(filepath, sheet_name='Sheet1')
                # Preserve exact column order from Excel, but ensure rowNo is first
                column_order_raw = list(df_project.columns)
                # IMPORTANT: Ensure rowNo is always first, regardless of Excel order
                if 'rowNo' in column_order_raw:
                    other_cols = [c for c in column_order_raw if c != 'rowNo']
                    column_order = ['rowNo'] + other_cols
                    # Reorder DataFrame columns to match
                    df_project = df_project[column_order]
                else:
                    column_order = column_order_raw
                # Convert to dict and handle NaN values - replace NaN with empty string
                # First fillna, then convert to dict
                df_project = df_project.fillna('')
                project = df_project.to_dict('records')
                # Clean up any remaining NaN values in the dict
                for row in project:
                    for key, value in row.items():
                        if pd.isna(value) if hasattr(pd, 'isna') else (value != value):  # Check for NaN
                            row[key] = ''
            except Exception as e2:
                print(f"Error loading Sheet1: {str(e2)}")
                project = []
                column_order = []
        
        # Convert list of dicts to rows/columns format
        # Preserve column order from Excel: rowNo first (if exists), then other columns in Excel order
        if len(project) > 0 and len(column_order) > 0:
            # Use the exact column order (rowNo is already first)
            rows = project
            # Filter out rowNo from columns list for frontend (it's displayed separately)
            columns_for_frontend = [col for col in column_order if col != 'rowNo']
            project = {
                'rows': rows,
                'columns': columns_for_frontend
            }
        elif len(project) > 0:
            # Fallback: if column_order is empty, use keys from first row
            all_keys = list(project[0].keys())
            # Order: rowNo first, then other columns
            if 'rowNo' in all_keys:
                columns = ['rowNo'] + [k for k in all_keys if k != 'rowNo']
            else:
                columns = all_keys
            rows = project
            # Filter out rowNo from columns list for frontend (it's displayed separately)
            columns_for_frontend = [col for col in columns if col != 'rowNo']
            project = {
                'rows': rows,
                'columns': columns_for_frontend
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
    
    # If columns not provided, get from existing Excel file to preserve order
    if not columns and rows:
        from pathlib import Path
        DATA_DIR = Path(__file__).parent.parent.parent / 'data'
        filepath = DATA_DIR / PROJECT_FILE
        if filepath.exists():
            try:
                df_existing = pd.read_excel(filepath, sheet_name='Project')
                # Get column order from Excel, excluding rowNo
                columns = [col for col in df_existing.columns if col != 'rowNo']
            except:
                try:
                    df_existing = pd.read_excel(filepath, sheet_name='Sheet1')
                    columns = [col for col in df_existing.columns if col != 'rowNo']
                except:
                    # Fallback: infer from rows
                    if len(rows) > 0:
                        all_keys = set()
                        for row in rows:
                            all_keys.update(row.keys())
                        columns = [k for k in all_keys if k != 'rowNo']
        elif len(rows) > 0:
            # No existing file, infer from rows
            all_keys = set()
            for row in rows:
                all_keys.update(row.keys())
            columns = [k for k in all_keys if k != 'rowNo']
    
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
                try:
                    # Try to delete the file
                    filepath.unlink()
                except PermissionError:
                    # File might be locked, try to overwrite with empty file first
                    try:
                        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
                            pd.DataFrame().to_excel(writer, sheet_name='Project', index=False)
                            pd.DataFrame(columns=['column']).to_excel(writer, sheet_name='RankingColumns', index=False)
                            pd.DataFrame(columns=['criteria', 'weight']).to_excel(writer, sheet_name='CriteriaWeights', index=False)
                            pd.DataFrame(columns=['alternative']).to_excel(writer, sheet_name='AlternativesScores', index=False)
                            pd.DataFrame(columns=['alternative', 'score']).to_excel(writer, sheet_name='RankingResult', index=False)
                        # Then try to delete again
                        filepath.unlink()
                    except Exception as e2:
                        return jsonify({'success': False, 'error': f'Failed to delete file: {str(e2)}'}), 500
                except Exception as e:
                    return jsonify({'success': False, 'error': f'Failed to delete file: {str(e)}'}), 500
        else:
            # Save as Excel - preserve ranking sheets and column order
            save_project_with_ranking(rows, columns, PROJECT_FILE)
        return jsonify({
            'success': True,
            'message': 'Project updated successfully',
            'data': project_data
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
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

        # Load project data from correct sheet
        from pathlib import Path
        DATA_DIR = Path(__file__).parent.parent.parent / 'data'
        filepath = DATA_DIR / PROJECT_FILE
        
        if filepath.exists():
            try:
                project_rows = pd.read_excel(filepath, sheet_name='Project').to_dict('records')
            except:
                try:
                    project_rows = pd.read_excel(filepath, sheet_name='Sheet1').to_dict('records')
                except:
                    project_rows = []
        else:
            project_rows = []

        # If we don't have columns info, get column order from Excel (excluding rowNo)
        if not columns:
            if filepath.exists():
                try:
                    df_existing = pd.read_excel(filepath, sheet_name='Project')
                    # Get column order from Excel, excluding rowNo
                    columns = [col for col in df_existing.columns if col != 'rowNo']
                except:
                    try:
                        df_existing = pd.read_excel(filepath, sheet_name='Sheet1')
                        columns = [col for col in df_existing.columns if col != 'rowNo']
                    except:
                        if project_rows:
                            columns = [k for k in project_rows[0].keys() if k != 'rowNo']
                        else:
                            columns = []
            elif project_rows:
                columns = [k for k in project_rows[0].keys() if k != 'rowNo']
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
            new_row = {'rowNo': row_no}
            # Add all columns with empty values
            for col in columns:
                new_row[col] = ''
            target_index = len(project_rows)
            project_rows.append(new_row)

        # Update the target row - ensure rowNo exists
        project_rows[target_index]['rowNo'] = row_no
        # Ensure the column exists in the row
        if column not in project_rows[target_index]:
            project_rows[target_index][column] = ''
        project_rows[target_index][column] = value
        
        # Ensure all columns exist in all rows for consistency
        for idx, row in enumerate(project_rows):
            if 'rowNo' not in row:
                row['rowNo'] = row.get('rowNo') or (idx + 1)
            for col in columns:
                if col not in row:
                    row[col] = ''

        # Save back to storage - preserve ranking sheets and column order
        save_project_with_ranking(project_rows, columns, PROJECT_FILE)

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

@project_bp.route('/delete', methods=['POST', 'DELETE'])
def delete_project():
    """Delete the entire project.xlsx file including all sheets"""
    import time
    import gc
    import os
    
    try:
        from pathlib import Path
        DATA_DIR = Path(__file__).parent.parent.parent / 'data'
        filepath = DATA_DIR / PROJECT_FILE
        
        if not filepath.exists():
            # File doesn't exist, consider it already deleted
            return jsonify({
                'success': True,
                'message': 'Project file does not exist (already deleted)'
            })
        
        # Force garbage collection to close any open file handles
        gc.collect()
        time.sleep(0.1)  # Small delay to ensure any file handles are released
        
        # Strategy 1: Try to delete directly
        try:
            filepath.unlink()
            return jsonify({
                'success': True,
                'message': 'Project file deleted successfully'
            })
        except (PermissionError, OSError) as pe:
            # File might be locked, try to clear it instead
            pass
        except Exception as e:
            # Other error, log and try alternative
            print(f"Direct delete failed: {str(e)}")
        
        # Strategy 2: Overwrite with empty file to clear all data
        try:
            with pd.ExcelWriter(filepath, engine='openpyxl', mode='w') as writer:
                pd.DataFrame().to_excel(writer, sheet_name='Project', index=False)
                pd.DataFrame(columns=['column']).to_excel(writer, sheet_name='RankingColumns', index=False)
                pd.DataFrame(columns=['criteria', 'weight']).to_excel(writer, sheet_name='CriteriaWeights', index=False)
                pd.DataFrame(columns=['alternative']).to_excel(writer, sheet_name='AlternativesScores', index=False)
                pd.DataFrame(columns=['alternative', 'score']).to_excel(writer, sheet_name='RankingResult', index=False)
            
            # Wait a bit and try to delete again
            time.sleep(0.2)
            try:
                filepath.unlink()
                return jsonify({
                    'success': True,
                    'message': 'Project file deleted successfully'
                })
            except Exception:
                # File still locked, but contents are cleared - that's acceptable
                return jsonify({
                    'success': True,
                    'message': 'Project file cleared (file was locked, contents cleared instead)'
                })
        except Exception as e2:
            import traceback
            traceback.print_exc()
            # If we can't even overwrite, try using os.remove as last resort
            try:
                os.remove(str(filepath))
                return jsonify({
                    'success': True,
                    'message': 'Project file deleted successfully (using os.remove)'
                })
            except Exception as e3:
                return jsonify({
                    'success': False, 
                    'error': f'File is locked and cannot be deleted. Please close Excel or any other program using this file and try again. Error: {str(e3)}'
                }), 500
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False, 
            'error': f'Unexpected error: {str(e)}'
        }), 500

