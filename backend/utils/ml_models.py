"""
Machine Learning Models Utility
Handles model training, evaluation, and prediction
"""

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.linear_model import LinearRegression
from sklearn.tree import DecisionTreeRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.svm import SVR
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import warnings
warnings.filterwarnings('ignore')

def prepare_data(data, feature_columns, target_column):
    """Prepare data for ML training"""
    df = pd.DataFrame(data)
    
    # Separate features and target
    X = df[feature_columns].copy()
    y = df[target_column].copy()
    
    # Handle categorical data
    label_encoders = {}
    for col in X.columns:
        if X[col].dtype == 'object':
            le = LabelEncoder()
            X[col] = le.fit_transform(X[col].astype(str))
            label_encoders[col] = le
    
    # Handle missing values
    X = X.fillna(X.mean() if X.select_dtypes(include=[np.number]).shape[1] > 0 else 0)
    y = y.fillna(y.mean() if pd.api.types.is_numeric_dtype(y) else 0)
    
    # Convert target to numeric if needed
    if not pd.api.types.is_numeric_dtype(y):
        le_target = LabelEncoder()
        y = le_target.fit_transform(y.astype(str))
        label_encoders['target'] = le_target
    else:
        label_encoders['target'] = None
    
    return X, y, label_encoders

def train_models(X, y, test_size=0.2):
    """Train multiple ML models and return results"""
    results = {}
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=42)
    
    # Scale features for SVM
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    models = {
        'Linear Regression': LinearRegression(),
        'Decision Tree': DecisionTreeRegressor(random_state=42),
        'Random Forest': RandomForestRegressor(n_estimators=100, random_state=42),
        'SVM': SVR(kernel='rbf')
    }
    
    for name, model in models.items():
        try:
            # Use scaled data for SVM
            if name == 'SVM':
                model.fit(X_train_scaled, y_train)
                y_pred_train = model.predict(X_train_scaled)
                y_pred_test = model.predict(X_test_scaled)
            else:
                model.fit(X_train, y_train)
                y_pred_train = model.predict(X_train)
                y_pred_test = model.predict(X_test)
            
            # Calculate metrics
            train_r2 = r2_score(y_train, y_pred_train)
            test_r2 = r2_score(y_test, y_pred_test)
            train_mae = mean_absolute_error(y_train, y_pred_train)
            test_mae = mean_absolute_error(y_test, y_pred_test)
            train_rmse = np.sqrt(mean_squared_error(y_train, y_pred_train))
            test_rmse = np.sqrt(mean_squared_error(y_test, y_pred_test))
            
            # Cross-validation score
            if name == 'SVM':
                cv_scores = cross_val_score(model, X_train_scaled, y_train, cv=5, scoring='r2')
            else:
                cv_scores = cross_val_score(model, X_train, y_train, cv=5, scoring='r2')
            
            # Overfitting check (difference between train and test R²)
            overfitting_score = abs(train_r2 - test_r2)
            
            results[name] = {
                'model': model,
                'scaler': scaler if name == 'SVM' else None,
                'train_r2': float(train_r2),
                'test_r2': float(test_r2),
                'train_mae': float(train_mae),
                'test_mae': float(test_mae),
                'train_rmse': float(train_rmse),
                'test_rmse': float(test_rmse),
                'cv_mean': float(cv_scores.mean()),
                'cv_std': float(cv_scores.std()),
                'overfitting_score': float(overfitting_score),
                'is_overfitting': overfitting_score > 0.1
            }
        except Exception as e:
            results[name] = {
                'error': str(e)
            }
    
    return results, X_test, y_test

def predict(model_result, input_data, feature_columns, label_encoders):
    """Make prediction using trained model"""
    model = model_result['model']
    scaler = model_result.get('scaler')
    
    # Prepare input
    input_df = pd.DataFrame([input_data])
    X_input = input_df[feature_columns].copy()
    
    # Encode categorical features
    for col in X_input.columns:
        if col in label_encoders and X_input[col].dtype == 'object':
            le = label_encoders[col]
            try:
                X_input[col] = le.transform(X_input[col].astype(str))
            except:
                # Handle unseen categories
                X_input[col] = 0
    
    # Handle missing values
    X_input = X_input.fillna(0)
    
    # Scale if needed
    if scaler:
        X_input = scaler.transform(X_input)
    
    # Predict
    prediction = model.predict(X_input)[0]
    
    # Decode if target was encoded
    if label_encoders.get('target'):
        # For classification, return the class
        return float(prediction)
    else:
        return float(prediction)

