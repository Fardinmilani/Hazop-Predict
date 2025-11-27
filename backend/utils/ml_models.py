"""
Machine Learning Models Utility
Handles model training, evaluation, and prediction
"""

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.tree import DecisionTreeRegressor, DecisionTreeClassifier
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier, GradientBoostingRegressor, GradientBoostingClassifier, AdaBoostRegressor, AdaBoostClassifier
from sklearn.svm import SVR, SVC
from sklearn.neighbors import KNeighborsRegressor, KNeighborsClassifier
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score, accuracy_score, precision_score, recall_score, f1_score, classification_report
import warnings
warnings.filterwarnings('ignore')

# Try to import XGBoost and CatBoost (optional dependencies)
try:
    import xgboost as xgb
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False

try:
    import catboost as cb
    CATBOOST_AVAILABLE = True
except ImportError:
    CATBOOST_AVAILABLE = False

def prepare_data(data, feature_columns, target_column, target_type='number'):
    """
    Prepare data for ML training.
    
    This function handles numeric type coercion properly, as columns may arrive as 'object' dtype
    because project routes replace NaN with empty strings before sending data to frontend and back.
    
    Note: Negative R² values are mathematically valid and indicate the model performs worse than
    simply predicting the mean of the target on the test set.
    """
    df = pd.DataFrame(data)
    
    # STEP 1: Explicitly coerce all feature and target columns to numeric where possible
    # This handles cases where numeric-looking strings need to be converted to real numeric dtype
    all_columns = feature_columns + [target_column]
    for col in all_columns:
        if col in df.columns:
            # Try to convert to numeric, ignoring errors (keeps non-numeric as-is)
            df[col] = pd.to_numeric(df[col], errors='ignore')
    
    # STEP 2: Separate features and target from cleaned dataframe
    X = df[feature_columns].copy()
    y = df[target_column].copy()
    
    # STEP 3: Remove rows where target is completely missing
    y = y.dropna()
    X = X.loc[y.index]
    
    # STEP 4: Handle missing values AFTER numeric coercion
    # For numeric columns: fill NaN with column mean
    # For non-numeric columns: fill with default value or separate category
    label_encoders = {}
    for col in X.columns:
        if pd.api.types.is_numeric_dtype(X[col]):
            # Numeric column: fill missing values with mean
            if X[col].isna().any():
                mean_val = X[col].mean()
                if pd.isna(mean_val):
                    mean_val = 0
                X[col] = X[col].fillna(mean_val)
        else:
            # Non-numeric column: use LabelEncoder
            le = LabelEncoder()
            # Convert to string and handle missing values before encoding
            X[col] = X[col].astype(str).replace('nan', '')
            X[col] = X[col].replace('', 'Unknown')
            X[col] = X[col].fillna('Unknown')
            X[col] = le.fit_transform(X[col])
            label_encoders[col] = le
    
    # STEP 5: Ensure all feature columns are numeric (convert any remaining non-numeric)
    for col in X.columns:
        if not pd.api.types.is_numeric_dtype(X[col]):
            X[col] = pd.to_numeric(X[col], errors='coerce').fillna(0)
    
    # STEP 6: Handle target based on type and actual numeric status
    # Check if target is numeric after coercion (regardless of target_type parameter)
    is_target_numeric = pd.api.types.is_numeric_dtype(y)
    
    if target_type == 'text' or target_type == 'select' or not is_target_numeric:
        # For classification: encode target as labels
        # Convert to string and handle missing values
        y = y.astype(str).replace('nan', '')
        y = y.replace('', 'Unknown')
        y = y.fillna('Unknown')
        
        # Remove rows where target is still problematic
        valid_mask = y.notna() & (y != '')
        y = y[valid_mask]
        X = X.loc[y.index]
        
        # Apply LabelEncoder only if target is truly non-numeric
        le_target = LabelEncoder()
        y_encoded = le_target.fit_transform(y)
        label_encoders['target'] = le_target
        
        # Check if we have enough classes
        unique_classes = len(le_target.classes_)
        if unique_classes < 2:
            raise ValueError(f"Target column must have at least 2 unique classes. Found {unique_classes}.")
        
        y = y_encoded
    else:
        # For regression: target is numeric
        # Ensure it's properly numeric (should already be after coercion, but double-check)
        y = pd.to_numeric(y, errors='coerce')
        
        # Remove rows where target cannot be converted to numeric
        valid_mask = y.notna()
        y = y[valid_mask]
        X = X.loc[y.index]
        
        # Remove infinite values
        valid_mask = np.isfinite(y.values) if isinstance(y, pd.Series) else np.isfinite(y)
        y = y[valid_mask]
        X = X.loc[y.index]
        
        # Fill any remaining missing values with mean (for numeric targets)
        if y.isna().any():
            mean_val = y.mean()
            if pd.isna(mean_val):
                mean_val = 0
            y = y.fillna(mean_val)
        
        label_encoders['target'] = None
    
    # Final check: ensure we have data
    if len(X) == 0 or len(y) == 0:
        raise ValueError("No valid data after preprocessing. Please check your data.")
    
    # Ensure X and y have same length
    if len(X) != len(y):
        min_len = min(len(X), len(y))
        if isinstance(X, pd.DataFrame):
            X = X.iloc[:min_len]
        else:
            X = X[:min_len]
        if isinstance(y, pd.Series):
            y = y.iloc[:min_len]
        else:
            y = y[:min_len]
    
    return X, y, label_encoders

