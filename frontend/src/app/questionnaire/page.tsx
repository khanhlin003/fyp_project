'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getQuizQuestions, submitQuiz, QuizQuestion, QuizResult } from '@/lib/api';
import { Check, Loader2, AlertCircle, X } from 'lucide-react';

export default function QuestionnairePage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [quizTitle, setQuizTitle] = useState('');
  const [isEditingQuiz, setIsEditingQuiz] = useState(false);

  useEffect(() => {
    fetchQuestions();
    hydrateSavedResult();
  }, []);

  const hydrateSavedResult = () => {
    try {
      const savedResult = localStorage.getItem('latestQuizResult');
      if (!savedResult) return;

      const parsed = JSON.parse(savedResult) as QuizResult;
      setResult(parsed);

      const hydratedAnswers = parsed.breakdown.reduce<Record<string, string>>((acc, item) => {
        acc[`q${item.question_id}`] = item.selected_option;
        return acc;
      }, {});

      setAnswers(hydratedAnswers);
    } catch (storageError) {
      console.error('Failed to load saved quiz result:', storageError);
    }
  };

  const handleCloseQuiz = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/');
  };

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

  const handleOptionSelect = (questionId: number, optionId: string) => {
    const questionKey = `q${questionId}`;
    setAnswers(prev => ({ ...prev, [questionKey]: optionId }));
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);
      const quizResult = await submitQuiz(answers);
      setResult(quizResult);
      setIsEditingQuiz(false);
      localStorage.setItem('latestQuizResult', JSON.stringify(quizResult));
    } catch (err) {
      setError('Failed to submit quiz. Please try again.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const answeredCount = questions.reduce((count, question) => {
    const questionKey = `q${question.question_id}`;
    return answers[questionKey] ? count + 1 : count;
  }, 0);

  const progress = questions.length > 0 
    ? (answeredCount / questions.length) * 100 
    : 0;

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
  if (result && !isEditingQuiz) {
    return (
      <ResultScreen
        result={result}
        questions={questions}
        onClose={handleCloseQuiz}
        onEdit={() => {
          setIsEditingQuiz(true);
          setError(null);
        }}
      />
    );
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

      {/* Status Bar */}
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-2 flex items-center justify-between gap-3">
        <span className="text-sm text-zinc-500 font-medium">
          {answeredCount} of {questions.length} answered
        </span>
        <div className="flex items-center gap-2">
          {result && (
            <button
              type="button"
              onClick={() => setIsEditingQuiz(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-600 rounded-lg border border-zinc-200 hover:bg-zinc-100 transition-colors"
            >
              Keep Saved Result
            </button>
          )}
          <button
            type="button"
            onClick={handleCloseQuiz}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-600 rounded-lg border border-zinc-200 hover:bg-zinc-100 transition-colors"
            aria-label="Close risk quiz"
          >
            <X className="w-4 h-4" />
            <span>Close</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="pt-4 pb-12 px-4">
        <div className="max-w-5xl mx-auto lg:grid lg:grid-cols-[minmax(0,1fr)_170px] lg:gap-5">
          <div className="max-w-2xl w-full lg:justify-self-center">
            <div className="bg-indigo-50 border border-indigo-100 text-indigo-900 rounded-xl px-3 py-2.5 mb-4 text-xs sm:text-sm font-medium">
              Quick check: answer these 8 questions to map your timeline, goal, and risk comfort before we recommend ETFs.
            </div>

            <div className="space-y-4">
              {questions.map((question, idx) => {
                const questionKey = `q${question.question_id}`;
                const selectedAnswer = answers[questionKey];

                return (
                  <section
                    key={question.question_id}
                    id={`question-${question.question_id}`}
                    className="bg-white rounded-xl shadow-sm border border-zinc-100 p-4 sm:p-5 animate-fadeIn"
                  >
                    <div className="flex items-center gap-2.5 mb-4">
                      <span className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-semibold text-xs">
                        {idx + 1}
                      </span>
                      <span className="text-xs text-zinc-500 font-medium">
                        Select one
                      </span>
                    </div>

                    <h2 className="text-base sm:text-lg font-semibold text-zinc-900 mb-4 leading-relaxed">
                      {question.question_text}
                    </h2>

                    <div className="space-y-2.5">
                      {question.options.map((option) => {
                        const isSelected = selectedAnswer === option.option_id;
                        return (
                          <button
                            key={option.option_id}
                            onClick={() => handleOptionSelect(question.question_id, option.option_id)}
                            className={`w-full text-left p-3.5 sm:p-4 rounded-lg border-2 transition-all duration-200 group ${
                              isSelected
                                ? 'border-indigo-500 bg-indigo-50/60'
                                : 'border-zinc-200 hover:border-indigo-300 hover:bg-zinc-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-medium transition-all ${
                                isSelected
                                  ? 'border-indigo-500 bg-indigo-500 text-white'
                                  : 'border-zinc-300 text-zinc-500 group-hover:border-indigo-400'
                              }`}>
                                {isSelected ? <Check className="w-4 h-4" /> : option.option_id}
                              </span>
                              <span className={`flex-1 text-sm sm:text-[15px] ${isSelected ? 'text-indigo-900 font-medium' : 'text-zinc-700'}`}>
                                {option.text}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>

            {!allAnswered && (
              <p className="text-xs sm:text-sm text-zinc-500 mt-5">
                Please answer all questions to unlock the result button.
              </p>
            )}

            <div className="mt-6 bg-white rounded-xl border border-zinc-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-xs text-zinc-500">Completion</p>
                <p className="text-sm font-semibold text-zinc-800">{answeredCount} of {questions.length} answered</p>
              </div>
              <button
                onClick={handleSubmit}
                disabled={!allAnswered || submitting}
                className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  allAnswered && !submitting
                    ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                    : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                }`}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Get Results</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-24 bg-white rounded-xl border border-zinc-200 p-3">
              <p className="text-xs font-semibold text-zinc-600 mb-2">Question List</p>
              <div className="grid grid-cols-4 gap-1.5">
                {questions.map((question, idx) => {
                  const questionKey = `q${question.question_id}`;
                  const isAnswered = !!answers[questionKey];

                  return (
                    <button
                      key={question.question_id}
                      onClick={() => {
                        const el = document.getElementById(`question-${question.question_id}`);
                        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className={`h-8 rounded-md text-xs font-semibold transition-colors ${
                        isAnswered
                          ? 'bg-indigo-500 text-white hover:bg-indigo-600'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                      title={`Question ${idx + 1}`}
                      aria-label={`Jump to question ${idx + 1}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-zinc-500 mt-2">Colored = answered</p>
            </div>
          </aside>
        </div>
      </main>

      {error && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-sm bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm shadow-sm">
          {error}
        </div>
      )}
    </div>
  );
}

// Result Screen Component
function ResultScreen({
  result,
  questions,
  onClose,
  onEdit,
}: {
  result: QuizResult;
  questions: QuizQuestion[];
  onClose: () => void;
  onEdit: () => void;
}) {
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

  const getSelectedOptionText = (questionId: number) => {
    const selected = result.breakdown.find((item) => item.question_id === questionId)?.selected_option;
    if (!selected) return 'Not specified';
    const question = questions.find((q) => q.question_id === questionId);
    if (!question) return selected;
    return question.options.find((opt) => opt.option_id === selected)?.text || selected;
  };

  const intentHighlights = [
    { label: 'Timeline', value: getSelectedOptionText(1) },
    { label: 'Primary Goal', value: getSelectedOptionText(2) },
    { label: 'Drawdown Comfort', value: getSelectedOptionText(4) },
    { label: 'Cash Priority', value: getSelectedOptionText(6) },
  ];

  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-700 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 transition-colors"
            >
              Edit Quiz
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-600 rounded-lg border border-zinc-200 hover:bg-zinc-100 transition-colors"
              aria-label="Close risk quiz"
            >
              <X className="w-4 h-4" />
              <span>Close</span>
            </button>
          </div>

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
                  <p className="text-zinc-500 text-sm">Profile Fit</p>
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
                  View Top 5 ETF Picks
                </button>
                <button
                  onClick={onEdit}
                  className="flex-1 border-2 border-zinc-200 text-zinc-600 py-3 px-6 rounded-xl font-medium hover:bg-zinc-50 transition-colors text-center"
                >
                  Edit Quiz Answers
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-white rounded-2xl shadow-sm border border-zinc-100 p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-zinc-900 mb-4">Your Intent Snapshot</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {intentHighlights.map((item) => (
                <div key={item.label} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-xs text-zinc-500 mb-1">{item.label}</p>
                  <p className="text-sm font-medium text-zinc-800">{item.value}</p>
                </div>
              ))}
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
