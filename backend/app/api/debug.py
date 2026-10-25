from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User, DebugSession
from app.schemas import DebugRequest, DebugResponse
from app.security import get_current_user
from app.services.debug_service import DebugService

router = APIRouter(prefix="/api/debug", tags=["AI Debugging Assistant"])


@router.post("", response_model=DebugResponse)
async def submit_code_for_debugging(
    req: DebugRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """FR-19 & FR-21: Submit code and error message for structured AI debug analysis."""
    if not req.code.strip():
        raise HTTPException(status_code=400, detail="Code snippet cannot be empty.")

    try:
        analysis = await DebugService.analyze_bug(
            db, current_user.id, req.code, req.error_message, req.language
        )
        return analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Debug analysis failed: {str(e)}")


@router.get("/history", response_model=List[dict])
async def get_debug_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """FR-23: Retrieve last 10 debug sessions for current user."""
    stmt = (
        select(DebugSession)
        .where(DebugSession.user_id == current_user.id)
        .order_by(DebugSession.created_at.desc())
        .limit(10)
    )
    res = await db.execute(stmt)
    sessions = res.scalars().all()

    return [
        {
            "id": s.id,
            "language": s.language,
            "code_snippet": s.code[:100] + ("..." if len(s.code) > 100 else ""),
            "root_cause": s.root_cause,
            "created_at": s.created_at
        }
        for s in sessions
    ]