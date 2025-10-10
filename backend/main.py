import uvicorn
from fastapi import FastAPI
from backend.presentation.user_api import router as user_router

app = FastAPI()

app.include_router(user_router, prefix="/api/v1")

@app.get("/")
async def root():
    return {"message": "Hello from backend!"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
