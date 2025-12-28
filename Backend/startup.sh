#!/bin/bash
echo "Starting application..."
cd /home/site/wwwroot || exit 1

echo "Installing dependencies..."
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

echo "Starting uvicorn..."
python -m uvicorn application:app --host 0.0.0.0 --port 8000
