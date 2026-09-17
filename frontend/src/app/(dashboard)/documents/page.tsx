"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  Upload,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  ChevronRight,
  Shield,
  FileCheck,
  X,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime, getConfidenceBadge, getStatusBadge } from "@/lib/utils";

const DOC_TYPES = [
  { value: "prescription", label: "Prescription" },
  { value: "lab_report", label: "Lab Report" },
  { value: "discharge_summary", label: "Discharge Summary" },
  { value: "imaging_report", label: "Imaging Report" },
  { value: "other", label: "Other Record" },
];

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("all");

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDocType, setUploadDocType] = useState("prescription");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await api.getDocuments();
      setDocuments(res || []);
    } catch (err: any) {
      console.error("Failed to load documents:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    setUploading(true);
    setUploadError("");

    try {
      await api.uploadDocument(uploadFile, uploadTitle || undefined, uploadDocType);
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadTitle("");
      fetchDocuments();
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload and process document.");
    } finally {
      setUploading(false);
    }
  };

  const handleReprocess = async (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    try {
      await api.reprocessDocument(docId);
      fetchDocuments();
    } catch (err: any) {
      alert("Failed to reprocess: " + (err.message || "Unknown error"));
    }
  };

  // Filtered documents
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      !searchQuery ||
      doc.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.original_filename?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.document_type?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType =
      selectedTypeFilter === "all" || doc.document_type === selectedTypeFilter;

    const matchesStatus =
      selectedStatusFilter === "all" || doc.status === selectedStatusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  // Metrics
  const reviewCount = documents.filter((d) => d.status === "review_required").length;
  const confirmedCount = documents.filter((d) => d.status === "confirmed").length;
  const unusableCount = documents.filter((d) => d.status === "unusable").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-teal-600" />
            Medical Documents & OCR Pipeline
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Original scans are preserved permanently. OCR parses text and extracts structured medical fields for doctor review.
          </p>
        </div>
        <button
          onClick={() => {
            setUploadError("");
            setShowUploadModal(true);
          }}
          className="btn-primary text-sm flex items-center gap-2"
        >
          <Upload className="h-4 w-4" />
          Upload Document
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Vault Documents
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{documents.length}</p>
          <p className="text-xs text-slate-400 mt-1">Prescriptions, labs & summaries</p>
        </div>

        <div className="card p-4 border-amber-200 bg-amber-50/40">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Awaiting Review
          </p>
          <p className="text-2xl font-bold text-amber-900 mt-1">{reviewCount}</p>
          <p className="text-xs text-amber-700 mt-1">Requires user verification</p>
        </div>

        <div className="card p-4 border-emerald-200 bg-emerald-50/40">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
            <FileCheck className="h-3.5 w-3.5" /> Confirmed
          </p>
          <p className="text-2xl font-bold text-emerald-900 mt-1">{confirmedCount}</p>
          <p className="text-xs text-emerald-700 mt-1">Verified into health record</p>
        </div>

        <div className="card p-4 border-rose-200 bg-rose-50/40">
          <p className="text-xs font-semibold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" /> Unusable / Low Quality
          </p>
          <p className="text-2xl font-bold text-rose-900 mt-1">{unusableCount}</p>
          <p className="text-xs text-rose-700 mt-1">Poor scan or unreadable OCR</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by title, file name, or type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field w-full pl-9 text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value)}
            className="input-field text-xs py-2"
          >
            <option value="all">All Document Types</option>
            {DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="input-field text-xs py-2"
          >
            <option value="all">All Statuses</option>
            <option value="review_required">Review Required</option>
            <option value="confirmed">Confirmed</option>
            <option value="unusable">Unusable</option>
            <option value="processing">Processing</option>
          </select>
        </div>
      </div>

      {/* Documents List */}
      {loading ? (
        <div className="card p-12 text-center text-sm text-slate-400">
          Loading medical documents...
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="card p-12 text-center flex flex-col items-center">
          <FileText className="h-12 w-12 text-slate-300 mb-3" />
          <h3 className="text-base font-semibold text-slate-800">No documents found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            {searchQuery || selectedTypeFilter !== "all" || selectedStatusFilter !== "all"
              ? "No documents match the active filter criteria."
              : "Upload your first prescription, lab report, or discharge summary to initiate OCR extraction."}
          </p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="mt-4 btn-primary text-xs flex items-center gap-2"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload Document
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map((doc) => {
            const confTier = getConfidenceBadge(doc.confidence_score);
            const statusInfo = getStatusBadge(doc.status);

            return (
              <div
                key={doc.id}
                className="card p-5 hover:border-teal-300 transition-all shadow-xs hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded">
                      {doc.document_type?.replace("_", " ") || "Document"}
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusInfo.className}`}
                    >
                      {statusInfo.label}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 line-clamp-1 mt-1">
                    {doc.title || doc.original_filename || "Untitled Document"}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                    {doc.original_filename}
                  </p>

                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
                    {/* Confidence Score Bar */}
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">OCR Confidence</span>
                      <span className={`font-semibold ${confTier.textColor}`}>
                        {confTier.label} ({Math.round((doc.confidence_score || 0) * 100)}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          (doc.confidence_score || 0) >= 0.9
                            ? "bg-emerald-500"
                            : (doc.confidence_score || 0) >= 0.75
                            ? "bg-teal-500"
                            : (doc.confidence_score || 0) >= 0.5
                            ? "bg-amber-500"
                            : "bg-rose-500"
                        }`}
                        style={{ width: `${Math.round((doc.confidence_score || 0) * 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-slate-500 pt-1 text-[11px]">
                      <span>Extracted Fields:</span>
                      <span className="font-semibold text-slate-700">
                        {doc.extracted_fields?.length || 0} fields
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-400 text-[10px]">
                      <span>Uploaded:</span>
                      <span>{formatDateTime(doc.created_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  {doc.status === "unusable" && (
                    <button
                      onClick={(e) => handleReprocess(e, doc.id)}
                      className="text-xs text-slate-500 hover:text-teal-700 font-medium flex items-center gap-1"
                      title="Try reprocessing OCR"
                    >
                      <RefreshCw className="h-3 w-3" /> Retry
                    </button>
                  )}
                  <div className="ml-auto">
                    <Link
                      href={`/documents/${doc.id}`}
                      className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                    >
                      <span>Review Workspace</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-teal-600" />
                <h3 className="text-lg font-bold text-slate-900">Upload Health Document</h3>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Preserve original prescription, lab, or clinical files with automated OCR text recognition and structured field extraction.
            </p>

            {uploadError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-lg">
                {uploadError}
              </div>
            )}

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Document Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Roberts Cardiology Prescription"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="input-field w-full text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Document Type
                </label>
                <select
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value)}
                  className="input-field w-full text-sm"
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-teal-500 transition-colors">
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.tiff,.txt"
                  id="doc-upload"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="hidden"
                  required
                />
                <label htmlFor="doc-upload" className="cursor-pointer flex flex-col items-center">
                  <Upload className="h-8 w-8 text-slate-400 mb-2" />
                  <span className="text-sm font-semibold text-slate-700">
                    {uploadFile ? uploadFile.name : "Select File from Device"}
                  </span>
                  <span className="text-xs text-slate-400 mt-1">
                    {uploadFile
                      ? `${(uploadFile.size / 1024).toFixed(1)} KB`
                      : "Supports PDF, PNG, JPG, JPEG, TIFF (Max 25MB)"}
                  </span>
                </label>
              </div>

              {/* Privacy Notice */}
              <div className="bg-teal-50/60 border border-teal-200 rounded-xl p-3 flex items-start gap-2.5">
                <Shield className="h-4 w-4 text-teal-700 shrink-0 mt-0.5" />
                <p className="text-[11px] text-teal-900 leading-relaxed">
                  <strong>Privacy Guard:</strong> OCR extraction runs locally. LLM structuring honors your external AI processing consent setting.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="btn-secondary text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!uploadFile || uploading}
                  className="btn-primary text-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Processing OCR...</span>
                    </>
                  ) : (
                    <span>Upload & Extract</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
