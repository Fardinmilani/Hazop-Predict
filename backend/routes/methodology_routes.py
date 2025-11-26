"""
Methodology Routes
Handles ML model training, evaluation, and prediction
"""

from flask import Blueprint, request, jsonify
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from utils.ml_models import prepare_data, train_models, train_models_classification, predict
import json
import numpy as np
import pandas as pd

methodology_bp = Blueprint('methodology', __name__)

# Store trained models in memory (in production, use proper storage)
trained_models = {}

@methodology_bp.route('/train', methods=['POST'])
def train():
    """Train ML models"""
    data = request.json
    project_data = data.get('data', [])
    feature_columns = data.get('featureColumns', [])
    target_column = data.get('targetColumn')
    target_type = data.get('targetType', 'number')  # 'text' for classification, 'number' for regression
    
    if not feature_columns or not target_column:
        return jsonify({'success': False, 'error': 'Feature columns and target column required'}), 400
    
    try:
        # Prepare data
        X, y, label_encoders = prepare_data(project_data, feature_columns, target_column, target_type)
        
        # Debug: Log target statistics for regression
        if target_type != 'text' and target_type != 'select':
            if isinstance(y, pd.Series):
                y_values = y.values
            else:
                y_values = np.array(y)
            print(f"Target statistics: min={np.min(y_values)}, max={np.max(y_values)}, mean={np.mean(y_values)}, median={np.median(y_values)}, std={np.std(y_values)}")
        
        # Train models based on target type
        if target_type == 'text' or target_type == 'select':
            # Classification models
            results, X_test, y_test = train_models_classification(X, y)
        else:
            # Regression models
            results, X_test, y_test = train_models(X, y)
        
        # Convert results to JSON-serializable format
        serializable_results = {}
        for name, result in results.items():
            if 'error' in result:
                serializable_results[name] = result
            else:
                # Check if it's classification or regression
                is_classification = result.get('is_classification', False)
                
                if is_classification:
                    # Classification metrics
                    serializable_results[name] = {
                        'train_accuracy': float(result['train_accuracy']) if result.get('train_accuracy') is not None else None,
                        'test_accuracy': float(result['test_accuracy']) if result.get('test_accuracy') is not None else None,
                        'train_precision': float(result['train_precision']) if result.get('train_precision') is not None else None,
                        'test_precision': float(result['test_precision']) if result.get('test_precision') is not None else None,
                        'train_recall': float(result['train_recall']) if result.get('train_recall') is not None else None,
                        'test_recall': float(result['test_recall']) if result.get('test_recall') is not None else None,
                        'train_f1': float(result['train_f1']) if result.get('train_f1') is not None else None,
                        'test_f1': float(result['test_f1']) if result.get('test_f1') is not None else None,
                        'cv_mean': float(result['cv_mean']) if result.get('cv_mean') is not None else None,
                        'cv_std': float(result['cv_std']) if result.get('cv_std') is not None else None,
                        'overfitting_score': float(result['overfitting_score']) if result.get('overfitting_score') is not None else None,
                        'is_overfitting': bool(result['is_overfitting']) if result.get('is_overfitting') is not None else False,
                        'is_classification': True
                    }
                else:
                    # Regression metrics
                    serializable_results[name] = {
                        'train_r2': float(result['train_r2']) if result.get('train_r2') is not None else None,
                        'test_r2': float(result['test_r2']) if result.get('test_r2') is not None else None,
                        'train_mae': float(result['train_mae']) if result.get('train_mae') is not None else None,
                        'test_mae': float(result['test_mae']) if result.get('test_mae') is not None else None,
                        'train_rmse': float(result['train_rmse']) if result.get('train_rmse') is not None else None,
                        'test_rmse': float(result['test_rmse']) if result.get('test_rmse') is not None else None,
                        'cv_mean': float(result['cv_mean']) if result.get('cv_mean') is not None else None,
                        'cv_std': float(result['cv_std']) if result.get('cv_std') is not None else None,
                        'overfitting_score': float(result['overfitting_score']) if result.get('overfitting_score') is not None else None,
                        'is_overfitting': bool(result['is_overfitting']) if result.get('is_overfitting') is not None else False,
                        'is_classification': False
                    }
                # Store model for prediction (in production, use proper serialization)
                model_key = f"{name}_{len(trained_models)}"
                trained_models[model_key] = {
                    'model_result': result,
                    'feature_columns': feature_columns,
                    'target_column': target_column,
                    'label_encoders': label_encoders
                }
                serializable_results[name]['model_key'] = model_key
        
        return jsonify({
            'success': True,
            'results': serializable_results
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@methodology_bp.route('/predict', methods=['POST'])
def make_prediction():
    """Make prediction using trained model"""
    data = request.json
    model_key = data.get('modelKey')
    input_data = data.get('inputData', {})
    
    if model_key not in trained_models:
        return jsonify({'success': False, 'error': 'Model not found'}), 404
    
    try:
        model_info = trained_models[model_key]
        prediction = predict(
            model_info['model_result'],
            input_data,
            model_info['feature_columns'],
            model_info['label_encoders']
        )
        
        return jsonify({
            'success': True,
            'prediction': prediction
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

