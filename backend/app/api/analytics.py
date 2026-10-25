from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User
from app.security import get_current_user
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/api/analytics", tags=["Analytics Dashboard"])


@router.get("")
async def get_analytics_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """FR-31 to FR-35: Fetch aggregated metrics, topic mastery, weak topic alerts, and trends."""
    data = await AnalyticsService.get_dashboard_metrics(db, current_user.id)
    return data