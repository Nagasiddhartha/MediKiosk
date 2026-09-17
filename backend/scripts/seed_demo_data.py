import os
import sys
from datetime import date, datetime, timezone
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import select
from app.db.session import SessionLocal
from app.core.security import get_password_hash
from app.models.allergy import Allergy
from app.models.body_map_annotation import BodyMapAnnotation
from app.models.chronic_condition import ChronicCondition
from app.models.consent import UserConsent
from app.models.document import Document
from app.models.document_ocr_output import DocumentOcrOutput
from app.models.extracted_field import ExtractedField
from app.models.health_reading import HealthReading
from app.models.intake_message import IntakeMessage
from app.models.medication import Medication
from app.models.patient_profile import PatientProfile
from app.models.symptom_encounter import SymptomEncounter
from app.models.user import User
from app.models.visit import Visit
from app.services.csv_parser import parse_csv_content
from app.services.red_thread import sync_user_embeddings
from app.services.storage import ensure_storage_root


def seed_demo():
    db = SessionLocal()
    try:
        print("[*] Seeding MediKiosk demo dataset...")

        # 1. User
        email = "eleanor@example.com"
        user = db.scalar(select(User).where(User.email == email))
        if not user:
            user = User(
                email=email,
                hashed_password=get_password_hash("password123"),
                full_name="Eleanor Vance",
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"Created demo user: {email} / password123")
        else:
            print(f"User {email} already exists.")

        user_id = user.id

        # 2. Patient Profile
        profile = db.scalar(select(PatientProfile).where(PatientProfile.user_id == user_id))
        if not profile:
            profile = PatientProfile(
                user_id=user_id,
                full_name="Eleanor Vance",
                date_of_birth=date(1968, 4, 12),
                sex="female",
                blood_group="O+",
                height_cm=165.0,
                weight_kg=68.0,
                emergency_contact_name="Thomas Vance (Spouse)",
                emergency_contact_phone="+1-555-0192",
                medical_notes="Patient managing hypertension and pre-existing type 2 diabetes with oral medications.",
            )
            db.add(profile)
            db.commit()
            print("Created patient profile.")

        # 3. Consents
        for c_type in ["ai_processing", "ocr_processing", "data_analytics", "data_export"]:
            existing = db.scalar(
                select(UserConsent).where(
                    UserConsent.user_id == user_id,
                    UserConsent.consent_type == c_type,
                )
            )
            if not existing:
                db.add(
                    UserConsent(
                        user_id=user_id,
                        consent_type=c_type,
                        status="granted",
                        version="1.0",
                    )
                )
        db.commit()

        # 4. Chronic Conditions
        cond_data = [
            ("Essential Hypertension", date(2021, 6, 10), "active", "Stage 1 HTN managed with Amlodipine 5mg daily"),
            ("Type 2 Diabetes Mellitus", date(2022, 11, 4), "active", "Managed with Metformin 500mg and dietary adjustments"),
        ]
        for name, diag_date, status, notes in cond_data:
            existing = db.scalar(
                select(ChronicCondition).where(
                    ChronicCondition.user_id == user_id,
                    ChronicCondition.name == name,
                )
            )
            if not existing:
                db.add(
                    ChronicCondition(
                        user_id=user_id,
                        name=name,
                        diagnosed_date=diag_date,
                        status=status,
                        notes=notes,
                    )
                )
        db.commit()

        # 5. Allergies
        allergy_data = [
            ("Penicillin", "severe", "Anaphylaxis", "Severe allergic reaction in 2015, carries medical alert"),
            ("Sulfa Drugs", "moderate", "Cutaneous Rash", "Generalized hives and skin irritation"),
        ]
        for allergen, severity, reaction, notes in allergy_data:
            existing = db.scalar(
                select(Allergy).where(
                    Allergy.user_id == user_id,
                    Allergy.allergen == allergen,
                )
            )
            if not existing:
                db.add(
                    Allergy(
                        user_id=user_id,
                        allergen=allergen,
                        severity=severity,
                        reaction_type=reaction,
                        notes=notes,
                    )
                )
        db.commit()

        # 6. Medications
        med_data = [
            ("Amlodipine", "5mg", "Once daily morning", "oral", True, date(2021, 6, 15)),
            ("Metformin", "500mg", "Twice daily with meals", "oral", True, date(2022, 11, 10)),
            ("Atorvastatin", "20mg", "Once daily at bedtime", "oral", True, date(2023, 3, 1)),
        ]
        for drug_name, dosage, freq, route, is_active, start_date in med_data:
            existing = db.scalar(
                select(Medication).where(
                    Medication.user_id == user_id,
                    Medication.drug_name == drug_name,
                )
            )
            if not existing:
                db.add(
                    Medication(
                        user_id=user_id,
                        drug_name=drug_name,
                        dosage=dosage,
                        frequency=freq,
                        route=route,
                        is_active=is_active,
                        start_date=start_date,
                    )
                )
        db.commit()

        # 7. Doctor Visits
        visit_data = [
            (date(2026, 8, 15), "Dr. Robert Sterling, MD", "St. Jude Comprehensive Medical Center", "Routine hypertension and diabetes quarterly follow-up", "Stable HTN, mild morning glucose fluctuations"),
            (date(2026, 4, 20), "Dr. Sarah Jenkins, MD", "Valley Cardiology Associates", "Annual cardiac wellness evaluation and resting ECG", "Normal sinus rhythm, trace peripheral edema"),
        ]
        for v_date, prov, fac, reason, diag in visit_data:
            existing = db.scalar(
                select(Visit).where(
                    Visit.user_id == user_id,
                    Visit.visit_date == v_date,
                )
            )
            if not existing:
                db.add(
                    Visit(
                        user_id=user_id,
                        visit_date=v_date,
                        provider_name=prov,
                        facility_name=fac,
                        reason=reason,
                        diagnosis=diag,
                    )
                )
        db.commit()

        # 8. Health Readings (from CSV sample)
        csv_file = backend_dir / "sample_data" / "sample_readings.csv"
        if csv_file.exists():
            content = csv_file.read_text(encoding="utf-8")
            parsed = parse_csv_content(content, "sample_readings.csv")
            for row in parsed["valid_rows"]:
                existing = db.scalar(
                    select(HealthReading).where(
                        HealthReading.user_id == user_id,
                        HealthReading.reading_type == row["reading_type"],
                        HealthReading.recorded_at == row["recorded_at"],
                    )
                )
                if not existing:
                    db.add(
                        HealthReading(
                            user_id=user_id,
                            **row,
                        )
                    )
            db.commit()
            print("Imported sample health readings.")

        # 9. Symptom Encounters & Body Map
        enc1 = db.scalar(
            select(SymptomEncounter).where(
                SymptomEncounter.user_id == user_id,
                SymptomEncounter.chief_complaint == "Throbbing headache behind eyes",
            )
        )
        if not enc1:
            enc1 = SymptomEncounter(
                user_id=user_id,
                chief_complaint="Throbbing headache behind eyes",
                raw_input="I have had a throbbing headache behind my eyes for three days. It feels worse in bright light.",
                structured_data={
                    "symptom": "headache",
                    "duration": "3 days",
                    "severity": "moderate",
                    "character": "throbbing",
                    "location": {"body_region": "head", "laterality": "bilateral"},
                    "associated_symptoms": ["mild nausea", "photophobia"],
                },
                duration="3 days",
                severity="moderate",
                status="completed",
            )
            db.add(enc1)
            db.flush()

            db.add(
                BodyMapAnnotation(
                    encounter_id=enc1.id,
                    body_region="head",
                    pain_type="throbbing",
                    laterality="bilateral",
                    severity="moderate",
                )
            )

            db.add(
                IntakeMessage(
                    encounter_id=enc1.id,
                    role="user",
                    content="I have had a throbbing headache behind my eyes for 3 days.",
                )
            )
            db.add(
                IntakeMessage(
                    encounter_id=enc1.id,
                    role="assistant",
                    content="How severe is the headache, and are you noticing any vision changes or neck stiffness?",
                    structured_payload={"next_questions": ["Any vision changes?", "Any neck stiffness?"]},
                )
            )
            db.add(
                IntakeMessage(
                    encounter_id=enc1.id,
                    role="user",
                    content="It is moderate. No vision changes, just sensitive to screens.",
                )
            )
            db.add(
                IntakeMessage(
                    encounter_id=enc1.id,
                    role="assistant",
                    content="Thank you. Your symptom summary and location have been organized for your doctor consultation.",
                )
            )
            db.commit()
            print("Created sample symptom encounter with body map annotation.")

        # 10. Sample Document with OCR & Fields
        doc = db.scalar(
            select(Document).where(
                Document.user_id == user_id,
                Document.title == "St. Jude Clinic Prescription - Aug 2026",
            )
        )
        if not doc:
            # Ensure fake file exists in storage
            storage_root = ensure_storage_root()
            user_dir = storage_root / str(user_id)
            user_dir.mkdir(parents=True, exist_ok=True)
            doc_file = user_dir / "demo_prescription.txt"
            doc_file.write_text(
                "ST. JUDE COMPREHENSIVE MEDICAL CENTER\n"
                "Dr. Robert Sterling, MD\n"
                "Date: 2026-08-15\n\n"
                "PATIENT: Eleanor Vance, 58F\n"
                "RX:\n"
                "1. Tab Amlodipine 5mg - 1 PO daily\n"
                "2. Tab Metformin 500mg - 1 PO BID\n"
                "3. Tab Atorvastatin 20mg - 1 PO QPM\n\n"
                "HbA1c Target: < 7.0%\n",
                encoding="utf-8",
            )

            doc = Document(
                user_id=user_id,
                title="St. Jude Clinic Prescription - Aug 2026",
                document_type="prescription",
                original_filename="prescription_st_jude_aug2026.txt",
                stored_path=str(doc_file),
                file_hash="demo_hash_9876543210abcdef",
                mime_type="text/plain",
                file_size_bytes=len(doc_file.read_bytes()),
                status="review_required",
                overall_confidence=0.88,
                confidence_tier="tier1",
            )
            db.add(doc)
            db.flush()

            ocr = DocumentOcrOutput(
                document_id=doc.id,
                raw_text=doc_file.read_text(encoding="utf-8"),
                cleaned_text=doc_file.read_text(encoding="utf-8"),
                ocr_engine="tesseract",
                language="eng",
                mean_word_confidence=0.92,
                page_count=1,
            )
            db.add(ocr)

            # Extracted fields
            f1 = ExtractedField(
                document_id=doc.id,
                entity_type="medication",
                field_name="Medication: Amlodipine 5mg",
                raw_value="Amlodipine 5mg once daily",
                ocr_confidence=0.94,
                llm_confidence=0.90,
                final_confidence=0.92,
                confidence_tier="tier1",
                status="accepted",
            )
            f2 = ExtractedField(
                document_id=doc.id,
                entity_type="medication",
                field_name="Medication: Metformin 500mg",
                raw_value="Metformin 500mg twice daily",
                ocr_confidence=0.92,
                llm_confidence=0.88,
                final_confidence=0.89,
                confidence_tier="tier1",
                status="accepted",
            )
            f3 = ExtractedField(
                document_id=doc.id,
                entity_type="medication",
                field_name="Medication: Atorvastatin 20mg",
                raw_value="Atorvastatin 20mg at bedtime",
                ocr_confidence=0.86,
                llm_confidence=0.82,
                final_confidence=0.84,
                confidence_tier="tier1",
                status="pending_review",
            )
            f4 = ExtractedField(
                document_id=doc.id,
                entity_type="lab_target",
                field_name="Target: HbA1c",
                raw_value="HbA1c < 7.0%",
                ocr_confidence=0.75,
                llm_confidence=0.70,
                final_confidence=0.73,
                confidence_tier="tier2",
                status="pending_review",
            )
            db.add_all([f1, f2, f3, f4])
            db.commit()
            print("Created sample document with extracted fields (pending & accepted).")

        # 11. Sync pgvector Embeddings
        print("[*] Indexing patient health history into pgvector Red-Thread engine...")
        sync_user_embeddings(db, user_id)
        print("[OK] Demo seeding complete! Ready for demonstration.")

    finally:
        db.close()


if __name__ == "__main__":
    seed_demo()
