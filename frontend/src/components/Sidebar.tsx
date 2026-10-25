"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { removeToken } from "@/lib/api";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/login") return null;

  const navItems = [
    { label: "AI Chat Assistant", href: "/chat" },
    { label: "PDF Notes Assistant", href: "/notes" },
    { label: "AI Debugging Assistant", href: "/debug" },
    { label: "Adaptive Quiz Generator", href: "/quiz" },
    { label: "Analytics Dashboard", href: "/analytics" },
  ];

  const handleSignOut = () => {
    removeToken();
    router.push("/login");
  };

  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col justify-between h-screen sticky top-0">
      <div className="p-6 space-y-6">
        <div className="flex items-center space-x-3">
          {/* Logo Icon */}
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
          </div>
          <span className="font-bold text-lg text-white tracking-tight">DevMentor</span>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center px-4 py-3 text-sm rounded-xl transition-all ${
                  isActive
                    ? "bg-indigo-600 text-white font-semibold"
                    : "text-slate-400 hover:text-white hover:bg-slate-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-6 border-t border-slate-900">
        <button
          onClick={handleSignOut}
          className="w-full text-left px-4 py-2.5 text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 rounded-xl transition-all font-medium"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
