'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getQuizQuestions, submitQuiz, QuizQuestion, QuizResult } from '@/lib/api';
import { ChevronLeft, ChevronRight, Check, Loader2, AlertCircle } from 'lucide-react';

export default function QuestionnairePage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [quizTitle, setQuizTitle] = useState('');

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getQuizQuestions();
      setQuestions(data.questions);
      setQuizTitle(data.title);
    } catch (err) {
      setError('Failed to load questions. Please make sure the backend server is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOptionSelect = (optionId: string) => {
    const questionKey = `q${questions[currentQuestion].question_id}`;
    setAnswers(prev => ({ ...prev, [questionKey]: optionId }));
  };

  const goToNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    }
  };

  const goToPrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);
      const quizResult = await submitQuiz(answers);
      setResult(quizResult);
    } catch (err) {
      setError('Failed to submit quiz. Please try again.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const progress = questions.length > 0 
    ? ((currentQuestion + 1) / questions.length) * 100 
    : 0;

  const currentQuestionData = questions[currentQuestion];
  const currentAnswer = currentQuestionData 
    ? answers[`q${currentQuestionData.question_id}`] 
    : null;

  const allAnswered = questions.length > 0 && 
    questions.every(q => answers[`q${q.question_id}`]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-4" />
          <p className="text-zinc-600">Loading questions...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !questions.length) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-zinc-900 mb-2">Unable to Load Quiz</h2>
          <p className="text-zinc-600 mb-6">{error}</p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={fetchQuestions}
              className="px-6 py-2.5 bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-600 transition-colors"
            >
              Try Again
            </button>
            <Link href="/" className="px-6 py-2.5 border border-zinc-200 text-zinc-600 rounded-lg font-medium hover:bg-zinc-50 transition-colors">
              Go Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Result state
  if (result) {
    return <ResultScreen result={result} />;
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Progress Bar */}
      <div className="fixed top-[56px] inset-x-0 h-1 bg-zinc-200 z-40">
        <div 
          className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Question Counter */}
      <div className="text-center pt-6 pb-2">
        <span className="text-sm text-zinc-500 font-medium">
          Question {currentQuestion + 1} of {questions.length}
        </span>
      </div>

      {/* Main Content */}
      <main className="pt-4 pb-32 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Question Card */}
          <div 
            key={currentQuestion}
            className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6 sm:p-10 animate-fadeIn"
          >
            {/* Question Number & Category */}
            <div className="flex items-center gap-3 mb-6">
              <span className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-semibold text-sm">
                {currentQuestion + 1}
              </span>
              <span className="text-sm text-zinc-500 font-medium">
                {currentQuestionData?.question_type === 'multiple_select' ? 'Select all that apply' : 'Select one'}
              </span>
            </div>

            {/* Question Text */}
            <h2 className="text-xl sm:text-2xl font-semibold text-zinc-900 mb-8 leading-relaxed">
              {currentQuestionData?.question_text}
            </h2>

            {/* Options */}
            <div className="space-y-3">
              {currentQuestionData?.options.map((option) => {
                const isSelected = currentAnswer === option.option_id;
                return (
                  <button
                    key={option.option_id}
                    onClick={() => handleOptionSelect(option.option_id)}
                    className={`w-full text-left p-4 sm:p-5 rounded-xl border-2 transition-all duration-200 group ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/60'
                        : 'border-zinc-200 hover:border-indigo-300 hover:bg-zinc-50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-medium transition-all ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-500 text-white'
                          : 'border-zinc-300 text-zinc-500 group-hover:border-indigo-400'
                      }`}>
                        {isSelected ? <Check className="w-4 h-4" /> : option.option_id}
                      </span>
                      <span className={`flex-1 ${isSelected ? 'text-indigo-900 font-medium' : 'text-zinc-700'}`}>
                        {option.text}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Navigation Dots */}
          <div className="flex justify-center gap-1.5 mt-8">
            {questions.map((_, idx) => {
              const questionKey = `q${questions[idx].question_id}`;
              const isAnswered = !!answers[questionKey];
              const isCurrent = idx === currentQuestion;
              return (
                <button
                  key={idx}
                  onClick={() => setCurrentQuestion(idx)}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    isCurrent
                      ? 'bg-indigo-500 w-6'
                      : isAnswered
                      ? 'bg-indigo-300 hover:bg-indigo-400'
                      : 'bg-zinc-300 hover:bg-zinc-400'
                  }`}
                  title={`Question ${idx + 1}`}
                />
              );
            })}
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 inset-x-0 bg-white/80 backdrop-blur-xl border-t border-zinc-200 p-4">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <button
            onClick={goToPrevious}
            disabled={currentQuestion === 0}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all ${
              currentQuestion === 0
                ? 'text-zinc-300 cursor-not-allowed'
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Previous</span>
          </button>

          <div className="flex items-center gap-3">
            {currentQuestion < questions.length - 1 ? (
              <button
                onClick={goToNext}
                disabled={!currentAnswer}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all ${
                  currentAnswer
                    ? 'bg-indigo-500 text-white hover:bg-indigo-600'
                    : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                }`}
              >
                <span>Next</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!allAnswered || submitting}
                className={`flex items-center gap-2 px-8 py-2.5 rounded-lg font-medium transition-all ${
                  allAnswered && !submitting
                    ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                    : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                }`}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    <span>Get Results</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Result Screen Component
function ResultScreen({ result }: { result: QuizResult }) {
  const router = useRouter();
  
  const getProfileColor = (profile: string) => {
    switch (profile.toLowerCase()) {
      case 'conservative':
        return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-500', gradient: 'from-green-500 to-emerald-600' };
      case 'balanced':
        return { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-500', gradient: 'from-blue-500 to-indigo-600' };
      case 'aggressive':
        return { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-500', gradient: 'from-orange-500 to-red-600' };
      default:
        return { bg: 'bg-zinc-100', text: 'text-zinc-700', border: 'border-zinc-500', gradient: 'from-zinc-500 to-zinc-600' };
    }
  };

  const colors = getProfileColor(result.risk_profile);

  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="py-8 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Result Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
            {/* Header */}
            <div className={`bg-gradient-to-r ${colors.gradient} p-8 text-white text-center`}>
              <p className="text-white/80 text-sm font-medium mb-2">Your Risk Profile</p>
              <h1 className="text-4xl font-bold mb-3">{result.risk_profile}</h1>
              <p className="text-white/90">{result.profile_description}</p>
            </div>

            {/* Score */}
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <p className="text-zinc-500 text-sm">Your Score</p>
                  <p className="text-3xl font-bold text-zinc-900">
                    {result.total_score} <span className="text-lg text-zinc-400">/ {result.max_possible_score}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-zinc-500 text-sm">Percentile</p>
                  <p className="text-3xl font-bold text-zinc-900">{result.percentage.toFixed(0)}%</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-3 bg-zinc-100 rounded-full overflow-hidden mb-8">
                <div 
                  className={`h-full bg-gradient-to-r ${colors.gradient} transition-all duration-1000`}
                  style={{ width: `${result.percentage}%` }}
                />
              </div>

              {/* Profile Scale */}
              <div className="flex justify-between text-xs text-zinc-500 mb-8">
                <span>Conservative</span>
                <span>Balanced</span>
                <span>Aggressive</span>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => router.push(`/recommendations?profile=${result.risk_profile.toLowerCase()}`)}
                  className="flex-1 bg-indigo-500 text-white py-3 px-6 rounded-xl font-medium hover:bg-indigo-600 transition-colors text-center"
                >
                  View Recommended ETFs
                </button>
                <Link
                  href="/questionnaire"
                  onClick={() => window.location.reload()}
                  className="flex-1 border-2 border-zinc-200 text-zinc-600 py-3 px-6 rounded-xl font-medium hover:bg-zinc-50 transition-colors text-center"
                >
                  Retake Quiz
                </Link>
              </div>
            </div>
          </div>

          {/* Score Breakdown */}
          <div className="mt-8 bg-white rounded-2xl shadow-sm border border-zinc-100 p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-zinc-900 mb-6">Score Breakdown</h2>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {result.breakdown.map((item, idx) => (
                <div key={idx} className="flex items-start gap-4 p-4 bg-zinc-50 rounded-xl">
                  <span className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-semibold text-sm flex-shrink-0">
                    {item.question_id}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-700 mb-1 line-clamp-2">{item.question_text}</p>
                    <p className="text-xs text-zinc-500">
                      Selected: <span className="font-medium">{item.selected_option}</span> • 
                      Points: <span className="font-medium text-indigo-600">{item.points_earned}</span> / {item.max_points}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
