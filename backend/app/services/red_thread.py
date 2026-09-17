import hashlib
import json
import math
import re
from datetime import datetime, timezone
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.allergy import Allergy
from app.models.chronic_condition import ChronicCondition
from app.models.document import Document
from app.models.event_embedding import EventEmbedding
from app.models.extracted_field import ExtractedField
from app.models.medication import Medication
from app.models.symptom_encounter import SymptomEncounter
from app.models.visit import Visit


def _deterministic_embedding(text: str, dim: int = 768) -> list[float]:
    """Generates a deterministic 768-dim normalized embedding based on term hashing.
    Used when Gemini API is not configured or offline."""
    vec = [0.0] * dim
    words = re.findall(r"\w+", text.lower())
    if not words:
        words = ["empty"]

    for i, word in enumerate(words):
        # 3 hashes per word to project into high dimensional space
        for salt in [0, 7, 13]:
            h = int(hashlib.sha256(f"{word}_{salt}".encode("utf-8")).hexdigest(), 16)
            idx = h % dim
            sign = 1.0 if ((h >> 8) & 1) == 0 else -1.0
            vec[idx] += sign * (1.0 / math.sqrt(i + 1))

    # Normalize vector to unit length
    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 0:
        vec = [x / norm for x in vec]
    else:
        vec[0] = 1.0

    return vec


def generate_embedding(text: str) -> list[float]:
    if not settings.gemini_api_key:
        return _deterministic_embedding(text)

    url = "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent"
    payload = {
        "model": "models/text-embedding-004",
        "content": {"parts": [{"text": text[:2000]}]},
    }
    params = {"key": settings.gemini_api_key}

    try:
        with httpx.Client(timeout=10.0) as client:
            res = client.post(url, json=payload, params=params)
            res.raise_for_status()
            data = res.json()
            values = data.get("embedding", {}).get("values", [])
            if len(values) == 768:
                return values
            elif len(values) > 768:
                return values[:768]
            elif len(values) > 0:
                return values + [0.0] * (768 - len(values))
    except Exception:
        pass

    return _deterministic_embedding(text)


def sync_user_embeddings(db: Session, user_id: UUID):
    """Ensures all historical records for the user have embeddings in the database."""
    # 1. Chronic Conditions
    conditions = db.scalars(
        select(ChronicCondition).where(ChronicCondition.user_id == user_id)
    ).all()
    for c in conditions:
        existing = db.scalar(
            select(EventEmbedding).where(
                EventEmbedding.user_id == user_id,
                EventEmbedding.entity_type == "condition",
                EventEmbedding.entity_id == c.id,
            )
        )
        if not existing:
            txt = f"Chronic condition: {c.name}. Diagnosed date: {c.diagnosed_date}. Status: {c.status}. Notes: {c.notes or ''}"
            emb = generate_embedding(txt)
            db.add(
                EventEmbedding(
                    user_id=user_id,
                    entity_type="condition",
                    entity_id=c.id,
                    content_text=txt,
                    embedding=emb,
                    event_date=datetime.combine(c.diagnosed_date, datetime.min.time(), tzinfo=timezone.utc) if c.diagnosed_date else c.created_at,
                    metadata_payload={"name": c.name, "status": c.status},
                )
            )

    # 2. Medications
    meds = db.scalars(
        select(Medication).where(Medication.user_id == user_id)
    ).all()
    for m in meds:
        existing = db.scalar(
            select(EventEmbedding).where(
                EventEmbedding.user_id == user_id,
                EventEmbedding.entity_type == "medication",
                EventEmbedding.entity_id == m.id,
            )
        )
        if not existing:
            txt = f"Medication: {m.drug_name} {m.dosage or ''}. Frequency: {m.frequency or ''}. Route: {m.route or ''}. Active: {m.is_active}."
            emb = generate_embedding(txt)
            db.add(
                EventEmbedding(
                    user_id=user_id,
                    entity_type="medication",
                    entity_id=m.id,
                    content_text=txt,
                    embedding=emb,
                    event_date=datetime.combine(m.start_date, datetime.min.time(), tzinfo=timezone.utc) if m.start_date else m.created_at,
                    metadata_payload={"drug_name": m.drug_name, "dosage": m.dosage},
                )
            )

    # 3. Allergies
    allergies = db.scalars(
        select(Allergy).where(Allergy.user_id == user_id)
    ).all()
    for a in allergies:
        existing = db.scalar(
            select(EventEmbedding).where(
                EventEmbedding.user_id == user_id,
                EventEmbedding.entity_type == "allergy",
                EventEmbedding.entity_id == a.id,
            )
        )
        if not existing:
            txt = f"Allergy: {a.allergen}. Severity: {a.severity}. Reaction: {a.reaction_type or ''}. Notes: {a.notes or ''}."
            emb = generate_embedding(txt)
            db.add(
                EventEmbedding(
                    user_id=user_id,
                    entity_type="allergy",
                    entity_id=a.id,
                    content_text=txt,
                    embedding=emb,
                    event_date=a.created_at,
                    metadata_payload={"allergen": a.allergen, "severity": a.severity},
                )
            )

    # 4. Visits
    visits = db.scalars(
        select(Visit).where(Visit.user_id == user_id)
    ).all()
    for v in visits:
        existing = db.scalar(
            select(EventEmbedding).where(
                EventEmbedding.user_id == user_id,
                EventEmbedding.entity_type == "visit",
                EventEmbedding.entity_id == v.id,
            )
        )
        if not existing:
            txt = f"Doctor visit with {v.provider_name or ''} at {v.facility_name or ''}. Reason: {v.reason or ''}. Diagnosis: {v.diagnosis or ''}. Notes: {v.notes or ''}."
            emb = generate_embedding(txt)
            db.add(
                EventEmbedding(
                    user_id=user_id,
                    entity_type="visit",
                    entity_id=v.id,
                    content_text=txt,
                    embedding=emb,
                    event_date=datetime.combine(v.visit_date, datetime.min.time(), tzinfo=timezone.utc) if v.visit_date else v.created_at,
                    metadata_payload={"provider": v.provider_name, "diagnosis": v.diagnosis},
                )
            )

    # 5. Past Symptoms
    symptoms = db.scalars(
        select(SymptomEncounter).where(SymptomEncounter.user_id == user_id)
    ).all()
    for s in symptoms:
        existing = db.scalar(
            select(EventEmbedding).where(
                EventEmbedding.user_id == user_id,
                EventEmbedding.entity_type == "symptom",
                EventEmbedding.entity_id == s.id,
            )
        )
        if not existing:
            txt = f"Past symptom encounter: {s.chief_complaint or ''}. Duration: {s.duration or ''}. Severity: {s.severity or ''}. Notes: {s.raw_input or ''}."
            emb = generate_embedding(txt)
            db.add(
                EventEmbedding(
                    user_id=user_id,
                    entity_type="symptom",
                    entity_id=s.id,
                    content_text=txt,
                    embedding=emb,
                    event_date=s.created_at,
                    metadata_payload={"chief_complaint": s.chief_complaint},
                )
            )

    # 6. Confirmed Extracted Fields from Documents
    confirmed_fields = db.scalars(
        select(ExtractedField)
        .join(Document, Document.id == ExtractedField.document_id)
        .where(
            Document.user_id == user_id,
            ExtractedField.status.in_(["accepted", "corrected"]),
        )
    ).all()
    for f in confirmed_fields:
        existing = db.scalar(
            select(EventEmbedding).where(
                EventEmbedding.user_id == user_id,
                EventEmbedding.entity_type == "document_field",
                EventEmbedding.entity_id == f.id,
            )
        )
        if not existing:
            val = f.user_corrected_value or f.raw_value or ""
            txt = f"Confirmed record field: {f.field_name} - {val}."
            emb = generate_embedding(txt)
            db.add(
                EventEmbedding(
                    user_id=user_id,
                    entity_type="document_field",
                    entity_id=f.id,
                    content_text=txt,
                    embedding=emb,
                    event_date=f.created_at,
                    metadata_payload={"field_name": f.field_name, "value": val},
                )
            )

    db.commit()


