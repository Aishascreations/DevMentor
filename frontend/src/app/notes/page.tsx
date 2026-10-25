"use client";

import React, { useState, useEffect } from "react";
import { getToken } from "@/lib/api";

interface UserDocument {
  id: string;
  filename: string;
  file_size_bytes: number;
  page_count: number;
  chunk_count: number;
  uploaded_at: string;
}

export default function NotesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [documents, setDocuments] = useState<UserDocument[]>([]);

  const fetchDocuments = async () => {
    try {
      const token = getToken();
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${API_BASE}/api/documents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || isUploading) return;

    setIsUploading(true);
    setStatusMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const token = getToken();
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${API_BASE}/api/documents/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "PDF upload failed");
      }

      const data = await res.json();
      setStatusMessage(`Successfully indexed "${data.filename}" (${data.chunk_count} vector chunks generated).`);
      setFile(null);
      fetchDocuments();
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      const token = getToken();
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${API_BASE}/api/documents/${documentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
        setStatusMessage("Document removed successfully.");
      }
    } catch (err: any) {
      setStatusMessage(`Delete failed: ${err.message}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Knowledge Base & PDF Notes</h1>
        <p className="text-sm text-slate-400">
          Upload course notes and PDFs to enable grounded vector search and RAG citations.
        </p>
      </div>

      <form onSubmit={handleUpload} className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-4">
        <input
          type="file"
          accept=".pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
        />

        {file && (
          <p className="text-xs text-indigo-400 font-medium">
            Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
          </p>
        )}

        <button
          type="submit"
          disabled={!file || isUploading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
        >
          {isUploading ? "Chunking & Upserting to Qdrant..." : "Upload & Index PDF"}
        </button>

        {statusMessage && (
          <div className={`p-4 rounded-xl text-sm ${statusMessage.startsWith("Error") ? "bg-red-950/50 text-red-400 border border-red-800" : "bg-emerald-950/50 text-emerald-400 border border-emerald-800"}`}>
            {statusMessage}
          </div>
        )}
      </form>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Indexed Documents ({documents.length}/10)</h2>
        {documents.length === 0 ? (
          <p className="text-sm text-slate-500">No documents indexed yet. Upload a PDF above to start using RAG.</p>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div key={doc.id} className="flex justify-between items-center p-4 bg-slate-800/50 rounded-xl border border-slate-800">
                <div>
                  <p className="font-medium text-slate-200 text-sm">{doc.filename}</p>
                  <p className="text-xs text-slate-400">
                    {doc.page_count} Pages • {doc.chunk_count} Vector Chunks
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="text-xs text-red-400 hover:text-red-300 font-medium bg-red-950/40 border border-red-800/60 px-3 py-1.5 rounded-lg"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
