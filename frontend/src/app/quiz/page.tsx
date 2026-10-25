"use client";

import React, { useState } from "react";
import { getToken } from "@/lib/api";

interface Question {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

export default function QuizPage() {
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("Medium");
  const [numQuestions, setNumQuestions] = useState(5);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedMastery, setUpdatedMastery] = useState<number | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setQuestions([]);
    setCurrentIdx(0);
    setSelectedAnswers({});
    setShowResults(false);
    setUpdatedMastery(null);

    try {
      const token = getToken();
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${API_BASE}/api/quiz/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          topic,
          difficulty,
          num_questions: numQuestions,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to generate quiz");
      }

      const data = await res.json();
      setQuestions(Array.isArray(data) ? data : data.questions || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOptionSelect = (qIdx: number, optionIdx: number) => {
    if (showResults) return;
    setSelectedAnswers((prev) => ({ ...prev, [qIdx]: optionIdx }));
  };

  const calculateScore = () => {
    let score = 0;
    questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correct_index) score++;
    });
    return score;
  };

  const handleSubmitQuiz = async () => {
    setShowResults(true);
    const score = calculateScore();

    try {
      const token = getToken();
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${API_BASE}/api/quiz/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          topic,
          score,
          total_questions: questions.length,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setUpdatedMastery(data.new_mastery_score);
      }
    } catch (err) {
      console.error("Failed to post quiz results to backend:", err);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">🎯 Practice Quiz Generator</h1>

      <form onSubmit={handleGenerate} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">TOPIC</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Dynamic programming, Binary Trees, SQL Indexing"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">DIFFICULTY</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">NUMBER OF QUESTIONS</label>
            <select
              value={numQuestions}
              onChange={(e) => setNumQuestions(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value={3}>3 Questions</option>
              <option value={5}>5 Questions</option>
              <option value={10}>10 Questions</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={!topic.trim() || isLoading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
        >
          {isLoading ? "Generating Quiz Questions..." : "Generate Quiz"}
        </button>

        {error && <p className="text-xs text-red-400 text-center">{error}</p>}
      </form>

      {questions.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex justify-between items-center text-xs text-slate-400 border-b border-slate-800 pb-4">
            <span>
              Question {currentIdx + 1} of {questions.length}
            </span>
            <span className="bg-slate-800 text-indigo-400 px-3 py-1 rounded-full font-medium">
              {difficulty}
            </span>
          </div>

          <h2 className="text-lg font-semibold text-slate-100">
            {questions[currentIdx]?.question}
          </h2>

          <div className="space-y-3">
            {questions[currentIdx]?.options.map((opt, oIdx) => {
              const isSelected = selectedAnswers[currentIdx] === oIdx;
              const isCorrect = questions[currentIdx].correct_index === oIdx;

              let btnStyle = "bg-slate-800 border-slate-700 hover:border-indigo-500 text-slate-200";
              if (isSelected) btnStyle = "bg-indigo-600/30 border-indigo-500 text-white font-medium";

              if (showResults) {
                if (isCorrect) btnStyle = "bg-emerald-950/60 border-emerald-500 text-emerald-200";
                else if (isSelected && !isCorrect) btnStyle = "bg-red-950/60 border-red-500 text-red-200";
              }

              return (
                <button
                  key={oIdx}
                  onClick={() => handleOptionSelect(currentIdx, oIdx)}
                  className={`w-full text-left p-4 rounded-xl border transition-all text-sm ${btnStyle}`}
                >
                  <span className="font-bold mr-2">{String.fromCharCode(65 + oIdx)}.</span> {opt}
                </button>
              );
            })}
          </div>

          {showResults && (
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
              <p className="font-bold text-indigo-400">Explanation:</p>
              <p>{questions[currentIdx]?.explanation}</p>
            </div>
          )}

          <div className="flex justify-between items-center pt-4 border-t border-slate-800">
            <button
              onClick={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
              disabled={currentIdx === 0}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium disabled:opacity-40"
            >
              Previous
            </button>

            {currentIdx < questions.length - 1 ? (
              <button
                onClick={() => setCurrentIdx((prev) => Math.min(questions.length - 1, prev + 1))}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium"
              >
                Next Question
              </button>
            ) : (
              !showResults && (
                <button
                  onClick={handleSubmitQuiz}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Submit Quiz & View Results
                </button>
              )
            )}
          </div>

          {showResults && (
            <div className="p-4 bg-indigo-950/40 border border-indigo-800/50 rounded-xl text-center space-y-1">
              <p className="text-lg font-bold text-indigo-300">
                Quiz Completed! Score: {calculateScore()} / {questions.length} (
                {Math.round((calculateScore() / questions.length) * 100)}%)
              </p>
              {updatedMastery !== null && (
                <p className="text-xs text-emerald-400 font-medium">
                  📈 EWMA Topic Mastery Updated: {updatedMastery}%
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
