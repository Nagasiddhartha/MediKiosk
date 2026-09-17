from datetime import datetime
from typing import Any
from pydantic import BaseModel


class ReadingTimeSeriesPoint(BaseModel):
    id: str
    recorded_at: datetime
    reading_type: str
    numeric_value: float | None = None
    systolic: int | None = None
    diastolic: int | None = None
    value_text: str | None = None
    unit: str | None = None
    source: str | None = None


class ReadingsTrendResponse(BaseModel):
    reading_type: str
    days: int
    data_points_count: int
    latest_point: ReadingTimeSeriesPoint | None = None
    average_systolic: float | None = None
    average_diastolic: float | None = None
    average_numeric: float | None = None
    min_numeric: float | None = None
    max_numeric: float | None = None
    trend_direction: str = "stable"  # rising, falling, stable
    caution_flags: list[str] = []
    time_series: list[ReadingTimeSeriesPoint] = []
