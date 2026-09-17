"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Calendar,
  CheckCircle2,
  FileText,
  HeartPulse,
  Pill,
  Plus,
  Shield,
  Trash2,
  User,
  X,
} from "lucide-react";
import { formatDate, cn } from "@/lib/utils";

export default function VaultPage() {
  const [activeTab, setActiveTab] = useState<"profile" | "conditions" | "allergies" | "medications" | "visits">("profile");
  const [profile, setProfile] = useState<any>(null);
  const [conditions, setConditions] = useState<any[]>([]);
  const [allergies, setAllergies] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemData, setNewItemData] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadVaultData();
  }, []);

  const loadVaultData = async () => {
    try {
      setLoading(true);
      const [p, c, a, m, v] = await Promise.all([
        api.getProfile().catch(() => null),
        api.getConditions().catch(() => []),
        api.getAllergies().catch(() => []),
        api.getMedications().catch(() => []),
        api.getVisits().catch(() => []),
      ]);
      setProfile(p);
      setConditions(c);
      setAllergies(a);
      setMedications(m);
      setVisits(v);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.updateProfile(profile);
      setProfile(updated);
      alert("Profile updated successfully.");
    } catch (err: any) {
      alert(err.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (activeTab === "conditions") {
        await api.createCondition(newItemData);
        setConditions(await api.getConditions());
      } else if (activeTab === "allergies") {
        await api.createAllergy(newItemData);
        setAllergies(await api.getAllergies());
      } else if (activeTab === "medications") {
        await api.createMedication(newItemData);
        setMedications(await api.getMedications());
      } else if (activeTab === "visits") {
        await api.createVisit(newItemData);
        setVisits(await api.getVisits());
      }
      setShowAddModal(false);
      setNewItemData({});
    } catch (err: any) {
      alert(err.message || "Failed to save record.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (type: string, id: string) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    try {
      if (type === "condition") {
        await api.deleteCondition(id);
        setConditions(conditions.filter((c) => c.id !== id));
      } else if (type === "allergy") {
        await api.deleteAllergy(id);
        setAllergies(allergies.filter((a) => a.id !== id));
      } else if (type === "medication") {
        await api.deleteMedication(id);
        setMedications(medications.filter((m) => m.id !== id));
      } else if (type === "visit") {
        await api.deleteVisit(id);
        setVisits(visits.filter((v) => v.id !== id));
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete record.");
    }
  };

  const TABS = [
    { id: "profile", label: "Patient Profile", icon: User, count: profile ? 1 : 0 },
    { id: "conditions", label: "Chronic Conditions", icon: Shield, count: conditions.length },
    { id: "allergies", label: "Allergies", icon: HeartPulse, count: allergies.length },
    { id: "medications", label: "Medications", icon: Pill, count: medications.length },
    { id: "visits", label: "Past Visits", icon: Calendar, count: visits.length },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Personal Health Vault
          </h1>
          <p className="text-xs text-slate-500">
            Encrypted local-first repository • Verified clinical records • User-controlled governance
          </p>
        </div>

        {activeTab !== "profile" && (
          <button
            onClick={() => {
              setNewItemData({});
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 shadow-xs transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add {activeTab.slice(0, -1)}</span>
          </button>
        )}
      </div>

      {/* Tabs Row */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-2 dark:border-slate-800">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors whitespace-nowrap",
                isActive
                  ? "border-teal-700 text-teal-800 dark:border-teal-400 dark:text-teal-300"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold",
                  isActive
                    ? "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                )}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Profile */}
      {activeTab === "profile" && (
        <form onSubmit={handleSaveProfile} className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Demographic & Emergency Contact
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Full Name</label>
              <input
                type="text"
                value={profile?.full_name || ""}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Date of Birth</label>
              <input
                type="date"
                value={profile?.date_of_birth || ""}
                onChange={(e) => setProfile({ ...profile, date_of_birth: e.target.value })}
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Biological Sex</label>
              <select
                value={profile?.sex || ""}
                onChange={(e) => setProfile({ ...profile, sex: e.target.value })}
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Select</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Blood Group</label>
              <input
                type="text"
                placeholder="e.g. O+"
                value={profile?.blood_group || ""}
                onChange={(e) => setProfile({ ...profile, blood_group: e.target.value })}
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Emergency Contact Name</label>
              <input
                type="text"
                value={profile?.emergency_contact_name || ""}
                onChange={(e) => setProfile({ ...profile, emergency_contact_name: e.target.value })}
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Emergency Phone</label>
              <input
                type="text"
                value={profile?.emergency_contact_phone || ""}
                onChange={(e) => setProfile({ ...profile, emergency_contact_phone: e.target.value })}
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Medical Notes for Doctor</label>
            <textarea
              rows={3}
              value={profile?.medical_notes || ""}
              onChange={(e) => setProfile({ ...profile, medical_notes: e.target.value })}
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
          >
            {saving ? "Saving..." : "Save Profile Details"}
          </button>
        </form>
      )}

      {/* Tab 2: Conditions */}
      {activeTab === "conditions" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {conditions.map((c) => (
            <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">{c.name}</h4>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", c.status === "active" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-100 text-slate-600")}>
                    {c.status}
                  </span>
                </div>
                {c.diagnosed_date && (
                  <p className="mt-1 text-xs text-slate-500">Diagnosed: {formatDate(c.diagnosed_date)}</p>
                )}
                {c.notes && <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">{c.notes}</p>}
              </div>
              <div className="mt-4 flex justify-end border-t border-slate-100 pt-3 dark:border-slate-800">
                <button
                  onClick={() => handleDelete("condition", c.id)}
                  className="text-slate-400 hover:text-rose-600 text-xs flex items-center gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
          {conditions.length === 0 && (
            <p className="col-span-3 py-8 text-center text-xs text-slate-400">No chronic conditions recorded.</p>
          )}
        </div>
      )}

      {/* Tab 3: Allergies */}
      {activeTab === "allergies" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {allergies.map((a) => (
            <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">{a.allergen}</h4>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", a.severity === "severe" ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200" : "bg-amber-100 text-amber-800")}>
                    {a.severity}
                  </span>
                </div>
                {a.reaction_type && <p className="mt-1 text-xs text-slate-500">Reaction: {a.reaction_type}</p>}
                {a.notes && <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">{a.notes}</p>}
              </div>
              <div className="mt-4 flex justify-end border-t border-slate-100 pt-3 dark:border-slate-800">
                <button
                  onClick={() => handleDelete("allergy", a.id)}
                  className="text-slate-400 hover:text-rose-600 text-xs flex items-center gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
          {allergies.length === 0 && (
            <p className="col-span-3 py-8 text-center text-xs text-slate-400">No allergies recorded.</p>
          )}
        </div>
      )}

      {/* Tab 4: Medications */}
      {activeTab === "medications" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {medications.map((m) => (
            <div key={m.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {m.drug_name} {m.dosage}
                  </h4>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", m.is_active ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-100 text-slate-600")}>
                    {m.is_active ? "Active" : "Discontinued"}
                  </span>
                </div>
                {m.frequency && <p className="mt-1 text-xs text-slate-500">Frequency: {m.frequency}</p>}
                {m.route && <p className="text-xs text-slate-500">Route: {m.route}</p>}
                {m.start_date && <p className="text-xs text-slate-500">Started: {formatDate(m.start_date)}</p>}
              </div>
              <div className="mt-4 flex justify-end border-t border-slate-100 pt-3 dark:border-slate-800">
                <button
                  onClick={() => handleDelete("medication", m.id)}
                  className="text-slate-400 hover:text-rose-600 text-xs flex items-center gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
          {medications.length === 0 && (
            <p className="col-span-3 py-8 text-center text-xs text-slate-400">No medications recorded.</p>
          )}
        </div>
      )}

      {/* Tab 5: Visits */}
      {activeTab === "visits" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {visits.map((v) => (
            <div key={v.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">{v.provider_name || "Doctor Visit"}</h4>
                  <span className="text-xs font-semibold text-teal-700 dark:text-teal-400">
                    {formatDate(v.visit_date)}
                  </span>
                </div>
                {v.facility_name && <p className="mt-1 text-xs text-slate-500">Facility: {v.facility_name}</p>}
                {v.reason && <p className="mt-2 text-xs text-slate-700 dark:text-slate-300"><strong>Reason:</strong> {v.reason}</p>}
                {v.diagnosis && <p className="text-xs text-slate-700 dark:text-slate-300"><strong>Diagnosis:</strong> {v.diagnosis}</p>}
              </div>
              <div className="mt-4 flex justify-end border-t border-slate-100 pt-3 dark:border-slate-800">
                <button
                  onClick={() => handleDelete("visit", v.id)}
                  className="text-slate-400 hover:text-rose-600 text-xs flex items-center gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
          {visits.length === 0 && (
            <p className="col-span-2 py-8 text-center text-xs text-slate-400">No doctor visits recorded.</p>
          )}
        </div>
      )}

      {/* Generic Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 dark:border dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Add New {activeTab.slice(0, -1)}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="mt-4 space-y-3">
              {activeTab === "conditions" && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Condition Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Type 2 Diabetes"
                      value={newItemData.name || ""}
                      onChange={(e) => setNewItemData({ ...newItemData, name: e.target.value })}
                      className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Diagnosed Date</label>
                    <input
                      type="date"
                      value={newItemData.diagnosed_date || ""}
                      onChange={(e) => setNewItemData({ ...newItemData, diagnosed_date: e.target.value })}
                      className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Notes</label>
                    <textarea
                      rows={2}
                      value={newItemData.notes || ""}
                      onChange={(e) => setNewItemData({ ...newItemData, notes: e.target.value })}
                      className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </>
              )}

              {activeTab === "allergies" && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Allergen</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Penicillin"
                      value={newItemData.allergen || ""}
                      onChange={(e) => setNewItemData({ ...newItemData, allergen: e.target.value })}
                      className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Severity</label>
                    <select
                      value={newItemData.severity || "moderate"}
                      onChange={(e) => setNewItemData({ ...newItemData, severity: e.target.value })}
                      className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="mild">Mild</option>
                      <option value="moderate">Moderate</option>
                      <option value="severe">Severe (Anaphylaxis)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Reaction Type</label>
                    <input
                      type="text"
                      placeholder="e.g. Hives, Swelling"
                      value={newItemData.reaction_type || ""}
                      onChange={(e) => setNewItemData({ ...newItemData, reaction_type: e.target.value })}
                      className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </>
              )}

              {activeTab === "medications" && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Drug Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Metformin"
                      value={newItemData.drug_name || ""}
                      onChange={(e) => setNewItemData({ ...newItemData, drug_name: e.target.value })}
                      className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Dosage</label>
                      <input
                        type="text"
                        placeholder="e.g. 500mg"
                        value={newItemData.dosage || ""}
                        onChange={(e) => setNewItemData({ ...newItemData, dosage: e.target.value })}
                        className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Frequency</label>
                      <input
                        type="text"
                        placeholder="e.g. Twice daily"
                        value={newItemData.frequency || ""}
                        onChange={(e) => setNewItemData({ ...newItemData, frequency: e.target.value })}
                        className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>
                </>
              )}

              {activeTab === "visits" && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Doctor / Provider Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dr. Sterling"
                      value={newItemData.provider_name || ""}
                      onChange={(e) => setNewItemData({ ...newItemData, provider_name: e.target.value })}
                      className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Visit Date</label>
                    <input
                      type="date"
                      required
                      value={newItemData.visit_date || ""}
                      onChange={(e) => setNewItemData({ ...newItemData, visit_date: e.target.value })}
                      className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Reason / Diagnosis</label>
                    <input
                      type="text"
                      placeholder="e.g. Routine consultation"
                      value={newItemData.reason || ""}
                      onChange={(e) => setNewItemData({ ...newItemData, reason: e.target.value })}
                      className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
                >
                  {saving ? "Saving..." : "Save Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
