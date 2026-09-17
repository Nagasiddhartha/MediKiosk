from datetime import date, datetime, timedelta, timezone
from io import BytesIO
from uuid import UUID

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.allergy import Allergy
from app.models.chronic_condition import ChronicCondition
from app.models.document import Document
from app.models.health_reading import HealthReading
from app.models.medication import Medication
from app.models.patient_profile import PatientProfile
from app.models.red_flag_event import RedFlagEvent
from app.models.symptom_encounter import SymptomEncounter
from app.models.user import User


def _safe_text(value) -> str:
    return str(value).encode("ascii", "ignore").decode("ascii")


def _wrap_text(text: str, max_chars: int = 95) -> list[str]:
    text = _safe_text(text)
    lines: list[str] = []

    for paragraph in text.split("\n"):
        words = paragraph.split()
        line = ""

        for word in words:
            while len(word) > max_chars:
                lines.append(word[:max_chars])
                word = word[max_chars:]

            candidate = (line + " " + word).strip()

            if len(candidate) <= max_chars:
                line = candidate
            else:
                if line:
                    lines.append(line)
                line = word

        if line:
            lines.append(line)

    return lines


def _age(dob: date | None) -> int | None:
    if dob is None:
        return None

    today = date.today()

    return (
        today.year
        - dob.year
        - ((today.month, today.day) < (dob.month, dob.day))
    )


def _reading_label(reading: HealthReading) -> str:
    if reading.reading_type == "blood_pressure":
        return f"Blood Pressure: {reading.systolic}/{reading.diastolic} mmHg"

    label = reading.reading_type.replace("_", " ").title()

    if reading.value_text:
        value = reading.value_text
    elif reading.numeric_value is not None:
        value = str(reading.numeric_value)
    else:
        value = ""

    if reading.unit:
        return f"{label}: {value} {reading.unit}"

    return f"{label}: {value}"


