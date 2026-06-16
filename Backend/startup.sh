#!/bin/bash
echo "Starting FastAPI application with uvicorn..."
cd /home/site/wwwroot

# Install dependencies if needed
python -m pip install -q --upgrade pip
python -m pip install -q -r requirements.txt

# Start uvicorn
exec python -m uvicorn application:app --host 0.0.0.0 --port 8000
