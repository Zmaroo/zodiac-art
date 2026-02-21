# API Manual Tests

## Start the API

```bash
python -m zodiac_art.api.app
```

Auth is required for chart endpoints. Get a token via `/api/auth/register` or
`/api/auth/login` and include `Authorization: Bearer <token>`.

## List frames

```bash
curl http://127.0.0.1:8000/api/frames
```

## Create chart

```bash
curl -X POST http://127.0.0.1:8000/api/charts \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Chart 1",
    "birth_date": "1990-04-12",
    "birth_time": "08:45",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "default_frame_id": "artnouveau_test"
  }'
```


## List charts

```bash
curl http://127.0.0.1:8000/api/charts \
  -H "Authorization: Bearer <token>"
```

## Fetch chart

```bash
curl http://127.0.0.1:8000/api/charts/<chart_id> \
  -H "Authorization: Bearer <token>"
```

## Render SVG

```bash
curl http://127.0.0.1:8000/api/charts/<chart_id>/render.svg?frame_id=artnouveau_test \
  -o /tmp/zodiac_art.svg
```

## Render PNG

```bash
curl http://127.0.0.1:8000/api/charts/<chart_id>/render.png?frame_id=artnouveau_test\&size=1024 \
  -o /tmp/zodiac_art.png
```

## Render export (saved)

Use these endpoints for longer-lived, "final" assets. They return private cache
headers with a longer max-age and support ETag revalidation.

```bash
curl http://127.0.0.1:8000/api/charts/<chart_id>/render_export.svg?frame_id=artnouveau_test \
  -o /tmp/zodiac_art_export.svg
```

```bash
curl http://127.0.0.1:8000/api/charts/<chart_id>/render_export.png?frame_id=artnouveau_test\&size=2048 \
  -o /tmp/zodiac_art_export.png
```

## Render export (chart only)

```bash
curl http://127.0.0.1:8000/api/charts/<chart_id>/render_export_chart.svg \
  -o /tmp/zodiac_art_export_chart.svg
```

```bash
curl http://127.0.0.1:8000/api/charts/<chart_id>/render_export_chart.png?size=2048 \
  -o /tmp/zodiac_art_export_chart.png
```

## Save metadata

```bash
curl -X PUT http://127.0.0.1:8000/api/charts/<chart_id>/frames/artnouveau_test/metadata \
  -H "Content-Type: application/json" \
  -d @/path/to/metadata.json
```

## Save layout

```bash
curl -X PUT http://127.0.0.1:8000/api/charts/<chart_id>/frames/artnouveau_test/layout \
  -H "Content-Type: application/json" \
  -d @/path/to/layout.json
```
