const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("medikiosk_token") : null;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return {} as T;
  }

  if (!response.ok) {
    let errorData: any = {};
    try {
      errorData = await response.json();
    } catch {
      errorData = { detail: response.statusText };
    }

    const message =
      typeof errorData.detail === "string"
        ? errorData.detail
        : Array.isArray(errorData.detail)
        ? errorData.detail.map((e: any) => e.msg).join(", ")
        : "An unexpected error occurred.";

    throw new ApiError(message, response.status, errorData);
  }

  return response.json();
}

// API Resource functions
export const api = {
  // Auth
  login: (data: any) =>
    apiRequest<{ access_token: string; token_type: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  register: (data: any) =>
    apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getMe: () => apiRequest("/users/me"),

  // Dashboard
  getDashboardOverview: () => apiRequest("/dashboard/overview"),

  // Profile
  getProfile: () => apiRequest("/profile"),
  updateProfile: (data: any) =>
    apiRequest("/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Chronic Conditions
  getConditions: () => apiRequest("/conditions"),
  createCondition: (data: any) =>
    apiRequest("/conditions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCondition: (id: string, data: any) =>
    apiRequest(`/conditions/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteCondition: (id: string) =>
    apiRequest(`/conditions/${id}`, {
      method: "DELETE",
    }),

  // Allergies
  getAllergies: () => apiRequest("/allergies"),
  createAllergy: (data: any) =>
    apiRequest("/allergies", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteAllergy: (id: string) =>
    apiRequest(`/allergies/${id}`, {
      method: "DELETE",
    }),

  // Medications
  getMedications: () => apiRequest("/medications"),
  createMedication: (data: any) =>
    apiRequest("/medications", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateMedication: (id: string, data: any) =>
    apiRequest(`/medications/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteMedication: (id: string) =>
    apiRequest(`/medications/${id}`, {
      method: "DELETE",
    }),

  // Visits
  getVisits: () => apiRequest("/visits"),
  createVisit: (data: any) =>
    apiRequest("/visits", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteVisit: (id: string) =>
    apiRequest(`/visits/${id}`, {
      method: "DELETE",
    }),

  // Symptom Intake & Body Map
  processIntake: (data: { encounter_id?: string; text: string }) =>
    apiRequest("/intake/process", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getIntakeEncounters: () => apiRequest("/intake/encounters"),
  getIntakeEncounter: (id: string) => apiRequest(`/intake/encounters/${id}`),
  getIntakeMessages: (id: string) => apiRequest(`/intake/encounters/${id}/messages`),
  addBodyMapAnnotation: (encounterId: string, data: any) =>
    apiRequest(`/symptoms/${encounterId}/annotations`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteBodyMapAnnotation: (encounterId: string, annotationId: string) =>
    apiRequest(`/symptoms/${encounterId}/annotations/${annotationId}`, {
      method: "DELETE",
    }),

  // Red-Thread Historical Correlation
  queryRedThread: (data: {
    current_complaint: string;
    structured_data?: any;
    body_region?: string;
    limit?: number;
  }) =>
    apiRequest("/red-thread/query", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Health Readings & Trends
  getReadings: (readingType?: string) =>
    apiRequest(`/readings${readingType ? `?reading_type=${readingType}` : ""}`),
  getReadingsTrends: (readingType: string = "blood_pressure", days: number = 30) =>
    apiRequest(`/readings/trends?reading_type=${readingType}&days=${days}`),
  createReading: (data: any) =>
    apiRequest("/readings", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteReading: (id: string) =>
    apiRequest(`/readings/${id}`, {
      method: "DELETE",
    }),
  importCsvReadings: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest("/readings/import-csv", {
      method: "POST",
      body: formData,
    });
  },

  // Documents
  getDocuments: () => apiRequest("/documents"),
  getDocumentDetail: (id: string) => apiRequest(`/documents/${id}`),
  getDocumentFileUrl: (id: string) => `${API_BASE}/documents/${id}/file`,
  uploadDocument: (file: File, title?: string, documentType?: string) => {
    const formData = new FormData();
    formData.append("file", file);
    if (title) formData.append("title", title);
    if (documentType) formData.append("document_type", documentType);
    return apiRequest("/documents/upload", {
      method: "POST",
      body: formData,
    });
  },
  reviewDocumentField: (fieldId: string, data: { action: string; user_corrected_value?: string; review_reason?: string }) =>
    apiRequest(`/documents/fields/${fieldId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  confirmDocument: (id: string) =>
    apiRequest(`/documents/${id}/confirm`, {
      method: "POST",
    }),
  reprocessDocument: (id: string) =>
    apiRequest(`/documents/${id}/reprocess`, {
      method: "POST",
    }),

  // Timeline
  getTimeline: (params?: { search?: string; group?: string; types?: string }) => {
    const sp = new URLSearchParams();
    if (params?.search) sp.append("search", params.search);
    if (params?.group) sp.append("group", params.group);
    if (params?.types) sp.append("types", params.types);
    const q = sp.toString();
    return apiRequest(`/timeline${q ? `?${q}` : ""}`);
  },

  // Doctor Summary
  getSummaryPdfUrl: (days: number = 30) => `${API_BASE}/summary/pdf?days=${days}`,

  // Export
  exportJson: () => apiRequest("/export/json"),
  getFhirExportUrl: () => `${API_BASE}/export/fhir`,
  deleteAccount: () =>
    apiRequest("/export/account", {
      method: "DELETE",
    }),

  // Privacy & Consent
  getConsents: () => apiRequest("/consent"),
  updateConsent: (data: { consent_type: string; granted: boolean }) =>
    apiRequest("/consent", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getAuditLogs: () => apiRequest("/audit-logs"),

  // Demo
  seedDemo: () =>
    apiRequest("/demo/seed", {
      method: "POST",
    }),
};
