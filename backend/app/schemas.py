from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Any
from datetime import datetime
from uuid import UUID

class UserRegister(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=30)
    password: str = Field(..., min_length=8)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserProfileResponse(BaseModel):
    id: UUID
    email: EmailStr
    username: str
    preferred_language: str
    total_sessions: int

class ChatMessageRequest(BaseModel):
    message: str
    session_id: Optional[UUID] = None

class ChatSessionResponse(BaseModel):
    id: UUID
    title: str
    messages: List[dict]
    created_at: datetime

class DebugRequest(BaseModel):
    code: str
    error_message: Optional[str] = ""
    language: Optional[str] = "auto"

class DebugResponse(BaseModel):
    root_cause: str
    affected_lines: str
    explanation: str
    corrected_code: str
    detected_language: str

class QuizGenerateRequest(BaseModel):
    topic: str
    difficulty: str = "Medium"
    num_questions: int = Field(default=5, ge=1, le=20)

class QuizStartRequest(BaseModel):
    topic: Optional[str] = "Auto"

class QuizQuestion(BaseModel):
    question: str
    options: List[str]
    correct_index: int
    explanation: str

class QuizCompleteRequest(BaseModel):
    topic: str
    score: int
    total_questions: int
    questions: Optional[List[Any]] = []

class QuizCompleteResponse(BaseModel):
    topic: str
    new_mastery_score: float
    percentage: float