def generate_doctor_summary_pdf(
    user_id: UUID,
    db: Session,
    days: int = 30,
) -> bytes:
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=days)

    user = db.get(User, user_id)

    profile = db.scalar(
        select(PatientProfile).where(PatientProfile.user_id == user_id)
    )

    conditions = db.scalars(
        select(ChronicCondition)
        .where(
            ChronicCondition.user_id == user_id,
            ChronicCondition.status == "active",
        )
        .order_by(ChronicCondition.created_at.desc())
        .limit(8)
    ).all()

    allergies = db.scalars(
        select(Allergy)
        .where(Allergy.user_id == user_id)
        .order_by(Allergy.created_at.desc())
        .limit(8)
    ).all()

    medications = db.scalars(
        select(Medication)
        .where(
            Medication.user_id == user_id,
            Medication.is_active == True,
        )
        .order_by(Medication.created_at.desc())
        .limit(10)
    ).all()

    symptoms = db.scalars(
        select(SymptomEncounter)
        .where(
            SymptomEncounter.user_id == user_id,
            SymptomEncounter.created_at >= cutoff,
        )
        .order_by(SymptomEncounter.created_at.desc())
        .limit(6)
    ).all()

    readings = db.scalars(
        select(HealthReading)
        .where(
            HealthReading.user_id == user_id,
            HealthReading.recorded_at >= cutoff,
        )
        .order_by(HealthReading.recorded_at.desc())
        .limit(12)
    ).all()

    red_flags = db.scalars(
        select(RedFlagEvent)
        .where(
            RedFlagEvent.user_id == user_id,
            RedFlagEvent.created_at >= cutoff,
        )
        .order_by(RedFlagEvent.created_at.desc())
        .limit(5)
    ).all()

    documents = db.scalars(
        select(Document)
        .where(
            Document.user_id == user_id,
            Document.created_at >= cutoff,
        )
        .order_by(Document.created_at.desc())
        .limit(8)
    ).all()

    yellow_flags: list[str] = []

    for symptom in symptoms:
        if symptom.severity and symptom.severity.lower() in {"severe", "high", "very severe"}:
            yellow_flags.append(
                f"Reported symptom severity is {symptom.severity}: {symptom.chief_complaint or 'symptom'}"
            )

    for reading in readings:
        if reading.reading_type == "blood_pressure":
            if reading.systolic is not None and reading.diastolic is not None:
                if reading.systolic >= 140 or reading.diastolic >= 90:
                    yellow_flags.append(
                        f"Blood pressure reading {reading.systolic}/{reading.diastolic} may be elevated."
                    )

        if reading.reading_type == "blood_glucose":
            if reading.numeric_value is not None and reading.numeric_value >= 126:
                yellow_flags.append(
                    f"Blood glucose reading {reading.numeric_value} may be elevated."
                )

        if reading.reading_type == "heart_rate":
            if reading.numeric_value is not None and reading.numeric_value >= 110:
                yellow_flags.append(
                    f"Heart rate reading {reading.numeric_value} may be elevated."
                )

        if reading.reading_type == "temperature":
            if reading.numeric_value is not None:
                if reading.unit and reading.unit.lower().startswith("f"):
                    if reading.numeric_value >= 100.4:
                        yellow_flags.append(
                            f"Temperature reading {reading.numeric_value} F may be elevated."
                        )
                else:
                    if reading.numeric_value >= 38:
                        yellow_flags.append(
                            f"Temperature reading {reading.numeric_value} C may be elevated."
                        )

    for document in documents:
        if document.status == "review_required":
            yellow_flags.append("Some uploaded documents are still awaiting review.")
            break

    traffic = "green"

    if yellow_flags:
        traffic = "yellow"

    if red_flags:
        traffic = "red"

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)

    width, height = A4
    margin = 18 * mm
    y = height - margin
    bottom_limit = 20 * mm

    def ensure_space(needed: float = 6 * mm):
        nonlocal y

        if y < bottom_limit + needed:
            c.showPage()
            y = height - margin

    def draw_section(section_title: str):
        nonlocal y

        ensure_space(10 * mm)
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(HexColor("#111827"))
        c.drawString(margin, y, _safe_text(section_title))
        y -= 5.5 * mm

    def draw_line(text: str, indent: float = 4 * mm):
        nonlocal y

        wrapped = _wrap_text(text)

        for line in wrapped:
            ensure_space(5 * mm)
            c.setFont("Helvetica", 9)
            c.setFillColor(HexColor("#1f2937"))
            c.drawString(margin + indent, y, line)
            y -= 4.4 * mm

    c.setFont("Helvetica-Bold", 16)
    c.setFillColor(HexColor("#0f172a"))
    c.drawString(margin, y, "MediKiosk Doctor Summary")
    y -= 7 * mm

    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor("#475569"))
    c.drawString(margin, y, f"Generated at: {now.strftime('%Y-%m-%d %H:%M UTC')}")
    y -= 4.5 * mm
    c.drawString(margin, y, f"Recent period: last {days} days")
    y -= 4.5 * mm
    c.drawString(margin, y, "Patient-reported and user-confirmed information. Not a medical diagnosis.")
    y -= 8 * mm

    traffic_colors = {
        "red": HexColor("#dc2626"),
        "yellow": HexColor("#f59e0b"),
        "green": HexColor("#16a34a"),
    }

    ensure_space(12 * mm)
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(HexColor("#111827"))
    c.drawString(margin, y, f"Urgency indicator: {traffic.upper()}")

    c.setFillColor(traffic_colors[traffic])
    c.circle(width - margin - 8 * mm, y + 1.5 * mm, 3.5 * mm, stroke=0, fill=1)
    y -= 9 * mm

    draw_section("Patient Overview")

    patient_name = "Not provided"

    if profile and profile.full_name:
        patient_name = profile.full_name
    elif user and user.full_name:
        patient_name = user.full_name
    elif user and user.email:
        patient_name = user.email

    draw_line(f"Name: {patient_name}")

    if profile:
        age = _age(profile.date_of_birth)

        if age is not None:
            draw_line(f"Age: {age}")

        if profile.sex:
            draw_line(f"Sex: {profile.sex}")

        if profile.blood_group:
            draw_line(f"Blood group: {profile.blood_group}")

        if profile.emergency_contact_name or profile.emergency_contact_phone:
            emergency = "Emergency contact: "
            if profile.emergency_contact_name:
                emergency += profile.emergency_contact_name
            if profile.emergency_contact_phone:
                emergency += f" ({profile.emergency_contact_phone})"
            draw_line(emergency)

        if profile.medical_notes:
            draw_line(f"Medical notes: {profile.medical_notes[:300]}")

    if red_flags:
        draw_section("Urgent Warnings")
        draw_line("These findings were triggered by explicit rule-based red-flag checks, not by diagnosis.")

        for flag in red_flags:
            draw_line(f"- {flag.created_at.strftime('%Y-%m-%d')} | {flag.message}")

    if symptoms:
        draw_section("Current / Recent Reported Symptoms")

        for symptom in symptoms:
            line = f"- {symptom.created_at.strftime('%Y-%m-%d')} | {symptom.chief_complaint or 'Reported symptom'}"

            if symptom.duration:
                line += f" | Duration: {symptom.duration}"

            if symptom.severity:
                line += f" | Severity: {symptom.severity}"

            draw_line(line)

            if symptom.raw_input:
                draw_line(f"  Reported: {symptom.raw_input[:220]}")

    if conditions:
        draw_section("Active Chronic Conditions")

        for condition in conditions:
            line = f"- {condition.name}"

            if condition.diagnosed_date:
                line += f" | Diagnosed: {condition.diagnosed_date}"

            if condition.status:
                line += f" | Status: {condition.status}"

            draw_line(line)

    if medications:
        draw_section("Current Medications")

        for medication in medications:
            line = f"- {medication.drug_name}"

            if medication.dosage:
                line += f" {medication.dosage}"

            if medication.frequency:
                line += f" | {medication.frequency}"

            if medication.route:
                line += f" | Route: {medication.route}"

            draw_line(line)

    if allergies:
        draw_section("Allergies")

        for allergy in allergies:
            line = f"- {allergy.allergen} | Severity: {allergy.severity}"

            if allergy.reaction_type:
                line += f" | Reaction: {allergy.reaction_type}"

            draw_line(line)

    if readings:
        draw_section("Recent Health Readings")

        for reading in readings:
            line = f"- {reading.recorded_at.strftime('%Y-%m-%d')} | {_reading_label(reading)}"

            if reading.source:
                line += f" | Source: {reading.source}"

            draw_line(line)

    if yellow_flags:
        draw_section("Trend Flags")
        draw_line("These are cautious observations for clinician review, not conclusions.")

        for flag in yellow_flags:
            draw_line(f"- {flag}")

    if documents:
        draw_section("Recent Documents")

        for document in documents:
            line = f"- {document.created_at.strftime('%Y-%m-%d')} | {document.title or document.original_filename or 'Document'}"
            line += f" | Status: {document.status}"

            if document.confidence_tier:
                line += f" | Confidence: {document.confidence_tier}"

            draw_line(line)

    ensure_space(16 * mm)
    y -= 4 * mm
    draw_section("Safety Note")
    draw_line(
        "MediKiosk organizes patient-reported information and uploaded documents for review. "
        "It does not diagnose diseases, prescribe medication, or replace professional medical advice."
    )

    c.save()

    return buffer.getvalue()