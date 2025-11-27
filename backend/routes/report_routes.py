"""
Report Routes
Handles report generation and statistics
"""

from flask import Blueprint, request, jsonify
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from utils.report_generator import (
    generate_statistics, generate_correlation_heatmap,
    generate_bar_chart, generate_scatter_plot
)
from utils.file_manager import save_excel
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors
from io import BytesIO
import base64

report_bp = Blueprint('report', __name__)

@report_bp.route('/statistics', methods=['POST'])
def get_statistics():
    """Get statistical summary"""
    data = request.json
    project_data = data.get('data', [])
    
    try:
        stats = generate_statistics(project_data)
        return jsonify({
            'success': True,
            'data': stats
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@report_bp.route('/visualizations', methods=['POST'])
def get_visualizations():
    """Get visualizations"""
    data = request.json
    project_data = data.get('data', [])
    viz_type = data.get('type', 'heatmap')  # heatmap, bar, scatter
    
    try:
        if viz_type == 'heatmap':
            image = generate_correlation_heatmap(project_data)
        elif viz_type == 'bar':
            column = data.get('column')
            image = generate_bar_chart(project_data, column)
        elif viz_type == 'scatter':
            x_col = data.get('xColumn')
            y_col = data.get('yColumn')
            image = generate_scatter_plot(project_data, x_col, y_col)
        else:
            return jsonify({'success': False, 'error': 'Invalid visualization type'}), 400
        
        if image is None:
            return jsonify({'success': False, 'error': 'Could not generate visualization'}), 400
        
        return jsonify({
            'success': True,
            'image': image
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@report_bp.route('/export-excel', methods=['POST'])
def export_excel():
    """Export report as Excel"""
    data = request.json
    project_data = data.get('data', [])
    filename = data.get('filename', 'report.xlsx')
    
    try:
        # Generate statistics
        stats = generate_statistics(project_data)
        
        # Create Excel with multiple sheets
        import pandas as pd
        
        # Main data sheet
        df_data = pd.DataFrame(project_data)
        # Remove rowNo column if it exists (not needed in report)
        if 'rowNo' in df_data.columns:
            df_data = df_data.drop(columns=['rowNo'])
        
        # Statistics sheet
        stats_rows = []
        for col, stat in stats['numeric_stats'].items():
            stats_rows.append({
                'Column': col,
                'Mean': stat['mean'],
                'Std': stat['std'],
                'Min': stat['min'],
                'Max': stat['max'],
                'Median': stat['median']
            })
        df_stats = pd.DataFrame(stats_rows)
        
        # Save to Excel
        filepath = save_excel(df_data.to_dict('records'), filename, 'Data')
        
        return jsonify({
            'success': True,
            'filepath': filepath,
            'filename': filename
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@report_bp.route('/export-pdf', methods=['POST'])
def export_pdf():
    """Export report as PDF"""
    data = request.json
    project_data = data.get('data', [])
    filename = data.get('filename', 'report.pdf')
    
    try:
        stats = generate_statistics(project_data)
        
        # Create PDF
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        story = []
        styles = getSampleStyleSheet()
        
        # Title
        story.append(Paragraph("HAZOP Analysis Report", styles['Title']))
        story.append(Spacer(1, 12))
        
        # Statistics
        story.append(Paragraph("Statistics Summary", styles['Heading1']))
        story.append(Paragraph(f"Total Records: {stats['count']}", styles['Normal']))
        story.append(Spacer(1, 12))
        
        # Numeric statistics table
        if stats['numeric_stats']:
            story.append(Paragraph("Numeric Statistics", styles['Heading2']))
            data_table = [['Column', 'Mean', 'Std', 'Min', 'Max', 'Median']]
            for col, stat in stats['numeric_stats'].items():
                data_table.append([
                    col,
                    f"{stat['mean']:.2f}",
                    f"{stat['std']:.2f}",
                    f"{stat['min']:.2f}",
                    f"{stat['max']:.2f}",
                    f"{stat['median']:.2f}"
                ])
            
            table = Table(data_table)
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            story.append(table)
            story.append(Spacer(1, 12))
        
        doc.build(story)
        buffer.seek(0)
        
        # Save PDF
        DATA_DIR = Path(__file__).parent.parent.parent / 'data'
        filepath = DATA_DIR / filename
        filepath.parent.mkdir(exist_ok=True)
        with open(filepath, 'wb') as f:
            f.write(buffer.getvalue())
        
        return jsonify({
            'success': True,
            'filepath': str(filepath),
            'filename': filename
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

