"use client";

import React, { useState } from "react";
import { Check, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface BodyMapSvgProps {
  encounterId?: string | null;
  onSaveAnnotation?: (annotation: {
    body_part: string;
    laterality?: string;
    pain_type?: string;
    severity?: string;
  }) => void;
}

const REGIONS = [
  { id: "head", label: "Head", view: "front", cx: 100, cy: 30, r: 18 },
  { id: "neck", label: "Neck", view: "front", x: 92, y: 50, w: 16, h: 14, rx: 4 },
  { id: "chest", label: "Chest", view: "front", x: 75, y: 66, w: 50, h: 32, rx: 6 },
  { id: "abdomen", label: "Abdomen", view: "front", x: 78, y: 100, w: 44, h: 32, rx: 6 },
  { id: "pelvis", label: "Pelvis / Groin", view: "front", x: 80, y: 134, w: 40, h: 22, rx: 6 },
  // Arms Front
  { id: "arm_left", label: "Left Arm", view: "front", x: 130, y: 72, w: 14, h: 54, rx: 6 },
  { id: "arm_right", label: "Right Arm", view: "front", x: 56, y: 72, w: 14, h: 54, rx: 6 },
  { id: "hand_left", label: "Left Hand", view: "front", x: 130, y: 130, w: 14, h: 18, rx: 4 },
  { id: "hand_right", label: "Right Hand", view: "front", x: 56, y: 130, w: 14, h: 18, rx: 4 },
  // Legs Front
  { id: "leg_left", label: "Left Thigh", view: "front", x: 102, y: 160, w: 18, h: 50, rx: 6 },
  { id: "leg_right", label: "Right Thigh", view: "front", x: 80, y: 160, w: 18, h: 50, rx: 6 },
  { id: "knee_left", label: "Left Knee", view: "front", cx: 111, cy: 218, r: 9 },
  { id: "knee_right", label: "Right Knee", view: "front", cx: 89, cy: 218, r: 9 },
  { id: "foot_left", label: "Left Foot", view: "front", x: 103, y: 264, w: 18, h: 12, rx: 4 },
  { id: "foot_right", label: "Right Foot", view: "front", x: 79, y: 264, w: 18, h: 12, rx: 4 },

  // BACK VIEW
  { id: "back_head", label: "Back of Head", view: "back", cx: 100, cy: 30, r: 18 },
  { id: "upper_back", label: "Upper Back", view: "back", x: 75, y: 64, w: 50, h: 36, rx: 6 },
  { id: "lower_back", label: "Lower Back / Spine", view: "back", x: 78, y: 102, w: 44, h: 32, rx: 6 },
  { id: "glutes", label: "Glutes / Pelvis", view: "back", x: 78, y: 136, w: 44, h: 22, rx: 6 },
  { id: "arm_left_back", label: "Left Arm (Back)", view: "back", x: 56, y: 72, w: 14, h: 54, rx: 6 },
  { id: "arm_right_back", label: "Right Arm (Back)", view: "back", x: 130, y: 72, w: 14, h: 54, rx: 6 },
  { id: "leg_left_back", label: "Left Calf (Back)", view: "back", x: 80, y: 224, w: 18, h: 42, rx: 6 },
  { id: "leg_right_back", label: "Right Calf (Back)", view: "back", x: 102, y: 224, w: 18, h: 42, rx: 6 },
];

const PAIN_TYPES = ["sharp", "dull", "throbbing", "burning", "cramping", "pressure"];
const LATERALITIES = ["left", "right", "bilateral", "midline"];
const SEVERITIES = ["mild", "moderate", "severe"];

export function BodyMapSvg({ encounterId, onSaveAnnotation }: BodyMapSvgProps) {
  const [view, setView] = useState<"front" | "back">("front");
  const [selectedRegion, setSelectedRegion] = useState<string | null>("head");
  const [laterality, setLaterality] = useState<string>("bilateral");
  const [painType, setPainType] = useState<string>("throbbing");
  const [severity, setSeverity] = useState<string>("moderate");
  const [savedSuccess, setSavedSuccess] = useState(false);

  const currentRegions = REGIONS.filter((r) => r.view === view);

  const handleSave = () => {
    if (!selectedRegion) return;
    const bodyPartClean = selectedRegion.replace("_left", "").replace("_right", "").replace("_back", "");

    if (onSaveAnnotation) {
      onSaveAnnotation({
        body_part: bodyPartClean,
        laterality,
        pain_type: painType,
        severity,
      });
    }

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const selectedRegionObj = REGIONS.find((r) => r.id === selectedRegion);

  return (
    <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      {/* Header & View Toggle */}
      <div className="flex w-full items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
            2D Interactive Body Map
          </h3>
          <p className="text-[11px] text-slate-400">Tap area of pain or symptom</p>
        </div>
        <button
          onClick={() => setView(view === "front" ? "back" : "front")}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          <RotateCw className="h-3.5 w-3.5 text-teal-600" />
          <span>Switch to {view === "front" ? "Back View" : "Front View"}</span>
        </button>
      </div>

      {/* SVG Container */}
      <div className="relative my-4 flex h-72 w-52 items-center justify-center rounded-2xl bg-slate-50/70 p-2 dark:bg-slate-950/40">
        <svg
          viewBox="0 0 200 290"
          className="h-full w-full select-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Subtle anatomical guide silhouette */}
          <path
            d="M 100 12 C 112 12 120 22 120 32 C 120 44 112 50 108 52 C 124 58 136 68 144 80 L 152 140 L 138 142 L 134 94 L 126 94 L 126 154 L 122 216 L 124 266 L 108 266 L 104 220 L 102 160 L 98 160 L 96 220 L 92 266 L 76 266 L 78 216 L 74 154 L 74 94 L 66 94 L 62 142 L 48 140 L 56 80 C 64 68 76 58 92 52 C 88 50 80 44 80 32 C 80 22 88 12 100 12 Z"
            fill="#E2E8F0"
            className="dark:fill-slate-800 opacity-60 transition-colors"
          />

          {/* Interactive clickable regions */}
          {currentRegions.map((r) => {
            const isSelected = selectedRegion === r.id;

            if (r.r !== undefined) {
              return (
                <circle
                  key={r.id}
                  cx={r.cx}
                  cy={r.cy}
                  r={r.r}
                  onClick={() => setSelectedRegion(r.id)}
                  className={cn(
                    "cursor-pointer transition-all duration-200 stroke-1",
                    isSelected
                      ? "fill-teal-600 stroke-teal-800 dark:fill-teal-500 shadow-md"
                      : "fill-teal-100/70 stroke-teal-300 hover:fill-teal-300 dark:fill-teal-950/50 dark:stroke-teal-800"
                  )}
                />
              );
            }

            return (
              <rect
                key={r.id}
                x={r.x}
                y={r.y}
                width={r.w}
                height={r.h}
                rx={r.rx || 4}
                onClick={() => setSelectedRegion(r.id)}
                className={cn(
                  "cursor-pointer transition-all duration-200 stroke-1",
                  isSelected
                    ? "fill-teal-600 stroke-teal-800 dark:fill-teal-500 shadow-md"
                    : "fill-teal-100/70 stroke-teal-300 hover:fill-teal-300 dark:fill-teal-950/50 dark:stroke-teal-800"
                )}
              />
            );
          })}
        </svg>

        {/* Selected badge */}
        <div className="absolute bottom-2 left-2 rounded-lg bg-white/90 px-2 py-0.5 text-[10px] font-bold text-teal-800 shadow-xs backdrop-blur-xs dark:bg-slate-900/90 dark:text-teal-300">
          Selected: {selectedRegionObj?.label || "None"}
        </div>
      </div>

      {/* Region Attributes Controls */}
      <div className="w-full space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800">
        {/* Laterality */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Laterality
          </label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {LATERALITIES.map((lat) => (
              <button
                key={lat}
                onClick={() => setLaterality(lat)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors",
                  laterality === lat
                    ? "bg-teal-700 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                )}
              >
                {lat}
              </button>
            ))}
          </div>
        </div>

        {/* Pain Type */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Sensation / Pain Type
          </label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {PAIN_TYPES.map((pt) => (
              <button
                key={pt}
                onClick={() => setPainType(pt)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors",
                  painType === pt
                    ? "bg-teal-700 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                )}
              >
                {pt}
              </button>
            ))}
          </div>
        </div>

        {/* Severity */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Severity
          </label>
          <div className="mt-1 flex gap-1.5">
            {SEVERITIES.map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverity(sev)}
                className={cn(
                  "flex-1 rounded-lg py-1 text-[11px] font-semibold capitalize transition-colors text-center",
                  severity === sev
                    ? sev === "severe"
                      ? "bg-rose-600 text-white"
                      : "bg-teal-700 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                )}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        {/* Save Annotation */}
        <button
          onClick={handleSave}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-teal-700 py-2 text-xs font-bold text-white shadow-xs hover:bg-teal-800 transition-colors"
        >
          {savedSuccess ? (
            <>
              <Check className="h-4 w-4" />
              <span>Location Attached to Intake!</span>
            </>
          ) : (
            <span>Attach {selectedRegionObj?.label || "Location"} to Symptom Intake</span>
          )}
        </button>
      </div>
    </div>
  );
}
