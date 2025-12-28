#!/bin/bash
cd /home/site/wwwroot

# Find Python executable
PYTHON_CMD="python3"
if ! command -v python3 &> /dev/null; then
    PYTHON_CMD="python"
fi

echo "Using Python command: $PYTHON_CMD"

# Install dependencies
echo "Installing Python dependencies..."
$PYTHON_CMD -m pip install --upgrade pip
$PYTHON_CMD -m pip install -r requirements.txt

# Start the FastAPI application with gunicorn
echo "Starting FastAPI application..."
$PYTHON_CMD -m gunicorn --bind 0.0.0.0:8000 --timeout 120 --workers 4 --worker-class uvicorn.workers.UvicornWorker backend:app 

