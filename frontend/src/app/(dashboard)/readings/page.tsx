"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  Plus,
  Upload,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Trash2,
  Download,
  CheckCircle2,
  X,
  FileSpreadsheet,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { api } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/utils";

const READING_TYPES = [
  { id: "blood_pressure", label: "Blood Pressure", unit: "mmHg" },
  { id: "blood_glucose", label: "Blood Glucose", unit: "mg/dL" },
  { id: "heart_rate", label: "Heart Rate", unit: "bpm" },
  { id: "weight", label: "Body Weight", unit: "kg" },
  { id: "temperature", label: "Temperature", unit: "°C" },
];

export default function ReadingsPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [selectedType, setSelectedType] = useState("blood_pressure");
  const [selectedDays, setSelectedDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [trendData, setTrendData] = useState<any>(null);
  const [readingsList, setReadingsList] = useState<any[]>([]);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Manual Form State
  const [formType, setFormType] = useState("blood_pressure");
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [formSystolic, setFormSystolic] = useState("");
  const [formDiastolic, setFormDiastolic] = useState("");
  const [formNumeric, setFormNumeric] = useState("");
  const [formUnit, setFormUnit] = useState("mmHg");
  const [formNotes, setFormNotes] = useState("");

  // CSV file state
  const [csvFile, setCsvFile] = useState<File | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchTrendsAndReadings = async () => {
    setLoading(true);
    try {
      const [trendRes, listRes] = await Promise.all([
        api.getReadingsTrends(selectedType, selectedDays),
        api.getReadings(selectedType),
      ]);
      setTrendData(trendRes);
      setReadingsList(listRes);
    } catch (err: any) {
      console.error("Failed to load readings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isMounted) {
      fetchTrendsAndReadings();
    }
  }, [isMounted, selectedType, selectedDays]);

  const handleTypeChange = (typeId: string) => {
    setSelectedType(typeId);
    setFormType(typeId);
    const item = READING_TYPES.find((t) => t.id === typeId);
    if (item) setFormUnit(item.unit);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);

    try {
      const payload: any = {
        reading_type: formType,
        recorded_at: new Date(formDate).toISOString(),
        notes: formNotes || undefined,
        unit: formUnit,
        source: "manual",
      };

      if (formType === "blood_pressure") {
        if (!formSystolic || !formDiastolic) {
          setErrorMsg("Both systolic and diastolic values are required.");
          setSubmitting(false);
          return;
        }
        payload.systolic = parseFloat(formSystolic);
        payload.diastolic = parseFloat(formDiastolic);
        payload.value_text = `${formSystolic}/${formDiastolic} mmHg`;
      } else {
        if (!formNumeric) {
          setErrorMsg("Reading value is required.");
          setSubmitting(false);
          return;
        }
        payload.numeric_value = parseFloat(formNumeric);
        payload.value_text = `${formNumeric} ${formUnit}`;
      }

      await api.createReading(payload);
      setShowAddModal(false);
      setFormSystolic("");
      setFormDiastolic("");
      setFormNumeric("");
      setFormNotes("");
      fetchTrendsAndReadings();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save reading.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;
    setErrorMsg("");
    setSubmitting(true);

    try {
      const res = await api.importCsvReadings(csvFile);
      setImportResult(res);
      fetchTrendsAndReadings();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to import CSV file.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReading = async (id: string) => {
    if (!confirm("Are you sure you want to delete this reading?")) return;
    try {
      await api.deleteReading(id);
      fetchTrendsAndReadings();
    } catch (err: any) {
      alert("Failed to delete reading: " + (err.message || "Unknown error"));
    }
  };

  const downloadSampleCsv = () => {
    const csvContent =
      "date,reading_type,systolic,diastolic,numeric_value,unit,notes\n" +
      "2026-03-01 08:00,blood_pressure,128,82,,,Morning resting\n" +
      "2026-03-02 08:15,blood_pressure,132,84,,,After coffee\n" +
      "2026-03-03 08:30,blood_pressure,136,88,,,Stressful morning\n" +
      "2026-03-04 08:00,blood_glucose,,,118,mg/dL,Fasting\n" +
      "2026-03-05 08:10,heart_rate,,,74,bpm,Resting\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "sample_health_readings.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const chartData = (trendData?.time_series || []).map((pt: any) => ({
    date: formatDate(pt.recorded_at),
    rawDate: pt.recorded_at,
    systolic: pt.systolic,
    diastolic: pt.diastolic,
    value: pt.numeric_value,
    notes: pt.value_text,
  }));

  if (!isMounted) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-teal-600" />
            Health Readings & Trends
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track vitals, observe trends, and log readings from home cuffs or CSV exports.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setImportResult(null);
              setErrorMsg("");
              setShowImportModal(true);
            }}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            <Upload className="h-4 w-4 text-slate-600" />
            Import CSV
          </button>
          <button
            onClick={() => {
              setErrorMsg("");
              setShowAddModal(true);
            }}
            className="btn-primary text-sm flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Log Reading
          </button>
        </div>
      </div>

      {/* Vital Type Selector Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {READING_TYPES.map((type) => (
          <button
            key={type.id}
            onClick={() => handleTypeChange(type.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedType === type.id
                ? "bg-teal-50 text-teal-700 border border-teal-200 shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* Overview Cards & Trend Direction */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Latest Reading
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {selectedType === "blood_pressure"
              ? trendData?.latest_point?.systolic
                ? `${trendData.latest_point.systolic}/${trendData.latest_point.diastolic} mmHg`
                : "No data"
              : trendData?.latest_point?.numeric_value
              ? `${trendData.latest_point.numeric_value} ${trendData.latest_point.unit || ""}`
              : "No data"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {trendData?.latest_point
              ? formatDateTime(trendData.latest_point.recorded_at)
              : "Log your first reading"}
          </p>
        </div>

        <div className="card p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {selectedDays}-Day Average
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {selectedType === "blood_pressure"
              ? trendData?.average_systolic
                ? `${trendData.average_systolic} / ${trendData.average_diastolic} mmHg`
                : "—"
              : trendData?.average_numeric
              ? `${trendData.average_numeric}`
              : "—"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Across {trendData?.data_points_count || 0} recorded readings
          </p>
        </div>

        <div className="card p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Trajectory
          </p>
          <div className="flex items-center gap-2 mt-2">
            {trendData?.trend_direction === "rising" && (
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                <TrendingUp className="h-4 w-4" /> Rising
              </span>
            )}
            {trendData?.trend_direction === "falling" && (
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                <TrendingDown className="h-4 w-4" /> Falling
              </span>
            )}
            {trendData?.trend_direction === "stable" && (
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <Minus className="h-4 w-4" /> Stable
              </span>
            )}
            {!trendData?.trend_direction && <span className="text-sm text-slate-400">—</span>}
          </div>
          <p className="text-xs text-slate-400 mt-1">First vs second half average</p>
        </div>

        <div className="card p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Time Range Filter
          </p>
          <div className="flex items-center gap-1 mt-2">
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setSelectedDays(d)}
                className={`px-2.5 py-1 rounded text-xs font-medium ${
                  selectedDays === d
                    ? "bg-slate-900 text-white font-semibold"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-1">Showing last {selectedDays} days</p>
        </div>
      </div>

      {/* Caution Flags */}
      {trendData?.caution_flags && trendData.caution_flags.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-900">Clinical Observation Notice</p>
            <ul className="mt-1 list-disc list-inside text-amber-800 space-y-0.5">
              {trendData.caution_flags.map((flag: string, idx: number) => (
                <li key={idx}>{flag}</li>
              ))}
            </ul>
            <p className="text-xs text-amber-700 mt-2">
              Note: This is an objective summary of your recorded values for consultation with your doctor.
            </p>
          </div>
        </div>
      )}

      {/* Visual Chart Card */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {READING_TYPES.find((t) => t.id === selectedType)?.label} Trend
            </h2>
            <p className="text-xs text-slate-500">
              {selectedType === "blood_pressure"
                ? "Systolic (upper) and Diastolic (lower) with standard clinical threshold reference lines (140/90 mmHg)."
                : `Observed ${selectedType.replace("_", " ")} values over time.`}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            {selectedType === "blood_pressure" ? (
              <>
                <span className="flex items-center gap-1.5 font-medium text-teal-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-teal-600" /> Systolic
                </span>
                <span className="flex items-center gap-1.5 font-medium text-sky-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-500" /> Diastolic
                </span>
                <span className="flex items-center gap-1.5 text-rose-500">
                  <span className="w-3 border-t-2 border-dashed border-rose-400" /> 140/90 Threshold
                </span>
              </>
            ) : (
              <span className="flex items-center gap-1.5 font-medium text-teal-700">
                <span className="h-2.5 w-2.5 rounded-full bg-teal-600" /> Value
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="h-72 flex items-center justify-center text-sm text-slate-400">
            Loading reading trends...
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-72 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-lg">
            <Activity className="h-10 w-10 text-slate-300 mb-2" />
            <p className="text-sm font-medium text-slate-700">No data points recorded</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Log your readings manually or import a CSV file from your home monitoring device.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-3 btn-primary text-xs py-1.5 px-3"
            >
              Log First Reading
            </button>
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  domain={
                    selectedType === "blood_pressure"
                      ? [50, 190]
                      : selectedType === "blood_glucose"
                      ? [50, 250]
                      : ["auto", "auto"]
                  }
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200 text-xs space-y-1">
                          <p className="font-semibold text-slate-900">{label}</p>
                          <p className="text-slate-400 text-[10px]">
                            {formatDateTime(data.rawDate)}
                          </p>
                          {selectedType === "blood_pressure" ? (
                            <div className="pt-1 border-t border-slate-100">
                              <p className="text-teal-700 font-medium">
                                Systolic: <span className="font-bold">{data.systolic}</span> mmHg
                              </p>
                              <p className="text-sky-700 font-medium">
                                Diastolic: <span className="font-bold">{data.diastolic}</span> mmHg
                              </p>
                            </div>
                          ) : (
                            <div className="pt-1 border-t border-slate-100">
                              <p className="text-teal-700 font-medium">
                                Value: <span className="font-bold">{data.value}</span>{" "}
                                {trendData?.latest_point?.unit || ""}
                              </p>
                            </div>
                          )}
                          {data.notes && (
                            <p className="text-slate-500 italic pt-1">{data.notes}</p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {selectedType === "blood_pressure" ? (
                  <>
                    <ReferenceLine
                      y={140}
                      stroke="#f43f5e"
                      strokeDasharray="4 4"
                      label={{
                        value: "140 Systolic",
                        fill: "#f43f5e",
                        fontSize: 10,
                        position: "insideTopRight",
                      }}
                    />
                    <ReferenceLine
                      y={90}
                      stroke="#fb7185"
                      strokeDasharray="4 4"
                      label={{
                        value: "90 Diastolic",
                        fill: "#fb7185",
                        fontSize: 10,
                        position: "insideTopRight",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="systolic"
                      stroke="#0f766e"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#0f766e" }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="diastolic"
                      stroke="#0284c7"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#0284c7" }}
                      activeDot={{ r: 6 }}
                    />
                  </>
                ) : selectedType === "blood_glucose" ? (
                  <>
                    <ReferenceLine
                      y={126}
                      stroke="#f43f5e"
                      strokeDasharray="4 4"
                      label={{
                        value: "126 Fasting High",
                        fill: "#f43f5e",
                        fontSize: 10,
                        position: "insideTopRight",
                      }}
                    />
                    <ReferenceLine
                      y={70}
                      stroke="#eab308"
                      strokeDasharray="4 4"
                      label={{
                        value: "70 Low",
                        fill: "#eab308",
                        fontSize: 10,
                        position: "insideTopRight",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#0f766e"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#0f766e" }}
                      activeDot={{ r: 6 }}
                    />
                  </>
                ) : (
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#0f766e"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#0f766e" }}
                    activeDot={{ r: 6 }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Historical Data Table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Recorded Readings History</h2>
            <p className="text-xs text-slate-500">
              Complete log of all entries for {READING_TYPES.find((t) => t.id === selectedType)?.label}.
            </p>
          </div>
          <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full font-medium">
            {readingsList.length} total entries
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3">Date & Time</th>
                <th className="px-6 py-3">Measured Value</th>
                <th className="px-6 py-3">Context / Notes</th>
                <th className="px-6 py-3">Source</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {readingsList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">
                    No readings recorded yet for this category.
                  </td>
                </tr>
              ) : (
                readingsList.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-slate-900 whitespace-nowrap">
                      {formatDateTime(item.recorded_at)}
                    </td>
                    <td className="px-6 py-3.5 font-semibold text-slate-800">
                      {item.reading_type === "blood_pressure" ? (
                        <span>
                          {item.systolic}/{item.diastolic}{" "}
                          <span className="text-xs font-normal text-slate-500">mmHg</span>
                          {item.systolic && item.systolic >= 140 && (
                            <span className="ml-2 text-[10px] bg-rose-50 text-rose-600 border border-rose-200 px-1.5 py-0.5 rounded font-medium">
                              Elevated
                            </span>
                          )}
                        </span>
                      ) : (
                        <span>
                          {item.numeric_value}{" "}
                          <span className="text-xs font-normal text-slate-500">{item.unit}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-slate-600 text-xs max-w-xs truncate">
                      {item.notes || "—"}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {item.source}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        onClick={() => handleDeleteReading(item.id)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                        title="Delete reading"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Log Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Log Health Reading</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-lg">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reading Category
                </label>
                <select
                  value={formType}
                  onChange={(e) => {
                    setFormType(e.target.value);
                    const it = READING_TYPES.find((t) => t.id === e.target.value);
                    if (it) setFormUnit(it.unit);
                  }}
                  className="input-field w-full"
                >
                  {READING_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label} ({t.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Recorded Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="input-field w-full"
                  required
                />
              </div>

              {formType === "blood_pressure" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Systolic (mmHg)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 120"
                      value={formSystolic}
                      onChange={(e) => setFormSystolic(e.target.value)}
                      className="input-field w-full"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Diastolic (mmHg)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 80"
                      value={formDiastolic}
                      onChange={(e) => setFormDiastolic(e.target.value)}
                      className="input-field w-full"
                      required
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Measured Value
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="Value"
                      value={formNumeric}
                      onChange={(e) => setFormNumeric(e.target.value)}
                      className="input-field w-full"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Unit</label>
                    <input
                      type="text"
                      value={formUnit}
                      onChange={(e) => setFormUnit(e.target.value)}
                      className="input-field w-full"
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes / Context (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Morning resting, after breakfast"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="input-field w-full"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary text-sm disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Reading"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-teal-600" />
                <h3 className="text-lg font-bold text-slate-900">Import CSV Readings</h3>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Upload exports from smart blood pressure monitors, glucometers, or digital scales.
              Rows with errors are safely skipped.
            </p>

            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-lg">
                {errorMsg}
              </div>
            )}

            {importResult ? (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-emerald-900 text-sm">
                      CSV Import Complete
                    </p>
                    <p className="text-xs text-emerald-700 mt-1">
                      Successfully imported <strong>{importResult.valid_rows}</strong> of{" "}
                      <strong>{importResult.total_rows}</strong> rows from{" "}
                      <em>{importResult.filename}</em>.
                    </p>
                  </div>
                </div>

                {importResult.invalid_rows > 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
                    <p className="font-semibold text-slate-700 mb-1">
                      Skipped Rows ({importResult.invalid_rows}):
                    </p>
                    <ul className="list-disc list-inside text-slate-500 space-y-0.5 max-h-32 overflow-y-auto">
                      {importResult.errors.map((err: any, i: number) => (
                        <li key={i}>
                          Row {err.row_number || i + 1}: {err.error || JSON.stringify(err)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setImportResult(null);
                    }}
                    className="btn-primary text-sm"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCsvImport} className="space-y-4">
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-teal-500 transition-colors">
                  <input
                    type="file"
                    accept=".csv"
                    id="csv-upload"
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                    className="hidden"
                    required
                  />
                  <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center">
                    <Upload className="h-8 w-8 text-slate-400 mb-2" />
                    <span className="text-sm font-semibold text-slate-700">
                      {csvFile ? csvFile.name : "Choose CSV file to upload"}
                    </span>
                    <span className="text-xs text-slate-400 mt-1">
                      {csvFile
                        ? `${(csvFile.size / 1024).toFixed(1)} KB`
                        : "Drag & drop or browse from computer"}
                    </span>
                  </label>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 p-3 rounded-lg">
                  <span>Need the standard CSV format template?</span>
                  <button
                    type="button"
                    onClick={downloadSampleCsv}
                    className="text-teal-700 hover:text-teal-800 font-semibold flex items-center gap-1"
                  >
                    <Download className="h-3.5 w-3.5" /> Download Template
                  </button>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowImportModal(false)}
                    className="btn-secondary text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!csvFile || submitting}
                    className="btn-primary text-sm disabled:opacity-50 flex items-center gap-2"
                  >
                    {submitting ? "Processing..." : "Import Readings"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
