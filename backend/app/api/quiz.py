from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User, QuizResult
from app.schemas import (
    QuizGenerateRequest,
    QuizStartRequest,
    QuizQuestion,
    QuizCompleteRequest,
    QuizCompleteResponse,
)
from app.security import get_current_user
from app.services.quiz_service import QuizService

router = APIRouter(prefix="/api/quiz", tags=["Quiz & Topic Mastery"])


@router.post("/generate", response_model=List[QuizQuestion])
async def generate_quiz_custom(
    req: QuizGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        questions = await QuizService.generate_quiz_questions(
            topic=req.topic,
            difficulty=req.difficulty,
            count=req.num_questions,
        )
        return questions
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate quiz: {str(e)}",
        )


@router.post("/start")
async def start_adaptive_quiz(
    req: QuizStartRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        topic, mastery_score = await QuizService.get_target_topic_and_score(
            db=db, user_id=current_user.id, topic_param=req.topic
        )
        difficulty = QuizService.determine_difficulty(mastery_score)
        questions = await QuizService.generate_quiz_questions(
            topic=topic, difficulty=difficulty, count=5
        )
        return {
            "topic": topic,
            "difficulty": difficulty,
            "mastery_score": mastery_score,
            "questions": questions,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start adaptive quiz: {str(e)}",
        )


@router.post("/complete", response_model=QuizCompleteResponse)
async def complete_quiz(
    req: QuizCompleteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await QuizService.record_quiz_and_update_mastery(
            db=db,
            user_id=current_user.id,
            topic=req.topic,
            score=req.score,
            total_questions=req.total_questions,
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record quiz completion: {str(e)}",
        )


@router.get("/history")
async def get_quiz_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(QuizResult)
        .where(QuizResult.user_id == current_user.id)
        .order_by(QuizResult.taken_at.desc())
        .limit(30)
    )
    res = await db.execute(stmt)
    results = res.scalars().all()
    return results
