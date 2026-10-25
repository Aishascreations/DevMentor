from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User, DebugSession
from app.schemas import DebugRequest, DebugResponse
from app.security import get_current_user
from app.services.debug_service import DebugService

router = APIRouter(prefix="/api/debug", tags=["AI Debugger"])


@router.post("/analyze", response_model=DebugResponse)
async def analyze_code_error(
    req: DebugRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        result = await DebugService.analyze_code_error(
            db=db,
            user_id=current_user.id,
            code=req.code,
            error_message=req.error_message,
            language=req.language
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Debugging analysis failed: {str(e)}"
        )


@router.get("/history")
async def get_debug_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(DebugSession)
        .where(DebugSession.user_id == current_user.id)
        .order_by(DebugSession.created_at.desc())
        .limit(20)
    )
    res = await db.execute(stmt)
    sessions = res.scalars().all()
    return sessions
