"""
Report Generator Utility
Generates statistical summaries and visualizations
"""

import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
import seaborn as sns
from io import BytesIO
import base64

def generate_statistics(data):
    """Generate statistical summary of dataset"""
    df = pd.DataFrame(data)
    
    stats = {
        'count': len(df),
        'columns': list(df.columns),
        'numeric_stats': {},
        'categorical_stats': {}
    }
    
    # Numeric statistics
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    for col in numeric_cols:
        stats['numeric_stats'][col] = {
            'mean': float(df[col].mean()),
            'std': float(df[col].std()),
            'min': float(df[col].min()),
            'max': float(df[col].max()),
            'median': float(df[col].median()),
            'q25': float(df[col].quantile(0.25)),
            'q75': float(df[col].quantile(0.75))
        }
    
    # Categorical statistics
    categorical_cols = df.select_dtypes(include=['object']).columns
    for col in categorical_cols:
        value_counts = df[col].value_counts().to_dict()
        stats['categorical_stats'][col] = {
            'unique_count': int(df[col].nunique()),
            'most_frequent': list(value_counts.items())[:5] if value_counts else []
        }
    
    return stats

def generate_correlation_heatmap(data):
    """Generate correlation heatmap as base64 image"""
    df = pd.DataFrame(data)
    numeric_df = df.select_dtypes(include=[np.number])
    
    if numeric_df.empty or len(numeric_df.columns) < 2:
        return None
    
    plt.figure(figsize=(10, 8))
    correlation = numeric_df.corr()
    sns.heatmap(correlation, annot=True, cmap='coolwarm', center=0, fmt='.2f')
    plt.title('Correlation Heatmap')
    plt.tight_layout()
    
    # Convert to base64
    buffer = BytesIO()
    plt.savefig(buffer, format='png', dpi=100)
    buffer.seek(0)
    image_base64 = base64.b64encode(buffer.getvalue()).decode()
    plt.close()
    
    return image_base64

def generate_bar_chart(data, column):
    """Generate bar chart for a column"""
    df = pd.DataFrame(data)
    
    if column not in df.columns:
        return None
    
    plt.figure(figsize=(10, 6))
    value_counts = df[column].value_counts().head(10)
    value_counts.plot(kind='bar')
    plt.title(f'Bar Chart: {column}')
    plt.xlabel(column)
    plt.ylabel('Count')
    plt.xticks(rotation=45, ha='right')
    plt.tight_layout()
    
    buffer = BytesIO()
    plt.savefig(buffer, format='png', dpi=100)
    buffer.seek(0)
    image_base64 = base64.b64encode(buffer.getvalue()).decode()
    plt.close()
    
    return image_base64

def generate_scatter_plot(data, x_col, y_col):
    """Generate scatter plot"""
    df = pd.DataFrame(data)
    
    if x_col not in df.columns or y_col not in df.columns:
        return None
    
    # Convert to numeric if needed
    df[x_col] = pd.to_numeric(df[x_col], errors='coerce')
    df[y_col] = pd.to_numeric(df[y_col], errors='coerce')
    df = df.dropna(subset=[x_col, y_col])
    
    plt.figure(figsize=(10, 6))
    plt.scatter(df[x_col], df[y_col], alpha=0.6)
    plt.xlabel(x_col)
    plt.ylabel(y_col)
    plt.title(f'Scatter Plot: {x_col} vs {y_col}')
    plt.tight_layout()
    
    buffer = BytesIO()
    plt.savefig(buffer, format='png', dpi=100)
    buffer.seek(0)
    image_base64 = base64.b64encode(buffer.getvalue()).decode()
    plt.close()
    
    return image_base64

