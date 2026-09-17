"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  Activity,
  Clock,
  FileCheck,
  FileSpreadsheet,
  FileText,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  MessageSquarePlus,
  Moon,
  Settings,
  Shield,
  Sun,
  User as UserIcon,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Symptom Intake", href: "/intake", icon: MessageSquarePlus },
  { label: "Health Vault", href: "/vault", icon: Shield },
  { label: "Readings & Trends", href: "/readings", icon: HeartPulse },
  { label: "Documents & Review", href: "/documents", icon: FileText },
  { label: "Timeline", href: "/timeline", icon: Clock },
  { label: "Doctor Summary", href: "/summary", icon: FileSpreadsheet },
  { label: "Settings & Privacy", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isDark, setIsDark] = useState(false);
  const [isA11y, setIsA11y] = useState(false);

  const toggleDarkMode = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const toggleA11yMode = () => {
    const next = !isA11y;
    setIsA11y(next);
    if (next) {
      document.documentElement.classList.add("accessibility-mode");
    } else {
      document.documentElement.classList.remove("accessibility-mode");
    }
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {/* Brand Header */}
      <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-5 dark:border-slate-800">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white shadow-sm shadow-teal-700/30">
          <Activity className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
            MediKiosk
          </h1>
          <p className="text-[11px] font-medium text-teal-700 dark:text-teal-400">
            Clinical Health Copilot
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-colors",
                isActive
                  ? "bg-teal-50 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 transition-colors",
                  isActive
                    ? "text-teal-700 dark:text-teal-400"
                    : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300"
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Toggles & User Footer */}
      <div className="border-t border-slate-100 p-3 dark:border-slate-800">
        {/* Mode Toggles */}
        <div className="mb-2 flex items-center justify-between rounded-xl bg-slate-50 p-1.5 dark:bg-slate-800/50">
          <button
            onClick={toggleDarkMode}
            title="Toggle Precision Dark Mode"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1 text-[11px] font-medium text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-xs dark:text-slate-400 dark:hover:bg-slate-700"
          >
            {isDark ? <Sun className="h-3.5 w-3.5 text-amber-500" /> : <Moon className="h-3.5 w-3.5" />}
            <span>{isDark ? "Light" : "Dark"}</span>
          </button>
          <button
            onClick={toggleA11yMode}
            title="Toggle Warm Care Accessibility Mode (Large text & targets)"
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1 text-[11px] font-medium transition-colors",
              isA11y
                ? "bg-teal-700 text-white"
                : "text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700"
            )}
          >
            <Volume2 className="h-3.5 w-3.5" />
            <span>Care A11y</span>
          </button>
        </div>

        {/* User profile */}
        <div className="flex items-center justify-between rounded-xl p-2">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200">
              <UserIcon className="h-4 w-4" />
            </div>
            <div className="truncate">
              <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                {user?.full_name || "Patient"}
              </p>
              <p className="truncate text-[10px] text-slate-400">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            title="Log out"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
