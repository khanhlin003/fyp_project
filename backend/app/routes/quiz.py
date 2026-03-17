"""
Quiz & Risk Profile Endpoints
Handles quiz questions, submission, and risk profile calculation
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Optional
import json
import os

router = APIRouter()

# Path to quiz questions JSON
QUIZ_FILE_PATH = os.path.join(
    os.path.dirname(__file__), 
    "../../../..", 
    "data/user_info/quiz_qus.json"
)

# Pydantic models
class QuizAnswer(BaseModel):
    answers: Dict[str, str]  # {"q1": "A", "q2": "B", ...}

class QuestionOption(BaseModel):
    option_id: str
    text: str
    points: int

class Question(BaseModel):
    question_id: int
    question_text: str
    question_type: str
    options: List[QuestionOption]
    scoring_note: Optional[str] = None

class QuizQuestionsResponse(BaseModel):
    title: str
    description: str
    total_questions: int
    questions: List[Question]

class RiskProfile(BaseModel):
    profile_name: str
    min_score: int
    max_score: int
    description: str

class ScoringInfo(BaseModel):
    min_score: int
    max_score: int
    risk_profiles: List[RiskProfile]

class QuizResultBreakdown(BaseModel):
    question_id: int
    question_text: str
    selected_option: str
    points_earned: int
    max_points: int

class QuizResult(BaseModel):
    total_score: int
    max_possible_score: int
    percentage: float
    risk_profile: str
    profile_description: str
    breakdown: List[QuizResultBreakdown]


def load_quiz_data():
    """Load quiz data from JSON file"""
    try:
        # Try multiple paths
        paths_to_try = [
            QUIZ_FILE_PATH,
            os.path.join(os.getcwd(), "data/user_info/quiz_qus.json"),
            os.path.join(os.getcwd(), "../data/user_info/quiz_qus.json"),
            "/Users/linhtrankhanh/Downloads/fyp/project/data/user_info/quiz_qus.json"
        ]
        
        for path in paths_to_try:
            if os.path.exists(path):
                with open(path, 'r') as f:
                    return json.load(f)
        
        raise FileNotFoundError(f"Quiz file not found in any of: {paths_to_try}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load quiz data: {str(e)}")


def calculate_score(answers: Dict[str, str], quiz_data: dict) -> tuple:
    """
    Calculate quiz score with refined logic:
    - Q2 (multi-select): Cap at 50 points
    - Q4, Q12, Q14: Points already doubled in JSON
    - Q13: Reversed scoring (FOMO = high points)
    """
    questions = quiz_data["quiz"]["questions"]
    total_score = 0
    breakdown = []
    
    for question in questions:
        q_id = question["question_id"]
        q_key = f"q{q_id}"
        
        if q_key not in answers:
            # Skip unanswered questions
            continue
        
        selected_option_id = answers[q_key].upper()
        
        # Find selected option
        selected_option = None
        max_points = 0
        
        for opt in question["options"]:
            if opt["points"] > max_points:
                max_points = opt["points"]
            if opt["option_id"] == selected_option_id:
                selected_option = opt
        
        if selected_option:
            points = selected_option["points"]
            
            # Q2 special handling: cap at 50 for multi-select
            # (In case frontend sends multiple selections as comma-separated)
            if q_id == 2 and "scoring_note" in question:
                points = min(points, 50)
            
            total_score += points
            
            breakdown.append(QuizResultBreakdown(
                question_id=q_id,
                question_text=question["question_text"][:50] + "...",
                selected_option=selected_option_id,
                points_earned=points,
                max_points=max_points
            ))
    
    return total_score, breakdown


def get_risk_profile(score: int, quiz_data: dict) -> tuple:
    """Determine risk profile based on score"""
    profiles = quiz_data["quiz"]["scoring"]["risk_profiles"]
    
    for profile in profiles:
        if profile["min_score"] <= score <= profile["max_score"]:
            return profile["profile_name"], profile["description"]
    
    # Default to Balanced if score doesn't match any range
    return "Balanced", "Moderate-risk investor balancing growth with stability"


@router.get("/questions", response_model=QuizQuestionsResponse)
async def get_quiz_questions():
    """
    Get all 15 quiz questions with options and points.
    Frontend can use this to dynamically render the quiz.
    """
    quiz_data = load_quiz_data()
    quiz = quiz_data["quiz"]
    
    return QuizQuestionsResponse(
        title=quiz["title"],
        description=quiz["description"],
        total_questions=quiz["total_questions"],
        questions=[Question(**q) for q in quiz["questions"]]
    )


@router.post("/submit", response_model=QuizResult)
async def submit_quiz(quiz_answer: QuizAnswer):
    """
    Submit quiz answers and get risk profile.
    
    Request body:
    ```json
    {
        "answers": {
            "q1": "C",
            "q2": "B",
            "q3": "D",
            ...
            "q15": "B"
        }
    }
    ```
    
    Scoring logic:
    - Q2 (multi-select): Capped at 50 points max
    - Q4, Q12, Q14 (emotional): Points doubled for better risk assessment
    - Q13 (FOMO): Reversed - impulsive behavior = high points (aggressive)
    
    Risk Profiles:
    - Conservative: 0-425 points
    - Balanced: 426-850 points  
    - Aggressive: 851-1275 points
    """
    quiz_data = load_quiz_data()
    
    # Validate we have at least some answers
    if not quiz_answer.answers:
        raise HTTPException(status_code=400, detail="No answers provided")
    
    # Calculate score
    total_score, breakdown = calculate_score(quiz_answer.answers, quiz_data)
    
    # Get risk profile
    profile_name, profile_description = get_risk_profile(total_score, quiz_data)
    
    # Calculate max possible score
    max_score = quiz_data["quiz"]["scoring"]["max_score"]
    
    return QuizResult(
        total_score=total_score,
        max_possible_score=max_score,
        percentage=round((total_score / max_score) * 100, 1) if max_score > 0 else 0,
        risk_profile=profile_name,
        profile_description=profile_description,
        breakdown=breakdown
    )


@router.get("/scoring-info", response_model=ScoringInfo)
async def get_scoring_info():
    """
    Get scoring thresholds and risk profile descriptions.
    Useful for displaying to users what each profile means.
    """
    quiz_data = load_quiz_data()
    scoring = quiz_data["quiz"]["scoring"]
    
    return ScoringInfo(
        min_score=scoring["min_score"],
        max_score=scoring["max_score"],
        risk_profiles=[RiskProfile(**p) for p in scoring["risk_profiles"]]
    )
