"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Edit3,
  Check,
  X,
  Copy,
  Download,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Eye,
  FileCode,
  Sparkles,
  Info,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime, getConfidenceBadge, getStatusBadge } from "@/lib/utils";

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [docDetail, setDocDetail] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [activeLeftTab, setActiveLeftTab] = useState<"preview" | "ocr">("preview");

  // Authenticated file preview blob
  const [fileBlobUrl, setFileBlobUrl] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);

  // Field editing state
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [correctedValue, setCorrectedValue] = useState("");
  const [reviewReason, setReviewReason] = useState("");
  const [submittingFieldId, setSubmittingFieldId] = useState<string | null>(null);
  const [confirmingDoc, setConfirmingDoc] = useState(false);
  const [copiedOcr, setCopiedOcr] = useState(false);

  const fetchDocument = async () => {
    if (!documentId) return;
    setLoading(true);
    try {
      const data = await api.getDocumentDetail(documentId);
      setDocDetail(data);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load document details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocument();
  }, [documentId]);

  // Load authenticated file preview
  useEffect(() => {
    let isSubscribed = true;
    const fetchFile = async () => {
      if (!documentId) return;
      setFileLoading(true);
      try {
        const token = localStorage.getItem("medikiosk_token");
        const fileUrl = api.getDocumentFileUrl(documentId);
        const res = await fetch(fileUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const blob = await res.blob();
          if (isSubscribed) {
            const blobUrl = URL.createObjectURL(blob);
            setFileBlobUrl(blobUrl);
          }
        }
      } catch (err) {
        console.error("Failed to load document file blob:", err);
      } finally {
        if (isSubscribed) setFileLoading(false);
      }
    };

    fetchFile();

    return () => {
      isSubscribed = false;
      if (fileBlobUrl) {
        URL.revokeObjectURL(fileBlobUrl);
      }
    };
  }, [documentId]);

  const handleFieldAction = async (
    fieldId: string,
    action: "accept" | "correct" | "reject",
    val?: string,
    reason?: string
  ) => {
    setSubmittingFieldId(fieldId);
    try {
      await api.reviewDocumentField(fieldId, {
        action,
        user_corrected_value: val,
        review_reason: reason,
      });
      setEditingFieldId(null);
      setCorrectedValue("");
      setReviewReason("");
      await fetchDocument();
    } catch (err: any) {
      alert("Failed to review field: " + (err.message || "Unknown error"));
    } finally {
      setSubmittingFieldId(null);
    }
  };

  const handleConfirmDocument = async () => {
    if (!documentId) return;
    setConfirmingDoc(true);
    try {
      await api.confirmDocument(documentId);
      await fetchDocument();
    } catch (err: any) {
      alert("Cannot confirm document: " + (err.message || "Ensure all fields are reviewed."));
    } finally {
      setConfirmingDoc(false);
    }
  };

  const handleReprocessDocument = async () => {
    if (!documentId) return;
    setLoading(true);
    try {
      await api.reprocessDocument(documentId);
      await fetchDocument();
    } catch (err: any) {
      alert("Failed to reprocess: " + (err.message || "Unknown error"));
      setLoading(false);
    }
  };

  const handleCopyOcr = () => {
    const text = docDetail?.ocr?.cleaned_text || docDetail?.ocr?.raw_text || "";
    navigator.clipboard.writeText(text);
    setCopiedOcr(true);
    setTimeout(() => setCopiedOcr(false), 2000);
  };

  if (loading) {
    return (
      <div className="card p-12 text-center text-sm text-slate-400">
        Loading document workspace...
      </div>
    );
  }

  if (errorMsg || !docDetail) {
    return (
      <div className="card p-8 text-center space-y-4">
        <AlertTriangle className="h-10 w-10 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Document Not Found</h2>
        <p className="text-sm text-slate-500">{errorMsg || "Unable to find the requested document."}</p>
        <Link href="/documents" className="btn-primary inline-flex text-sm">
          Return to Documents
        </Link>
      </div>
    );
  }

  const { document: doc, ocr, fields } = docDetail;
  const statusInfo = getStatusBadge(doc.status);
  const overallConf = getConfidenceBadge(doc.overall_confidence);

  // Mandatory confirmation guard calculation
  const pendingFields = fields.filter(
    (f: any) => f.status === "pending_review" || !f.status
  );
  const isAllReviewed = fields.length > 0 && pendingFields.length === 0;
  const isConfirmed = doc.status === "confirmed";

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/documents"
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">
                {doc.title || doc.original_filename || "Document Review"}
              </h1>
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${statusInfo.className}`}
              >
                {statusInfo.label}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Original: <span className="font-mono text-slate-500">{doc.original_filename}</span> •
              Uploaded {formatDateTime(doc.created_at)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isConfirmed && (
            <button
              onClick={handleReprocessDocument}
              className="btn-secondary text-xs flex items-center gap-1.5"
              title="Re-run OCR and extraction"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Reprocess
            </button>
          )}
          {fileBlobUrl && (
            <a
              href={fileBlobUrl}
              download={doc.original_filename || "document"}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" /> Download File
            </a>
          )}
        </div>
      </div>

      {/* Confirmation Guard & Status Alert */}
      {isConfirmed ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-emerald-900">
              Document Confirmed & Locked into Longitudinal Record
            </p>
            <p className="text-xs text-emerald-700 mt-0.5">
              All extracted fields have been verified by the user. Confirmed data points are reflected in your health timeline and doctor summary report.
            </p>
          </div>
        </div>
      ) : pendingFields.length > 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-amber-900">
                User Verification Guard: {pendingFields.length} field(s) require review
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                To guarantee medical record integrity, every extracted field must be Accepted, Corrected, or Rejected before confirmation.
              </p>
            </div>
          </div>
          <button
            disabled
            className="btn-primary text-xs opacity-50 cursor-not-allowed"
            title="Review all pending fields first"
          >
            Confirm Document ({pendingFields.length} Pending)
          </button>
        </div>
      ) : (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-teal-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-teal-900">
                All Extracted Fields Verified!
              </p>
              <p className="text-xs text-teal-800 mt-0.5">
                Ready to commit this document into your permanent longitudinal health record.
              </p>
            </div>
          </div>
          <button
            onClick={handleConfirmDocument}
            disabled={confirmingDoc}
            className="btn-primary text-xs flex items-center gap-1.5 shadow-sm"
          >
            {confirmingDoc ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Confirming...
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" /> Confirm Document
              </>
            )}
          </button>
        </div>
      )}

      {/* Split Screen Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Original File / OCR Text (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="card overflow-hidden">
            {/* Tab switchers */}
            <div className="flex border-b border-slate-200 bg-slate-50/50">
              <button
                onClick={() => setActiveLeftTab("preview")}
                className={`flex-1 py-2.5 px-4 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                  activeLeftTab === "preview"
                    ? "border-teal-600 text-teal-700 bg-white"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <Eye className="h-3.5 w-3.5" /> Original Scan Preview
              </button>
              <button
                onClick={() => setActiveLeftTab("ocr")}
                className={`flex-1 py-2.5 px-4 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                  activeLeftTab === "ocr"
                    ? "border-teal-600 text-teal-700 bg-white"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <FileCode className="h-3.5 w-3.5" /> Extracted OCR Text
              </button>
            </div>

            {/* Tab 1: Original Document Preview */}
            {activeLeftTab === "preview" && (
              <div className="p-4">
                {fileLoading ? (
                  <div className="h-[520px] flex items-center justify-center text-xs text-slate-400">
                    Loading file preview...
                  </div>
                ) : fileBlobUrl ? (
                  doc.mime_type?.startsWith("image/") ? (
                    <div className="h-[520px] overflow-auto rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center">
                      <img
                        src={fileBlobUrl}
                        alt="Document Preview"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="h-[520px] rounded-lg border border-slate-200 overflow-hidden bg-slate-100">
                      <iframe
                        src={fileBlobUrl}
                        title="Document File"
                        className="w-full h-full border-none"
                      />
                    </div>
                  )
                ) : (
                  <div className="h-[520px] flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-lg text-slate-400">
                    <FileText className="h-10 w-10 mb-2 text-slate-300" />
                    <p className="text-xs">Preview unavailable for this format.</p>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Raw OCR Text */}
            {activeLeftTab === "ocr" && (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Engine: {ocr?.ocr_engine || "Tesseract OCR"}</span>
                  <button
                    onClick={handleCopyOcr}
                    className="text-teal-700 hover:text-teal-800 font-medium flex items-center gap-1 text-[11px]"
                  >
                    <Copy className="h-3 w-3" /> {copiedOcr ? "Copied!" : "Copy OCR"}
                  </button>
                </div>
                <div className="h-[480px] overflow-y-auto p-3.5 bg-slate-900 text-slate-100 font-mono text-xs rounded-lg whitespace-pre-wrap leading-relaxed select-text">
                  {ocr?.cleaned_text || ocr?.raw_text || "No OCR text extracted."}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Extracted Fields Review (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Extracted Medical Fields</h2>
                <p className="text-xs text-slate-500">
                  Verify or correct extracted items below. Each field displays confidence tier and evidence snippet.
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                  Overall Score
                </span>
                <span className={`text-sm font-bold ${overallConf.textColor}`}>
                  {overallConf.label} ({Math.round((doc.overall_confidence || 0) * 100)}%)
                </span>
              </div>
            </div>

            {/* Non-diagnostic caution notice */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] text-slate-600 flex items-start gap-2 mb-4">
              <Info className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
              <span>
                <strong>Non-Diagnostic Platform:</strong> Extracted fields are strictly descriptive historical data points to aid clinical consults. Never make self-medication decisions based on OCR output.
              </span>
            </div>

            {/* Fields List */}
            {fields.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                No structured fields were extracted from this document.
              </div>
            ) : (
              <div className="space-y-3">
                {fields.map((field: any) => {
                  const conf = getConfidenceBadge(field.final_confidence || field.ocr_confidence);
                  const isEditing = editingFieldId === field.id;
                  const isPending = field.status === "pending_review" || !field.status;
                  const isSubmitting = submittingFieldId === field.id;

                  return (
                    <div
                      key={field.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isPending
                          ? "border-amber-200 bg-amber-50/20 shadow-xs"
                          : field.status === "accepted"
                          ? "border-emerald-200 bg-emerald-50/20"
                          : field.status === "corrected"
                          ? "border-blue-200 bg-blue-50/20"
                          : "border-slate-200 bg-slate-50/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 capitalize">
                              {field.field_name.replace(/_/g, " ")}
                            </span>
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded">
                              {field.entity_type}
                            </span>
                          </div>

                          {/* Values Display */}
                          <div className="mt-1 text-sm text-slate-800">
                            {field.status === "corrected" && field.user_corrected_value ? (
                              <div className="space-y-0.5">
                                <span className="line-through text-xs text-slate-400 mr-2">
                                  {field.raw_value || "—"}
                                </span>
                                <span className="font-semibold text-blue-800">
                                  {field.user_corrected_value}
                                </span>
                              </div>
                            ) : field.status === "rejected" ? (
                              <span className="text-xs line-through text-rose-500">
                                {field.raw_value || "—"} (Rejected)
                              </span>
                            ) : (
                              <span className="font-semibold">{field.raw_value || "—"}</span>
                            )}
                            {field.unit && (
                              <span className="text-xs text-slate-500 ml-1.5">{field.unit}</span>
                            )}
                          </div>
                        </div>

                        {/* Status & Confidence Tier Badge */}
                        <div className="text-right shrink-0">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${conf.bgColor} ${conf.textColor} ${conf.borderColor}`}
                          >
                            {conf.label} ({Math.round((field.final_confidence || field.ocr_confidence || 0) * 100)}%)
                          </span>
                          <span className="block text-[10px] font-medium text-slate-500 mt-1 capitalize">
                            {field.status?.replace("_", " ") || "Pending Review"}
                          </span>
                        </div>
                      </div>

                      {/* Review Reason note if present */}
                      {field.review_reason && (
                        <p className="text-[11px] text-slate-500 italic mt-1.5">
                          Note: {field.review_reason}
                        </p>
                      )}

                      {/* Inline Editing Form */}
                      {isEditing && (
                        <div className="mt-3 pt-3 border-t border-slate-200/60 space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                                Corrected Value
                              </label>
                              <input
                                type="text"
                                value={correctedValue}
                                onChange={(e) => setCorrectedValue(e.target.value)}
                                className="input-field w-full text-xs"
                                placeholder="Enter correct value..."
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                                Reason (Optional)
                              </label>
                              <input
                                type="text"
                                value={reviewReason}
                                onChange={(e) => setReviewReason(e.target.value)}
                                className="input-field w-full text-xs"
                                placeholder="e.g. OCR mistook 10mg as 70mg"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingFieldId(null)}
                              className="btn-secondary text-xs py-1 px-2.5"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleFieldAction(
                                  field.id,
                                  "correct",
                                  correctedValue,
                                  reviewReason
                                )
                              }
                              disabled={!correctedValue || isSubmitting}
                              className="btn-primary text-xs py-1 px-3"
                            >
                              Save Correction
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Field Action Buttons */}
                      {!isConfirmed && !isEditing && (
                        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleFieldAction(field.id, "accept")}
                            disabled={isSubmitting}
                            className={`text-xs px-2.5 py-1 rounded font-medium transition-colors flex items-center gap-1 ${
                              field.status === "accepted"
                                ? "bg-emerald-100 text-emerald-800"
                                : "text-emerald-700 hover:bg-emerald-50"
                            }`}
                          >
                            <Check className="h-3.5 w-3.5" /> Accept
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingFieldId(field.id);
                              setCorrectedValue(field.raw_value || "");
                              setReviewReason(field.review_reason || "");
                            }}
                            className="text-xs text-blue-700 hover:bg-blue-50 px-2.5 py-1 rounded font-medium transition-colors flex items-center gap-1"
                          >
                            <Edit3 className="h-3.5 w-3.5" /> Correct
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleFieldAction(
                                field.id,
                                "reject",
                                undefined,
                                "Patient marked as invalid"
                              )
                            }
                            disabled={isSubmitting}
                            className={`text-xs px-2.5 py-1 rounded font-medium transition-colors flex items-center gap-1 ${
                              field.status === "rejected"
                                ? "bg-rose-100 text-rose-800"
                                : "text-rose-700 hover:bg-rose-50"
                            }`}
                          >
                            <X className="h-3.5 w-3.5" /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
