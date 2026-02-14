"""Analytics router for marketplace intelligence data."""

from fastapi import APIRouter, Depends, Query
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from server.dependencies import get_lakebase_service
from server.services.lakebase_service import LakebaseService


router = APIRouter()


# =============================================================================
# Helpers
# =============================================================================

def round_float(value: float | None, decimals: int = 1) -> float:
    """Round a float to specified decimal places. Returns 0.0 if None."""
    if value is None:
        return 0.0
    return round(float(value), decimals)


# =============================================================================
# Response Models
# =============================================================================

class CitiesResponse(BaseModel):
    """Response for cities endpoint."""
    cities: list[str]


class PropertyTypesResponse(BaseModel):
    """Response for property types endpoint."""
    property_types: list[str]


class CityInvestment(BaseModel):
    """City investment data."""
    city: str
    demand: int
    conversion: float
    revenue: float
    quadrant: str


class CityInvestmentResponse(BaseModel):
    """Response for city investment endpoint."""
    data: list[CityInvestment]


class FunnelData(BaseModel):
    """Funnel metrics."""
    viewers: int
    bookers: int
    completed: int


class CityFunnelResponse(BaseModel):
    """Response for city funnel endpoint."""
    city: str
    days: int
    funnel: FunnelData


class Property(BaseModel):
    """Property performance data - optimized for display."""
    id: str
    name: str
    city: str
    property_type: str | None
    views: int
    bookings: int
    initiation_rate: float  # booked %
    completion_rate: float
    cancel_rate: float
    payment_fail_rate: float
    avg_review_rating: float | None
    revenue: float
    bucket: str  # promote, intervention, at_risk


class CityAverages(BaseModel):
    """City average metrics for bucketing."""
    avg_views: float
    avg_initiation_rate: float
    property_count: int


class PropertiesResponse(BaseModel):
    """Response for properties endpoint."""
    city: str
    properties: list[Property]
    city_averages: dict[str, CityAverages]


class Amenity(BaseModel):
    """Amenity lift data."""
    name: str
    lift: float
    impact_tier: str | None


class AmenitiesResponse(BaseModel):
    """Response for amenities endpoint."""
    city: str
    property_type: str
    amenities: list[Amenity]


class TopAmenityCity(BaseModel):
    """Top amenity for a city."""
    city: str
    property_type: str
    amenity_name: str
    lift: float
    rank: int


class TopAmenitiesResponse(BaseModel):
    """Response for top amenities by city."""
    data: list[TopAmenityCity]


class DeviceFunnel(BaseModel):
    """Device-specific funnel data."""
    viewers: int
    bookers: int
    completed: int


class WeeklyTrend(BaseModel):
    """Weekly conversion trend by device."""
    week: str
    desktop: float | None = None
    mobile: float | None = None
    tablet: float | None = None


class DeviceDiagnosis(BaseModel):
    """Device diagnosis data."""
    desktopRate: float
    mobileRate: float
    tabletRate: float
    deviceGap: float
    diagnosis: str
    mobileTrend: str


class DeviceMetricsResponse(BaseModel):
    """Response for device metrics endpoint."""
    city: str
    deviceFunnel: dict[str, DeviceFunnel]
    weeklyTrends: list[WeeklyTrend]
    diagnosis: DeviceDiagnosis


# =============================================================================
# Endpoints
# =============================================================================

@router.get("/cities", response_model=CitiesResponse)
async def get_cities(
    service: LakebaseService = Depends(get_lakebase_service)
):
    """Get list of all cities for dropdowns."""
    cities = await run_in_threadpool(service.get_cities)
    return {"cities": cities}


@router.get("/city-investment", response_model=CityInvestmentResponse)
async def get_city_investment(
    service: LakebaseService = Depends(get_lakebase_service)
):
    """Get city investment matrix data for the overview tab."""
    data = await run_in_threadpool(service.get_city_investment)

    # Round float values for cleaner UI display
    rounded_data = [
        {
            **row,
            "conversion": round_float(row["conversion"]),
            "revenue": round_float(row["revenue"]),
        }
        for row in data
    ]
    return {"data": rounded_data}


@router.get("/city-funnel", response_model=CityFunnelResponse)
async def get_city_funnel(
    city: str | None = Query(None, description="Filter by city (or 'all')"),
    days: int = Query(90, ge=1, le=365, description="Number of days to look back"),
    service: LakebaseService = Depends(get_lakebase_service)
):
    """Get conversion funnel data by city."""
    return await run_in_threadpool(service.get_city_funnel, city, days)


