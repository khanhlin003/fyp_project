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

@router.post("/chatbot", response_model=ChatResponse)
def ask_chatbot(request: ChatRequest, user=Depends(get_current_user)):
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured.")
    prompt = f"You are an ETF expert. {request.etf_context or ''}\nUser question: {request.question}"
    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "system", "content": "You are an ETF expert."},
                      {"role": "user", "content": prompt}],
            max_tokens=512,
            temperature=0.7,
        )
        answer = response.choices[0].message.content.strip()
        return ChatResponse(answer=answer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI error: {str(e)}")
