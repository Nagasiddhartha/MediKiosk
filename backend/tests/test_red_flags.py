from app.services.red_flags import evaluate_red_flags


def test_chest_pain_with_breathlessness_triggers_red_flag():
    flags = evaluate_red_flags(
        chief_complaint="Severe chest pain and tightness",
        structured_data={"associated_symptoms": ["breathlessness", "sweating"]},
    )
    assert len(flags) > 0
    assert any(f["rule_id"] == "chest_pain_breathlessness" for f in flags)
    assert flags[0]["severity"] == "urgent"


def test_sudden_neurological_triggers_red_flag():
    flags = evaluate_red_flags(
        chief_complaint="Sudden weakness and numbness on left side",
        structured_data={},
    )
    assert len(flags) > 0
    assert any(f["rule_id"] == "sudden_neurological" for f in flags)


def test_mild_symptom_no_red_flag():
    flags = evaluate_red_flags(
        chief_complaint="Mild runny nose and sneezing",
        structured_data={"severity": "mild"},
    )
    assert len(flags) == 0
