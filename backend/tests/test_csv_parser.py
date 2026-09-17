from app.services.csv_parser import parse_csv_content


def test_parse_csv_valid_bp_and_glucose():
    content = """reading_type,value,unit,recorded_at
blood_pressure,120/80,mmHg,2026-09-01T08:00:00Z
blood_glucose,95,mg/dL,2026-09-01T08:30:00Z
weight,70.5,kg,2026-09-01T08:45:00Z
"""
    result = parse_csv_content(content)
    assert result["total_rows"] == 3
    assert len(result["valid_rows"]) == 3
    assert len(result["invalid_rows"]) == 0

    bp_row = result["valid_rows"][0]
    assert bp_row["reading_type"] == "blood_pressure"
    assert bp_row["systolic"] == 120
    assert bp_row["diastolic"] == 80

    glu_row = result["valid_rows"][1]
    assert glu_row["reading_type"] == "blood_glucose"
    assert glu_row["numeric_value"] == 95.0


def test_parse_csv_invalid_bp_format():
    content = """reading_type,value,unit,recorded_at
blood_pressure,120-80,mmHg,2026-09-01T08:00:00Z
"""
    result = parse_csv_content(content)
    assert result["total_rows"] == 1
    assert len(result["valid_rows"]) == 0
    assert len(result["invalid_rows"]) == 1
    assert "BP must be in format" in result["invalid_rows"][0]["error"]
