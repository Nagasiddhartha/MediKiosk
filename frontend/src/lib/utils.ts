import { ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "N/A";
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return "N/A";
  try {
    const d = new Date(dateString);
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

export function getConfidenceBadgeClass(tier: string | null | undefined): string {
  switch (tier?.toLowerCase()) {
    case "tier1":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
    case "tier2":
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
    case "tier3":
      return "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800";
    case "tier4":
    default:
      return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800";
  }
}

export function getStatusBadgeClass(status: string | null | undefined): string {
  switch (status?.toLowerCase()) {
    case "confirmed":
    case "completed":
    case "accepted":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
    case "pending_review":
    case "review_required":
    case "in_progress":
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
    case "urgent":
    case "rejected":
    case "unusable":
    case "failed":
      return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800";
    case "corrected":
      return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
  }
}

export function getConfidenceBadge(scoreOrTier: number | string | null | undefined): {
  label: string;
  className: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
} {
  let score = typeof scoreOrTier === "number" ? scoreOrTier : null;
  if (typeof scoreOrTier === "string") {
    const lower = scoreOrTier.toLowerCase();
    if (lower.includes("tier_1") || lower.includes("tier1")) score = 0.95;
    else if (lower.includes("tier_2") || lower.includes("tier2")) score = 0.82;
    else if (lower.includes("tier_3") || lower.includes("tier3")) score = 0.65;
    else if (lower.includes("tier_4") || lower.includes("tier4")) score = 0.35;
    else {
      const parsed = parseFloat(scoreOrTier);
      if (!isNaN(parsed)) score = parsed;
    }
  }

  const s = score ?? 0;
  if (s >= 0.9) {
    return {
      label: "Tier 1 (High)",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
      textColor: "text-emerald-700",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-200",
    };
  } else if (s >= 0.75) {
    return {
      label: "Tier 2 (Moderate)",
      className: "bg-teal-50 text-teal-700 border-teal-200",
      textColor: "text-teal-700",
      bgColor: "bg-teal-50",
      borderColor: "border-teal-200",
    };
  } else if (s >= 0.5) {
    return {
      label: "Tier 3 (Review Needed)",
      className: "bg-amber-50 text-amber-700 border-amber-200",
      textColor: "text-amber-700",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
    };
  } else {
    return {
      label: "Tier 4 (Unusable)",
      className: "bg-rose-50 text-rose-700 border-rose-200",
      textColor: "text-rose-700",
      bgColor: "bg-rose-50",
      borderColor: "border-rose-200",
    };
  }
}

export function getStatusBadge(status: string | null | undefined): {
  label: string;
  className: string;
} {
  switch (status?.toLowerCase()) {
    case "confirmed":
      return { label: "Confirmed", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "review_required":
    case "pending_review":
      return { label: "Review Required", className: "bg-amber-50 text-amber-700 border-amber-200" };
    case "processing":
      return { label: "Processing", className: "bg-blue-50 text-blue-700 border-blue-200" };
    case "unusable":
    case "failed":
      return { label: "Unusable", className: "bg-rose-50 text-rose-700 border-rose-200" };
    case "accepted":
      return { label: "Accepted", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "corrected":
      return { label: "Corrected", className: "bg-blue-50 text-blue-700 border-blue-200" };
    case "rejected":
      return { label: "Rejected", className: "bg-rose-50 text-rose-700 border-rose-200" };
    default:
      return { label: status || "Unknown", className: "bg-slate-100 text-slate-700 border-slate-200" };
  }
}

