# Places Search (V3.4)

Birth place search uses OSM Nominatim (dev only) and caches results in Postgres.

## Search API

```bash
curl "http://127.0.0.1:8000/api/places/search?q=New%20York&limit=5" \
  -H "Authorization: Bearer <token>"
```

Response:

```json
[
  {
    "place_id": "<uuid>",
    "display_name": "New York, United States",
    "lat": 40.7128,
    "lon": -74.0060,
    "timezone": "America/New_York"
  }
]
```

## Notes

- Results are cached in `places` and reused when creating charts.
- Geocoding is rate-limited to ~1 req/sec per process.
- If the local time is ambiguous or non-existent due to DST, chart creation
  returns a 400 with a clear error message.
