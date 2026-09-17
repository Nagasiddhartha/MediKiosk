import json
import re

import httpx

from app.core.config import settings


INTAKE_PROMPT = """
You are a medical intake scribe.

You are not a doctor.
Do not diagnose.
Do not prescribe.
Do not claim causation.

Extract structured symptom information from the user's message.

Return ONLY valid JSON.
No markdown.
No explanations.

Use this schema:

{
  "chief_complaint": "string or null",
  "symptom": "string or null",
  "duration": "string or null",
  "severity": "mild | moderate | severe | null",
  "onset": "sudden | gradual | null",
  "character": "string or null",
  "radiation": "string or null",
  "location": {
    "body_region": "string or null",
    "laterality": "left | right | bilateral | null"
  },
  "associated_symptoms": ["string"],
  "missing_fields": ["duration", "severity", "location", "onset", "associated_symptoms"]
}

Rules:
- Use null when unsure.
- Keep language cautious.
- Do not invent symptoms.
"""


BODY_REGIONS = [
    "head",
    "face",
    "eye",
    "ear",
    "neck",
    "throat",
    "chest",
    "abdomen",
    "back",
    "shoulder",
    "arm",
    "elbow",
    "hand",
    "hip",
    "leg",
    "knee",
    "ankle",
    "foot",
]


ASSOCIATED_SYMPTOM_MAP = {
    "fever": ["fever", "febrile"],
    "chills": ["chills"],
    "cough": ["cough"],
    "breathlessness": ["breathless", "shortness of breath", "difficulty breathing"],
    "sweating": ["sweating", "sweaty"],
    "nausea": ["nausea", "nauseous"],
    "vomiting": ["vomiting", "vomit"],
    "dizziness": ["dizzy", "dizziness"],
    "vision_changes": ["vision change", "vision changes", "blurry vision"],
    "neck_stiffness": ["neck stiffness", "stiff neck"],
    "rash": ["rash"],
    "diarrhea": ["diarrhea", "loose motion"],
    "fatigue": ["tired", "fatigue", "weakness"],
    "palpitations": ["palpitation", "palpitations"],
}


BASE_QUESTIONS = {
    "duration": "How long has this been going on?",
    "severity": "How severe is it (mild, moderate, severe)?",
    "location": "Where exactly do you feel it? You can also use the body map.",
    "onset": "Did it start suddenly or gradually?",
    "associated_symptoms": "Are there any other symptoms along with this?",
}


CATEGORY_KEYWORDS = {
    "chest_pain": ["chest pain", "chest pressure", "chest tightness"],
    "headache": ["headache", "head pain"],
    "cough": ["cough"],
    "abdominal_pain": ["abdominal pain", "stomach pain", "belly pain"],
    "joint_pain": ["joint pain", "knee pain", "ankle pain", "shoulder pain"],
    "fever": ["fever"],
    "dizziness": ["dizzy", "dizziness"],
    "rash": ["rash"],
    "diarrhea": ["diarrhea", "loose motion"],
    "sore_throat": ["sore throat", "throat pain"],
    "back_pain": ["back pain"],
}


CATEGORY_REQUIRED_FIELDS = {
    "chest_pain": [
        "radiation",
        "breathlessness",
        "sweating",
        "exertion",
    ],
    "headache": [
        "vision_changes",
        "nausea",
        "neck_stiffness",
        "trauma",
    ],
    "cough": [
        "sputum",
        "fever",
        "breathlessness",
        "chest_pain",
    ],
    "abdominal_pain": [
        "nausea",
        "vomiting",
        "diarrhea",
        "relation_to_food",
    ],
    "joint_pain": [
        "swelling",
        "morning_stiffness",
        "trauma",
        "fever",
    ],
    "dizziness": [
        "palpitations",
        "vision_changes",
        "breathlessness",
        "recent_illness",
    ],
    "fever": [
        "chills",
        "cough",
        "rash",
        "duration",
    ],
}


