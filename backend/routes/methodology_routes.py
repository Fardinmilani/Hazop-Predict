"""
Methodology Routes
Handles ML model training, evaluation, and prediction
"""

from flask import Blueprint, request, jsonify
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from utils.ml_models import prepare_data, train_models, predict
import json

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
    
    if not feature_columns or not target_column:
        return jsonify({'success': False, 'error': 'Feature columns and target column required'}), 400
    
    try:
        # Prepare data
        X, y, label_encoders = prepare_data(project_data, feature_columns, target_column)
        
        # Train models
        results, X_test, y_test = train_models(X, y)
        
        # Convert results to JSON-serializable format
        serializable_results = {}
        for name, result in results.items():
            if 'error' in result:
                serializable_results[name] = result
            else:
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
                    'is_overfitting': bool(result['is_overfitting']) if result.get('is_overfitting') is not None else False
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

