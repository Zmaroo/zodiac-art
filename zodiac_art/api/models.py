"""API request/response models."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ChartCreateRequest(BaseModel):
    """Request to create a chart."""

    name: str | None = None
    birth_date: str
    birth_time: str
    latitude: float | None = None
    longitude: float | None = None
    birth_place_id: str | None = None
    default_frame_id: str | None = None


class ChartCreateResponse(BaseModel):
    """Response containing the new chart id."""

    chart_id: str


class ChartSaveRequest(BaseModel):
    """Request to save a chart or session."""

    session_id: str | None = None
    name: str | None = None
    birth_date: str | None = None
    birth_time: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    birth_place_id: str | None = None
    default_frame_id: str | None = None


class ChartSessionCreateResponse(BaseModel):
    """Response containing the new session id."""

    session_id: str


class FrameListItem(BaseModel):
    """Frame entry returned by the API."""

    id: str
    image_path: str
    template_meta_path: str


class ChartFrameStatus(BaseModel):
    """Saved state for a chart frame."""

    id: str
    has_metadata: bool = Field(default=False)
    has_layout: bool = Field(default=False)


class ChartInfoResponse(BaseModel):
    """Chart info response."""

    chart_id: str
    name: str | None = None
    birth_date: str
    birth_time: str
    latitude: float
    longitude: float
    default_frame_id: str | None
    created_at: str | None = None
    birth_place_text: str | None = None
    birth_place_id: str | None = None
    timezone: str | None = None
    birth_datetime_utc: str | None = None
    frames: list[ChartFrameStatus]


class ChartSessionInfoResponse(BaseModel):
    """Chart session info response."""

    session_id: str
    name: str | None = None
    birth_date: str
    birth_time: str
    latitude: float
    longitude: float
    default_frame_id: str | None
    created_at: str | None = None
    birth_place_text: str | None = None
    birth_place_id: str | None = None
    timezone: str | None = None
    birth_datetime_utc: str | None = None
    frames: list[ChartFrameStatus]


class ChartListItem(BaseModel):
    """Chart list entry."""

    chart_id: str
    name: str | None = None
    created_at: str | None = None
    default_frame_id: str | None = None


class AutoLayoutRequest(BaseModel):
    """Request for auto layout."""

    mode: str = "glyphs"
    min_gap_px: int = 10
    max_iter: int = 200


class AutoLayoutResponse(BaseModel):
    """Auto layout response."""

    overrides: dict[str, dict[str, float]]


class AuthRequest(BaseModel):
    """Auth request payload."""

    email: str
    password: str


class AuthUserInfo(BaseModel):
    """Authenticated user info."""

    id: str
    email: str
    is_admin: bool


class AuthResponse(BaseModel):
    """Auth response payload."""

    token: str
    user: AuthUserInfo