CATEGORY_QUESTIONS = {
    "chest_pain": {
        "radiation": "Does the pain spread to your arm, jaw, back, or shoulder?",
        "breathlessness": "Do you have difficulty breathing?",
        "sweating": "Do you have sweating with this?",
        "exertion": "Does it worsen with exertion?",
    },
    "headache": {
        "vision_changes": "Any vision changes?",
        "nausea": "Any nausea or vomiting?",
        "neck_stiffness": "Any neck stiffness?",
        "trauma": "Did this start after a head injury?",
    },
    "cough": {
        "sputum": "Is the cough dry or productive? Any sputum color?",
        "fever": "Do you have fever?",
        "breathlessness": "Do you have difficulty breathing?",
        "chest_pain": "Do you have chest pain with cough?",
    },
    "abdominal_pain": {
        "nausea": "Any nausea?",
        "vomiting": "Any vomiting?",
        "diarrhea": "Any diarrhea?",
        "relation_to_food": "Does it change with food?",
    },
    "joint_pain": {
        "swelling": "Is there swelling around the joint?",
        "morning_stiffness": "Do you have morning stiffness?",
        "trauma": "Did this start after an injury?",
        "fever": "Do you have fever?",
    },
    "dizziness": {
        "palpitations": "Do you feel palpitations?",
        "vision_changes": "Any vision changes?",
        "breathlessness": "Any breathlessness?",
        "recent_illness": "Have you been recently ill?",
    },
    "fever": {
        "chills": "Do you have chills?",
        "cough": "Do you have cough?",
        "rash": "Do you have a rash?",
        "duration": "How many days has the fever been present?",
    },
}


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
        return [str(item).strip() for item in value if str(item).strip()]

    return []


def _normalize_location(value):
    if value is None:
        return None

    if isinstance(value, str):
        return {
            "body_region": _as_str(value),
            "laterality": None,
        }

    if isinstance(value, dict):
        return {
            "body_region": _as_str(value.get("body_region")),
            "laterality": _as_str(value.get("laterality")),
        }

    return None


def _heuristic_extraction(text: str, previous: dict) -> dict:
    lowered = text.lower()

    chief = previous.get("chief_complaint")

    if not chief:
        first_sentence = re.split(r"[.!?]", text)[0].strip()
        chief = first_sentence[:160] if first_sentence else None

    symptom = None

    symptom_candidates = [
        "chest pain",
        "headache",
        "cough",
        "fever",
        "abdominal pain",
        "joint pain",
        "back pain",
        "dizziness",
        "rash",
        "diarrhea",
        "vomiting",
        "sore throat",
        "breathlessness",
    ]

    for candidate in symptom_candidates:
        if candidate in lowered:
            symptom = candidate
            break

    duration_match = re.search(
        r"\b(\d+(?:\.\d+)?\s*(?:seconds?|minutes?|hours?|days?|weeks?|months?|years?))\b",
        lowered,
    )

    duration = duration_match.group(1) if duration_match else None

    severity = None

    if re.search(r"\bunbearable\b|\bsevere\b|\bhigh\b", lowered):
        severity = "severe"
    elif re.search(r"\bmoderate\b", lowered):
        severity = "moderate"
    elif re.search(r"\bmild\b|\blow\b", lowered):
        severity = "mild"

    onset = None

    if "sudden" in lowered:
        onset = "sudden"
    elif "gradual" in lowered:
        onset = "gradual"

    character = None

    character_candidates = [
        "sharp",
        "dull",
        "burning",
        "throbbing",
        "cramping",
        "pressure",
        "tightness",
    ]

    for candidate in character_candidates:
        if candidate in lowered:
            character = candidate
            break

    radiation = None

    if re.search(r"radiat\w+|spread\w+ to|spreads to", lowered):
        radiation = "present"

    body_region = None

    for region in BODY_REGIONS:
        if region in lowered:
            body_region = region
            break

    laterality = None

    if "bilateral" in lowered or ("left" in lowered and "right" in lowered):
        laterality = "bilateral"
    elif "left" in lowered:
        laterality = "left"
    elif "right" in lowered:
        laterality = "right"

    location = None

    if body_region or laterality:
        location = {
            "body_region": body_region,
            "laterality": laterality,
        }

    associated_symptoms = []

    for symptom_name, keywords in ASSOCIATED_SYMPTOM_MAP.items():
        if any(keyword in lowered for keyword in keywords):
            associated_symptoms.append(symptom_name)

    missing_fields = []

    if not duration:
        missing_fields.append("duration")

    if not severity:
        missing_fields.append("severity")

    if not body_region:
        missing_fields.append("location")

    if not onset:
        missing_fields.append("onset")

    if not associated_symptoms:
        missing_fields.append("associated_symptoms")

    return {
        "chief_complaint": chief,
        "symptom": symptom or chief,
        "duration": duration,
        "severity": severity,
        "onset": onset,
        "character": character,
        "radiation": radiation,
        "location": location,
        "associated_symptoms": associated_symptoms,
        "missing_fields": missing_fields,
    }


