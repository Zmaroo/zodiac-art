"""Frame routes."""

from __future__ import annotations

import json
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile

from zodiac_art.api.auth import AuthUser
from zodiac_art.api.deps import get_frame_store, is_admin, optional_user, require_user
from zodiac_art.api.frames_store import (
    PostgresFrameStore,
    normalize_tags,
    prepare_frame_files,
    template_metadata_from_opening,
    validate_frame_image,
    write_template_metadata,
)
from zodiac_art.config import STORAGE_ROOT, load_config
from zodiac_art.frames.validation import validate_meta

router = APIRouter()


def _public_url(rel_path: str) -> str:
    storage_path = STORAGE_ROOT / rel_path
    if storage_path.exists():
        return f"/static/storage/{rel_path}"
    return f"/static/{rel_path}"


def _parse_template_metadata(raw_json: str | None) -> dict | None:
    if not raw_json:
        return None
    try:
        data = json.loads(raw_json)
    except json.JSONDecodeError as exc:
        raise ValueError("Invalid template_metadata_json") from exc
    if not isinstance(data, dict):
        raise ValueError("template_metadata_json must be an object")
    return data


@router.get("/api/frames")
async def list_frames(
    request: Request,
    tag: str | None = None,
    mine: bool | None = None,
    limit: int | None = 200,
    offset: int | None = 0,
    user: AuthUser | None = Depends(optional_user),
) -> list[dict]:
    tag_filter = tag.strip().lower() if tag else None
    safe_limit = max(1, min(limit or 200, 500))
    safe_offset = max(0, offset or 0)
    owner_user_id = None
    include_global = True
    if mine:
        if not user:
            raise HTTPException(status_code=401, detail="Authentication required")
        owner_user_id = user.user_id
        include_global = False
    elif mine is False:
        owner_user_id = None
        include_global = True
    elif user:
        owner_user_id = user.user_id
    records = await get_frame_store(request).list_frames(
        tag=tag_filter,
        owner_user_id=owner_user_id,
        include_global=include_global,
        limit=safe_limit,
        offset=safe_offset,
    )
    response: list[dict] = []
    for record in records:
        response.append(
            {
                "id": record.frame_id,
                "name": record.name,
                "tags": record.tags,
                "width": record.width,
                "height": record.height,
                "thumb_url": _public_url(record.thumb_path),
            }
        )
    return response


@router.get("/api/frames/{frame_id}")
async def get_frame(request: Request, frame_id: str) -> dict:
    record = await get_frame_store(request).get_frame(frame_id)
    if not record:
        raise HTTPException(status_code=404, detail="Frame not found")
    return {
        "id": record.frame_id,
        "name": record.name,
        "tags": record.tags,
        "width": record.width,
        "height": record.height,
        "thumb_url": _public_url(record.thumb_path),
        "image_url": _public_url(record.image_path),
        "template_metadata_json": record.template_metadata_json,
    }


@router.post("/api/frames")
async def create_frame(
    request: Request,
    file: UploadFile = File(...),
    name: str = Form(...),
    tags: str | None = Form(None),
    template_metadata_json: str | None = Form(None),
    global_frame: bool = Form(False),
    user: AuthUser = Depends(require_user),
) -> dict:
    frame_store = get_frame_store(request)
    if not isinstance(frame_store, PostgresFrameStore):
        raise HTTPException(status_code=500, detail="Database not configured")
    if not name.strip():
        raise HTTPException(status_code=400, detail="Frame name is required")
    if not file.content_type or file.content_type.lower() not in {
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp",
    }:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty upload")

    from io import BytesIO

    from PIL import Image

    try:
        with Image.open(BytesIO(data)) as image:
            image.load()
            width, height = validate_frame_image(image)
            metadata = _parse_template_metadata(template_metadata_json)
            if metadata is None:
                config = load_config()
                metadata = template_metadata_from_opening(
                    image,
                    config.sign_ring_inner_ratio,
                )
            validate_meta(metadata, image.size)
            frame_id = str(uuid4())
            file_info = prepare_frame_files(frame_id, image)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    write_template_metadata(frame_id, metadata)
    owner_user_id = user.user_id
    if global_frame:
        if not is_admin(request, user):
            raise HTTPException(status_code=403, detail="Admin required")
        owner_user_id = None
    record = await frame_store.create_frame(
        frame_id=frame_id,
        owner_user_id=owner_user_id,
        name=name.strip(),
        tags=normalize_tags(tags or ""),
        width=width,
        height=height,
        image_path=file_info["image_path"],
        thumb_path=file_info["thumb_256"],
        template_metadata_json=metadata,
        thumbnails=[
            (256, file_info["thumb_256"]),
            (512, file_info["thumb_512"]),
        ],
    )
    return {
        "id": record.frame_id,
        "name": record.name,
        "tags": record.tags,
        "width": record.width,
        "height": record.height,
        "thumb_url": _public_url(record.thumb_path),
        "image_url": _public_url(record.image_path),
        "template_metadata_json": record.template_metadata_json,
    }
