import React from "react";
import Sidebar from "@/components/Sidebar";
import "@/app/globals.css";

export const metadata = {
  title: "DevMentor - AI Learning & Developer Copilot",
  description: "Personalized AI platform for Computer Science education",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 flex min-h-screen font-sans">
        <Sidebar />
        <main className="flex-1 p-8 overflow-y-auto">{children}</main>
      </body>
    </html>
  );
}