def train_models(X, y, test_size=0.2):
    """Train multiple ML models and return results"""
    results = {}
    
    # Check minimum data requirements
    if len(X) < 10:
        raise ValueError(f"Need at least 10 samples for regression. Found {len(X)}.")
    
    # Adjust test_size if dataset is too small
    if len(X) < 20:
        test_size = 0.3  # Use more data for training if dataset is small
    
    # Convert to numpy arrays before splitting
    if isinstance(X, pd.DataFrame):
        X_array = X.values
    else:
        X_array = np.array(X)
    
    if isinstance(y, pd.Series):
        y_array = y.values
    else:
        y_array = np.array(y)
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(X_array, y_array, test_size=test_size, random_state=42)
    
    # Ensure numeric types
    X_train = X_train.astype(float)
    X_test = X_test.astype(float)
    y_train = y_train.astype(float)
    y_test = y_test.astype(float)
    
    # Check for infinite or extremely large values
    if np.any(np.isinf(X_train)) or np.any(np.isinf(X_test)) or np.any(np.isinf(y_train)) or np.any(np.isinf(y_test)):
        # Replace infinite values with NaN and then fill with median
        X_train = pd.DataFrame(X_train).replace([np.inf, -np.inf], np.nan).fillna(pd.DataFrame(X_train).median()).values
        X_test = pd.DataFrame(X_test).replace([np.inf, -np.inf], np.nan).fillna(pd.DataFrame(X_test).median()).values
        y_train = pd.Series(y_train).replace([np.inf, -np.inf], np.nan).fillna(pd.Series(y_train).median()).values
        y_test = pd.Series(y_test).replace([np.inf, -np.inf], np.nan).fillna(pd.Series(y_test).median()).values
    
    # Check for NaN values and replace
    if np.any(np.isnan(X_train)) or np.any(np.isnan(X_test)):
        X_train = pd.DataFrame(X_train).fillna(pd.DataFrame(X_train).median()).values
        X_test = pd.DataFrame(X_test).fillna(pd.DataFrame(X_test).median()).values
    if np.any(np.isnan(y_train)) or np.any(np.isnan(y_test)):
        y_train = pd.Series(y_train).fillna(pd.Series(y_train).median()).values
        y_test = pd.Series(y_test).fillna(pd.Series(y_test).median()).values
    
    # Don't aggressively cap values - scaling will handle numerical stability
    # Only ensure no infinite or NaN values remain (already handled above)
    
    # Scale features for SVM
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # ALWAYS scale target for regression to ensure numerical stability and better model performance
    # This is especially important for large values
    y_scaler = StandardScaler()
    y_train_scaled = y_scaler.fit_transform(y_train.reshape(-1, 1)).ravel()
    y_test_scaled = y_scaler.transform(y_test.reshape(-1, 1)).ravel()
    
    # Build models dictionary dynamically
    models = {
        'Linear Regression': LinearRegression(),
        'Decision Tree': DecisionTreeRegressor(random_state=42),
        'Random Forest': RandomForestRegressor(n_estimators=100, random_state=42),
        'Gradient Boosting': GradientBoostingRegressor(n_estimators=100, random_state=42),
        'AdaBoost': AdaBoostRegressor(n_estimators=50, random_state=42),
        'K-Nearest Neighbors': KNeighborsRegressor(n_neighbors=5),
        'SVM': SVR(kernel='rbf')
    }
    
    # Add XGBoost if available
    if XGBOOST_AVAILABLE:
        models['XGBoost'] = xgb.XGBRegressor(n_estimators=100, random_state=42, verbosity=0)
    
    # Add CatBoost if available
    if CATBOOST_AVAILABLE:
        models['CatBoost'] = cb.CatBoostRegressor(iterations=100, random_state=42, verbose=False)
    
    for name, model in models.items():
        try:
            # Use scaled data for SVM and scaled target
            # XGBoost and CatBoost work better with unscaled data, but we'll use scaled target
            if name == 'SVM':
                model.fit(X_train_scaled, y_train_scaled)
                y_pred_train_scaled = model.predict(X_train_scaled)
                y_pred_test_scaled = model.predict(X_test_scaled)
            elif name == 'K-Nearest Neighbors':
                # KNN benefits from scaled features
                model.fit(X_train_scaled, y_train_scaled)
                y_pred_train_scaled = model.predict(X_train_scaled)
                y_pred_test_scaled = model.predict(X_test_scaled)
            else:
                # Other models (including XGBoost, CatBoost) work with unscaled features
                model.fit(X_train, y_train_scaled)
                y_pred_train_scaled = model.predict(X_train)
                y_pred_test_scaled = model.predict(X_test)
            
            # Inverse transform predictions if target was scaled
            if y_scaler is not None:
                y_pred_train = y_scaler.inverse_transform(y_pred_train_scaled.reshape(-1, 1)).ravel()
                y_pred_test = y_scaler.inverse_transform(y_pred_test_scaled.reshape(-1, 1)).ravel()
            else:
                y_pred_train = y_pred_train_scaled
                y_pred_test = y_pred_test_scaled
            
            # Calculate metrics
            train_r2 = r2_score(y_train, y_pred_train)
            test_r2 = r2_score(y_test, y_pred_test)
            train_mae = mean_absolute_error(y_train, y_pred_train)
            test_mae = mean_absolute_error(y_test, y_pred_test)
            train_rmse = np.sqrt(mean_squared_error(y_train, y_pred_train))
            test_rmse = np.sqrt(mean_squared_error(y_test, y_pred_test))
            
            # Cross-validation score - adjust cv based on data size
            # IMPORTANT: Use scaled target for CV since model was trained with scaled target
            # For small datasets, use fewer folds to avoid instability
            n_folds = min(5, len(X_train))
            cv_mean = None
            cv_std = None
            
            # Only run CV if we have at least 2 folds
            if n_folds >= 2:
                try:
                    if name == 'SVM' or name == 'K-Nearest Neighbors':
                        cv_scores = cross_val_score(model, X_train_scaled, y_train_scaled, cv=n_folds, scoring='r2')
                    else:
                        cv_scores = cross_val_score(model, X_train, y_train_scaled, cv=n_folds, scoring='r2')
                    cv_mean = float(cv_scores.mean())
                    cv_std = float(cv_scores.std())
                except Exception as e:
                    # If CV fails (e.g., too few samples per fold), set to None
                    cv_mean = None
                    cv_std = None
            
            # Overfitting check (difference between train and test R²)
            overfitting_score = abs(train_r2 - test_r2)
            
            results[name] = {
                'model': model,
                'scaler': scaler if name == 'SVM' else None,
                'y_scaler': y_scaler,  # Store target scaler for prediction
                'train_r2': float(train_r2),
                'test_r2': float(test_r2),
                'train_mae': float(train_mae),
                'test_mae': float(test_mae),
                'train_rmse': float(train_rmse),
                'test_rmse': float(test_rmse),
                'cv_mean': cv_mean,  # Can be None for very small datasets
                'cv_std': cv_std,    # Can be None for very small datasets
                'overfitting_score': float(overfitting_score),
                'is_overfitting': bool(overfitting_score > 0.1)  # Convert numpy bool_ to Python bool
            }
        except Exception as e:
            results[name] = {
                'error': str(e)
            }
    
    return results, X_test, y_test

