from app.services.confidence import compute_parse_score, confidence_tier, field_confidence


def test_confidence_tier_boundaries():
    assert confidence_tier(0.95) == "tier1"
    assert confidence_tier(0.80) == "tier1"
    assert confidence_tier(0.79) == "tier2"
    assert confidence_tier(0.60) == "tier2"
    assert confidence_tier(0.59) == "tier3"
    assert confidence_tier(0.35) == "tier3"
    assert confidence_tier(0.34) == "tier4"
    assert confidence_tier(0.0) == "tier4"
    assert confidence_tier(None) == "tier4"


def test_field_confidence_calculation():
    # 50% OCR + 35% LLM + 15% Parse
    # 0.50 * 1.0 + 0.35 * 1.0 + 0.15 * 1.0 = 1.0
    score = field_confidence(ocr_confidence=1.0, llm_confidence=1.0, parse_score=1.0)
    assert score == 1.0

    score_low = field_confidence(ocr_confidence=0.4, llm_confidence=0.3, parse_score=0.2)
    expected = (0.50 * 0.4) + (0.35 * 0.3) + (0.15 * 0.2)
    assert round(score_low, 4) == round(expected, 4)


def test_compute_parse_score():
    score = compute_parse_score(
        field_name="medication_name",
        raw_value="Amlodipine",
        unit="mg",
        normalized_value={"drug": "Amlodipine"},
    )
    assert score > 0.5
