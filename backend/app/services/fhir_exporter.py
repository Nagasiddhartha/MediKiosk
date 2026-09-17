from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.allergy import Allergy
from app.models.chronic_condition import ChronicCondition
from app.models.document import Document
from app.models.health_reading import HealthReading
from app.models.medication import Medication
from app.models.patient_profile import PatientProfile
from app.models.symptom_encounter import SymptomEncounter
from app.models.user import User
from app.models.visit import Visit


def generate_fhir_bundle(user_id: UUID, db: Session) -> dict:
    user = db.get(User, user_id)
    profile = db.scalar(
        select(PatientProfile).where(PatientProfile.user_id == user_id)
    )
    conditions = db.scalars(
        select(ChronicCondition).where(ChronicCondition.user_id == user_id)
    ).all()
    allergies = db.scalars(
        select(Allergy).where(Allergy.user_id == user_id)
    ).all()
    medications = db.scalars(
        select(Medication).where(Medication.user_id == user_id)
    ).all()
    visits = db.scalars(
        select(Visit).where(Visit.user_id == user_id)
    ).all()
    encounters = db.scalars(
        select(SymptomEncounter).where(SymptomEncounter.user_id == user_id)
    ).all()
    readings = db.scalars(
        select(HealthReading).where(HealthReading.user_id == user_id)
    ).all()
    documents = db.scalars(
        select(Document).where(Document.user_id == user_id)
    ).all()

    entries = []

    # 1. Patient Resource
    patient_id = str(profile.id if profile else user_id)
    patient_resource = {
        "resourceType": "Patient",
        "id": patient_id,
        "identifier": [
            {
                "system": "urn:ietf:rfc:3986",
                "value": f"urn:uuid:{user_id}",
            }
        ],
        "active": True,
        "name": [
            {
                "use": "official",
                "text": (profile.full_name if profile and profile.full_name else (user.full_name or "Patient")),
            }
        ],
        "telecom": [
            {"system": "email", "value": user.email if user else None}
        ],
    }
    if profile:
        if profile.date_of_birth:
            patient_resource["birthDate"] = profile.date_of_birth.isoformat()
        if profile.sex:
            gender_map = {"male": "male", "female": "female", "other": "other"}
            patient_resource["gender"] = gender_map.get(profile.sex.lower(), "unknown")
        if profile.emergency_contact_name or profile.emergency_contact_phone:
            patient_resource["contact"] = [
                {
                    "name": {"text": profile.emergency_contact_name or "Emergency Contact"},
                    "telecom": [
                        {"system": "phone", "value": profile.emergency_contact_phone}
                    ] if profile.emergency_contact_phone else [],
                }
            ]

    entries.append({
        "fullUrl": f"urn:uuid:{patient_id}",
        "resource": patient_resource,
    })

    # 2. Conditions
    for c in conditions:
        clinical_status = "active" if c.status == "active" else "resolved"
        cond_resource = {
            "resourceType": "Condition",
            "id": str(c.id),
            "clinicalStatus": {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                        "code": clinical_status,
                    }
                ]
            },
            "subject": {"reference": f"urn:uuid:{patient_id}"},
            "code": {
                "text": c.name,
            },
            "note": [{"text": c.notes}] if c.notes else [],
        }
        if c.diagnosed_date:
            cond_resource["onsetDateTime"] = c.diagnosed_date.isoformat()
        entries.append({
            "fullUrl": f"urn:uuid:{c.id}",
            "resource": cond_resource,
        })

    # 3. AllergyIntolerance
    for a in allergies:
        crit_map = {"severe": "high", "moderate": "moderate", "mild": "low"}
        allergy_resource = {
            "resourceType": "AllergyIntolerance",
            "id": str(a.id),
            "patient": {"reference": f"urn:uuid:{patient_id}"},
            "code": {"text": a.allergen},
            "criticality": crit_map.get(a.severity.lower() if a.severity else "", "unable-to-assess"),
            "reaction": [
                {"manifestation": [{"text": a.reaction_type or "Allergic reaction"}]}
            ] if a.reaction_type else [],
            "note": [{"text": a.notes}] if a.notes else [],
        }
        entries.append({
            "fullUrl": f"urn:uuid:{a.id}",
            "resource": allergy_resource,
        })

    # 4. MedicationStatement
    for m in medications:
        med_resource = {
            "resourceType": "MedicationStatement",
            "id": str(m.id),
            "status": "active" if m.is_active else "completed",
            "subject": {"reference": f"urn:uuid:{patient_id}"},
            "medicationCodeableConcept": {
                "text": m.drug_name,
            },
            "dosage": [
                {
                    "text": f"{m.dosage or ''} {m.frequency or ''}".strip(),
                    "route": {"text": m.route} if m.route else None,
                }
            ],
            "effectivePeriod": {
                "start": m.start_date.isoformat() if m.start_date else None,
                "end": m.end_date.isoformat() if m.end_date else None,
            },
        }
        entries.append({
            "fullUrl": f"urn:uuid:{m.id}",
            "resource": med_resource,
        })

    # 5. Observations (Health Readings)
    for r in readings:
        code_text = r.reading_type.replace("_", " ").title()
        obs_resource = {
            "resourceType": "Observation",
            "id": str(r.id),
            "status": "final",
            "subject": {"reference": f"urn:uuid:{patient_id}"},
            "effectiveDateTime": r.recorded_at.isoformat() if r.recorded_at else None,
            "code": {"text": code_text},
        }
        if r.reading_type == "blood_pressure":
            obs_resource["component"] = [
                {
                    "code": {"text": "Systolic blood pressure"},
                    "valueQuantity": {"value": r.systolic, "unit": "mmHg"},
                },
                {
                    "code": {"text": "Diastolic blood pressure"},
                    "valueQuantity": {"value": r.diastolic, "unit": "mmHg"},
                },
            ]
        elif r.numeric_value is not None:
            obs_resource["valueQuantity"] = {
                "value": r.numeric_value,
                "unit": r.unit or "",
            }
        elif r.value_text:
            obs_resource["valueString"] = r.value_text

        entries.append({
            "fullUrl": f"urn:uuid:{r.id}",
            "resource": obs_resource,
        })

    # 6. Encounters (Visits & Symptoms)
    for v in visits:
        enc_resource = {
            "resourceType": "Encounter",
            "id": str(v.id),
            "status": "finished",
            "class": {
                "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                "code": "AMB",
                "display": "ambulatory",
            },
            "subject": {"reference": f"urn:uuid:{patient_id}"},
            "actualPeriod": {
                "start": v.visit_date.isoformat() if v.visit_date else None,
            },
            "reasonCode": [{"text": v.reason}] if v.reason else [],
            "serviceProvider": {"display": v.facility_name or v.provider_name or "Clinic"},
        }
        entries.append({
            "fullUrl": f"urn:uuid:{v.id}",
            "resource": enc_resource,
        })

    # 7. DocumentReference
    for d in documents:
        doc_resource = {
            "resourceType": "DocumentReference",
            "id": str(d.id),
            "status": "current" if d.status == "confirmed" else "preliminary",
            "subject": {"reference": f"urn:uuid:{patient_id}"},
            "date": d.created_at.isoformat() if d.created_at else None,
            "description": d.title or d.original_filename,
            "content": [
                {
                    "attachment": {
                        "contentType": d.mime_type or "application/pdf",
                        "size": d.file_size_bytes,
                        "title": d.original_filename,
                    }
                }
            ],
        }
        entries.append({
            "fullUrl": f"urn:uuid:{d.id}",
            "resource": doc_resource,
        })

    bundle = {
        "resourceType": "Bundle",
        "type": "collection",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total": len(entries),
        "entry": entries,
    }

    return bundle
