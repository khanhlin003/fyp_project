from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional
import os
from openai import OpenAI
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.services.news_service import get_news_for_ticker

router = APIRouter()

# Load OpenAI API key from environment
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=OPENAI_API_KEY)

class ChatRequest(BaseModel):
    question: str
    etf_symbol: Optional[str] = None
    etf_context: Optional[str] = None

class ChatResponse(BaseModel):
    answer: str

SYSTEM_PROMPT = """You are a knowledgeable ETF financial advisor helping retail investors understand ETFs clearly and confidently.

Rules for every response:
- Structure answers with bullet points (use "- " prefix) or numbered steps where possible.
- Use **bold** for key terms, numbers, and important takeaways.
- Be concise — aim for 3-6 bullet points maximum unless the question genuinely needs more depth.
- Always ground your answer in the ETF data provided. If data is missing, say so honestly.
- Avoid generic disclaimers unless specifically asked about risk or suitability.
- Explain financial jargon in plain language for retail investors.
- When comparing or giving pros/cons, always use a structured list.
- End with one short "Bottom line:" sentence summarising the key point."""

@router.post("/chatbot", response_model=ChatResponse)
def ask_chatbot(request: ChatRequest, user=Depends(get_current_user), db: Session = Depends(get_db)):
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured.")

    context_block = f"ETF Data:\n{request.etf_context}" if request.etf_context else ""

    # Inject recent news headlines + sentiment if a ticker is provided
    news_block = ""
    if request.etf_symbol:
        try:
            articles = get_news_for_ticker(request.etf_symbol.upper(), db, limit=5, days=7)
            if articles:
                lines = ["Recent News (last 7 days):"]
                for a in articles:
                    label = a.overall_sentiment_label or "Neutral"
                    score = f"{a.overall_sentiment_score:.2f}" if a.overall_sentiment_score is not None else "N/A"
                    summary = (a.summary or "")[:200].strip()
                    lines.append(f"- [{label}, score {score}] {a.title}. {summary}")
                news_block = "\n".join(lines)
        except Exception:
            pass  # News is supplementary; don't fail the whole request

    parts = [p for p in [context_block, news_block] if p]
    user_message = "\n\n".join(parts + [f"User question: {request.question}"]).strip()

    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            max_tokens=700,
            temperature=0.5,
        )
        answer = response.choices[0].message.content.strip()
        return ChatResponse(answer=answer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI error: {str(e)}")
