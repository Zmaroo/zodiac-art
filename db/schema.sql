CREATE TABLE IF NOT EXISTS charts (
  id UUID PRIMARY KEY,
  birth_date TEXT NOT NULL,
  birth_time TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  default_frame_id TEXT NULL,
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
