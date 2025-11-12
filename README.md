# HAZOP Analysis Tool

A full-stack web application for Hazard and Operability (HAZOP) analysis with machine learning capabilities and ranking algorithms.

## Features

- **File Management**: Create, open, save, and export projects in JSON, CSV, or Excel formats
- **Library Management**: Define custom headers and options for data entry
- **Project Workspace**: Dynamic data table with dropdown cells based on library definitions
- **Machine Learning**: Train and evaluate multiple ML models (Linear Regression, Decision Tree, Random Forest, SVM)
- **Ranking**: AHP (Analytic Hierarchy Process) for ranking alternatives
- **Reports**: Statistical summaries and data visualizations with export capabilities

## Tech Stack

### Backend
- Python Flask
- pandas, numpy, scikit-learn
- openpyxl (Excel support)
- matplotlib, seaborn (visualizations)
- reportlab (PDF generation)

### Frontend
- React + Vite
- TailwindCSS
- React Router
- Axios
- Lucide React (icons)

## Project Structure

```
hazop-app/
├── backend/
│   ├── app.py                 # Flask main application
│   ├── routes/                # API route handlers
│   │   ├── file_routes.py
│   │   ├── library_routes.py
│   │   ├── project_routes.py
│   │   ├── methodology_routes.py
│   │   ├── ranking_routes.py
│   │   └── report_routes.py
│   └── utils/                 # Utility modules
│       ├── file_manager.py
│       ├── ml_models.py
│       ├── ahp.py
│       └── report_generator.py
├── frontend/
│   ├── src/
│   │   ├── pages/             # React page components
│   │   ├── components/        # Reusable components
│   │   └── utils/             # API utilities
│   ├── package.json
│   └── vite.config.js
├── data/                      # Local data storage (created automatically)
├── requirements.txt
└── README.md
```

## Setup Instructions

### Prerequisites
- Python 3.8+
- Node.js 16+
- npm or yarn

### Backend Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Run the Flask server:
```bash
cd backend
python app.py
```

The backend will run on `http://localhost:5000`

### Frontend Setup

1. Install Node dependencies:
```bash
cd frontend
npm install
```

2. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:3000`

## Usage

1. **Library Management**: First, define headers and their options in the Library page
2. **Project Workspace**: Create a new project and add columns from the library
3. **Data Entry**: Add rows and fill in data using dropdowns (based on library definitions)
4. **Machine Learning**: Select features and target, train models, and make predictions
5. **Ranking**: Set criteria weights and alternative scores, then calculate AHP ranking
6. **Reports**: Generate statistics and visualizations, export as Excel or PDF

## API Endpoints

### File Operations
- `POST /api/file/new` - Create new project
- `POST /api/file/open` - Open existing project
- `POST /api/file/save` - Save project
- `POST /api/file/save-as` - Save project with new name
- `GET /api/file/list` - List all project files

### Library
- `GET /api/library/get` - Get library configuration
- `POST /api/library/save` - Save library
- `POST /api/library/header/add` - Add new header
- `PUT /api/library/header/update` - Update header
- `DELETE /api/library/header/delete` - Delete header

### Project
- `GET /api/project/get` - Get project data
- `POST /api/project/update` - Update project data
- `POST /api/project/row/add` - Add row
- `DELETE /api/project/row/delete` - Delete row

### Methodology (ML)
- `POST /api/methodology/train` - Train ML models
- `POST /api/methodology/predict` - Make prediction

### Ranking
- `POST /api/ranking/ahp` - Perform AHP ranking
- `POST /api/ranking/pairwise-matrix` - Create pairwise comparison matrix

### Reports
- `POST /api/report/statistics` - Get statistics
- `POST /api/report/visualizations` - Generate visualization
- `POST /api/report/export-excel` - Export as Excel
- `POST /api/report/export-pdf` - Export as PDF

## Data Storage

All data is stored locally in the `data/` directory:
- `library.json` - Library configuration
- Project files - Saved as `.json`, `.csv`, or `.xlsx` based on user selection

## Future Enhancements

- TOPSIS and VIKOR ranking algorithms
- Electron packaging for desktop app
- Database integration (optional)
- User authentication
- Collaborative features
- Advanced ML models

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

