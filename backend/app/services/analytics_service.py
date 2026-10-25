import json
from datetime import datetime, timedelta
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from openai import AsyncOpenAI

from app.config import settings
from app.models import TopicMastery, QuizResult, ChatSession, DebugSession

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


class AnalyticsService:
    @staticmethod
    async def get_dashboard_metrics(db: AsyncSession, user_id: UUID) -> dict:
        """FR-31 to FR-35: Aggregates mastery scores, stats, weak topics, and trends."""
        # 1. Fetch Topic Mastery Scores (FR-31)
        stmt_mastery = select(TopicMastery).where(TopicMastery.user_id == user_id)
        res_mastery = await db.execute(stmt_mastery)
        mastery_rows = res_mastery.scalars().all()

        mastery_data = [
            {
                "topic": m.topic,
                "mastery_score": m.mastery_score,
                "quiz_count": m.quiz_count,
                "status": "red" if m.mastery_score < 50 else ("amber" if m.mastery_score <= 75 else "green")
            }
            for m in mastery_rows
        ]

        # 2. Identify Weak Topics (< 50%) and generate AI Recommendations (FR-33)
        weak_topics = [m for m in mastery_rows if m.mastery_score < 50.0]
        recommendations = []

        if weak_topics:
            weak_list_str = ", ".join([f"{m.topic} ({m.mastery_score}%)" for m in weak_topics])
            system_prompt = (
                "You are an AI CS Learning Advisor. Given a list of weak computer science topics and "
                "their mastery percentage scores, provide ONE specific, actionable, single-sentence study recommendation for each topic. "
                "Return a JSON object where keys are the exact topic names and values are the recommendation strings."
            )
            try:
                response = await client.chat.completions.create(
                    model="gpt-4o",
                    response_format={"type": "json_object"},
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"Weak Topics: {weak_list_str}"}
                    ]
                )
                recs_json = json.loads(response.choices[0].message.content)
                for m in weak_topics:
                    recommendations.append({
                        "topic": m.topic,
                        "mastery_score": m.mastery_score,
                        "recommendation": recs_json.get(m.topic, f"Review core foundational principles of {m.topic}.")
                    })
            except Exception:
                for m in weak_topics:
                    recommendations.append({
                        "topic": m.topic,
                        "mastery_score": m.mastery_score,
                        "recommendation": f"Practice basic exercises and review lecture slides for {m.topic}."
                    })

        # 3. Aggregate Usage Statistics (FR-34)
        stmt_chat = select(func.count(ChatSession.id)).where(ChatSession.user_id == user_id)
        chat_count = (await db.execute(stmt_chat)).scalar() or 0

        stmt_debug = select(func.count(DebugSession.id)).where(DebugSession.user_id == user_id)
        debug_count = (await db.execute(stmt_debug)).scalar() or 0

        stmt_quiz = select(
            func.count(QuizResult.id),
            func.avg(QuizResult.percentage)
        ).where(QuizResult.user_id == user_id)
        quiz_res = (await db.execute(stmt_quiz)).fetchone()
        total_quizzes = quiz_res[0] or 0
        avg_quiz_score = round(quiz_res[1] or 0.0, 1)

        total_sessions = chat_count + debug_count + total_quizzes

        # 4. Progress Trend over last 30 days (FR-35)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        stmt_trend = (
            select(QuizResult)
            .where(QuizResult.user_id == user_id, QuizResult.taken_at >= thirty_days_ago)
            .order_by(QuizResult.taken_at.asc())
        )
        trend_rows = (await db.execute(stmt_trend)).scalars().all()

        progress_trend = [
            {
                "date": q.taken_at.strftime("%Y-%m-%d"),
                "score": q.percentage,
                "topic": q.topic
            }
            for q in trend_rows
        ]

        return {
            "mastery_scores": mastery_data,
            "weak_topic_alerts": recommendations,
            "stats": {
                "total_sessions": total_sessions,
                "chat_sessions": chat_count,
                "debug_sessions": debug_count,
                "total_quizzes": total_quizzes,
                "average_quiz_score": avg_quiz_score
            },
            "progress_trend": progress_trend
        }