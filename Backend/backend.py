from fastapi import FastAPI
from fastapi.responses import JSONResponse
import os
import uvicorn

app = FastAPI(title="ClientsWebBackend API")

@app.get("/health")
async def health():
    """Health check endpoint for monitoring and load balancers"""
    return JSONResponse(
        content={
            "status": "healthy",
            "service": "ClientsWebBackend"
        },
        status_code=200
    )

@app.get("/")
async def root():
    """Root endpoint"""
    return JSONResponse(
        content={
            "message": "ClientsWebBackend API",
            "status": "running"
        },
        status_code=200
    )

if __name__ == "__main__":
    # Get port from environment variable or default to 8000
    port = int(os.environ.get("PORT", 8000))
    # Azure App Service expects the app to listen on 0.0.0.0
    uvicorn.run(app, host="0.0.0.0", port=port)
