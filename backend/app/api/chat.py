from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User, ChatSession
from app.schemas import ChatMessageRequest, ChatSessionResponse
from app.security import get_current_user
from app.services.chat_service import ChatService

# Make sure this exact variable name exists!
router = APIRouter(prefix="/api/chat", tags=["AI Chat Assistant"])


@router.post("/send")
async def send_message(
    req: ChatMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """FR-06 & FR-11: Stream AI response via Server-Sent Events (SSE)."""
    session = await ChatService.get_or_create_session(
        db, current_user.id, req.session_id
    )

    return StreamingResponse(
        ChatService.stream_chat_response(db, current_user.id, session.id, req.message),
        media_type="text/event-stream"
    )


@router.get("/sessions", response_model=List[ChatSessionResponse])
async def get_chat_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """FR-10: List all chat session history for current user."""
    stmt = (
        select(ChatSession)
        .where(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
    )
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/sessions/{session_id}", response_model=ChatSessionResponse)
async def get_session_by_id(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """FR-10: Retrieve past session by ID to resume dialogue."""
    stmt = select(ChatSession).where(
        ChatSession.id == session_id, ChatSession.user_id == current_user.id
    )
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return session


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """FR-10: Delete a past chat session."""
    stmt = select(ChatSession).where(
        ChatSession.id == session_id, ChatSession.user_id == current_user.id
    )
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    await db.delete(session)
    await db.commit()