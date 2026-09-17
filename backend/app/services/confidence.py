def compute_parse_score(
    field_name: str,
    raw_value: str | None,
    normalized_value: dict | None = None,
    unit: str | None = None,
) -> float:
    score = 0.0

    if raw_value and str(raw_value).strip():
        score += 0.35

    if unit and str(unit).strip():
        score += 0.20

    if normalized_value:
        score += 0.25

    if field_name in {"document_date", "recorded_at"}:
        if normalized_value and normalized_value.get("date"):
            score += 0.20

    if field_name in {"value", "systolic", "diastolic"} and raw_value:
        score += 0.10

    if field_name in {"test_name", "medication_name"} and raw_value:
        score += 0.10

    return min(score, 1.0)


def field_confidence(
    ocr_confidence: float | None,
    llm_confidence: float | None,
    parse_score: float | None,
) -> float:
    ocr = ocr_confidence or 0.0
    llm = llm_confidence or 0.0
    parse = parse_score or 0.0

    final = (0.50 * ocr) + (0.35 * llm) + (0.15 * parse)

    if final < 0:
        return 0.0

    if final > 1:
        return 1.0

    return final


def confidence_tier(score: float | None) -> str:
    if score is None:
        return "tier4"

    if score >= 0.80:
        return "tier1"

    if score >= 0.60:
        return "tier2"

    if score >= 0.35:
        return "tier3"

    return "tier4"