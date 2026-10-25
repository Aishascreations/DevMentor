"use client";

import React, { useState } from "react";
import { getToken } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    // Placeholder assistant message
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const token = getToken();
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${API_BASE}/api/chat/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response from server");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.replace("data: ", ""));
                if (data.token) {
                  setMessages((prev) => {
                    const newMsgs = [...prev];
                    const lastIdx = newMsgs.length - 1;
                    newMsgs[lastIdx] = {
                      ...newMsgs[lastIdx],
                      content: newMsgs[lastIdx].content + data.token,
                    };
                    return newMsgs;
                  });
                }
              } catch (e) {
                // Ignore SSE parsing errors on incomplete chunks
              }
            }
          }
        }
      }
    } catch (err: any) {
      setMessages((prev) => {
        const newMsgs = [...prev];
        const lastIdx = newMsgs.length - 1;
        newMsgs[lastIdx] = {
          role: "assistant",
          content: "❌ Error: " + (err.message || "Failed to connect to backend AI service."),
        };
        return newMsgs;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 flex flex-col h-[calc(100vh-4rem)]">
      <h1 className="text-2xl font-bold text-white mb-4">💬 AI Chat Assistant</h1>

      <div className="flex-1 overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 mb-4">
        {messages.length === 0 ? (
          <p className="text-slate-500 text-center py-12 text-sm">
            Ask any computer science question or request code explanations...
          </p>
        ) : (
          messages.map((m, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-xl text-sm ${
                m.role === "user"
                  ? "bg-indigo-600/30 border border-indigo-500/50 text-indigo-100 ml-12"
                  : "bg-slate-800 border border-slate-700 text-slate-200 mr-12"
              }`}
            >
              <p className="font-semibold text-xs text-slate-400 mb-1">
                {m.role === "user" ? "USER" : "ASSISTANT"}
              </p>
              <p className="whitespace-pre-wrap">{m.content || (isLoading && idx === messages.length - 1 ? "Thinking..." : "")}</p>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSend} className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-6 py-3 rounded-xl transition-all disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
