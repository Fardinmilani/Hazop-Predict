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
                    'train_r2': result['train_r2'],
                    'test_r2': result['test_r2'],
                    'train_mae': result['train_mae'],
                    'test_mae': result['test_mae'],
                    'train_rmse': result['train_rmse'],
                    'test_rmse': result['test_rmse'],
                    'cv_mean': result['cv_mean'],
                    'cv_std': result['cv_std'],
                    'overfitting_score': result['overfitting_score'],
                    'is_overfitting': result['is_overfitting']
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

