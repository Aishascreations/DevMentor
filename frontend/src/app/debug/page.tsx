"use client";

import React, { useState, useEffect } from "react";
import { getToken } from "@/lib/api";

interface DebugHistoryItem {
  id: string;
  code: string;
  error_message: string;
  language: string;
  root_cause: string;
  corrected_code: string;
  created_at: string;
}

export default function DebuggerPage() {
  const [code, setCode] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [language, setLanguage] = useState("Python");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<DebugHistoryItem[]>([]);

  const fetchHistory = async () => {
    try {
      const token = getToken();
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${API_BASE}/api/debug/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || isLoading) return;

    setIsLoading(true);
    setResult(null);

    try {
      const token = getToken();
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${API_BASE}/api/debug/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code,
          error_message: errorMessage,
          language,
        }),
      });

      if (!res.ok) throw new Error("Debug analysis failed");

      const data = await res.json();
      setResult(data);
      fetchHistory();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">🐛 AI Debugging Assistant</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Debug Form */}
        <div className="lg:col-span-2 space-y-4">
          <form onSubmit={handleAnalyze} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">PROGRAMMING LANGUAGE</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white"
              >
                <option value="Python">Python</option>
                <option value="JavaScript">JavaScript / TypeScript</option>
                <option value="Java">Java</option>
                <option value="C++">C++</option>
                <option value="SQL">SQL</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">PASTE YOUR CODE</label>
              <textarea
                rows={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="def my_function(): ..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs font-mono text-emerald-300 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">OPTIONAL ERROR MESSAGE / STACK TRACE</label>
              <input
                type="text"
                value={errorMessage}
                onChange={(e) => setErrorMessage(e.target.value)}
                placeholder="IndexError: list index out of range"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-rose-300"
              />
            </div>

            <button
              type="submit"
              disabled={!code.trim() || isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-all disabled:opacity-50"
            >
              {isLoading ? "Analyzing & Debugging Code..." : "Analyze Code & Find Fix"}
            </button>
          </form>

          {/* Result View */}
          {result && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-base font-bold text-emerald-400">Analysis & Fix Summary</h2>
              <div>
                <p className="text-xs font-bold text-slate-400">ROOT CAUSE:</p>
                <p className="text-sm text-slate-200 mt-1">{result.root_cause}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400">CORRECTED CODE:</p>
                <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-emerald-300 font-mono mt-1 overflow-x-auto">
                  {result.corrected_code}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Debug History Sidebar */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-bold text-white border-b border-slate-800 pb-2">📜 Debug History</h2>
          {history.length === 0 ? (
            <p className="text-xs text-slate-500">No past debugged sessions found.</p>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setCode(item.code);
                    setErrorMessage(item.error_message || "");
                    setLanguage(item.language);
                    setResult(item);
                  }}
                  className="p-3 bg-slate-800/50 hover:bg-slate-800 rounded-xl border border-slate-700/60 cursor-pointer space-y-1 transition-all"
                >
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-indigo-400 font-bold">{item.language}</span>
                    <span className="text-slate-500">{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-2">{item.root_cause}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
