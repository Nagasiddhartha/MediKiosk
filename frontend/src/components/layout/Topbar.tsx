"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertCircle, FilePlus, MessageSquarePlus, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api";

export function Topbar() {
  const pathname = usePathname();
  const [urgentActive, setUrgentActive] = useState(false);
  const [urgentMessage, setUrgentMessage] = useState<string | null>(null);

  useEffect(() => {
    api
      .getDashboardOverview()
      .then((data) => {
        if (data.urgent_warning_active) {
          setUrgentActive(true);
          setUrgentMessage(data.urgent_warning_message);
        }
      })
      .catch(() => {});
  }, [pathname]);

  const getPageTitle = () => {
    if (pathname.startsWith("/dashboard")) return "Clinical Command Center";
    if (pathname.startsWith("/intake")) return "Multimodal Symptom Intake & Body Map";
    if (pathname.startsWith("/vault")) return "Personal Health Vault";
    if (pathname.startsWith("/readings")) return "Health Readings & Vitals Trends";
    if (pathname.startsWith("/documents")) return "Document Intelligence & Confirmation";
    if (pathname.startsWith("/timeline")) return "Longitudinal Health Timeline";
    if (pathname.startsWith("/summary")) return "Doctor-Ready Consultation Briefing";
    if (pathname.startsWith("/settings")) return "Privacy, Consent & Data Governance";
    return "Health Record";
  };

  return (
    <header className="sticky top-0 z-10 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/80 px-6 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
      <div className="flex items-center gap-4">
        <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
          {getPageTitle()}
        </h2>

        {/* Urgency Pill if red flag exists */}
        {urgentActive && (
          <div className="flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 animate-pulse dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Urgent Clinical Flag Active</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/intake"
          className="flex items-center gap-1.5 rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-teal-800 transition-colors"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
          <span>New Symptom Intake</span>
        </Link>
        <Link
          href="/documents"
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <FilePlus className="h-3.5 w-3.5" />
          <span>Upload Record</span>
        </Link>
      </div>
    </header>
  );
}
