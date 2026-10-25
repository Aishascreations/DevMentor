"use client";

import React, { useEffect, useState } from "react";
import { getToken } from "@/lib/api";

interface MasteryData {
  topic: string;
  mastery_score: number;
  quiz_count: number;
  status: string;
}

interface WeakAlert {
  topic: string;
  mastery_score: number;
  recommendation: string;
}

interface AnalyticsPayload {
  mastery_scores: MasteryData[];
  weak_topic_alerts: WeakAlert[];
  stats: {
    total_sessions: number;
    chat_sessions: number;
    debug_sessions: number;
    total_quizzes: number;
    average_quiz_score: number;
  };
  progress_trend: { date: string; score: number; topic: string }[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const token = getToken();
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${API_BASE}/api/analytics`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const payload = await res.json();
          setData(payload);
        }
      } catch (e) {
        console.error("Failed to load analytics data:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-12 text-center text-slate-400">
        Loading real-time analytics & mastery scores...
      </div>
    );
  }

  const overallMastery =
    data?.mastery_scores && data.mastery_scores.length > 0
      ? (
          data.mastery_scores.reduce((acc, curr) => acc + curr.mastery_score, 0) /
          data.mastery_scores.length
        ).toFixed(1)
      : "0.0";

  return (
    <div className="max-w-5xl mx-auto py-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">📊 Student Learning Analytics</h1>
        <p className="text-slate-400 text-sm">
          Track your real-time topic mastery scores (EWMA), quiz attempts, and AI recommendations.
        </p>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <p className="text-xs text-slate-400 font-semibold uppercase">Overall Mastery Score</p>
          <p className="text-3xl font-extrabold text-indigo-400 mt-2">{overallMastery}%</p>
          <p className="text-xs text-slate-500 mt-1">Across tracked topics</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <p className="text-xs text-slate-400 font-semibold uppercase">Total Sessions</p>
          <p className="text-3xl font-extrabold text-white mt-2">{data?.stats.total_sessions || 0}</p>
          <p className="text-xs text-slate-500 mt-1">Chat, Debug & Quiz interactions</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <p className="text-xs text-slate-400 font-semibold uppercase">Quizzes Completed</p>
          <p className="text-3xl font-extrabold text-emerald-400 mt-2">{data?.stats.total_quizzes || 0}</p>
          <p className="text-xs text-slate-500 mt-1">Avg Score: {data?.stats.average_quiz_score || 0}%</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <p className="text-xs text-slate-400 font-semibold uppercase">Weak Topic Alerts</p>
          <p className="text-3xl font-extrabold text-rose-400 mt-2">{data?.weak_topic_alerts.length || 0}</p>
          <p className="text-xs text-slate-500 mt-1">Topics below 50% threshold</p>
        </div>
      </div>

      {/* Weak Topic Recommendations */}
      {data?.weak_topic_alerts && data.weak_topic_alerts.length > 0 && (
        <div className="bg-rose-950/30 border border-rose-800/60 p-6 rounded-xl space-y-3">
          <h2 className="text-base font-bold text-rose-300">⚠️ Actionable AI Recommendations</h2>
          <div className="space-y-2">
            {data.weak_topic_alerts.map((alert, idx) => (
              <div key={idx} className="bg-slate-900/80 p-3 rounded-lg border border-rose-900/40 text-xs">
                <span className="font-bold text-rose-400">{alert.topic} ({alert.mastery_score}%): </span>
                <span className="text-slate-200">{alert.recommendation}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-Topic Mastery Breakdown */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Topic Mastery Breakdown (EWMA Score)</h2>
          <span className="text-xs text-slate-400 bg-slate-950 px-3 py-1 rounded-full border border-slate-800">
            Live DB Updates
          </span>
        </div>

        {data?.mastery_scores && data.mastery_scores.length > 0 ? (
          <div className="space-y-4">
            {data.mastery_scores.map((item, idx) => {
              let barColor = "bg-emerald-500";
              if (item.mastery_score < 50) barColor = "bg-rose-500";
              else if (item.mastery_score <= 75) barColor = "bg-amber-500";

              return (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-200">{item.topic}</span>
                    <span className="text-slate-400">
                      {item.mastery_score}% • {item.quiz_count} Quizzes Taken
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800/80">
                    <div
                      className={`h-2.5 rounded-full ${barColor} transition-all duration-500`}
                      style={{ width: `${item.mastery_score}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No quizzes taken yet. Complete a quiz to view live mastery tracking.</p>
        )}
      </div>
    </div>
  );
}

