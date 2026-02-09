CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS charts (
  id UUID PRIMARY KEY,
  user_id UUID NULL REFERENCES users(id) ON DELETE CASCADE,
  birth_date TEXT NOT NULL,
  birth_time TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  default_frame_id TEXT NULL,
  name TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chart_frames (
  chart_id UUID NOT NULL REFERENCES charts(id) ON DELETE CASCADE,
  frame_id TEXT NOT NULL,
  metadata_json JSONB NULL,
  layout_json JSONB NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chart_id, frame_id)
);

CREATE TABLE IF NOT EXISTS frames (
  id UUID PRIMARY KEY,
  owner_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  width INT NOT NULL,
  height INT NOT NULL,
  image_path TEXT NOT NULL,
  thumb_path TEXT NOT NULL,
  template_metadata_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS frame_thumbnails (
  frame_id UUID NOT NULL REFERENCES frames(id) ON DELETE CASCADE,
  size INT NOT NULL,
  path TEXT NOT NULL,
  PRIMARY KEY (frame_id, size)
);

CREATE TABLE IF NOT EXISTS places (
  id UUID PRIMARY KEY,
  query_text TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_place_id TEXT NULL,
  display_name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  timezone TEXT NULL,
  raw JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP INDEX IF EXISTS places_provider_place_id_idx;
CREATE UNIQUE INDEX IF NOT EXISTS places_provider_place_id_idx
  ON places(provider, provider_place_id);

CREATE INDEX IF NOT EXISTS places_display_name_idx
  ON places (lower(display_name));

ALTER TABLE charts
  ADD COLUMN IF NOT EXISTS user_id UUID NULL REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS name TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS chart_fit_json JSONB NULL,
  ADD COLUMN IF NOT EXISTS layout_json JSONB NULL,
  ADD COLUMN IF NOT EXISTS birth_place_text TEXT NULL,
  ADD COLUMN IF NOT EXISTS birth_place_id UUID NULL REFERENCES places(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS timezone TEXT NULL,
  ADD COLUMN IF NOT EXISTS birth_datetime_utc TIMESTAMPTZ NULL;

ALTER TABLE frames
  ADD COLUMN IF NOT EXISTS owner_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL;
