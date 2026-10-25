from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "DevMentor AI"
    DATABASE_URL: str = "postgresql+asyncpg://devmentor_user:devmentor_pass@postgres:5432/devmentor_db"
    OPENAI_API_KEY: str = "your_openai_api_key_here"
    QDRANT_HOST: str = "qdrant"
    QDRANT_PORT: int = 6333
    JWT_SECRET: str = "supersecretjwtkey123"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080
    MASTERY_ALPHA: float = 0.30

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()