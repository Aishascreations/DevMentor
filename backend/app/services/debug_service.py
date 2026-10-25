import json
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from openai import AsyncOpenAI

from app.config import settings
from app.models import DebugSession
from app.schemas import DebugResponse

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


class DebugService:
    @staticmethod
    def detect_language(code: str, suggested_lang: str) -> str:
        """FR-20: Language auto-detection fallback."""
        if suggested_lang and suggested_lang != "auto":
            return suggested_lang

        code_lower = code.lower()
        if "def " in code_lower or "import " in code_lower and ":" in code_lower:
            return "Python"
        elif "public class " in code_lower or "system.out.println" in code_lower:
            return "Java"
        elif "#include" in code_lower or "std::cout" in code_lower:
            return "C++"
        elif "const " in code_lower or "let " in code_lower or "console.log" in code_lower:
            return "JavaScript"
        return "Python"  # Default fallback

    @staticmethod
    async def analyze_bug(
        db: AsyncSession, user_id: UUID, code: str, error_message: str, language: str
    ) -> DebugResponse:
        """FR-21 & FR-22: Structured prompt and JSON response parsing."""
        detected_lang = DebugService.detect_language(code, language)

        system_prompt = (
            "You are an expert AI Debugging Assistant. Analyze the provided buggy code and optional error message. "
            "Return a JSON object with EXACTLY these four keys:\n"
            "1. 'root_cause': A concise summary of why the error occurred.\n"
            "2. 'affected_lines': Specific line numbers or code blocks involved (e.g., 'Lines 12-15').\n"
            "3. 'explanation': A clear, step-by-step breakdown explaining how to fix the issue.\n"
            "4. 'corrected_code': The complete, corrected code snippet ready to copy-paste."
        )

        user_content = f"Programming Language: {detected_lang}\n\nCode Snippet:\n```\n{code}\n```"
        if error_message:
            user_content += f"\n\nError Message / Stack Trace:\n```\n{error_message}\n```"

        response = await client.chat.completions.create(
            model="gpt-4o",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ]
        )

        raw_json = response.choices[0].message.content
        parsed = json.loads(raw_json)

        # Persist session to PostgreSQL (FR-23)
        debug_session = DebugSession(
            user_id=user_id,
            code=code,
            error_message=error_message,
            language=detected_lang,
            root_cause=parsed.get("root_cause", ""),
            corrected_code=parsed.get("corrected_code", "")
        )
        db.add(debug_session)
        await db.commit()

        return DebugResponse(
            root_cause=parsed.get("root_cause", "No root cause identified."),
            affected_lines=parsed.get("affected_lines", "N/A"),
            explanation=parsed.get("explanation", "No explanation provided."),
            corrected_code=parsed.get("corrected_code", code),
            detected_language=detected_lang
        )