@router.get("/properties", response_model=PropertiesResponse)
async def get_properties(
    city: str | None = Query(None, description="Filter by city (or 'all')"),
    service: LakebaseService = Depends(get_lakebase_service)
):
    """Get property performance data with city averages and bucket categorization."""
    result = await run_in_threadpool(service.get_properties, city)

    # Transform properties with rounded floats
    formatted_properties = [
        {
            "id": str(p["id"]),
            "name": p["name"] or "",
            "city": p["city"] or "",
            "property_type": p["property_type"],
            "views": int(p["views"] or 0),
            "bookings": int(p["bookings"] or 0),
            "initiation_rate": round_float(p["initiation_rate"]),
            "completion_rate": round_float(p["completion_rate"]),
            "cancel_rate": round_float(p["cancel_rate"]),
            "payment_fail_rate": round_float(p["payment_fail_rate"]),
            "avg_review_rating": round_float(p["avg_review_rating"]) if p["avg_review_rating"] else None,
            "revenue": round_float(p["revenue"]),
            "bucket": p["bucket"],
        }
        for p in result["properties"]
    ]

    # Round city averages
    formatted_averages = {
        c: {
            "avg_views": round_float(avg["avg_views"]),
            "avg_initiation_rate": round_float(avg["avg_initiation_rate"]),
            "property_count": avg["property_count"],
        }
        for c, avg in result["city_averages"].items()
    }

    return {
        "city": city or "All Cities",
        "properties": formatted_properties,
        "city_averages": formatted_averages,
    }


@router.get("/amenities", response_model=AmenitiesResponse)
async def get_amenities(
    city: str | None = Query(None, description="Filter by city (or 'all')"),
    property_type: str | None = Query(None, description="Filter by property type"),
    service: LakebaseService = Depends(get_lakebase_service)
):
    """Get amenity lift data."""
    amenities = await run_in_threadpool(service.get_amenities, city, property_type)

    formatted_amenities = [
        {"name": a["name"], "lift": round_float(a["lift"]), "impact_tier": a["impact_tier"]}
        for a in amenities
    ]

    return {
        "city": city or "All Cities",
        "property_type": property_type or "All Types",
        "amenities": formatted_amenities
    }


@router.get("/amenities/top-by-city", response_model=TopAmenitiesResponse)
async def get_top_amenities_by_city(
    service: LakebaseService = Depends(get_lakebase_service)
):
    """Get top 3 amenities for each city."""
    data = await run_in_threadpool(service.get_top_amenities_by_city)

    formatted_data = [
        {
            "city": row["city"],
            "property_type": row["property_type"],
            "amenity_name": row["amenity_name"],
            "lift": round_float(row["lift"]),
            "rank": int(row["rank"] or 0)
        }
        for row in data
    ]

    return {"data": formatted_data}


@router.get("/device-metrics", response_model=DeviceMetricsResponse)
async def get_device_metrics(
    city: str | None = Query(None, description="Filter by city (or 'all')"),
    weeks: int = Query(6, ge=1, le=52, description="Number of weeks to look back"),
    service: LakebaseService = Depends(get_lakebase_service)
):
    """Get device-segmented funnel and trends."""
    result = await run_in_threadpool(service.get_device_metrics, city, weeks)

    # Round float values in weekly trends
    rounded_trends = [
        {
            "week": t["week"],
            "desktop": round_float(t.get("desktop")) if t.get("desktop") is not None else None,
            "mobile": round_float(t.get("mobile")) if t.get("mobile") is not None else None,
            "tablet": round_float(t.get("tablet")) if t.get("tablet") is not None else None,
        }
        for t in result.get("weeklyTrends", [])
    ]

    # Round float values in diagnosis
    diagnosis = result.get("diagnosis", {})
    rounded_diagnosis = {
        "desktopRate": round_float(diagnosis.get("desktopRate")),
        "mobileRate": round_float(diagnosis.get("mobileRate")),
        "tabletRate": round_float(diagnosis.get("tabletRate")),
        "deviceGap": round_float(diagnosis.get("deviceGap")),
        "diagnosis": diagnosis.get("diagnosis", "unknown"),
        "mobileTrend": diagnosis.get("mobileTrend", "unknown"),
    }

    return {
        "city": result.get("city", "All Cities"),
        "deviceFunnel": result.get("deviceFunnel", {}),
        "weeklyTrends": rounded_trends,
        "diagnosis": rounded_diagnosis,
    }


@router.get("/property-types", response_model=PropertyTypesResponse)
async def get_property_types(
    service: LakebaseService = Depends(get_lakebase_service)
):
    """Get list of distinct property types."""
    property_types = await run_in_threadpool(service.get_property_types)
    return {"property_types": property_types}
