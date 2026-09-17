"use client";

import React, { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { BodyMapSvg } from "@/components/intake/BodyMapSvg";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  GitCommit,
  HelpCircle,
  History,
  Mic,
  MicOff,
  Send,
  ShieldAlert,
  Sparkles,
  User,
} from "lucide-react";
import { formatDateTime, cn } from "@/lib/utils";

export default function IntakePage() {
  const [encounters, setEncounters] = useState<any[]>([]);
  const [currentEncounterId, setCurrentEncounterId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [structuredData, setStructuredData] = useState<any>({});
  const [nextQuestions, setNextQuestions] = useState<string[]>([]);
  const [redFlags, setRedFlags] = useState<any[]>([]);
  const [redThreadInsights, setRedThreadInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadEncounters();
  }, []);

  const loadEncounters = async () => {
    try {
      const data = await api.getIntakeEncounters();
      setEncounters(data);
      if (data.length > 0 && !currentEncounterId) {
        selectEncounter(data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const selectEncounter = async (id: string) => {
    setCurrentEncounterId(id);
    try {
      const enc = await api.getIntakeEncounter(id);
      setStructuredData(enc.structured_data || {});
      const msgs = await api.getIntakeMessages(id);
      setMessages(msgs);

      if (enc.chief_complaint) {
        queryHistory(enc.chief_complaint, enc.structured_data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const queryHistory = async (complaint: string, struct?: any) => {
    try {
      const res = await api.queryRedThread({
        current_complaint: complaint,
        structured_data: struct,
      });
      setRedThreadInsights(res.insights || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || loading) return;

    const userMsg = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputText("");
    setLoading(true);

    try {
      const res = await api.processIntake({
        encounter_id: currentEncounterId || undefined,
        text,
      });

      if (!currentEncounterId) {
        setCurrentEncounterId(res.encounter_id);
      }

      setStructuredData(res.structured || {});
      setNextQuestions(res.next_questions || []);
      setRedFlags(res.red_flags || []);

      const assistantMsg = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: res.urgent
          ? "URGENT WARNING: " + res.red_flags.map((f: any) => f.message).join(" ")
          : res.next_questions.length > 0
          ? res.next_questions.join("\n")
          : "Intake details captured. Your responses have been organized for clinical review.",
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Query Red-Thread
      if (res.structured?.chief_complaint || text) {
        queryHistory(res.structured?.chief_complaint || text, res.structured);
      }

      loadEncounters();
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  };

  const handleStartNewEncounter = () => {
    setCurrentEncounterId(null);
    setMessages([]);
    setStructuredData({});
    setNextQuestions([]);
    setRedFlags([]);
    setRedThreadInsights([]);
  };

  // Web Speech API Microphone Handler
  const toggleVoiceInput = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Google Chrome or Edge.");
      return;
    }

    if (listening) {
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputText((prev) => (prev ? prev + " " + transcript : transcript));
    };

    recognition.start();
  };

  const handleBodyMapAnnotation = async (anno: any) => {
    if (currentEncounterId) {
      try {
        await api.addBodyMapAnnotation(currentEncounterId, anno);
      } catch (err) {
        console.error(err);
      }
    }
    // Also inject as intake context
    const bodyText = `Location: ${anno.laterality ? anno.laterality + " " : ""}${anno.body_part}, feeling ${anno.pain_type} (${anno.severity}).`;
    handleSendMessage(bodyText);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Multimodal Symptom Intake Engine
          </h1>
          <p className="text-xs text-slate-500">
            Interactive clinical scribe • Conversational questioning • 2D Body Map • Red-Thread correlation
          </p>
        </div>

        <div className="flex items-center gap-2">
          {encounters.length > 0 && (
            <select
              value={currentEncounterId || ""}
              onChange={(e) => {
                if (e.target.value) selectEncounter(e.target.value);
                else handleStartNewEncounter();
              }}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="">+ Start New Session</option>
              {encounters.map((enc) => (
                <option key={enc.id} value={enc.id}>
                  {enc.chief_complaint ? enc.chief_complaint.slice(0, 35) : "Session"} (
                  {formatDateTime(enc.created_at)})
                </option>
              ))}
            </select>
          )}

          <button
            onClick={handleStartNewEncounter}
            className="rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 transition-colors"
          >
            + New Intake
          </button>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Chat Conversation Stream (7 cols) */}
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 lg:col-span-7 h-[700px]">
          {/* Chat Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  MediKiosk Clinical Scribe
                </h3>
                <p className="text-[10px] text-teal-700 dark:text-teal-400">
                  Structured JSON constraint • Adaptive questioning
                </p>
              </div>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              Non-Diagnostic
            </span>
          </div>

          {/* Urgent Emergency Warning Banner inside chat if active */}
          {redFlags.length > 0 && (
            <div className="border-b border-rose-200 bg-rose-50 p-4 dark:border-rose-900/60 dark:bg-rose-950/40">
              <div className="flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 shrink-0 text-rose-600" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-200">
                    Urgent Clinical Red Flag Warning
                  </h4>
                  {redFlags.map((f: any, idx: number) => (
                    <p key={idx} className="text-xs text-rose-700 dark:text-rose-300 font-medium">
                      {f.message}
                    </p>
                  ))}
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 pt-1">
                    Please stop and seek immediate emergency medical care.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Messages Stream */}
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h4 className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">
                  What brings you here today?
                </h4>
                <p className="mt-1 max-w-sm text-xs text-slate-500">
                  You can speak, type, or tap the body map on the right. For example:{" "}
                  <span className="italic">"I have had a throbbing headache for 3 days."</span>
                </p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-start gap-2.5",
                    msg.role === "user" ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      msg.role === "user"
                        ? "bg-slate-800 text-white dark:bg-slate-700"
                        : "bg-teal-700 text-white"
                    )}
                  >
                    {msg.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                  </div>

                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl p-3.5 text-xs shadow-xs",
                      msg.role === "user"
                        ? "bg-teal-700 text-white rounded-tr-none"
                        : msg.content.startsWith("URGENT")
                        ? "bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-200"
                        : "bg-slate-100 text-slate-900 rounded-tl-none dark:bg-slate-800 dark:text-slate-100"
                    )}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    <span className="mt-1.5 block text-[9px] opacity-70">
                      {formatDateTime(msg.created_at)}
                    </span>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Next Questions Suggestion Chips */}
          {nextQuestions.length > 0 && (
            <div className="border-t border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/30">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Quick Follow-up Responses
              </p>
              <div className="flex flex-wrap gap-1.5">
                {nextQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(q)}
                    className="rounded-lg border border-teal-200 bg-white px-2.5 py-1 text-[11px] font-medium text-teal-800 hover:bg-teal-50 dark:border-teal-900 dark:bg-slate-800 dark:text-teal-300"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat Input Bar */}
          <div className="border-t border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleVoiceInput}
                title={listening ? "Listening... click to stop" : "Speak symptom (Web Speech API)"}
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors",
                  listening
                    ? "border-rose-300 bg-rose-50 text-rose-600 animate-pulse dark:bg-rose-950/50"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                )}
              >
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={listening ? "Listening to your voice..." : "Describe symptoms, duration, or onset..."}
                className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />

              <button
                onClick={() => handleSendMessage()}
                disabled={loading || !inputText.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-white hover:bg-teal-800 transition-colors disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: 2D Body Map + Live Structured Extract + Red-Thread (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          {/* 1. 2D Interactive Body Map */}
          <BodyMapSvg
            encounterId={currentEncounterId}
            onSaveAnnotation={handleBodyMapAnnotation}
          />

          {/* 2. Structured Intake Extraction Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  Live Structured Clinical Extract
                </h3>
              </div>
              <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                JSON Bound
              </span>
            </div>

            <div className="mt-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between border-b border-slate-50 py-1 dark:border-slate-800/50">
                <span className="font-medium text-slate-400">Chief Complaint:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {structuredData.chief_complaint || "Pending capture"}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-50 py-1 dark:border-slate-800/50">
                <span className="font-medium text-slate-400">Duration:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {structuredData.duration || "Not specified"}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-50 py-1 dark:border-slate-800/50">
                <span className="font-medium text-slate-400">Severity:</span>
                <span className="font-bold capitalize text-slate-800 dark:text-slate-200">
                  {structuredData.severity || "Not specified"}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-50 py-1 dark:border-slate-800/50">
                <span className="font-medium text-slate-400">Onset:</span>
                <span className="font-bold capitalize text-slate-800 dark:text-slate-200">
                  {structuredData.onset || "Not specified"}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-50 py-1 dark:border-slate-800/50">
                <span className="font-medium text-slate-400">Location:</span>
                <span className="font-bold capitalize text-slate-800 dark:text-slate-200">
                  {structuredData.location?.body_region
                    ? `${structuredData.location.laterality ? structuredData.location.laterality + " " : ""}${structuredData.location.body_region}`
                    : "Not specified"}
                </span>
              </div>
              {structuredData.associated_symptoms?.length > 0 && (
                <div className="py-1">
                  <span className="font-medium text-slate-400 block mb-1">Associated Symptoms:</span>
                  <div className="flex flex-wrap gap-1">
                    {structuredData.associated_symptoms.map((s: string, i: number) => (
                      <span
                        key={i}
                        className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3. Red-Thread Intelligence Box */}
          <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-5 shadow-xs dark:border-teal-900/60 dark:bg-teal-950/20">
            <div className="flex items-center justify-between border-b border-teal-200/60 pb-3 dark:border-teal-900/40">
              <div className="flex items-center gap-2">
                <GitCommit className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-teal-950 dark:text-teal-200">
                  Red-Thread Historical Context
                </h3>
              </div>
              <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-800 dark:bg-teal-900 dark:text-teal-300">
                pgvector
              </span>
            </div>

            <div className="mt-3 space-y-2.5">
              {redThreadInsights.length > 0 ? (
                redThreadInsights.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-teal-200/70 bg-white p-3 shadow-2xs dark:border-teal-900/60 dark:bg-slate-900"
                  >
                    <div className="flex items-center justify-between text-[10px] font-bold text-teal-800 dark:text-teal-300">
                      <span>{item.source_reference}</span>
                      <span>{item.event_date ? formatDateTime(item.event_date) : ""}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-700 dark:text-slate-300 italic">
                      "{item.cautious_explanation}"
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500">
                  The Red-Thread engine cross-references your current complaint against past conditions, visits, and medications using semantic embeddings to surface relevant context for your doctor.
                </p>
              )}

              <p className="text-[10px] text-slate-400 pt-1 border-t border-teal-100 dark:border-teal-900/40">
                Safety Note: Historical correlations highlight context only and do not establish medical causation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
