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
