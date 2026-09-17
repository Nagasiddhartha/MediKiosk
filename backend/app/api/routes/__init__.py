from fastapi import APIRouter

from app.api.routes.allergies import router as allergies_router
from app.api.routes.audit_logs import router as audit_logs_router
from app.api.routes.auth import router as auth_router
from app.api.routes.conditions import router as conditions_router
from app.api.routes.consent import router as consent_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.demo import router as demo_router
from app.api.routes.documents import router as documents_router
from app.api.routes.export import router as export_router
from app.api.routes.intake import router as intake_router
from app.api.routes.medications import router as medications_router
from app.api.routes.profile import router as profile_router
from app.api.routes.readings import router as readings_router
from app.api.routes.red_flags import router as red_flags_router
from app.api.routes.red_thread import router as red_thread_router
from app.api.routes.summary import router as summary_router
from app.api.routes.symptoms import router as symptoms_router
from app.api.routes.timeline import router as timeline_router
from app.api.routes.users import router as users_router
from app.api.routes.visits import router as visits_router


api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
api_router.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(profile_router, prefix="/profile", tags=["profile"])
api_router.include_router(conditions_router, prefix="/conditions", tags=["conditions"])
api_router.include_router(allergies_router, prefix="/allergies", tags=["allergies"])
api_router.include_router(medications_router, prefix="/medications", tags=["medications"])
api_router.include_router(visits_router, prefix="/visits", tags=["visits"])
api_router.include_router(symptoms_router, prefix="/symptoms", tags=["symptoms"])
api_router.include_router(intake_router, prefix="/intake", tags=["intake"])
api_router.include_router(readings_router, prefix="/readings", tags=["readings"])
api_router.include_router(red_flags_router, prefix="/red-flags", tags=["red-flags"])
api_router.include_router(red_thread_router, prefix="/red-thread", tags=["red-thread"])
api_router.include_router(documents_router, prefix="/documents", tags=["documents"])
api_router.include_router(timeline_router, prefix="/timeline", tags=["timeline"])
api_router.include_router(summary_router, prefix="/summary", tags=["summary"])
api_router.include_router(export_router, prefix="/export", tags=["export"])
api_router.include_router(consent_router, prefix="/consent", tags=["consent"])
api_router.include_router(audit_logs_router, prefix="/audit-logs", tags=["audit-logs"])
api_router.include_router(demo_router, prefix="/demo", tags=["demo"])