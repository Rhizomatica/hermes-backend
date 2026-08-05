CREATE TABLE user_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  device_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  refresh_replaced_by TEXT,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_user_sessions_user_id ON user_sessions (user_id);
--> statement-breakpoint
CREATE INDEX idx_user_sessions_token_hash ON user_sessions (token_hash);
--> statement-breakpoint
CREATE INDEX idx_user_sessions_expires_active ON user_sessions (expires_at);