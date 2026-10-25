import json
from typing import AsyncGenerator
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from openai import AsyncOpenAI

from app.config import settings
from app.models import ChatSession

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


class ChatService:
    @staticmethod
    async def get_or_create_session(
        db: AsyncSession, user_id: UUID, session_id: UUID = None
    ) -> ChatSession:
        if session_id:
            stmt = select(ChatSession).where(
                ChatSession.id == session_id, ChatSession.user_id == user_id
            )
            res = await db.execute(stmt)
            session = res.scalar_one_or_none()
            if session:
                return session

        new_session = ChatSession(
            user_id=user_id,
            title="New Conversation",
            messages=[]
        )
        db.add(new_session)
        await db.commit()
        await db.refresh(new_session)
        return new_session

    @staticmethod
    async def stream_chat_response(
        db: AsyncSession, user_id: UUID, session_id: UUID, message: str
    ) -> AsyncGenerator[str, None]:
        session = await ChatService.get_or_create_session(db, user_id, session_id)

        history = list(session.messages or [])
        history.append({"role": "user", "content": message})

        system_prompt = {
            "role": "system",
            "content": "You are DevMentor, an expert AI tutor for Computer Science and Software Engineering."
        }
        messages_to_send = [system_prompt] + history

        try:
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages_to_send,
                stream=True
            )

            full_reply = ""
            async for chunk in response:
                content = chunk.choices[0].delta.content or ""
                if content:
                    full_reply += content
                    yield f"data: {json.dumps({'token': content})}\n\n"

            history.append({"role": "assistant", "content": full_reply})
            session.messages = history
            if len(history) == 2:
                session.title = message[:40]

            await db.commit()
            yield f"data: {json.dumps({'done': True, 'session_id': str(session.id)})}\n\n"

        except Exception as e:
            err_msg = f"[OpenAI Stream Error: {str(e)}]"
            yield f"data: {json.dumps({'token': err_msg})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
