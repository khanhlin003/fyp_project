from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional
import os
from openai import OpenAI

# Import auth from the main auth module
from app.auth import get_current_user

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
def ask_chatbot(request: ChatRequest, user=Depends(get_current_user)):
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured.")

    context_block = f"ETF Data:\n{request.etf_context}" if request.etf_context else ""
    user_message = f"{context_block}\n\nUser question: {request.question}".strip()

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