def _gemini_extraction(text: str, previous: dict) -> dict:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent"

    prompt = INTAKE_PROMPT

    if previous:
        prompt += "\n\nPREVIOUS STRUCTURED INTAKE DATA:\n"
        prompt += json.dumps(previous, ensure_ascii=False)[:4000]

    prompt += "\n\nUSER MESSAGE:\n"
    prompt += text[:4000]

    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": prompt
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

    response_text = (
        data.get("candidates", [{}])[0]
        .get("content", {})
        .get("parts", [{}])[0]
        .get("text", "")
    )

    cleaned = _clean_json_text(response_text)
    parsed = json.loads(cleaned)

    if not isinstance(parsed, dict):
        raise ValueError("LLM response is not an object")

    return {
        "chief_complaint": _as_str(parsed.get("chief_complaint")),
        "symptom": _as_str(parsed.get("symptom")),
        "duration": _as_str(parsed.get("duration")),
        "severity": _as_str(parsed.get("severity")),
        "onset": _as_str(parsed.get("onset")),
        "character": _as_str(parsed.get("character")),
        "radiation": _as_str(parsed.get("radiation")),
        "location": _normalize_location(parsed.get("location")),
        "associated_symptoms": _as_list(parsed.get("associated_symptoms")),
        "missing_fields": _as_list(parsed.get("missing_fields")),
    }


def extract_symptom_structure(
    text: str,
    previous_structured: dict | None = None,
) -> dict:
    previous = previous_structured or {}

    if settings.gemini_api_key:
        try:
            result = _gemini_extraction(text, previous)
        except Exception:
            result = _heuristic_extraction(text, previous)
    else:
        result = _heuristic_extraction(text, previous)

    for key in [
        "chief_complaint",
        "symptom",
        "duration",
        "severity",
        "onset",
        "character",
        "radiation",
    ]:
        if result.get(key) is None and previous.get(key) is not None:
            result[key] = previous.get(key)

    if result.get("location") is None and previous.get("location") is not None:
        result["location"] = previous.get("location")

    associated = []

    if isinstance(previous.get("associated_symptoms"), list):
        associated.extend(previous.get("associated_symptoms"))

    associated.extend(result.get("associated_symptoms", []))

    result["associated_symptoms"] = sorted(set(associated))

    missing_fields = result.get("missing_fields", [])

    if not result.get("duration") and "duration" not in missing_fields:
        missing_fields.append("duration")

    if not result.get("severity") and "severity" not in missing_fields:
        missing_fields.append("severity")

    if not result.get("onset") and "onset" not in missing_fields:
        missing_fields.append("onset")

    location = result.get("location")

    if not location or not location.get("body_region"):
        if "location" not in missing_fields:
            missing_fields.append("location")

    if not result.get("associated_symptoms") and "associated_symptoms" not in missing_fields:
        missing_fields.append("associated_symptoms")

    result["missing_fields"] = missing_fields[:12]

    return result


def _detect_category(structured: dict, raw_text: str) -> str:
    text_parts = [
        raw_text or "",
        structured.get("chief_complaint") or "",
        structured.get("symptom") or "",
    ]

    lowered = " ".join(text_parts).lower()

    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(keyword in lowered for keyword in keywords):
            return category

    return "general"


def generate_next_questions(
    structured: dict,
    raw_text: str = "",
) -> list[str]:
    questions: list[str] = []

    missing_fields = structured.get("missing_fields", [])

    for field in ["duration", "severity", "location", "onset", "associated_symptoms"]:
        if field in missing_fields and field in BASE_QUESTIONS:
            questions.append(BASE_QUESTIONS[field])

    category = _detect_category(structured, raw_text)

    category_fields = CATEGORY_REQUIRED_FIELDS.get(category, [])
    category_question_map = CATEGORY_QUESTIONS.get(category, {})

    associated_text = " ".join(
        structured.get("associated_symptoms", [])
    ).lower()

    for field in category_fields:
        question = category_question_map.get(field)

        if not question:
            continue

        field_phrase = field.replace("_", " ")

        if field_phrase in associated_text:
            continue

        if question not in questions:
            questions.append(question)

    return questions[:4]