# Quick Start Guide

## Prerequisites
- Python 3.8 or higher
- Node.js 16 or higher
- npm or yarn

## Installation Steps

### 1. Install Backend Dependencies
```bash
pip install -r requirements.txt
```

### 2. Install Frontend Dependencies
```bash
cd frontend
npm install
cd ..
```

## Running the Application

### Option 1: Using Batch Files (Windows)
1. Start Backend: Double-click `run_backend.bat` or run in terminal:
   ```bash
   run_backend.bat
   ```

2. Start Frontend: Open a new terminal and run:
   ```bash
   run_frontend.bat
   ```

### Option 2: Manual Start

**Terminal 1 - Backend:**
```bash
cd backend
python app.py
```
Backend will run on `http://localhost:5000`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
Frontend will run on `http://localhost:3000`

## First Steps

1. **Open the application** in your browser: `http://localhost:3000`

2. **Set up Library** (Library page):
   - Add headers (e.g., "Deviation", "Cause", "Consequence")
   - Add options for each header (e.g., for "Deviation": "No Flow", "High Flow", "Low Flow")

3. **Create a Project** (File page):
   - Click "New" to create a new project
   - Go to Project page and add columns from Library
   - Add rows and fill in data

4. **Use ML Models** (Methodology page):
   - Select feature columns and target column
   - Train models and compare results
   - Make predictions on new data

5. **Ranking** (Ranking page):
   - Set criteria weights
   - Enter alternative scores
   - Calculate AHP ranking

6. **Generate Reports** (Reports page):
   - View statistics
   - Generate visualizations
   - Export as Excel or PDF

## Troubleshooting

### Backend won't start
- Check if port 5000 is available
- Verify all Python dependencies are installed: `pip list`
- Check for import errors in the terminal

### Frontend won't start
- Check if port 3000 is available
- Verify Node modules are installed: `cd frontend && npm list`
- Clear cache: `npm cache clean --force` then `npm install`

### CORS Errors
- Ensure backend is running on port 5000
- Check that Flask-CORS is installed
- Verify the proxy configuration in `frontend/vite.config.js`

### Data not saving
- Check that the `data/` directory exists (created automatically)
- Verify file permissions
- Check browser console for errors

## Project Structure

```
Hazop-Predict/
├── backend/           # Flask backend
│   ├── app.py        # Main application
│   ├── routes/       # API routes
│   └── utils/        # Utility functions
├── frontend/         # React frontend
│   └── src/
│       ├── pages/    # Page components
│       ├── components/ # Reusable components
│       └── utils/    # API utilities
└── data/             # Local data storage (auto-created)
```

## Next Steps

- Customize library definitions for your HAZOP analysis needs
- Add more data to your project
- Experiment with different ML models
- Generate comprehensive reports

For detailed documentation, see README.md

