"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { removeToken } from "@/lib/api";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [imageError, setImageError] = useState(false);

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
          {/* Logo Container */}
          <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400 shadow-md shadow-indigo-600/10">
            {!imageError ? (
              <Image
                src="/logo.png"
                alt="DevMentor Logo"
                width={36}
                height={36}
                className="object-cover w-full h-full"
                onError={() => setImageError(true)}
              />
            ) : (
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
                  d="M12 14l9-5-9-5-9 5 9 5z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 01-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
                />
              </svg>
            )}
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
