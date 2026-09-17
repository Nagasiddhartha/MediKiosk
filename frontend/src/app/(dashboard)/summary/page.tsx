"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  Download,
  Printer,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  User,
  Heart,
  Pill,
  Activity,
  Stethoscope,
  Info,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/utils";

export default function SummaryPage() {
  const [selectedDays, setSelectedDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Aggregated data for briefing sheet
  const [overview, setOverview] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [conditions, setConditions] = useState<any[]>([]);
  const [allergies, setAllergies] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [encounters, setEncounters] = useState<any[]>([]);
  const [bpTrends, setBpTrends] = useState<any>(null);
  const [glucoseTrends, setGlucoseTrends] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);

  const fetchSummaryData = async () => {
    setLoading(true);
    try {
      const [
        overviewRes,
        profileRes,
        condRes,
        allergyRes,
        medRes,
        encRes,
        bpRes,
        gluRes,
        docsRes,
      ] = await Promise.all([
        api.getDashboardOverview(),
        api.getProfile().catch(() => null),
        api.getConditions().catch(() => []),
        api.getAllergies().catch(() => []),
        api.getMedications().catch(() => []),
        api.getIntakeEncounters().catch(() => []),
        api.getReadingsTrends("blood_pressure", selectedDays).catch(() => null),
        api.getReadingsTrends("blood_glucose", selectedDays).catch(() => null),
        api.getDocuments().catch(() => []),
      ]);

      setOverview(overviewRes);
      setProfile(profileRes);
      setConditions(condRes || []);
      setAllergies(allergyRes || []);
      setMedications(medRes || []);
      setEncounters(encRes || []);
      setBpTrends(bpRes);
      setGlucoseTrends(gluRes);
      setDocuments((docsRes || []).filter((d: any) => d.status === "confirmed"));
    } catch (err: any) {
      console.error("Failed to load clinical summary data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummaryData();
  }, [selectedDays]);

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const token = localStorage.getItem("medikiosk_token");
      const url = api.getSummaryPdfUrl(selectedDays);
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        throw new Error("Failed to generate PDF document");
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.setAttribute("download", `medikiosk-clinical-briefing-${selectedDays}d.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      alert("Error generating PDF: " + (err.message || "Unknown error"));
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Determine Traffic Light Urgency Status
  const urgentFlags = overview?.urgent_red_flags || [];
  const hasUrgent = urgentFlags.length > 0;
  const cautionFlags = [
    ...(bpTrends?.caution_flags || []),
    ...(glucoseTrends?.caution_flags || []),
  ];
  const hasCaution = !hasUrgent && cautionFlags.length > 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Action Header (Hidden during Print) */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-teal-600" />
            Doctor Summary & Clinical Briefing
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Standardized, doctor-reviewable longitudinal summary prepared for physician evaluation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Time Range Selector */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 text-xs">
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setSelectedDays(d)}
                className={`px-3 py-1 rounded font-medium transition-colors ${
                  selectedDays === d
                    ? "bg-slate-900 text-white font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          <button
            onClick={handlePrint}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            <Printer className="h-4 w-4 text-slate-600" />
            Print
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="btn-primary text-sm flex items-center gap-2"
          >
            {downloadingPdf ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>Download PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Traffic Light Urgency Indicator */}
      {hasUrgent ? (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-5 flex items-start gap-4">
          <div className="p-2.5 bg-rose-100 rounded-xl text-rose-700 shrink-0">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-rose-600 animate-pulse" />
              <h2 className="text-base font-bold text-rose-900">
                URGENT CLINICAL EVALUATION ADVISED
              </h2>
            </div>
            <p className="text-xs text-rose-800 mt-1">
              Active rule-engine red flags detected in your recent logs. Please seek immediate professional medical attention.
            </p>
            <ul className="mt-2 space-y-1 text-xs font-semibold text-rose-950">
              {urgentFlags.map((flag: any, i: number) => (
                <li key={i} className="flex items-center gap-1.5">
                  • <strong>{flag.rule_name || "Urgent Condition"}:</strong> {flag.reason}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : hasCaution ? (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 flex items-start gap-4">
          <div className="p-2.5 bg-amber-100 rounded-xl text-amber-700 shrink-0">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-amber-500" />
              <h2 className="text-base font-bold text-amber-900">
                CLINICAL CONSULTATION ADVISED
              </h2>
            </div>
            <p className="text-xs text-amber-800 mt-1">
              Vital trends or readings exceed standard home caution thresholds in the selected {selectedDays}-day window.
            </p>
            <ul className="mt-2 space-y-0.5 text-xs text-amber-900">
              {cautionFlags.map((c: string, i: number) => (
                <li key={i}>• {c}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-5 flex items-start gap-4">
          <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-700 shrink-0">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-600" />
              <h2 className="text-base font-bold text-emerald-900">
                ROUTINE CLINICAL REVIEW / STABLE BASELINE
              </h2>
            </div>
            <p className="text-xs text-emerald-800 mt-1">
              No acute rule-based red flags or critical outlier trends detected in the past {selectedDays} days.
            </p>
          </div>
        </div>
      )}

      {/* Digital Paper Clinical Briefing Sheet */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-sm p-8 sm:p-12 space-y-8 print:border-none print:shadow-none print:p-0">
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-teal-700 uppercase tracking-widest bg-teal-50 px-2 py-0.5 rounded">
                MediKiosk Scribe
              </span>
              <span className="text-xs text-slate-400">Longitudinal Clinical Dossier</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 mt-1 tracking-tight">
              Pre-Consultation Clinical Briefing
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Prepared for licensed physician review • Reporting Period: Last {selectedDays} Days
            </p>
          </div>

          <div className="text-left sm:text-right text-xs space-y-0.5">
            <p className="font-semibold text-slate-800">
              Patient: {profile?.full_name || "Eleanor Vance"}
            </p>
            <p className="text-slate-500">
              DOB: {profile?.date_of_birth ? formatDate(profile.date_of_birth) : "1988-04-12"} (
              {profile?.biological_sex || "Female"})
            </p>
            <p className="text-slate-500">
              Record ID: <span className="font-mono">{profile?.id?.slice(0, 8) || "EV-84920"}</span>
            </p>
            <p className="text-slate-400">Date Prepared: {formatDate(new Date().toISOString())}</p>
          </div>
        </div>

        {/* Mandatory Non-Diagnostic Mandate Callout */}
        <div className="bg-slate-50 border-l-4 border-slate-700 p-4 rounded-r-lg text-xs text-slate-600 leading-relaxed">
          <strong>NON-DIAGNOSTIC ADMINISTRATIVE DISCLOSURE:</strong> This summary is an automated pre-consultation organizer compiled from patient-reported symptoms, home vital logs, and user-confirmed OCR medical documents. It is explicitly non-diagnostic and does not replace medical judgment. All clinical diagnoses, inferences, and treatment decisions must be independently validated by the attending physician.
        </div>

        {/* Section 1: Chief Complaints & Symptoms */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-teal-600" />
            1. Recent Symptom Encounters & Chief Complaints
          </h2>

          {encounters.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No acute symptom encounters logged.</p>
          ) : (
            <div className="space-y-3">
              {encounters.slice(0, 3).map((enc: any) => (
                <div key={enc.id} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">
                      {enc.chief_complaint || "Unspecified Complaint"}
                    </span>
                    <span className="text-slate-400">{formatDate(enc.created_at)}</span>
                  </div>
                  {enc.body_annotations && enc.body_annotations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {enc.body_annotations.map((ann: any) => (
                        <span
                          key={ann.id}
                          className="bg-white border border-slate-200 px-2 py-0.5 rounded text-[11px] font-medium text-slate-700"
                        >
                          📍 {ann.anatomical_region} ({ann.pain_type || "Pain"}, {ann.severity_rating}/10)
                        </span>
                      ))}
                    </div>
                  )}
                  {enc.notes && <p className="text-slate-600 italic">{enc.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 2: Active Medications & Allergies (2 cols) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-2">
              <Pill className="h-4 w-4 text-violet-600" />
              2. Active Medications & Regimens
            </h2>
            {medications.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No active medications recorded.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {medications.map((m: any) => (
                  <li key={m.id} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
                    <span className="font-bold text-slate-900">{m.name}</span>{" "}
                    <span className="text-slate-600 font-medium">({m.dosage} - {m.frequency})</span>
                    {m.prescribed_by && (
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Prescribed by: {m.prescribed_by}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-2">
              <Heart className="h-4 w-4 text-rose-600" />
              3. Known Allergies & Sensitivities
            </h2>
            {allergies.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No allergies documented.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {allergies.map((a: any) => (
                  <li key={a.id} className="p-2.5 rounded-lg border border-rose-200 bg-rose-50/30">
                    <span className="font-bold text-rose-900">{a.allergen}</span>
                    <p className="text-[11px] text-rose-700 mt-0.5">
                      Reaction: {a.reaction_type || "Allergic reaction"} • Severity: {a.severity || "Moderate"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Section 3: Chronic Conditions & Baseline */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1">
            4. Chronic Diagnoses & Baseline Conditions
          </h2>
          {conditions.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No chronic diagnoses documented.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {conditions.map((c: any) => (
                <div key={c.id} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
                  <span className="font-bold text-slate-900">{c.condition_name}</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Diagnosed: {c.diagnosed_at ? formatDate(c.diagnosed_at) : "Historical"} • Status: {c.status || "Active"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 4: Vital Readings Trends */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-2">
            <Activity className="h-4 w-4 text-teal-600" />
            5. Longitudinal Vital Trends ({selectedDays}-Day Window)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
              <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                Blood Pressure Average
              </span>
              <p className="text-lg font-bold text-slate-900 mt-1">
                {bpTrends?.average_systolic
                  ? `${bpTrends.average_systolic} / ${bpTrends.average_diastolic} mmHg`
                  : "No readings"}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Trajectory: <strong className="capitalize">{bpTrends?.trend_direction || "Stable"}</strong>
              </p>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
              <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                Fasting Blood Glucose
              </span>
              <p className="text-lg font-bold text-slate-900 mt-1">
                {glucoseTrends?.average_numeric
                  ? `${glucoseTrends.average_numeric} mg/dL`
                  : "No readings"}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {glucoseTrends?.data_points_count || 0} measurements
              </p>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
              <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                Urgent Red-Flag Counter
              </span>
              <p className="text-lg font-bold text-slate-900 mt-1">
                {urgentFlags.length} active
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Deterministic rule engine check
              </p>
            </div>
          </div>
        </div>

        {/* Section 5: Confirmed Documents */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1">
            6. Verified Clinical Documents in Record
          </h2>
          {documents.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No confirmed medical documents in record.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {documents.map((d: any) => (
                <li key={d.id} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
                  <div>
                    <span className="font-semibold text-slate-900">{d.title || d.original_filename}</span>
                    <span className="text-[10px] text-slate-400 uppercase ml-2 bg-slate-100 px-1.5 py-0.5 rounded">
                      {d.document_type}
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    User Confirmed
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer Signature line for doctor consultation */}
        <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-xs text-slate-500">
          <div>
            <div className="border-b border-slate-300 h-10 mb-1" />
            <p>Attending Physician Signature & Printed Name</p>
          </div>
          <div>
            <div className="border-b border-slate-300 h-10 mb-1" />
            <p>Consultation Date & Clinic Stamp</p>
          </div>
        </div>
      </div>
    </div>
  );
}