def train_models_classification(X, y, test_size=0.2):
    """Train multiple classification ML models and return results"""
    results = {}
    
    # Check minimum data requirements
    if len(X) < 10:
        raise ValueError(f"Need at least 10 samples for classification. Found {len(X)}.")
    
    # Adjust test_size if dataset is too small
    if len(X) < 20:
        test_size = 0.3  # Use more data for training if dataset is small
    
    # Split data with stratification to ensure all classes are represented
    from sklearn.model_selection import StratifiedShuffleSplit
    
    # Convert to numpy arrays if they are pandas objects
    if isinstance(X, pd.DataFrame):
        X_array = X.values
    else:
        X_array = np.array(X)
    
    if isinstance(y, pd.Series):
        y_array = y.values
    else:
        y_array = np.array(y)
    
    try:
        splitter = StratifiedShuffleSplit(n_splits=1, test_size=test_size, random_state=42)
        train_idx, test_idx = next(splitter.split(X_array, y_array))
        X_train = X_array[train_idx]
        X_test = X_array[test_idx]
        y_train = y_array[train_idx]
        y_test = y_array[test_idx]
    except ValueError:
        # If stratification fails (e.g., not enough samples per class), use regular split
        X_train, X_test, y_train, y_test = train_test_split(X_array, y_array, test_size=test_size, random_state=42)
    
    # Ensure numeric types (they should already be numpy arrays)
    X_train = X_train.astype(float)
    X_test = X_test.astype(float)
    y_train = y_train.astype(int)
    y_test = y_test.astype(int)
    
    # Scale features for SVM
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Build models dictionary dynamically
    models = {
        'Logistic Regression': LogisticRegression(random_state=42, max_iter=1000),
        'Decision Tree': DecisionTreeClassifier(random_state=42),
        'Random Forest': RandomForestClassifier(n_estimators=100, random_state=42),
        'Gradient Boosting': GradientBoostingClassifier(n_estimators=100, random_state=42),
        'AdaBoost': AdaBoostClassifier(n_estimators=50, random_state=42),
        'K-Nearest Neighbors': KNeighborsClassifier(n_neighbors=5),
        'SVM': SVC(kernel='rbf', random_state=42)
    }
    
    # Add XGBoost if available
    if XGBOOST_AVAILABLE:
        models['XGBoost'] = xgb.XGBClassifier(n_estimators=100, random_state=42, verbosity=0)
    
    # Add CatBoost if available
    if CATBOOST_AVAILABLE:
        models['CatBoost'] = cb.CatBoostClassifier(iterations=100, random_state=42, verbose=False)
    
    for name, model in models.items():
        try:
            # Use scaled data for SVM and KNN
            # XGBoost and CatBoost work better with unscaled data
            if name == 'SVM' or name == 'K-Nearest Neighbors':
                model.fit(X_train_scaled, y_train)
                y_pred_train = model.predict(X_train_scaled)
                y_pred_test = model.predict(X_test_scaled)
            else:
                # Other models (including XGBoost, CatBoost) work with unscaled features
                model.fit(X_train, y_train)
                y_pred_train = model.predict(X_train)
                y_pred_test = model.predict(X_test)
            
            # Calculate metrics for classification
            train_accuracy = accuracy_score(y_train, y_pred_train)
            test_accuracy = accuracy_score(y_test, y_pred_test)
            train_precision = precision_score(y_train, y_pred_train, average='weighted', zero_division=0)
            test_precision = precision_score(y_test, y_pred_test, average='weighted', zero_division=0)
            train_recall = recall_score(y_train, y_pred_train, average='weighted', zero_division=0)
            test_recall = recall_score(y_test, y_pred_test, average='weighted', zero_division=0)
            train_f1 = f1_score(y_train, y_pred_train, average='weighted', zero_division=0)
            test_f1 = f1_score(y_test, y_pred_test, average='weighted', zero_division=0)
            
            # Cross-validation score - adjust cv based on data size
            from sklearn.model_selection import StratifiedKFold
            # Determine appropriate number of folds
            unique_classes = len(np.unique(y_train))
            min_samples_per_class = min([np.sum(y_train == cls) for cls in np.unique(y_train)])
            # Use min of 5 folds, min_samples_per_class, or len(y_train)
            n_folds = min(5, min_samples_per_class, len(y_train))
            n_folds = max(2, n_folds)  # At least 2 folds
            
            cv_mean = None
            cv_std = None
            
            # Only run CV if we have at least 2 folds
            if n_folds >= 2:
                try:
                    if name == 'SVM' or name == 'K-Nearest Neighbors':
                        cv_scores = cross_val_score(model, X_train_scaled, y_train, cv=n_folds, scoring='accuracy')
                    else:
                        cv_scores = cross_val_score(model, X_train, y_train, cv=n_folds, scoring='accuracy')
                    cv_mean = float(cv_scores.mean())
                    cv_std = float(cv_scores.std())
                except ValueError:
                    # If stratified CV fails, try regular KFold
                    try:
                        from sklearn.model_selection import KFold
                        kf = KFold(n_splits=n_folds, shuffle=True, random_state=42)
                        if name == 'SVM' or name == 'K-Nearest Neighbors':
                            cv_scores = cross_val_score(model, X_train_scaled, y_train, cv=kf, scoring='accuracy')
                        else:
                            cv_scores = cross_val_score(model, X_train, y_train, cv=kf, scoring='accuracy')
                        cv_mean = float(cv_scores.mean())
                        cv_std = float(cv_scores.std())
                    except Exception:
                        # If CV fails completely, set to None
                        cv_mean = None
                        cv_std = None
            
            # Overfitting check (difference between train and test accuracy)
            overfitting_score = abs(train_accuracy - test_accuracy)
            
            results[name] = {
                'model': model,
                'scaler': scaler if (name == 'SVM' or name == 'K-Nearest Neighbors') else None,
                'train_accuracy': float(train_accuracy),
                'test_accuracy': float(test_accuracy),
                'train_precision': float(train_precision),
                'test_precision': float(test_precision),
                'train_recall': float(train_recall),
                'test_recall': float(test_recall),
                'train_f1': float(train_f1),
                'test_f1': float(test_f1),
                'cv_mean': cv_mean,  # Can be None for very small datasets
                'cv_std': cv_std,    # Can be None for very small datasets
                'overfitting_score': float(overfitting_score),
                'is_overfitting': bool(overfitting_score > 0.1),  # Convert numpy bool_ to Python bool
                'is_classification': True
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
    
    # Scale if needed (for SVM and KNN)
    scaler = model_result.get('scaler')
    if scaler:
        X_input = scaler.transform(X_input)
    
    # Get target scaler if exists
    y_scaler = model_result.get('y_scaler')
    
    # Predict (prediction will be in scaled space if y_scaler was used)
    prediction_scaled = model.predict(X_input)[0]
    
    # Inverse transform if target was scaled
    if y_scaler is not None:
        prediction = y_scaler.inverse_transform([[prediction_scaled]])[0][0]
    else:
        prediction = prediction_scaled
    
    # Decode if target was encoded (classification)
    if label_encoders.get('target'):
        # For classification, decode the label back to original string
        le_target = label_encoders['target']
        try:
            # Ensure prediction is integer for inverse_transform
            pred_int = int(np.round(prediction))
            predicted_label = le_target.inverse_transform([pred_int])[0]
            return str(predicted_label)
        except Exception as e:
            # Fallback: return the prediction as string
            return str(prediction)
    else:
        # For regression, return numeric value
        return float(prediction)

