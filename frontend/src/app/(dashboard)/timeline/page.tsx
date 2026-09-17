"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Clock,
  Search,
  Filter,
  Calendar,
  Stethoscope,
  Activity,
  AlertCircle,
  FileText,
  Pill,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  FileSpreadsheet,
  HelpCircle,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/utils";

const CATEGORIES = [
  { id: "all", label: "All Events" },
  { id: "visit", label: "Doctor Visits" },
  { id: "symptom", label: "Symptoms" },
  { id: "reading", label: "Health Readings" },
  { id: "document", label: "Documents" },
  { id: "medication", label: "Medications" },
  { id: "red_flag", label: "Urgent Alerts" },
];

export default function TimelinePage() {
  const [loading, setLoading] = useState(true);
  const [timelineData, setTimelineData] = useState<any>({ total_events: 0, groups: [], events: [] });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const fetchTimeline = async () => {
    setLoading(true);
    try {
      const res = await api.getTimeline({
        group: "month",
        search: searchQuery || undefined,
        types: selectedCategory !== "all" ? selectedCategory : undefined,
      });
      setTimelineData(res);
    } catch (err: any) {
      console.error("Failed to load timeline:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTimeline();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategory]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case "visit":
        return <Stethoscope className="h-4 w-4 text-blue-600" />;
      case "symptom":
        return <AlertCircle className="h-4 w-4 text-amber-600" />;
      case "reading":
        return <Activity className="h-4 w-4 text-teal-600" />;
      case "document":
        return <FileText className="h-4 w-4 text-emerald-600" />;
      case "medication":
        return <Pill className="h-4 w-4 text-violet-600" />;
      case "red_flag":
        return <ShieldAlert className="h-4 w-4 text-rose-600" />;
      default:
        return <Clock className="h-4 w-4 text-slate-500" />;
    }
  };

  const getEventBorderColor = (type: string) => {
    switch (type) {
      case "visit":
        return "border-blue-200 hover:border-blue-400 bg-white";
      case "symptom":
        return "border-amber-200 hover:border-amber-400 bg-white";
      case "reading":
        return "border-teal-200 hover:border-teal-400 bg-white";
      case "document":
        return "border-emerald-200 hover:border-emerald-400 bg-white";
      case "medication":
        return "border-violet-200 hover:border-violet-400 bg-white";
      case "red_flag":
        return "border-rose-300 bg-rose-50/30 hover:border-rose-400";
      default:
        return "border-slate-200 hover:border-slate-300 bg-white";
    }
  };

  const getProvenanceBadge = (status?: string, source?: string) => {
    if (status === "user_confirmed") {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
          <ShieldCheck className="h-3 w-3" /> User Confirmed
        </span>
      );
    }
    if (status === "rule_engine" || source === "rule_engine") {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
          <ShieldAlert className="h-3 w-3" /> Rule-Engine Alert
        </span>
      );
    }
    if (source === "csv_import" || status === "imported") {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">
          <FileSpreadsheet className="h-3 w-3" /> Imported CSV
        </span>
      );
    }
    if (status === "patient_reported" || source === "patient_intake") {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
          <UserCheck className="h-3 w-3" /> Patient Reported
        </span>
      );
    }
    return (
      <span className="inline-flex items-center text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
        {source || "System Log"}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Clock className="h-6 w-6 text-teal-600" />
            Longitudinal Health Timeline
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Chronological multi-source patient narrative connecting symptoms, vitals, prescriptions, and clinical notes.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
          <span>Total Recorded Events:</span>
          <strong className="text-slate-800">{timelineData.total_events || 0}</strong>
        </div>
      </div>

      {/* Filter Chips and Search */}
      <div className="card p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search timeline events by symptom, medication name, doctor, lab test, or date..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field w-full pl-9 text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
          <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
            <Filter className="h-3.5 w-3.5" /> Filter:
          </span>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                selectedCategory === cat.id
                  ? "bg-slate-900 text-white font-semibold shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Non-Diagnostic Clinical Safety Callout */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 flex items-start gap-2.5">
        <HelpCircle className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-800">Non-Diagnostic Longitudinal Organization:</span>{" "}
          This timeline organizes past events for patient and doctor review. Event correlations reflect chronological concurrence, not clinical causation.
        </div>
      </div>

      {/* Timeline Stream */}
      {loading ? (
        <div className="card p-12 text-center text-sm text-slate-400">
          Loading longitudinal timeline...
        </div>
      ) : timelineData.groups && timelineData.groups.length > 0 ? (
        <div className="space-y-8 relative before:absolute before:inset-0 before:left-4 sm:before:left-6 before:w-0.5 before:bg-slate-200">
          {timelineData.groups.map((group: any, groupIndex: number) => (
            <div key={groupIndex} className="relative space-y-4">
              {/* Group Month Heading */}
              <div className="sticky top-20 z-10 flex items-center gap-3 bg-slate-50/90 backdrop-blur-xs py-1 px-2 rounded-lg w-fit">
                <div className="h-8 w-8 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-xs">
                  <Calendar className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-900 tracking-wide uppercase">
                  {group.period}
                </h2>
                <span className="text-xs text-slate-400 font-normal">
                  ({group.events?.length || 0} events)
                </span>
              </div>

              {/* Group Events */}
              <div className="space-y-3 pl-8 sm:pl-12">
                {group.events.map((event: any, eventIndex: number) => (
                  <div
                    key={eventIndex}
                    className={`card p-4 transition-all shadow-xs hover:shadow-md border ${getEventBorderColor(
                      event.event_type
                    )}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-slate-100 shrink-0 mt-0.5">
                          {getEventIcon(event.event_type)}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900">{event.title}</h3>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {event.event_type?.replace("_", " ")}
                            </span>
                          </div>
                          {event.summary && (
                            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                              {event.summary}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0">
                        <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
                          {formatDate(event.event_date)}
                        </span>
                        {getProvenanceBadge(event.trust_status, event.source)}
                      </div>
                    </div>

                    {/* Quick Link to Detail if Document or Intake */}
                    {event.event_type === "document" && event.entity_id && (
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex justify-end">
                        <Link
                          href={`/documents/${event.entity_id}`}
                          className="text-xs text-teal-700 hover:text-teal-800 font-semibold flex items-center gap-1"
                        >
                          <span>Review Document</span>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center flex flex-col items-center">
          <Clock className="h-12 w-12 text-slate-300 mb-3" />
          <h3 className="text-base font-semibold text-slate-800">No events found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            {searchQuery || selectedCategory !== "all"
              ? "No events match the selected search query or category filter."
              : "As you log visits, symptoms, vitals, and upload documents, your longitudinal health narrative will populate here."}
          </p>
        </div>
      )}
    </div>
  );
}
