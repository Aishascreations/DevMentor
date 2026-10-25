from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base
from app.api.auth import router as auth_router
from app.api.chat import router as chat_router
from app.api.documents import router as documents_router
from app.api.debug import router as debug_router
from app.api.quiz import router as quiz_router
from app.api.analytics import router as analytics_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for DevMentor AI Learning & Developer Copilot",
    version="1.0.0",
)

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Register API Routers
app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(documents_router)
app.include_router(debug_router)
app.include_router(quiz_router)
app.include_router(analytics_router)


@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": "DevMentor Backend",
        "version": "1.0.0"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
