import json
import re

import httpx

from app.core.config import settings


EXTRACTION_PROMPT = """
You are a medical document extraction assistant.

You are not diagnosing. You are only extracting structured information from OCR text.

Return ONLY valid JSON.
No markdown.
No explanations.

Use this schema:

{
  "document_type": "prescription | lab_report | discharge_summary | other",
  "document_date": "YYYY-MM-DD or null",
  "provider_name": "string or null",
  "medications": [
    {
      "name": "string or null",
      "dosage": "string or null",
      "unit": "string or null",
      "frequency": "string or null",
      "duration": "string or null",
      "route": "string or null",
      "raw_text": "string or null"
    }
  ],
  "lab_results": [
    {
      "test_name": "string or null",
      "value": "string or null",
      "unit": "string or null",
      "reference_range": "string or null",
      "raw_text": "string or null"
    }
  ],
  "notes": "string or null",
  "confidence": 0.0
}

Rules:
- If unsure, use null.
- Do not invent information.
- Confidence must be between 0 and 1.
- Keep raw_text short.
"""


def _clean_json_text(text: str) -> str:
    text = text.strip()

    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*", "", text)
        text = re.sub(r"```$", "", text)

    start = text.find("{")
    end = text.rfind("}") + 1

    if start != -1 and end > start:
        text = text[start:end]

    return text.strip()


def _as_str(value):
    if value is None:
        return None

    value = str(value).strip()

    if not value or value.lower() in {"null", "none", "n/a", "na"}:
        return None

    return value


def _as_list(value):
    if isinstance(value, list):
        return value

    return []


def _as_float(value):
    try:
        result = float(value)
    except Exception:
        return 0.25

    if result < 0:
        return 0.0

    if result > 1:
        return 1.0

    return result


def _heuristic_extraction(ocr_text: str) -> dict:
    lines = [line.strip() for line in ocr_text.splitlines() if line.strip()]

    medications = []
    lab_results = []

    medication_pattern = re.compile(
        r"(?i)\b\d+(?:\.\d+)?\s?(?:mg|mcg|g|ml|iu|units?)\b"
    )

    lab_pattern = re.compile(
        r"([A-Za-z][A-Za-z0-9 /()%-]{2,60})[:\t]+([\d.]+)\s*([A-Za-z/%]+)?"
    )

    date_pattern = re.compile(
        r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b"
    )

    provider_pattern = re.compile(
        r"(?i)(dr\.?\s+[A-Za-z][A-Za-z.\s]{2,60})"
    )

    document_date = None
    provider_name = None

    date_match = date_pattern.search(ocr_text)
    if date_match:
        document_date = date_match.group(1)

    provider_match = provider_pattern.search(ocr_text)
    if provider_match:
        provider_name = provider_match.group(1).strip()

    lowered = ocr_text.lower()

    if any(word in lowered for word in ["rx", "prescription", "tablet", "tab", "capsule", "syrup"]):
        document_type = "prescription"
    elif any(word in lowered for word in ["lab", "report", "test", "hba1c", "cbc", "lipid"]):
        document_type = "lab_report"
    elif "discharge" in lowered:
        document_type = "discharge_summary"
    else:
        document_type = "other"

    for line in lines:
        med_match = medication_pattern.search(line)

        if med_match:
            dosage = med_match.group(0).strip()
            name = line[:med_match.start()].strip(" -:–")

            medications.append({
                "name": name or None,
                "dosage": dosage,
                "unit": None,
                "frequency": None,
                "duration": None,
                "route": None,
                "raw_text": line[:300],
            })

            continue

        lab_match = lab_pattern.match(line)
        if lab_match:
            lab_results.append({
                "test_name": lab_match.group(1).strip(),
                "value": lab_match.group(2).strip(),
                "unit": lab_match.group(3).strip() if lab_match.group(3) else None,
                "reference_range": None,
                "raw_text": line[:300],
            })

    confidence = 0.25
    confidence += min(0.15, (len(medications) + len(lab_results)) * 0.03)

    return {
        "document_type": document_type,
        "document_date": document_date,
        "provider_name": provider_name,
        "medications": medications,
        "lab_results": lab_results,
        "notes": None,
        "confidence": confidence,
    }


def _gemini_extraction(ocr_text: str) -> dict:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent"

    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": EXTRACTION_PROMPT + "\n\nOCR TEXT:\n" + ocr_text[:12000]
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0,
            "maxOutputTokens": 8192,
            "responseMimeType": "application/json",
        },
    }

    params = {
        "key": settings.gemini_api_key,
    }

    with httpx.Client(timeout=90.0) as client:
        response = client.post(url, json=payload, params=params)
        response.raise_for_status()

    data = response.json()

    text = (
        data.get("candidates", [{}])[0]
        .get("content", {})
        .get("parts", [{}])[0]
        .get("text", "")
    )

    cleaned = _clean_json_text(text)
    parsed = json.loads(cleaned)

    return parsed


def extract_document_fields(ocr_text: str, allow_ai: bool = True) -> dict:
    if not allow_ai or not settings.gemini_api_key:
        result = _heuristic_extraction(ocr_text)
    else:
        try:
            result = _gemini_extraction(ocr_text)
        except Exception:
            result = _heuristic_extraction(ocr_text)

    return {
        "document_type": _as_str(result.get("document_type")) or "other",
        "document_date": _as_str(result.get("document_date")),
        "provider_name": _as_str(result.get("provider_name")),
        "medications": _as_list(result.get("medications")),
        "lab_results": _as_list(result.get("lab_results")),
        "notes": _as_str(result.get("notes")),
        "confidence": _as_float(result.get("confidence", 0.25)),
    }