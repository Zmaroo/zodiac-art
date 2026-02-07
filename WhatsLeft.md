Step 1: Make Postgres the source of truth for charts (finish V3.0)

You already wired asyncpg. Next:
	1.	Add users table + minimal auth (JWT)
	2.	Add charts.user_id + charts.name
	3.	Replace file chart_id flows in the editor:
	•	Create chart under logged-in user
	•	List charts for user (recent)
	•	Load chart by id

Deliverable: user can log in, create a named chart, reopen it later.

⸻

Step 2: Add a real frame library (V3.1)

DB schema

Add frames table (plus optional frame_tags if you want normalized).
Fields:
	•	id uuid
	•	owner_user_id nullable (NULL = built-in)
	•	name
	•	tags text[]
	•	width,height
	•	image_path
	•	thumb_path
	•	template_metadata_json jsonb
	•	created_at

API
	•	POST /api/frames (multipart upload)
	•	validate square + size (start with 1024 or 4500)
	•	generate thumbnails (e.g., 256 and 512)
	•	store files under storage/frames/<frame_id>/...
	•	insert DB record
	•	GET /api/frames?tag=...&owner=... returns thumbs + metadata
	•	GET /api/frames/{id} returns full detail

Deliverable: frames list in editor comes from DB, and you can upload a frame and it appears instantly.

⸻

Step 3: Frame gallery UX in editor (V3.2)

Replace dropdown with:
	•	thumbnail grid
	•	filter by tags/style
	•	“Built-in” vs “My frames”
	•	when selecting a frame: call render endpoint and show preview

Deliverable: scrollable style browsing.

⸻

Step 4: “Generate chart without frame” (V3.3)

Allow frame_id = null:
	•	render chart on transparent background (SVG)
	•	optional neutral background for preview
	•	later user can “Apply frame” from gallery

Deliverable: faster flow + lets users pick style later.

⸻

Step 5: Location → lat/lon + timezone (geocoding) (V3.4)

Add places cache table and change create chart to accept birth_place:
	•	POST /api/places/search?q=... (autocomplete later)
	•	resolve lat/lon + tz once, store on chart

Deliverable: users type “City, State” instead of coordinates.

⸻

Step 6: Regenerated style previews (your “different styles of regenerated charts”)

Do this after the frame library exists.

Add:
	•	“Generate previews for this chart across selected styles”
	•	store preview images (chart_previews table) so browsing is instant

This is where you can integrate AI “style packs” cleanly.

⸻

What I’d do next, concretely (the very next sprint)

Implement Frames DB + Upload API + Editor Upload UI.

Because:
	•	it unlocks built-in frame packs + user-generated frames
	•	it enables the thumbnail gallery
	•	it’s required before “regenerated frames per style” makes sense

If you want, I’ll write a single OpenCode prompt for V3.1 Frames DB + Upload + thumbnails + editor integration using asyncpg + FastAPI.