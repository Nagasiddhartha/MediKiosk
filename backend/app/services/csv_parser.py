import csv
import io
from datetime import datetime

from dateutil import parser as date_parser


ALLOWED_READING_TYPES = {
    "blood_pressure",
    "blood_glucose",
    "weight",
    "temperature",
    "heart_rate",
    "spo2",
}


def parse_csv_content(content: str, filename: str | None = None) -> dict:
    valid_rows = []
    invalid_rows = []
    
    f = io.StringIO(content)
    reader = csv.DictReader(f)
    
    for row_num, row in enumerate(reader, start=2):
        try:
            reading_type = (row.get("reading_type") or "").strip().lower()
            value_raw = (row.get("value") or "").strip()
            unit = (row.get("unit") or "").strip()
            recorded_at_raw = (
                row.get("recorded_at") or row.get("date") or row.get("timestamp") or ""
            ).strip()
            
            # Allow fallback if separate systolic/diastolic or numeric_value columns provided
            if not value_raw:
                if reading_type == "blood_pressure" and row.get("systolic") and row.get("diastolic"):
                    value_raw = f"{str(row.get('systolic')).strip()}/{str(row.get('diastolic')).strip()}"
                elif row.get("numeric_value"):
                    value_raw = str(row.get("numeric_value")).strip()

            if not reading_type or reading_type not in ALLOWED_READING_TYPES:
                raise ValueError(f"Invalid reading_type: {reading_type}")
                
            if not recorded_at_raw:
                raise ValueError("Missing recorded_at timestamp")
                
            recorded_at = date_parser.parse(recorded_at_raw)
            
            reading_data = {
                "reading_type": reading_type,
                "unit": unit,
                "recorded_at": recorded_at,
                "source": "csv_import",
            }
            if row.get("notes"):
                reading_data["notes"] = row.get("notes").strip()
            
            if reading_type == "blood_pressure":
                if "/" in value_raw:
                    parts = value_raw.split("/")
                    reading_data["systolic"] = float(parts[0])
                    reading_data["diastolic"] = float(parts[1])
                    reading_data["value_text"] = value_raw
                else:
                    raise ValueError("BP must be in format '120/80'")
            else:
                reading_data["numeric_value"] = float(value_raw)
                reading_data["value_text"] = value_raw
                
            valid_rows.append(reading_data)
            
        except Exception as e:
            invalid_rows.append({
                "row": row_num,
                "data": row,
                "error": str(e)
            })
            
    return {
        "valid_rows": valid_rows,
        "invalid_rows": invalid_rows,
        "total_rows": len(valid_rows) + len(invalid_rows)
    }   