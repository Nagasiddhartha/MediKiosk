from fastapi import APIRouter
from scripts.seed_demo_data import seed_demo

router = APIRouter()


@router.post("/seed")
def trigger_demo_seed():
    seed_demo()
    return {
        "status": "success",
        "message": "Demo data seeded successfully for Eleanor Vance (eleanor@example.com / password123)",
    }
