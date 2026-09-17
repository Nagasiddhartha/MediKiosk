"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileCheck,
  FileText,
  HeartPulse,
  MessageSquarePlus,
  Pill,
  Shield,
  ShieldAlert,
  Sparkles,
  Upload,
} from "lucide-react";
import { formatDateTime, getStatusBadgeClass } from "@/lib/utils";

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOverview();
  }, []);

  const loadOverview = async () => {
    try {
      setLoading(true);
      const res = await api.getDashboardOverview();
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  const stats = data?.stats || {};
  const latestReading = data?.latest_reading;
  const latestEncounter = data?.latest_encounter;
  const recentTimeline = data?.recent_timeline || [];
  const urgentActive = data?.urgent_warning_active;
  const urgentMsg = data?.urgent_warning_message;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Clinical Health Command Center
          </h1>
          <p className="text-xs text-slate-500">
            Longitudinal records organized for clinical consultation. Explicitly non-diagnostic.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-400">Profile completeness:</span>
          <div className="flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs font-bold text-teal-800 dark:border-teal-900 dark:bg-teal-950/60 dark:text-teal-300">
            <span>{stats.profile_completeness_percent}%</span>
          </div>
        </div>
      </div>

      {/* Urgent Warning or Safe Status Banner */}
      {urgentActive ? (
        <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-5 shadow-sm dark:border-rose-900 dark:bg-rose-950/50">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-rose-800 dark:text-rose-200">
                  Urgent Clinical Alert Triggered
                </h3>
                <span className="rounded-full bg-rose-200 px-2 py-0.5 text-[10px] font-extrabold text-rose-900">
                  RULE-BASED SAFETY CHECK
                </span>
              </div>
              <p className="mt-1 text-sm font-medium text-rose-700 dark:text-rose-300">
                {urgentMsg ||
                  "Reported symptoms may indicate a condition requiring immediate medical evaluation."}
              </p>
              <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">
                Safety protocol: Please contact emergency services (911 or 112) or your physician right away. This platform does not provide medical care.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>No active emergency red flags detected across recent reported encounters.</span>
        </div>
      )}

      {/* Top 4 Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Active Conditions */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Chronic Conditions
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300">
              <Shield className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats.active_conditions}
            </span>
            <span className="text-xs text-slate-400">active</span>
          </div>
          <Link
            href="/vault"
            className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:underline dark:text-teal-400"
          >
            <span>Manage in Health Vault</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Current Medications */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Medications
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
              <Pill className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats.active_medications}
            </span>
            <span className="text-xs text-slate-400">prescribed</span>
          </div>
          <Link
            href="/vault"
            className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:underline dark:text-blue-400"
          >
            <span>View regimen</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Pending Review Documents */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pending Document Review
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {stats.pending_documents}
            </span>
            <span className="text-xs text-slate-400">needs confirmation</span>
          </div>
          <Link
            href="/documents"
            className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:underline dark:text-amber-400"
          >
            <span>Review extracted fields</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Recent Vitals */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Latest Health Reading
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300">
              <HeartPulse className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            {latestReading ? (
              <>
                <span className="text-xl font-bold text-slate-900 dark:text-white">
                  {latestReading.display_value}
                </span>
                <span className="text-xs text-slate-400">{latestReading.unit}</span>
              </>
            ) : (
              <span className="text-sm font-semibold text-slate-400">No readings yet</span>
            )}
          </div>
          <Link
            href="/readings"
            className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:underline dark:text-teal-400"
          >
            <span>Inspect vitals trends</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Middle Row: Latest Symptom & Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Latest Symptom Intake Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 lg:col-span-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <MessageSquarePlus className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  Recent Symptom Intake
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">Latest session</span>
            </div>

            {latestEncounter ? (
              <div className="mt-4 space-y-2.5">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {latestEncounter.chief_complaint || "Reported symptom"}
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {latestEncounter.duration && (
                    <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      Duration: {latestEncounter.duration}
                    </span>
                  )}
                  {latestEncounter.severity && (
                    <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      Severity: {latestEncounter.severity}
                    </span>
                  )}
                  <span
                    className={`rounded-lg border px-2 py-0.5 font-semibold ${getStatusBadgeClass(
                      latestEncounter.status
                    )}`}
                  >
                    {latestEncounter.status.replace("_", " ")}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Recorded: {formatDateTime(latestEncounter.created_at)}
                </p>
              </div>
            ) : (
              <div className="mt-6 text-center text-xs text-slate-400">
                No symptoms recorded yet. Use the intake engine to describe your symptoms before your next visit.
              </div>
            )}
          </div>

          <Link
            href="/intake"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-50 py-2.5 text-xs font-bold text-teal-800 hover:bg-teal-100 dark:bg-teal-950/60 dark:text-teal-300"
          >
            <MessageSquarePlus className="h-4 w-4" />
            <span>Open Clinical Intake & Body Map</span>
          </Link>
        </div>

        {/* Recent Timeline Feed */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-teal-700 dark:text-teal-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Longitudinal Health Activity
              </h3>
            </div>
            <Link
              href="/timeline"
              className="text-xs font-semibold text-teal-700 hover:underline dark:text-teal-400"
            >
              Full timeline
            </Link>
          </div>

          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {recentTimeline.length > 0 ? (
              recentTimeline.map((item: any, idx: number) => (
                <div key={idx} className="flex items-start justify-between py-2.5">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-[10px] font-bold text-teal-800 dark:bg-teal-900 dark:text-teal-200">
                      {item.event_type.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {item.title}
                      </p>
                      {item.summary && (
                        <p className="text-[11px] text-slate-500 line-clamp-1">{item.summary}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400">
                      {formatDateTime(item.event_date)}
                    </span>
                    {item.trust_status && (
                      <span className="block text-[9px] font-medium text-slate-400 uppercase">
                        {item.trust_status.replace("_", " ")}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-xs text-slate-400">
                Your health timeline is empty. Add readings, symptoms, or documents to begin.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Launchpad */}
      <div>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
          Quick Clinical Actions
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/intake"
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-teal-300 hover:shadow-xs dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
              <MessageSquarePlus className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">Symptom Scribe</p>
              <p className="text-[11px] text-slate-500">Speak or tap body map</p>
            </div>
          </Link>

          <Link
            href="/documents"
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-teal-300 hover:shadow-xs dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">Upload Document</p>
              <p className="text-[11px] text-slate-500">Scan Rx or Lab report</p>
            </div>
          </Link>

          <Link
            href="/readings"
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-teal-300 hover:shadow-xs dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              <HeartPulse className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">Import Readings</p>
              <p className="text-[11px] text-slate-500">CSV or manual BP/Glucose</p>
            </div>
          </Link>

          <Link
            href="/summary"
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-teal-300 hover:shadow-xs dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <FileCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">Doctor Summary</p>
              <p className="text-[11px] text-slate-500">1-page consultation PDF</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
