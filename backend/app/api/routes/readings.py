from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.csv_import_batch import CSVImportBatch
from app.models.health_reading import HealthReading
from app.models.user import User
from app.schemas.readings import CSVImportResult, HealthReadingCreate, HealthReadingRead
from app.schemas.trends import ReadingTimeSeriesPoint, ReadingsTrendResponse
from app.services.csv_parser import parse_csv_content


router = APIRouter()


@router.get(
    "/trends",
    response_model=ReadingsTrendResponse,
)
def get_readings_trends(
    reading_type: str = Query(default="blood_pressure"),
    days: int = Query(default=30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=days)

    readings = db.scalars(
        select(HealthReading)
        .where(
            HealthReading.user_id == current_user.id,
            HealthReading.reading_type == reading_type,
            HealthReading.recorded_at >= cutoff,
        )
        .order_by(HealthReading.recorded_at.asc())
    ).all()

    points = [
        ReadingTimeSeriesPoint(
            id=str(r.id),
            recorded_at=r.recorded_at,
            reading_type=r.reading_type,
            numeric_value=r.numeric_value,
            systolic=r.systolic,
            diastolic=r.diastolic,
            value_text=r.value_text,
            unit=r.unit,
            source=r.source,
        )
        for r in readings
    ]

    caution_flags: list[str] = []
    trend_dir = "stable"
    avg_sys = None
    avg_dia = None
    avg_num = None
    min_num = None
    max_num = None

    if readings:
        if reading_type == "blood_pressure":
            sys_vals = [r.systolic for r in readings if r.systolic is not None]
            dia_vals = [r.diastolic for r in readings if r.diastolic is not None]
            if sys_vals:
                avg_sys = round(sum(sys_vals) / len(sys_vals), 1)
                min_num = min(sys_vals)
                max_num = max(sys_vals)
            if dia_vals:
                avg_dia = round(sum(dia_vals) / len(dia_vals), 1)

            if len(sys_vals) >= 4:
                first_half = sys_vals[: len(sys_vals) // 2]
                second_half = sys_vals[len(sys_vals) // 2 :]
                diff = (sum(second_half) / len(second_half)) - (sum(first_half) / len(first_half))
                if diff > 5:
                    trend_dir = "rising"
                elif diff < -5:
                    trend_dir = "falling"

            elevated = sum(
                1
                for r in readings
                if (r.systolic and r.systolic >= 140) or (r.diastolic and r.diastolic >= 90)
            )
            if elevated > 0:
                caution_flags.append(
                    f"{elevated} reading(s) show elevated blood pressure (>= 140/90 mmHg)."
                )

        else:
            num_vals = [r.numeric_value for r in readings if r.numeric_value is not None]
            if num_vals:
                avg_num = round(sum(num_vals) / len(num_vals), 1)
                min_num = min(num_vals)
                max_num = max(num_vals)

                if len(num_vals) >= 4:
                    first_half = num_vals[: len(num_vals) // 2]
                    second_half = num_vals[len(num_vals) // 2 :]
                    diff = (sum(second_half) / len(second_half)) - (sum(first_half) / len(first_half))
                    if diff > 0.05 * (avg_num or 1):
                        trend_dir = "rising"
                    elif diff < -0.05 * (avg_num or 1):
                        trend_dir = "falling"

                if reading_type == "blood_glucose":
                    high_glucose = sum(1 for v in num_vals if v >= 126)
                    low_glucose = sum(1 for v in num_vals if v < 70)
                    if high_glucose > 0:
                        caution_flags.append(f"{high_glucose} reading(s) show elevated glucose (>= 126 mg/dL).")
                    if low_glucose > 0:
                        caution_flags.append(f"{low_glucose} reading(s) show low glucose (< 70 mg/dL).")
                elif reading_type == "heart_rate":
                    high_hr = sum(1 for v in num_vals if v >= 100)
                    if high_hr > 0:
                        caution_flags.append(f"{high_hr} heart rate reading(s) >= 100 bpm.")
                elif reading_type == "temperature":
                    fever = sum(1 for v in num_vals if v >= 38.0 or v >= 100.4)
                    if fever > 0:
                        caution_flags.append(f"{fever} temperature reading(s) indicating fever.")

    return ReadingsTrendResponse(
        reading_type=reading_type,
        days=days,
        data_points_count=len(readings),
        latest_point=points[-1] if points else None,
        average_systolic=avg_sys,
        average_diastolic=avg_dia,
        average_numeric=avg_num,
        min_numeric=min_num,
        max_numeric=max_num,
        trend_direction=trend_dir,
        caution_flags=caution_flags,
        time_series=points,
    )


@router.get(
    "",
    response_model=list[HealthReadingRead],
)
def list_readings(
    reading_type: str | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = select(HealthReading).where(HealthReading.user_id == current_user.id)
    
    if reading_type:
        query = query.where(HealthReading.reading_type == reading_type)
        
    query = query.order_by(HealthReading.recorded_at.desc()).offset(skip).limit(limit)
    
    readings = db.scalars(query).all()
    return readings


@router.post(
    "",
    response_model=HealthReadingRead,
    status_code=status.HTTP_201_CREATED,
)
def create_reading(
    payload: HealthReadingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reading = HealthReading(
        user_id=current_user.id,
        **payload.model_dump(),
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)
    return reading


@router.post(
    "/import-csv",
    response_model=CSVImportResult,
    status_code=status.HTTP_201_CREATED,
)
async def import_csv(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV",
        )
        
    content = await file.read()
    text_content = content.decode("utf-8")
    
    parsed = parse_csv_content(text_content, file.filename)
    
    batch = CSVImportBatch(
        user_id=current_user.id,
        filename=file.filename,
        total_rows=parsed["total_rows"],
        valid_rows=len(parsed["valid_rows"]),
        invalid_rows=len(parsed["invalid_rows"]),
    )
    db.add(batch)
    db.flush()
    
    valid_cols = {"reading_type", "unit", "recorded_at", "source", "systolic", "diastolic", "numeric_value", "value_text"}
    for row_data in parsed["valid_rows"]:
        model_kwargs = {k: v for k, v in row_data.items() if k in valid_cols}
        reading = HealthReading(
            user_id=current_user.id,
            import_batch_id=batch.id,
            **model_kwargs,
        )
        db.add(reading)
        
    db.commit()
    db.refresh(batch)
    
    return CSVImportResult(
        batch_id=batch.id,
        filename=batch.filename,
        total_rows=batch.total_rows,
        valid_rows=batch.valid_rows,
        invalid_rows=batch.invalid_rows,
        errors=parsed["invalid_rows"],
    )


@router.delete(
    "/{reading_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_reading(
    reading_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reading = db.scalar(
        select(HealthReading).where(
            HealthReading.id == reading_id,
            HealthReading.user_id == current_user.id,
        )
    )
    if not reading:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reading not found",
        )
    db.delete(reading)
    db.commit()
    return None