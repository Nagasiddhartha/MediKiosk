from pydantic import BaseModel


class RedFlagRule(BaseModel):
    rule_id: str
    severity: str
    symptoms: list[str]
    associated: list[str]
    message: str


RULES: list[RedFlagRule] = [
    RedFlagRule(
        rule_id="chest_pain_breathlessness",
        severity="urgent",
        symptoms=["chest pain", "chest pressure", "chest tightness"],
        associated=["breathlessness", "difficulty breathing", "shortness of breath", "sweating"],
        message="These symptoms may require prompt medical attention. Please contact a doctor or emergency service immediately.",
    ),
    RedFlagRule(
        rule_id="sudden_neurological",
        severity="urgent",
        symptoms=["sudden weakness", "numbness", "facial droop", "slurred speech", "confusion"],
        associated=[],
        message="Sudden neurological symptoms may require immediate emergency care.",
    ),
    RedFlagRule(
        rule_id="severe_headache",
        severity="urgent",
        symptoms=["thunderclap headache", "worst headache of life", "sudden severe headache"],
        associated=[],
        message="A sudden, severe headache may require immediate medical evaluation.",
    ),
    RedFlagRule(
        rule_id="suicidal_ideation",
        severity="urgent",
        symptoms=["suicidal", "want to die", "end my life", "self harm"],
        associated=[],
        message="If you are feeling overwhelmed or having thoughts of self-harm, please contact emergency services or a crisis helpline immediately.",
    ),
]


def evaluate_red_flags(
    chief_complaint: str | None, 
    structured_data: dict | None
) -> list[dict]:
    triggered = []
    
    text_to_check = ((chief_complaint or "") + " " + str(structured_data or "")).lower()
    
    for rule in RULES:
        symptom_match = any(s in text_to_check for s in rule.symptoms)
        
        if rule.associated:
            associated_match = any(a in text_to_check for a in rule.associated)
            is_triggered = symptom_match and associated_match
        else:
            is_triggered = symptom_match
            
        if is_triggered:
            triggered.append({
                "rule_id": rule.rule_id,
                "severity": rule.severity,
                "message": rule.message,
                "matched_text": text_to_check.strip()
            })
            
    return triggered