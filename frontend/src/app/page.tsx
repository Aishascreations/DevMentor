"use client";

import React, { useState } from "react";
import { streamSSE } from "@/lib/api";

export default function ChatPage() {
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || isLoading) return;

    if (!textToSend) setInput("");
    setIsLoading(true);

    // Append user query and a fresh empty assistant placeholder
    setMessages((prev) => [
      ...prev,
      { role: "user", content: query },
      { role: "assistant", content: "" },
    ]);

    try {
      await streamSSE(
        "/api/chat/send",
        { message: query },
        (token) => {
          // Update immutable state cleanly without mutating array items
          setMessages((prev) => {
            if (prev.length === 0) return prev;
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            const lastMsg = updated[lastIdx];

            if (lastMsg && lastMsg.role === "assistant") {
              updated[lastIdx] = {
                ...lastMsg,
                content: lastMsg.content + token,
              };
            }
            return updated;
          });
        },
        () => setIsLoading(false)
      );
    } catch (error) {
      console.error("Streaming error:", error);
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-4rem)]">
      <h1 className="text-2xl font-bold mb-4 text-white">💬 AI Chat Assistant</h1>

      {messages.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-auto">
          {[
            "Explain BFS vs DFS search algorithms",
            "How does dynamic programming work?",
            "What is the difference between Array and LinkedList?",
          ].map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSend(prompt)}
              className="p-4 bg-slate-900 border border-slate-800 rounded-xl hover:border-indigo-500 text-left text-sm transition-all"
            >
              <p className="font-semibold text-indigo-400 mb-1">Suggested Prompt</p>
              <p className="text-slate-300">{prompt}</p>
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-xl max-w-[80%] ${
              msg.role === "user"
                ? "bg-indigo-600 ml-auto text-white"
                : "bg-slate-900 border border-slate-800 text-slate-200"
            }`}
          >
            <p className="text-xs text-slate-400 mb-1 font-semibold uppercase">
              {msg.role}
            </p>
            <p className="whitespace-pre-wrap leading-relaxed text-sm">
              {msg.content || (isLoading && idx === messages.length - 1 ? "Typing..." : "")}
            </p>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a CS concept question..."
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-6 py-3 rounded-xl text-sm transition-colors disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}