"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { removeToken } from "@/lib/api";

const navigation = [
  { name: "AI Chat Assistant", href: "/chat", icon: "💬" },
  { name: "PDF Notes Assistant", href: "/notes", icon: "📄" },
  { name: "AI Debugging Assistant", href: "/debug", icon: "🐛" },
  { name: "Adaptive Quiz Generator", href: "/quiz", icon: "🎯" },
  { name: "Analytics Dashboard", href: "/analytics", icon: "📊" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/login" || pathname === "/register") return null;

  const handleLogout = () => {
    removeToken();
    router.push("/login");
  };

  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen flex flex-col justify-between p-4 border-r border-slate-800">
      <div>
        <div className="flex items-center space-x-3 mb-8 px-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-lg">
            D
          </div>
          <span className="font-bold text-xl tracking-wide">DevMentor</span>
        </div>

        <nav className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="pt-4 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
        >
          <span>🚪</span>
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