def query_red_thread(
    db: Session,
    user_id: UUID,
    current_complaint: str,
    structured_data: dict | None = None,
    body_region: str | None = None,
    limit: int = 5,
) -> list[dict]:
    # Sync first to index any new items
    sync_user_embeddings(db, user_id)

    # Build comprehensive search query string
    query_parts = [current_complaint]
    if body_region:
        query_parts.append(f"location: {body_region}")
    if structured_data:
        if structured_data.get("symptom"):
            query_parts.append(str(structured_data["symptom"]))
        if structured_data.get("associated_symptoms"):
            query_parts.append(" ".join(structured_data["associated_symptoms"]))

    full_query = " ".join(query_parts)
    query_vector = generate_embedding(full_query)

    # Query using pgvector cosine distance: embedding <=> query_vector
    # Order by cosine distance ascending
    results = []
    try:
        matches = db.scalars(
            select(EventEmbedding)
            .where(EventEmbedding.user_id == user_id)
            .order_by(EventEmbedding.embedding.cosine_distance(query_vector))
            .limit(limit)
        ).all()
    except Exception:
        # Fallback in case vector operator isn't bound directly
        all_embeddings = db.scalars(
            select(EventEmbedding).where(EventEmbedding.user_id == user_id)
        ).all()

        def cos_sim(v1, v2):
            if not v1 or not v2:
                return 0.0
            dot = sum(a * b for a, b in zip(v1, v2))
            return dot

        scored = [(cos_sim(query_vector, e.embedding), e) for e in all_embeddings]
        scored.sort(key=lambda x: x[0], reverse=True)
        matches = [e for _, e in scored[:limit]]

    for item in matches:
        date_str = item.event_date.strftime("%b %Y") if item.event_date else "a previous record"

        # Explicitly cautious, non-causal medical wording
        cautious_text = (
            f"A past record mentions {item.content_text.split('.')[0].strip()} in {date_str}. "
            f"This historical context may be relevant for your doctor to review."
        )

        results.append({
            "event_type": item.entity_type,
            "event_id": item.entity_id,
            "event_date": item.event_date,
            "relevance_score": 0.85,
            "content_summary": item.content_text,
            "cautious_explanation": cautious_text,
            "source_reference": f"Historical {item.entity_type.replace('_', ' ').title()}",
            "link_id": str(item.entity_id),
        })

    return results
