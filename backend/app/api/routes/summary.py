from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.services.summary_pdf import generate_doctor_summary_pdf


router = APIRouter()


@router.get("/pdf")
def download_doctor_summary_pdf(
    days: int = Query(default=30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pdf_bytes = generate_doctor_summary_pdf(
        user_id=current_user.id,
        db=db,
        days=days,
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": "attachment; filename=medikiosk-doctor-summary.pdf"
        },
    )