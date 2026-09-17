from unittest.mock import MagicMock
from uuid import uuid4
from datetime import date, datetime, timezone
from app.services.fhir_exporter import generate_fhir_bundle


def test_fhir_bundle_structure():
    mock_db = MagicMock()
    user_id = uuid4()

    mock_user = MagicMock()
    mock_user.id = user_id
    mock_user.full_name = "Eleanor Vance"
    mock_user.email = "eleanor@example.com"
    mock_db.get.return_value = mock_user

    mock_profile = MagicMock()
    mock_profile.id = uuid4()
    mock_profile.full_name = "Eleanor Vance"
    mock_profile.date_of_birth = date(1968, 4, 12)
    mock_profile.sex = "female"
    mock_profile.emergency_contact_name = "Thomas Vance"
    mock_profile.emergency_contact_phone = "+1-555-0192"

    mock_cond = MagicMock()
    mock_cond.id = uuid4()
    mock_cond.name = "Essential Hypertension"
    mock_cond.status = "active"
    mock_cond.diagnosed_date = date(2021, 6, 10)
    mock_cond.notes = "Stage 1 HTN"

    mock_db.scalar.return_value = mock_profile
    mock_db.scalars.return_value.all.side_effect = [
        [mock_cond],  # conditions
        [],           # allergies
        [],           # medications
        [],           # visits
        [],           # encounters
        [],           # readings
        [],           # documents
    ]

    bundle = generate_fhir_bundle(user_id=user_id, db=mock_db)

    assert bundle["resourceType"] == "Bundle"
    assert bundle["type"] == "collection"
    assert bundle["total"] >= 2  # Patient + Condition

    patient_entry = bundle["entry"][0]["resource"]
    assert patient_entry["resourceType"] == "Patient"
    assert patient_entry["name"][0]["text"] == "Eleanor Vance"
    assert patient_entry["gender"] == "female"

    cond_entry = bundle["entry"][1]["resource"]
    assert cond_entry["resourceType"] == "Condition"
    assert cond_entry["code"]["text"] == "Essential Hypertension"
    assert cond_entry["clinicalStatus"]["coding"][0]["code"] == "active"
