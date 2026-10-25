"use client";

import React, { useState } from "react";
import { apiFetch } from "@/lib/api";

export default function DebugPage() {
  const [code, setCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const res = await apiFetch("/api/debug", {
        method: "POST",
        body: JSON.stringify({ code, error_message: errorMsg, language: "auto" }),
      });
      setAnalysis(res);
    } catch (e: any) {
      alert(e.message || "Debugging failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">🐛 AI Debugging Assistant</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              PASTE CODE
            </label>
            <textarea
              rows={12}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste your buggy code snippet here..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              ERROR MESSAGE / STACK TRACE (OPTIONAL)
            </label>
            <textarea
              rows={4}
              value={errorMsg}
              onChange={(e) => setErrorMsg(e.target.value)}
              placeholder="Paste runtime error message or exception trace..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 font-mono text-xs text-red-300 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl text-sm transition-colors disabled:opacity-50"
          >
            {loading ? "Analyzing Bug..." : "Analyze Bug"}
          </button>
        </div>

        <div className="space-y-4">
          {analysis ? (
            <>
              <div className="bg-red-950/40 border border-red-800/50 p-4 rounded-xl">
                <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-1">
                  🔴 Root Cause ({analysis.detected_language})
                </h3>
                <p className="text-sm text-red-200">{analysis.root_cause}</p>
              </div>

              <div className="bg-amber-950/40 border border-amber-800/50 p-4 rounded-xl">
                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
                  🟡 Affected Lines
                </h3>
                <p className="text-sm text-amber-200">{analysis.affected_lines}</p>
              </div>

              <div className="bg-blue-950/40 border border-blue-800/50 p-4 rounded-xl">
                <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">
                  🔵 Explanation
                </h3>
                <p className="text-sm text-blue-200 whitespace-pre-line">
                  {analysis.explanation}
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl relative">
                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">
                  🟢 Corrected Code
                </h3>
                <pre className="bg-slate-950 p-3 rounded-lg font-mono text-xs text-slate-200 overflow-x-auto">
                  {analysis.corrected_code}
                </pre>
              </div>
            </>
          ) : (
            <div className="h-full border border-dashed border-slate-800 rounded-xl flex items-center justify-center text-slate-500 text-sm p-12 text-center">
              Submit code on the left to display the 4-part AI bug analysis.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}