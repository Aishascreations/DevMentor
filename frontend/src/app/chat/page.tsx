"use client";

import React, { useState, useEffect } from "react";
import { getToken } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatSessionItem {
  id: string;
  title: string;
  updated_at: string;
  messages: Message[];
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessions, setSessions] = useState<ChatSessionItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const fetchSessions = async () => {
    try {
      const token = getToken();
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${API_BASE}/api/chat/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (e) {
      console.error("Failed to fetch chat sessions:", e);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleSelectSession = (session: ChatSessionItem) => {
    setActiveSessionId(session.id);
    setMessages(session.messages || []);
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = getToken();
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${API_BASE}/api/chat/sessions/${sessionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (activeSessionId === sessionId) {
          handleNewChat();
        }
      }
    } catch (err) {
      console.error("Failed to delete chat session:", err);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

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
        body: JSON.stringify({
          message: userMessage,
          session_id: activeSessionId,
        }),
      });

      if (!response.ok) throw new Error("Failed to connect to backend");

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
                if (data.session_id && !activeSessionId) {
                  setActiveSessionId(data.session_id);
                }
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
                // Ignore incomplete SSE chunk parse errors
              }
            }
          }
        }
      }
      fetchSessions();
    } catch (err: any) {
      setMessages((prev) => {
        const newMsgs = [...prev];
        const lastIdx = newMsgs.length - 1;
        newMsgs[lastIdx] = {
          role: "assistant",
          content: "Error: " + (err.message || "Failed to communicate with AI model."),
        };
        return newMsgs;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 flex gap-6 h-[calc(100vh-4rem)]">
      {/* Sessions Sidebar */}
      <div className="w-64 bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
        <div className="space-y-4">
          <button
            onClick={handleNewChat}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-xl text-xs transition-all"
          >
            + New Conversation
          </button>

          <div className="space-y-2 max-h-[calc(100vh-16rem)] overflow-y-auto">
            <p className="text-xs font-semibold text-slate-500 uppercase px-2">Past Conversations</p>
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => handleSelectSession(s)}
                className={`flex justify-between items-center p-3 rounded-xl text-xs cursor-pointer border transition-all ${
                  activeSessionId === s.id
                    ? "bg-slate-800 border-indigo-500 text-white font-medium"
                    : "bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                <span className="truncate flex-1 mr-2">{s.title || "Chat Session"}</span>
                <button
                  onClick={(e) => handleDeleteSession(s.id, e)}
                  className="text-slate-500 hover:text-rose-400 text-xs px-1"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="flex-1 flex flex-col">
        <h1 className="text-2xl font-bold text-white mb-4">AI Chat Assistant</h1>

        <div className="flex-1 overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 mb-4">
          {messages.length === 0 ? (
            <p className="text-slate-500 text-center py-16 text-sm">
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
    </div>
  );
}
