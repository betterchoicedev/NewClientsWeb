import sys
import os

# Add packages directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'packages'))

from fastapi import FastAPI

app = FastAPI(title="ClientsWebBackend API")

@app.get("/health")
async def health():
    """Health check endpoint for monitoring and load balancers"""
    return {
        "status": "healthy",
        "service": "ClientsWebBackend"
    }

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "ClientsWebBackend API",
        "status": "running"
    }

if __name__ == "__main__":
    import uvicorn
    # Get port from environment variable or default to 8000
    port = int(os.environ.get("PORT", 8000))
    # Azure App Service expects the app to listen on 0.0.0.0
    uvicorn.run(app, host="0.0.0.0", port=port)
