# Frames Library

Frames are stored as DB records and files on disk.

## Storage Layout

```
storage/frames/<frame_uuid>/
  original.png
  thumb_256.png
  thumb_512.png
  template_metadata.json
```

The database stores relative paths like:

```
image_path = "frames/<uuid>/original.png"
thumb_path = "frames/<uuid>/thumb_256.png"
```

## Seeding Built-In Frames

Seed the existing on-disk presets into the DB:

```bash
python -m zodiac_art.db.init_db
python -m zodiac_art.db.seed_frames
```

## API Usage

List frames:

```bash
curl http://127.0.0.1:8000/api/frames
```

Upload frame:

```bash
curl -X POST http://127.0.0.1:8000/api/frames \
  -F "file=@/path/to/frame.png" \
  -F "name=My Frame" \
  -F "tags=art nouveau, gold"
```

## Editor

The editor pulls thumbnails from `/api/frames`, lets you upload new frames,
and stores per-chart metadata/layout for a selected frame id.
