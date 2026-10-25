import json
from typing import List, Tuple, Any
from uuid import UUID
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from openai import AsyncOpenAI

from app.config import settings
from app.models import TopicMastery, QuizResult
from app.schemas import QuizQuestion, QuizCompleteResponse

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

class QuizService:
    @staticmethod
    def determine_difficulty(mastery_score: float) -> str:
        if mastery_score < 50.0:
            return "Easy"
        elif mastery_score <= 75.0:
            return "Medium"
        return "Hard"

    @staticmethod
    async def get_target_topic_and_score(
        db: AsyncSession, user_id: UUID, topic_param: str
    ) -> Tuple[str, float]:
        if topic_param and topic_param.lower() != "auto":
            stmt = select(TopicMastery).where(
                TopicMastery.user_id == user_id, TopicMastery.topic == topic_param
            )
            res = await db.execute(stmt)
            tm = res.scalar_one_or_none()
            return topic_param, (tm.mastery_score if tm else 0.0)

        stmt = (
            select(TopicMastery)
            .where(TopicMastery.user_id == user_id)
            .order_by(TopicMastery.mastery_score.asc())
        )
        res = await db.execute(stmt)
        lowest_tm = res.scalars().first()

        if lowest_tm:
            return lowest_tm.topic, lowest_tm.mastery_score
        return "Data Structures", 0.0

    @staticmethod
    async def generate_quiz_questions(
        topic: str, difficulty: str, count: int = 5
    ) -> List[QuizQuestion]:
        system_prompt = (
            f"You are a CS quiz generator. Generate {count} multiple-choice questions on '{topic}' "
            f"at '{difficulty}' difficulty. Return a JSON object with a key 'questions' containing an array of objects. "
            "Each question object MUST have:\n"
            "- 'question': clear question string\n"
            "- 'options': array of 4 string choices\n"
            "- 'correct_index': integer (0 to 3) pointing to the correct choice\n"
            "- 'explanation': one paragraph explaining why the answer is correct."
        )

        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[{"role": "system", "content": system_prompt}],
        )

        parsed = json.loads(response.choices[0].message.content)
        questions_raw = parsed.get("questions", [])

        return [
            QuizQuestion(
                question=q["question"],
                options=q["options"],
                correct_index=q["correct_index"],
                explanation=q["explanation"],
            )
            for q in questions_raw
        ]

    @staticmethod
    async def record_quiz_and_update_mastery(
        db: AsyncSession, user_id: UUID, topic: str, score: int, total_questions: int, questions: List[Any] = None
    ) -> QuizCompleteResponse:
        percentage = (
            (score / total_questions) * 100.0 if total_questions > 0 else 0.0
        )

        stmt = select(TopicMastery).where(
            TopicMastery.user_id == user_id, TopicMastery.topic == topic
        )
        res = await db.execute(stmt)
        tm = res.scalar_one_or_none()

        old_score = tm.mastery_score if tm else 0.0
        alpha = getattr(settings, "MASTERY_ALPHA", 0.30)

        new_mastery_score = (alpha * percentage) + ((1.0 - alpha) * old_score)
        new_mastery_score = round(min(max(new_mastery_score, 0.0), 100.0), 2)

        difficulty = QuizService.determine_difficulty(old_score)

        quiz_res = QuizResult(
            user_id=user_id,
            topic=topic,
            difficulty=difficulty,
            score=score,
            total_questions=total_questions,
            percentage=percentage,
            questions=questions or [],
        )
        db.add(quiz_res)

        if tm:
            tm.mastery_score = new_mastery_score
            tm.quiz_count += 1
            tm.last_updated = datetime.utcnow()
        else:
            tm = TopicMastery(
                user_id=user_id,
                topic=topic,
                mastery_score=new_mastery_score,
                quiz_count=1,
            )
            db.add(tm)

        await db.commit()

        return QuizCompleteResponse(
            topic=topic,
            new_mastery_score=new_mastery_score,
            percentage=percentage,
        )
