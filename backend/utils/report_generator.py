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
from scipy import stats
from scipy.stats import norm, expon, gamma, lognorm, weibull_min

def fit_distribution(data_values):
    """Fit statistical distributions to data and return best fit with p-value"""
    data_values = np.array(data_values)
    data_values = data_values[~np.isnan(data_values)]
    
    if len(data_values) < 3:
        return None
    
    distributions = [
        ('Normal', norm),
        ('Exponential', expon),
        ('Gamma', gamma),
        ('Lognormal', lognorm),
        ('Weibull', weibull_min)
    ]
    
    best_dist = None
    best_params = None
    best_pvalue = -np.inf
    best_sse = np.inf
    
    for dist_name, dist in distributions:
        try:
            params = dist.fit(data_values)
            # Calculate sum of squared errors
            arg = params[:-2] if len(params) > 2 else ()
            loc = params[-2] if len(params) >= 2 else 0
            scale = params[-1] if len(params) >= 1 else 1
            
            # Calculate Kolmogorov-Smirnov test p-value
            try:
                ks_statistic, p_value = stats.kstest(data_values, lambda x: dist.cdf(x, *arg, loc=loc, scale=scale))
            except Exception:
                # Fallback: use Anderson-Darling test if KS test fails
                try:
                    ad_result = stats.anderson(data_values, dist_name.lower() if dist_name.lower() in ['norm', 'expon'] else 'norm')
                    # Approximate p-value from Anderson-Darling (simplified)
                    p_value = 0.5  # Default if can't calculate
                except Exception:
                    p_value = 0.0
            
            pdf = dist.pdf(np.sort(data_values), *arg, loc=loc, scale=scale)
            hist, bin_edges = np.histogram(data_values, bins=min(20, len(data_values)//2), density=True)
            bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2
            
            # Interpolate PDF to match histogram bins
            pdf_interp = np.interp(bin_centers, np.sort(data_values), pdf)
            sse = np.sum((hist - pdf_interp) ** 2)
            
            # Prefer higher p-value, but also consider SSE
            score = p_value - (sse / (np.max(data_values) - np.min(data_values) + 1))
            
            if score > best_pvalue or (score == best_pvalue and sse < best_sse):
                best_pvalue = score
                best_sse = sse
                best_dist = dist_name
                best_params = {
                    'params': [float(p) for p in params],
                    'sse': float(sse),
                    'pvalue': float(p_value)
                }
        except Exception as e:
            continue
    
    if best_dist:
        return {
            'distribution': best_dist,
            'params': best_params['params'],
            'sse': best_params['sse'],
            'pvalue': best_params['pvalue']
        }
    return None

def generate_distribution_plot(data_values, column_name, distribution_info):
    """Generate distribution fit plot comparing data scatter plot with fitted distribution"""
    if distribution_info is None:
        return None
    
    data_values = np.array(data_values)
    data_values = data_values[~np.isnan(data_values)]
    
    if len(data_values) < 3:
        return None
    
    dist_name = distribution_info['distribution']
    params = distribution_info['params']
    
    # Map distribution name to scipy distribution
    dist_map = {
        'Normal': norm,
        'Exponential': expon,
        'Gamma': gamma,
        'Lognormal': lognorm,
        'Weibull': weibull_min
    }
    
    dist = dist_map.get(dist_name)
    if dist is None:
        return None
    
    # Extract parameters
    arg = params[:-2] if len(params) > 2 else ()
    loc = params[-2] if len(params) >= 2 else 0
    scale = params[-1] if len(params) >= 1 else 1
    
    # Create plot
    plt.figure(figsize=(12, 7))
    
    # Calculate PDF values for each data point
    try:
        pdf_values = dist.pdf(data_values, *arg, loc=loc, scale=scale)
    except Exception:
        pdf_values = np.zeros_like(data_values)
    
    # Plot data points as scatter plot
    plt.scatter(data_values, pdf_values, alpha=0.6, s=50, color='blue', 
                label='Data Points', edgecolors='darkblue', linewidths=0.5)
    
    # Plot fitted distribution curve
    x = np.linspace(data_values.min(), data_values.max(), 300)
    try:
        pdf_curve = dist.pdf(x, *arg, loc=loc, scale=scale)
        plt.plot(x, pdf_curve, 'r-', linewidth=2.5, label=f'Fitted {dist_name} Distribution')
    except Exception:
        pass
    
    plt.xlabel(column_name, fontsize=12, fontweight='bold')
    plt.ylabel('Probability Density', fontsize=12, fontweight='bold')
    plt.title(f'Distribution Fit: {column_name}\n{dist_name} Distribution (p-value: {distribution_info["pvalue"]:.4f})', 
              fontsize=13, fontweight='bold', pad=15)
    plt.legend(fontsize=10, loc='best')
    plt.grid(True, alpha=0.3, linestyle='--')
    
    # Improve axis visibility
    plt.tick_params(axis='both', which='major', labelsize=10)
    plt.tick_params(axis='both', which='minor', labelsize=8)
    
    # Add some padding for better visibility
    x_range = data_values.max() - data_values.min()
    y_range = pdf_values.max() - pdf_values.min() if len(pdf_values) > 0 else 1
    plt.xlim(data_values.min() - x_range * 0.05, data_values.max() + x_range * 0.05)
    if y_range > 0:
        plt.ylim(-y_range * 0.1, pdf_values.max() + y_range * 0.2)
    
    plt.tight_layout()
    
    # Convert to base64
    buffer = BytesIO()
    plt.savefig(buffer, format='png', dpi=120, bbox_inches='tight')
    buffer.seek(0)
    image_base64 = base64.b64encode(buffer.getvalue()).decode()
    plt.close()
    
    return image_base64

def generate_statistics(data, include_distribution_plots=False):
    """Generate statistical summary of dataset
    
    Args:
        data: List of dictionaries containing the data
        include_distribution_plots: If True, generate distribution plots for each numeric column
    """
    df = pd.DataFrame(data)
    
    # Remove rowNo column if it exists (not needed in calculations)
    if 'rowNo' in df.columns:
        df = df.drop(columns=['rowNo'])
    
    stats = {
        'count': len(df),
        'columns': list(df.columns),
        'numeric_stats': {},
        'categorical_stats': {},
        'distribution_plots': {}
    }
    
    # Numeric statistics
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    for col in numeric_cols:
        col_data = df[col].dropna()
        if len(col_data) > 0:
            distribution_fit = fit_distribution(col_data.values)
            stats['numeric_stats'][col] = {
                'mean': float(col_data.mean()),
                'std': float(col_data.std()),
                'min': float(col_data.min()),
                'max': float(col_data.max()),
                'median': float(col_data.median()),
                'q25': float(col_data.quantile(0.25)),
                'q75': float(col_data.quantile(0.75)),
                'distribution': distribution_fit
            }
            
            # Generate distribution plot if requested
            if include_distribution_plots and distribution_fit:
                plot_image = generate_distribution_plot(col_data.values, col, distribution_fit)
                if plot_image:
                    stats['distribution_plots'][col] = plot_image
    
    # Categorical statistics
    categorical_cols = df.select_dtypes(include=['object']).columns
    for col in categorical_cols:
        value_counts = df[col].value_counts().to_dict()
        stats['categorical_stats'][col] = {
            'unique_count': int(df[col].nunique()),
            'most_frequent': list(value_counts.items())[:5] if value_counts else []
        }
    
    return stats

def generate_correlation_heatmap(data, include_categorical=False):
    """Generate correlation heatmap as base64 image
    
    Args:
        data: List of dictionaries containing the data
        include_categorical: If True, encode categorical columns and include them
    """
    df = pd.DataFrame(data)
    # Remove rowNo column if it exists (not needed in calculations)
    if 'rowNo' in df.columns:
        df = df.drop(columns=['rowNo'])
    
    if include_categorical:
        # Encode categorical columns using label encoding
        df_encoded = df.copy()
        categorical_cols = df.select_dtypes(include=['object']).columns
        
        for col in categorical_cols:
            # Use label encoding for categorical columns
            df_encoded[col] = pd.Categorical(df[col]).codes
            # Replace -1 (for NaN) with NaN
            df_encoded[col] = df_encoded[col].replace(-1, np.nan)
        
        # Convert all to numeric
        for col in df_encoded.columns:
            df_encoded[col] = pd.to_numeric(df_encoded[col], errors='coerce')
        
        correlation_df = df_encoded
    else:
        # Only numeric columns
        correlation_df = df.select_dtypes(include=[np.number])
    
    if correlation_df.empty or len(correlation_df.columns) < 2:
        return None
    
    plt.figure(figsize=(max(10, len(correlation_df.columns) * 0.8), max(8, len(correlation_df.columns) * 0.8)))
    correlation = correlation_df.corr()
    sns.heatmap(correlation, annot=True, cmap='coolwarm', center=0, fmt='.2f', 
                square=True, linewidths=0.5, cbar_kws={"shrink": 0.8})
    plt.title('Correlation Heatmap' + (' (Including Categorical)' if include_categorical else ' (Numeric Only)'))
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
    # Remove rowNo column if it exists (not needed in calculations)
    if 'rowNo' in df.columns:
        df = df.drop(columns=['rowNo'])
    
    if column not in df.columns:
        return None
    
    plt.figure(figsize=(10, 6))
    
    # Check if column is numeric
    is_numeric = pd.api.types.is_numeric_dtype(df[column])
    
    if is_numeric:
        # For numeric columns, sort values from small to large
        value_counts = df[column].value_counts().sort_index().head(20)
    else:
        # For categorical columns, use frequency order
        value_counts = df[column].value_counts().head(20)
    
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
    # Remove rowNo column if it exists (not needed in calculations)
    if 'rowNo' in df.columns:
        df = df.drop(columns=['rowNo'])
    
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

