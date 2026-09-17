"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  Download,
  Lock,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  FileSpreadsheet,
  Clock,
  RefreshCw,
  X,
  ExternalLink,
  ShieldCheck,
  Eye,
  Info,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";

const CONSENT_DESCRIPTIONS: Record<
  string,
  { title: string; description: string; impact: string }
> = {
  ai_processing: {
    title: "External LLM Document Structuring",
    description:
      "Authorizes MediKiosk to send extracted OCR text to external LLMs (e.g. Gemini) for structuring complex prescription and lab reports.",
    impact:
      "When disabled, MediKiosk falls back strictly to local regex & deterministic rule-based heuristic parsers.",
  },
  ocr_processing: {
    title: "Optical Character Recognition (OCR)",
    description:
      "Enables local Tesseract OCR engine to extract raw text and word coordinates from uploaded images and PDF scans.",
    impact: "When disabled, document uploads cannot be automatically transcribed.",
  },
  data_analytics: {
    title: "Health Readings Trend Analysis",
    description:
      "Authorizes mathematical aggregation of blood pressure, glucose, and vital readings to detect trends and clinical caution thresholds.",
    impact: "When disabled, vitals remain stored but trendlines and trajectory flags are hidden.",
  },
  data_export: {
    title: "Data Portability & FHIR R4 Bundle Export",
    description:
      "Enables packaging your health profile, conditions, vitals, and verified clinical documents into standard interoperable formats.",
    impact: "When disabled, export endpoints are locked.",
  },
};

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [consents, setConsents] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingConsent, setUpdatingConsent] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: "success" | "error" } | null>(
    null
  );

  // Export states
  const [exportingJson, setExportingJson] = useState(false);
  const [exportingFhir, setExportingFhir] = useState(false);

  // Delete Account Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Audit details modal
  const [selectedAuditLog, setSelectedAuditLog] = useState<any | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [consentsRes, logsRes] = await Promise.all([
        api.getConsents().catch(() => []),
        api.getAuditLogs().catch(() => []),
      ]);
      setConsents(consentsRes);
      setAuditLogs(logsRes);
    } catch (err: any) {
      console.error("Failed to load settings data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleConsent = async (consentType: string, currentStatus: string) => {
    setUpdatingConsent(consentType);
    setFeedbackMsg(null);
    const newGranted = currentStatus !== "granted";

    try {
      await api.updateConsent({
        consent_type: consentType,
        granted: newGranted,
      });
      setConsents((prev) =>
        prev.map((c) =>
          c.consent_type === consentType
            ? { ...c, status: newGranted ? "granted" : "revoked" }
            : c
        )
      );
      setFeedbackMsg({
        text: `Consent preference for "${CONSENT_DESCRIPTIONS[consentType]?.title || consentType}" updated successfully.`,
        type: "success",
      });
      // Refresh audit logs to show consent update event
      const logs = await api.getAuditLogs().catch(() => []);
      setAuditLogs(logs);
    } catch (err: any) {
      setFeedbackMsg({
        text: err.message || "Failed to update consent preference.",
        type: "error",
      });
    } finally {
      setUpdatingConsent(null);
    }
  };

  const handleExportJson = async () => {
    setExportingJson(true);
    try {
      const data = await api.exportJson();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `medikiosk-health-record-${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("JSON Export failed: " + (err.message || "Unknown error"));
    } finally {
      setExportingJson(false);
    }
  };

  const handleExportFhir = async () => {
    setExportingFhir(true);
    try {
      const token = localStorage.getItem("medikiosk_token");
      const url = api.getFhirExportUrl();
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to generate FHIR bundle");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/fhir+json",
      });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.setAttribute("download", `medikiosk-fhir-r4-bundle-${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      alert("FHIR Export failed: " + (err.message || "Unknown error"));
    } finally {
      setExportingFhir(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmationText !== "DELETE MY DATA") return;
    setDeletingAccount(true);
    try {
      await api.deleteAccount();
      logout();
      router.push("/login");
    } catch (err: any) {
      alert("Failed to delete account: " + (err.message || "Unknown error"));
      setDeletingAccount(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6 text-teal-600" />
          Privacy, Governance & Data Sovereignty
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Control data sharing consents, download interoperable FHIR packages, review audit trails, or securely purge your record.
        </p>
      </div>

      {feedbackMsg && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center gap-2.5 ${
            feedbackMsg.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {feedbackMsg.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Section 1: Granular Privacy & Consent Controls */}
      <div className="card p-6 space-y-6">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Lock className="h-4 w-4 text-teal-600" />
            Granular Processing Consents
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Your consent choices immediately govern backend pipelines. Revoking consent halts external LLM and analytics calls.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {["ai_processing", "ocr_processing", "data_analytics", "data_export"].map(
            (consentType) => {
              const item = consents.find((c) => c.consent_type === consentType);
              const isGranted = item ? item.status === "granted" : true;
              const isUpdating = updatingConsent === consentType;
              const info = CONSENT_DESCRIPTIONS[consentType] || {
                title: consentType,
                description: "",
                impact: "",
              };

              return (
                <div
                  key={consentType}
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                    isGranted
                      ? "border-teal-200 bg-teal-50/20"
                      : "border-slate-200 bg-slate-50/50 opacity-80"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{info.title}</h3>
                      <button
                        type="button"
                        onClick={() => handleToggleConsent(consentType, item?.status || "granted")}
                        disabled={isUpdating}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                          isGranted ? "bg-teal-600" : "bg-slate-300"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            isGranted ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {info.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-200/50 text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-700">Fallback behavior:</span>{" "}
                    {info.impact}
                  </div>
                </div>
              );
            }
          )}
        </div>
      </div>

      {/* Section 2: Data Portability & FHIR Export */}
      <div className="card p-6 space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Download className="h-4 w-4 text-teal-600" />
            Data Portability & Standard Interoperability
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Full compliance with patient data sovereignty. Export your complete health record in JSON or international HL7 FHIR R4 standard format.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-teal-700 font-bold text-sm">
                <FileCode className="h-4 w-4" />
                <span>FHIR R4 Standard Bundle</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Interoperable with modern hospital EMR systems (Epic, Cerner), Apple Health, and SMART on FHIR platforms. Includes Patient, Condition, Observation, AllergyIntolerance, and MedicationStatement resources.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200">
              <button
                onClick={handleExportFhir}
                disabled={exportingFhir}
                className="btn-primary text-xs w-full flex items-center justify-center gap-2"
              >
                {exportingFhir ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Compiling FHIR Bundle...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    <span>Export FHIR R4 Bundle (JSON)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                <FileSpreadsheet className="h-4 w-4" />
                <span>Full Archive (Native JSON)</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Raw export of all database tables: symptom encounters, 2D body map annotations, raw readings with CSV batches, OCR outputs, and extracted field review provenance.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200">
              <button
                onClick={handleExportJson}
                disabled={exportingJson}
                className="btn-secondary text-xs w-full flex items-center justify-center gap-2"
              >
                {exportingJson ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Preparing Archive...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    <span>Export Full Archive (JSON)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Immutable Security Audit Trail */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="h-4 w-4 text-teal-600" />
              Security & Access Audit Trail
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Cryptographically timestamped log of pipeline executions, LLM calls, and consent modifications.
            </p>
          </div>
          <button
            onClick={fetchData}
            className="text-xs text-slate-500 hover:text-teal-700 font-medium flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>

        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider sticky top-0">
              <tr>
                <th className="px-6 py-2.5">Timestamp</th>
                <th className="px-6 py-2.5">Action</th>
                <th className="px-6 py-2.5">Entity / Target</th>
                <th className="px-6 py-2.5">Client IP</th>
                <th className="px-6 py-2.5 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    No security audit logs recorded yet.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-2.5 text-slate-500 whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="px-6 py-2.5 font-medium text-slate-900">
                      <span className="bg-slate-100 px-2 py-0.5 rounded font-mono text-[10px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-2.5 text-slate-600">
                      {log.entity_type ? (
                        <span>
                          {log.entity_type}{" "}
                          {log.entity_id && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({String(log.entity_id).slice(0, 6)}...)
                            </span>
                          )}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-6 py-2.5 text-slate-400 font-mono text-[11px]">
                      {log.ip_address || "internal"}
                    </td>
                    <td className="px-6 py-2.5 text-right">
                      {log.details ? (
                        <button
                          onClick={() => setSelectedAuditLog(log)}
                          className="text-teal-700 hover:text-teal-800 font-medium inline-flex items-center gap-1"
                        >
                          <Eye className="h-3 w-3" /> View
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 4: Danger Zone */}
      <div className="border border-rose-200 bg-rose-50/20 rounded-2xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-bold text-rose-900">Danger Zone: Permanent Account Erasure</h2>
            <p className="text-xs text-rose-800 mt-1">
              Irreversibly purges your account, patient profile, all uploaded documents, OCR records, vital measurements, symptom chats, and event vector embeddings.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={() => {
              setDeleteConfirmationText("");
              setShowDeleteModal(true);
            }}
            className="btn-danger text-xs flex items-center gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Account & Health Record
          </button>
        </div>
      </div>

      {/* Audit Log Detail Modal */}
      {selectedAuditLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Audit Log Details</h3>
              <button
                onClick={() => setSelectedAuditLog(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <p>
                <strong>Action:</strong>{" "}
                <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                  {selectedAuditLog.action}
                </span>
              </p>
              <p>
                <strong>Timestamp:</strong> {formatDateTime(selectedAuditLog.created_at)}
              </p>
              <p>
                <strong>Client IP:</strong> {selectedAuditLog.ip_address || "internal"}
              </p>
              <p className="font-semibold text-slate-700 pt-2">Metadata Details:</p>
              <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg overflow-x-auto text-[11px] font-mono whitespace-pre-wrap">
                {JSON.stringify(selectedAuditLog.details, null, 2)}
              </pre>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedAuditLog(null)}
                className="btn-primary text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border-2 border-rose-200">
            <div className="flex items-center justify-between border-b border-rose-100 pb-3">
              <div className="flex items-center gap-2 text-rose-700">
                <AlertTriangle className="h-5 w-5" />
                <h3 className="text-base font-bold">Confirm Complete Data Erasure</h3>
              </div>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This action is permanent and cannot be undone. All clinical documents, vitals, symptom history, and vector embeddings will be permanently purged.
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800">
                Type <span className="font-mono text-rose-600 font-bold">DELETE MY DATA</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                placeholder="DELETE MY DATA"
                className="input-field w-full text-xs font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirmationText !== "DELETE MY DATA" || deletingAccount}
                onClick={handleDeleteAccount}
                className="btn-danger text-xs disabled:opacity-40 flex items-center gap-1.5"
              >
                {deletingAccount ? "Purging Record..." : "Permanently Delete Everything"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
